-- ============================================================================
-- 37 · Team — invitations, and the rules that keep a clinic with an owner
-- ============================================================================
-- Until now a clinic was one account: the person who signed up. This is the
-- way a second person joins. The owner makes an invitation and sends its
-- link however they like — WhatsApp, in person — and whoever opens it signs
-- in or signs up and becomes a member with the role the owner chose. The app
-- sends no email; the link is the whole secret: a random uuid that opens one
-- clinic, once, for seven days.
--
--   clinic_invitations      — owner-only rows. The invitee reads one through
--                             invitation_by_token (anon + authenticated) and
--                             spends it through accept_invitation
--                             (authenticated, no clinic yet).
--   memberships_keep_owner  — a clinic never loses its last active owner,
--                             whatever screen or query asked.
--   set_membership_role / set_membership_active — the owner's two switches,
--                             as functions so "not yourself" is one rule in
--                             one place.
--
-- Roles: an invitation never carries 'owner'. Ownership is handed over by
-- an owner promoting a member, and the trigger keeps at least one.
-- ============================================================================

create table if not exists public.clinic_invitations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  role text not null check (role in ('practitioner', 'staff', 'assistant')),
  -- Who the owner meant it for: a label for the list, nothing the link checks.
  invitee_name text,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz
);

create index if not exists clinic_invitations_clinic_idx
  on public.clinic_invitations (clinic_id, created_at desc);

alter table public.clinic_invitations enable row level security;

-- Owners see and manage their clinic's invitations; nobody else touches the
-- table directly. The invitee never reads a row — only the function below.
drop policy if exists clinic_invitations_owner on public.clinic_invitations;
create policy clinic_invitations_owner on public.clinic_invitations
  for all
  using (public.has_clinic_role(clinic_id, array['owner']))
  with check (public.has_clinic_role(clinic_id, array['owner']));

comment on table public.clinic_invitations is
  'A link that lets one person join one clinic once, for seven days. Made by an owner; read by the invitee through invitation_by_token; spent by accept_invitation.';

-- ---------------------------------------------------------------------------
-- What the invitee sees before deciding: the clinic's name, the role, and
-- whether the link still opens. Nothing else — not who made it, not when.
-- ---------------------------------------------------------------------------

create or replace function public.invitation_by_token(p_token uuid)
returns table (clinic_name text, role text, invitee_name text, status text)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.name,
    i.role,
    i.invitee_name,
    case
      when i.revoked_at is not null then 'revoked'
      when i.accepted_at is not null then 'accepted'
      when i.expires_at < now() then 'expired'
      else 'open'
    end
  from public.clinic_invitations i
  join public.clinics c on c.id = i.clinic_id
  where i.token = p_token;
$$;

revoke all on function public.invitation_by_token(uuid) from public;
grant execute on function public.invitation_by_token(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Accepting: the signed-in account becomes a member. Refused for a portal
-- account, for an account that already belongs to a clinic (one clinic per
-- account, the same rule as sign-up), and for a link that is closed.
-- ---------------------------------------------------------------------------

create or replace function public.accept_invitation(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_invitation public.clinic_invitations;
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if public.current_patient_id() is not null then
    raise exception 'portal_account' using errcode = '42501';
  end if;
  if exists (select 1 from public.memberships where user_id = v_user and is_active) then
    raise exception 'already_member' using errcode = '23505';
  end if;

  select * into v_invitation from public.clinic_invitations where token = p_token for update;
  if v_invitation.id is null then
    raise exception 'invitation_not_found' using errcode = 'P0002';
  end if;
  if v_invitation.revoked_at is not null
     or v_invitation.accepted_at is not null
     or v_invitation.expires_at < now() then
    raise exception 'invitation_closed' using errcode = '22023';
  end if;

  -- A member who was deactivated and invited again comes back under the
  -- new role rather than colliding with the old row.
  insert into public.memberships (clinic_id, user_id, role, is_active)
  values (v_invitation.clinic_id, v_user, v_invitation.role, true)
  on conflict (clinic_id, user_id) do update
    set is_active = true, role = excluded.role;

  update public.clinic_invitations
     set accepted_at = now(), accepted_by = v_user
   where id = v_invitation.id;

  return v_invitation.clinic_id;
end;
$$;

revoke all on function public.accept_invitation(uuid) from public;
revoke execute on function public.accept_invitation(uuid) from anon;
grant execute on function public.accept_invitation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The last owner stays. Fires on the table, so it holds for the functions
-- below, for the owner policy, and for anything written later.
-- ---------------------------------------------------------------------------

create or replace function public.memberships_keep_owner()
returns trigger
language plpgsql
as $$
begin
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

drop trigger if exists memberships_keep_owner on public.memberships;
create trigger memberships_keep_owner
  before update or delete on public.memberships
  for each row execute function public.memberships_keep_owner();

-- ---------------------------------------------------------------------------
-- The owner's two switches: a member's role, and whether they are active.
-- Never on the owner's own row — another owner does that — so an owner
-- cannot lock themselves out by a slip.
-- ---------------------------------------------------------------------------

create or replace function public.set_membership_role(p_membership uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.memberships;
begin
  select * into v_row from public.memberships where id = p_membership;
  if v_row.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.has_clinic_role(v_row.clinic_id, array['owner']) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_row.user_id = auth.uid() then raise exception 'not_yourself' using errcode = '22023'; end if;
  if p_role not in ('owner', 'practitioner', 'staff', 'assistant') then
    raise exception 'bad_role' using errcode = '22023';
  end if;
  update public.memberships set role = p_role where id = p_membership;
end;
$$;

create or replace function public.set_membership_active(p_membership uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.memberships;
begin
  select * into v_row from public.memberships where id = p_membership;
  if v_row.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.has_clinic_role(v_row.clinic_id, array['owner']) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_row.user_id = auth.uid() then raise exception 'not_yourself' using errcode = '22023'; end if;
  update public.memberships set is_active = p_active where id = p_membership;
end;
$$;

revoke all on function public.set_membership_role(uuid, text) from public;
revoke execute on function public.set_membership_role(uuid, text) from anon;
grant execute on function public.set_membership_role(uuid, text) to authenticated;

revoke all on function public.set_membership_active(uuid, boolean) from public;
revoke execute on function public.set_membership_active(uuid, boolean) from anon;
grant execute on function public.set_membership_active(uuid, boolean) to authenticated;
