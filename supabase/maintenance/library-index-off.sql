-- Before a large load of the professional library: the vector index is
-- dropped, so that every passage inserted does not also have to be placed
-- in the index graph (that is what made a five-thousand-passage book crawl
-- and time out). Search still works without it — a sequential scan over a
-- few tens of thousands of vectors takes well under a second — and the
-- index is built once, whole, with library-index-on.sql after the load.
drop index if exists public.library_chunks_embedding_idx;
