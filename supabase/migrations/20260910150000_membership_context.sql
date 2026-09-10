-- Who is signed in and which clinic they work for, in one round trip.
--
-- Every staff page starts by answering that question. Until now it took
-- three trips to the database in a row — the user, then the membership, then
-- the clinic, profile and admin flag — and at 110–160 ms a trip from Israel,
-- that was close to half a second before a page could even ask for its own
-- data. This function answers all of it at once, for the caller, from the
-- token PostgREST already verified.
--
-- Security invoker: it reads through the same row-level policies the app
-- reads through, so it can only ever describe the caller's own membership.
-- `is_platform_admin()` is the one definer call, as everywhere else.

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
    where user_id = auth.uid() and is_active
    order by created_at
    limit 1
  ) m
  left join public.clinics c on c.id = m.clinic_id
  left join public.profiles p on p.id = auth.uid();
$$;

revoke all on function public.current_membership_context() from public;
grant execute on function public.current_membership_context() to authenticated;

comment on function public.current_membership_context() is
  'The signed-in user''s active membership with its clinic, profile and platform-admin flag, as one JSON document. Null when there is no membership.';
