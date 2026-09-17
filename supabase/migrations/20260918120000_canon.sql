-- ============================================================================
-- 72 · The canon: the core books, by their own structure, for the library chat
-- ============================================================================
-- The chat's new engine (17.9) answers from a small canon of core books, each
-- read the way it is written: one entry per herb, formula and point with its
-- sections, and the pattern books as passages under their headings
-- (scripts/library/canon/). This migration holds them in the database.
--
-- Closed the way migration 71 closed the library:
--   · the tables are readable by the platform admin only;
--   · the functions the chat reads through answer only a signed-in clinic
--     member AND the service's key (`library_key_ok`), so a member calling them
--     by hand gets nothing — practitioners receive answers, never the books;
--   · loading goes through functions that accept the platform admin (or the
--     service role) only, the same gate as the library's loaders.
--
-- No book title is stored with a passage: `book` is a neutral id
-- (herbs, formulas, points, practice…), and the answer never names a source.
--
-- The vector search runs without an index: 31,000 passages scan in well under a
-- second. `supabase/maintenance/canon-index-on.sql` adds an HNSW index should
-- the canon grow.
-- ============================================================================

create table if not exists public.canon_entries (
  id text primary key,
  book text not null,
  kind text not null check (kind in ('herb', 'formula', 'point')),
  page integer,
  associated_with text,
  names jsonb not null default '{}'::jsonb,
  sections jsonb not null default '{}'::jsonb,
  loaded_at timestamptz not null default now()
);

create table if not exists public.canon_names (
  kind text not null check (kind in ('herb', 'formula', 'point')),
  key text not null,
  entry_id text not null references public.canon_entries (id) on delete cascade,
  primary key (kind, key, entry_id)
);
create index if not exists canon_names_entry_only_idx on public.canon_names (entry_id);

create table if not exists public.canon_passages (
  id bigint generated always as identity primary key,
  book text not null,
  entry_id text references public.canon_entries (id) on delete cascade,
  section text,
  heading text not null default '',
  page integer,
  content text not null,
  embedding extensions.halfvec(1024) not null,
  tsv tsvector generated always as (to_tsvector('english', heading || ' ' || content)) stored
);
create index if not exists canon_passages_tsv_idx on public.canon_passages using gin (tsv);
create index if not exists canon_passages_entry_only_idx on public.canon_passages (entry_id);

-- A text worked out once at load time (the pregnancy list of points).
create table if not exists public.canon_notes (
  name text primary key,
  content text not null
);

alter table public.canon_entries enable row level security;
alter table public.canon_names enable row level security;
alter table public.canon_passages enable row level security;
alter table public.canon_notes enable row level security;

drop policy if exists canon_entries_admin_read on public.canon_entries;
create policy canon_entries_admin_read on public.canon_entries for select to authenticated using ((select public.is_platform_admin()));
drop policy if exists canon_names_admin_read on public.canon_names;
create policy canon_names_admin_read on public.canon_names for select to authenticated using ((select public.is_platform_admin()));
drop policy if exists canon_passages_admin_read on public.canon_passages;
create policy canon_passages_admin_read on public.canon_passages for select to authenticated using ((select public.is_platform_admin()));
drop policy if exists canon_notes_admin_read on public.canon_notes;
create policy canon_notes_admin_read on public.canon_notes for select to authenticated using ((select public.is_platform_admin()));

-- Reading, for the chat ------------------------------------------------------

-- Every name key → entry, for the server to hold in memory (a few thousand rows).
create or replace function public.canon_name_rows(p_key text default null)
returns table (kind text, key text, entry_id text)
language sql
stable
security definer
set search_path = public
as $$
  select n.kind, n.key, n.entry_id
    from public.canon_names n
   where (select public.current_clinic_id()) is not null
     and (select public.library_key_ok(p_key));
$$;

