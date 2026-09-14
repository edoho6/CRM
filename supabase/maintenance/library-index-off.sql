-- Before a large load of the professional library: the vector index is
-- dropped, so that every passage inserted does not also have to be placed
-- in the index graph (that is what made a five-thousand-passage book crawl
-- and time out). Until it is built again (library-index-on.sql, after the
-- load) a vector search scans the table and, over a large library, runs
-- past the database's time limit — so build it again as soon as the load
-- is done.
drop index if exists public.library_chunks_embedding_idx;
drop index if exists public.library_chunks_embedding_half_idx;
