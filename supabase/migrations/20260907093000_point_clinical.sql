-- ============================================================================
-- 15 · Clinical content for the point catalogue
-- ============================================================================
-- The points shipped with names, coordinates and an anatomical region, and with
-- every clinical field empty. This adds the importer that fills them, and the
-- classical point categories — five-shu, yuan-source, luo-connecting, xi-cleft,
-- back-shu, front-mu and the rest.
--
-- Those categories are not decoration. "Show me the xi-cleft points" and "which
-- back-shu point is this" are questions asked during a treatment, and a
-- catalogue that cannot answer them is a list of names.
--
-- Same contract as the herb importer: fill what is empty, never overwrite what
-- a practitioner has written.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'acupuncture_points_categories_check'
  ) then
    alter table public.acupuncture_points
      add constraint acupuncture_points_categories_check check (
        point_categories <@ array[
          -- The five transport points, distal to proximal.
          'jing_well', 'ying_spring', 'shu_stream', 'jing_river', 'he_sea',
          -- The connecting set.
          'yuan_source', 'luo_connecting', 'xi_cleft',
          -- Where a channel's qi is accessed on the trunk.
          'back_shu', 'front_mu',
          -- The eight influential points and the eight confluent points.
          'influential', 'confluent',
          -- Points singled out for a region or a use.
          'command', 'window_of_sky', 'lower_he_sea', 'sea_point',
          'ghost_point', 'entry', 'exit', 'group_luo', 'crossing'
        ]::text[]
      );
  end if;
end
$$;

comment on column public.acupuncture_points.point_categories is
  'Classical categories a point belongs to: five-shu, yuan-source, luo-connecting, xi-cleft, back-shu, front-mu, influential, confluent and so on. A point can hold several.';

create index if not exists acupuncture_points_categories_idx
  on public.acupuncture_points using gin (point_categories);

-- ---------------------------------------------------------------------------
-- set_point_clinical — the clinical text importer
-- ---------------------------------------------------------------------------
-- Separate from `upsert_acupuncture_point` because it answers a different
-- question. That one owns where a point *is* and may refresh coordinates as the
-- drawing improves. This one owns what a point *does*, and must never overwrite
-- a practitioner's correction — which is exactly why every field is written
-- through coalesce and the row is left flagged for review until someone edits
-- it by hand.

create or replace function public.set_point_clinical(
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
  from public.acupuncture_points
  where clinic_id = v_clinic and upper(code) = upper(p_code)
  limit 1;

  -- A point that is not in the catalogue is a mistake in the seed, not
  -- something to invent a row for: the codes are a closed set.
  if v_id is null then
    raise exception 'unknown_point: %', p_code;
  end if;

  update public.acupuncture_points
     set location    = coalesce(location, p_location),
         actions     = coalesce(actions, p_actions),
         indications = coalesce(indications, p_indications),
         needling    = coalesce(needling, p_needling),
         cautions    = coalesce(cautions, p_cautions),
         point_categories = case
           when cardinality(point_categories) = 0 then coalesce(p_categories, '{}')
           else point_categories
         end,
         data_source = coalesce(data_source, p_source)
   where id = v_id;

  return v_id;
end;
$$;

comment on function public.set_point_clinical is
  'Fills the clinical text of a catalogued point. Only empty fields are written, so a practitioner correction always wins.';
