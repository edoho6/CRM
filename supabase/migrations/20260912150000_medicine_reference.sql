-- ============================================================================
-- 42 · Western medicine reference: conditions, symptoms, drugs
-- ============================================================================
-- An encyclopedia the clinic can open beside the herbs, formulas and points:
-- what a condition is, what its symptoms are, which drugs treat it, what a
-- drug is for, how it is taken and what it does on the side — every entry
-- linked to the entries it names.
--
-- Two things decide the shape of these tables.
--
-- They belong to no clinic. A condition is the same condition in every
-- practice, so the rows are shared the way the shop prices are (migration
-- 35): readable by any signed-in clinic member, writable by nobody from the
-- app. The corpus is compiled outside the database (scripts/medicine) from
-- sources whose licences allow it — Wikidata (CC0), the NHS website (Open
-- Government Licence), MedlinePlus (public domain), FDA labelling (CC0) —
-- and loaded through `med_import`, which only a platform admin may call.
--
-- Two layers of text. `quotes` holds passages from the sources word for
-- word, in English, with the source, its address, its own review date and
-- its licence — doses and side effects live there and nowhere else, because
-- a dose is not something to paraphrase. `sections`/`summary_*` hold the
-- entry itself, in Hebrew and English, written from those sources and marked
-- with how it was written (`hebrew_meta`). `status` says how far the entry
-- has been checked: one source, two sources that agree, or a person.
-- ============================================================================

create table if not exists public.med_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('condition', 'symptom', 'drug', 'lab_test')),
  -- The address of the entry; from the English name, unique for good.
  slug text not null unique,
  -- The identity every source is joined on. Null only for an entry with no
  -- Wikidata item, which the compiler avoids.
  wikidata_id text unique,
  name_en text not null,
  name_he text,
  aliases_en text[] not null default '{}',
  -- Also the Israeli trade names of a drug, once those are loaded.
  aliases_he text[] not null default '{}',
  -- {icd10, icd10cm, mesh, doid, atc, rxcui, medlineplus, nhs, orpha}
  identifiers jsonb not null default '{}'::jsonb,
  summary_en text,
  summary_he text,
  -- {he: {...}, en: {...}}; the keys depend on the kind — see the compiler.
  sections jsonb not null default '{}'::jsonb,
  -- [{source, field, text, url, source_reviewed_at, retrieved_at, licence}]
  quotes jsonb not null default '[]'::jsonb,
  -- [{source, url, title, licence, retrieved_at, role}]
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'cross_checked', 'verified')),
  -- {sources: n, agree: [...], conflicts: [...]}
  cross_check jsonb,
  -- {model, generated_at, basis: [...]} — how the Hebrew was written.
  hebrew_meta jsonb,
  -- Set by the weekly source refresh when a quoted source changed after the
  -- Hebrew was written; cleared by the next Hebrew run.
  hebrew_stale boolean not null default false,
  -- The picture, as the herb manifest describes one: {file, title, source,
  -- author, page, licence, licenceUrl, creditRequired}. Null: no picture.
  image jsonb,
  -- What is registered in Israel for this substance: product names in
  -- Hebrew, registration numbers, forms, basket and prescription status,
  -- and the address of the Ministry's own leaflet. Facts and links only —
  -- the leaflets belong to the manufacturers and are never copied.
  israel jsonb,
  -- Every name and alias in one lower-cased string, kept by trigger, so the
  -- catalogue search is one trigram index rather than five.
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists med_entries_search_trgm_idx
  on public.med_entries using gin (search_text gin_trgm_ops);
create index if not exists med_entries_kind_name_idx
  on public.med_entries (kind, name_he, name_en);
create index if not exists med_entries_status_idx
  on public.med_entries (status);

comment on table public.med_entries is
  'Western medicine reference — conditions, symptoms and drugs — shared by every clinic. Compiled by scripts/medicine from openly licensed sources; loaded only through med_import (platform admin).';

create or replace function public.med_entries_search_text()
returns trigger
language plpgsql
as $$
begin
  new.search_text := lower(concat_ws(' ',
    new.name_en, new.name_he,
    array_to_string(new.aliases_en, ' '), array_to_string(new.aliases_he, ' '),
    new.identifiers ->> 'icd10', new.identifiers ->> 'atc'));
  return new;
end;
$$;

drop trigger if exists med_entries_search_text on public.med_entries;
create trigger med_entries_search_text
  before insert or update on public.med_entries
  for each row execute function public.med_entries_search_text();

