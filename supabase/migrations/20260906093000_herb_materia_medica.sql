-- ============================================================================
-- 12 · Materia medica: structured herb and formula data, images, and importers
-- ============================================================================
-- Up to now a herb carried three free-text fields. A reference catalogue needs
-- structure: the traditional category, temperature, tastes and channels are
-- things a practitioner filters and searches by, and dosage limits are numbers
-- that a future safety check can read. Free text stays for what is genuinely
-- prose (actions, indications, cautions).
--
-- Two importer functions live here as well, `upsert_herb` and `upsert_formula`.
-- The bundled catalogue is loaded through them, and any catalogue the clinic
-- brings later can be too — the same rule applies to both: never overwrite a
-- value the practitioner has already set by hand.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- herbs: structured materia medica columns
-- ---------------------------------------------------------------------------

alter table public.herbs
  add column if not exists tcm_category text,
  add column if not exists temperature text,
  add column if not exists tastes text[] not null default '{}',
  add column if not exists channels text[] not null default '{}',
  add column if not exists pharmaceutical_name text,
  add column if not exists indications text,
  add column if not exists dosage_min_g numeric(8, 2),
  add column if not exists dosage_max_g numeric(8, 2),
  add column if not exists dosage_notes text,
  add column if not exists image_url text,
  add column if not exists image_attribution text,
  add column if not exists needs_review boolean not null default false,
  add column if not exists data_source text;

comment on column public.herbs.tcm_category is
  'Traditional materia medica grouping, e.g. tonify_qi, release_exterior_warm. Values mirror TCM_CATEGORIES in packages/domain.';
comment on column public.herbs.pharmaceutical_name is
  'Latin pharmaceutical name of the part used, e.g. Radix Astragali — distinct from the botanical binomial.';
comment on column public.herbs.needs_review is
  'True for rows loaded from a generated catalogue that a practitioner has not yet confirmed. Cleared by editing the herb.';

create index if not exists herbs_tcm_category_idx on public.herbs (clinic_id, tcm_category);
create index if not exists herbs_needs_review_idx on public.herbs (clinic_id) where needs_review;

-- Editing a herb by hand is the confirmation: clear the flag on any update that
-- changes clinical content.
create or replace function public.clear_herb_review_flag()
returns trigger
language plpgsql
as $$
begin
  if new.needs_review
     and (
       new.functions is distinct from old.functions
       or new.cautions is distinct from old.cautions
       or new.indications is distinct from old.indications
       or new.dosage_min_g is distinct from old.dosage_min_g
       or new.dosage_max_g is distinct from old.dosage_max_g
     ) then
    new.needs_review := false;
  end if;
  return new;
end;
$$;

drop trigger if exists herbs_clear_review_flag on public.herbs;
create trigger herbs_clear_review_flag
  before update on public.herbs
  for each row execute function public.clear_herb_review_flag();

-- ---------------------------------------------------------------------------
-- herb_formulas: structured columns
-- ---------------------------------------------------------------------------

alter table public.herb_formulas
  add column if not exists tcm_category text,
  add column if not exists source_text text,
  add column if not exists actions text,
  add column if not exists contraindications text,
  add column if not exists modifications text,
  add column if not exists dosage_notes text,
  add column if not exists image_url text,
  add column if not exists needs_review boolean not null default false,
  add column if not exists data_source text;

comment on column public.herb_formulas.source_text is
  'Classical source, e.g. Shang Han Lun, Tai Ping Hui Min He Ji Ju Fang.';

create index if not exists herb_formulas_tcm_category_idx on public.herb_formulas (clinic_id, tcm_category);

-- ---------------------------------------------------------------------------
-- Stock view carries the new display columns
-- ---------------------------------------------------------------------------

-- The dependent view is dropped first. It does not exist yet the first time
-- this migration runs, which is what `if exists` is for; on a database that has
-- already reached migration 094000 it does, and Postgres will refuse to drop
-- what it stands on. Migration 094000 rebuilds it.
drop view if exists public.formula_stock_levels;
drop view if exists public.herb_stock_levels;

