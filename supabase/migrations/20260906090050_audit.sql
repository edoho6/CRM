-- ============================================================================
-- 02 · Audit trail
-- ============================================================================
-- Medical records need a defensible history of who changed what and when. This is
-- deliberately built in Milestone 1 rather than retrofitted, because an audit log
-- that starts late cannot answer questions about the period before it existed.
-- ============================================================================

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete', 'sign')),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  diff jsonb
);

create index if not exists audit_log_record_idx
  on public.audit_log (clinic_id, table_name, record_id, changed_at desc);

create index if not exists audit_log_actor_idx
  on public.audit_log (clinic_id, changed_by, changed_at desc);

-- ---------------------------------------------------------------------------
-- Generic audit trigger
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so the log is written even though no user has INSERT rights on
-- audit_log — the trail must not be forgeable from application code.

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic uuid;
  v_record uuid;
  v_action text;
  v_diff jsonb;
begin
  if tg_op = 'DELETE' then
    v_clinic := old.clinic_id;
    v_record := old.id;
    v_action := 'delete';
    v_diff := to_jsonb(old);
  elsif tg_op = 'INSERT' then
    v_clinic := new.clinic_id;
    v_record := new.id;
    v_action := 'insert';
    v_diff := to_jsonb(new);
  else
    v_clinic := new.clinic_id;
    v_record := new.id;

    -- Signing a clinical record is its own action, not a generic update.
    if tg_table_name = 'encounters'
       and (to_jsonb(old) ->> 'status') = 'draft'
       and (to_jsonb(new) ->> 'status') = 'signed' then
      v_action := 'sign';
    else
      v_action := 'update';
    end if;

    -- Store only the fields that actually changed, so the log stays readable.
    select jsonb_object_agg(o.key, jsonb_build_object('from', o.value, 'to', n.value))
      into v_diff
      from jsonb_each(to_jsonb(old)) o
      join jsonb_each(to_jsonb(new)) n on n.key = o.key
     where o.value is distinct from n.value
       and o.key not in ('updated_at');

    -- Nothing meaningful changed (e.g. a touch of updated_at only) — skip the entry.
    if v_diff is null then
      return new;
    end if;
  end if;

  insert into public.audit_log (clinic_id, table_name, record_id, action, changed_by, diff)
  values (v_clinic, tg_table_name, v_record, v_action, auth.uid(), v_diff);

  return coalesce(new, old);
end;
$$;

alter table public.audit_log enable row level security;

-- Read-only for clinic staff. Nobody gets INSERT/UPDATE/DELETE: only the definer
-- trigger above writes here, which is what makes the trail trustworthy.
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log
  for select using (public.is_clinic_member(clinic_id));