drop trigger if exists med_entries_set_updated_at on public.med_entries;
create trigger med_entries_set_updated_at
  before update on public.med_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- The links between entries: a drug treats a condition, a symptom belongs
-- to a condition, a symptom is a side effect of a drug. `source` says which
-- source made the claim, so a link from Wikidata and a link from a label's
-- own text can be told apart on the screen.
-- ---------------------------------------------------------------------------
create table if not exists public.med_links (
  from_id uuid not null references public.med_entries(id) on delete cascade,
  to_id uuid not null references public.med_entries(id) on delete cascade,
  relation text not null check (relation in ('treats', 'symptom_of', 'side_effect', 'class', 'diagnoses', 'related')),
  source text not null,
  primary key (from_id, to_id, relation)
);

create index if not exists med_links_to_idx on public.med_links (to_id, relation);

-- ---------------------------------------------------------------------------
-- Who may read: any signed-in member of a clinic. Portal patients and the
-- public see nothing. There is no write policy at all.
-- ---------------------------------------------------------------------------
alter table public.med_entries enable row level security;
alter table public.med_links enable row level security;

drop policy if exists med_entries_members_read on public.med_entries;
create policy med_entries_members_read on public.med_entries
  for select using (public.current_clinic_id() is not null);

drop policy if exists med_links_members_read on public.med_links;
create policy med_links_members_read on public.med_links
  for select using (public.current_clinic_id() is not null);