create or replace function public.canon_entries_get(p_ids text[], p_key text default null)
returns table (id text, book text, kind text, page integer, associated_with text, names jsonb, sections jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.book, e.kind, e.page, e.associated_with, e.names, e.sections
    from public.canon_entries e
   where e.id = any (coalesce(p_ids, '{}'))
     and (select public.current_clinic_id()) is not null
     and (select public.library_key_ok(p_key));
$$;

-- One query vector (the nearest passages) and, on the same call, the word
-- matches for a few phrases (every word of a phrase in the passage).
create or replace function public.canon_search(
  p_embedding extensions.vector(1024),
  p_phrases text[] default '{}',
  p_limit integer default 40,
  p_key text default null
)
returns table (via text, passage_id bigint, entry_id text, section text, heading text, content text, score real)
language sql
stable
security definer
set search_path = public, extensions
as $$
  (
    select 'vector'::text, p.id, p.entry_id, p.section, p.heading, p.content,
           (1 - (p.embedding operator(extensions.<=>) (p_embedding::extensions.halfvec(1024))))::real
      from public.canon_passages p
     where (select public.current_clinic_id()) is not null
       and (select public.library_key_ok(p_key))
     order by p.embedding operator(extensions.<=>) (p_embedding::extensions.halfvec(1024))
     limit greatest(p_limit, 1)
  )
  union all
  (
    select 'text'::text, t.id, t.entry_id, t.section, t.heading, t.content, t.rank
      from (
        select distinct on (p.id) p.id, p.entry_id, p.section, p.heading, p.content,
               pg_catalog.ts_rank(p.tsv, pg_catalog.plainto_tsquery('english', q))::real as rank
          from unnest(coalesce(p_phrases, '{}')) as q
          join public.canon_passages p on p.tsv @@ pg_catalog.plainto_tsquery('english', q)
         where coalesce(q, '') <> ''
           and (select public.current_clinic_id()) is not null
           and (select public.library_key_ok(p_key))
         order by p.id, rank desc
      ) t
     order by t.rank desc
     limit greatest(p_limit, 1)
  );
$$;

create or replace function public.canon_note(p_name text, p_key text default null)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select n.content
    from public.canon_notes n
   where n.name = p_name
     and (select public.current_clinic_id()) is not null
     and (select public.library_key_ok(p_key));
$$;

-- Loading, for the platform admin ------------------------------------------------

create or replace function public.canon_clear()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.library_may_load() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.canon_passages where true;
  delete from public.canon_names where true;
  delete from public.canon_notes where true;
  delete from public.canon_entries where true;
end;
$$;

create or replace function public.canon_add_entries(p jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.library_may_load() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.canon_entries (id, book, kind, page, associated_with, names, sections)
  select x ->> 'id', x ->> 'book', x ->> 'kind', (x ->> 'page')::integer, x ->> 'associatedWith',
         coalesce(x -> 'names', '{}'::jsonb), coalesce(x -> 'sections', '{}'::jsonb)
    from jsonb_array_elements(p) x
  on conflict (id) do update
    set book = excluded.book, kind = excluded.kind, page = excluded.page, associated_with = excluded.associated_with,
        names = excluded.names, sections = excluded.sections, loaded_at = now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.canon_add_names(p jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.library_may_load() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.canon_names (kind, key, entry_id)
  select x ->> 'kind', x ->> 'key', x ->> 'entryId'
    from jsonb_array_elements(p) x
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.canon_add_passages(p jsonb)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_count integer;
begin
  if not public.library_may_load() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.canon_passages (book, entry_id, section, heading, page, content, embedding)
  select x ->> 'book', x ->> 'entry', x ->> 'section', coalesce(x ->> 'heading', ''), (x ->> 'page')::integer,
         x ->> 'text', ((x -> 'embedding')::text)::extensions.halfvec(1024)
    from jsonb_array_elements(p) x;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.canon_set_note(p_name text, p_content text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.library_may_load() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.canon_notes (name, content) values (p_name, p_content)
  on conflict (name) do update set content = excluded.content;
end;
$$;

-- Grants -----------------------------------------------------------------------
revoke all on function public.canon_name_rows(text) from public;
revoke all on function public.canon_entries_get(text[], text) from public;
revoke all on function public.canon_search(extensions.vector, text[], integer, text) from public;
revoke all on function public.canon_note(text, text) from public;
revoke all on function public.canon_clear() from public;
revoke all on function public.canon_add_entries(jsonb) from public;
revoke all on function public.canon_add_names(jsonb) from public;
revoke all on function public.canon_add_passages(jsonb) from public;
revoke all on function public.canon_set_note(text, text) from public;

revoke execute on function public.canon_name_rows(text) from anon;
revoke execute on function public.canon_entries_get(text[], text) from anon;
revoke execute on function public.canon_search(extensions.vector, text[], integer, text) from anon;
revoke execute on function public.canon_note(text, text) from anon;
revoke execute on function public.canon_clear() from anon;
revoke execute on function public.canon_add_entries(jsonb) from anon;
revoke execute on function public.canon_add_names(jsonb) from anon;
revoke execute on function public.canon_add_passages(jsonb) from anon;
revoke execute on function public.canon_set_note(text, text) from anon;

grant execute on function public.canon_name_rows(text) to authenticated;
grant execute on function public.canon_entries_get(text[], text) to authenticated;
grant execute on function public.canon_search(extensions.vector, text[], integer, text) to authenticated;
grant execute on function public.canon_note(text, text) to authenticated;
grant execute on function public.canon_clear() to authenticated, service_role;
grant execute on function public.canon_add_entries(jsonb) to authenticated, service_role;
grant execute on function public.canon_add_names(jsonb) to authenticated, service_role;
grant execute on function public.canon_add_passages(jsonb) to authenticated, service_role;
grant execute on function public.canon_set_note(text, text) to authenticated, service_role;
