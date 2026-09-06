-- ============================================================================
-- 14 · Where a point actually is
-- ============================================================================
-- `default_region` answers "which bucket does this go in when I write it down"
-- — upper, lower, centre. It is a prescription-writing convenience and it is
-- useless for finding a point: "upper" covers the scalp, the ear, the shoulder
-- and the fingertip alike.
--
-- `body_area` answers the other question, the one a practitioner actually asks
-- of a catalogue: show me the points on the knee. The two are kept apart
-- because collapsing them would make both worse.
-- ============================================================================

alter table public.acupuncture_points
  add column if not exists body_area text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'acupuncture_points_body_area_check'
  ) then
    alter table public.acupuncture_points
      add constraint acupuncture_points_body_area_check check (
        body_area is null or body_area in (
          'face', 'head', 'ear', 'neck', 'shoulder', 'chest', 'abdomen',
          'upper_back', 'lower_back', 'sacrum', 'buttock', 'hip',
          'upper_arm', 'elbow', 'forearm', 'wrist', 'hand',
          'thigh', 'knee', 'lower_leg', 'ankle', 'foot'
        )
      );
  end if;
end
$$;

comment on column public.acupuncture_points.body_area is
  'Anatomical region the point sits in, for looking points up by body part. Distinct from default_region, which is the bucket a treatment note files it under.';

create index if not exists acupuncture_points_body_area_idx
  on public.acupuncture_points (clinic_id, body_area);

-- ---------------------------------------------------------------------------
-- The importer gains a parameter
-- ---------------------------------------------------------------------------
-- The previous signature is dropped rather than left alongside: two overloads
-- differing only by a trailing argument make every call ambiguous to resolve,
-- and a seed file that silently picks the wrong one is worse than one that
-- fails loudly.

drop function if exists public.upsert_acupuncture_point(
  text, text, integer, text, text, text, text, numeric, numeric, boolean, text, text[], text, uuid
);

create or replace function public.upsert_acupuncture_point(
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

  if v_id is null then
    insert into public.acupuncture_points (
      clinic_id, code, channel, point_number, pinyin_name, chinese_name, english_name,
      body_view, x, y, bilateral, default_region, body_area, point_categories,
      needs_review, data_source
    )
    values (
      v_clinic, p_code, p_channel, p_number, p_pinyin, p_chinese, p_english,
      coalesce(p_view, 'front'), p_x, p_y, coalesce(p_bilateral, true),
      coalesce(p_region, 'upper'), p_body_area, coalesce(p_categories, '{}'), true, p_source
    )
    returning id into v_id;
  else
    update public.acupuncture_points
       set channel      = coalesce(channel, p_channel),
           point_number = coalesce(point_number, p_number),
           pinyin_name  = coalesce(pinyin_name, p_pinyin),
           chinese_name = coalesce(chinese_name, p_chinese),
           english_name = coalesce(english_name, p_english),
           -- Coordinates and anatomy are catalogue data, not clinical
           -- judgement: a newer drawing is allowed to move a dot, and a
           -- corrected region is allowed to land.
           body_view    = coalesce(p_view, body_view),
           x            = coalesce(p_x, x),
           y            = coalesce(p_y, y),
           default_region = coalesce(p_region, default_region),
           body_area    = coalesce(p_body_area, body_area),
           point_categories = case
             when cardinality(point_categories) = 0 then coalesce(p_categories, '{}')
             else point_categories
           end,
           data_source  = coalesce(data_source, p_source)
     where id = v_id;
  end if;

  return v_id;
end;
$$;

comment on function public.upsert_acupuncture_point is
  'Catalogue importer for acupuncture points. Coordinates and anatomy may be refreshed; clinical text never is.';
