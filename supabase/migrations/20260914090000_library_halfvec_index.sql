-- Migration 48 — the library's vector index in half precision.
--
-- Building the HNSW graph over tens of thousands of 1,024-number vectors
-- needs the graph in memory: about 350 MB at full precision for a library
-- of a thousand books. The small instance refuses a parallel build that
-- much shared memory ("could not resize shared memory segment"), and a
-- serial build that does not fit maintenance_work_mem crawls through pass
-- after pass. Half precision — 16-bit numbers — halves the graph and costs
-- nothing that can be measured in what the search returns. The index is an
-- expression index over the cast, so the stored vectors stay as they are;
-- the search function compares in half precision too, which is what lets
-- the planner use the index. Built serially, in one session's memory.
--
-- The three settings are for this session only. Run again after a large
-- load with the index dropped (supabase/maintenance/library-index-off.sql).
set statement_timeout = '30min';
set max_parallel_maintenance_workers = 0;
set maintenance_work_mem = '256MB';

drop index if exists public.library_chunks_embedding_idx;
create index if not exists library_chunks_embedding_half_idx
  on public.library_chunks
  using hnsw ((embedding::extensions.halfvec(1024)) extensions.halfvec_cosine_ops);

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
           (1 - ((c.embedding::extensions.halfvec(1024)) <=> (p_embedding::extensions.halfvec(1024))))::real
      from public.library_chunks c
      join public.library_sources s on s.id = c.source_id
     where s.status = 'active' and c.embedding is not null
     -- The same expression as the index, so the index answers it.
     order by (c.embedding::extensions.halfvec(1024)) <=> (p_embedding::extensions.halfvec(1024))
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

analyze public.library_chunks;
