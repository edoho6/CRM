-- ============================================================================
-- The reference catalogue as a shared thing, and the 3D body's coordinates
-- ============================================================================
-- Until now the catalogues of herbs, formulas and acupuncture points were
-- loaded straight into one clinic — whichever was created first — by pasting
-- three SQL files. A second clinic started empty, and nothing in the app
-- could fill it.
--
-- Now the catalogue lives once, for the whole service, in three tables with
-- no clinic_id (the same arrangement as the Western medicine reference and
-- the shop prices), and each clinic copies it into its own tables through
-- clinic_load_catalogue(): from a button in Settings, and on its own the
-- moment a clinic is created. The copy fills only empty fields, so a
-- correction a practitioner made by hand always survives a reload.
--
-- Three smaller things ride along:
--   · a person's approval of a catalogue row (reviewed_at / by / by_name),
--     so "needs review" can be cleared with a click and it is known who did;
--   · the 3D body's point coordinates move from a source file to a table
--     (body_points), written only by a platform admin through the placement
--     tool on the treatment page;
--   · the review-flag triggers learn to stay quiet while a catalogue load
--     fills gaps, so a stub row is not "confirmed" by the import.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1 · A person's approval
-- ---------------------------------------------------------------------------

alter table public.herbs
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_by_name text;

alter table public.herb_formulas
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_by_name text;

alter table public.acupuncture_points
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_by_name text;

comment on column public.herbs.reviewed_by_name is
  'Captured at approval time, so the name outlives the account that gave it.';

-- The triggers that clear needs_review on a clinical edit must not fire for a
-- catalogue load: filling an empty field from the catalogue is not the
-- practitioner confirming it. The loader sets this flag for its transaction.
create or replace function public.clear_herb_review_flag()
returns trigger
language plpgsql
as $$
begin
  if current_setting('herbalist.catalogue_loading', true) = 'on' then
    return new;
  end if;
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

create or replace function public.clear_point_review_flag()
returns trigger
language plpgsql
as $$
begin
  if current_setting('herbalist.catalogue_loading', true) = 'on' then
    return new;
  end if;
  if new.needs_review
     and (
       new.location is distinct from old.location
       or new.actions is distinct from old.actions
       or new.indications is distinct from old.indications
       or new.needling is distinct from old.needling
       or new.cautions is distinct from old.cautions
     ) then
    new.needs_review := false;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2 · The shared catalogue
-- ---------------------------------------------------------------------------
-- No clinic_id: a herb's classical dose is the same fact for every clinic.
-- Members read; nothing writes but the seed functions below, which are run
-- from the SQL editor by whoever operates the service.

create table if not exists public.catalogue_herbs (
  pinyin text primary key,
  chinese text,
  botanical text,
  pharmaceutical text,
  english text,
  tcm_category text,
  temperature text,
  tastes text[] not null default '{}',
  channels text[] not null default '{}',
  actions text,
  indications text,
  cautions text,
  dose_min numeric,
  dose_max numeric,
  dosage_notes text,
  source text not null default 'bundled-catalogue',
  updated_at timestamptz not null default now()
);
create unique index if not exists catalogue_herbs_lower_idx on public.catalogue_herbs (lower(pinyin));

create table if not exists public.catalogue_formulas (
  pinyin text primary key,
  chinese text,
  english text,
  tcm_category text,
  source_text text,
  actions text,
  indications text,
  contraindications text,
  dosage_notes text,
  -- [{"h": "Ma Huang", "d": 9, "n": "honey-fried"}, …] — pinyin, grams, note.
  items jsonb not null default '[]'::jsonb,
  source text not null default 'bundled-catalogue',
  updated_at timestamptz not null default now()
);
create unique index if not exists catalogue_formulas_lower_idx on public.catalogue_formulas (lower(pinyin));

create table if not exists public.catalogue_points (
  code text primary key,
  channel text not null,
  point_number integer,
  pinyin text,
  chinese text,
  english text,
  body_view text not null default 'front',
  x numeric(6, 2),
  y numeric(6, 2),
  bilateral boolean not null default true,
  default_region text not null default 'upper',
  body_area text,
  categories text[] not null default '{}',
  location text,
  actions text,
  indications text,
  needling text,
  cautions text,
  source text not null default 'bundled-catalogue',
  updated_at timestamptz not null default now(),
  constraint catalogue_points_code_upper check (code = upper(code))
);

