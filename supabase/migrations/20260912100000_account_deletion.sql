-- ============================================================================
-- 40 · Deleting one's own account, and a door for the stores' reviewers
-- ============================================================================
-- The stores require that an account created in the app can be deleted from
-- the app (App Store guideline 5.1.1(v); Google Play asks for a web address
-- that explains the same). Two kinds of account, two outcomes:
--
--   A patient (a portal user): the sign-in is deleted outright. The medical
--   file is the clinic's record, kept under the clinic's legal duty; the
--   invitation row is unlinked and closed, so the address cannot sign in
--   again until the clinic invites it anew.
--
--   A member of staff: the sign-in is gone — sessions, identities, the
--   second factor, the password, the address — and so is every membership,
--   but the profile row stays as a tombstone holding only the professional
--   name, title and licence number. Signed treatment notes and appointments
--   point at it (`practitioner_id … on delete restrict`), and a medical
--   record that no longer says who treated is not a record. Phone and
--   picture go.
--
--   A clinic's only owner: with patients on file, the request is refused
--   and recorded for review — the clinic cannot lose its owner, and its
--   records cannot be dropped on a whim; the person is told to hand the
--   clinic over or to have it closed properly. With no patients and no
--   other members, the clinic goes with the account. With other members
--   but no other owner, they must make someone owner first.
--
-- Also here: `portal_password_login_allowed()`, true only for a portal user
-- of a synthetic clinic. The stores' reviewers have no mailbox to receive a
-- magic link, so the portal's sign-in accepts a password for them — and the
-- database, not the form, decides that a real patient never can.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The record of requests. `user_id` has no foreign key on purpose: a row
-- about a deleted account must outlive it. Nothing personal is kept for a
-- completed request; a request waiting for review keeps the address, so
-- the person can be reached.
-- ---------------------------------------------------------------------------
create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('patient', 'staff')),
  clinic_id uuid references public.clinics(id) on delete set null,
  status text not null check (status in ('done', 'needs_review')),
  -- Why review is needed: 'clinic_has_records' or 'clinic_needs_owner'.
  blocker text,
  email text,
  reason text,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  note text
);

create index if not exists account_deletion_requests_open_idx
  on public.account_deletion_requests (requested_at desc)
  where status = 'needs_review';

alter table public.account_deletion_requests enable row level security;

-- Whoever runs the service reads the open requests; nobody writes from the
-- application — the function below is the only writer.
drop policy if exists account_deletion_requests_admin on public.account_deletion_requests;
create policy account_deletion_requests_admin on public.account_deletion_requests
  for select using (public.is_platform_admin());

comment on table public.account_deletion_requests is
  'Every request to delete an account: completed ones as a bare record (no personal data), refused ones with the address, for review.';

