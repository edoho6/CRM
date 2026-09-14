-- Migration 55 — a reply from the model's own knowledge, when the library holds nothing.
--
-- The practitioner asked that a question the library cannot answer still
-- get an answer — from the model's general knowledge, shown under a label
-- that says so and never checked against a source. That is a new outcome
-- for the log and a new status for a saved message; and a library answer
-- can now carry a general part beside it, which the saved message keeps
-- in a column of its own so the label survives a reload.
alter table public.library_queries drop constraint if exists library_queries_status_check;
alter table public.library_queries
  add constraint library_queries_status_check
  check (status in ('answered', 'general', 'no_sources', 'refused_pii', 'refused_quota', 'error'));

alter table public.library_messages drop constraint if exists library_messages_status_check;
alter table public.library_messages
  add constraint library_messages_status_check
  check (status is null or status in ('answered', 'general', 'no_sources', 'refused_quota', 'error'));

alter table public.library_messages add column if not exists general text;

create or replace function public.library_log_query(
  p_status text,
  p_sources jsonb default '[]'::jsonb,
  p_model text default null,
  p_input_tokens integer default null,
  p_output_tokens integer default null,
  p_latency_ms integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic uuid;
  v_id uuid;
begin
  v_clinic := public.current_clinic_id();
  if auth.uid() is null or v_clinic is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status not in ('answered', 'general', 'no_sources', 'refused_pii', 'refused_quota', 'error') then
    raise exception 'bad_status' using errcode = '22023';
  end if;
  insert into public.library_queries (user_id, clinic_id, status, sources, model, input_tokens, output_tokens, latency_ms)
  values (auth.uid(), v_clinic, p_status, coalesce(p_sources, '[]'::jsonb), p_model, p_input_tokens, p_output_tokens, p_latency_ms)
  returning id into v_id;
  return v_id;
end;
$$;