alter table public.catalogue_herbs enable row level security;
alter table public.catalogue_formulas enable row level security;
alter table public.catalogue_points enable row level security;

drop policy if exists catalogue_herbs_members_read on public.catalogue_herbs;
create policy catalogue_herbs_members_read on public.catalogue_herbs
  for select using ((select public.current_clinic_id()) is not null);
drop policy if exists catalogue_formulas_members_read on public.catalogue_formulas;
create policy catalogue_formulas_members_read on public.catalogue_formulas
  for select using ((select public.current_clinic_id()) is not null);
drop policy if exists catalogue_points_members_read on public.catalogue_points;
create policy catalogue_points_members_read on public.catalogue_points
  for select using ((select public.current_clinic_id()) is not null);

-- The seed functions. Same argument lists as the clinic-level importers they
-- replace, so the seed files changed only in the name they call. The trailing
-- p_source / p_clinic keep old call forms valid; p_clinic is ignored.
create or replace function public.catalogue_upsert_herb(
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
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_key text := btrim(p_pinyin);
begin
  if v_key is null or v_key = '' then
    raise exception 'pinyin_required';
  end if;
  update public.catalogue_herbs
     set chinese = p_chinese, botanical = p_botanical, pharmaceutical = p_pharmaceutical,
         english = p_english, tcm_category = p_tcm_category, temperature = p_temperature,
         tastes = coalesce(p_tastes, '{}'), channels = coalesce(p_channels, '{}'),
         actions = p_actions, indications = p_indications, cautions = p_cautions,
         dose_min = p_dose_min, dose_max = p_dose_max, dosage_notes = p_dosage_notes,
         source = coalesce(p_source, 'bundled-catalogue'), updated_at = now()
   where lower(pinyin) = lower(v_key);
  if not found then
    insert into public.catalogue_herbs (
      pinyin, chinese, botanical, pharmaceutical, english, tcm_category, temperature, tastes, channels,
      actions, indications, cautions, dose_min, dose_max, dosage_notes, source
    ) values (
      v_key, p_chinese, p_botanical, p_pharmaceutical, p_english, p_tcm_category, p_temperature,
      coalesce(p_tastes, '{}'), coalesce(p_channels, '{}'),
      p_actions, p_indications, p_cautions, p_dose_min, p_dose_max, p_dosage_notes,
      coalesce(p_source, 'bundled-catalogue')
    );
  end if;
end;
$$;

create or replace function public.catalogue_upsert_formula(
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
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_key text := btrim(p_pinyin);
begin
  if v_key is null or v_key = '' then
    raise exception 'pinyin_required';
  end if;
  update public.catalogue_formulas
     set chinese = p_chinese, english = p_english, tcm_category = p_tcm_category,
         source_text = p_source_text, actions = p_actions, indications = p_indications,
         contraindications = p_contraindications, dosage_notes = p_dosage_notes,
         items = coalesce(p_items, '[]'::jsonb),
         source = coalesce(p_source, 'bundled-catalogue'), updated_at = now()
   where lower(pinyin) = lower(v_key);
  if not found then
    insert into public.catalogue_formulas (
      pinyin, chinese, english, tcm_category, source_text, actions, indications, contraindications,
      dosage_notes, items, source
    ) values (
      v_key, p_chinese, p_english, p_tcm_category, p_source_text, p_actions, p_indications,
      p_contraindications, p_dosage_notes, coalesce(p_items, '[]'::jsonb),
      coalesce(p_source, 'bundled-catalogue')
    );
  end if;
end;
$$;

create or replace function public.catalogue_upsert_point(
  p_code text,
  p_channel text,
  p_number integer,
  p_pinyin text,
  p_chinese text,
  p_english text,
  p_view text,
  p_x numeric,
  p_y numeric,
  p_bilateral boolean,
  p_region text,
  p_body_area text,
  p_categories text[] default '{}',
  p_source text default 'bundled-catalogue',
  p_clinic uuid default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_code text := upper(btrim(p_code));
begin
  if v_code is null or v_code = '' then
    raise exception 'code_required';
  end if;
  update public.catalogue_points
     set channel = p_channel, point_number = p_number, pinyin = p_pinyin, chinese = p_chinese,
         english = p_english, body_view = coalesce(p_view, 'front'), x = p_x, y = p_y,
         bilateral = coalesce(p_bilateral, true), default_region = coalesce(p_region, 'upper'),
         body_area = p_body_area,
         categories = case when cardinality(categories) = 0 then coalesce(p_categories, '{}') else categories end,
         source = coalesce(p_source, 'bundled-catalogue'), updated_at = now()
   where code = v_code;
  if not found then
    insert into public.catalogue_points (
      code, channel, point_number, pinyin, chinese, english, body_view, x, y, bilateral,
      default_region, body_area, categories, source
    ) values (
      v_code, p_channel, p_number, p_pinyin, p_chinese, p_english, coalesce(p_view, 'front'), p_x, p_y,
      coalesce(p_bilateral, true), coalesce(p_region, 'upper'), p_body_area,
      coalesce(p_categories, '{}'), coalesce(p_source, 'bundled-catalogue')
    );
  end if;
end;
$$;

create or replace function public.catalogue_set_point_clinical(
  p_code text,
  p_location text,
  p_actions text,
  p_indications text,
  p_needling text,
  p_cautions text default null,
  p_categories text[] default null,
  p_source text default 'bundled-catalogue',
  p_clinic uuid default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.catalogue_points
     set location = p_location, actions = p_actions, indications = p_indications,
         needling = p_needling, cautions = p_cautions,
         categories = case
           when p_categories is not null and cardinality(p_categories) > 0 then p_categories
           else categories
         end,
         updated_at = now()
   where code = upper(btrim(p_code));
  -- A code the catalogue does not know is a mistake in the seed, not a row to
  -- invent: the codes are a closed set.
  if not found then
    raise exception 'unknown_point: %', p_code;
  end if;
end;
$$;

-- Seed functions are for the SQL editor only. Supabase grants every new
-- function to anon and authenticated by default; take that back explicitly.
revoke all on function public.catalogue_upsert_herb(text, text, text, text, text, text, text, text[], text[], text, text, text, numeric, numeric, text, text, uuid) from public;
revoke execute on function public.catalogue_upsert_herb(text, text, text, text, text, text, text, text[], text[], text, text, text, numeric, numeric, text, text, uuid) from anon, authenticated;
revoke all on function public.catalogue_upsert_formula(text, text, text, text, text, text, text, text, jsonb, text, text, uuid) from public;
revoke execute on function public.catalogue_upsert_formula(text, text, text, text, text, text, text, text, jsonb, text, text, uuid) from anon, authenticated;
revoke all on function public.catalogue_upsert_point(text, text, integer, text, text, text, text, numeric, numeric, boolean, text, text, text[], text, uuid) from public;
revoke execute on function public.catalogue_upsert_point(text, text, integer, text, text, text, text, numeric, numeric, boolean, text, text, text[], text, uuid) from anon, authenticated;
revoke all on function public.catalogue_set_point_clinical(text, text, text, text, text, text, text[], text, uuid) from public;
revoke execute on function public.catalogue_set_point_clinical(text, text, text, text, text, text, text[], text, uuid) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3 · Copying the catalogue into a clinic
-- ---------------------------------------------------------------------------
-- Set-based on purpose: nine hundred rows through the per-row importers took
-- seconds, and a request through PostgREST has eight of them. Everything here
-- is "insert what is missing, fill what is empty" — a practitioner's
-- correction is never overwritten, and running it twice changes nothing.

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
      clinic_id, pinyin_name, chinese_name, botanical_name, pharmaceutical_name, english_name,
      tcm_category, temperature, tastes, channels, functions, indications, cautions,
      dosage_min_g, dosage_max_g, dosage_notes, category, default_unit, needs_review, data_source
    )
    select v_clinic, c.pinyin, c.chinese, c.botanical, c.pharmaceutical, c.english,
           c.tcm_category, c.temperature, c.tastes, c.channels, c.actions, c.indications, c.cautions,
           c.dose_min, c.dose_max, c.dosage_notes, 'granule', 'gram', true, c.source
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
         data_source         = coalesce(h.data_source, c.source)
    from public.catalogue_herbs c
   where h.clinic_id = v_clinic
     and lower(h.pinyin_name) = lower(c.pinyin)
     and (h.chinese_name is null or h.botanical_name is null or h.pharmaceutical_name is null
          or h.english_name is null or h.tcm_category is null or h.temperature is null
          or cardinality(h.tastes) = 0 or cardinality(h.channels) = 0 or h.functions is null
          or h.indications is null or h.cautions is null or h.dosage_min_g is null
          or h.dosage_max_g is null or h.dosage_notes is null or h.data_source is null);

  -- Formulas ----------------------------------------------------------------
  with inserted as (
    insert into public.herb_formulas (
      clinic_id, name_pinyin, name_chinese, name_english, tcm_category, source_text,
      actions, indications, contraindications, dosage_notes, category, needs_review, data_source
    )
    select v_clinic, c.pinyin, c.chinese, c.english, c.tcm_category, c.source_text,
           c.actions, c.indications, c.contraindications, c.dosage_notes, 'classical', true, c.source
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
         data_source       = coalesce(f.data_source, c.source)
    from public.catalogue_formulas c
   where f.clinic_id = v_clinic
     and lower(f.name_pinyin) = lower(c.pinyin)
     and (f.name_chinese is null or f.name_english is null or f.tcm_category is null
          or f.source_text is null or f.actions is null or f.indications is null
          or f.contraindications is null or f.dosage_notes is null or f.data_source is null);

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
      location, actions, indications, needling, cautions, needs_review, data_source
    )
    select v_clinic, c.code, c.channel, c.point_number, c.pinyin, c.chinese, c.english,
           c.body_view, c.x, c.y, c.bilateral, c.default_region, c.body_area, c.categories,
           c.location, c.actions, c.indications, c.needling, c.cautions, true, c.source
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

revoke all on function public.clinic_load_catalogue(uuid) from public;
grant execute on function public.clinic_load_catalogue(uuid) to authenticated;

comment on function public.clinic_load_catalogue is
  'Copies the shared reference catalogue into one clinic: inserts what is missing, fills only empty fields, never overwrites a correction. Idempotent.';

-- A new clinic starts with the catalogue, when the service has one. It is
-- the last thing the function does, and a failure there must never cost the
-- person their clinic.
create or replace function public.create_clinic_for_current_user(p_name text, p_phone text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic uuid;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if length(v_name) = 0 or length(v_name) > 120 then
    raise exception 'name_required' using errcode = '22023';
  end if;
  -- One clinic per account, made once. A second call is a repeated click,
  -- not a second practice.
  if exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.is_active) then
    raise exception 'already_member' using errcode = '23505';
  end if;
  -- A patient's portal login is not a practitioner's account, and must not
  -- be able to turn itself into one.
  if exists (select 1 from public.patient_portal_access a where a.user_id = auth.uid()) then
    raise exception 'portal_account' using errcode = '42501';
  end if;

  insert into public.clinics (name, slug, phone)
  values (
    v_name,
    'c-' || replace(gen_random_uuid()::text, '-', ''),
    nullif(btrim(coalesce(p_phone, '')), '')
  )
  returning id into v_clinic;

  insert into public.memberships (clinic_id, user_id, role, is_active)
  values (v_clinic, auth.uid(), 'owner', true);

  begin
    perform public.clinic_load_catalogue(v_clinic);
  exception
    when others then
      -- The clinic exists; the catalogue can be loaded from Settings later.
      null;
  end;

  return v_clinic;
end;
$$;

revoke all on function public.create_clinic_for_current_user(text, text) from public;
grant execute on function public.create_clinic_for_current_user(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4 · Where each point sits on the 3D body
-- ---------------------------------------------------------------------------
-- One row per catalogue code, for the whole service, in the frame documented
-- in features/encounters/body3d/frame.ts: metres, +Y up, +Z the front, the
-- origin on the floor between the feet, +X the patient's left. A bilateral
-- point is stored once on the patient's right (x < 0) and mirrored when
-- drawn; a midline point has x = 0. `validated` is a person saying the
-- number was checked against an anatomical reference — not the tool.
--
-- Written only by a platform admin through body_point_set, from the
-- placement tool on the treatment page. Members read.

create table if not exists public.body_points (
  code text primary key,
  side_type text not null default 'bilateral' check (side_type in ('bilateral', 'midline')),
  x numeric(7, 4) not null,
  y numeric(7, 4) not null,
  z numeric(7, 4) not null,
  approach_x numeric(7, 4),
  approach_y numeric(7, 4),
  approach_z numeric(7, 4),
  validated boolean not null default false,
  note text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint body_points_code_upper check (code = upper(code)),
  constraint body_points_side check (
    (side_type = 'midline' and x = 0) or (side_type = 'bilateral' and x < 0)
  ),
  constraint body_points_height check (y >= 0 and y <= 1.75)
);

alter table public.body_points enable row level security;
drop policy if exists body_points_members_read on public.body_points;
create policy body_points_members_read on public.body_points
  for select using ((select public.current_clinic_id()) is not null);

create or replace function public.body_point_set(
  p_code text,
  p_side_type text,
  p_x numeric,
  p_y numeric,
  p_z numeric,
  p_approach_x numeric default null,
  p_approach_y numeric default null,
  p_approach_z numeric default null,
  p_validated boolean default false,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_code = '' or length(v_code) > 16 then
    raise exception 'code_required' using errcode = '22023';
  end if;
  if p_side_type not in ('bilateral', 'midline') then
    raise exception 'bad_side' using errcode = '22023';
  end if;
  insert into public.body_points (
    code, side_type, x, y, z, approach_x, approach_y, approach_z, validated, note, updated_at, updated_by
  ) values (
    v_code, p_side_type,
    case when p_side_type = 'midline' then 0 else p_x end, p_y, p_z,
    p_approach_x, p_approach_y, p_approach_z,
    coalesce(p_validated, false), nullif(btrim(coalesce(p_note, '')), ''), now(), auth.uid()
  )
  on conflict (code) do update
    set side_type = excluded.side_type,
        x = excluded.x, y = excluded.y, z = excluded.z,
        approach_x = excluded.approach_x, approach_y = excluded.approach_y, approach_z = excluded.approach_z,
        validated = excluded.validated, note = excluded.note,
        updated_at = now(), updated_by = auth.uid();
end;
$$;

create or replace function public.body_point_delete(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.body_points where code = upper(btrim(coalesce(p_code, '')));
  return found;
end;
$$;

revoke all on function public.body_point_set(text, text, numeric, numeric, numeric, numeric, numeric, numeric, boolean, text) from public;
grant execute on function public.body_point_set(text, text, numeric, numeric, numeric, numeric, numeric, numeric, boolean, text) to authenticated;
revoke all on function public.body_point_delete(text) from public;
grant execute on function public.body_point_delete(text) to authenticated;

-- The demonstration set that lived in the source file, unvalidated as it was
-- placed: by eye, on the Blender Human Base Meshes realistic male v1.4.1.
insert into public.body_points (code, side_type, x, y, z, approach_x, approach_y, approach_z, validated, note)
values
  ('DU20', 'midline',   0,      1.75,  0,     0,    1, 0,   false, 'Placed by eye on the development model. Vertex of the head.'),
  ('REN4', 'midline',   0,      0.97,  0.1,   0,    0, 1,   false, 'Placed by eye on the development model. Lower abdomen, below the navel.'),
  ('LI4',  'bilateral', -0.45,  0.82,  0.08,  -1,   0, 0,   false, 'Placed by eye on the development model. Back of the hand near the thumb web.'),
  ('PC6',  'bilateral', -0.37,  0.92,  0.03,  0.6,  0, 0.8, false, 'Placed by eye on the development model. Palm side of the forearm above the wrist.'),
  ('ST36', 'bilateral', -0.18,  0.42,  -0.03, -0.6, 0, 0.8, false, 'Placed by eye on the development model. Outer front of the lower leg below the knee.'),
  ('SP6',  'bilateral', -0.145, 0.17,  -0.09, 1,    0, 0.2, false, 'Placed by eye on the development model. Inner lower leg above the ankle.'),
  ('LR3',  'bilateral', -0.19,  0.075, 0,     0,    1, 0.2, false, 'Placed by eye on the development model. Top of the foot.')
on conflict (code) do nothing;
