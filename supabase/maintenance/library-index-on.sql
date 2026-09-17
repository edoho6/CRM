-- The library's vector index in half precision (as migration 48 built it).
--
-- Building the HNSW graph over tens of thousands of 1,024-number vectors
-- needs the graph in memory: about 350 MB at full precision for a library
-- of a thousand books. The small instance refuses a parallel build that
-- much shared memory ("could not resize shared memory segment"), and a
-- serial build that does not fit maintenance_work_mem crawls through pass
-- after pass. Half precision — 16-bit numbers — halves the graph and costs
-- nothing that can be measured in what the search returns. The index is an
-- expression index over the cast, so the stored vectors stay as they are;
-- the search function (migration 59) compares in half precision too, which lets
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

-- The search function is not written here. It lives in the migrations and has
-- changed since 48: it runs as the table owner since 53 (under RLS the word
-- search scanned the whole table and timed out) and took its current shape in
-- 59. The copy this file used to carry was 48's, so every run after a large
-- load quietly put the slow search back.

analyze public.library_chunks;
