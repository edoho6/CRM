-- ============================================================================
-- 73 · The canon's teaching layer: a Hebrew course, searched only when asked for
-- ============================================================================
-- Reidman College's course material in Hebrew (17.9, scripts/library/canon/course-*.mjs)
-- sits in canon_passages as book 'course'. It is a trial the platform admin switches
-- on: the practitioners' chat never reads it until the layer has been compared with
-- the canon alone and the safety checks are settled.
--
--   · canon_search gains p_course: false (the default, and the only value the app
--     sends for anyone but the platform admin) leaves the course out; true searches
--     the course alone, so its passages are fetched in a call of their own and cannot
--     crowd the books out of the vector search.
--   · canon_clear() no longer touches the course, and canon_clear_book() replaces one
--     book — so reloading the books and reloading the course are separate runs.
-- The key and the loader gates are those of migration 72.
-- ============================================================================

drop function if exists public.canon_search(extensions.vector, text[], integer, text);

create or replace function public.canon_search(
  p_embedding extensions.vector(1024),
  p_phrases text[] default '{}',
  p_limit integer default 40,
  p_key text default null,
  p_course boolean default false
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
       and (p.book = 'course') = coalesce(p_course, false)
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
           and (p.book = 'course') = coalesce(p_course, false)
         order by p.id, rank desc
      ) t
     order by t.rank desc
     limit greatest(p_limit, 1)
  );
$$;

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
  delete from public.canon_passages where book <> 'course';
  delete from public.canon_names where true;
  delete from public.canon_notes where true;
  delete from public.canon_entries where true;
end;
$$;

create or replace function public.canon_clear_book(p_book text)
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
  delete from public.canon_passages where book = p_book;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.canon_search(extensions.vector, text[], integer, text, boolean) from public;
revoke all on function public.canon_clear_book(text) from public;
revoke execute on function public.canon_search(extensions.vector, text[], integer, text, boolean) from anon;
revoke execute on function public.canon_clear_book(text) from anon;
grant execute on function public.canon_search(extensions.vector, text[], integer, text, boolean) to authenticated;
grant execute on function public.canon_clear_book(text) to authenticated, service_role;
