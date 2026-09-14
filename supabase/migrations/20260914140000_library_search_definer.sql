-- Migration 53 — the search runs as the library's owner, with the membership check inside it.
--
-- Under row security, a query may only use an index for a condition whose
-- operator is marked leakproof, because index conditions are evaluated
-- before the security check. Full-text match (@@) is not marked so: with
-- row security on, the text half of the search could never use its index
-- and read every passage — eight seconds and a timeout — while the same
-- query typed by the owner took a millisecond. The vector ordering has no
-- such rule, which is why that half was fast.
--
-- So the function now runs as the owner (security definer): the tables'
-- row security does not apply inside it, both indexes serve, and the one
-- rule those policies expressed — only a clinic member reads the library —
-- is enforced by the function itself, in each half, as a one-time check
-- (the sub-select makes it a single evaluation, not one per row). The
-- search path is pinned, as a definer function's must be.
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
