-- ============================================================================
--  The shared reference catalogue, and where points sit on the 3D body
-- ============================================================================
--  Run in the Supabase SQL editor after 56_reference_catalogue_to_run.sql.
--  Everything is rolled back at the end; your real data is never touched.
--
--  The promises being tested:
--    1. the seed functions fill the shared catalogue, and a second call
--       updates a row rather than doubling it
--    2. loading the catalogue into a clinic inserts what is missing, fills
--       only empty fields, and never overwrites a practitioner's correction
--    3. a row whose gaps were filled by the load is NOT thereby "confirmed":
--       its needs_review flag survives
--    4. a formula's ingredients are linked, and a missing one becomes a stub
--    5. loading twice changes nothing
--    6. only a member of the clinic (or a platform admin) may load into it;
--       nobody signed in may write the catalogue itself; the signed-out see none
--    7. a point's place on the 3D body is written by a platform admin only,
--       upper-cased, pinned to the midline when midline, and can be removed
--    8. a clinic created today starts with the catalogue in it
-- ============================================================================

begin;

do $test$
declare
  v_clinic     uuid;
  v_new_clinic uuid;
  v_user       uuid := gen_random_uuid();   -- owner of the clinic
  v_admin      uuid := gen_random_uuid();   -- a member who is also a platform admin
  v_stranger   uuid := gen_random_uuid();   -- signed in, member of nothing
  v_newbie     uuid := gen_random_uuid();   -- creates a clinic during the test
  v_result     jsonb;
  v_count      integer;
  v_text       text;
  v_flag       boolean;
  v_x          numeric;
