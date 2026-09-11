-- ============================================================================
-- 39 · A second factor for the staff sign-in, enforced where the data is
-- ============================================================================
-- A practitioner may add a second factor to their account: a code from an
-- authenticator app, asked for after the password. Supabase Auth keeps the
-- factor (auth.mfa_factors) and marks a session that has given the code
-- with the claim aal = 'aal2'.
--
-- The application asks for the code on its own screen — but a screen is not
-- a lock. This migration puts the lock in the database: for an account that
-- has a verified factor, a session that has not yet given the code has no
-- clinic. Every policy reaches the clinic through the three helpers below,
-- so with the guard inside them the whole clinic — patients, notes, diary,
-- money — is out of reach until the code is entered, whatever the client.
--
-- Accounts without a factor are untouched: the guard is false for them.
-- ============================================================================

create or replace function public.session_needs_second_factor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
     and exists (
       select 1
       from auth.mfa_factors f
       where f.user_id = auth.uid()
         and f.status = 'verified'
     );
$$;

revoke all on function public.session_needs_second_factor() from public;
grant execute on function public.session_needs_second_factor() to authenticated;

comment on function public.session_needs_second_factor() is
  'True when the signed-in account has a verified second factor and this session has not given it yet (aal1). Such a session belongs to no clinic until it does.';

-- The three helpers every policy reaches the clinic through, each with the
-- guard in front. Same bodies as migration 1 otherwise.

create or replace function public.current_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.clinic_id
  from public.memberships m
  where m.user_id = auth.uid()
    and m.is_active
    and not public.session_needs_second_factor()
  order by m.created_at
  limit 1;
$$;

create or replace function public.is_clinic_member(target_clinic uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.clinic_id = target_clinic
      and m.is_active
  ) and not public.session_needs_second_factor();
$$;

create or replace function public.has_clinic_role(target_clinic uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.clinic_id = target_clinic
      and m.is_active
      and m.role = any(allowed_roles)
  ) and not public.session_needs_second_factor();
$$;

-- The context the shell reads on every page: no clinic until the code is given.
create or replace function public.current_membership_context()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when m.id is null then null
    else jsonb_build_object(
      'membership', to_jsonb(m),
      'clinic', to_jsonb(c),
      'profile', to_jsonb(p),
      'is_platform_admin', public.is_platform_admin()
    )
  end
  from (
    select *
    from public.memberships
    where user_id = auth.uid()
      and is_active
      and not public.session_needs_second_factor()
    order by created_at
    limit 1
  ) m
  left join public.clinics c on c.id = m.clinic_id
  left join public.profiles p on p.id = auth.uid();
$$;
