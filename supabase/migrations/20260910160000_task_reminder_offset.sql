-- "When should it remind me?" — a task's alert can fire before its time.
--
-- `due_at` stays the task's own moment: what the list shows and sorts by.
-- `remind_offset_minutes` is how long before that moment the alert goes off:
-- 0 is "at the time", 60 an hour before, 1440 a day before. Both the in-app
-- bell and the queued reminders subtract it.

alter table public.clinic_tasks
  add column if not exists remind_offset_minutes integer not null default 0
    check (remind_offset_minutes >= 0 and remind_offset_minutes <= 20160);

comment on column public.clinic_tasks.remind_offset_minutes is
  'Minutes before due_at at which the alert fires. 0 = at the time itself.';

-- The queue looks at the alert moment, not the task moment.
create or replace function public.enqueue_due_task_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select t.id, t.clinic_id, t.title, t.due_at, t.remind_via, t.created_by,
           pr.phone, u.email
      from public.clinic_tasks t
      left join public.profiles pr on pr.id = t.created_by
      left join auth.users u on u.id = t.created_by
     where t.done_at is null
       and t.reminded_at is null
       and t.due_at is not null
       and t.due_at - make_interval(mins => t.remind_offset_minutes) <= now() + interval '5 minutes'
       and t.remind_via in ('email', 'sms')
  loop
    insert into public.message_log
      (clinic_id, channel, template_key, recipient, body, subject, task_id, status, error_code)
    values
      (r.clinic_id, r.remind_via, 'task_alert',
       case when r.remind_via = 'email' then r.email else r.phone end,
       r.title,
       case when r.remind_via = 'email' then r.title else null end,
       r.id,
       case when (case when r.remind_via = 'email' then r.email else r.phone end) is null then 'skipped' else 'queued' end,
       case when (case when r.remind_via = 'email' then r.email else r.phone end) is null then 'no_recipient' else null end);
    update public.clinic_tasks set reminded_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