begin
  -- ==========================================================================
  -- Fixtures, as the session role
  -- ==========================================================================
  raise notice '--- fixtures ---';

  insert into public.clinics (name, slug)
  values ('Catalogue Test', 'cat-' || gen_random_uuid())
  returning id into v_clinic;

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values
    (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'cat-u-' || v_user || '@example.test', '', now(), now(), now()),
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'cat-a-' || v_admin || '@example.test', '', now(), now(), now()),
    (v_stranger, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'cat-s-' || v_stranger || '@example.test', '', now(), now(), now()),
    (v_newbie, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'cat-n-' || v_newbie || '@example.test', '', now(), now(), now());

  insert into public.memberships (clinic_id, user_id, role, is_active)
  values (v_clinic, v_user, 'owner', true),
         (v_clinic, v_admin, 'practitioner', true);
  insert into public.platform_admins (user_id) values (v_admin);

  -- ------------------------------------------------------------------------
  -- 1 · The seed functions fill the catalogue; a second call updates in place
  -- ------------------------------------------------------------------------
  perform public.catalogue_upsert_herb('Cat Herb One', '一', 'Botanica una', 'Radix Una', 'Herb one',
    'release_exterior_warm', 'warm', '{acrid}', '{lung}', 'Does one', 'For one', 'Not for one', 3, 9, null);
  perform public.catalogue_upsert_herb('Cat Herb Two', '二', null, null, 'Herb two',
    'release_exterior_warm', 'warm', '{acrid}', '{lung}', 'Does two', 'For two', null, 3, 9, null);
  -- Same herb, different case and a corrected dose: one row, updated.
  perform public.catalogue_upsert_herb('cat herb one', '一', 'Botanica una', 'Radix Una', 'Herb one',
    'release_exterior_warm', 'warm', '{acrid}', '{lung}', 'Does one', 'For one', 'Not for one', 3, 12, null);
  select count(*) into v_count from public.catalogue_herbs where lower(pinyin) = 'cat herb one';
  if v_count <> 1 then raise exception 'FAIL: the herb was seeded % times', v_count; end if;
  select dose_max into v_x from public.catalogue_herbs where lower(pinyin) = 'cat herb one';
  if v_x <> 12 then raise exception 'FAIL: the second seed did not update the row'; end if;

  perform public.catalogue_upsert_formula('Cat Tang', '汤', 'Cat decoction', 'release_exterior', 'Test source',
    'Acts', 'For', 'Not for',
    '[{"h":"Cat Herb One","d":9},{"h":"Cat Herb Missing","d":3,"n":"stub"}]'::jsonb);
  perform public.catalogue_upsert_point('ct1', 'lung', 1, 'Cat One', '猫一', 'Cat point one', 'front', 10, 20, true, 'upper', 'chest', '{}');
  perform public.catalogue_upsert_point('CT2', 'lung', 2, 'Cat Two', '猫二', 'Cat point two', 'front', 12, 22, false, 'center', 'chest', '{}');
  perform public.catalogue_set_point_clinical('CT1', 'Located here', 'Acts', 'For', 'Needle so', 'Careful', '{front_mu}');
  select count(*) into v_count from public.catalogue_points where code = 'CT1';
  if v_count <> 1 then raise exception 'FAIL: the point code was not upper-cased on seed'; end if;
  begin
    perform public.catalogue_set_point_clinical('CT9', 'x', 'x', 'x', 'x');
    raise exception 'FAIL: clinical text was accepted for a point the catalogue does not know';
  exception
    when others then
      if sqlerrm not like 'unknown_point%' then raise; end if;
  end;
  raise notice 'ok   the seed functions fill the catalogue and update in place';

  -- What the clinic already had: a herb with its own words (must survive),
  -- and a stub with empty fields still flagged for review (must stay flagged).
  insert into public.herbs (clinic_id, pinyin_name, functions, needs_review)
  values (v_clinic, 'Cat Herb Two', 'My own words', false);
  insert into public.herbs (clinic_id, pinyin_name, needs_review, data_source)
  values (v_clinic, 'cat herb one', true, 'formula-stub');

  -- ==========================================================================
  -- As the clinic's owner
  -- ==========================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  raise notice '--- as the owner ---';

  -- ------------------------------------------------------------------------
  -- 2–4 · Loading: inserts, fills, links, stubs — and keeps corrections
  -- ------------------------------------------------------------------------
  v_result := public.clinic_load_catalogue();

  -- Everything below asks about this test's own rows, never about totals: the
  -- catalogue is shared, and by the time anyone runs this file again it holds
  -- the real 376 herbs. A test that counted them would fail for being right.
  select count(*) into v_count from public.herbs where clinic_id = v_clinic and lower(pinyin_name) = 'cat herb two';
  if v_count <> 1 then raise exception 'FAIL: the load made % row(s) for a herb the clinic already had', v_count; end if;
  select count(*) into v_count from public.herbs where clinic_id = v_clinic and lower(pinyin_name) = 'cat herb one';
  if v_count <> 1 then raise exception 'FAIL: the load made % row(s) for the stub the clinic already had', v_count; end if;
  select count(*) into v_count from public.herb_formulas where clinic_id = v_clinic and lower(name_pinyin) = 'cat tang';
  if v_count <> 1 then raise exception 'FAIL: the formula arrived % time(s)', v_count; end if;
  select count(*) into v_count from public.acupuncture_points where clinic_id = v_clinic and code in ('CT1', 'CT2');
  if v_count <> 2 then raise exception 'FAIL: % of the 2 points arrived', v_count; end if;

  select functions into v_text from public.herbs where clinic_id = v_clinic and lower(pinyin_name) = 'cat herb two';
  if v_text <> 'My own words' then raise exception 'FAIL: the load overwrote a correction (%)', v_text; end if;
  select english_name into v_text from public.herbs where clinic_id = v_clinic and lower(pinyin_name) = 'cat herb two';
  if v_text <> 'Herb two' then raise exception 'FAIL: the load did not fill an empty field'; end if;

  select functions, needs_review into v_text, v_flag from public.herbs where clinic_id = v_clinic and lower(pinyin_name) = 'cat herb one';
  if v_text <> 'Does one' then raise exception 'FAIL: the stub was not filled from the catalogue'; end if;
  if not v_flag then raise exception 'FAIL: filling the stub cleared its review flag — the load confirmed nothing'; end if;

  select count(*) into v_count from public.herbs where clinic_id = v_clinic and lower(pinyin_name) = 'cat herb missing' and data_source = 'formula-stub';
  if v_count <> 1 then raise exception 'FAIL: the missing ingredient did not become a stub'; end if;
  select count(*) into v_count
    from public.herb_formula_items i
    join public.herb_formulas f on f.id = i.formula_id
   where f.clinic_id = v_clinic and lower(f.name_pinyin) = 'cat tang';
  if v_count <> 2 then raise exception 'FAIL: the formula has % ingredient(s), expected 2', v_count; end if;
  select category, needs_review into v_text, v_flag from public.herb_formulas where clinic_id = v_clinic and lower(name_pinyin) = 'cat tang';
  if v_text <> 'classical' or not v_flag then raise exception 'FAIL: a loaded formula must be classical and flagged for review'; end if;

  select location into v_text from public.acupuncture_points where clinic_id = v_clinic and code = 'CT1';
  if v_text <> 'Located here' then raise exception 'FAIL: the point''s clinical text was not loaded'; end if;
  select bilateral into v_flag from public.acupuncture_points where clinic_id = v_clinic and code = 'CT2';
  if v_flag then raise exception 'FAIL: the midline point was loaded as bilateral'; end if;
  select count(*) into v_count from public.acupuncture_points where clinic_id = v_clinic and code = 'CT1' and 'front_mu' = any(point_categories);
  if v_count <> 1 then raise exception 'FAIL: the point''s categories were not loaded'; end if;
  raise notice 'ok   the load inserts, fills, links and stubs — and keeps corrections';

  -- ------------------------------------------------------------------------
  -- 5 · Twice is the same as once; a later correction still survives
  -- ------------------------------------------------------------------------
  update public.acupuncture_points set location = 'Where I say it is' where clinic_id = v_clinic and code = 'CT1';
  v_result := public.clinic_load_catalogue();
  if (v_result ->> 'herbs_added')::integer + (v_result ->> 'formulas_added')::integer
     + (v_result ->> 'items_added')::integer + (v_result ->> 'points_added')::integer <> 0 then
    raise exception 'FAIL: the second load added rows: %', v_result;
  end if;
  select location into v_text from public.acupuncture_points where clinic_id = v_clinic and code = 'CT1';
  if v_text <> 'Where I say it is' then raise exception 'FAIL: the second load overwrote a corrected point'; end if;
  if (v_result ->> 'catalogue_herbs')::integer < 2 then raise exception 'FAIL: the report miscounts the catalogue: %', v_result; end if;
  raise notice 'ok   loading twice changes nothing';

  -- ------------------------------------------------------------------------
  -- 6 · Who may write what
  -- ------------------------------------------------------------------------
  select count(*) into v_count from public.catalogue_herbs where lower(pinyin) in ('cat herb one', 'cat herb two');
  if v_count <> 2 then raise exception 'FAIL: a member sees % of the 2 catalogue herbs', v_count; end if;
  begin
    insert into public.catalogue_herbs (pinyin) values ('Injected');
    raise exception 'FAIL: a member wrote the shared catalogue';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.catalogue_upsert_herb('Injected', null, null, null, null, null, null, null, null, null, null, null, null, null);
    raise exception 'FAIL: a member ran a catalogue seed function';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.body_point_set('CT1', 'bilateral', -0.1, 0.5, 0.1);
    raise exception 'FAIL: a member who is not a platform admin placed a point on the 3D body';
  exception
    when insufficient_privilege then null;
  end;
  raise notice 'ok   a member reads the catalogue and writes none of it';

  -- ==========================================================================
  -- As a stranger: signed in, member of nothing
  -- ==========================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_stranger, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  raise notice '--- as a stranger ---';
  begin
    perform public.clinic_load_catalogue();
    raise exception 'FAIL: a stranger loaded a catalogue into no clinic';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.clinic_load_catalogue(v_clinic);
    raise exception 'FAIL: a stranger loaded the catalogue into someone else''s clinic';
  exception
    when insufficient_privilege then null;
  end;
  select count(*) into v_count from public.catalogue_herbs;
  if v_count <> 0 then raise exception 'FAIL: a stranger read % catalogue herb(s)', v_count; end if;
  raise notice 'ok   a stranger loads nothing and sees nothing';

  -- ==========================================================================
  -- As an anonymous caller
  -- ==========================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
  raise notice '--- as an anonymous caller ---';
  select count(*) into v_count from public.catalogue_points;
  if v_count <> 0 then raise exception 'FAIL: the signed-out read % catalogue point(s)', v_count; end if;
  select count(*) into v_count from public.body_points;
  if v_count <> 0 then raise exception 'FAIL: the signed-out read % body point(s)', v_count; end if;
  begin
    perform public.clinic_load_catalogue();
    raise exception 'FAIL: the signed-out ran the catalogue load';
  exception
    when insufficient_privilege then null;
  end;
  raise notice 'ok   the signed-out see and load nothing';

  -- ==========================================================================
  -- 7 · As the platform admin: placing points on the 3D body
  -- ==========================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  raise notice '--- as the platform admin ---';

  perform public.body_point_set('ct1', 'bilateral', -0.1, 0.5, 0.1, -1, 0, 0, false, 'first try');
  select x, validated into v_x, v_flag from public.body_points where code = 'CT1';
  if v_x <> -0.1 or v_flag then raise exception 'FAIL: the placement was not stored as given'; end if;
  -- Moving it, and ticking "validated".
  perform public.body_point_set('CT1', 'bilateral', -0.12, 0.5, 0.1, -1, 0, 0, true, 'checked');
  select x, validated into v_x, v_flag from public.body_points where code = 'CT1';
  if v_x <> -0.12 or not v_flag then raise exception 'FAIL: the second placement did not replace the first'; end if;
  select count(*) into v_count from public.body_points where code = 'CT1';
  if v_count <> 1 then raise exception 'FAIL: placing twice made % rows', v_count; end if;
  -- A midline point is pinned to the midline whatever x the click gave.
  perform public.body_point_set('CT2', 'midline', 0.03, 1.2, 0.05);
  select x into v_x from public.body_points where code = 'CT2';
  if v_x <> 0 then raise exception 'FAIL: a midline point kept x = %', v_x; end if;
  -- A bilateral point on the wrong side is refused by the table itself.
  begin
    perform public.body_point_set('CT3', 'bilateral', 0.2, 0.5, 0.1);
    raise exception 'FAIL: a bilateral point was stored on the left';
  exception
    when check_violation then null;
  end;
  if not public.body_point_delete('ct1') then raise exception 'FAIL: the delete found nothing'; end if;
  if public.body_point_delete('CT1') then raise exception 'FAIL: deleting twice found something'; end if;
  raise notice 'ok   a platform admin places, moves, validates and removes points';

  -- ==========================================================================
  -- 8 · A clinic created today starts with the catalogue
  -- ==========================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_newbie, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  raise notice '--- as a new practitioner ---';
  v_new_clinic := public.create_clinic_for_current_user('Newbie Clinic');

  perform set_config('role', 'postgres', true);
  -- Named rows again, not totals: whatever else the catalogue holds by then,
  -- the clinic made a moment ago must hold this test's two herbs, its formula
  -- and its two points.
  select count(*) into v_count from public.herbs
   where clinic_id = v_new_clinic and lower(pinyin_name) in ('cat herb one', 'cat herb two');
  if v_count <> 2 then raise exception 'FAIL: the new clinic has % of the 2 herbs', v_count; end if;
  select count(*) into v_count from public.acupuncture_points
   where clinic_id = v_new_clinic and code in ('CT1', 'CT2');
  if v_count <> 2 then raise exception 'FAIL: the new clinic has % of the 2 points', v_count; end if;
  select count(*) into v_count from public.herb_formulas
   where clinic_id = v_new_clinic and lower(name_pinyin) = 'cat tang';
  if v_count <> 1 then raise exception 'FAIL: the new clinic has % copies of the formula', v_count; end if;
  raise notice 'ok   a new clinic starts with the catalogue';

  raise notice ' ';
  raise notice 'ALL REFERENCE CATALOGUE CHECKS PASSED';
end
$test$;

rollback;
