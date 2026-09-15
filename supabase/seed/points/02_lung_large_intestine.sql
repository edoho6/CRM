-- ============================================================================
-- Point clinical reference · 01 · Lung and Large Intestine
-- ============================================================================
-- Written from standard acupuncture teaching — the locations in cun, the
-- classical functions, the conditions each point is reached for, and the
-- needling depth and angle. No text is reproduced from any single reference
-- work; where sources differ on a depth the conservative figure is given.
--
-- Every row stays flagged needs_review until a practitioner confirms it, and
-- the importer only fills fields that are still empty, so nothing you correct
-- can be overwritten by re-running this file.
--
-- Depths assume an adult of average build. Cautions are not exhaustive: the
-- practitioner's own judgement of the patient in front of them governs.
-- ============================================================================

do $seed$
begin

-- ---------------------------------------------------------------------------
-- LU · Lung
-- ---------------------------------------------------------------------------

perform public.catalogue_set_point_clinical('LU1',
  $l$On the lateral chest, in the first intercostal space, 6 cun lateral to the midline, 1 cun below LU2.$l$,
  $a$Disseminates and descends Lung qi, transforms phlegm, clears heat from the upper burner.$a$,
  $i$Cough, asthma, wheezing, chest pain and fullness, shoulder and back pain, painful obstruction of the upper arm.$i$,
  $n$Oblique or transverse insertion laterally, 0.5–0.8 cun.$n$,
  $c$Do not needle perpendicularly or deeply: the pleura lies directly beneath and pneumothorax is the risk.$c$,
  '{front_mu, crossing}');

perform public.catalogue_set_point_clinical('LU2',
  $l$In the depression below the acromial end of the clavicle, 6 cun lateral to the midline.$l$,
  $a$Disseminates Lung qi, descends rebellious qi, relieves cough and wheezing.$a$,
  $i$Cough, shortness of breath, chest oppression, pain of the shoulder and anterior chest.$i$,
  $n$Oblique or transverse insertion laterally, 0.5–0.8 cun.$n$,
  $c$Avoid deep perpendicular needling — pneumothorax risk.$c$,
  '{}');

