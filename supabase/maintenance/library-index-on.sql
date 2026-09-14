-- After a large load of the professional library: the vector index, built
-- once over everything. Building a graph over tens of thousands of
-- 1,024-number vectors wants memory; the setting below is for this session
-- only. On a small instance this can take a few minutes — the SQL editor
-- waits. If it stops with a timeout, run it again later or from a quieter
-- moment; until it exists, search simply scans (slower, still correct).
set maintenance_work_mem = '512MB';
create index if not exists library_chunks_embedding_idx
  on public.library_chunks using hnsw (embedding extensions.vector_cosine_ops);
analyze public.library_chunks;
