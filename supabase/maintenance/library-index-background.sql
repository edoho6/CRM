-- The vector index built in the background, for when the dashboard's SQL
-- editor gives up waiting ("Failed to fetch") before a long build ends.
-- pg_cron runs the build as a job of its own, with no request to time out;
-- the job removes itself when it is done. Needs the pg_cron extension
-- (Database → Extensions). Check progress with library-index-check.sql.
select cron.schedule(
  'build-library-index',
  '1 minute',
  $job$
    set max_parallel_maintenance_workers = 0;
    set maintenance_work_mem = '256MB';
    create index if not exists library_chunks_embedding_half_idx
      on public.library_chunks
      using hnsw ((embedding::extensions.halfvec(1024)) extensions.halfvec_cosine_ops);
    analyze public.library_chunks;
    select cron.unschedule('build-library-index');
  $job$
);
