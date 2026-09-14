-- Is the library's vector index there yet, and is a background build still running?
select 'index'::text as what, indexname as detail from pg_indexes
 where tablename = 'library_chunks' and indexname like '%embedding%'
union all
select 'job', jobname || ' (' || case when active then 'scheduled' else 'off' end || ')' from cron.job
 where jobname = 'build-library-index'
union all
select 'building now', left(query, 60) from pg_stat_activity
 where query ilike 'create index%library_chunks%' and state = 'active';
