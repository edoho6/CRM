-- ============================================================================
-- The `assistant` membership role is removed (decision of 18.9)
-- ============================================================================
-- Four roles existed; `assistant` was defined, reached nothing, and was never
-- going to be used. A role nobody uses is a role someone can still be given by
-- mistake, and every rule has to remember to exclude it. It goes.
--
-- Not to be confused with the assistant *feature* (the questions about the
-- clinic's own data): that stays, and nothing here touches it.
--
-- This file refuses to run while anyone holds the role — as a member or in an
-- invitation not yet accepted. It does not convert them: which role such a
-- person should have is a decision for the clinic's owner, not for a script.
-- To see who they are:
--
--   select m.clinic_id, m.user_id, m.is_active from public.memberships m where m.role = 'assistant';
--   select i.clinic_id, i.invitee_name, i.created_at from public.clinic_invitations i
--    where i.role = 'assistant' and i.accepted_at is null and i.revoked_at is null;
--
-- An invitation that was accepted or revoked is history, not access, and is
-- left as it was: the rule below allows the old role only on such a row, which
-- `accept_invitation` refuses to spend. An open invitation — expired or not —
-- stops this file like a member does; revoking it is one click in the team
-- screen.
-- ============================================================================

do $$
declare
  v_members text;
  v_invites text;
begin
  select string_agg(pg_catalog.format('clinic %s user %s', m.clinic_id, m.user_id), '; ')
    into v_members
    from public.memberships m
   where m.role = 'assistant';

  select string_agg(pg_catalog.format('clinic %s invitation %s', i.clinic_id, i.id), '; ')
    into v_invites
    from public.clinic_invitations i
   where i.role = 'assistant'
     and i.accepted_at is null
     and i.revoked_at is null;

  if v_members is not null or v_invites is not null then
    raise exception 'assistant_role_still_held: % %', coalesce(v_members, ''), coalesce(v_invites, '')
      using hint = 'Give each listed person another role in Settings → Team (or revoke the invitation), then run this file again. Nothing was changed.';
  end if;
end;
$$;

-- The constraints were created inline, so their names are Postgres's; found by
-- what they check rather than guessed.
do $$
declare
  r record;
begin
  for r in
    select c.conname, c.conrelid::regclass as tbl
      from pg_catalog.pg_constraint c
     where c.contype = 'c'
       and c.conrelid in ('public.memberships'::regclass, 'public.clinic_invitations'::regclass)
       and pg_catalog.pg_get_constraintdef(c.oid) like '%assistant%'
  loop
    execute pg_catalog.format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end;
$$;

alter table public.memberships drop constraint if exists memberships_role_check;
alter table public.memberships
  add constraint memberships_role_check
  check (role in ('owner', 'practitioner', 'staff'));

alter table public.clinic_invitations drop constraint if exists clinic_invitations_role_check;
alter table public.clinic_invitations
  add constraint clinic_invitations_role_check
  check (role in ('practitioner', 'staff') or accepted_at is not null or revoked_at is not null);

-- The owner's role switch names the three roles that remain.
create or replace function public.set_membership_role(p_membership uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.memberships%rowtype;
begin
  select * into v_row from public.memberships where id = p_membership;
  if v_row.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.has_clinic_role(v_row.clinic_id, array['owner']) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_row.user_id = auth.uid() then raise exception 'not_yourself' using errcode = '22023'; end if;
  if p_role is null or p_role not in ('owner', 'practitioner', 'staff') then
    raise exception 'bad_role' using errcode = '22023';
  end if;
  update public.memberships set role = p_role where id = p_membership;
end;
$$;

revoke all on function public.set_membership_role(uuid, text) from public, anon, authenticated;
grant execute on function public.set_membership_role(uuid, text) to authenticated;

comment on column public.memberships.role is
  'owner, practitioner or staff (the secretary). What each may reach is in migration 78 and packages/domain/src/permissions.ts.';