-- ---------------------------------------------------------------------------
-- The owner-keeping trigger learns one exception: a clinic being closed by
-- its only owner, from inside request_account_deletion, which sets the
-- flag for its own transaction and nothing else can.
-- ---------------------------------------------------------------------------
create or replace function public.memberships_keep_owner()
returns trigger
language plpgsql
as $$
begin
  if current_setting('herbalist.deleting_account', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if old.role = 'owner' and old.is_active
     and (tg_op = 'DELETE' or new.role <> 'owner' or not new.is_active) then
    if not exists (
      select 1 from public.memberships m
       where m.clinic_id = old.clinic_id and m.role = 'owner' and m.is_active and m.id <> old.id
    ) then
      raise exception 'last_owner' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- The request itself. Returns {"status": "deleted"} or
-- {"status": "needs_review", "blocker": "clinic_has_records" | "clinic_needs_owner"}.
-- ---------------------------------------------------------------------------
create or replace function public.request_account_deletion(p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_access record;
  v_clinic record;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select u.email into v_email from auth.users u where u.id = v_user;

  -- ---- A patient ---------------------------------------------------------
  select a.id, a.clinic_id into v_access
    from public.patient_portal_access a
   where a.user_id = v_user
   limit 1;
  if found then
    update public.patient_portal_access
       set user_id = null, is_active = false
     where id = v_access.id;
    insert into public.account_deletion_requests (user_id, kind, clinic_id, status, reason, resolved_at)
    values (v_user, 'patient', v_access.clinic_id, 'done', left(p_reason, 500), now());
    -- Everything the sign-in owned goes with it: identities, sessions,
    -- factors, the profile (all cascade). The patient's file stays.
    delete from auth.users where id = v_user;
    return jsonb_build_object('status', 'deleted');
  end if;

  -- ---- A member of staff --------------------------------------------------
  -- Every clinic this person owns alone is looked at before anything changes.
  for v_clinic in
    select m.clinic_id,
           (select count(*) from public.patients p where p.clinic_id = m.clinic_id) as patients,
           (select count(*) from public.memberships o
             where o.clinic_id = m.clinic_id and o.is_active and o.user_id <> v_user) as others
      from public.memberships m
     where m.user_id = v_user and m.role = 'owner' and m.is_active
       and not exists (
         select 1 from public.memberships o
          where o.clinic_id = m.clinic_id and o.role = 'owner' and o.is_active and o.user_id <> v_user)
  loop
    if v_clinic.patients > 0 then
      insert into public.account_deletion_requests (user_id, kind, clinic_id, status, blocker, email, reason)
      values (v_user, 'staff', v_clinic.clinic_id, 'needs_review', 'clinic_has_records', v_email, left(p_reason, 500));
      return jsonb_build_object('status', 'needs_review', 'blocker', 'clinic_has_records');
    end if;
    if v_clinic.others > 0 then
      insert into public.account_deletion_requests (user_id, kind, clinic_id, status, blocker, email, reason)
      values (v_user, 'staff', v_clinic.clinic_id, 'needs_review', 'clinic_needs_owner', v_email, left(p_reason, 500));
      return jsonb_build_object('status', 'needs_review', 'blocker', 'clinic_needs_owner');
    end if;
  end loop;

  -- The flag the owner-keeping trigger honours, for this transaction only.
  perform set_config('herbalist.deleting_account', 'on', true);

  -- A clinic owned alone, with nobody in it and nothing in it, closes.
  delete from public.clinics c
   where c.id in (
     select m.clinic_id from public.memberships m
      where m.user_id = v_user and m.role = 'owner' and m.is_active
        and not exists (select 1 from public.memberships o
                         where o.clinic_id = m.clinic_id and o.is_active and o.user_id <> v_user)
        and not exists (select 1 from public.patients p where p.clinic_id = m.clinic_id));

  delete from public.memberships where user_id = v_user;
  delete from public.platform_admins where user_id = v_user;

  -- The tombstone: the professional name stays on the records it signed;
  -- everything that reaches the person does not.
  update public.profiles
     set phone = null,
         avatar_url = null
   where id = v_user;

  -- The sign-in. Sessions and tokens end now; identities and factors go;
  -- the row stays (the profile hangs off it) but can never sign in again.
  delete from auth.sessions where user_id = v_user;
  delete from auth.refresh_tokens where user_id = v_user::text;
  delete from auth.mfa_factors where user_id = v_user;
  delete from auth.identities where user_id = v_user;
  update auth.users
     set email = 'deleted+' || v_user::text || '@deleted.invalid',
         encrypted_password = null,
         phone = null,
         raw_user_meta_data = '{}'::jsonb,
         banned_until = 'infinity'::timestamptz
   where id = v_user;

  insert into public.account_deletion_requests (user_id, kind, status, reason, resolved_at)
  values (v_user, 'staff', 'done', left(p_reason, 500), now());
  return jsonb_build_object('status', 'deleted');
end;
$$;

revoke all on function public.request_account_deletion(text) from public;
grant execute on function public.request_account_deletion(text) to authenticated;

comment on function public.request_account_deletion(text) is
  'Deletes the calling account: a patient outright, a member of staff down to a tombstone the records point at. A clinic''s only owner is refused with a blocker and the request is kept for review.';

-- ---------------------------------------------------------------------------
-- The open requests, for whoever runs the service (the platform page).
-- ---------------------------------------------------------------------------
create or replace function public.platform_deletion_requests()
returns table (
  id uuid,
  requested_at timestamptz,
  kind text,
  blocker text,
  email text,
  clinic_name text,
  reason text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.requested_at, r.kind, r.blocker, r.email, c.name, r.reason
    from public.account_deletion_requests r
    left join public.clinics c on c.id = r.clinic_id
   where r.status = 'needs_review'
     and public.is_platform_admin()
   order by r.requested_at desc;
$$;

revoke all on function public.platform_deletion_requests() from public;
grant execute on function public.platform_deletion_requests() to authenticated;

-- ---------------------------------------------------------------------------
-- The reviewers' door to the portal: a password sign-in is honoured only
-- for a portal user of a synthetic clinic. Checked after the password, by
-- the database — the form cannot widen it.
-- ---------------------------------------------------------------------------
create or replace function public.portal_password_login_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.patient_portal_access a
      join public.clinics c on c.id = a.clinic_id
     where a.user_id = auth.uid()
       and a.is_active
       and c.is_synthetic
  );
$$;

revoke all on function public.portal_password_login_allowed() from public;
grant execute on function public.portal_password_login_allowed() to authenticated;

comment on function public.portal_password_login_allowed() is
  'True only when the signed-in portal user belongs to a synthetic (sandbox) clinic: the stores'' reviewers sign in with a password there; a real patient never does.';

-- ---------------------------------------------------------------------------
-- Closing a request after it was handled by hand: the clinic handed over or
-- closed. The address goes with it — nothing personal outlives the need.
-- ---------------------------------------------------------------------------
create or replace function public.platform_resolve_deletion_request(p_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.account_deletion_requests
     set status = 'done',
         resolved_at = now(),
         note = left(p_note, 500),
         email = null
   where id = p_id
     and status = 'needs_review';
end;
$$;

revoke all on function public.platform_resolve_deletion_request(uuid, text) from public;
grant execute on function public.platform_resolve_deletion_request(uuid, text) to authenticated;
