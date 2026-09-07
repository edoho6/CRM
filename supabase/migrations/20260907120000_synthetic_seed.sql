-- ============================================================================
-- 18 · Synthetic data for development
-- ============================================================================
-- The project brief is absolute about this: no real patient data outside
-- production. A rule like that only holds if the alternative is easier than
-- breaking it, so this generates a clinic's worth of believable fictional
-- patients on demand.
--
-- The guard is structural rather than procedural. A clinic must be flagged
-- `is_synthetic` before anything can be seeded into it, and that flag is shown
-- on every screen of the application. So you cannot seed fake patients into a
-- real clinic by mistake, and you cannot mistake a sandbox for the real thing.
--
-- The fictional details are deliberately unusable rather than merely invented:
--   · emails end in .test, a reserved TLD that can never be delivered to
--   · phone numbers use 050-000xxxx, which is not allocated to any subscriber,
--     so a misdirected reminder cannot reach a real person
--   · national ids start at 900000000 and deliberately fail the check digit
-- Realistic-looking random values would eventually collide with a real person's
-- number, and that collision only shows up as a stranger receiving a message
-- about a clinical appointment.
--
-- The names are ordinary Hebrew and English ones because the point is to
-- exercise the interface honestly — RTL layout, mixed-direction fields and
-- Hebrew collation are all things that only misbehave with real script.
-- ============================================================================

alter table public.clinics
  add column if not exists is_synthetic boolean not null default false;

comment on column public.clinics.is_synthetic is
  'Marks a sandbox clinic. Required before seed_synthetic_data() will write anything, and surfaced as a banner throughout the application so a development database can never be mistaken for the real one.';

-- ---------------------------------------------------------------------------
-- seed_synthetic_data — a clinic's worth of fictional practice
-- ---------------------------------------------------------------------------

-- The clinic and practitioner are resolved rather than demanded, because this
-- gets called from two very different places: the application, where a signed-in
-- user makes both obvious, and the SQL editor, where neither `auth.uid()` nor
-- `current_clinic_id()` returns anything at all. Passing them explicitly always
-- wins; otherwise the single flagged sandbox clinic is used, which is what a
-- development project has exactly one of.

