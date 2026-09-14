-- Why a query over the passages is slow: how big the table and its indexes
-- are, whether the last vacuum set the visibility map (index-only scans
-- and counts need it), how many rows are dead, and what a plain count costs.
select c.relname, c.reltuples::bigint as rows_estimated, c.relpages, c.relallvisible,
       pg_size_pretty(pg_total_relation_size(c.oid)) as total_size
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname in ('library_chunks', 'library_sources', 'library_chunks_embedding_half_idx', 'library_chunks_tsv_idx');

select relname, n_live_tup, n_dead_tup, last_vacuum, last_autovacuum, last_analyze, last_autoanalyze
  from pg_stat_user_tables where relname = 'library_chunks';

explain (analyze, buffers, summary) select count(*) from public.library_chunks;
