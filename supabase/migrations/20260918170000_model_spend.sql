-- ============================================================================
--  What the model costs, and a ceiling on it
-- ============================================================================
--  Two gaps found while profiling the spend:
--
--  1. The library logs its tokens as one number. Since caching arrived, most of
--     a question's input is cache writes (billed above the input rate) and cache
--     reads (billed at a tenth), and the three collapsed into one column cannot
--     be priced — a question that read everything from cache and one that wrote
--     it all look identical in the log. Three columns, so the bill is knowable.
--
--  2. "Questions about the data" has no ceiling at all. The library refuses past
--     sixty questions a day per person; the assistant would answer until the
--     card declined. It now keeps the same kind of log and answers to the same
--     kind of quota.
--
--  No question and no answer is written here, as in the library's own log — the
--  row says that someone asked and what it cost, never what was asked.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The library's log learns to tell cache writes from cache reads
-- ---------------------------------------------------------------------------
alter table public.library_queries
  add column if not exists cache_write_tokens integer,
  add column if not exists cache_read_tokens integer;

comment on column public.library_queries.input_tokens is
  'Input tokens billed at the plain rate. Cache writes and reads are counted separately, at their own rates.';

-- The old four-number function stays for anything still calling it; the new one
-- takes the split. Different arity, so neither shadows the other.
create or replace function public.library_log_query(
  p_status text,
  p_sources jsonb,
  p_model text default null,
  p_input_tokens integer default null,
  p_cache_write_tokens integer default null,
  p_cache_read_tokens integer default null,
  p_output_tokens integer default null,
  p_latency_ms integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic uuid := public.current_clinic_id();
begin
  if v_clinic is null then
    raise exception 'no clinic' using errcode = 'insufficient_privilege';
  end if;

  insert into public.library_queries (
    user_id, clinic_id, status, sources, model,
    input_tokens, cache_write_tokens, cache_read_tokens, output_tokens, latency_ms
  )
  values (
    auth.uid(), v_clinic, p_status, coalesce(p_sources, '[]'::jsonb), p_model,
    p_input_tokens, p_cache_write_tokens, p_cache_read_tokens, p_output_tokens, p_latency_ms
  );
end;
$$;

revoke all on function public.library_log_query(text, jsonb, text, integer, integer, integer, integer, integer) from public;
revoke execute on function public.library_log_query(text, jsonb, text, integer, integer, integer, integer, integer) from anon;
grant execute on function public.library_log_query(text, jsonb, text, integer, integer, integer, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The same log, and the same ceiling, for questions about the data
-- ---------------------------------------------------------------------------
create table if not exists public.assistant_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  asked_at timestamptz not null default now(),
  status text not null check (status in ('answered', 'refused_quota', 'error')),
  model text,
  input_tokens integer,
  cache_write_tokens integer,
  cache_read_tokens integer,
  output_tokens integer,
  latency_ms integer
);

comment on table public.assistant_queries is
  'One row per question about the clinic''s own data: who, when, and what it cost. Never the question itself.';

create index if not exists assistant_queries_clinic_idx on public.assistant_queries (clinic_id, asked_at desc);
create index if not exists assistant_queries_user_day_idx on public.assistant_queries (user_id, asked_at desc);

alter table public.assistant_queries enable row level security;

-- Readable by the clinic, writable by nobody: the row is written by the
-- function below, which runs as the owner.
drop policy if exists assistant_queries_members_read on public.assistant_queries;
create policy assistant_queries_members_read on public.assistant_queries
  for select using (public.is_clinic_member(clinic_id));

-- The day is the clinic's day, not UTC — a question at one in the morning
-- belongs to the night it was asked in, the same rule the rest of the system
-- counts by.
create or replace function public.assistant_questions_today()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.assistant_queries q
    join public.clinics c on c.id = q.clinic_id
   where q.user_id = auth.uid()
     and q.clinic_id = public.current_clinic_id()
     and q.status = 'answered'
     and q.asked_at >= (date_trunc('day', now() at time zone coalesce(c.timezone, 'Asia/Jerusalem'))
                        at time zone coalesce(c.timezone, 'Asia/Jerusalem'));
$$;

create or replace function public.assistant_log_query(
  p_status text,
  p_model text default null,
  p_input_tokens integer default null,
  p_cache_write_tokens integer default null,
  p_cache_read_tokens integer default null,
  p_output_tokens integer default null,
  p_latency_ms integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic uuid := public.current_clinic_id();
begin
  if v_clinic is null then
    raise exception 'no clinic' using errcode = 'insufficient_privilege';
  end if;

  insert into public.assistant_queries (
    user_id, clinic_id, status, model,
    input_tokens, cache_write_tokens, cache_read_tokens, output_tokens, latency_ms
  )
  values (
    auth.uid(), v_clinic, p_status, p_model,
    p_input_tokens, p_cache_write_tokens, p_cache_read_tokens, p_output_tokens, p_latency_ms
  );
end;
$$;

revoke all on function public.assistant_questions_today() from public;
revoke execute on function public.assistant_questions_today() from anon;
grant execute on function public.assistant_questions_today() to authenticated;

revoke all on function public.assistant_log_query(text, text, integer, integer, integer, integer, integer) from public;
revoke execute on function public.assistant_log_query(text, text, integer, integer, integer, integer, integer) from anon;
grant execute on function public.assistant_log_query(text, text, integer, integer, integer, integer, integer) to authenticated;