create view public.herb_stock_levels
with (security_invoker = on)
as
select
  h.id as herb_id,
  h.clinic_id,
  h.pinyin_name,
  h.chinese_name,
  h.english_name,
  h.hebrew_name,
  h.botanical_name,
  h.tcm_category,
  h.image_url,
  h.needs_review,
  h.category,
  h.default_unit,
  h.reorder_threshold,
  h.reorder_quantity,
  h.is_active,
  coalesce(sum(b.quantity_remaining), 0)::numeric(12, 3) as total_remaining,
  count(b.id) filter (where b.quantity_remaining > 0) as batch_count,
  min(b.expiry_date) filter (where b.quantity_remaining > 0) as nearest_expiry,
  (
    h.reorder_threshold is not null
    and coalesce(sum(b.quantity_remaining), 0) <= h.reorder_threshold
  ) as is_below_threshold
from public.herbs h
left join public.herb_batches b
  on b.herb_id = h.id
 and b.quantity_remaining > 0
group by h.id;

-- ---------------------------------------------------------------------------
-- Images: a public bucket
-- ---------------------------------------------------------------------------
-- Herb photographs are not sensitive, and a public bucket lets a plain <img>
-- tag show them with no signed URL. Writes stay restricted to clinic staff
-- under the clinic's own folder.

insert into storage.buckets (id, name, public)
values ('herb-images', 'herb-images', true)
on conflict (id) do nothing;

drop policy if exists herb_images_public_read on storage.objects;
create policy herb_images_public_read on storage.objects
  for select using (bucket_id = 'herb-images');

drop policy if exists herb_images_staff_write on storage.objects;
create policy herb_images_staff_write on storage.objects
  for all
  using (
    bucket_id = 'herb-images'
    and split_part(name, '/', 1) = public.current_clinic_id()::text
  )
  with check (
    bucket_id = 'herb-images'
    and split_part(name, '/', 1) = public.current_clinic_id()::text
  );

-- ---------------------------------------------------------------------------
-- Importers
-- ---------------------------------------------------------------------------
-- Both match on pinyin (case-insensitive) within a clinic. A new row is created
-- flagged for review; an existing row only has its *empty* fields filled, so a
-- catalogue load can never overwrite what a practitioner has corrected.

