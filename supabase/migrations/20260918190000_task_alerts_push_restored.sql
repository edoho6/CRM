-- ---------------------------------------------------------------------------
-- Task alerts: the phone and the "remind me before" come back
-- ---------------------------------------------------------------------------
-- Migration 20260917090000 (payments and queues locked down) rewrote
-- enqueue_due_task_alerts to take a clinic, and wrote the body from an older
-- copy than the one in force. Two things fell out without anyone deciding so:
--
--   * the push channel (migration 20260912120000): a task set to "phone
--     notification" was never queued again, and its alert simply did not come;
--   * the offset (migration 20260910160000): "remind me an hour before" fired
--     at the due time, or — for email and SMS — five minutes before it.
--
-- This is the 17.9 signature (p_clinic, owner-only) with the 12.9 body. The
-- in-app alert is not here and never was: the bell in the browser rings that
-- one, and marks it itself.

create or replace function public.enqueue_due_task_alerts(p_clinic uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
  v_recipient text;
  v_has_device boolean;
begin
  for r in
    select t.id, t.clinic_id, t.title, t.due_at, t.remind_via, t.created_by,
           pr.phone, pr.preferred_locale, u.email
      from public.clinic_tasks t
      left join public.profiles pr on pr.id = t.created_by
      left join auth.users u on u.id = t.created_by
     where t.done_at is null
       and (p_clinic is null or t.clinic_id = p_clinic)
       and t.reminded_at is null
       and t.due_at is not null
       and t.due_at - make_interval(mins => t.remind_offset_minutes) <= now() + interval '5 minutes'
       and t.remind_via in ('email', 'sms', 'push')
  loop
    if r.remind_via = 'push' then
      v_has_device := r.created_by is not null and exists (
        select 1 from public.device_push_tokens d where d.user_id = r.created_by and d.app = 'clinic');
      insert into public.message_log
        (clinic_id, channel, template_key, recipient, body, subject, link_url, task_id, status, error_code)
      values
        (r.clinic_id, 'push', 'task_alert', r.created_by::text, r.title,
         case when coalesce(r.preferred_locale, 'he') = 'en' then 'Task reminder' else 'תזכורת למשימה' end,
         '/' || coalesce(r.preferred_locale, 'he') || '/tasks',
         r.id,
         case when v_has_device then 'queued' else 'skipped' end,
         case when v_has_device then null else 'no_device' end);
    else
      v_recipient := case when r.remind_via = 'email' then r.email else r.phone end;
      insert into public.message_log
        (clinic_id, channel, template_key, recipient, body, subject, task_id, status, error_code)
      values
        (r.clinic_id, r.remind_via, 'task_alert', v_recipient, r.title,
         case when r.remind_via = 'email' then r.title else null end,
         r.id,
         case when v_recipient is null then 'skipped' else 'queued' end,
         case when v_recipient is null then 'no_recipient' else null end);
    end if;
    update public.clinic_tasks set reminded_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Stated again rather than trusted to survive the replace: this function runs
-- over every clinic and belongs to the scheduler alone.
revoke all on function public.enqueue_due_task_alerts(uuid) from public;
revoke execute on function public.enqueue_due_task_alerts(uuid) from anon, authenticated;
