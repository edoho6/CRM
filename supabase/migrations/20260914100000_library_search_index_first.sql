-- Migration 49 — the vector search reads the index first, and joins after.
--
-- With the nearest-neighbour ordering, the join to the sources table and
-- the status filter in one query, the planner is free to scan the whole
-- passages table and sort — on a library of tens of thousands of long rows
-- that is a gigabyte read under an eight-second limit. So the nearest
-- passages are taken first, from the index alone, in a query shaped the
-- way the index answers it (order by the indexed expression, then limit),
-- and only those few rows are joined to their sources. Three times the
-- limit are taken, so that a passage of a removed source does not leave
-- the answer short.
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
    select 'vector'::text, n.id, s.id, s.title, s.url, s.kind, n.page, n.heading, n.content, (1 - n.distance)::real
      from (
        select c.id, c.source_id, c.page, c.heading, c.content,
               ((c.embedding::extensions.halfvec(1024)) <=> (p_embedding::extensions.halfvec(1024))) as distance
          from public.library_chunks c
         order by (c.embedding::extensions.halfvec(1024)) <=> (p_embedding::extensions.halfvec(1024))
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
