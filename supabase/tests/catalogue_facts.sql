-- ============================================================================
--  The facts-based catalogue: the import, and the refresh of unconfirmed rows
-- ============================================================================
--  Run in the Supabase SQL editor after 57_catalogue_facts_to_run.sql.
--  Everything is rolled back at the end; your real data is never touched.
--
--  The promises being tested:
--    1. catalogue_import replaces the text of a catalogue row, fills the names
--       it lacked, keeps the ones it had, and inserts what is new; a point the
--       catalogue does not know is counted, not invented
--    2. only a platform admin may import; a clinic member is refused
--    3. clinic_refresh_catalogue_text gives an unconfirmed clinic row the new
--       text, the English, the sources and the Hebrew name — and its
--       ingredient list — while a row a practitioner approved, or edited by
--       hand, keeps its words
--    4. the refresh does not "confirm" what it touched: needs_review stays
--    5. a member of another clinic cannot refresh this one
-- ============================================================================

begin;

do $test$
declare
  v_clinic     uuid;
  v_other      uuid;
  v_user       uuid := gen_random_uuid();   -- owner of the clinic
  v_admin      uuid := gen_random_uuid();   -- a member who is also a platform admin
  v_outsider   uuid := gen_random_uuid();   -- owner of another clinic
  v_result     jsonb;
  v_count      integer;
  v_text       text;
  v_json       jsonb;
  v_flag       boolean;
  v_formula    uuid;
