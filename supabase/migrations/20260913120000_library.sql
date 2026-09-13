-- Migration 45 — the professional library: sources, their passages with
-- embeddings, and the log of who asked what of it (never what they asked).
--
-- Shared by every clinic, like the Western medicine reference: no clinic_id,
-- members read, nobody writes from the app. The library is loaded by the
-- platform admin from a terminal (scripts/library/ingest.mjs), through the
-- functions below, which check the platform list themselves. The app holds
-- no service key.
--
-- Needs the `vector` extension (pgvector): Dashboard → Database →
-- Extensions → vector, before this file is run.
create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Sources: one row per file in the shared folder, or per page of a listed site.
-- ---------------------------------------------------------------------------
create table if not exists public.library_sources (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('file', 'website')),
  -- What identifies the source where it lives: "drive:<file id>", a local
  -- path, or the page's URL. One row per locator.
  locator text not null unique,
  title text not null,
  url text,
  sha256 text,
  bytes integer,
  pages integer,
  language text,
  licence_note text,
  fetched_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists library_sources_status_idx on public.library_sources (status, kind);

-- ---------------------------------------------------------------------------
-- Passages: the text in pieces of a few hundred words, each with its
-- embedding (Voyage AI, 1024 dimensions) and a full-text vector for the
-- words themselves.
-- ---------------------------------------------------------------------------
create table if not exists public.library_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.library_sources(id) on delete cascade,
  ordinal integer not null,
  page integer,
  heading text,
  content text not null,
  tokens integer,
  embedding extensions.vector(1024),
  tsv tsvector generated always as (to_tsvector('english', coalesce(heading, '') || ' ' || content)) stored,
  created_at timestamptz not null default now(),
  unique (source_id, ordinal)
);

create index if not exists library_chunks_source_idx on public.library_chunks (source_id, ordinal);
create index if not exists library_chunks_tsv_idx on public.library_chunks using gin (tsv);
create index if not exists library_chunks_embedding_idx on public.library_chunks using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- The log: who asked, when, what was retrieved. No question, no answer.
-- ---------------------------------------------------------------------------
create table if not exists public.library_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  asked_at timestamptz not null default now(),
  status text not null check (status in ('answered', 'no_sources', 'refused_pii', 'refused_quota', 'error')),
  -- [{source_id, title, url, page, cited}]
  sources jsonb not null default '[]'::jsonb,
  model text,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer
);

create index if not exists library_queries_clinic_idx on public.library_queries (clinic_id, asked_at desc);
create index if not exists library_queries_user_day_idx on public.library_queries (user_id, asked_at desc);

-- ---------------------------------------------------------------------------
-- Policies: members read the library and their clinic's log; nobody writes.
-- ---------------------------------------------------------------------------
alter table public.library_sources enable row level security;
alter table public.library_chunks enable row level security;
alter table public.library_queries enable row level security;

drop policy if exists library_sources_members_read on public.library_sources;
create policy library_sources_members_read on public.library_sources
  for select using (public.current_clinic_id() is not null);

drop policy if exists library_chunks_members_read on public.library_chunks;
create policy library_chunks_members_read on public.library_chunks
  for select using (public.current_clinic_id() is not null);

drop policy if exists library_queries_members_read on public.library_queries;
create policy library_queries_members_read on public.library_queries
  for select using (public.is_clinic_member(clinic_id));

