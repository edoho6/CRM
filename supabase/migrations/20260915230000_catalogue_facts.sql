-- ============================================================================
-- The reference catalogue written from facts: two languages, the sources,
-- and a refresh that replaces what nobody has confirmed
-- ============================================================================
-- The bundled catalogue (migration 56) shipped with clinical text written
-- during development, in English, flagged for review. From here on that text
-- is rebuilt from facts gathered from two professional references (Bara's
-- indexes and American Dragon), said in our own words, in Hebrew and in
-- English — scripts/catalogue/README.md describes the pipeline. Three
-- things the database needs for that:
--
--   · room for the second language and for the sources: text_en (the same
--     fields, in English) and sources (which pages the facts came from) on
--     the shared catalogue and on the clinic tables, and a Hebrew name on a
--     herb, which the Israeli source gives and the catalogue had nowhere to
--     put;
--   · a way in for the generated dataset: catalogue_import, platform admin
--     only, replacing text and filling names — the SQL-editor seed functions
--     stay as they are for the bundled files;
--   · a way to bring a clinic up to date: clinic_refresh_catalogue_text.
--     The loader (56) fills only empty fields, so a clinic that already holds
--     the old text would never see the new. The refresh overwrites rows that
--     nobody confirmed — needs_review still true and no reviewed_at — and
--     leaves every confirmed or hand-edited row alone.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1 · The shared catalogue
-- ---------------------------------------------------------------------------

alter table public.catalogue_herbs
  add column if not exists hebrew text,
  add column if not exists text_en jsonb not null default '{}'::jsonb,
  add column if not exists sources jsonb not null default '[]'::jsonb;

alter table public.catalogue_formulas
  add column if not exists text_en jsonb not null default '{}'::jsonb,
  add column if not exists sources jsonb not null default '[]'::jsonb;

alter table public.catalogue_points
  add column if not exists text_en jsonb not null default '{}'::jsonb,
  add column if not exists sources jsonb not null default '[]'::jsonb;

comment on column public.catalogue_herbs.text_en is
  'The clinical fields in English: {"functions","indications","cautions","dosage_notes"}. The main columns hold the Hebrew.';
comment on column public.catalogue_herbs.sources is
  'Where the facts came from: [{"name":"bara"|"americandragon","url":…,"title":…}]. The text itself is ours.';

-- ---------------------------------------------------------------------------
-- 2 · The same room on the clinic tables
-- ---------------------------------------------------------------------------

alter table public.herbs
  add column if not exists text_en jsonb not null default '{}'::jsonb,
  add column if not exists sources jsonb not null default '[]'::jsonb;

alter table public.herb_formulas
  add column if not exists text_en jsonb not null default '{}'::jsonb,
  add column if not exists sources jsonb not null default '[]'::jsonb;

alter table public.acupuncture_points
  add column if not exists text_en jsonb not null default '{}'::jsonb,
  add column if not exists sources jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- 3 · The way in for the generated dataset
-- ---------------------------------------------------------------------------
-- One call per kind with a JSON array of entries, as scripts/catalogue/
-- build.mjs writes them. Text fields are replaced (an empty string means the
-- sources said nothing, and nothing is what stays); names and structured
-- fields fill in where the catalogue had none, so a value the bundled seed
-- knew and the sources do not is kept. A point the catalogue does not hold
-- is counted, not invented — the codes are a closed set.

