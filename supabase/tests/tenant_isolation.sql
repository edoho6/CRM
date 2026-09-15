-- ============================================================================
--  Tenant isolation — proving the policies, not just reading them
-- ============================================================================
--  Paste into the Supabase SQL editor and run. It builds two throwaway clinics
--  with a patient each plus a portal patient, impersonates each identity in turn,
--  and asserts that everything belonging to anyone else is invisible.
--
--  Everything is rolled back at the end, so it leaves no trace whatever the
--  result. Your real data is never touched: the fixtures live and die inside the
--  transaction.
--
--  A pass ends with ALL TENANT ISOLATION CHECKS PASSED in the Messages/Notices
--  pane. A failure aborts with a message naming exactly what leaked.
--
--  Why this file exists: Row Level Security is the whole of the isolation story.
--  Reading the policies and agreeing with them is not the same as proving that a
--  query run as one clinic returns nothing belonging to another — and the gap
--  between those two things is precisely where this class of bug lives. Re-run it
--  after any migration that adds a table or touches a policy.
-- ============================================================================

begin;

do $test$
declare
  v_clinic_a   uuid;
  v_clinic_b   uuid;
  v_user_a     uuid := gen_random_uuid();  -- owner of clinic A
  v_user_b     uuid := gen_random_uuid();  -- owner of clinic B
  v_user_p     uuid := gen_random_uuid();  -- portal patient, linked to A's patient
  v_patient_a  uuid;
  v_patient_b  uuid;
  v_encounter  uuid;
  v_doc_shared uuid;
  v_doc_private uuid;
  v_package_a uuid;
  v_package_b uuid;
  v_consent_a uuid;
  v_room_a    uuid;
  v_room_b    uuid;
  v_tag_a     uuid;
  v_tag_b     uuid;
  v_feed_a    uuid;
  v_feed_b    uuid;
  v_confirm_a uuid;
  v_confirm_b uuid;
  v_shop_store uuid;
  v_shop_product uuid;
  v_shop_fp    text := 'iso|' || gen_random_uuid();  -- the product's fingerprint, shared with its offer
  v_med        uuid;                                   -- one entry of the Western medicine reference
  v_lib        uuid;                                   -- one source of the professional library
  v_chat_a     uuid;                                   -- clinic A's owner's conversation with the library
  -- A unit vector to search the library with; what it finds is beside the point,
  -- who is allowed to search at all is the point.
  v_probe_vec  extensions.vector(1024) := ('[1' || repeat(',0', 1023) || ']')::extensions.vector(1024);
  v_user_c     uuid := gen_random_uuid();  -- a stranger with an account and no clinic
  v_invite_a   uuid;
  v_invite_b   uuid;
  v_owner_a    uuid;
  v_count      integer;
