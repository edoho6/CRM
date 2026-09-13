-- Migration 47 — the library's websites, refreshed on a schedule.
--
-- A page loaded from a website is looked at again after a week by the
-- refresh-library Edge Function, which runs inside Supabase with the
-- service role (the web app has no such identity, by design). Two things
-- change here: the source row keeps the page's validators (ETag and
-- Last-Modified), so the site can answer "not modified" and be spared the
-- page; and the loading functions accept the service role beside the
-- platform admin — a clinic member is still refused, as the isolation test
-- checks. New pages are still the crawl's job, run by hand.

alter table public.library_sources add column if not exists etag text;
alter table public.library_sources add column if not exists last_modified text;

-- Who may load: the platform admin (the scripts, signed in as a person)
-- or the service role (the scheduled function, whose key Supabase holds).
create or replace function public.library_may_load()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.is_platform_admin() or auth.role() = 'service_role';
$$;
revoke all on function public.library_may_load() from public;

create or replace function public.library_upsert_source(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.library_may_load() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(p ->> 'locator', '') = '' or coalesce(p ->> 'title', '') = '' then
    raise exception 'bad_payload' using errcode = '22023';
  end if;
  insert into public.library_sources (kind, locator, title, url, sha256, bytes, pages, language, licence_note, fetched_at, status, etag, last_modified)
  values (
    coalesce(p ->> 'kind', 'file'), p ->> 'locator', p ->> 'title', p ->> 'url', p ->> 'sha256',
    (p ->> 'bytes')::integer, (p ->> 'pages')::integer, p ->> 'language', p ->> 'licence_note',
    coalesce((p ->> 'fetched_at')::timestamptz, now()), 'active', p ->> 'etag', p ->> 'last_modified'
  )
  on conflict (locator) do update
    set title = excluded.title,
        url = excluded.url,
        sha256 = excluded.sha256,
        bytes = excluded.bytes,
        pages = excluded.pages,
        language = excluded.language,
        licence_note = excluded.licence_note,
        fetched_at = excluded.fetched_at,
        status = 'active',
        etag = excluded.etag,
        last_modified = excluded.last_modified,
        updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.library_clear_chunks(p_source uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.library_may_load() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.library_chunks where source_id = p_source;
end;
$$;

create or replace function public.library_add_chunks(p_source uuid, p_chunks jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c jsonb;
  v_count integer := 0;
begin
  if not public.library_may_load() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_chunks) <> 'array' then
    raise exception 'bad_payload' using errcode = '22023';
  end if;
  for c in select * from jsonb_array_elements(p_chunks) loop
    insert into public.library_chunks (source_id, ordinal, page, heading, content, tokens, embedding)
    values (
      p_source, (c ->> 'ordinal')::integer, (c ->> 'page')::integer, c ->> 'heading', c ->> 'content',
      (c ->> 'tokens')::integer, (c ->> 'embedding')::extensions.vector(1024)
    )
    on conflict (source_id, ordinal) do update
      set page = excluded.page, heading = excluded.heading, content = excluded.content,
          tokens = excluded.tokens, embedding = excluded.embedding;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- A page that answered "not modified", or whose text is the same: only the
-- time and the validators move.
create or replace function public.library_touch_source(p_source uuid, p_etag text, p_last_modified text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.library_may_load() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.library_sources
     set fetched_at = now(), etag = p_etag, last_modified = p_last_modified, updated_at = now()
   where id = p_source;
end;
$$;

revoke all on function public.library_touch_source(uuid, text, text) from public;
revoke execute on function public.library_touch_source(uuid, text, text) from anon;
grant execute on function public.library_touch_source(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The schedule. Once pg_cron and pg_net are enabled (Database → Extensions)
-- and the function deployed (supabase functions deploy refresh-library
-- --no-verify-jwt) with its secrets set, paste and run:
--
--   select cron.schedule(
--     'refresh-library', '17 * * * *',
--     $job$
--       select net.http_post(
--         url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/refresh-library',
--         headers := jsonb_build_object('Content-Type', 'application/json',
--                                       'x-library-refresh-secret', 'THE-SAME-SECRET'),
--         body := '{"trigger":"cron"}'::jsonb,
--         timeout_milliseconds := 90000
--       )
--     $job$
--   );
--
-- Every hour it looks at up to forty pages that have gone a week without a
-- look; a library of a few hundred pages is fully revisited every week.
-- ---------------------------------------------------------------------------
