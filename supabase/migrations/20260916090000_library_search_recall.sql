-- Migration 58 — the library's word search stops demanding every term at once.
--
-- Measured against the real library (8,281 sources, about 74,000 passages)
-- with scripts/library/probe.mjs: the word half of the search returned
-- nothing at all for most questions. `websearch_to_tsquery` joins terms
-- with AND, so the planner's "Xiao Yao San formula composition ingredients"
-- asked for one passage holding all four words, which almost never exists.
-- Half the search — the half meant to catch a plain factual question —
-- was contributing nothing.
--
-- It now tries the strict query first, and only when that finds nothing
-- falls back to the same terms joined by OR, ranked by how well each
-- passage matches and capped at a third of the strict query's limit: a
-- passage found by words alone passes the caller's evidence gate without a
-- similarity score, so a loose match must never be able to crowd out the
-- passages found by meaning.
--
-- Not done here: raising `hnsw.ef_search` (the vector half asks its graph
-- for 60 rows while the default candidate list is 40, which can lose the
-- best passage). Supabase's managed role may not set that parameter —
-- `ERROR 42501: permission denied to set parameter "hnsw.ef_search"` — so
-- the vector half is left as it is. It was an inference, not a measurement;
-- retrieval measured fast and accurate as it stands, and if it ever proves
-- to be the weak link, a reranking pass over more candidates is the lever
-- that does not depend on the platform's permissions.
--
-- The function's contract is unchanged: same arguments, same columns, same
-- membership check inside it, same grants. Every column in every query
-- below is table-qualified, because the names declared in `returns table`
-- are variables in a plpgsql body and an unqualified column of the same
-- name would be ambiguous.
create or replace function public.library_search(p_embedding extensions.vector(1024), p_query text, p_limit integer default 20)
returns table (via text, chunk_id uuid, source_id uuid, title text, url text, kind text, page integer, heading text, content text, score real)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  -- The strict reading of the search words, and the same words with any one
  -- of them enough. The loose one is built from the strict one's own text,
  -- so the terms are normalised exactly once.
  v_strict tsquery := case when coalesce(p_query, '') = '' then null else pg_catalog.websearch_to_tsquery('english', p_query) end;
  v_loose tsquery := null;
  v_rows integer := 0;
begin
  return query
    select 'vector'::text, n.id, s.id, s.title, s.url, s.kind, n.page, n.heading, n.content, (1 - n.distance)::real
      from (
        select c.id, c.source_id, c.page, c.heading, c.content,
               ((c.embedding::extensions.halfvec(1024)) operator(extensions.<=>) (p_embedding::extensions.halfvec(1024))) as distance
          from public.library_chunks c
         where (select public.current_clinic_id()) is not null
         order by (c.embedding::extensions.halfvec(1024)) operator(extensions.<=>) (p_embedding::extensions.halfvec(1024))
         limit greatest(p_limit, 1) * 3
      ) n
      join public.library_sources s on s.id = n.source_id
     where s.status = 'active'
     order by n.distance
     limit p_limit;

  if v_strict is null then
    return;
  end if;

  return query
    select 'text'::text, c.id, s.id, s.title, s.url, s.kind, c.page, c.heading, c.content,
           pg_catalog.ts_rank(c.tsv, v_strict)::real
      from public.library_chunks c
      join public.library_sources s on s.id = c.source_id
     where (select public.current_clinic_id()) is not null
       and s.status = 'active'
       and c.tsv @@ v_strict
     order by pg_catalog.ts_rank(c.tsv, v_strict) desc
     limit p_limit;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    return;
  end if;

  -- Nothing held every term. The same terms, any one of them enough — a
  -- short list, because this is the weakest evidence the search offers.
  v_loose := replace(v_strict::text, '&', '|')::tsquery;
  return query
    select 'text'::text, c.id, s.id, s.title, s.url, s.kind, c.page, c.heading, c.content,
           pg_catalog.ts_rank(c.tsv, v_loose)::real
      from public.library_chunks c
      join public.library_sources s on s.id = c.source_id
     where (select public.current_clinic_id()) is not null
       and s.status = 'active'
       and c.tsv @@ v_loose
     order by pg_catalog.ts_rank(c.tsv, v_loose) desc
     limit greatest(p_limit / 3, 5);
end;
$$;

revoke all on function public.library_search(extensions.vector, text, integer) from public;
revoke execute on function public.library_search(extensions.vector, text, integer) from anon;
grant execute on function public.library_search(extensions.vector, text, integer) to authenticated;
