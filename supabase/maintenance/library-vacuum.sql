-- After a large load: the planner's statistics and the visibility map for
-- the passages table, so counts and searches use the indexes. One statement
-- on its own, because VACUUM refuses to run inside a transaction.
vacuum analyze public.library_chunks;
