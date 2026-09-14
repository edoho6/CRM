-- Migration 50 — the library's row-security checks are paid once per query, not once per row.
--
-- The policies ask `current_clinic_id() is not null`: a function that reads
-- the caller's membership. Written plainly in a policy, Postgres evaluates
-- it for every row the query touches — a count over eighty thousand
-- passages made eighty thousand membership lookups and ran past the
-- eight-second limit, while the same count as the database owner took a
-- third of a second. Wrapped in a sub-select, the function runs once and
-- the result is compared to every row. The check itself is unchanged.
drop policy if exists library_sources_members_read on public.library_sources;
create policy library_sources_members_read on public.library_sources
  for select using ((select public.current_clinic_id()) is not null);

drop policy if exists library_chunks_members_read on public.library_chunks;
create policy library_chunks_members_read on public.library_chunks
  for select using ((select public.current_clinic_id()) is not null);