begin
  raise notice '--- fixtures ---';

  insert into public.clinics (name, slug) values ('Facts Test', 'facts-' || gen_random_uuid()) returning id into v_clinic;
  insert into public.clinics (name, slug) values ('Facts Other', 'facts-o-' || gen_random_uuid()) returning id into v_other;

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values
    (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'facts-u-' || v_user || '@example.test', '', now(), now(), now()),
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'facts-a-' || v_admin || '@example.test', '', now(), now(), now()),
    (v_outsider, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'facts-o-' || v_outsider || '@example.test', '', now(), now(), now());

  insert into public.memberships (clinic_id, user_id, role, is_active)
  values (v_clinic, v_user, 'owner', true), (v_clinic, v_admin, 'practitioner', true), (v_other, v_outsider, 'owner', true);
  insert into public.platform_admins (user_id) values (v_admin);

  -- The bundled catalogue as migration 56 seeds it: English text, a Chinese name, no Hebrew.
  perform public.catalogue_upsert_herb('Facts Herb One', '一', 'Botanica una', 'Radix Una', 'Herb one',
    'tonify_qi', 'warm', '{sweet}', '{spleen}', 'Bundled actions', 'Bundled indications', 'Bundled cautions', 3, 9, null);
  perform public.catalogue_upsert_herb('Facts Herb Two', '二', null, null, 'Herb two',
    'tonify_qi', 'warm', '{sweet}', '{spleen}', 'Bundled two', 'For two', null, 3, 9, null);
  perform public.catalogue_upsert_formula('Facts Tang', '汤', 'Facts decoction', 'tonify', 'A classic',
    'Bundled acts', 'Bundled for', 'Bundled not for', '[{"h":"Facts Herb One","d":9}]'::jsonb);
  perform public.catalogue_upsert_point('FT1', 'lung', 1, 'Facts One', '一', 'Facts point', 'front', 10, 20, true, 'upper', 'chest', '{}');
  perform public.catalogue_set_point_clinical('FT1', 'Bundled location', 'Bundled acts', 'Bundled for', 'Bundled needle', null, '{front_mu}');

  -- ==========================================================================
  -- As the platform admin: the import
  -- ==========================================================================
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  raise notice '--- as the platform admin ---';

  v_result := public.catalogue_import('herbs', '[
    {"pinyin":"facts herb one","hebrew":"צמח אחד","tcm_category":"tonify_qi","temperature":"slightly_warm","tastes":["sweet","bitter"],"channels":["spleen","lung"],
     "actions":"• מחזק צ׳י","indications":"• עייפות","cautions":"","dose_min":6,"dose_max":15,"dosage_notes":"",
     "text_en":{"functions":"• Tonifies Qi","indications":"• Fatigue","cautions":""},
     "sources":[{"name":"bara","url":"https://barapro.co.il/x"},{"name":"americandragon","url":"https://www.americandragon.com/y"}],
     "source":"facts:bara+americandragon"},
    {"pinyin":"Facts Herb New","chinese":"新","actions":"• חדש","indications":"","cautions":"","text_en":{"functions":"• New"},"sources":[],"source":"facts:bara"}
  ]'::jsonb);
  if (v_result ->> 'updated')::integer <> 1 or (v_result ->> 'inserted')::integer <> 1 then
    raise exception 'FAIL: herbs import counted %', v_result;
  end if;
  select actions into v_text from public.catalogue_herbs where lower(pinyin) = 'facts herb one';
  if v_text <> '• מחזק צ׳י' then raise exception 'FAIL: the import did not replace the actions (got %)', v_text; end if;
  select cautions into v_text from public.catalogue_herbs where lower(pinyin) = 'facts herb one';
  if v_text is not null then raise exception 'FAIL: an empty caution from the sources should leave the field empty, got %', v_text; end if;
  select hebrew into v_text from public.catalogue_herbs where lower(pinyin) = 'facts herb one';
  if v_text <> 'צמח אחד' then raise exception 'FAIL: the Hebrew name was not filled'; end if;
  select english into v_text from public.catalogue_herbs where lower(pinyin) = 'facts herb one';
  if v_text <> 'Herb one' then raise exception 'FAIL: a name the sources did not give was lost'; end if;
  select temperature into v_text from public.catalogue_herbs where lower(pinyin) = 'facts herb one';
  if v_text <> 'slightly_warm' then raise exception 'FAIL: the temperature was not taken from the sources'; end if;
  select text_en ->> 'functions' into v_text from public.catalogue_herbs where lower(pinyin) = 'facts herb one';
  if v_text <> '• Tonifies Qi' then raise exception 'FAIL: the English was not stored'; end if;
  select count(*) into v_count from public.catalogue_herbs where lower(pinyin) = 'facts herb new';
  if v_count <> 1 then raise exception 'FAIL: the new herb was not inserted'; end if;

  -- An import of structured fields alone (build.mjs --fields-only): it carries
  -- no text keys at all, and must leave the clinical text exactly as it is.
  v_result := public.catalogue_import('herbs', '[
    {"pinyin":"Facts Herb Two","hebrew":"צמח שני","temperature":"cool","tastes":["bitter"],"dose_min":5,"dose_max":10,
     "sources":[{"name":"bara","url":"https://barapro.co.il/two"}],"source":"facts:bara"}
  ]'::jsonb);
  select actions into v_text from public.catalogue_herbs where lower(pinyin) = 'facts herb two';
  if v_text is distinct from 'Bundled two' then
    raise exception 'FAIL: a fields-only import overwrote the text (got %)', v_text;
  end if;
  select temperature into v_text from public.catalogue_herbs where lower(pinyin) = 'facts herb two';
  if v_text <> 'cool' then raise exception 'FAIL: a fields-only import did not change the temperature'; end if;
  select hebrew into v_text from public.catalogue_herbs where lower(pinyin) = 'facts herb two';
  if v_text <> 'צמח שני' then raise exception 'FAIL: a fields-only import did not fill the Hebrew name'; end if;
  raise notice 'ok   an import of structured fields alone leaves the clinical text alone';

  v_result := public.catalogue_import('formulas', '[
    {"pinyin":"Facts Tang","actions":"• פעולה","indications":"• התוויה","contraindications":"",
     "items":[{"h":"Facts Herb One","d":6},{"h":"Facts Herb Two","d":3,"n":"TR"}],
     "text_en":{"actions":"• Acts"},"sources":[{"name":"bara","url":"https://barapro.co.il/f"}],"source":"facts:bara"}
  ]'::jsonb);
  if (v_result ->> 'updated')::integer <> 1 then raise exception 'FAIL: formula import counted %', v_result; end if;
  select jsonb_array_length(items) into v_count from public.catalogue_formulas where lower(pinyin) = 'facts tang';
  if v_count <> 2 then raise exception 'FAIL: the formula items were not replaced (got %)', v_count; end if;
  select source_text into v_text from public.catalogue_formulas where lower(pinyin) = 'facts tang';
  if v_text <> 'A classic' then raise exception 'FAIL: the classical source the sources did not give was lost'; end if;

  v_result := public.catalogue_import('points', '[
    {"code":"ft1","location":"• מיקום","actions":"• פעולה","indications":"• התוויה","needling":"• דיקור","cautions":"",
     "text_en":{"location":"• Location"},"sources":[],"source":"facts:americandragon"},
    {"code":"FT9","location":"x","actions":"x","indications":"x","needling":"x","cautions":"x"}
  ]'::jsonb);
  if (v_result ->> 'updated')::integer <> 1 or (v_result ->> 'unknown')::integer <> 1 then
    raise exception 'FAIL: points import counted %', v_result;
  end if;
  select count(*) into v_count from public.catalogue_points where code = 'FT9';
  if v_count <> 0 then raise exception 'FAIL: an unknown point was invented'; end if;
  raise notice 'ok   the import replaces text, fills names, inserts what is new, refuses unknown points';

  -- ==========================================================================
  -- As the owner (a member, not an admin): the import is refused
  -- ==========================================================================
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  raise notice '--- as the owner ---';
  begin
    perform public.catalogue_import('herbs', '[{"pinyin":"Sneaky"}]'::jsonb);
    raise exception 'FAIL: a clinic member imported into the shared catalogue';
  exception
    when insufficient_privilege then null;
  end;
  raise notice 'ok   only a platform admin may import';

  -- The clinic before the refresh: the loader's copy of the bundled text, an
  -- approved row, and a row edited by hand.
  v_result := public.clinic_load_catalogue(v_clinic);
  -- (the load happens as the owner, through the same path the button uses)
  perform set_config('role', 'authenticated', true);
  update public.herbs set needs_review = false, reviewed_at = now(), reviewed_by = v_user, reviewed_by_name = 'Owner',
         functions = 'Approved words'
   where clinic_id = v_clinic and lower(pinyin_name) = 'facts herb two';
  select count(*) into v_count from public.herbs where clinic_id = v_clinic and lower(pinyin_name) = 'facts herb one' and needs_review;
  if v_count <> 1 then raise exception 'FAIL: the loaded row should still be unconfirmed'; end if;

  v_result := public.clinic_refresh_catalogue_text(v_clinic);
  if (v_result ->> 'herbs_refreshed')::integer < 1 then raise exception 'FAIL: the refresh touched no herb: %', v_result; end if;

  select functions into v_text from public.herbs where clinic_id = v_clinic and lower(pinyin_name) = 'facts herb one';
  if v_text <> '• מחזק צ׳י' then raise exception 'FAIL: the unconfirmed row did not get the new text (got %)', v_text; end if;
  select hebrew_name into v_text from public.herbs where clinic_id = v_clinic and lower(pinyin_name) = 'facts herb one';
  if v_text <> 'צמח אחד' then raise exception 'FAIL: the Hebrew name did not reach the clinic'; end if;
  select text_en ->> 'functions' into v_text from public.herbs where clinic_id = v_clinic and lower(pinyin_name) = 'facts herb one';
  if v_text <> '• Tonifies Qi' then raise exception 'FAIL: the English did not reach the clinic'; end if;
  select needs_review into v_flag from public.herbs where clinic_id = v_clinic and lower(pinyin_name) = 'facts herb one';
  if not v_flag then raise exception 'FAIL: the refresh confirmed a row nobody approved'; end if;
  select functions into v_text from public.herbs where clinic_id = v_clinic and lower(pinyin_name) = 'facts herb two';
  if v_text <> 'Approved words' then raise exception 'FAIL: an approved row was overwritten'; end if;

  select id into v_formula from public.herb_formulas where clinic_id = v_clinic and lower(name_pinyin) = 'facts tang';
  select count(*) into v_count from public.herb_formula_items where formula_id = v_formula;
  if v_count <> 2 then raise exception 'FAIL: the formula items were not replaced in the clinic (got %)', v_count; end if;
  select location into v_text from public.acupuncture_points where clinic_id = v_clinic and code = 'FT1';
  if v_text <> '• מיקום' then raise exception 'FAIL: the point text was not refreshed'; end if;
  raise notice 'ok   the refresh rewrites unconfirmed rows, keeps approved ones, and does not confirm anything';

  -- Editing by hand after the refresh clears the flag, and a second refresh leaves the edit alone.
  update public.herbs set functions = 'Edited by hand' where clinic_id = v_clinic and lower(pinyin_name) = 'facts herb one';
  select needs_review into v_flag from public.herbs where clinic_id = v_clinic and lower(pinyin_name) = 'facts herb one';
  if v_flag then raise exception 'FAIL: a clinical edit should clear needs_review'; end if;
  v_result := public.clinic_refresh_catalogue_text(v_clinic);
  select functions into v_text from public.herbs where clinic_id = v_clinic and lower(pinyin_name) = 'facts herb one';
  if v_text <> 'Edited by hand' then raise exception 'FAIL: a hand-edited row was overwritten by the second refresh'; end if;
  raise notice 'ok   a hand edit survives the next refresh';

  -- ==========================================================================
  -- As the other clinic's owner: hands off
  -- ==========================================================================
  perform set_config('request.jwt.claims', json_build_object('sub', v_outsider, 'role', 'authenticated')::text, true);
  raise notice '--- as another clinic''s owner ---';
  begin
    perform public.clinic_refresh_catalogue_text(v_clinic);
    raise exception 'FAIL: another clinic refreshed this one';
  exception
    when insufficient_privilege then null;
  end;
  raise notice 'ok   a member of another clinic cannot refresh this one';

  raise notice 'ALL PASSED — rolling back';
end
$test$;

rollback;
