-- ============================================================================
-- Seed / bootstrap
-- ============================================================================
-- Run this once, AFTER creating your first user in Supabase (Authentication →
-- Users → Add user). It is idempotent: running it twice changes nothing.
--
-- What it does:
--   1. Creates the clinic.
--   2. Makes the first auth user its owner, and gives them Sun–Thu working hours.
--   3. Adds appointment types, a starter herb catalogue and four classical formulas.
--
-- Herb doses below are granule-scale daily amounts, which is how most Israeli
-- practices dispense. Adjust freely — these are a starting point, not a standard.
-- ============================================================================

do $$
declare
  v_clinic uuid;
  v_owner uuid;
  v_formula uuid;
  v_herb_count integer;
begin
  ---------------------------------------------------------------------------
  -- 1. Clinic
  ---------------------------------------------------------------------------
  select id into v_clinic from public.clinics where slug = 'main-clinic';

  if v_clinic is null then
    insert into public.clinics (name, slug, timezone, default_locale)
    values ('הקליניקה שלי', 'main-clinic', 'Asia/Jerusalem', 'he')
    returning id into v_clinic;
  end if;

  ---------------------------------------------------------------------------
  -- 2. Owner membership — the earliest auth user becomes the practitioner
  ---------------------------------------------------------------------------
  select id into v_owner from auth.users order by created_at limit 1;

  if v_owner is null then
    raise notice 'No auth user found. Create one in Authentication -> Users, then run this file again.';
    return;
  end if;

  insert into public.profiles (id, full_name, preferred_locale)
  values (v_owner, 'מטפל/ת', 'he')
  on conflict (id) do nothing;

  insert into public.memberships (clinic_id, user_id, role)
  values (v_clinic, v_owner, 'owner')
  on conflict (clinic_id, user_id) do nothing;

  -- Working hours: Sunday–Thursday, 09:00–17:00 (weekday 0 = Sunday).
  if not exists (
    select 1 from public.practitioner_schedules where practitioner_id = v_owner
  ) then
    insert into public.practitioner_schedules (clinic_id, practitioner_id, weekday, start_time, end_time)
    select v_clinic, v_owner, d, time '09:00', time '17:00'
    from generate_series(0, 4) as d;
  end if;

  ---------------------------------------------------------------------------
  -- 3. Appointment types
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.appointment_types where clinic_id = v_clinic) then
    insert into public.appointment_types
      (clinic_id, name_he, name_en, default_duration_minutes, color, sort_order)
    values
      (v_clinic, 'אבחון ראשוני',        'Initial consultation', 90, '#0ea5e9', 1),
      (v_clinic, 'טיפול המשך',          'Follow-up treatment',  60, '#10b981', 2),
      (v_clinic, 'ייעוץ צמחים',          'Herbal consultation',  45, '#8b5cf6', 3),
      (v_clinic, 'טיפול קצר',            'Short treatment',      30, '#f59e0b', 4);
  end if;

  ---------------------------------------------------------------------------
  -- 4. Starter herb catalogue
  ---------------------------------------------------------------------------
  select count(*) into v_herb_count from public.herbs where clinic_id = v_clinic;

  if v_herb_count = 0 then
    insert into public.herbs
      (clinic_id, pinyin_name, chinese_name, english_name, hebrew_name, category, default_unit,
       properties, functions, cautions, reorder_threshold, reorder_quantity)
    values
      (v_clinic, 'Huang Qi', '黄芪', 'Astragalus root', 'חואנג צ׳י', 'granule', 'gram',
       'מתוק, מעט חמים', 'מחזק צ׳י, מרים צ׳י שקוע, מחזק את הווי צ׳י', 'זהירות בעודף חום או קיפאון', 100, 500),
      (v_clinic, 'Dang Gui', '当归', 'Chinese angelica root', 'דאנג גווי', 'granule', 'gram',
       'מתוק, חריף, חמים', 'מזין דם, מניע דם, מרטיב מעיים', 'זהירות בשלשולים', 100, 500),
      (v_clinic, 'Bai Shao', '白芍', 'White peony root', 'באי שאו', 'granule', 'gram',
       'מר, חמוץ, קריר', 'מזין דם, מרגיע כאב, מרכך את הכבד', null, 100, 500),
      (v_clinic, 'Chuan Xiong', '川芎', 'Szechuan lovage rhizome', 'צ׳ואן שיונג', 'granule', 'gram',
       'חריף, חמים', 'מניע דם וצ׳י, מרגיע כאב ראש', 'זהירות בהריון', 80, 400),
      (v_clinic, 'Shu Di Huang', '熟地黄', 'Prepared rehmannia', 'שו די חואנג', 'granule', 'gram',
       'מתוק, מעט חמים', 'מזין דם ויין, מחזק את הכליות', 'כבד לעיכול, זהירות בלחות', 80, 400),
      (v_clinic, 'Sheng Di Huang', '生地黄', 'Raw rehmannia', 'שנג די חואנג', 'granule', 'gram',
       'מתוק, מר, קר', 'מקרר דם, מזין יין', 'זהירות בטחול חלש', 80, 400),
      (v_clinic, 'Ren Shen', '人参', 'Ginseng root', 'רן שן', 'granule', 'gram',
       'מתוק, מעט מר, מעט חמים', 'מחזק צ׳י מקורי, מייצב', 'לא בעודף חום או יתר לחץ דם לא מאוזן', 50, 200),
      (v_clinic, 'Dang Shen', '党参', 'Codonopsis root', 'דאנג שן', 'granule', 'gram',
       'מתוק, ניטרלי', 'מחזק צ׳י של טחול וריאות', null, 100, 500),
      (v_clinic, 'Bai Zhu', '白术', 'White atractylodes', 'באי ג׳ו', 'granule', 'gram',
       'מר, מתוק, חמים', 'מחזק טחול, מייבש לחות', 'זהירות ביובש יין', 100, 500),
      (v_clinic, 'Fu Ling', '茯苓', 'Poria', 'פו לינג', 'granule', 'gram',
       'מתוק, ניטרלי', 'מנקז לחות, מחזק טחול, מרגיע שן', null, 100, 500),
      (v_clinic, 'Gan Cao', '甘草', 'Licorice root', 'גאן צאו', 'granule', 'gram',
       'מתוק, ניטרלי', 'מתאם נוסחה, מחזק צ׳י, מרגיע כאב', 'זהירות ביתר לחץ דם ובבצקות', 100, 500),
      (v_clinic, 'Chen Pi', '陈皮', 'Tangerine peel', 'צ׳ן פי', 'granule', 'gram',
       'חריף, מר, חמים', 'מניע צ׳י, מייבש לחות, מווסת עיכול', null, 80, 400),
      (v_clinic, 'Ban Xia', '半夏', 'Pinellia rhizome', 'באן שיא', 'granule', 'gram',
       'חריף, חמים, רעיל בגולמי', 'ממיס ליחה, מוריד צ׳י מורד', 'רק בצורה מעובדת, לא בהריון', 60, 300),
      (v_clinic, 'Chai Hu', '柴胡', 'Bupleurum root', 'צ׳אי חו', 'granule', 'gram',
       'מר, חריף, קריר', 'משחרר קיפאון צ׳י כבד, מרים יאנג', 'זהירות ביובש יין', 100, 500),
      (v_clinic, 'Huang Qin', '黄芩', 'Baikal skullcap root', 'חואנג צ׳ין', 'granule', 'gram',
       'מר, קר', 'מנקה חום ולחות, מרגיע שיעול חם', 'לא בקור בטחול', 80, 400),
      (v_clinic, 'Huang Lian', '黄连', 'Coptis rhizome', 'חואנג ליאן', 'granule', 'gram',
       'מר, קר מאוד', 'מנקה חום רעיל, מייבש לחות', 'קר מאוד — שימוש קצר טווח', 50, 200),
      (v_clinic, 'Jin Yin Hua', '金银花', 'Honeysuckle flower', 'ג׳ין ין חואה', 'granule', 'gram',
       'מתוק, קר', 'מנקה חום רעיל, משחרר חיצון', null, 80, 400),
      (v_clinic, 'Lian Qiao', '连翘', 'Forsythia fruit', 'ליאן צ׳יאו', 'granule', 'gram',
       'מר, קריר', 'מנקה חום רעיל, מפזר גושים', null, 80, 400),
      (v_clinic, 'Gui Zhi', '桂枝', 'Cinnamon twig', 'גווי ג׳ה', 'granule', 'gram',
       'חריף, מתוק, חמים', 'משחרר חיצון, מחמם מרידיאנים', 'זהירות בחום ובהריון', 80, 400),
      (v_clinic, 'Sheng Jiang', '生姜', 'Fresh ginger', 'שנג ג׳יאנג', 'granule', 'gram',
       'חריף, חמים', 'מחמם קיבה, עוצר בחילה', null, 60, 300),
      (v_clinic, 'Da Zao', '大枣', 'Jujube fruit', 'דא זאו', 'granule', 'gram',
       'מתוק, חמים', 'מחזק טחול, מזין דם, מרכך נוסחאות', null, 60, 300),
      (v_clinic, 'Suan Zao Ren', '酸枣仁', 'Sour jujube seed', 'סואן זאו רן', 'granule', 'gram',
       'מתוק, חמוץ, ניטרלי', 'מזין דם לב, מרגיע שן, לנדודי שינה', null, 60, 300),
      (v_clinic, 'Mu Dan Pi', '牡丹皮', 'Moutan bark', 'מו דאן פי', 'granule', 'gram',
       'מר, חריף, קריר', 'מקרר דם, מניע דם', 'זהירות בהריון', 60, 300),
      (v_clinic, 'Zhi Zi', '栀子', 'Gardenia fruit', 'ג׳ה זה', 'granule', 'gram',
       'מר, קר', 'מנקה חום, מרגיע עצבנות', 'לא בטחול קר', 60, 300),
      (v_clinic, 'Bo He', '薄荷', 'Field mint', 'בו חה', 'granule', 'gram',
       'חריף, קריר', 'משחרר חיצון, מפזר חום כבד', 'מוסיפים בסוף הבישול', 60, 300),
      (v_clinic, 'Fang Feng', '防风', 'Siler root', 'פאנג פנג', 'granule', 'gram',
       'חריף, מתוק, מעט חמים', 'משחרר רוח, מרגיע כאבי מפרקים', null, 60, 300),
      (v_clinic, 'Gou Qi Zi', '枸杞子', 'Goji berry', 'גואו צ׳י דזה', 'granule', 'gram',
       'מתוק, ניטרלי', 'מזין יין של כבד וכליות, מיטיב עם הראייה', null, 60, 300),
      (v_clinic, 'Shan Yao', '山药', 'Chinese yam', 'שאן יאו', 'granule', 'gram',
       'מתוק, ניטרלי', 'מחזק טחול, ריאות וכליות', null, 80, 400);
  end if;

  ---------------------------------------------------------------------------
  -- 5. Classical formulas
  ---------------------------------------------------------------------------
  if not exists (select 1 from public.herb_formulas where clinic_id = v_clinic) then

    -- Xiao Yao San — Free and Easy Wanderer
    insert into public.herb_formulas
      (clinic_id, name_pinyin, name_chinese, name_english, name_hebrew, category, description, indications, created_by)
    values (v_clinic, 'Xiao Yao San', '逍遥散', 'Free and Easy Wanderer', 'שיאו יאו סאן', 'classical',
            'משחררת קיפאון צ׳י של הכבד, מחזקת טחול ומזינה דם.',
            'עצבנות, מתח, כאבי מחזור, תחושת לחץ בצלעות, עייפות', v_owner)
    returning id into v_formula;

    insert into public.herb_formula_items (clinic_id, formula_id, herb_id, dosage, unit, sequence)
    select v_clinic, v_formula, h.id, d.dosage, 'gram', d.seq
    from (values
      ('Chai Hu', 1.5, 1), ('Dang Gui', 1.5, 2), ('Bai Shao', 1.5, 3),
      ('Bai Zhu', 1.5, 4), ('Fu Ling', 1.5, 5), ('Gan Cao', 0.75, 6),
      ('Bo He', 0.5, 7), ('Sheng Jiang', 0.25, 8)
    ) as d(pinyin, dosage, seq)
    join public.herbs h on h.pinyin_name = d.pinyin and h.clinic_id = v_clinic;

    -- Si Jun Zi Tang — Four Gentlemen
    insert into public.herb_formulas
      (clinic_id, name_pinyin, name_chinese, name_english, name_hebrew, category, description, indications, created_by)
    values (v_clinic, 'Si Jun Zi Tang', '四君子汤', 'Four Gentlemen Decoction', 'סה ג׳ון דזה טאנג', 'classical',
            'הנוסחה הבסיסית לחיזוק צ׳י של הטחול.',
            'עייפות, תיאבון חלש, צואה רכה, קול חלש', v_owner)
    returning id into v_formula;

    insert into public.herb_formula_items (clinic_id, formula_id, herb_id, dosage, unit, sequence)
    select v_clinic, v_formula, h.id, d.dosage, 'gram', d.seq
    from (values
      ('Ren Shen', 1.5, 1), ('Bai Zhu', 1.5, 2), ('Fu Ling', 1.5, 3), ('Gan Cao', 1.5, 4)
    ) as d(pinyin, dosage, seq)
    join public.herbs h on h.pinyin_name = d.pinyin and h.clinic_id = v_clinic;

    -- Gui Zhi Tang — Cinnamon Twig Decoction
    insert into public.herb_formulas
      (clinic_id, name_pinyin, name_chinese, name_english, name_hebrew, category, description, indications, created_by)
    values (v_clinic, 'Gui Zhi Tang', '桂枝汤', 'Cinnamon Twig Decoction', 'גווי ג׳ה טאנג', 'classical',
            'מאזנת בין וויי צ׳י ליינג צ׳י, משחררת תסמונת חיצונית עם הזעה.',
            'הצטננות עם הזעה, צמרמורת, רגישות לרוח', v_owner)
    returning id into v_formula;

    insert into public.herb_formula_items (clinic_id, formula_id, herb_id, dosage, unit, sequence)
    select v_clinic, v_formula, h.id, d.dosage, 'gram', d.seq
    from (values
      ('Gui Zhi', 1.5, 1), ('Bai Shao', 1.5, 2), ('Sheng Jiang', 1.0, 3),
      ('Da Zao', 1.0, 4), ('Gan Cao', 1.0, 5)
    ) as d(pinyin, dosage, seq)
    join public.herbs h on h.pinyin_name = d.pinyin and h.clinic_id = v_clinic;

    -- Yin Qiao San — Honeysuckle and Forsythia Powder
    insert into public.herb_formulas
      (clinic_id, name_pinyin, name_chinese, name_english, name_hebrew, category, description, indications, created_by)
    values (v_clinic, 'Yin Qiao San', '银翘散', 'Honeysuckle and Forsythia Powder', 'ין צ׳יאו סאן', 'classical',
            'מנקה חום רעיל ומשחררת תסמונת חיצונית חמה.',
            'כאב גרון, חום, התחלת הצטננות עם חום', v_owner)
    returning id into v_formula;

    insert into public.herb_formula_items (clinic_id, formula_id, herb_id, dosage, unit, sequence)
    select v_clinic, v_formula, h.id, d.dosage, 'gram', d.seq
    from (values
      ('Jin Yin Hua', 2.0, 1), ('Lian Qiao', 2.0, 2), ('Bo He', 1.0, 3), ('Gan Cao', 1.0, 4)
    ) as d(pinyin, dosage, seq)
    join public.herbs h on h.pinyin_name = d.pinyin and h.clinic_id = v_clinic;

  end if;

  raise notice 'Seed complete. Clinic %, owner %.', v_clinic, v_owner;
end;
$$;