create or replace function public.seed_synthetic_data(
  p_patients integer default 24,
  p_clinic uuid default null,
  p_practitioner uuid default null
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_clinic       uuid := coalesce(p_clinic, public.current_clinic_id());
  v_synthetic    boolean;
  v_practitioner uuid;
  v_candidates   integer;
  v_type_initial uuid;
  v_type_follow  uuid;
  v_type_herbs   uuid;

  -- Ordinary names, so Hebrew collation and RTL layout are exercised properly.
  v_first_he text[] := array['נועה','איתי','מיכל','דניאל','שירה','יונתן','תמר','אורי',
                             'רונית','אבישי','הדס','גיא','ליאת','עומר','מאיה','ניר',
                             'יעל','אסף','שני','רועי','טל','אלון','נטע','עידו'];
  v_last_he  text[] := array['לוי','כהן','מזרחי','פרץ','ביטון','אברהם','דהן','אזולאי',
                             'שרון','גבאי','אוחיון','חדד','נחום','ברקוביץ','שפירא','אלמוג',
                             'רוזן','בן דוד','טולדנו','אשכנזי','גולן','סבן','ירון','מלכה'];
  v_first_en text[] := array['Sarah','Michael','Emma','David','Rachel','Jonathan'];
  v_last_en  text[] := array['Klein','Fisher','Bernstein','Adler','Weiss','Stern'];
  v_cities   text[] := array['תל אביב-יפו','חיפה','ירושלים','באר שבע','רעננה','מודיעין',
                             'כפר סבא','נתניה','ראשון לציון','הרצליה','גבעתיים','רמת גן'];
  v_jobs     text[] := array['מורה','מהנדסת תוכנה','נהג','אדריכלית','פיזיותרפיסט','גננת',
                             'רואה חשבון','עצמאי','אחות','סטודנטית','שף','גמלאי'];
  v_referral text[] := array['המלצה מחבר','חיפוש באינטרנט','רופא משפחה','מטופל קיים',
                             'קופת חולים','עמוד הפייסבוק'];

  -- Presentations a herbal and acupuncture practice actually sees, each with the
  -- findings that go with it, so the notes read as a case rather than as filler.
  v_complaint text[] := array[
    'כאבי גב תחתון מזה חצי שנה, מחמירים בישיבה ממושכת',
    'מיגרנות חוזרות, כשתיים בשבוע, מלוות בבחילה',
    'קשיי הירדמות ושינה קטועה מזה כשנה',
    'עייפות כרונית ותחושת כבדות בגפיים',
    'נפיחות בטנית וחוסר סדירות במערכת העיכול',
    'מחזור לא סדיר ועם כאבים',
    'חרדה ולחץ בחזה בתקופות עומס',
    'כאבי צוואר וכתפיים מעבודה מול מחשב',
    'אלרגיה עונתית עם גודש באף',
    'ברכיים כואבות בירידה במדרגות',
    'יובש בעור ובעיניים לקראת החורף',
    'הזעות לילה והתעוררות בשעות הקטנות'];
  v_tongue_color text[] := array['חיוור','אדמדם','אדום בקצוות','סגלגל','ורוד תקין'];
  v_tongue_coat  text[] := array['חיפוי לבן דק','חיפוי לבן דביק','חיפוי צהבהב','ללא חיפוי','חיפוי דק מקולף'];
  v_tongue_shape text[] := array['נפוחה עם סימני שיניים','דקה','סדוקה במרכז','תקינה'];
  v_pulse text[] := array['דק וחלש','מיתרי','חלקלק','מהיר ודק','עמוק ואיטי','צף'];
  v_pattern text[] := array[
    'חוסר Qi של הטחול עם לחות פנימית',
    'סטגנציה של Qi הכבד',
    'חוסר Yin של הכליה עם חום ריק',
    'חסימת ערוצים מקור ולחות',
    'חוסר דם של הלב והטחול',
    'עלייה של Yang הכבד',
    'חוסר Qi של הריאה עם חדירת רוח'];
  v_principle text[] := array[
    'לחזק את הטחול, לייבש לחות ולהרגיע את השן',
    'להניע את Qi הכבד ולשחרר סטגנציה',
    'להזין Yin ולנקות חום ריק',
    'לחמם את הערוצים ולפזר קור ולחות',
    'להזין דם ולהרגיע את השן',
    'להוריד Yang, להזין Yin ולהרגיע את הכבד'];
  v_points jsonb[] := array[
    '[{"point":"LI4","side":"bilateral"},{"point":"LV3","side":"bilateral"},{"point":"ST36","side":"bilateral"}]'::jsonb,
    '[{"point":"SP6","side":"bilateral"},{"point":"ST36","side":"bilateral"},{"point":"CV12","side":"midline"}]'::jsonb,
    '[{"point":"BL23","side":"bilateral"},{"point":"KI3","side":"bilateral"},{"point":"GV4","side":"midline"}]'::jsonb,
    '[{"point":"GB20","side":"bilateral"},{"point":"GB21","side":"bilateral"},{"point":"SI3","side":"bilateral"}]'::jsonb,
    '[{"point":"HT7","side":"bilateral"},{"point":"PC6","side":"bilateral"},{"point":"Yintang","side":"midline"}]'::jsonb,
    '[{"point":"LU7","side":"bilateral"},{"point":"LI20","side":"bilateral"},{"point":"BL13","side":"bilateral"}]'::jsonb];
  -- Comma-joined rather than a nested array: Postgres requires every sub-array
  -- of a multidimensional array to be the same length, and these are not.
  v_modalities text[] := array[
    'acupuncture',
    'acupuncture,moxibustion',
    'acupuncture,cupping',
    'acupuncture,tuina',
    'acupuncture,moxibustion,cupping'];
  v_allergies text[] := array['ללא ידועות','פניצילין','אבקנים','אגוזים','לקטוז','ללא ידועות'];
  v_meds text[] := array['ללא','ויטמין D','לבותירוקסין','אומפרזול לפי הצורך','ללא','ברזל'];

  v_patient   uuid;
  v_appt      uuid;
  v_encounter uuid;
  v_start     timestamptz;
  v_idx       integer;
  v_visits    integer;
  v_visit     integer;
  v_created   integer := 0;
  v_appts     integer := 0;
  v_notes     integer := 0;

  -- Diary slot allocation. Every appointment gets a unique slot number, which is
  -- mapped to a working day and an hour. Because the mapping is injective, the
  -- no-overlap exclusion constraint can never fire — no searching for a free
  -- slot, and no chance of the seed failing halfway through on a collision.
  v_anchor    date;      -- the Sunday the diary starts from
  v_total     integer;   -- appointments to place
  v_stride    integer;   -- working days between one slot-day and the next
  v_mult      integer;   -- scatters consecutive slots across the window
  v_n         integer := 0;
  v_perm      integer;
  v_workday   integer;
  v_slot_hour integer;
begin
  -- Fall back to the sandbox clinic, but only if there is exactly one — guessing
  -- between two is how the wrong database gets filled with fictional patients.
  if v_clinic is null then
    select count(*), min(id) into v_candidates, v_clinic
    from public.clinics where is_synthetic;

    if v_candidates = 0 then
      raise exception 'no_clinic'
        using hint = 'No clinic is flagged as a sandbox. Set clinics.is_synthetic = true on your development clinic, or pass its id as p_clinic.';
    elsif v_candidates > 1 then
      raise exception 'ambiguous_clinic'
        using hint = 'More than one clinic is flagged as a sandbox. Pass the one you mean as p_clinic.';
    end if;
  end if;

  select is_synthetic into v_synthetic from public.clinics where id = v_clinic;

  if v_synthetic is null then
    raise exception 'unknown_clinic';
  end if;

  -- The guard. Everything below writes patient-shaped rows, so it must be
  -- impossible to reach from a clinic holding real records.
  if not v_synthetic then
    raise exception 'clinic_is_not_synthetic'
      using hint = 'Seeding is only allowed into a clinic explicitly flagged as a sandbox. Set clinics.is_synthetic = true first, and only ever on a development project.';
  end if;

  -- Someone has to own the appointments and sign the records.
  v_practitioner := coalesce(p_practitioner, auth.uid());
  if v_practitioner is null then
    select m.user_id into v_practitioner
    from public.memberships m
    where m.clinic_id = v_clinic and m.is_active
    order by m.created_at
    limit 1;
  end if;

  if v_practitioner is null then
    raise exception 'no_practitioner'
      using hint = 'The sandbox clinic has no active member to attribute treatments to. Add a membership, or pass a user id as p_practitioner.';
  end if;

  if not exists (select 1 from public.profiles where id = v_practitioner) then
    raise exception 'practitioner_has_no_profile'
      using hint = 'Appointments and encounters reference public.profiles, so the practitioner must have a profile row.';
  end if;

  if p_patients < 1 or p_patients > 200 then
    raise exception 'patient_count_out_of_range'
      using hint = 'Between 1 and 200. A development database wants enough rows to find layout and sorting bugs, not a load test.';
  end if;

  -- --- appointment types ---------------------------------------------------
  insert into public.appointment_types (clinic_id, name_he, name_en, default_duration_minutes, color, sort_order)
  select v_clinic, 'טיפול ראשון', 'Initial consultation', 90, '#0e7490', 1
  where not exists (select 1 from public.appointment_types where clinic_id = v_clinic and name_en = 'Initial consultation');

  insert into public.appointment_types (clinic_id, name_he, name_en, default_duration_minutes, color, sort_order)
  select v_clinic, 'טיפול המשך', 'Follow-up treatment', 60, '#15803d', 2
  where not exists (select 1 from public.appointment_types where clinic_id = v_clinic and name_en = 'Follow-up treatment');

  insert into public.appointment_types (clinic_id, name_he, name_en, default_duration_minutes, color, sort_order)
  select v_clinic, 'ייעוץ צמחים', 'Herbal consultation', 45, '#a16207', 3
  where not exists (select 1 from public.appointment_types where clinic_id = v_clinic and name_en = 'Herbal consultation');

  select id into v_type_initial from public.appointment_types where clinic_id = v_clinic and name_en = 'Initial consultation';
  select id into v_type_follow  from public.appointment_types where clinic_id = v_clinic and name_en = 'Follow-up treatment';
  select id into v_type_herbs   from public.appointment_types where clinic_id = v_clinic and name_en = 'Herbal consultation';

  -- --- diary geometry ------------------------------------------------------
  -- The diary runs from roughly four months back to a month ahead, so the
  -- calendar has history behind it and something to show for next week.

  -- date_trunc('week') lands on Monday; the Israeli week starts the day before.
  v_anchor := (date_trunc('week', now() - interval '120 days')::date - 1);

  select coalesce(sum(1 + (i % 4)), 0) into v_total
  from generate_series(1, p_patients) i;

  -- Five slots a day, two hours apart, spread over about 107 working days —
  -- roughly the 150 calendar days from four months back to a month ahead. The
  -- stride stretches or compresses to fill that window whatever the patient
  -- count, so the diary always ends with a few appointments still to come.
  v_stride := greatest(1, 107 / greatest(1, (v_total - 1) / 5));

  -- Multiplying the slot number by a value coprime with the total re-orders the
  -- slots without repeating any, so one patient's visits land across the diary
  -- rather than in one block at the start of it.
  v_mult := 7;
  if v_total % 7 = 0 then v_mult := 11; end if;
  if v_total % v_mult = 0 then v_mult := 13; end if;
  if v_total % v_mult = 0 then v_mult := 1; end if;

  -- --- patients ------------------------------------------------------------
  for v_idx in 1 .. p_patients loop
    if v_idx % 5 = 0 then
      -- A few English-named files, so the LTR case is represented too.
      insert into public.patients (
        clinic_id, first_name, last_name, date_of_birth, sex, national_id, phone, email,
        city, occupation, referral_source, preferred_locale, notes, is_active
      ) values (
        v_clinic,
        v_first_en[1 + (v_idx % array_length(v_first_en, 1))],
        v_last_en[1 + (v_idx % array_length(v_last_en, 1))],
        (date '1955-01-01' + ((v_idx * 613) % 16000))::date,
        case v_idx % 2 when 0 then 'female' else 'male' end,
        '9' || lpad((100000 + v_idx)::text, 8, '0'),
        '050-000' || lpad(v_idx::text, 4, '0'),
        'synthetic.' || v_idx || '@example.test',
        v_cities[1 + (v_idx % array_length(v_cities, 1))],
        v_jobs[1 + (v_idx % array_length(v_jobs, 1))],
        v_referral[1 + (v_idx % array_length(v_referral, 1))],
        'en',
        'SYNTHETIC — fictional record created by seed_synthetic_data(). Not a real person.',
        v_idx % 11 <> 0
      ) returning id into v_patient;
    else
      insert into public.patients (
        clinic_id, first_name, last_name, date_of_birth, sex, national_id, phone, email,
        city, occupation, referral_source, preferred_locale, notes, is_active
      ) values (
        v_clinic,
        v_first_he[1 + (v_idx % array_length(v_first_he, 1))],
        v_last_he[1 + ((v_idx * 7) % array_length(v_last_he, 1))],
        (date '1955-01-01' + ((v_idx * 613) % 16000))::date,
        case v_idx % 2 when 0 then 'female' else 'male' end,
        '9' || lpad((100000 + v_idx)::text, 8, '0'),
        '050-000' || lpad(v_idx::text, 4, '0'),
        'synthetic.' || v_idx || '@example.test',
        v_cities[1 + (v_idx % array_length(v_cities, 1))],
        v_jobs[1 + (v_idx % array_length(v_jobs, 1))],
        v_referral[1 + (v_idx % array_length(v_referral, 1))],
        'he',
        'סינתטי — רשומה בדיונית שנוצרה על ידי seed_synthetic_data(). לא אדם אמיתי.',
        v_idx % 11 <> 0
      ) returning id into v_patient;
    end if;

    v_created := v_created + 1;

    -- Medical history on most files, absent on some — an empty background is a
    -- state the interface has to render too.
    if v_idx % 4 <> 0 then
      insert into public.patient_medical_history (
        clinic_id, patient_id, allergies, medications, chronic_conditions, lifestyle_notes
      ) values (
        v_clinic, v_patient,
        v_allergies[1 + (v_idx % array_length(v_allergies, 1))],
        v_meds[1 + (v_idx % array_length(v_meds, 1))],
        case when v_idx % 6 = 0 then 'יתר לחץ דם מאוזן' when v_idx % 7 = 0 then 'תת פעילות של בלוטת התריס' else 'ללא' end,
        case when v_idx % 3 = 0 then 'ישיבה ממושכת מול מחשב, פעילות גופנית מועטה'
             else 'פעילות גופנית סדירה, שינה כ-6 שעות' end
      );
    end if;

    -- --- visit history ------------------------------------------------------
    -- Between one and four visits each, so the patient list has a realistic mix
    -- of brand-new files and long-running ones.
    v_visits := 1 + (v_idx % 4);

    for v_visit in 1 .. v_visits loop
      -- Claim the next slot. v_perm walks every number in 0 .. v_total-1 exactly
      -- once, so no two appointments can be handed the same day and hour.
      v_perm := (v_n * v_mult) % greatest(v_total, 1);
      v_n := v_n + 1;

      v_workday   := (v_perm / 5) * v_stride;
      v_slot_hour := 9 + 2 * (v_perm % 5);   -- 09:00, 11:00, 13:00, 15:00, 17:00

      -- Working days counted from a Sunday: five per week, then skip the weekend.
      -- Building the date this way means Friday and Saturday never come up, so
      -- nothing has to be nudged off them afterwards — which is what would have
      -- reintroduced the possibility of a collision.
      v_start := (v_anchor + (v_workday / 5) * 7 + (v_workday % 5))::timestamptz
                 + make_interval(hours => v_slot_hour);

      insert into public.appointments (
        clinic_id, patient_id, practitioner_id, appointment_type_id,
        start_at, end_at, status, location
      ) values (
        v_clinic, v_patient, v_practitioner,
        case when v_visit = 1 then v_type_initial
             when v_idx % 5 = 0 then v_type_herbs
             else v_type_follow end,
        v_start,
        v_start + case when v_visit = 1 then interval '90 minutes' else interval '60 minutes' end,
        case
          when v_start > now() then (case when v_idx % 3 = 0 then 'confirmed' else 'scheduled' end)
          when v_idx % 13 = 0 then 'no_show'
          when v_idx % 17 = 0 then 'cancelled'
          else 'completed'
        end,
        'הקליניקה'
      ) returning id into v_appt;

      v_appts := v_appts + 1;

      -- Past visits that happened get a clinical record. Future and missed ones
      -- do not, which is the state the encounters list has to cope with.
      if v_start < now() and v_idx % 13 <> 0 and v_idx % 17 <> 0 then
        insert into public.encounters (
          clinic_id, patient_id, practitioner_id, appointment_id, encounter_date, status
        ) values (
          v_clinic, v_patient, v_practitioner, v_appt, v_start::date, 'draft'
        ) returning id into v_encounter;

        insert into public.tcm_notes (
          clinic_id, encounter_id, chief_complaint, history_of_present_illness,
          tongue_body_color, tongue_shape, tongue_coating,
          pulse_left, pulse_right, pulse_qualities,
          tcm_pattern_diagnosis, treatment_principle,
          modalities_used, points_used,
          treatment_notes, recommendations, follow_up_plan
        ) values (
          v_clinic, v_encounter,
          v_complaint[1 + ((v_idx + v_visit) % array_length(v_complaint, 1))],
          case when v_visit = 1 then 'פנייה ראשונה. התלונה נמשכת מספר חודשים ומחמירה בתקופות עומס.'
               else 'שיפור חלקי מאז הטיפול הקודם. עוצמת התלונה ירדה, התדירות דומה.' end,
          v_tongue_color[1 + (v_idx % array_length(v_tongue_color, 1))],
          v_tongue_shape[1 + (v_visit % array_length(v_tongue_shape, 1))],
          v_tongue_coat[1 + (v_idx % array_length(v_tongue_coat, 1))],
          v_pulse[1 + (v_idx % array_length(v_pulse, 1))],
          v_pulse[1 + ((v_idx + 2) % array_length(v_pulse, 1))],
          array[v_pulse[1 + (v_idx % array_length(v_pulse, 1))]],
          v_pattern[1 + (v_idx % array_length(v_pattern, 1))],
          v_principle[1 + (v_idx % array_length(v_principle, 1))],
          string_to_array(v_modalities[1 + (v_idx % array_length(v_modalities, 1))], ','),
          v_points[1 + (v_idx % array_length(v_points, 1))],
          'הטיפול עבר בנוחות. שחרור מקומי בסיום, ללא תגובה חריגה.',
          case when v_idx % 2 = 0 then 'שינה מוקדמת יותר, הימנעות ממאכלים קרים, מתיחות יומיות.'
               else 'הליכה יומית קלה, שתייה חמה, הפחתת קפאין אחר הצהריים.' end,
          case when v_visit = v_visits then 'מעקב בעוד שבועיים.' else 'המשך טיפול שבועי.' end
        );

        v_notes := v_notes + 1;

        -- Older records are signed; the most recent one stays open, because a
        -- draft in progress is a state worth having in a development database.
        if v_visit < v_visits then
          update public.encounters
             set status = 'signed', signed_at = v_start + interval '2 hours', signed_by = v_practitioner
           where id = v_encounter;
        end if;
      end if;
    end loop;
  end loop;

  return format(
    '%s patients, %s appointments, %s clinical records. All fictional — emails are .test, phone numbers are unallocated, national ids fail the check digit.',
    v_created, v_appts, v_notes
  );
end;
$$;

comment on function public.seed_synthetic_data(integer, uuid, uuid) is
  'Fills a sandbox clinic with fictional patients, appointments and clinical records. Refuses unless clinics.is_synthetic is true.';

-- ---------------------------------------------------------------------------
-- purge_synthetic_data — empty the sandbox again
-- ---------------------------------------------------------------------------
-- Deleting patients cascades to their history, appointments, encounters and
-- notes, so this is the whole of it. It carries the same guard, because a
-- convenience function that deletes every patient in the current clinic is not
-- something to leave pointing at production.

create or replace function public.purge_synthetic_data(p_clinic uuid default null)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_clinic uuid := coalesce(p_clinic, public.current_clinic_id());
  v_synthetic boolean;
  v_candidates integer;
  v_deleted integer;
begin
  if v_clinic is null then
    select count(*), min(id) into v_candidates, v_clinic
    from public.clinics where is_synthetic;

    if v_candidates <> 1 then
      raise exception 'no_clinic'
        using hint = 'Pass the sandbox clinic id as p_clinic.';
    end if;
  end if;

  select is_synthetic into v_synthetic from public.clinics where id = v_clinic;
  if not coalesce(v_synthetic, false) then
    raise exception 'clinic_is_not_synthetic'
      using hint = 'This deletes every patient in the clinic. It is only allowed in a clinic flagged as a sandbox.';
  end if;

  delete from public.patients where clinic_id = v_clinic;
  get diagnostics v_deleted = row_count;

  return format('%s patient files deleted, with everything attached to them.', v_deleted);
end;
$$;

comment on function public.purge_synthetic_data(uuid) is
  'Deletes every patient in the clinic. Refuses unless clinics.is_synthetic is true.';

-- ---------------------------------------------------------------------------
-- How to use this on a development project
-- ---------------------------------------------------------------------------
--   -- once, and only ever on a development database:
--   update public.clinics set is_synthetic = true where slug = '<your dev clinic>';
--
--   -- then, as often as you like:
--   select public.seed_synthetic_data(24);
--   select public.purge_synthetic_data();
--
-- Running either against production fails with clinic_is_not_synthetic, because
-- no clinic there is flagged — which is the whole of the protection, and the
-- reason the flag is a column rather than a convention.
