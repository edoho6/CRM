-- Migration 43 — what the Western medicine reference gained after the first
-- version: the Israeli layer (the products registered here), a fourth kind of
-- entry (a lab test) and the relation that ties a test to a condition.
--
-- Only needed where 34_medicine_to_run.sql was run before these existed;
-- running it twice is harmless.
alter table public.med_entries add column if not exists israel jsonb;

alter table public.med_entries drop constraint if exists med_entries_kind_check;
alter table public.med_entries add constraint med_entries_kind_check
  check (kind in ('condition', 'symptom', 'drug', 'lab_test'));

alter table public.med_links drop constraint if exists med_links_relation_check;
alter table public.med_links add constraint med_links_relation_check
  check (relation in ('treats', 'symptom_of', 'side_effect', 'class', 'diagnoses', 'related'));

-- med_import writes the new column and accepts the new kind, so it is replaced in full.
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
