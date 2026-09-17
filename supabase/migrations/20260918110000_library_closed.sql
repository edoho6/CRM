-- ============================================================================
-- 71 · The professional library is read by the service, not by its users
-- ============================================================================
-- Until now every member of every clinic could read every passage of the
-- library and the list of its sources: the tables were readable by any
-- signed-in member (`current_clinic_id() is not null`), and `library_search`
-- answered any member who called it straight through the API. With one clinic
-- that was one practitioner reading their own books. With more clinics it is
-- licensed books, and the list of what the library holds, handed to people
-- who were only meant to receive answers (decision of 16.9: "no user of any
-- clinic may have access to library text").
--
-- After this migration:
--   · the two tables are readable by the platform admin only (the sources
--     screen and the platform page), and by nobody else;
--   · the search answers only a caller who presents the service's key — a
--     secret held in Supabase Vault (`library_search_key`) and, on the other
--     side, in the web server's environment (LIBRARY_SEARCH_KEY). The server
--     asks on the practitioner's behalf; the practitioner's browser never has
--     the key, so the same call made by hand returns nothing.
--   · the clinic check stays inside the search: the key alone, without a
--     signed-in member, still finds nothing.
--
-- Why a key and not the service role: the web app holds no service-role key
-- (CLAUDE.md, "pages without a session"), and the key opens this one function
-- and nothing else. A wrong or missing key returns no rows rather than an
-- error, so a probe learns nothing about whether the key exists.
--
-- Setting the key (once, in the SQL editor), then copying it to Vercel:
--   select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'library_search_key');
--   select decrypted_secret from vault.decrypted_secrets where name = 'library_search_key';
-- ============================================================================

create extension if not exists supabase_vault;

-- Reading ------------------------------------------------------------------
drop policy if exists library_sources_members_read on public.library_sources;
drop policy if exists library_chunks_members_read on public.library_chunks;

drop policy if exists library_sources_admin_read on public.library_sources;
create policy library_sources_admin_read on public.library_sources
  for select to authenticated
  using ((select public.is_platform_admin()));

drop policy if exists library_chunks_admin_read on public.library_chunks;
create policy library_chunks_admin_read on public.library_chunks
  for select to authenticated
  using ((select public.is_platform_admin()));

-- The key --------------------------------------------------------------------
-- Compared inside the database, so the stored secret never leaves it. Nobody
-- signed in may call this directly: it is used by the search, which runs as
-- its owner.
create or replace function public.library_key_ok(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_key, '') <> ''
     and exists (
       select 1 from vault.decrypted_secrets s
        where s.name = 'library_search_key' and s.decrypted_secret = p_key
     );
$$;

revoke all on function public.library_key_ok(text) from public;
revoke execute on function public.library_key_ok(text) from anon, authenticated;

-- The search -----------------------------------------------------------------
-- The body is migration 59's, unchanged but for the key: the same two halves,
-- the same limits (every branch shares the eight-second budget, and none may
-- be added untimed). The key is checked once per half, as an init plan.
drop function if exists public.library_search(extensions.vector, text, integer);

create or replace function public.library_search(p_embedding extensions.vector(1024), p_query text, p_limit integer default 20, p_key text default null)
returns table (via text, chunk_id uuid, source_id uuid, title text, url text, kind text, page integer, heading text, content text, score real)
language sql
stable
security definer
set search_path = public, extensions
as $$
  (
    select 'vector'::text, n.id, s.id, s.title, s.url, s.kind, n.page, n.heading, n.content, (1 - n.distance)::real
      from (
        select c.id, c.source_id, c.page, c.heading, c.content,
               ((c.embedding::extensions.halfvec(1024)) operator(extensions.<=>) (p_embedding::extensions.halfvec(1024))) as distance
          from public.library_chunks c
         where (select public.current_clinic_id()) is not null
           and (select public.library_key_ok(p_key))
         order by (c.embedding::extensions.halfvec(1024)) operator(extensions.<=>) (p_embedding::extensions.halfvec(1024))
         limit greatest(p_limit, 1) * 3
      ) n
      join public.library_sources s on s.id = n.source_id
     where s.status = 'active'
     order by n.distance
     limit p_limit
  )
  union all
  (
    select 'text'::text, c.id, s.id, s.title, s.url, s.kind, c.page, c.heading, c.content,
           pg_catalog.ts_rank(c.tsv, pg_catalog.websearch_to_tsquery('english', p_query))::real
      from public.library_chunks c
      join public.library_sources s on s.id = c.source_id
     where (select public.current_clinic_id()) is not null
       and (select public.library_key_ok(p_key))
       and s.status = 'active'
       and coalesce(p_query, '') <> ''
       and c.tsv @@ pg_catalog.websearch_to_tsquery('english', p_query)
     order by pg_catalog.ts_rank(c.tsv, pg_catalog.websearch_to_tsquery('english', p_query)) desc
     limit p_limit
  );
$$;

revoke all on function public.library_search(extensions.vector, text, integer, text) from public;
revoke execute on function public.library_search(extensions.vector, text, integer, text) from anon;
grant execute on function public.library_search(extensions.vector, text, integer, text) to authenticated;