-- ---------------------------------------------------------------------------
-- Loading, by the platform admin only.
-- ---------------------------------------------------------------------------
create or replace function public.library_upsert_source(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(p ->> 'locator', '') = '' or coalesce(p ->> 'title', '') = '' then
    raise exception 'bad_payload' using errcode = '22023';
  end if;
  insert into public.library_sources (kind, locator, title, url, sha256, bytes, pages, language, licence_note, fetched_at, status)
  values (
    coalesce(p ->> 'kind', 'file'), p ->> 'locator', p ->> 'title', p ->> 'url', p ->> 'sha256',
    (p ->> 'bytes')::integer, (p ->> 'pages')::integer, p ->> 'language', p ->> 'licence_note',
    coalesce((p ->> 'fetched_at')::timestamptz, now()), 'active'
  )
  on conflict (locator) do update
    set title = excluded.title,
        url = excluded.url,
        sha256 = excluded.sha256,
        bytes = excluded.bytes,
        pages = excluded.pages,
        language = excluded.language,
        licence_note = excluded.licence_note,
        fetched_at = excluded.fetched_at,
        status = 'active',
        updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

-- Clears a source's passages before they are loaded again.
create or replace function public.library_clear_chunks(p_source uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.library_chunks where source_id = p_source;
end;
$$;

-- [{ordinal, page, heading, content, tokens, embedding: [..1024 numbers..]}]
create or replace function public.library_add_chunks(p_source uuid, p_chunks jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c jsonb;
  v_count integer := 0;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_chunks) <> 'array' then
    raise exception 'bad_payload' using errcode = '22023';
  end if;
  for c in select * from jsonb_array_elements(p_chunks) loop
    insert into public.library_chunks (source_id, ordinal, page, heading, content, tokens, embedding)
    values (
      p_source, (c ->> 'ordinal')::integer, (c ->> 'page')::integer, c ->> 'heading', c ->> 'content',
      (c ->> 'tokens')::integer, (c ->> 'embedding')::extensions.vector(1024)
    )
    on conflict (source_id, ordinal) do update
      set page = excluded.page, heading = excluded.heading, content = excluded.content,
          tokens = excluded.tokens, embedding = excluded.embedding;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.library_remove_source(p_source uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.library_chunks where source_id = p_source;
  update public.library_sources set status = 'removed', updated_at = now() where id = p_source;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reading: the search runs as the caller, so the policies above apply.
-- Two rankings come back, marked `via`: by meaning (cosine) and by words
-- (full text, English); the app folds them together.
-- ---------------------------------------------------------------------------
create or replace function public.library_search(p_embedding extensions.vector(1024), p_query text, p_limit integer default 20)
returns table (via text, chunk_id uuid, source_id uuid, title text, url text, kind text, page integer, heading text, content text, score real)
language sql
stable
security invoker
-- `extensions` too: the <=> operator of pgvector lives there, and a function's
-- own search path would otherwise hide it (the SQL editor's session path does not).
set search_path = public, extensions
as $$
  (
    select 'vector'::text, c.id, s.id, s.title, s.url, s.kind, c.page, c.heading, c.content,
           (1 - (c.embedding <=> p_embedding))::real
      from public.library_chunks c
      join public.library_sources s on s.id = c.source_id
     where s.status = 'active' and c.embedding is not null
     order by c.embedding <=> p_embedding
     limit p_limit
  )
  union all
  (
    select 'text'::text, c.id, s.id, s.title, s.url, s.kind, c.page, c.heading, c.content,
           ts_rank(c.tsv, websearch_to_tsquery('english', p_query))::real
      from public.library_chunks c
      join public.library_sources s on s.id = c.source_id
     where s.status = 'active'
       and coalesce(p_query, '') <> ''
       and c.tsv @@ websearch_to_tsquery('english', p_query)
     order by ts_rank(c.tsv, websearch_to_tsquery('english', p_query)) desc
     limit p_limit
  );
$$;

-- How many questions the caller asked today, for the daily quota.
create or replace function public.library_questions_today()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.library_queries q
   where q.user_id = auth.uid()
     and q.asked_at >= date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem';
$$;

-- The one way a row enters the log: the caller's own id and clinic, taken
-- from the session, and the sources — never the words.
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
  if p_status not in ('answered', 'no_sources', 'refused_pii', 'refused_quota', 'error') then
    raise exception 'bad_status' using errcode = '22023';
  end if;
  insert into public.library_queries (user_id, clinic_id, status, sources, model, input_tokens, output_tokens, latency_ms)
  values (auth.uid(), v_clinic, p_status, coalesce(p_sources, '[]'::jsonb), p_model, p_input_tokens, p_output_tokens, p_latency_ms)
  returning id into v_id;
  return v_id;
end;
$$;

-- Counts for the platform page and the sources screen.
create or replace function public.library_stats()
returns table (kind text, sources bigint, chunks bigint, last_fetched timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select s.kind, count(distinct s.id), count(c.id), max(s.fetched_at)
    from public.library_sources s
    left join public.library_chunks c on c.source_id = s.id
   where s.status = 'active'
   group by s.kind
   order by s.kind;
$$;

-- ---------------------------------------------------------------------------
-- Grants. Supabase hands EXECUTE to anon, authenticated and service_role by
-- default; the writing functions check the platform list themselves, the
-- log function checks the session, and anon gets none of them.
-- ---------------------------------------------------------------------------
revoke all on function public.library_upsert_source(jsonb) from public;
revoke all on function public.library_clear_chunks(uuid) from public;
revoke all on function public.library_add_chunks(uuid, jsonb) from public;
revoke all on function public.library_remove_source(uuid) from public;
revoke all on function public.library_search(extensions.vector, text, integer) from public;
revoke all on function public.library_questions_today() from public;
revoke all on function public.library_log_query(text, jsonb, text, integer, integer, integer) from public;
revoke all on function public.library_stats() from public;

revoke execute on function public.library_upsert_source(jsonb) from anon;
revoke execute on function public.library_clear_chunks(uuid) from anon;
revoke execute on function public.library_add_chunks(uuid, jsonb) from anon;
revoke execute on function public.library_remove_source(uuid) from anon;
revoke execute on function public.library_search(extensions.vector, text, integer) from anon;
revoke execute on function public.library_questions_today() from anon;
revoke execute on function public.library_log_query(text, jsonb, text, integer, integer, integer) from anon;
revoke execute on function public.library_stats() from anon;

grant execute on function public.library_upsert_source(jsonb) to authenticated;
grant execute on function public.library_clear_chunks(uuid) to authenticated;
grant execute on function public.library_add_chunks(uuid, jsonb) to authenticated;
grant execute on function public.library_remove_source(uuid) to authenticated;
grant execute on function public.library_search(extensions.vector, text, integer) to authenticated;
grant execute on function public.library_questions_today() to authenticated;
grant execute on function public.library_log_query(text, jsonb, text, integer, integer, integer) to authenticated;
grant execute on function public.library_stats() to authenticated;
