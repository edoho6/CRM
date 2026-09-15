-- Migration 59 — withdrawing migration 58: the word search goes back to the
-- body that has been serving the library, and the relaxation moves to the
-- application, where it can be measured before it is shipped.
--
-- 58 fell back to the same search terms joined by OR when the strict query
-- found nothing. Measured against the real library that fallback took
-- **8.1 seconds and was cancelled** by the eight-second statement timeout:
-- an OR of eight ordinary words matches a large part of 74,000 passages and
-- `ts_rank` must then score every one of them. Since most questions are
-- exactly the ones whose terms do not all co-occur, 58 turned a quiet half
-- of the search into a failed request on most questions — worse than the
-- gap it was meant to close.
--
-- Measured, same question, same vector:
--
--   vector half alone                         0.6s
--   strict query that matches                 0.5s
--   AND of the first two keywords    20 rows  0.6s
--   AND of the first three keywords  20 rows  0.8s
--   OR of three keywords             20 rows  3.3s
--   OR of the planner's eight words           8.1s → cancelled
--
-- So the relaxation is to ask for fewer terms and still require all of them
-- — and it belongs in `features/library/ask.ts`, which can issue that
-- second search only when the first found no words at all, and which is
-- covered by tests. This file restores the function exactly as migration 53
-- defined it: one statement, no fallback, nothing that can run long.
--
-- The lesson, written into the module's notes: every branch of this
-- function shares one eight-second budget, so none of them may be added
-- without being timed against the real library.
create or replace function public.library_search(p_embedding extensions.vector(1024), p_query text, p_limit integer default 20)
returns table (via text, chunk_id uuid, source_id uuid, title text, url text, kind text, page integer, heading text, content text, score real)
language sql
stable
security definer
set search_path = public, extensions
as $$
  (
    select 'vector'::text, n.id, s.id, s.title, s.url, s.kind, n.page, n.heading, n.content, (1 - n.distance)::real
      from (
        select c.id, c.source_id, c.page, c.heading, c.content,
               ((c.embedding::extensions.halfvec(1024)) operator(extensions.<=>) (p_embedding::extensions.halfvec(1024))) as distance
          from public.library_chunks c
         where (select public.current_clinic_id()) is not null
         order by (c.embedding::extensions.halfvec(1024)) operator(extensions.<=>) (p_embedding::extensions.halfvec(1024))
         limit greatest(p_limit, 1) * 3
      ) n
      join public.library_sources s on s.id = n.source_id
     where s.status = 'active'
     order by n.distance
     limit p_limit
  )
  union all
  (
    select 'text'::text, c.id, s.id, s.title, s.url, s.kind, c.page, c.heading, c.content,
           pg_catalog.ts_rank(c.tsv, pg_catalog.websearch_to_tsquery('english', p_query))::real
      from public.library_chunks c
      join public.library_sources s on s.id = c.source_id
     where (select public.current_clinic_id()) is not null
       and s.status = 'active'
       and coalesce(p_query, '') <> ''
       and c.tsv @@ pg_catalog.websearch_to_tsquery('english', p_query)
     order by pg_catalog.ts_rank(c.tsv, pg_catalog.websearch_to_tsquery('english', p_query)) desc
     limit p_limit
  );
$$;

revoke all on function public.library_search(extensions.vector, text, integer) from public;
revoke execute on function public.library_search(extensions.vector, text, integer) from anon;
grant execute on function public.library_search(extensions.vector, text, integer) to authenticated;
