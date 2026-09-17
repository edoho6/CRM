-- An HNSW index on the canon's passage vectors (migration 72). Not needed at the
-- canon's first size — 31,000 passages scan in well under a second — and worth
-- building if the canon grows several times over. Run in the SQL editor after
-- `node scripts/library/canon/load.mjs`: built on a full table, one pass, one
-- worker (a parallel build ran out of shared memory on the small instance,
-- the same lesson as library-index-on.sql).
set maintenance_work_mem = '256MB';
set max_parallel_maintenance_workers = 0;
create index if not exists canon_passages_embedding_idx
  on public.canon_passages using hnsw (embedding extensions.halfvec_cosine_ops);
analyze public.canon_passages;
