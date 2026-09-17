-- ============================================================================
-- 76 · A practitioner who works in more than one clinic
-- ============================================================================
-- `current_clinic_id()` took the oldest membership, so someone on the books of
-- two clinics only ever saw the first one they joined, with no way to the other.
-- The clinic they are working in now is remembered per person, in a table of one
-- row, and every policy reads it through the same helper as before.
--
--   · The switch is `set_active_clinic(id)`, which refuses a clinic the caller is
--     not an active member of — the table itself is not writable by anyone, so
--     the membership check cannot be walked around.
--   · Nothing changes for the great majority: one membership, no row, and the
--     helper falls back to that membership exactly as it did.
--   · The chosen clinic follows the person rather than the browser. Switching on
--     a phone switches the desktop too — the same file open twice showing two
--     clinics is the worse surprise, since every screen would then disagree.
--   · The second-factor guard stays in front of all of it: no clinic until the
--     code is given (migration 39).
-- ============================================================================

create table if not exists public.active_clinic (
  user_id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  chosen_at timestamptz not null default now()
);

alter table public.active_clinic enable row level security;

-- Readable by its owner (the helper below is security definer and does not need
-- it, but the person may see their own row); never writable from the outside.
drop policy if exists active_clinic_self_read on public.active_clinic;
create policy active_clinic_self_read on public.active_clinic
  for select to authenticated using (user_id = auth.uid());

create or replace function public.current_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select a.clinic_id
        from public.active_clinic a
        join public.memberships m
          on m.user_id = a.user_id and m.clinic_id = a.clinic_id and m.is_active
       where a.user_id = auth.uid()
    ),
    (
      select m.clinic_id
        from public.memberships m
       where m.user_id = auth.uid() and m.is_active
       order by m.created_at
       limit 1
    )
  )
  where not public.session_needs_second_factor();
$$;

comment on function public.current_clinic_id() is
  'The clinic the signed-in staff user is working in: the one they last chose (active_clinic), or their oldest membership. Used as a column default and inside every RLS policy.';

-- The switch. Returns false for a clinic this person is not an active member of.
create or replace function public.set_active_clinic(p_clinic_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_clinic_member(p_clinic_id) then
    return false;
  end if;
  insert into public.active_clinic (user_id, clinic_id)
  values (auth.uid(), p_clinic_id)
  on conflict (user_id) do update set clinic_id = excluded.clinic_id, chosen_at = now();
  return true;
end;
$$;

-- The shell's one call now also carries every clinic this person may work in,
-- so a switcher costs no extra round trip — and an empty list for almost everyone.
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
      'is_platform_admin', public.is_platform_admin(),
      'clinics', coalesce((
        select jsonb_agg(jsonb_build_object('id', c2.id, 'name', c2.name) order by c2.name)
          from public.memberships m2
          join public.clinics c2 on c2.id = m2.clinic_id
         where m2.user_id = auth.uid() and m2.is_active
      ), '[]'::jsonb)
    )
  end
  from (
    select *
    from public.memberships
    where user_id = auth.uid()
      and is_active
      and clinic_id = public.current_clinic_id()
    limit 1
  ) m
  left join public.clinics c on c.id = m.clinic_id
  left join public.profiles p on p.id = auth.uid();
$$;

revoke all on function public.set_active_clinic(uuid) from public;
revoke execute on function public.set_active_clinic(uuid) from anon;
grant execute on function public.set_active_clinic(uuid) to authenticated;