create or replace function public.catalogue_import(p_kind text, p_entries jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e jsonb;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_unknown integer := 0;
  v_key text;
  v_tastes text[];
  v_channels text[];
  v_items jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_kind not in ('herbs', 'formulas', 'points') then
    raise exception 'unknown_kind: %' , p_kind using errcode = '22023';
  end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then
    raise exception 'entries_must_be_an_array' using errcode = '22023';
  end if;

  for e in select * from jsonb_array_elements(p_entries) loop
    if p_kind = 'herbs' then
      v_key := btrim(e ->> 'pinyin');
      if v_key is null or v_key = '' then continue; end if;
      select coalesce(array_agg(x), '{}') into v_tastes from jsonb_array_elements_text(coalesce(e -> 'tastes', '[]'::jsonb)) as x;
      select coalesce(array_agg(x), '{}') into v_channels from jsonb_array_elements_text(coalesce(e -> 'channels', '[]'::jsonb)) as x;
      update public.catalogue_herbs c
         set chinese = coalesce(nullif(e ->> 'chinese', ''), c.chinese),
             botanical = coalesce(nullif(e ->> 'botanical', ''), c.botanical),
             pharmaceutical = coalesce(nullif(e ->> 'pharmaceutical', ''), c.pharmaceutical),
             english = coalesce(nullif(e ->> 'english', ''), c.english),
             hebrew = coalesce(nullif(e ->> 'hebrew', ''), c.hebrew),
             tcm_category = coalesce(nullif(e ->> 'tcm_category', ''), c.tcm_category),
             temperature = coalesce(nullif(e ->> 'temperature', ''), c.temperature),
             tastes = case when cardinality(v_tastes) > 0 then v_tastes else c.tastes end,
             channels = case when cardinality(v_channels) > 0 then v_channels else c.channels end,
             -- A text field changes only when the entry carries the key. An
             -- import of structured fields alone (no writing step yet) must
             -- leave the clinical text exactly as it is, and an empty string
             -- means the sources said nothing, which is a real answer.
             actions = case when e ? 'actions' then nullif(e ->> 'actions', '') else c.actions end,
             indications = case when e ? 'indications' then nullif(e ->> 'indications', '') else c.indications end,
             cautions = case when e ? 'cautions' then nullif(e ->> 'cautions', '') else c.cautions end,
             dose_min = coalesce((e ->> 'dose_min')::numeric, c.dose_min),
             dose_max = coalesce((e ->> 'dose_max')::numeric, c.dose_max),
             dosage_notes = case when e ? 'dosage_notes' then nullif(e ->> 'dosage_notes', '') else c.dosage_notes end,
             text_en = case when e ? 'text_en' then coalesce(e -> 'text_en', '{}'::jsonb) else c.text_en end,
             sources = coalesce(e -> 'sources', c.sources),
             source = coalesce(nullif(e ->> 'source', ''), 'facts'),
             updated_at = now()
       where lower(c.pinyin) = lower(v_key);
      if found then
        v_updated := v_updated + 1;
      else
        insert into public.catalogue_herbs (
          pinyin, chinese, botanical, pharmaceutical, english, hebrew, tcm_category, temperature, tastes, channels,
          actions, indications, cautions, dose_min, dose_max, dosage_notes, text_en, sources, source
        ) values (
          v_key, nullif(e ->> 'chinese', ''), nullif(e ->> 'botanical', ''), nullif(e ->> 'pharmaceutical', ''),
          nullif(e ->> 'english', ''), nullif(e ->> 'hebrew', ''), nullif(e ->> 'tcm_category', ''), nullif(e ->> 'temperature', ''),
          v_tastes, v_channels, nullif(e ->> 'actions', ''), nullif(e ->> 'indications', ''), nullif(e ->> 'cautions', ''),
          (e ->> 'dose_min')::numeric, (e ->> 'dose_max')::numeric, nullif(e ->> 'dosage_notes', ''),
          coalesce(e -> 'text_en', '{}'::jsonb), coalesce(e -> 'sources', '[]'::jsonb),
          coalesce(nullif(e ->> 'source', ''), 'facts')
        );
        v_inserted := v_inserted + 1;
      end if;

    elsif p_kind = 'formulas' then
      v_key := btrim(e ->> 'pinyin');
      if v_key is null or v_key = '' then continue; end if;
      v_items := case when jsonb_typeof(e -> 'items') = 'array' and jsonb_array_length(e -> 'items') > 0 then e -> 'items' else null end;
      update public.catalogue_formulas c
         set chinese = coalesce(nullif(e ->> 'chinese', ''), c.chinese),
             english = coalesce(nullif(e ->> 'english', ''), c.english),
             tcm_category = coalesce(nullif(e ->> 'tcm_category', ''), c.tcm_category),
             source_text = coalesce(nullif(e ->> 'source_text', ''), c.source_text),
             actions = case when e ? 'actions' then nullif(e ->> 'actions', '') else c.actions end,
             indications = case when e ? 'indications' then nullif(e ->> 'indications', '') else c.indications end,
             contraindications = case when e ? 'contraindications' then nullif(e ->> 'contraindications', '') else c.contraindications end,
             dosage_notes = coalesce(nullif(e ->> 'dosage_notes', ''), c.dosage_notes),
             items = coalesce(v_items, c.items),
             text_en = case when e ? 'text_en' then coalesce(e -> 'text_en', '{}'::jsonb) else c.text_en end,
             sources = coalesce(e -> 'sources', c.sources),
             source = coalesce(nullif(e ->> 'source', ''), 'facts'),
             updated_at = now()
       where lower(c.pinyin) = lower(v_key);
      if found then
        v_updated := v_updated + 1;
      else
        insert into public.catalogue_formulas (
          pinyin, chinese, english, tcm_category, source_text, actions, indications, contraindications,
          dosage_notes, items, text_en, sources, source
        ) values (
          v_key, nullif(e ->> 'chinese', ''), nullif(e ->> 'english', ''), nullif(e ->> 'tcm_category', ''),
          nullif(e ->> 'source_text', ''), nullif(e ->> 'actions', ''), nullif(e ->> 'indications', ''),
          nullif(e ->> 'contraindications', ''), nullif(e ->> 'dosage_notes', ''), coalesce(v_items, '[]'::jsonb),
          coalesce(e -> 'text_en', '{}'::jsonb), coalesce(e -> 'sources', '[]'::jsonb), coalesce(nullif(e ->> 'source', ''), 'facts')
        );
        v_inserted := v_inserted + 1;
      end if;

    else
      v_key := upper(btrim(e ->> 'code'));
      if v_key is null or v_key = '' then continue; end if;
      update public.catalogue_points c
         set pinyin = coalesce(c.pinyin, nullif(e ->> 'pinyin', '')),
             english = coalesce(c.english, nullif(e ->> 'english', '')),
             location = case when e ? 'location' then nullif(e ->> 'location', '') else c.location end,
             actions = case when e ? 'actions' then nullif(e ->> 'actions', '') else c.actions end,
             indications = case when e ? 'indications' then nullif(e ->> 'indications', '') else c.indications end,
             needling = case when e ? 'needling' then nullif(e ->> 'needling', '') else c.needling end,
             cautions = case when e ? 'cautions' then nullif(e ->> 'cautions', '') else c.cautions end,
             text_en = case when e ? 'text_en' then coalesce(e -> 'text_en', '{}'::jsonb) else c.text_en end,
             sources = coalesce(e -> 'sources', c.sources),
             source = coalesce(nullif(e ->> 'source', ''), 'facts'),
             updated_at = now()
       where c.code = v_key;
      if found then
        v_updated := v_updated + 1;
      else
        v_unknown := v_unknown + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('kind', p_kind, 'inserted', v_inserted, 'updated', v_updated, 'unknown', v_unknown);
end;
$$;

revoke all on function public.catalogue_import(text, jsonb) from public;
grant execute on function public.catalogue_import(text, jsonb) to authenticated;

comment on function public.catalogue_import is
  'Loads the facts-based dataset into the shared catalogue: text replaced, names and structured fields filled. Platform admin only.';

-- ---------------------------------------------------------------------------
-- 4 · The loader learns the new columns
-- ---------------------------------------------------------------------------
-- The same function as migration 56, with hebrew_name, text_en and sources
-- carried across on insert and filled where empty.

create or replace function public.clinic_load_catalogue(p_clinic uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic uuid;
  v_herbs integer := 0;
  v_formulas integer := 0;
  v_items integer := 0;
  v_points integer := 0;
  v_result jsonb;
begin
  v_clinic := coalesce(p_clinic, public.current_clinic_id());
  if v_clinic is null then
    raise exception 'no_clinic' using errcode = '42501';
  end if;
  if not (public.is_clinic_member(v_clinic) or public.is_platform_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Filling a gap from the catalogue is not the practitioner confirming the row.
  perform set_config('herbalist.catalogue_loading', 'on', true);

  -- Herbs -------------------------------------------------------------------
  with inserted as (
    insert into public.herbs (
      clinic_id, pinyin_name, chinese_name, botanical_name, pharmaceutical_name, english_name, hebrew_name,
      tcm_category, temperature, tastes, channels, functions, indications, cautions,
      dosage_min_g, dosage_max_g, dosage_notes, text_en, sources,
      category, default_unit, needs_review, data_source
    )
    select v_clinic, c.pinyin, c.chinese, c.botanical, c.pharmaceutical, c.english, c.hebrew,
           c.tcm_category, c.temperature, c.tastes, c.channels, c.actions, c.indications, c.cautions,
           c.dose_min, c.dose_max, c.dosage_notes, c.text_en, c.sources,
           'granule', 'gram', true, c.source
    from public.catalogue_herbs c
    where not exists (
      select 1 from public.herbs h where h.clinic_id = v_clinic and lower(h.pinyin_name) = lower(c.pinyin)
    )
    returning 1
  )
  select count(*) into v_herbs from inserted;

  update public.herbs h
     set chinese_name        = coalesce(h.chinese_name, c.chinese),
         botanical_name      = coalesce(h.botanical_name, c.botanical),
         pharmaceutical_name = coalesce(h.pharmaceutical_name, c.pharmaceutical),
         english_name        = coalesce(h.english_name, c.english),
         hebrew_name         = coalesce(h.hebrew_name, c.hebrew),
         tcm_category        = coalesce(h.tcm_category, c.tcm_category),
         temperature         = coalesce(h.temperature, c.temperature),
         tastes              = case when cardinality(h.tastes) = 0 then c.tastes else h.tastes end,
         channels            = case when cardinality(h.channels) = 0 then c.channels else h.channels end,
         functions           = coalesce(h.functions, c.actions),
         indications         = coalesce(h.indications, c.indications),
         cautions            = coalesce(h.cautions, c.cautions),
         dosage_min_g        = coalesce(h.dosage_min_g, c.dose_min),
         dosage_max_g        = coalesce(h.dosage_max_g, c.dose_max),
         dosage_notes        = coalesce(h.dosage_notes, c.dosage_notes),
         text_en             = case when h.text_en = '{}'::jsonb then c.text_en else h.text_en end,
         sources             = case when h.sources = '[]'::jsonb then c.sources else h.sources end,
         data_source         = coalesce(h.data_source, c.source)
    from public.catalogue_herbs c
   where h.clinic_id = v_clinic
     and lower(h.pinyin_name) = lower(c.pinyin)
     and (h.chinese_name is null or h.botanical_name is null or h.pharmaceutical_name is null
          or h.english_name is null or h.hebrew_name is null or h.tcm_category is null or h.temperature is null
          or cardinality(h.tastes) = 0 or cardinality(h.channels) = 0 or h.functions is null
          or h.indications is null or h.cautions is null or h.dosage_min_g is null
          or h.dosage_max_g is null or h.dosage_notes is null or h.data_source is null
          or h.text_en = '{}'::jsonb or h.sources = '[]'::jsonb);

  -- Formulas ----------------------------------------------------------------
  with inserted as (
    insert into public.herb_formulas (
      clinic_id, name_pinyin, name_chinese, name_english, tcm_category, source_text,
      actions, indications, contraindications, dosage_notes, text_en, sources, category, needs_review, data_source
    )
    select v_clinic, c.pinyin, c.chinese, c.english, c.tcm_category, c.source_text,
           c.actions, c.indications, c.contraindications, c.dosage_notes, c.text_en, c.sources, 'classical', true, c.source
    from public.catalogue_formulas c
    where not exists (
      select 1 from public.herb_formulas f where f.clinic_id = v_clinic and lower(f.name_pinyin) = lower(c.pinyin)
    )
    returning 1
  )
  select count(*) into v_formulas from inserted;

  update public.herb_formulas f
     set name_chinese      = coalesce(f.name_chinese, c.chinese),
         name_english      = coalesce(f.name_english, c.english),
         tcm_category      = coalesce(f.tcm_category, c.tcm_category),
         source_text       = coalesce(f.source_text, c.source_text),
         actions           = coalesce(f.actions, c.actions),
         indications       = coalesce(f.indications, c.indications),
         contraindications = coalesce(f.contraindications, c.contraindications),
         dosage_notes      = coalesce(f.dosage_notes, c.dosage_notes),
         text_en           = case when f.text_en = '{}'::jsonb then c.text_en else f.text_en end,
         sources           = case when f.sources = '[]'::jsonb then c.sources else f.sources end,
         data_source       = coalesce(f.data_source, c.source)
    from public.catalogue_formulas c
   where f.clinic_id = v_clinic
     and lower(f.name_pinyin) = lower(c.pinyin)
     and (f.name_chinese is null or f.name_english is null or f.tcm_category is null
          or f.source_text is null or f.actions is null or f.indications is null
          or f.contraindications is null or f.dosage_notes is null or f.data_source is null
          or f.text_en = '{}'::jsonb or f.sources = '[]'::jsonb);

  -- An ingredient the clinic's herb list lacks becomes a review-flagged stub,
  -- exactly as the per-row importer did, so no formula loses a line.
  insert into public.herbs (clinic_id, pinyin_name, category, default_unit, needs_review, data_source)
  select distinct on (lower(e.item ->> 'h'))
         v_clinic, btrim(e.item ->> 'h'), 'granule', 'gram', true, 'formula-stub'
    from public.catalogue_formulas c
    cross join lateral jsonb_array_elements(c.items) as e(item)
   where nullif(btrim(e.item ->> 'h'), '') is not null
     and not exists (
       select 1 from public.herbs h where h.clinic_id = v_clinic and lower(h.pinyin_name) = lower(e.item ->> 'h')
     );

  with inserted as (
    insert into public.herb_formula_items (clinic_id, formula_id, herb_id, dosage, unit, sequence, notes)
    select v_clinic, f.id, h.id, coalesce((e.item ->> 'd')::numeric, 1), 'gram', e.ord::integer, e.item ->> 'n'
      from public.catalogue_formulas c
      join public.herb_formulas f
        on f.clinic_id = v_clinic and lower(f.name_pinyin) = lower(c.pinyin)
      cross join lateral jsonb_array_elements(c.items) with ordinality as e(item, ord)
      join public.herbs h
        on h.clinic_id = v_clinic and lower(h.pinyin_name) = lower(e.item ->> 'h')
    on conflict (formula_id, herb_id) do nothing
    returning 1
  )
  select count(*) into v_items from inserted;

  -- Points ------------------------------------------------------------------
  with inserted as (
    insert into public.acupuncture_points (
      clinic_id, code, channel, point_number, pinyin_name, chinese_name, english_name,
      body_view, x, y, bilateral, default_region, body_area, point_categories,
      location, actions, indications, needling, cautions, text_en, sources, needs_review, data_source
    )
    select v_clinic, c.code, c.channel, c.point_number, c.pinyin, c.chinese, c.english,
           c.body_view, c.x, c.y, c.bilateral, c.default_region, c.body_area, c.categories,
           c.location, c.actions, c.indications, c.needling, c.cautions, c.text_en, c.sources, true, c.source
    from public.catalogue_points c
    where not exists (
      select 1 from public.acupuncture_points p where p.clinic_id = v_clinic and upper(p.code) = c.code
    )
    returning 1
  )
  select count(*) into v_points from inserted;

  -- Coordinates and anatomy are catalogue data and may be refreshed; clinical
  -- text is filled only where it is empty — the practitioner's words stay.
  update public.acupuncture_points p
     set point_number     = coalesce(p.point_number, c.point_number),
         pinyin_name      = coalesce(p.pinyin_name, c.pinyin),
         chinese_name     = coalesce(p.chinese_name, c.chinese),
         english_name     = coalesce(p.english_name, c.english),
         body_view        = coalesce(c.body_view, p.body_view),
         x                = coalesce(c.x, p.x),
         y                = coalesce(c.y, p.y),
         default_region   = coalesce(c.default_region, p.default_region),
         body_area        = coalesce(c.body_area, p.body_area),
         point_categories = case when cardinality(p.point_categories) = 0 then c.categories else p.point_categories end,
         location         = coalesce(p.location, c.location),
         actions          = coalesce(p.actions, c.actions),
         indications      = coalesce(p.indications, c.indications),
         needling         = coalesce(p.needling, c.needling),
         cautions         = coalesce(p.cautions, c.cautions),
         text_en          = case when p.text_en = '{}'::jsonb then c.text_en else p.text_en end,
         sources          = case when p.sources = '[]'::jsonb then c.sources else p.sources end,
         data_source      = coalesce(p.data_source, c.source)
    from public.catalogue_points c
   where p.clinic_id = v_clinic
     and upper(p.code) = c.code;

  perform set_config('herbalist.catalogue_loading', 'off', true);

  select jsonb_build_object(
    'herbs_added', v_herbs,
    'formulas_added', v_formulas,
    'items_added', v_items,
    'points_added', v_points,
    'herbs', (select count(*) from public.herbs h where h.clinic_id = v_clinic),
    'formulas', (select count(*) from public.herb_formulas f where f.clinic_id = v_clinic),
    'points', (select count(*) from public.acupuncture_points a where a.clinic_id = v_clinic),
    'catalogue_herbs', (select count(*) from public.catalogue_herbs),
    'catalogue_formulas', (select count(*) from public.catalogue_formulas),
    'catalogue_points', (select count(*) from public.catalogue_points)
  ) into v_result;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5 · Bringing a clinic up to date
-- ---------------------------------------------------------------------------
-- First the loader (gaps and new rows), then the rows nobody confirmed —
-- needs_review still true and no reviewed_at — take the catalogue's current
-- text, structured fields and, for a formula, its ingredient list. A row a
-- practitioner approved or edited is not touched. Only rows whose catalogue
-- entry was written from facts ('facts…' source) are refreshed: the bundled
-- text of 56 is what this replaces, not something to reapply.

create or replace function public.clinic_refresh_catalogue_text(p_clinic uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic uuid;
  v_loaded jsonb;
  v_herbs integer := 0;
  v_formulas integer := 0;
  v_items integer := 0;
  v_points integer := 0;
begin
  v_clinic := coalesce(p_clinic, public.current_clinic_id());
  if v_clinic is null then
    raise exception 'no_clinic' using errcode = '42501';
  end if;
  if not (public.is_clinic_member(v_clinic) or public.is_platform_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_loaded := public.clinic_load_catalogue(v_clinic);
  perform set_config('herbalist.catalogue_loading', 'on', true);

  with changed as (
    update public.herbs h
       set chinese_name        = coalesce(h.chinese_name, c.chinese),
           botanical_name      = coalesce(h.botanical_name, c.botanical),
           pharmaceutical_name = coalesce(h.pharmaceutical_name, c.pharmaceutical),
           english_name        = coalesce(h.english_name, c.english),
           hebrew_name         = coalesce(h.hebrew_name, c.hebrew),
           tcm_category        = coalesce(c.tcm_category, h.tcm_category),
           temperature         = coalesce(c.temperature, h.temperature),
           tastes              = case when cardinality(c.tastes) > 0 then c.tastes else h.tastes end,
           channels            = case when cardinality(c.channels) > 0 then c.channels else h.channels end,
           -- The refresh gives; it does not erase. A catalogue entry whose
           -- text has not been written yet (the structured fields were
           -- imported on their own) leaves the clinic's own text alone.
           functions           = coalesce(c.actions, h.functions),
           indications         = coalesce(c.indications, h.indications),
           cautions            = coalesce(c.cautions, h.cautions),
           dosage_min_g        = coalesce(c.dose_min, h.dosage_min_g),
           dosage_max_g        = coalesce(c.dose_max, h.dosage_max_g),
           dosage_notes        = coalesce(c.dosage_notes, h.dosage_notes),
           text_en             = case when c.text_en <> '{}'::jsonb then c.text_en else h.text_en end,
           sources             = case when c.sources <> '[]'::jsonb then c.sources else h.sources end,
           data_source         = c.source
      from public.catalogue_herbs c
     where h.clinic_id = v_clinic
       and lower(h.pinyin_name) = lower(c.pinyin)
       and c.source like 'facts%'
       and h.needs_review
       and h.reviewed_at is null
    returning 1
  )
  select count(*) into v_herbs from changed;

  with changed as (
    update public.herb_formulas f
       set name_chinese      = coalesce(f.name_chinese, c.chinese),
           name_english      = coalesce(f.name_english, c.english),
           tcm_category      = coalesce(c.tcm_category, f.tcm_category),
           source_text       = coalesce(f.source_text, c.source_text),
           actions           = coalesce(c.actions, f.actions),
           indications       = coalesce(c.indications, f.indications),
           contraindications = coalesce(c.contraindications, f.contraindications),
           dosage_notes      = coalesce(c.dosage_notes, f.dosage_notes),
           text_en           = case when c.text_en <> '{}'::jsonb then c.text_en else f.text_en end,
           sources           = case when c.sources <> '[]'::jsonb then c.sources else f.sources end,
           data_source       = c.source
      from public.catalogue_formulas c
     where f.clinic_id = v_clinic
       and lower(f.name_pinyin) = lower(c.pinyin)
       and c.source like 'facts%'
       and f.needs_review
       and f.reviewed_at is null
    returning 1
  )
  select count(*) into v_formulas from changed;

  -- The ingredient list of an unconfirmed formula follows the catalogue: the
  -- old lines go, the catalogue's come in, a missing herb becomes a stub.
  delete from public.herb_formula_items i
   using public.herb_formulas f, public.catalogue_formulas c
   where i.formula_id = f.id
     and f.clinic_id = v_clinic
     and lower(f.name_pinyin) = lower(c.pinyin)
     and c.source like 'facts%'
     and jsonb_array_length(c.items) > 0
     and f.needs_review
     and f.reviewed_at is null;

  insert into public.herbs (clinic_id, pinyin_name, category, default_unit, needs_review, data_source)
  select distinct on (lower(e.item ->> 'h'))
         v_clinic, btrim(e.item ->> 'h'), 'granule', 'gram', true, 'formula-stub'
    from public.catalogue_formulas c
    cross join lateral jsonb_array_elements(c.items) as e(item)
   where c.source like 'facts%'
     and nullif(btrim(e.item ->> 'h'), '') is not null
     and not exists (
       select 1 from public.herbs h where h.clinic_id = v_clinic and lower(h.pinyin_name) = lower(e.item ->> 'h')
     );

  with inserted as (
    insert into public.herb_formula_items (clinic_id, formula_id, herb_id, dosage, unit, sequence, notes)
    select v_clinic, f.id, h.id, coalesce((e.item ->> 'd')::numeric, 1), 'gram', e.ord::integer, e.item ->> 'n'
      from public.catalogue_formulas c
      join public.herb_formulas f
        on f.clinic_id = v_clinic and lower(f.name_pinyin) = lower(c.pinyin)
       and f.needs_review and f.reviewed_at is null
      cross join lateral jsonb_array_elements(c.items) with ordinality as e(item, ord)
      join public.herbs h
        on h.clinic_id = v_clinic and lower(h.pinyin_name) = lower(e.item ->> 'h')
     where c.source like 'facts%'
    on conflict (formula_id, herb_id) do nothing
    returning 1
  )
  select count(*) into v_items from inserted;

  with changed as (
    update public.acupuncture_points p
       set location    = coalesce(c.location, p.location),
           actions     = coalesce(c.actions, p.actions),
           indications = coalesce(c.indications, p.indications),
           needling    = coalesce(c.needling, p.needling),
           cautions    = coalesce(c.cautions, p.cautions),
           text_en     = case when c.text_en <> '{}'::jsonb then c.text_en else p.text_en end,
           sources     = case when c.sources <> '[]'::jsonb then c.sources else p.sources end,
           data_source = c.source
      from public.catalogue_points c
     where p.clinic_id = v_clinic
       and upper(p.code) = c.code
       and c.source like 'facts%'
       and p.needs_review
       and p.reviewed_at is null
    returning 1
  )
  select count(*) into v_points from changed;

  perform set_config('herbalist.catalogue_loading', 'off', true);

  return jsonb_build_object(
    'loaded', v_loaded,
    'herbs_refreshed', v_herbs,
    'formulas_refreshed', v_formulas,
    'items_replaced', v_items,
    'points_refreshed', v_points
  );
end;
$$;

revoke all on function public.clinic_refresh_catalogue_text(uuid) from public;
grant execute on function public.clinic_refresh_catalogue_text(uuid) to authenticated;

comment on function public.clinic_refresh_catalogue_text is
  'Loads the catalogue into one clinic, then replaces the text, structured fields and ingredients of every row nobody has confirmed with the catalogue''s facts-based entry. Confirmed and edited rows are left alone.';
