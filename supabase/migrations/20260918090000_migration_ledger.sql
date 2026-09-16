-- ============================================================================
-- 69 · A record of which of these files has been run
-- ============================================================================
-- Every change to this database arrives the same way: a file is pasted into the
-- SQL editor and run. Nothing anywhere records that it happened. The only way
-- to answer "has 57 been applied?" has been to think of something 57 created
-- and go looking for it — which works, and is exactly the kind of archaeology
-- that gets skipped when someone is in a hurry, and then a file gets run twice
-- or not at all.
--
-- The migrations are idempotent, so running one twice is survivable. Running
-- one *not at all* is not: the application ships expecting it.
--
-- So: a table with one row per file. From here on, every `NN_..._to_run.sql`
-- ends by inserting its own name into it. Nothing before this file is in there,
-- because nobody wrote down when those were run and inventing the dates would
-- make the ledger worse than empty — with one exception below, which can be
-- established by looking rather than remembering.
--
-- Where it is *not* kept: this is deliberately not the CLI's own
-- `supabase_migrations.schema_migrations`. That table belongs to `supabase db
-- push`, which this project does not use against the real database, and writing
-- into it by hand would make the CLI believe things about a database it has
-- never seen.
-- ============================================================================

create table if not exists public.schema_migrations (
  -- The file name as it appears in the repository root, e.g. '61_ledger_to_run.sql'.
  name text primary key,
  applied_at timestamptz not null default now(),
  -- Free text for the unusual case: 'detected afterwards', 're-run to fix X'.
  note text
);

comment on table public.schema_migrations is
  'Which NN_*_to_run.sql files have been applied to this database, and when. Written only from the SQL editor.';

alter table public.schema_migrations enable row level security;

-- Readable by whoever runs the service, and by nobody else. It says nothing
-- about any patient, but it does describe the shape of the system, and there is
-- no screen in the application that has any use for it.
drop policy if exists "platform admins read the migration ledger" on public.schema_migrations;
create policy "platform admins read the migration ledger"
  on public.schema_migrations
  for select
  to authenticated
  using ((select public.is_platform_admin()));

-- No insert, update or delete policy exists, on purpose — the same arrangement
-- as `booking_codes`. The ledger is written from the SQL editor, which runs as
-- the database owner and is not subject to policies; a signed-in member of any
-- clinic, platform admin included, cannot add a line to it or remove one. A
-- record of what was done to the database that the application itself can edit
-- is not a record.

-- ---------------------------------------------------------------------------
-- Backfill: the one entry that can be established by looking
-- ---------------------------------------------------------------------------
-- 60 is the file this one has to follow, and it is the only earlier file whose
-- presence is worth asserting here — if it has not been run, three functions
-- are still open to anyone holding the public key. `enqueue_now_for_my_clinic`
-- is created by it and by nothing else, so its existence is the answer.
--
-- If the row below does not appear after running this file, 60 has not been
-- applied. Run it, then run this one again.
insert into public.schema_migrations (name, note)
select
  '60_payments_and_queues_locked_down_to_run.sql',
  'detected by the presence of enqueue_now_for_my_clinic, not recorded when it ran'
where to_regprocedure('public.enqueue_now_for_my_clinic(text)') is not null
on conflict (name) do nothing;

insert into public.schema_migrations (name, note)
values ('61_migration_ledger_to_run.sql', 'the ledger itself; nothing before 60 is recorded')
on conflict (name) do nothing;