-- ---------------------------------------------------------------------------
-- Loading the corpus. Entries are matched on their Wikidata item (or the
-- slug when there is none) and replaced whole — except a status a person
-- set: a verification outlives an import. The imported entries' outgoing
-- links are replaced as a set; a link to an entry the corpus does not have
-- is skipped and counted, not invented.
-- ---------------------------------------------------------------------------
create or replace function public.med_import(p_entries jsonb, p_links jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e jsonb;
  l jsonb;
  v_id uuid;
  v_existing public.med_entries%rowtype;
  v_status text;
  v_entries integer := 0;
  v_links integer := 0;
  v_skipped integer := 0;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_typeof(p_links) <> 'array' then
    raise exception 'bad_payload' using errcode = '22023';
  end if;

  for e in select * from jsonb_array_elements(p_entries) loop
    if coalesce(e ->> 'kind', '') not in ('condition', 'symptom', 'drug', 'lab_test')
       or coalesce(e ->> 'slug', '') = ''
       or coalesce(e ->> 'name_en', '') = '' then
      raise exception 'bad_entry: %', left(e::text, 160) using errcode = '22023';
    end if;
    v_status := coalesce(e ->> 'status', 'draft');
    if v_status not in ('draft', 'cross_checked', 'verified') then
      v_status := 'draft';
    end if;

    select * into v_existing
      from public.med_entries m
     where (e ->> 'wikidata_id' is not null and m.wikidata_id = e ->> 'wikidata_id')
        or m.slug = e ->> 'slug'
     limit 1;

    if found then
      update public.med_entries
         set kind = e ->> 'kind',
             slug = e ->> 'slug',
             wikidata_id = coalesce(e ->> 'wikidata_id', wikidata_id),
             name_en = e ->> 'name_en',
             name_he = e ->> 'name_he',
             aliases_en = array(select jsonb_array_elements_text(coalesce(e -> 'aliases_en', '[]'::jsonb))),
             aliases_he = array(select jsonb_array_elements_text(coalesce(e -> 'aliases_he', '[]'::jsonb))),
             identifiers = coalesce(e -> 'identifiers', '{}'::jsonb),
             summary_en = e ->> 'summary_en',
             summary_he = e ->> 'summary_he',
             sections = coalesce(e -> 'sections', '{}'::jsonb),
             quotes = coalesce(e -> 'quotes', '[]'::jsonb),
             sources = coalesce(e -> 'sources', '[]'::jsonb),
             status = case when v_existing.status = 'verified' then 'verified' else v_status end,
             cross_check = e -> 'cross_check',
             hebrew_meta = e -> 'hebrew_meta',
             hebrew_stale = false,
             image = e -> 'image',
             israel = e -> 'israel'
       where id = v_existing.id
       returning id into v_id;
    else
      insert into public.med_entries
        (kind, slug, wikidata_id, name_en, name_he, aliases_en, aliases_he, identifiers,
         summary_en, summary_he, sections, quotes, sources, status, cross_check, hebrew_meta, image, israel)
      values
        (e ->> 'kind', e ->> 'slug', e ->> 'wikidata_id', e ->> 'name_en', e ->> 'name_he',
         array(select jsonb_array_elements_text(coalesce(e -> 'aliases_en', '[]'::jsonb))),
         array(select jsonb_array_elements_text(coalesce(e -> 'aliases_he', '[]'::jsonb))),
         coalesce(e -> 'identifiers', '{}'::jsonb),
         e ->> 'summary_en', e ->> 'summary_he',
         coalesce(e -> 'sections', '{}'::jsonb), coalesce(e -> 'quotes', '[]'::jsonb), coalesce(e -> 'sources', '[]'::jsonb),
         v_status, e -> 'cross_check', e -> 'hebrew_meta', e -> 'image', e -> 'israel')
      returning id into v_id;
    end if;
    v_entries := v_entries + 1;
  end loop;

  -- The imported entries' outgoing links, replaced as a set.
  delete from public.med_links ml
   where ml.from_id in (
     select m.id
       from public.med_entries m
       join jsonb_array_elements(p_entries) x
         on (x ->> 'wikidata_id' is not null and m.wikidata_id = x ->> 'wikidata_id')
         or m.slug = x ->> 'slug');

  for l in select * from jsonb_array_elements(p_links) loop
    if coalesce(l ->> 'relation', '') not in ('treats', 'symptom_of', 'side_effect', 'class', 'diagnoses', 'related') then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    insert into public.med_links (from_id, to_id, relation, source)
    select f.id, t.id, l ->> 'relation', coalesce(l ->> 'source', 'import')
      from public.med_entries f, public.med_entries t
     where (f.wikidata_id = l ->> 'from' or f.slug = l ->> 'from')
       and (t.wikidata_id = l ->> 'to' or t.slug = l ->> 'to')
       and f.id <> t.id
     limit 1
    on conflict do nothing;
    if found then
      v_links := v_links + 1;
    else
      v_skipped := v_skipped + 1;
    end if;
  end loop;

  return jsonb_build_object('entries', v_entries, 'links', v_links, 'skipped_links', v_skipped);
end;
$$;

revoke all on function public.med_import(jsonb, jsonb) from public;
revoke execute on function public.med_import(jsonb, jsonb) from anon;
grant execute on function public.med_import(jsonb, jsonb) to authenticated;

comment on function public.med_import(jsonb, jsonb) is
  'Loads or refreshes the Western medicine corpus compiled by scripts/medicine. Platform admin only. A status a person set (verified) outlives an import.';

-- ---------------------------------------------------------------------------
-- A person's verdict on an entry. The button waits for a reviewer; the
-- function is here so the corpus can carry the answer from day one.
-- ---------------------------------------------------------------------------
create or replace function public.med_set_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status not in ('draft', 'cross_checked', 'verified') then
    raise exception 'bad_status' using errcode = '22023';
  end if;
  update public.med_entries set status = p_status where id = p_id;
end;
$$;

revoke all on function public.med_set_status(uuid, text) from public;
revoke execute on function public.med_set_status(uuid, text) from anon;
grant execute on function public.med_set_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The weekly source refresh (an Edge Function, service role) brings the
-- quoted passages up to date — the NHS licence asks for that within seven
-- days — and marks the Hebrew stale where its source moved under it.
-- [{wikidata_id, quotes, sources, changed}]
-- ---------------------------------------------------------------------------
create or replace function public.med_refresh_quotes(p_updates jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  u jsonb;
  v_count integer := 0;
begin
  if jsonb_typeof(p_updates) <> 'array' then
    raise exception 'bad_payload' using errcode = '22023';
  end if;
  for u in select * from jsonb_array_elements(p_updates) loop
    update public.med_entries
       set quotes = coalesce(u -> 'quotes', quotes),
           sources = coalesce(u -> 'sources', sources),
           hebrew_stale = hebrew_stale or coalesce((u ->> 'changed')::boolean, false)
     where wikidata_id = u ->> 'wikidata_id';
    if found then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.med_refresh_quotes(jsonb) from public;
revoke execute on function public.med_refresh_quotes(jsonb) from anon, authenticated;
grant execute on function public.med_refresh_quotes(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- The corpus at a glance, for the platform page: counts by kind and status,
-- and when it was last loaded. Reads as the caller.
-- ---------------------------------------------------------------------------
create or replace function public.med_stats()
returns table (kind text, status text, entries bigint, last_updated timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select m.kind, m.status, count(*), max(m.updated_at)
    from public.med_entries m
   group by m.kind, m.status
   order by m.kind, m.status;
$$;

revoke all on function public.med_stats() from public;
grant execute on function public.med_stats() to authenticated;