begin
  -- ==========================================================================
  -- Fixtures — created as the session role, which owns the tables and so is
  -- not subject to RLS. That is the point: the setup must be able to write
  -- rows the tests will then try, and fail, to reach.
  -- ==========================================================================
  raise notice '--- fixtures ---';

  insert into public.clinics (name, slug)
  values ('Isolation Test A', 'iso-a-' || gen_random_uuid())
  returning id into v_clinic_a;

  insert into public.clinics (name, slug)
  values ('Isolation Test B', 'iso-b-' || gen_random_uuid())
  returning id into v_clinic_b;

  -- profiles references auth.users, so the fixture identities must exist there
  -- first. The on_auth_user_created trigger fills public.profiles for us.
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values
    (v_user_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'iso-a-' || v_user_a || '@example.test', '', now(), now(), now()),
    (v_user_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'iso-b-' || v_user_b || '@example.test', '', now(), now(), now()),
    (v_user_p, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'iso-p-' || v_user_p || '@example.test', '', now(), now(), now()),
    (v_user_c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'iso-c-' || v_user_c || '@example.test', '', now(), now(), now());

  insert into public.memberships (clinic_id, user_id, role, is_active)
  values (v_clinic_a, v_user_a, 'owner', true),
         (v_clinic_b, v_user_b, 'owner', true);

  insert into public.patients (clinic_id, first_name, last_name)
  values (v_clinic_a, 'Alice', 'ClinicA') returning id into v_patient_a;

  insert into public.patients (clinic_id, first_name, last_name)
  values (v_clinic_b, 'Bob', 'ClinicB') returning id into v_patient_b;

  insert into public.patient_medical_history (clinic_id, patient_id, allergies)
  values (v_clinic_a, v_patient_a, 'Isolation test allergy');

  insert into public.herbs (clinic_id, pinyin_name) values (v_clinic_a, 'Iso Test Herb A');
  insert into public.herbs (clinic_id, pinyin_name) values (v_clinic_b, 'Iso Test Herb B');

  -- A phone registered for notifications in each clinic.
  insert into public.device_push_tokens (user_id, clinic_id, app, platform, token)
  values (v_user_a, v_clinic_a, 'clinic', 'ios', 'iso-token-a-' || v_user_a::text),
         (v_user_b, v_clinic_b, 'clinic', 'ios', 'iso-token-b-' || v_user_b::text);

  insert into public.encounters (clinic_id, patient_id, practitioner_id)
  values (v_clinic_a, v_patient_a, v_user_a) returning id into v_encounter;

  insert into public.tcm_notes (clinic_id, encounter_id, chief_complaint)
  values (v_clinic_a, v_encounter, 'Isolation test note');
  insert into public.encounter_signatures (clinic_id, encounter_id, signed_at, signed_by, reopened_by, reason)
  values (v_clinic_a, v_encounter, now() - interval '1 day', v_user_a, v_user_a, 'Isolation test reopening');

  -- A punch card in each clinic, and a redemption against B's, so the
  -- balances view has something to leak if it is going to.
  insert into public.patient_packages (clinic_id, patient_id, name, total_sessions)
  values (v_clinic_a, v_patient_a, 'Iso Card A', 3) returning id into v_package_a;

  insert into public.patient_packages (clinic_id, patient_id, name, total_sessions)
  values (v_clinic_b, v_patient_b, 'Iso Card B', 3) returning id into v_package_b;

  insert into public.package_redemptions (clinic_id, package_id)
  values (v_clinic_b, v_package_b);

  -- A signed consent in each. The signature is the evidence; it must not be
  -- readable across a tenant boundary any more than the decision is.
  insert into public.patient_consents (clinic_id, patient_id, kind, granted, method)
  values (v_clinic_a, v_patient_a, 'treatment', true, 'in_person')
  returning id into v_consent_a;

  insert into public.signatures (clinic_id, patient_id, consent_id, method, content)
  values (v_clinic_a, v_patient_a, v_consent_a, 'typed', 'Alice ClinicA');

  insert into public.patient_consents (clinic_id, patient_id, kind, granted, method)
  values (v_clinic_b, v_patient_b, 'treatment', true, 'in_person');

  insert into public.signatures (clinic_id, patient_id, consent_id, method, content)
  select v_clinic_b, v_patient_b, c.id, 'typed', 'Bob ClinicB'
  from public.patient_consents c
  where c.clinic_id = v_clinic_b limit 1;

  -- A treatment confirmation in each: a statement about a named patient, which
  -- is as identifying as the record it summarises.
  insert into public.treatment_confirmations
    (clinic_id, patient_id, practitioner_id, treatment_dates,
     practitioner_name, patient_name)
  values (v_clinic_a, v_patient_a, v_user_a, array[current_date]::date[],
          'Practitioner A', 'Alice ClinicA');

  insert into public.treatment_confirmations
    (clinic_id, patient_id, practitioner_id, treatment_dates,
     practitioner_name, patient_name)
  values (v_clinic_b, v_patient_b, v_user_b, array[current_date]::date[],
          'Practitioner B', 'Bob ClinicB');

  -- A protocol in each clinic. Not patient data, but it is a practitioner's
  -- clinical working material and has exactly the same reason to stay put.
  insert into public.treatment_protocols (clinic_id, name, indications)
  values (v_clinic_a, 'Iso Protocol A', 'Isolation test');

  insert into public.treatment_protocols (clinic_id, name, indications)
  values (v_clinic_b, 'Iso Protocol B', 'Isolation test');

  -- Working hours and a closure for each owner, for the same reason: the diary
  -- is a schedule of when a named person is at work.
  insert into public.practitioner_schedules (clinic_id, practitioner_id, weekday, start_time, end_time)
  values (v_clinic_a, v_user_a, 0, '09:00', '17:00'),
         (v_clinic_b, v_user_b, 0, '09:00', '17:00');

  insert into public.schedule_exceptions (clinic_id, practitioner_id, date, is_closed, reason)
  values (v_clinic_a, v_user_a, current_date + 30, true, 'Iso closure A'),
         (v_clinic_b, v_user_b, current_date + 30, true, 'Iso closure B');

  insert into public.patient_documents (clinic_id, patient_id, file_path, file_name, shared_with_patient)
  values (v_clinic_a, v_patient_a, v_clinic_a || '/' || v_patient_a || '/shared.pdf', 'shared.pdf', true)
  returning id into v_doc_shared;

  insert into public.patient_documents (clinic_id, patient_id, file_path, file_name, shared_with_patient)
  values (v_clinic_a, v_patient_a, v_clinic_a || '/' || v_patient_a || '/private.pdf', 'private.pdf', false)
  returning id into v_doc_private;

  -- The portal patient: an auth user with no membership, linked to A's patient.
  insert into public.patient_portal_access (clinic_id, patient_id, user_id, email, activated_at)
  values (v_clinic_a, v_patient_a, v_user_p, 'iso-p-' || v_user_p || '@example.test', now());

  -- Rooms, tags and calendar feeds: one of each per clinic. A room name or a
  -- tag says something about the practice; a feed token opens the whole diary.
  insert into public.rooms (clinic_id, name)
  values (v_clinic_a, 'Iso Room A') returning id into v_room_a;

  insert into public.rooms (clinic_id, name)
  values (v_clinic_b, 'Iso Room B') returning id into v_room_b;

  insert into public.patient_tags (clinic_id, name)
  values (v_clinic_a, 'Iso Tag A') returning id into v_tag_a;

  insert into public.patient_tags (clinic_id, name)
  values (v_clinic_b, 'Iso Tag B') returning id into v_tag_b;

  insert into public.patient_tag_links (clinic_id, patient_id, tag_id)
  values (v_clinic_a, v_patient_a, v_tag_a),
         (v_clinic_b, v_patient_b, v_tag_b);

  insert into public.calendar_feeds (clinic_id, practitioner_id)
  values (v_clinic_a, v_user_a) returning token into v_feed_a;

  insert into public.calendar_feeds (clinic_id, practitioner_id)
  values (v_clinic_b, v_user_b) returning token into v_feed_b;

  insert into public.locations (clinic_id, name)
  values (v_clinic_a, 'Iso Location A'), (v_clinic_b, 'Iso Location B');

  -- The booking page is open for clinic A, under a handle the anonymous
  -- checks below will use.
  update public.clinics set booking_enabled = true, booking_slug = 'iso-book-a' where id = v_clinic_a;

  -- Hours away, and a queued reminder, in each clinic: a block names where a
  -- person is not, and a reminder carries a patient's number.
  insert into public.schedule_blocks (clinic_id, practitioner_id, start_at, end_at, reason)
  values (v_clinic_a, v_user_a, now() + interval '3 days', now() + interval '3 days 1 hour', 'Iso block A'),
         (v_clinic_b, v_user_b, now() + interval '3 days', now() + interval '3 days 1 hour', 'Iso block B');

  insert into public.message_log (clinic_id, channel, template_key, recipient, body, patient_id)
  values (v_clinic_a, 'whatsapp', 'iso_test', '0500000000', 'Iso message A', v_patient_a),
         (v_clinic_b, 'whatsapp', 'iso_test', '0500000001', 'Iso message B', v_patient_b);

  -- How each clinic wants its automated messages: a row each, and a birthday
  -- today with consent in B, so the automations job has something of B's to
  -- queue that A must then not see.
  insert into public.clinic_automations (clinic_id, kind, enabled, send_hour)
  values (v_clinic_a, 'birthday', true, 6),
         (v_clinic_b, 'birthday', true, 6);
  update public.patients set date_of_birth = (now() at time zone 'Asia/Jerusalem')::date - interval '30 years'
   where id = v_patient_b;
  insert into public.patient_consents (clinic_id, patient_id, kind, granted, method)
  values (v_clinic_b, v_patient_b, 'marketing', true, 'in_person');

  -- A WhatsApp thread in each clinic, with a message from the patient.
  insert into public.whatsapp_conversations (clinic_id, contact_key, phone, patient_id)
  values (v_clinic_a, '972500000000', '972500000000', v_patient_a),
         (v_clinic_b, '972500000001', '972500000001', v_patient_b);
  insert into public.whatsapp_messages (clinic_id, conversation_id, direction, kind, body, status)
  select c.clinic_id, c.id, 'in', 'text', 'Iso chat ' || c.contact_key, 'received'
    from public.whatsapp_conversations c where c.clinic_id in (v_clinic_a, v_clinic_b);

  -- A booking in each room, so the feeds and the confirmation link have
  -- something to leak if they were going to.
  insert into public.appointments (clinic_id, patient_id, practitioner_id, room_id, start_at, end_at)
  values (v_clinic_a, v_patient_a, v_user_a, v_room_a, now() + interval '2 days', now() + interval '2 days 1 hour')
  returning confirmation_token into v_confirm_a;

  insert into public.appointments (clinic_id, patient_id, practitioner_id, room_id, start_at, end_at)
  values (v_clinic_b, v_patient_b, v_user_b, v_room_b, now() + interval '2 days', now() + interval '2 days 1 hour')
  returning confirmation_token into v_confirm_b;

  -- The price comparison's tables belong to no clinic: one shop, one product
  -- and one price, which every clinic member should see and no one may write.
  insert into public.shop_stores (slug, name, base_url, platform, status)
  values ('iso-shop-' || gen_random_uuid(), 'Iso Shop', 'https://example.test', 'woocommerce', 'active')
  returning id into v_shop_store;

  insert into public.shop_products (fingerprint, display_item, item_key, canonical_name, category)
  values (v_shop_fp, 'Needle', 'needle', 'Iso · Needle · 0.25×40 mm (100)', 'needles')
  returning id into v_shop_product;

  insert into public.shop_offers (store_id, product_id, external_id, raw_name, url, fingerprint, price)
  values (v_shop_store, v_shop_product, 'iso-1', 'Iso needle', 'https://example.test/p/1', v_shop_fp, 42);

  -- The Western medicine reference is shared the same way as the shops.
  insert into public.med_entries (kind, slug, name_en, name_he, status)
  values ('drug', 'iso-drug', 'Iso drug', 'תרופת בדיקה', 'draft')
  returning id into v_med;

  -- The shared reference catalogue and the 3D body's coordinates (migration
  -- 56) are shared the same way: members read, nobody signed in writes.
  insert into public.catalogue_herbs (pinyin, english) values ('Iso Catalogue Herb', 'Isolation herb');
  insert into public.body_points (code, side_type, x, y, z) values ('ISO1', 'bilateral', -0.1, 0.5, 0.1);

  -- The professional library too: one source with one passage, so that the
  -- search itself can be asked, as each identity, whether it answers.
  insert into public.library_sources (kind, locator, title)
  values ('file', 'iso-library-source', 'Iso source')
  returning id into v_lib;
  insert into public.library_chunks (source_id, ordinal, page, content, tokens, embedding)
  values (v_lib, 0, 1, 'An isolation passage about the word zzzisolationword.', 8, v_probe_vec);

  -- An open invitation in each clinic. The link is the whole secret.
  insert into public.clinic_invitations (clinic_id, role, invitee_name, invited_by)
  values (v_clinic_a, 'practitioner', 'Iso Invitee A', v_user_a) returning token into v_invite_a;
  insert into public.clinic_invitations (clinic_id, role, invitee_name, invited_by)
  values (v_clinic_b, 'staff', 'Iso Invitee B', v_user_b) returning token into v_invite_b;
  select id into v_owner_a from public.memberships where clinic_id = v_clinic_a and user_id = v_user_a;

  raise notice 'clinic A = %', v_clinic_a;
  raise notice 'clinic B = %', v_clinic_b;

  -- ==========================================================================
  -- Identity 1 · clinic A's owner
  -- ==========================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  raise notice '--- as clinic A ---';

  -- The helper resolves from the membership, not from anything the caller sends.
  if public.current_clinic_id() is distinct from v_clinic_a then
    raise exception 'FAIL: current_clinic_id() returned %, expected %',
      public.current_clinic_id(), v_clinic_a;
  end if;
  raise notice 'ok   current_clinic_id resolves from the membership';

  select count(*) into v_count from public.patients where id = v_patient_a;
  if v_count <> 1 then raise exception 'FAIL: clinic A cannot read its own patient'; end if;

  select count(*) into v_count from public.patients where id = v_patient_b;
  if v_count <> 0 then raise exception 'FAIL: clinic A read clinic B patients (% rows)', v_count; end if;
  raise notice 'ok   patients isolated';

  -- The shape a forgotten WHERE clause takes: an unfiltered scan of the table.
  select count(*) into v_count from public.patients where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: an unfiltered patients scan reached clinic B'; end if;
  raise notice 'ok   an unfiltered scan returns nothing from the other clinic';

  select count(*) into v_count from public.patient_medical_history where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: medical history leaked across clinics'; end if;

  select count(*) into v_count from public.tcm_notes where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: clinical notes leaked across clinics'; end if;
  raise notice 'ok   medical history and clinical notes isolated';

  -- The reference catalogue is clinic-scoped too — herbs are not a global table.
  select count(*) into v_count from public.herbs where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: herb catalogue leaked across clinics'; end if;
  raise notice 'ok   herb catalogue isolated';

  -- A phone is its owner's: the other clinic's tokens are invisible, and
  -- registering one binds it to the caller and the caller's clinic.
  select count(*) into v_count from public.device_push_tokens;
  if v_count <> 1 then raise exception 'FAIL: clinic A sees % push devices, expected only its own', v_count; end if;
  select count(*) into v_count from public.device_push_tokens where user_id = v_user_b;
  if v_count <> 0 then raise exception 'FAIL: clinic B''s push device leaked'; end if;
  perform public.register_push_device('iso-token-a2-' || v_user_a::text, 'android', 'clinic', 'he');
  select count(*) into v_count from public.device_push_tokens where user_id = v_user_a and clinic_id = v_clinic_a;
  if v_count <> 2 then raise exception 'FAIL: register_push_device did not bind the phone to clinic A'; end if;
  raise notice 'ok   push devices are the person''s own';

  -- A protocol is a practitioner's own clinical material. Reading a colleague's
  -- across a tenant boundary is reading how they treat.
  select count(*) into v_count from public.treatment_protocols where clinic_id = v_clinic_a;
  if v_count <> 1 then raise exception 'FAIL: clinic A cannot read its own protocol'; end if;

  select count(*) into v_count from public.treatment_protocols where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: treatment protocols leaked across clinics'; end if;
  raise notice 'ok   treatment protocols isolated';

  -- Punch cards, their redemptions, and the view that counts them. The view is
  -- security_invoker, and this is the check that says so.
  select count(*) into v_count from public.patient_packages where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: packages leaked across clinics'; end if;

  select count(*) into v_count from public.package_redemptions where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: package redemptions leaked across clinics'; end if;

  select count(*) into v_count from public.package_balances where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: package_balances bypassed RLS'; end if;

  select count(*) into v_count from public.package_balances where clinic_id = v_clinic_a;
  if v_count <> 1 then raise exception 'FAIL: clinic A cannot read its own package balance'; end if;
  raise notice 'ok   packages, redemptions and the balances view isolated';

  -- A signature is the evidence behind a consent, and travels with it.
  select count(*) into v_count from public.signatures where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: signatures leaked across clinics'; end if;

  select count(*) into v_count from public.treatment_confirmations where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: treatment confirmations leaked across clinics'; end if;
  raise notice 'ok   signatures and treatment confirmations isolated';

  -- A signature cannot be edited or removed, on the same reasoning as the
  -- consent it belongs to: it is evidence, and evidence that can be revised is
  -- not evidence.
  --
  -- Two independent things stop the write, and either is a pass: the table has
  -- no UPDATE policy at all, so RLS makes the row invisible to UPDATE and it
  -- matches zero rows with no error raised — and the append-only trigger is
  -- there in case a future policy ever made the row visible. Assuming only the
  -- second one and treating "the trigger didn't fire" as a leak was the bug
  -- here: on RLS alone the trigger never runs, and this failed on a target the
  -- policy already protects more strongly than the trigger does.
  declare
    v_blocked boolean := false;
  begin
    begin
      update public.signatures set content = 'Forged' where clinic_id = v_clinic_a;
    exception
      when sqlstate 'P0001' then
        if sqlerrm like '%append_only%' then
          v_blocked := true;
        else
          raise;
        end if;
    end;
    get diagnostics v_count = row_count;
    if v_blocked then
      raise notice 'ok   signatures are append-only (trigger refused the update)';
    elsif v_count = 0 then
      raise notice 'ok   signatures are append-only (no UPDATE policy leaves no row to touch)';
    else
      raise exception 'FAIL: % signature row(s) were edited', v_count;
    end if;
  end;

  -- The card cannot be overdrawn, and the refusal comes from the database
  -- rather than from a button. Three sessions, three redemptions, and the
  -- fourth must fail.
  insert into public.package_redemptions (clinic_id, package_id)
  values (v_clinic_a, v_package_a), (v_clinic_a, v_package_a), (v_clinic_a, v_package_a);

  begin
    insert into public.package_redemptions (clinic_id, package_id)
    values (v_clinic_a, v_package_a);
    raise exception 'FAIL: a package was overdrawn';
  exception
    when sqlstate 'P0001' then
      if sqlerrm not like '%package_exhausted%' then raise; end if;
      raise notice 'ok   the database refuses to overdraw a package';
  end;

  -- When someone works, and when they are closed, is not the other clinic's
  -- business either.
  select count(*) into v_count from public.practitioner_schedules where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: working hours leaked across clinics'; end if;

  select count(*) into v_count from public.schedule_exceptions where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: schedule exceptions leaked across clinics'; end if;
  raise notice 'ok   working hours and closures isolated';

  -- Rooms, tags and feeds follow the same rule as everything else.
  select count(*) into v_count from public.rooms where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: rooms leaked across clinics'; end if;

  select count(*) into v_count from public.patient_tags where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: patient tags leaked across clinics'; end if;

  select count(*) into v_count from public.patient_tag_links where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: patient tag links leaked across clinics'; end if;

  select count(*) into v_count from public.appointments where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: appointments leaked across clinics'; end if;
  raise notice 'ok   rooms, tags and appointments isolated';

  select count(*) into v_count from public.schedule_blocks where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: blocked hours leaked across clinics'; end if;

  select count(*) into v_count from public.message_log where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: the message log leaked across clinics'; end if;

  -- Queueing runs for every clinic at once, as the database owner; what the
  -- caller can then read is still only their own.
  perform public.enqueue_due_reminders('https://iso.test');
  select count(*) into v_count from public.message_log where clinic_id <> v_clinic_a;
  if v_count <> 0 then raise exception 'FAIL: the queue showed % other clinic''s message(s)', v_count; end if;
  raise notice 'ok   blocked hours and the message log isolated';

  -- The automations: A reads and writes its own rows only, and the job —
  -- which may queue B's greeting today — leaves A seeing nothing of it, not
  -- the message and not the removal token it made.
  select count(*) into v_count from public.clinic_automations where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: automation settings leaked across clinics'; end if;
  begin
    insert into public.clinic_automations (clinic_id, kind, enabled) values (v_clinic_b, 'review_request', true);
    raise exception 'FAIL: clinic A wrote an automation into clinic B';
  exception
    when insufficient_privilege then null;
  end;
  perform public.enqueue_due_automations('https://iso.test');
  select count(*) into v_count from public.message_log where clinic_id <> v_clinic_a;
  if v_count <> 0 then raise exception 'FAIL: the automations queue showed % other clinic''s message(s)', v_count; end if;
  select count(*) into v_count from public.patient_unsubscribe_tokens;
  if v_count <> 0 then raise exception 'FAIL: a removal token was readable (% row(s))', v_count; end if;
  raise notice 'ok   automation settings, their queue and the removal tokens isolated';

  -- The WhatsApp threads: A sees its own, writes only outbound into its own,
  -- and cannot call the functions the sending service is given.
  select count(*) into v_count from public.whatsapp_conversations where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: WhatsApp conversations leaked across clinics'; end if;
  select count(*) into v_count from public.whatsapp_messages where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: WhatsApp messages leaked across clinics'; end if;
  select count(*) into v_count from public.whatsapp_messages where clinic_id = v_clinic_a;
  if v_count <> 1 then raise exception 'FAIL: clinic A cannot read its own WhatsApp thread'; end if;
  begin
    insert into public.whatsapp_messages (clinic_id, conversation_id, direction, kind, body, status)
    select v_clinic_a, c.id, 'in', 'text', 'forged', 'received' from public.whatsapp_conversations c where c.clinic_id = v_clinic_a;
    raise exception 'FAIL: a member wrote an inbound WhatsApp message by hand';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.whatsapp_receive('{"hook":"new"}'::jsonb);
    raise exception 'FAIL: a clinic member ran the WhatsApp push function';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.whatsapp_claim_outbound(1);
    raise exception 'FAIL: a clinic member claimed the WhatsApp queue';
  exception
    when insufficient_privilege then null;
  end;
  raise notice 'ok   WhatsApp threads isolated, inbound written only by the service';

  select count(*) into v_count from public.locations where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: locations leaked across clinics'; end if;
  raise notice 'ok   locations isolated';

  -- A feed token is a secret: not even a colleague in the same clinic sees it,
  -- and clinic B's is invisible twice over.
  select count(*) into v_count from public.calendar_feeds;
  if v_count <> 1 then raise exception 'FAIL: clinic A sees % calendar feed(s), expected only its own', v_count; end if;
  raise notice 'ok   calendar feed tokens are private to their owner';

  -- Two people in one room at one hour is refused by the database itself.
  begin
    insert into public.appointments (clinic_id, patient_id, practitioner_id, room_id, start_at, end_at)
    values (v_clinic_a, v_patient_a, v_user_a, v_room_a, now() + interval '2 days', now() + interval '2 days 30 minutes');
    raise exception 'FAIL: a room was double-booked';
  exception
    when exclusion_violation then
      raise notice 'ok   the database refuses to double-book a room';
  end;

  -- Views are declared security_invoker, so they must inherit the caller's policies
  -- rather than running with the rights of whoever created them.
  select count(*) into v_count from public.herb_stock_levels where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: herb_stock_levels bypassed RLS'; end if;

  select count(*) into v_count from public.access_activity where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: access_activity bypassed RLS'; end if;
  raise notice 'ok   views inherit the caller''s policies';

  -- The diary view reads as the caller: clinic B's patients do not appear
  -- through it any more than through the table.
  select count(*) into v_count from public.patients_with_diary where clinic_id = v_clinic_b;
  if v_count <> 0 then raise exception 'FAIL: patients_with_diary showed % row(s) of clinic B', v_count; end if;
  select count(*) into v_count from public.patients_with_diary where id = v_patient_a;
  if v_count <> 1 then raise exception 'FAIL: patients_with_diary hid clinic A''s own patient'; end if;
  raise notice 'ok   patients_with_diary reads as the caller';

  -- The price comparison is shared: a clinic member reads the shops, the
  -- products and the prices — through the tables and through the view — but
  -- writes nothing, cannot call the job's own functions, and cannot do what is
  -- reserved for a platform admin.
  select count(*) into v_count from public.shop_stores where id = v_shop_store;
  if v_count <> 1 then raise exception 'FAIL: a clinic member cannot read the shared shop list'; end if;
  select count(*) into v_count from public.shop_product_prices where id = v_shop_product and min_price = 42;
  if v_count <> 1 then raise exception 'FAIL: shop_product_prices hid the shared price from a clinic member'; end if;
  begin
    insert into public.shop_stores (slug, name, base_url, platform)
    values ('iso-injected', 'Injected', 'https://example.test', 'woocommerce');
    raise exception 'FAIL: a clinic member inserted a shop';
  exception
    when insufficient_privilege then null;
  end;
  update public.shop_offers set price = 1 where store_id = v_shop_store;
  if found then raise exception 'FAIL: a clinic member changed a price'; end if;
  delete from public.shop_products where id = v_shop_product;
  if found then raise exception 'FAIL: a clinic member deleted a product'; end if;
  begin
    perform public.shop_upsert_offers(v_shop_store, gen_random_uuid(), '[]'::jsonb);
    raise exception 'FAIL: a clinic member ran the price job''s function';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.shop_set_store_status(v_shop_store, 'paused', null);
    raise exception 'FAIL: a plain owner paused a shop';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.shop_request_refresh(v_shop_store);
    raise exception 'FAIL: a plain owner asked for a refresh';
  exception
    when insufficient_privilege then null;
  end;
  raise notice 'ok   shop prices are readable by every member and writable by none';

  -- The Western medicine reference: every member reads it, nobody writes to
  -- it from the app, and the import, the verification and the refresh are
  -- the platform admin's and the service role's alone (the lesson of
  -- migration 36: a function is open to every signed-in user until it is
  -- revoked from them explicitly).
  select count(*) into v_count from public.med_entries where id = v_med;
  if v_count <> 1 then raise exception 'FAIL: a clinic member cannot read the medicine reference'; end if;
  begin
    insert into public.med_entries (kind, slug, name_en) values ('drug', 'iso-injected-drug', 'Injected');
    raise exception 'FAIL: a clinic member inserted a medicine entry';
  exception
    when insufficient_privilege then null;
  end;
  update public.med_entries set name_en = 'Changed' where id = v_med;
  if found then raise exception 'FAIL: a clinic member changed a medicine entry'; end if;
  delete from public.med_entries where id = v_med;
  if found then raise exception 'FAIL: a clinic member deleted a medicine entry'; end if;
  begin
    perform public.med_import('[]'::jsonb, '[]'::jsonb);
    raise exception 'FAIL: a clinic member ran the medicine import';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.med_set_status(v_med, 'verified');
    raise exception 'FAIL: a clinic member verified a medicine entry';
  exception
    when insufficient_privilege then null;
  end;
  -- The reference catalogue and the 3D coordinates: read, never written.
  select count(*) into v_count from public.catalogue_herbs where pinyin = 'Iso Catalogue Herb';
  if v_count <> 1 then raise exception 'FAIL: a clinic member cannot read the shared catalogue'; end if;
  select count(*) into v_count from public.body_points where code = 'ISO1';
  if v_count <> 1 then raise exception 'FAIL: a clinic member cannot read the 3D coordinates'; end if;
  begin
    insert into public.catalogue_herbs (pinyin) values ('Iso Injected Herb');
    raise exception 'FAIL: a clinic member wrote the shared catalogue';
  exception
    when insufficient_privilege then null;
  end;
  update public.catalogue_herbs set english = 'Changed' where pinyin = 'Iso Catalogue Herb';
  if found then raise exception 'FAIL: a clinic member changed the shared catalogue'; end if;
  begin
    perform public.catalogue_upsert_herb('Iso Injected Herb', null, null, null, null, null, null, null, null, null, null, null, null, null);
    raise exception 'FAIL: a clinic member ran a catalogue seed function';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.body_point_set('ISO1', 'bilateral', -0.2, 0.5, 0.1);
    raise exception 'FAIL: a clinic member who is not a platform admin moved a 3D coordinate';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.clinic_load_catalogue(v_clinic_b);
    raise exception 'FAIL: clinic A loaded the catalogue into clinic B';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.med_set_status(v_med, 'flagged', 'a note');
    raise exception 'FAIL: a clinic member flagged a medicine entry';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.med_refresh_quotes('[]'::jsonb);
    raise exception 'FAIL: a clinic member ran the medicine refresh function';
  exception
    when insufficient_privilege then null;
  end;
  raise notice 'ok   the medicine reference is readable by every member and writable by none';

  -- The professional library is shared the same way, and its log takes the
  -- caller's own clinic from the session — never as an argument.
  select count(*) into v_count from public.library_sources where id = v_lib;
  if v_count <> 1 then raise exception 'FAIL: a clinic member cannot read the professional library'; end if;
  -- The search runs as the tables' owner (under row security its text index
  -- could not serve), so the membership rule lives inside it: a member finds
  -- the passage by text and by vector alike…
  select count(*) into v_count
    from public.library_search(v_probe_vec, 'zzzisolationword', 5) where via = 'text' and chunk_id is not null;
  if v_count <> 1 then raise exception 'FAIL: a member''s text search of the library found % passage(s), expected 1', v_count; end if;
  select count(*) into v_count
    from public.library_search(v_probe_vec, '', 5) where via = 'vector' and chunk_id is not null;
  if v_count < 1 then raise exception 'FAIL: a member''s vector search of the library found nothing'; end if;
  begin
    insert into public.library_sources (kind, locator, title) values ('file', 'iso-injected-source', 'Injected');
    raise exception 'FAIL: a clinic member inserted a library source';
  exception
    when insufficient_privilege then null;
  end;
  update public.library_sources set title = 'Changed' where id = v_lib;
  if found then raise exception 'FAIL: a clinic member changed a library source'; end if;
  delete from public.library_sources where id = v_lib;
  if found then raise exception 'FAIL: a clinic member deleted a library source'; end if;
  begin
    perform public.library_upsert_source(jsonb_build_object('locator', 'iso-x', 'title', 'x'));
    raise exception 'FAIL: a clinic member loaded a library source';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.library_clear_chunks(v_lib);
    raise exception 'FAIL: a clinic member cleared library passages';
  exception
    when insufficient_privilege then null;
  end;
  begin
    perform public.library_touch_source(v_lib, null, null);
    raise exception 'FAIL: a clinic member refreshed a library source';
  exception
    when insufficient_privilege then null;
    when undefined_function then null; -- before migration 47
  end;
  perform public.library_log_query('no_sources', '[]'::jsonb, null, null, null, null);
  select count(*) into v_count from public.library_queries where clinic_id = v_clinic_a and user_id = v_user_a;
  if v_count <> 1 then raise exception 'FAIL: the library log did not record the caller''s own clinic'; end if;
  update public.library_queries set status = 'answered' where clinic_id = v_clinic_a;
  if found then raise exception 'FAIL: a clinic member changed the library log'; end if;
  delete from public.library_queries where clinic_id = v_clinic_a;
  if found then raise exception 'FAIL: a clinic member deleted from the library log'; end if;
  raise notice 'ok   the professional library is readable and searchable by every member, writable by none, and its log is append-only';

  -- A conversation with the library is the practitioner's own: written by
  -- them, read by them, and invisible to a colleague, a stranger, a patient.
  insert into public.library_chats (clinic_id, user_id, title) values (v_clinic_a, v_user_a, 'Iso chat') returning id into v_chat_a;
  insert into public.library_messages (chat_id, clinic_id, user_id, role, content) values (v_chat_a, v_clinic_a, v_user_a, 'user', 'Iso question');
  insert into public.library_messages (chat_id, clinic_id, user_id, role, status, content) values (v_chat_a, v_clinic_a, v_user_a, 'assistant', 'answered', 'Iso answer');
  select count(*) into v_count from public.library_chats where id = v_chat_a;
  if v_count <> 1 then raise exception 'FAIL: a practitioner cannot read their own library conversation'; end if;
  select count(*) into v_count from public.library_messages where chat_id = v_chat_a;
  if v_count <> 2 then raise exception 'FAIL: a practitioner read % of their 2 library messages', v_count; end if;
  update public.library_chats set pinned = true where id = v_chat_a;
  if not found then raise exception 'FAIL: a practitioner could not pin their own conversation'; end if;
  begin
    insert into public.library_chats (clinic_id, user_id, title) values (v_clinic_a, v_user_b, 'Forged');
    raise exception 'FAIL: a conversation was written in another person''s name';
  exception
    when insufficient_privilege then null;
  end;
  begin
    insert into public.library_chats (clinic_id, user_id, title) values (v_clinic_b, v_user_a, 'Forged');
    raise exception 'FAIL: a conversation was written into another clinic';
  exception
    when insufficient_privilege then null;
  end;
  raise notice 'ok   a library conversation belongs to the one who had it';

  -- Invitations belong to the owner who made them, and the last owner stays.
  select count(*) into v_count from public.clinic_invitations;
  if v_count <> 1 then raise exception 'FAIL: clinic A saw % invitation(s), expected only its own', v_count; end if;
  begin
    perform public.set_membership_active(v_owner_a, false);
    raise exception 'FAIL: an owner switched themselves off';
  exception
    when invalid_parameter_value then null;
  end;
  begin
    delete from public.memberships where id = v_owner_a;
    raise exception 'FAIL: the last owner was deleted';
  exception
    when check_violation then null;
  end;
  begin
    perform public.accept_invitation(v_invite_b);
    raise exception 'FAIL: a member of clinic A accepted an invitation to clinic B';
  exception
    when unique_violation then null;
  end;
  raise notice 'ok   invitations are the owner''s, and a clinic keeps its last owner';

  select count(*) into v_count from public.encounter_signatures;
  if v_count <> 1 then raise exception 'FAIL: clinic A saw % signature record(s), expected its own one', v_count; end if;
  begin
    update public.encounter_signatures set reason = 'edited' where encounter_id = v_encounter;
    if found then raise exception 'FAIL: a signature record was edited'; end if;
  exception
    when insufficient_privilege then null;
  end;
  raise notice 'ok   signature history is visible to its clinic and cannot be changed';

  -- The service overview is empty for a clinic owner who is not on the
  -- platform list, and the clinic-making function refuses someone who already
  -- belongs somewhere — a second clinic is never one click away.
  select count(*) into v_count from public.platform_clinics();
  if v_count <> 0 then raise exception 'FAIL: platform_clinics() showed % clinic(s) to a plain owner', v_count; end if;
  begin
    perform public.create_clinic_for_current_user('Iso Second Clinic', null);
    raise exception 'FAIL: an existing member created a second clinic';
  exception
    when unique_violation then
      raise notice 'ok   platform overview hidden; one clinic per account';
  end;

  -- Writing into another clinic must be refused outright, not silently redirected
  -- into the caller's own clinic.
  begin
    insert into public.patients (clinic_id, first_name, last_name)
    values (v_clinic_b, 'Injected', 'Row');
    raise exception 'FAIL: clinic A inserted a patient into clinic B';
  exception
    when insufficient_privilege then
      raise notice 'ok   cross-clinic insert refused';
  end;

  update public.patients set city = 'Injected' where id = v_patient_b;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL: clinic A updated % row(s) belonging to clinic B', v_count;
  end if;
  raise notice 'ok   cross-clinic update affects no rows';

  delete from public.patients where id = v_patient_b;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL: clinic A deleted % row(s) belonging to clinic B', v_count;
  end if;
  raise notice 'ok   cross-clinic delete affects no rows';

  -- The audit trail is written by SECURITY DEFINER triggers and by
  -- log_record_access(). Nothing else may write to it, or it proves nothing.
  begin
    insert into public.audit_log (clinic_id, table_name, record_id, action)
    values (v_clinic_a, 'patients', v_patient_a, 'view');
    raise exception 'FAIL: audit_log accepted a hand-written entry';
  exception
    when insufficient_privilege then
      raise notice 'ok   audit_log rejects a forged entry';
  end;

  -- An existing audit row must not be editable, in any clinic.
  update public.audit_log set action = 'insert' where clinic_id = v_clinic_a;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL: % audit row(s) were rewritten', v_count;
  end if;
  delete from public.audit_log where clinic_id = v_clinic_a;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL: % audit row(s) were deleted', v_count;
  end if;
  raise notice 'ok   audit_log is append-only in practice, not just by intent';

  -- ==========================================================================
  -- Identity 2 · clinic B's owner — the mirror image
  -- ==========================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  raise notice '--- as clinic B ---';

  -- Clinic A's library questions are clinic A's, and A's conversation is A's owner's alone.
  select count(*) into v_count from public.library_queries where clinic_id = v_clinic_a;
  if v_count <> 0 then raise exception 'FAIL: clinic B saw % of clinic A''s library log row(s)', v_count; end if;
  select count(*) into v_count from public.library_chats;
  if v_count <> 0 then raise exception 'FAIL: clinic B saw % library conversation(s) of clinic A', v_count; end if;
  select count(*) into v_count from public.library_messages;
  if v_count <> 0 then raise exception 'FAIL: clinic B saw % library message(s) of clinic A', v_count; end if;
  update public.library_chats set title = 'Taken' where id = v_chat_a;
  if found then raise exception 'FAIL: clinic B renamed clinic A''s conversation'; end if;
  delete from public.library_chats where id = v_chat_a;
  if found then raise exception 'FAIL: clinic B deleted clinic A''s conversation'; end if;

  select count(*) into v_count from public.encounter_signatures;
  if v_count <> 0 then raise exception 'FAIL: clinic B saw % of clinic A''s signature record(s)', v_count; end if;
  begin
    perform public.reopen_encounter(v_encounter, 'Isolation test');
    raise exception 'FAIL: clinic B reopened clinic A''s treatment record';
  exception
    when insufficient_privilege then null;
  end;

  select count(*) into v_count from public.patients where id = v_patient_b;
  if v_count <> 1 then raise exception 'FAIL: clinic B cannot read its own patient'; end if;

  select count(*) into v_count from public.patients where id = v_patient_a;
  if v_count <> 0 then raise exception 'FAIL: clinic B read clinic A patients'; end if;

  select count(*) into v_count from public.tcm_notes;
  if v_count <> 0 then raise exception 'FAIL: clinic B read % clinical note(s)', v_count; end if;
  raise notice 'ok   isolation holds in both directions';

  -- The shop list is the same list for clinic B: shared, not per clinic.
  select count(*) into v_count from public.shop_offers where store_id = v_shop_store;
  if v_count <> 1 then raise exception 'FAIL: clinic B did not see the shared shop price'; end if;
  raise notice 'ok   shop prices are one list for every clinic';

  -- ==========================================================================
  -- Identity 3 · the portal patient
  -- ==========================================================================
  -- This is the boundary that matters most in day-to-day use: a patient signs in
  -- to the portal as a real auth user, holds no membership, and must see their own
  -- appointments and shared files and absolutely nothing clinical.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user_p, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  raise notice '--- as the portal patient ---';

  if public.current_patient_id() is distinct from v_patient_a then
    raise exception 'FAIL: current_patient_id() returned %, expected %',
      public.current_patient_id(), v_patient_a;
  end if;

  if public.current_clinic_id() is not null then
    raise exception 'FAIL: a portal patient resolved a clinic membership (%)',
      public.current_clinic_id();
  end if;
  raise notice 'ok   portal identity resolves to a patient and to no clinic';

  select count(*) into v_count from public.patients where id = v_patient_a;
  if v_count <> 1 then raise exception 'FAIL: the portal patient cannot read their own file'; end if;

  select count(*) into v_count from public.patients where id = v_patient_b;
  if v_count <> 0 then raise exception 'FAIL: the portal patient read another patient''s file'; end if;
  raise notice 'ok   the portal patient sees only their own record';

  -- The price comparison is the clinic's tool, not the patient's.
  select count(*) into v_count from public.shop_stores;
  if v_count <> 0 then raise exception 'FAIL: the portal patient read % shop row(s)', v_count; end if;
  select count(*) into v_count from public.med_entries;
  if v_count <> 0 then raise exception 'FAIL: the portal patient read % medicine entr(ies)', v_count; end if;
  select count(*) into v_count from public.catalogue_herbs;
  if v_count <> 0 then raise exception 'FAIL: the portal patient read % catalogue herb(s)', v_count; end if;
  select count(*) into v_count from public.body_points;
  if v_count <> 0 then raise exception 'FAIL: the portal patient read % 3D coordinate(s)', v_count; end if;
  -- …and the library search, which runs as the owner, answers a signed-in
  -- account without a clinic with nothing — by text and by vector alike.
  select count(*) into v_count from public.library_search(v_probe_vec, 'zzzisolationword', 5);
  if v_count <> 0 then raise exception 'FAIL: the portal patient searched the professional library (% row(s))', v_count; end if;
  select count(*) into v_count from public.library_chats;
  if v_count <> 0 then raise exception 'FAIL: the portal patient saw % library conversation(s)', v_count; end if;
  begin
    insert into public.library_chats (clinic_id, user_id, title) values (v_clinic_a, v_user_p, 'Patient chat');
    raise exception 'FAIL: the portal patient opened a library conversation';
  exception
    when insufficient_privilege then null;
  end;
  raise notice 'ok   shop prices, the medicine reference and the library search are closed to the portal';

  -- The headline safety property: no policy on tcm_notes mentions patients at all.
  select count(*) into v_count from public.tcm_notes;
  if v_count <> 0 then
    raise exception 'FAIL: the portal patient read % clinical note(s)', v_count;
  end if;

  select count(*) into v_count from public.patient_medical_history;
  if v_count <> 0 then
    raise exception 'FAIL: the portal patient read their own medical history table';
  end if;

  select count(*) into v_count from public.encounters;
  if v_count <> 0 then
    raise exception 'FAIL: the portal patient read % encounter(s)', v_count;
  end if;

  select count(*) into v_count from public.herbs;
  if v_count <> 0 then
    raise exception 'FAIL: the portal patient read the herb catalogue';
  end if;

  select count(*) into v_count from public.audit_log;
  if v_count <> 0 then
    raise exception 'FAIL: the portal patient read the audit log';
  end if;
  raise notice 'ok   clinical records, encounters, catalogue and audit log are unreachable';

  -- Sharing is a deliberate act, so an unshared document must stay invisible.
  select count(*) into v_count from public.patient_documents where id = v_doc_shared;
  if v_count <> 1 then raise exception 'FAIL: a shared document was not visible to the patient'; end if;

  select count(*) into v_count from public.patient_documents where id = v_doc_private;
  if v_count <> 0 then raise exception 'FAIL: an unshared document was visible to the patient'; end if;
  raise notice 'ok   only documents explicitly shared reach the portal';

  -- A patient may read, never write.
  begin
    update public.patients set city = 'Self-edited' where id = v_patient_a;
    get diagnostics v_count = row_count;
    if v_count <> 0 then
      raise exception 'FAIL: the portal patient edited their own record (% row(s))', v_count;
    end if;
    raise notice 'ok   the portal patient cannot write to their record';
  exception
    when insufficient_privilege then
      raise notice 'ok   the portal patient cannot write to their record';
  end;

  -- ==========================================================================
  -- Identity 4 · no session at all
  -- ==========================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);

  raise notice '--- as an anonymous caller ---';

  select count(*) into v_count from public.patients;
  if v_count <> 0 then raise exception 'FAIL: anonymous read returned % patient row(s)', v_count; end if;

  select count(*) into v_count from public.tcm_notes;
  if v_count <> 0 then raise exception 'FAIL: anonymous read returned % clinical note(s)', v_count; end if;

  select count(*) into v_count from public.clinics;
  if v_count <> 0 then raise exception 'FAIL: anonymous read returned % clinic row(s)', v_count; end if;
  select count(*) into v_count from public.shop_offers;
  if v_count <> 0 then raise exception 'FAIL: anonymous read returned % shop price(s)', v_count; end if;
  select count(*) into v_count from public.med_entries;
  if v_count <> 0 then raise exception 'FAIL: anonymous read returned % medicine entr(ies)', v_count; end if;
  select count(*) into v_count from public.catalogue_points;
  if v_count <> 0 then raise exception 'FAIL: anonymous read returned % catalogue point(s)', v_count; end if;
  select count(*) into v_count from public.body_points;
  if v_count <> 0 then raise exception 'FAIL: anonymous read returned % 3D coordinate(s)', v_count; end if;
  begin
    perform public.clinic_load_catalogue();
    raise exception 'FAIL: an anonymous caller ran the catalogue load';
  exception
    when insufficient_privilege then null;
  end;
  select count(*) into v_count from public.clinic_invitations;
  if v_count <> 0 then raise exception 'FAIL: anonymous read returned % invitation(s)', v_count; end if;
  select count(*) into v_count from public.encounter_signatures;
  if v_count <> 0 then raise exception 'FAIL: anonymous read returned % signature record(s)', v_count; end if;
  select count(*) into v_count from public.invitation_by_token(gen_random_uuid());
  if v_count <> 0 then raise exception 'FAIL: a random invitation token answered'; end if;
  select count(*) into v_count from public.invitation_by_token(v_invite_a) where clinic_name = 'Isolation Test A' and status = 'open';
  if v_count <> 1 then raise exception 'FAIL: the real invitation token did not answer with its clinic'; end if;
  begin
    perform public.library_search(v_probe_vec, 'zzzisolationword', 5);
    raise exception 'FAIL: an anonymous caller ran the library search';
  exception
    when insufficient_privilege then null;
  end;
  select count(*) into v_count from public.library_chats;
  if v_count <> 0 then raise exception 'FAIL: anonymous read returned % library conversation(s)', v_count; end if;
  select count(*) into v_count from public.unsubscribe_info(gen_random_uuid());
  if v_count <> 0 then raise exception 'FAIL: a guessed removal token showed a page to an anonymous caller'; end if;
  select count(*) into v_count from public.clinic_automations;
  if v_count <> 0 then raise exception 'FAIL: anonymous read returned % automation setting(s)', v_count; end if;
  select count(*) into v_count from public.whatsapp_messages;
  if v_count <> 0 then raise exception 'FAIL: anonymous read returned % WhatsApp message(s)', v_count; end if;
  begin
    perform public.whatsapp_ack('{"hook":"update","unique":"x","ack":3}'::jsonb);
    raise exception 'FAIL: an anonymous caller ran the WhatsApp acknowledgement function';
  exception
    when insufficient_privilege then null;
  end;
  raise notice 'ok   anonymous callers see nothing';

  -- The token functions are the only doors without a session. A guessed
  -- token opens nothing; a real one opens exactly its own appointment or diary.
  select count(*) into v_count from public.appointment_by_token(gen_random_uuid());
  if v_count <> 0 then raise exception 'FAIL: a random confirmation token returned % row(s)', v_count; end if;

  select count(*) into v_count from public.appointment_by_token(v_confirm_a);
  if v_count <> 1 then raise exception 'FAIL: the real confirmation token returned % row(s), expected 1', v_count; end if;

  -- A random feed token is refused outright — the function raises rather
  -- than answering with an empty diary — so a regenerated address fails
  -- loudly at the subscriber instead of quietly showing nothing.
  begin
    perform * from public.calendar_feed_events(gen_random_uuid());
    raise exception 'FAIL: a random feed token was accepted';
  exception
    when no_data_found then null;
  end;

  select count(*) into v_count from public.calendar_feed_events(v_feed_a)
   where patient_name like '%ClinicB%';
  if v_count <> 0 then raise exception 'FAIL: clinic A''s feed listed clinic B''s patient'; end if;

  select count(*) into v_count from public.calendar_feed_events(v_feed_a);
  if v_count <> 1 then raise exception 'FAIL: clinic A''s feed returned % event(s), expected 1', v_count; end if;

  if not public.respond_to_appointment(v_confirm_b, 'confirmed') then
    raise exception 'FAIL: a valid confirmation token was refused';
  end if;
  if public.respond_to_appointment(gen_random_uuid(), 'confirmed') then
    raise exception 'FAIL: a random token confirmed an appointment';
  end if;
  raise notice 'ok   confirmation and feed tokens open only their own door';

  -- The booking page: open for clinic A only. A stranger with the handle
  -- sees A's name and nothing of B's, books an hour, and the file that
  -- makes lands in A — and stays unreadable to the stranger afterwards.
  if (select public.booking_clinic('iso-book-a') ->> 'clinic') is null then
    raise exception 'FAIL: the booking page found nothing for an open clinic';
  end if;
  if public.booking_clinic('iso-book-a')::text like '%ClinicB%' then
    raise exception 'FAIL: the booking page leaked clinic B';
  end if;
  if public.booking_clinic('no-such-clinic') is not null then
    raise exception 'FAIL: an unknown handle returned a clinic';
  end if;
  select count(*) into v_count from public.patients;
  if v_count <> 0 then raise exception 'FAIL: anonymous read returned patients after booking calls'; end if;
  raise notice 'ok   the booking page shows one clinic and nothing else';

  -- ==========================================================================
  -- Identity 5 · a stranger with an account and no clinic, holding A's link
  -- ==========================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user_c, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  raise notice '--- as the invited stranger ---';

  if public.current_clinic_id() is not null then raise exception 'FAIL: the stranger already had a clinic'; end if;
  if public.accept_invitation(v_invite_a) <> v_clinic_a then raise exception 'FAIL: accepting did not return clinic A'; end if;
  if public.current_clinic_id() is distinct from v_clinic_a then raise exception 'FAIL: the stranger did not become a member of A'; end if;
  select count(*) into v_count from public.patients where id = v_patient_a;
  if v_count <> 1 then raise exception 'FAIL: the new member cannot read clinic A''s patient'; end if;
  select count(*) into v_count from public.patients where id = v_patient_b;
  if v_count <> 0 then raise exception 'FAIL: the new member read clinic B'; end if;
  begin
    perform public.accept_invitation(v_invite_a);
    raise exception 'FAIL: a spent invitation was accepted again';
  exception
    when unique_violation or invalid_parameter_value then null;
  end;
  raise notice 'ok   an invitation opens one clinic, once, for the account that holds the link';

  perform set_config('role', 'postgres', true);
  raise notice ' ';
  raise notice 'ALL TENANT ISOLATION CHECKS PASSED';
end
$test$;

-- Nothing above is kept. The fixtures existed only for the length of this
-- transaction, whether it passed or failed.
rollback;
