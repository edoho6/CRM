-- ============================================================================
-- Server fixes (18.9 audit, wave 2): the assistant ceiling, and payment links
-- ============================================================================
-- `assistant_questions_today` counted only answered questions. A question that
-- ran two paid calls and then failed, or gave up after three, was never
-- counted — so a loop that kept failing had no ceiling at all. Everything but a
-- refusal (which spent nothing) counts now. The app logs every question that
-- reached the model, whatever way it ended (features/assistant/actions.ts).
-- ============================================================================

create or replace function public.assistant_questions_today()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
    from public.assistant_queries q
    join public.clinics c on c.id = q.clinic_id
   where q.user_id = auth.uid()
     and q.clinic_id = public.current_clinic_id()
     and q.status <> 'refused_quota'
     and q.asked_at >= (pg_catalog.date_trunc('day', pg_catalog.now() at time zone coalesce(c.timezone, 'Asia/Jerusalem'))
                        at time zone coalesce(c.timezone, 'Asia/Jerusalem'));
$$;

revoke all on function public.assistant_questions_today() from public, anon, authenticated;
grant execute on function public.assistant_questions_today() to authenticated;

-- ============================================================================
-- A payment link, from whoever handles the money
-- ============================================================================
-- The clinic's Grow identifiers live in `clinic_payment_settings`, readable by
-- the owner only (it holds an API key column too). Creating a payment link
-- read that table directly, so a secretary — who handles the money (18.9) —
-- could never send one, and the billing screens hid the button from her.
--
-- This hands the two identifiers a payment page needs, and nothing else, to a
-- money role of the clinic in force. The API key never leaves the table.

create or replace function public.grow_payment_config()
returns table (environment text, grow_user_id text, grow_page_code text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.environment, s.grow_user_id, s.grow_page_code
    from public.clinic_payment_settings s
   where s.clinic_id = public.current_clinic_id()
     and s.is_active
     and public.has_clinic_role(s.clinic_id, array['owner', 'practitioner', 'staff']);
$$;

revoke all on function public.grow_payment_config() from public, anon, authenticated;
grant execute on function public.grow_payment_config() to authenticated;