perform public.catalogue_set_point_clinical('LU3',
  $l$On the anterolateral upper arm, 3 cun below the anterior axillary fold, on the radial side of biceps brachii.$l$,
  $a$Descends Lung qi, regulates the nose and throat, calms the spirit.$a$,
  $i$Cough, asthma, nosebleed, sore throat, sadness and weeping, upper arm pain. A window of the sky point.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{window_of_sky}');

perform public.catalogue_set_point_clinical('LU4',
  $l$On the anterolateral upper arm, 4 cun below the anterior axillary fold, on the radial side of biceps brachii.$l$,
  $a$Descends Lung qi, unbinds the chest.$a$,
  $i$Cough, shortness of breath, fullness of the chest, pain along the medial arm.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{}');

perform public.catalogue_set_point_clinical('LU5',
  $l$On the cubital crease, in the depression on the radial side of the biceps brachii tendon. Locate with the elbow slightly flexed.$l$,
  $a$Clears Lung heat, descends rebellious qi, regulates the water passages, relaxes the sinews of the elbow.$a$,
  $i$Cough, wheezing, haemoptysis, sore throat, fever, oedema and difficult urination, elbow and arm pain, childhood convulsions.$i$,
  $n$Perpendicular, 0.5–1 cun; or prick to bleed for acute heat patterns.$n$,
  null,
  '{he_sea}');

perform public.catalogue_set_point_clinical('LU6',
  $l$On the anterior forearm, 7 cun above the wrist crease, on the line between LU9 and LU5.$l$,
  $a$Clears Lung heat, stops bleeding, descends rebellious qi, opens the chest.$a$,
  $i$Acute cough and wheezing, haemoptysis, acute chest pain, sore throat, loss of voice, haemorrhoidal bleeding.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{xi_cleft}');

perform public.catalogue_set_point_clinical('LU7',
  $l$On the radial forearm, 1.5 cun above the wrist crease, in the cleft above the styloid process of the radius.$l$,
  $a$Releases the exterior, expels wind, descends and disseminates Lung qi, opens the Ren vessel, benefits the head and neck.$a$,
  $i$Common cold, cough, asthma, headache, stiff neck, facial paralysis, wrist pain, urinary difficulty. Command point of the head and neck; confluent point of the Ren vessel.$i$,
  $n$Oblique insertion proximally along the channel, 0.3–0.5 cun.$n$,
  null,
  '{luo_connecting, confluent, command}');

perform public.catalogue_set_point_clinical('LU8',
  $l$On the radial forearm, 1 cun above the wrist crease, between the radial artery and the styloid process of the radius.$l$,
  $a$Descends Lung qi, regulates the Lung, benefits the throat.$a$,
  $i$Cough, wheezing, chest pain, sore throat, wrist pain.$i$,
  $n$Perpendicular, 0.2–0.3 cun, avoiding the radial artery.$n$,
  $c$The radial artery runs immediately medial: locate carefully and needle shallowly.$c$,
  '{jing_river}');

perform public.catalogue_set_point_clinical('LU9',
  $l$On the wrist crease, in the depression lateral to the radial artery.$l$,
  $a$Tonifies the Lung, transforms phlegm, regulates and gathers the vessels, benefits the pulse.$a$,
  $i$Cough, wheezing, chest pain, weak voice, pulseless syndrome, wrist pain. The influential point of the vessels and the source point of the Lung — the principal tonification point for Lung deficiency.$i$,
  $n$Perpendicular, 0.2–0.3 cun, avoiding the artery.$n$,
  $c$The radial artery lies immediately medial.$c$,
  '{shu_stream, yuan_source, influential}');

perform public.catalogue_set_point_clinical('LU10',
  $l$On the palmar hand, at the midpoint of the first metacarpal bone, on the border between red and white skin.$l$,
  $a$Clears Lung heat, benefits the throat, descends rebellious qi.$a$,
  $i$Sore throat, loss of voice, cough, fever without sweating, hot palms, child with feeding difficulty.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{ying_spring}');

perform public.catalogue_set_point_clinical('LU11',
  $l$On the radial side of the thumb, 0.1 cun proximal to the corner of the nail.$l$,
  $a$Expels wind-heat, benefits the throat, restores consciousness, clears heat from the Lung.$a$,
  $i$Acute sore throat, loss of voice, mumps, fever, loss of consciousness, childhood convulsions, agitation.$i$,
  $n$Shallow perpendicular insertion 0.1 cun, or prick to bleed.$n$,
  null,
  '{jing_well, ghost_point}');

-- ---------------------------------------------------------------------------
-- LI · Large Intestine
-- ---------------------------------------------------------------------------

perform public.catalogue_set_point_clinical('LI1',
  $l$On the radial side of the index finger, 0.1 cun proximal to the corner of the nail.$l$,
  $a$Clears heat, benefits the throat, restores consciousness.$a$,
  $i$Sore throat, toothache, fever, loss of consciousness, numbness of the fingers.$i$,
  $n$Shallow perpendicular insertion 0.1 cun, or prick to bleed.$n$,
  null,
  '{jing_well}');

perform public.catalogue_set_point_clinical('LI2',
  $l$On the radial side of the index finger, distal to the second metacarpophalangeal joint, on the border between red and white skin.$l$,
  $a$Clears heat from the channel, reduces swelling, benefits the face and teeth.$a$,
  $i$Toothache, sore throat, nosebleed, facial swelling, blurred vision, fever.$i$,
  $n$Perpendicular, 0.2–0.3 cun.$n$,
  null,
  '{ying_spring}');

perform public.catalogue_set_point_clinical('LI3',
  $l$On the radial side of the index finger, in the depression proximal to the head of the second metacarpal bone.$l$,
  $a$Expels wind, clears heat, benefits the throat, eyes and teeth.$a$,
  $i$Toothache, sore throat, red and painful eyes, borborygmus, swelling of the dorsum of the hand.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{shu_stream}');

perform public.catalogue_set_point_clinical('LI4',
  $l$On the dorsum of the hand, between the first and second metacarpal bones, at the midpoint of the radial side of the second metacarpal.$l$,
  $a$Expels wind and releases the exterior, regulates the defensive qi and sweating, calms pain anywhere in the body, promotes labour, benefits the whole face and head.$a$,
  $i$Headache, toothache, facial paralysis, sinus and nasal problems, sore throat, fever with or without sweating, pain anywhere, delayed labour, amenorrhoea. Command point of the face and mouth; the principal analgesic point of the body.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  $c$Contraindicated in pregnancy — strongly moves qi and blood downward and is used to promote labour.$c$,
  '{yuan_source, command, ghost_point}');

perform public.catalogue_set_point_clinical('LI5',
  $l$On the radial side of the wrist, in the anatomical snuffbox between the tendons of extensor pollicis longus and brevis.$l$,
  $a$Clears heat from the channel, benefits the wrist, calms the spirit.$a$,
  $i$Wrist pain, toothache, sore throat, red eyes, agitation, mania.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{jing_river}');

perform public.catalogue_set_point_clinical('LI6',
  $l$On the radial side of the forearm, 3 cun above the wrist crease, on the line between LI5 and LI11.$l$,
  $a$Regulates the water passages, benefits the face and ears, clears heat.$a$,
  $i$Facial and generalised oedema, difficult urination, nosebleed, deafness and tinnitus, sore throat, arm pain.$i$,
  $n$Perpendicular or oblique, 0.5–0.8 cun.$n$,
  null,
  '{luo_connecting}');

perform public.catalogue_set_point_clinical('LI7',
  $l$On the radial side of the forearm, 5 cun above the wrist crease, on the line between LI5 and LI11.$l$,
  $a$Clears heat and resolves toxicity, regulates the intestines, calms the spirit.$a$,
  $i$Acute abdominal pain and borborygmus, sore throat, facial swelling, boils and sores, agitation, mania.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{xi_cleft}');

perform public.catalogue_set_point_clinical('LI8',
  $l$On the radial side of the forearm, 4 cun below LI11, on the line between LI5 and LI11.$l$,
  $a$Regulates the intestines, relaxes the sinews of the arm.$a$,
  $i$Abdominal pain, borborygmus, pain and numbness of the forearm, headache.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{}');

perform public.catalogue_set_point_clinical('LI9',
  $l$On the radial side of the forearm, 3 cun below LI11, on the line between LI5 and LI11.$l$,
  $a$Regulates qi in the intestines, benefits the arm.$a$,
  $i$Abdominal pain, borborygmus, numbness and pain of the arm, headache.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{}');

perform public.catalogue_set_point_clinical('LI10',
  $l$On the radial side of the forearm, 2 cun below LI11, on the line between LI5 and LI11.$l$,
  $a$Regulates qi and blood, tonifies qi, harmonises the Stomach and intestines, benefits the arm.$a$,
  $i$Abdominal pain and distension, diarrhoea, vomiting, painful obstruction and weakness of the arm, hemiplegia, general fatigue. A major tonification point of the arm.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  null,
  '{}');

perform public.catalogue_set_point_clinical('LI11',
  $l$At the lateral end of the cubital crease, midway between LU5 and the lateral epicondyle of the humerus, with the elbow flexed.$l$,
  $a$Clears heat and cools the blood, expels wind and resolves dampness, regulates qi and blood, benefits the sinews and joints.$a$,
  $i$Fever, sore throat, high blood pressure, urticaria and skin diseases, dysentery and diarrhoea, elbow and shoulder pain, hemiplegia. The most important heat-clearing point of the arm.$i$,
  $n$Perpendicular, 0.8–1.5 cun.$n$,
  null,
  '{he_sea}');

perform public.catalogue_set_point_clinical('LI12',
  $l$On the lateral upper arm, 1 cun above LI11 on the border of the humerus, with the elbow flexed.$l$,
  $a$Activates the channel, relaxes the sinews, benefits the elbow.$a$,
  $i$Elbow pain and contracture, numbness of the arm.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{}');

perform public.catalogue_set_point_clinical('LI13',
  $l$On the lateral upper arm, 3 cun above LI11, on the line between LI11 and LI15.$l$,
  $a$Dissipates nodules, activates the channel.$a$,
  $i$Scrofula, pain and contraction of the elbow and arm, cough with blood.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  $c$Avoid the radial nerve and the brachial artery: needle with care and stop on sharp radiating pain.$c$,
  '{}');

perform public.catalogue_set_point_clinical('LI14',
  $l$On the lateral upper arm, at the insertion of the deltoid, 7 cun above LI11.$l$,
  $a$Benefits the shoulder and arm, dissipates nodules, brightens the eyes.$a$,
  $i$Shoulder and arm pain, inability to raise the arm, scrofula, eye disorders.$i$,
  $n$Perpendicular or oblique upward, 0.8–1.5 cun.$n$,
  null,
  '{crossing}');

perform public.catalogue_set_point_clinical('LI15',
  $l$Anterior and inferior to the acromion, in the depression that appears when the arm is abducted.$l$,
  $a$Expels wind-damp from the shoulder, benefits the sinews and joints, activates the channel.$a$,
  $i$Frozen shoulder, shoulder pain and restricted movement, hemiplegia, urticaria.$i$,
  $n$Perpendicular, 0.8–1.5 cun, or oblique toward the joint space.$n$,
  null,
  '{crossing}');

perform public.catalogue_set_point_clinical('LI16',
  $l$In the depression between the acromial end of the clavicle and the spine of the scapula.$l$,
  $a$Benefits the shoulder, dissipates nodules, descends rebellious qi.$a$,
  $i$Shoulder and upper back pain, restricted arm movement, scrofula, haemoptysis.$i$,
  $n$Oblique or perpendicular, 0.5–1 cun.$n$,
  $c$Do not needle deeply or medially: the apex of the lung lies below.$c$,
  '{crossing}');

perform public.catalogue_set_point_clinical('LI17',
  $l$On the lateral neck, 1 cun below LI18, at the posterior border of sternocleidomastoid.$l$,
  $a$Benefits the throat and voice, dissipates nodules.$a$,
  $i$Sore throat, loss of voice, goitre, scrofula, difficulty swallowing.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  $c$Needle shallowly. Avoid the carotid artery and the external jugular vein.$c$,
  '{}');

perform public.catalogue_set_point_clinical('LI18',
  $l$On the lateral neck, level with the tip of the Adam''s apple, between the sternal and clavicular heads of sternocleidomastoid.$l$,
  $a$Benefits the throat and voice, descends rebellious qi, dissipates nodules.$a$,
  $i$Sore throat, loss of voice, cough and asthma, goitre, scrofula. A window of the sky point.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  $c$The carotid artery lies immediately deep and medial. Needle shallowly and never bilaterally with strong stimulation.$c$,
  '{window_of_sky}');

perform public.catalogue_set_point_clinical('LI19',
  $l$Below the nostril, level with the midpoint of the philtrum, directly below the lateral margin of the nostril.$l$,
  $a$Opens the nasal passages, expels wind, benefits the nose and mouth.$a$,
  $i$Nasal congestion and discharge, nosebleed, facial paralysis, trismus.$i$,
  $n$Oblique or transverse, 0.2–0.3 cun.$n$,
  null,
  '{}');

perform public.catalogue_set_point_clinical('LI20',
  $l$In the nasolabial groove, level with the midpoint of the lateral border of the ala nasi.$l$,
  $a$Opens the nasal passages, expels wind and clears heat from the face.$a$,
  $i$Nasal congestion, loss of smell, rhinitis and sinusitis, nosebleed, facial paralysis, facial itching and swelling. The principal point for the nose.$i$,
  $n$Oblique or transverse insertion toward the nose, 0.2–0.5 cun.$n$,
  null,
  '{crossing}');

end
$seed$;
