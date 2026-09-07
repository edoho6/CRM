-- ============================================================================
-- 16 · Recording who looked
-- ============================================================================
-- The audit trail records every change to a patient record and has since the
-- first milestone. It records nothing about reading one — and reading is the
-- act that matters most here. Someone who opens two hundred files and changes
-- none of them currently leaves no trace at all.
--
-- Reads have no trigger to hang off: nothing in Postgres fires on SELECT. So
-- the application calls `log_record_access` explicitly, and the function is
-- SECURITY DEFINER for the same reason the write trigger is — nobody holds
-- INSERT on audit_log, so a client cannot forge or suppress an entry.
--
-- Views land in the same table as writes rather than a table of their own. The
-- question a practitioner or a regulator asks is "who touched this record",
-- and that question should have one place to look, not two. Volume is not a
-- concern at clinic scale: a busy practitioner generates a few tens of rows a
-- day.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Two more actions
-- ---------------------------------------------------------------------------

alter table public.audit_log drop constraint if exists audit_log_action_check;

alter table public.audit_log
  add constraint audit_log_action_check check (
    action in ('insert', 'update', 'delete', 'sign', 'view', 'export')
  );

comment on column public.audit_log.action is
  'insert / update / delete / sign are written by the audit trigger. view and export are written by log_record_access, called from the application, because nothing in Postgres fires on a read.';

-- Reading back "everything this user did today" is now a common query, and so
-- is "everyone who opened this record".
create index if not exists audit_log_views_idx
  on public.audit_log (clinic_id, action, changed_at desc)
  where action in ('view', 'export');

-- ---------------------------------------------------------------------------
-- log_record_access
-- ---------------------------------------------------------------------------
-- Deduplicated on a short window. Opening a patient, following a link to their
-- encounter and pressing back is one act of looking, not three, and a log that
-- records it three times is harder to read without being any more truthful.

create or replace function public.log_record_access(
  p_table text,
  p_record uuid,
  p_action text default 'view'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null or p_record is null then
    return;
  end if;

  if p_action not in ('view', 'export') then
    raise exception 'log_record_access only records view or export';
  end if;

  -- The clinic is taken from the caller's membership, not from an argument:
  -- an argument could be pointed at someone else's clinic.
  select m.clinic_id into v_clinic
  from public.memberships m
  where m.user_id = v_user and m.is_active
  order by m.created_at
  limit 1;

  if v_clinic is null then
    return;
  end if;

  -- An export is always recorded; a repeat view within the window is not.
  if p_action = 'view' and exists (
    select 1 from public.audit_log
    where clinic_id = v_clinic
      and table_name = p_table
      and record_id = p_record
      and changed_by = v_user
      and action = 'view'
      and changed_at > now() - interval '15 minutes'
  ) then
    return;
  end if;

  insert into public.audit_log (clinic_id, table_name, record_id, action, changed_by, diff)
  values (v_clinic, p_table, p_record, p_action, v_user, null);
end;
$$;

revoke all on function public.log_record_access(text, uuid, text) from public;
grant execute on function public.log_record_access(text, uuid, text) to authenticated;

comment on function public.log_record_access is
  'Records that a user read or exported a record. Definer rights so the entry cannot be forged or skipped by a client; deduplicated over 15 minutes so one act of looking is one row.';

-- ---------------------------------------------------------------------------
-- access_activity — the log, with the names filled in
-- ---------------------------------------------------------------------------
-- A log of UUIDs answers nothing. This joins the actor and, for patient
-- records, the patient, so the screen can be read rather than decoded.

create or replace view public.access_activity
with (security_invoker = on)
as
select
  a.id,
  a.clinic_id,
  a.table_name,
  a.record_id,
  a.action,
  a.changed_at,
  a.changed_by,
  coalesce(p.full_name, '') as actor_name,
  pat.full_name as patient_name
from public.audit_log a
left join public.profiles p on p.id = a.changed_by
left join public.patients pat
  on pat.id = a.record_id and a.table_name = 'patients';

comment on view public.access_activity is
  'The audit trail with actor and patient names resolved, for the access review screen.';

-- ---------------------------------------------------------------------------
-- access_anomalies — the patterns worth being told about
-- ---------------------------------------------------------------------------
-- Deliberately few rules, and each one states a threshold that a practitioner
-- can argue with. A screen full of alerts nobody reads is worse than no screen.
--
-- Not covered here, and worth saying plainly: failed logins and login location
-- live in Supabase's auth schema, which this database cannot query. Alerting on
-- those needs the auth webhook or the admin API, and is not built yet.

create or replace view public.access_anomalies
with (security_invoker = on)
as
with hourly as (
  select
    clinic_id,
    changed_by,
    date_trunc('hour', changed_at) as window_start,
    count(distinct record_id) as records_touched
  from public.audit_log
  where action in ('view', 'export')
    and changed_at > now() - interval '30 days'
  group by 1, 2, 3
),
after_hours as (
  select
    clinic_id,
    changed_by,
    date_trunc('hour', changed_at) as window_start,
    count(*) as records_touched
  from public.audit_log
  where action in ('view', 'export')
    and changed_at > now() - interval '30 days'
    -- Local clinic hours. A single overnight lookup is normal; a run of them
    -- is the thing worth surfacing.
    and (extract(hour from changed_at at time zone 'Asia/Jerusalem') < 6
         or extract(hour from changed_at at time zone 'Asia/Jerusalem') >= 23)
  group by 1, 2, 3
  having count(*) >= 5
)
select
  h.clinic_id,
  h.changed_by,
  h.window_start,
  h.records_touched,
  'bulk_access'::text as kind
from hourly h
where h.records_touched >= 30
union all
select
  a.clinic_id,
  a.changed_by,
  a.window_start,
  a.records_touched,
  'after_hours'::text as kind
from after_hours a;

comment on view public.access_anomalies is
  'Access patterns worth a look: thirty or more distinct records in an hour, or five or more reads between 23:00 and 06:00 local time. Thresholds are deliberately blunt and stated on screen.';