create or replace function public.upsert_herb(
  p_pinyin text,
  p_chinese text,
  p_botanical text,
  p_pharmaceutical text,
  p_english text,
  p_tcm_category text,
  p_temperature text,
  p_tastes text[],
  p_channels text[],
  p_actions text,
  p_indications text,
  p_cautions text,
  p_dose_min numeric,
  p_dose_max numeric,
  p_dosage_notes text default null,
  p_source text default 'bundled-catalogue',
  p_clinic uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_clinic uuid;
  v_id uuid;
begin
  v_clinic := coalesce(p_clinic, (select id from public.clinics order by created_at limit 1));
  if v_clinic is null then
    raise exception 'no_clinic';
  end if;

  select id into v_id
  from public.herbs
  where clinic_id = v_clinic
    and lower(pinyin_name) = lower(p_pinyin)
  limit 1;

  if v_id is null then
    insert into public.herbs (
      clinic_id, pinyin_name, chinese_name, botanical_name, pharmaceutical_name, english_name,
      tcm_category, temperature, tastes, channels, functions, indications, cautions,
      dosage_min_g, dosage_max_g, dosage_notes, category, default_unit,
      needs_review, data_source
    )
    values (
      v_clinic, p_pinyin, p_chinese, p_botanical, p_pharmaceutical, p_english,
      p_tcm_category, p_temperature, coalesce(p_tastes, '{}'), coalesce(p_channels, '{}'),
      p_actions, p_indications, p_cautions,
      p_dose_min, p_dose_max, p_dosage_notes, 'granule', 'gram',
      true, p_source
    )
    returning id into v_id;
  else
    update public.herbs
       set chinese_name        = coalesce(chinese_name, p_chinese),
           botanical_name      = coalesce(botanical_name, p_botanical),
           pharmaceutical_name = coalesce(pharmaceutical_name, p_pharmaceutical),
           english_name        = coalesce(english_name, p_english),
           tcm_category        = coalesce(tcm_category, p_tcm_category),
           temperature         = coalesce(temperature, p_temperature),
           tastes              = case when cardinality(tastes) = 0 then coalesce(p_tastes, '{}') else tastes end,
           channels            = case when cardinality(channels) = 0 then coalesce(p_channels, '{}') else channels end,
           functions           = coalesce(functions, p_actions),
           indications         = coalesce(indications, p_indications),
           cautions            = coalesce(cautions, p_cautions),
           dosage_min_g        = coalesce(dosage_min_g, p_dose_min),
           dosage_max_g        = coalesce(dosage_max_g, p_dose_max),
           dosage_notes        = coalesce(dosage_notes, p_dosage_notes),
           data_source         = coalesce(data_source, p_source)
     where id = v_id;
  end if;

  return v_id;
end;
$$;

comment on function public.upsert_herb is
  'Catalogue importer. Creates a herb flagged for review, or fills only the empty fields of an existing one matched by pinyin.';

-- Items arrive as [{"h": "Chai Hu", "d": 9}, ...]. A herb the catalogue does not
-- know yet is created as a stub rather than dropped, so a formula never loses an
-- ingredient silently.
create or replace function public.upsert_formula(
  p_pinyin text,
  p_chinese text,
  p_english text,
  p_tcm_category text,
  p_source_text text,
  p_actions text,
  p_indications text,
  p_contraindications text,
  p_items jsonb,
  p_dosage_notes text default 'Doses are classical decoction amounts in grams per day; scale for granules by the concentrate ratio.',
  p_source text default 'bundled-catalogue',
  p_clinic uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_clinic uuid;
  v_id uuid;
  v_item jsonb;
  v_herb uuid;
  v_seq integer := 0;
  v_pinyin text;
  v_dose numeric;
begin
  v_clinic := coalesce(p_clinic, (select id from public.clinics order by created_at limit 1));
  if v_clinic is null then
    raise exception 'no_clinic';
  end if;

  select id into v_id
  from public.herb_formulas
  where clinic_id = v_clinic
    and lower(name_pinyin) = lower(p_pinyin)
  limit 1;

  if v_id is null then
    insert into public.herb_formulas (
      clinic_id, name_pinyin, name_chinese, name_english, tcm_category, source_text,
      actions, indications, contraindications, dosage_notes, category,
      needs_review, data_source
    )
    values (
      v_clinic, p_pinyin, p_chinese, p_english, p_tcm_category, p_source_text,
      p_actions, p_indications, p_contraindications, p_dosage_notes, 'classical',
      true, p_source
    )
    returning id into v_id;
  else
    update public.herb_formulas
       set name_chinese      = coalesce(name_chinese, p_chinese),
           name_english      = coalesce(name_english, p_english),
           tcm_category      = coalesce(tcm_category, p_tcm_category),
           source_text       = coalesce(source_text, p_source_text),
           actions           = coalesce(actions, p_actions),
           indications       = coalesce(indications, p_indications),
           contraindications = coalesce(contraindications, p_contraindications),
           dosage_notes      = coalesce(dosage_notes, p_dosage_notes),
           data_source       = coalesce(data_source, p_source)
     where id = v_id;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_seq := v_seq + 1;
    v_pinyin := v_item ->> 'h';
    v_dose := (v_item ->> 'd')::numeric;

    select id into v_herb
    from public.herbs
    where clinic_id = v_clinic and lower(pinyin_name) = lower(v_pinyin)
    limit 1;

    if v_herb is null then
      insert into public.herbs (clinic_id, pinyin_name, category, default_unit, needs_review, data_source)
      values (v_clinic, v_pinyin, 'granule', 'gram', true, 'formula-stub')
      returning id into v_herb;
    end if;

    insert into public.herb_formula_items (clinic_id, formula_id, herb_id, dosage, unit, sequence, notes)
    values (v_clinic, v_id, v_herb, coalesce(v_dose, 1), 'gram', v_seq, v_item ->> 'n')
    on conflict (formula_id, herb_id) do nothing;
  end loop;

  return v_id;
end;
$$;

comment on function public.upsert_formula is
  'Catalogue importer for formulas. Ingredients reference herbs by pinyin; unknown ones become review-flagged stubs rather than being dropped.';
