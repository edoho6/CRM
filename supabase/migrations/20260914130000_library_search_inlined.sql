-- Migration 52 — the search function is inlined into the query that calls it.
--
-- As it was, the function could not be inlined (a SET clause forbids it),
-- so each connection planned its body once, with the parameters unknown,
-- and kept that plan for as long as it lived. Planned against an empty
-- table, the text half settled on scanning every row; by the time the
-- table held ninety thousand passages the same plan took eight seconds,
-- while the identical query typed by hand took a millisecond and used the
-- text index. Without the SET clause, and with the vector operator and
-- types named by schema instead, Postgres inlines the body into the
-- calling query and plans it afresh with the real values every time.
create or replace function public.library_search(p_embedding extensions.vector(1024), p_query text, p_limit integer default 20)
returns table (via text, chunk_id uuid, source_id uuid, title text, url text, kind text, page integer, heading text, content text, score real)
language sql
stable
security invoker
as $$
  (
    select 'vector'::text, n.id, s.id, s.title, s.url, s.kind, n.page, n.heading, n.content, (1 - n.distance)::real
      from (
        select c.id, c.source_id, c.page, c.heading, c.content,
               ((c.embedding::extensions.halfvec(1024)) operator(extensions.<=>) (p_embedding::extensions.halfvec(1024))) as distance
          from public.library_chunks c
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
     where s.status = 'active'
       and coalesce(p_query, '') <> ''
       and c.tsv @@ pg_catalog.websearch_to_tsquery('english', p_query)
     order by pg_catalog.ts_rank(c.tsv, pg_catalog.websearch_to_tsquery('english', p_query)) desc
     limit p_limit
  );
$$;
