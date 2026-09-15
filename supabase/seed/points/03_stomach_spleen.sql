-- ============================================================================
-- Point clinical reference · 02 · Stomach and Spleen
-- ============================================================================
-- See 02_lung_large_intestine.sql for conventions.
-- ============================================================================

do $seed$
begin

-- ---------------------------------------------------------------------------
-- ST · Stomach
-- ---------------------------------------------------------------------------

perform public.catalogue_set_point_clinical('ST1',
  $l$Between the eyeball and the infraorbital ridge, directly below the pupil when the eyes look straight ahead.$l$,
  $a$Brightens the eyes, expels wind, stops lacrimation.$a$,
  $i$Red, swollen and painful eyes, excessive tearing, night blindness, twitching of the eyelid, facial paralysis.$i$,
  $n$With the eye looking up, push the eyeball gently upward and insert slowly perpendicular along the orbital ridge, 0.3–0.7 cun. Do not lift, thrust or rotate.$n$,
  $c$Haematoma is common. No manipulation, no moxa. Press the site firmly for a minute after withdrawal.$c$,
  '{crossing}');

perform public.catalogue_set_point_clinical('ST2',
  $l$Directly below the pupil, in the depression of the infraorbital foramen.$l$,
  $a$Expels wind, brightens the eyes, activates the channel in the face.$a$,
  $i$Eye disorders, twitching eyelid, facial paralysis and pain, sinus pain.$i$,
  $n$Perpendicular 0.2–0.3 cun, or oblique upward. Do not needle deeply into the foramen.$n$,
  $c$Deep insertion into the infraorbital foramen injures the nerve.$c$,
  '{}');

perform public.catalogue_set_point_clinical('ST3',
  $l$Directly below the pupil, level with the lower border of the ala nasi.$l$,
  $a$Expels wind, benefits the face, opens the nasal passages.$a$,
  $i$Facial paralysis and pain, twitching eyelid, nasal congestion, toothache, swelling of the lips and cheek.$i$,
  $n$Perpendicular 0.2–0.3 cun, or transverse toward the affected region.$n$,
  null,
  '{crossing}');

perform public.catalogue_set_point_clinical('ST4',
  $l$0.4 cun lateral to the corner of the mouth.$l$,
  $a$Expels wind from the face, activates the channel.$a$,
  $i$Facial paralysis, drooling, deviation of the mouth, toothache, trismus.$i$,
  $n$Transverse insertion toward ST6, 0.5–1.5 cun.$n$,
  null,
  '{crossing}');

perform public.catalogue_set_point_clinical('ST5',
  $l$Anterior to the angle of the mandible, in the depression at the anterior border of masseter where the facial artery pulses.$l$,
  $a$Expels wind, reduces swelling, benefits the teeth and jaw.$a$,
  $i$Facial paralysis, toothache, swelling of the cheek, trismus, mumps.$i$,
  $n$Oblique or transverse, 0.3–0.5 cun, avoiding the artery.$n$,
  $c$The facial artery runs through this point: palpate and avoid it.$c$,
  '{}');

perform public.catalogue_set_point_clinical('ST6',
  $l$One finger-breadth anterior and superior to the angle of the mandible, at the prominence of masseter when the teeth are clenched.$l$,
  $a$Expels wind, relaxes the sinews of the jaw, benefits the teeth.$a$,
  $i$Facial paralysis, trismus, toothache of the lower jaw, mumps, temporomandibular pain.$i$,
  $n$Perpendicular 0.3–0.5 cun, or transverse toward ST4 for facial paralysis.$n$,
  null,
  '{}');

perform public.catalogue_set_point_clinical('ST7',
  $l$In the depression below the zygomatic arch, anterior to the condyloid process, located with the mouth closed.$l$,
  $a$Benefits the ear and jaw, expels wind, activates the channel.$a$,
  $i$Temporomandibular joint pain and dysfunction, deafness and tinnitus, toothache, facial paralysis, trigeminal neuralgia.$i$,
  $n$Perpendicular, 0.5–1 cun, with the mouth closed.$n$,
  null,
  '{crossing}');

perform public.catalogue_set_point_clinical('ST8',
  $l$At the corner of the forehead, 0.5 cun within the anterior hairline and 4.5 cun lateral to the midline.$l$,
  $a$Expels wind, brightens the eyes, benefits the head.$a$,
  $i$Headache at the temple and forehead, dizziness, blurred vision, excessive tearing, eye pain.$i$,
  $n$Transverse insertion posteriorly, 0.5–1 cun.$n$,
  null,
  '{crossing}');

perform public.catalogue_set_point_clinical('ST9',
  $l$On the neck, level with the tip of the Adam''s apple, at the anterior border of sternocleidomastoid where the carotid pulses.$l$,
  $a$Regulates qi and blood, descends rebellious qi, benefits the throat, regulates blood pressure.$a$,
  $i$Hypertension, sore throat, goitre, asthma, dizziness. A window of the sky point and a sea of qi point.$i$,
  $n$Perpendicular 0.3–0.5 cun, medial to the pulsating artery.$n$,
  $c$The carotid artery and its sinus lie here. Locate the pulse and needle medial to it, shallowly, never bilaterally at once, and never with strong stimulation.$c$,
  '{window_of_sky, sea_point, crossing}');

perform public.catalogue_set_point_clinical('ST10',
  $l$On the neck, midway between ST9 and ST11, at the anterior border of sternocleidomastoid.$l$,
  $a$Benefits the throat, descends rebellious qi.$a$,
  $i$Sore throat, cough and asthma, goitre.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  $c$Avoid the carotid artery. Needle shallowly.$c$,
  '{}');

perform public.catalogue_set_point_clinical('ST11',
  $l$At the superior border of the medial end of the clavicle, between the two heads of sternocleidomastoid.$l$,
  $a$Benefits the throat, descends rebellious qi.$a$,
  $i$Sore throat, cough, hiccup, goitre.$i$,
  $n$Perpendicular, 0.2–0.3 cun.$n$,
  $c$Needle shallowly: the apex of the lung and the subclavian vessels lie below.$c$,
  '{}');

perform public.catalogue_set_point_clinical('ST12',
  $l$In the centre of the supraclavicular fossa, 4 cun lateral to the midline.$l$,
  $a$Descends Lung qi, benefits the throat, activates the channel.$a$,
  $i$Cough, asthma, sore throat, pain of the supraclavicular fossa and shoulder.$i$,
  $n$Perpendicular, 0.3–0.5 cun only.$n$,
  $c$One of the highest-risk points on the body for pneumothorax. Never needle deeply. Contraindicated in pregnancy.$c$,
  '{}');

perform public.catalogue_set_point_clinical('ST13',
  $l$Below the clavicle, 4 cun lateral to the midline.$l$,
  $a$Descends rebellious qi, unbinds the chest.$a$,
  $i$Cough, asthma, chest pain and fullness, hiccup.$i$,
  $n$Oblique or transverse, 0.5–0.8 cun.$n$,
  $c$Do not needle perpendicularly or deeply — pneumothorax risk.$c$,
  '{}');

perform public.catalogue_set_point_clinical('ST14',
  $l$In the first intercostal space, 4 cun lateral to the midline.$l$,
  $a$Unbinds the chest, descends Lung qi.$a$,
  $i$Cough, asthma, chest fullness and pain.$i$,
  $n$Oblique or transverse, 0.5–0.8 cun.$n$,
  $c$Pneumothorax risk on deep perpendicular insertion.$c$,
  '{}');

perform public.catalogue_set_point_clinical('ST15',
  $l$In the second intercostal space, 4 cun lateral to the midline.$l$,
  $a$Unbinds the chest, benefits the breast.$a$,
  $i$Cough, asthma, chest pain, breast pain and abscess.$i$,
  $n$Oblique or transverse, 0.5–0.8 cun.$n$,
  $c$Pneumothorax risk on deep perpendicular insertion.$c$,
  '{}');

perform public.catalogue_set_point_clinical('ST16',
  $l$In the third intercostal space, 4 cun lateral to the midline.$l$,
  $a$Unbinds the chest, benefits the breast, descends rebellious qi.$a$,
  $i$Cough, asthma, chest and breast pain, mastitis.$i$,
  $n$Oblique or transverse, 0.5–0.8 cun.$n$,
  $c$Pneumothorax risk on deep perpendicular insertion.$c$,
  '{}');

perform public.catalogue_set_point_clinical('ST17',
  $l$At the centre of the nipple, in the fourth intercostal space.$l$,
  $a$Used only as a landmark for locating the points of the chest and abdomen.$a$,
  $i$Not needled and not moxaed. It serves to measure the 4-cun lateral line.$i$,
  $n$Forbidden to needle or moxa.$n$,
  $c$This point is never treated. It exists as a landmark.$c$,
  '{}');

perform public.catalogue_set_point_clinical('ST18',
  $l$In the fifth intercostal space, directly below the nipple, 4 cun lateral to the midline.$l$,
  $a$Benefits the breast, descends rebellious qi, unbinds the chest.$a$,
  $i$Insufficient lactation, mastitis, breast pain, cough, hiccup, chest pain.$i$,
  $n$Oblique or transverse, 0.5–0.8 cun.$n$,
  $c$Pneumothorax risk on deep perpendicular insertion.$c$,
  '{}');

perform public.catalogue_set_point_clinical('ST19',
  $l$On the upper abdomen, 6 cun above the umbilicus, 2 cun lateral to the midline.$l$,
  $a$Harmonises the Stomach, descends rebellious qi.$a$,
  $i$Epigastric pain and distension, vomiting, poor appetite, cough with sputum.$i$,
  $n$Perpendicular, 0.5–0.8 cun.$n$,
  $c$Needle with care in thin patients — the liver lies below on the right.$c$,
  '{}');

perform public.catalogue_set_point_clinical('ST20',
  $l$On the upper abdomen, 5 cun above the umbilicus, 2 cun lateral to the midline.$l$,
  $a$Harmonises the Stomach, descends rebellious qi.$a$,
  $i$Epigastric pain and fullness, vomiting, poor appetite, borborygmus.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{}');

perform public.catalogue_set_point_clinical('ST21',
  $l$On the upper abdomen, 4 cun above the umbilicus, 2 cun lateral to the midline.$l$,
  $a$Harmonises the middle burner, transforms stagnation, descends rebellious qi.$a$,
  $i$Epigastric pain, vomiting, poor appetite, indigestion, diarrhoea.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{}');

perform public.catalogue_set_point_clinical('ST22',
  $l$On the upper abdomen, 3 cun above the umbilicus, 2 cun lateral to the midline.$l$,
  $a$Regulates the middle burner, promotes urination.$a$,
  $i$Abdominal pain and distension, poor appetite, oedema, difficult urination.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{}');

perform public.catalogue_set_point_clinical('ST23',
  $l$On the upper abdomen, 2 cun above the umbilicus, 2 cun lateral to the midline.$l$,
  $a$Transforms phlegm, calms the spirit, harmonises the Stomach.$a$,
  $i$Epigastric pain, indigestion, agitation, mania, epilepsy.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{}');

perform public.catalogue_set_point_clinical('ST24',
  $l$On the upper abdomen, 1 cun above the umbilicus, 2 cun lateral to the midline.$l$,
  $a$Transforms phlegm, calms the spirit.$a$,
  $i$Epigastric pain, vomiting, mania and agitation, tongue stiffness.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{}');

perform public.catalogue_set_point_clinical('ST25',
  $l$2 cun lateral to the centre of the umbilicus.$l$,
  $a$Regulates the intestines, resolves dampness and stagnation, regulates qi and blood in the lower burner.$a$,
  $i$Diarrhoea and constipation alike, abdominal pain and distension, borborygmus, dysentery, irregular menstruation, dysmenorrhoea. The front-mu point of the Large Intestine and the principal point for the bowels.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  $c$Use caution in pregnancy.$c$,
  '{front_mu}');

perform public.catalogue_set_point_clinical('ST26',
  $l$On the lower abdomen, 1 cun below the umbilicus, 2 cun lateral to the midline.$l$,
  $a$Regulates qi in the lower burner, relieves pain.$a$,
  $i$Abdominal pain, hernia, dysmenorrhoea, irregular menstruation.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  $c$Caution in pregnancy.$c$,
  '{}');

perform public.catalogue_set_point_clinical('ST27',
  $l$On the lower abdomen, 2 cun below the umbilicus, 2 cun lateral to the midline.$l$,
  $a$Tonifies the Kidney, benefits essence, regulates the lower burner.$a$,
  $i$Seminal emission, premature ejaculation, impotence, difficult urination, lower abdominal pain.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  $c$Caution in pregnancy.$c$,
  '{}');

perform public.catalogue_set_point_clinical('ST28',
  $l$On the lower abdomen, 3 cun below the umbilicus, 2 cun lateral to the midline.$l$,
  $a$Regulates the water passages, promotes urination, benefits the uterus and bladder.$a$,
  $i$Difficult urination, retention of urine, oedema, dysmenorrhoea, pelvic inflammation.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  $c$Contraindicated in pregnancy. Empty the bladder before needling.$c$,
  '{}');

perform public.catalogue_set_point_clinical('ST29',
  $l$On the lower abdomen, 4 cun below the umbilicus, 2 cun lateral to the midline.$l$,
  $a$Regulates menstruation, warms the lower burner, relieves pain.$a$,
  $i$Amenorrhoea, dysmenorrhoea, irregular menstruation, leucorrhoea, hernia, infertility.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  $c$Contraindicated in pregnancy. Empty the bladder before needling.$c$,
  '{}');

perform public.catalogue_set_point_clinical('ST30',
  $l$On the lower abdomen, at the level of the upper border of the pubic symphysis, 2 cun lateral to the midline.$l$,
  $a$Regulates qi in the lower burner, benefits the genitals, regulates the Chong vessel.$a$,
  $i$Hernia, genital pain and swelling, impotence, irregular menstruation, infertility, abdominal pain. The sea of food point.$i$,
  $n$Perpendicular, 0.5–1 cun, avoiding the femoral artery.$n$,
  $c$Contraindicated in pregnancy. The femoral artery lies lateral — palpate and avoid it.$c$,
  '{sea_point, crossing}');

perform public.catalogue_set_point_clinical('ST31',
  $l$On the anterior thigh, at the intersection of a line down from the anterior superior iliac spine and the level of the lower border of the pubic symphysis.$l$,
  $a$Expels wind-damp, benefits the hip and leg, activates the channel.$a$,
  $i$Hip and thigh pain, weakness and numbness of the leg, paralysis, lumbar pain radiating to the thigh.$i$,
  $n$Perpendicular, 1–2 cun.$n$,
  null,
  '{}');

perform public.catalogue_set_point_clinical('ST32',
  $l$On the anterior thigh, 6 cun above the upper lateral border of the patella, on the line between the anterior superior iliac spine and the patella.$l$,
  $a$Expels wind-damp, benefits the knee and leg.$a$,
  $i$Knee and thigh pain, cold sensation in the knee, weakness of the leg, urticaria, beriberi.$i$,
  $n$Perpendicular, 1–1.5 cun.$n$,
  null,
  '{}');

perform public.catalogue_set_point_clinical('ST33',
  $l$On the anterior thigh, 3 cun above the upper lateral border of the patella.$l$,
  $a$Expels wind-damp, benefits the knee.$a$,
  $i$Knee pain and stiffness, cold and numbness of the knee and leg, motor impairment.$i$,
  $n$Perpendicular, 1–1.5 cun.$n$,
  null,
  '{}');

perform public.catalogue_set_point_clinical('ST34',
  $l$On the anterior thigh, 2 cun above the upper lateral border of the patella.$l$,
  $a$Regulates and descends Stomach qi, benefits the knee, relieves acute pain.$a$,
  $i$Acute epigastric pain, acute mastitis, acute knee pain and swelling, vomiting, diarrhoea. The xi-cleft point — reached for in acute conditions.$i$,
  $n$Perpendicular, 1–1.5 cun.$n$,
  null,
  '{xi_cleft}');

perform public.catalogue_set_point_clinical('ST35',
  $l$With the knee flexed, in the depression lateral to the patellar ligament, below the patella.$l$,
  $a$Expels wind-damp, benefits the knee, reduces swelling.$a$,
  $i$Knee pain, swelling and stiffness, weakness of the leg, beriberi.$i$,
  $n$Oblique insertion medially and posteriorly toward the joint space, 0.5–1.2 cun.$n$,
  null,
  '{}');

perform public.catalogue_set_point_clinical('ST36',
  $l$3 cun below ST35, one finger-breadth lateral to the anterior crest of the tibia.$l$,
  $a$Tonifies qi and blood, strengthens the Spleen and Stomach, harmonises the intestines, dispels stagnation, raises yang, supports the constitution.$a$,
  $i$All digestive disorders — epigastric pain, vomiting, diarrhoea, constipation, distension; fatigue and general weakness; knee and leg pain; dizziness; immune support. Command point of the abdomen, sea of food point, and the most-used tonification point in the body.$i$,
  $n$Perpendicular, 1–2 cun. Moxa is very commonly used here.$n$,
  null,
  '{he_sea, command, sea_point}');

perform public.catalogue_set_point_clinical('ST37',
  $l$6 cun below ST35, one finger-breadth lateral to the anterior crest of the tibia.$l$,
  $a$Regulates the intestines, transforms stagnation and dampness.$a$,
  $i$Diarrhoea, dysentery, constipation, abdominal pain, appendicitis, paralysis of the leg. The lower he-sea point of the Large Intestine.$i$,
  $n$Perpendicular, 1–1.5 cun.$n$,
  null,
  '{lower_he_sea}');

perform public.catalogue_set_point_clinical('ST38',
  $l$8 cun below ST35, one finger-breadth lateral to the anterior crest of the tibia.$l$,
  $a$Activates the channel, benefits the shoulder.$a$,
  $i$Frozen shoulder and shoulder pain — the classical distal point for it — and pain or weakness of the lower leg.$i$,
  $n$Perpendicular, 1–1.5 cun, with the patient moving the shoulder during retention.$n$,
  null,
  '{}');

perform public.catalogue_set_point_clinical('ST39',
  $l$9 cun below ST35, one finger-breadth lateral to the anterior crest of the tibia.$l$,
  $a$Regulates the intestines, transforms stagnation.$a$,
  $i$Lower abdominal pain, diarrhoea, dysentery, mastitis, paralysis of the leg. The lower he-sea point of the Small Intestine.$i$,
  $n$Perpendicular, 1–1.5 cun.$n$,
  null,
  '{lower_he_sea}');

perform public.catalogue_set_point_clinical('ST40',
  $l$8 cun above the tip of the lateral malleolus, two finger-breadths lateral to the anterior crest of the tibia.$l$,
  $a$Transforms phlegm and dampness, calms the spirit, opens the chest.$a$,
  $i$Cough with copious sputum, asthma, chest oppression, dizziness, mania and phlegm-misting patterns, oedema, leg pain. The principal phlegm-resolving point of the body.$i$,
  $n$Perpendicular, 1–1.5 cun.$n$,
  null,
  '{luo_connecting}');

perform public.catalogue_set_point_clinical('ST41',
  $l$On the ankle crease, in the depression between the tendons of extensor hallucis longus and extensor digitorum longus.$l$,
  $a$Clears heat, calms the spirit, benefits the ankle, transforms damp.$a$,
  $i$Ankle pain and swelling, foot drop, headache, dizziness, constipation, mania and agitation.$i$,
  $n$Perpendicular, 0.5–0.8 cun.$n$,
  null,
  '{jing_river}');

perform public.catalogue_set_point_clinical('ST42',
  $l$On the dorsum of the foot, at the highest point of the instep, where the dorsalis pedis artery pulses.$l$,
  $a$Harmonises the Stomach, calms the spirit, benefits the foot.$a$,
  $i$Facial paralysis, toothache, foot swelling and weakness, epigastric pain, mania.$i$,
  $n$Perpendicular, 0.3–0.5 cun, avoiding the artery.$n$,
  $c$The dorsalis pedis artery runs through this point: palpate and needle beside it.$c$,
  '{yuan_source}');

perform public.catalogue_set_point_clinical('ST43',
  $l$On the dorsum of the foot, in the depression between the second and third metatarsal bones, proximal to their heads.$l$,
  $a$Resolves dampness, reduces oedema, harmonises the Stomach.$a$,
  $i$Facial and generalised oedema, abdominal pain and distension, foot pain and swelling, red eyes.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{shu_stream}');

perform public.catalogue_set_point_clinical('ST44',
  $l$On the dorsum of the foot, proximal to the web margin between the second and third toes.$l$,
  $a$Clears heat from the Stomach and the yang ming channel, stops pain.$a$,
  $i$Toothache of the upper jaw, sore throat, nosebleed, facial swelling, epigastric burning, constipation, acid reflux, fever. The main point for clearing Stomach heat.$i$,
  $n$Perpendicular or oblique, 0.3–0.5 cun.$n$,
  null,
  '{ying_spring}');

perform public.catalogue_set_point_clinical('ST45',
  $l$On the lateral side of the second toe, 0.1 cun proximal to the corner of the nail.$l$,
  $a$Clears heat, calms the spirit, restores consciousness, harmonises the Stomach.$a$,
  $i$Nightmares and restless sleep, mania, facial swelling, toothache, indigestion, febrile disease, loss of consciousness.$i$,
  $n$Shallow perpendicular 0.1 cun, or prick to bleed.$n$,
  null,
  '{jing_well}');

-- ---------------------------------------------------------------------------
-- SP · Spleen
-- ---------------------------------------------------------------------------

perform public.catalogue_set_point_clinical('SP1',
  $l$On the medial side of the great toe, 0.1 cun proximal to the corner of the nail.$l$,
  $a$Stops bleeding, restores consciousness, strengthens the Spleen''s hold on the blood.$a$,
  $i$Uterine bleeding, blood in the stool or urine, nosebleed, excessive menstrual bleeding, mania, dream-disturbed sleep, childhood convulsions.$i$,
  $n$Shallow perpendicular 0.1 cun, or prick to bleed. Moxa is classically preferred for bleeding.$n$,
  null,
  '{jing_well}');

perform public.catalogue_set_point_clinical('SP2',
  $l$On the medial side of the great toe, distal to the first metatarsophalangeal joint, on the border between red and white skin.$l$,
  $a$Clears heat, strengthens the Spleen, resolves dampness.$a$,
  $i$Abdominal distension, poor appetite, febrile disease without sweating, heaviness of the body.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{ying_spring}');

perform public.catalogue_set_point_clinical('SP3',
  $l$On the medial foot, proximal to the head of the first metatarsal bone, on the border between red and white skin.$l$,
  $a$Tonifies the Spleen, resolves dampness, harmonises the middle burner.$a$,
  $i$Abdominal distension and pain, diarrhoea, constipation, poor appetite, heaviness of the body and limbs, oedema. The source point — the principal tonification point of the Spleen.$i$,
  $n$Perpendicular, 0.5–0.8 cun.$n$,
  null,
  '{shu_stream, yuan_source}');

perform public.catalogue_set_point_clinical('SP4',
  $l$On the medial foot, in the depression distal and inferior to the base of the first metatarsal bone.$l$,
  $a$Strengthens the Spleen, harmonises the middle burner, regulates the Chong vessel, calms the spirit.$a$,
  $i$Abdominal pain and distension, diarrhoea and dysentery, vomiting, irregular and painful menstruation, insomnia and restlessness. Confluent point of the Chong vessel, paired with PC6.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{luo_connecting, confluent}');

perform public.catalogue_set_point_clinical('SP5',
  $l$On the medial ankle, in the depression distal and inferior to the medial malleolus, midway between its prominence and the tuberosity of the navicular.$l$,
  $a$Strengthens the Spleen, resolves dampness, benefits the ankle and sinews.$a$,
  $i$Ankle pain and swelling, abdominal distension, borborygmus, jaundice, heaviness of the body, childhood convulsions.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{jing_river}');

perform public.catalogue_set_point_clinical('SP6',
  $l$3 cun above the prominence of the medial malleolus, on the posterior border of the tibia.$l$,
  $a$Tonifies the Spleen and Kidney, resolves dampness, regulates menstruation and the uterus, harmonises the liver, calms the spirit.$a$,
  $i$All gynaecological disorders — irregular, painful or absent menstruation, infertility, difficult labour; urogenital disorders; digestive complaints; insomnia; oedema. The meeting point of the three leg yin channels and one of the most-used points in the body.$i$,
  $n$Perpendicular, 1–1.5 cun.$n$,
  $c$Contraindicated in pregnancy — classically used to promote labour.$c$,
  '{crossing}');

perform public.catalogue_set_point_clinical('SP7',
  $l$6 cun above the prominence of the medial malleolus, on the posterior border of the tibia.$l$,
  $a$Resolves dampness, benefits the leg.$a$,
  $i$Abdominal distension and borborygmus, heaviness and coldness of the leg, difficult urination, numbness of the knee and leg.$i$,
  $n$Perpendicular, 1–1.5 cun.$n$,
  null,
  '{}');

perform public.catalogue_set_point_clinical('SP8',
  $l$3 cun below SP9, on the line between SP9 and the medial malleolus.$l$,
  $a$Regulates the uterus, invigorates blood, relieves acute pain, resolves dampness.$a$,
  $i$Acute dysmenorrhoea, irregular menstruation, acute abdominal pain, seminal emission, oedema. The xi-cleft point — the point for acute menstrual pain.$i$,
  $n$Perpendicular, 1–1.5 cun.$n$,
  null,
  '{xi_cleft}');

perform public.catalogue_set_point_clinical('SP9',
  $l$In the depression below the medial condyle of the tibia, at the angle between the posterior border of the tibia and the calf muscle.$l$,
  $a$Resolves dampness, regulates the water passages, benefits the lower burner and the knee.$a$,
  $i$Oedema, difficult or painful urination, diarrhoea, abdominal distension, knee pain and swelling, leucorrhoea, jaundice. The principal point for draining dampness.$i$,
  $n$Perpendicular, 1–2 cun.$n$,
  null,
  '{he_sea}');

perform public.catalogue_set_point_clinical('SP10',
  $l$With the knee flexed, 2 cun above the superomedial border of the patella, on the bulge of vastus medialis.$l$,
  $a$Invigorates and cools the blood, regulates menstruation, benefits the skin.$a$,
  $i$Irregular and painful menstruation, uterine bleeding, urticaria, eczema and itching skin, knee pain. The sea of blood.$i$,
  $n$Perpendicular, 1–1.5 cun.$n$,
  null,
  '{}');

perform public.catalogue_set_point_clinical('SP11',
  $l$On the medial thigh, 6 cun above SP10, on the line between SP10 and SP12.$l$,
  $a$Resolves damp-heat in the lower burner, promotes urination.$a$,
  $i$Difficult and painful urination, retention of urine, pain of the inner thigh, genital itching.$i$,
  $n$Perpendicular, 0.5–1 cun, avoiding the femoral artery.$n$,
  $c$The femoral artery runs close by: palpate and avoid it.$c$,
  '{}');

perform public.catalogue_set_point_clinical('SP12',
  $l$At the lateral end of the inguinal groove, 3.5 cun lateral to the midline, lateral to the femoral artery.$l$,
  $a$Regulates qi in the lower burner, benefits the uterus and genitals.$a$,
  $i$Hernia, lower abdominal pain, difficult urination, uterine prolapse, painful menstruation.$i$,
  $n$Perpendicular, 0.5–1 cun, lateral to the pulsating artery.$n$,
  $c$Avoid the femoral artery. Caution in pregnancy.$c$,
  '{crossing}');

perform public.catalogue_set_point_clinical('SP13',
  $l$On the lower abdomen, 0.7 cun above SP12, 4 cun lateral to the midline.$l$,
  $a$Regulates qi, relieves abdominal pain, dissipates accumulations.$a$,
  $i$Lower abdominal pain, hernia, abdominal masses.$i$,
  $n$Perpendicular, 0.7–1.2 cun.$n$,
  $c$Caution in pregnancy.$c$,
  '{crossing}');

perform public.catalogue_set_point_clinical('SP14',
  $l$On the abdomen, 1.3 cun below the umbilicus, 4 cun lateral to the midline.$l$,
  $a$Regulates qi, warms the intestines, relieves pain.$a$,
  $i$Periumbilical pain, hernia, constipation, diarrhoea.$i$,
  $n$Perpendicular, 0.7–1.2 cun.$n$,
  $c$Caution in pregnancy.$c$,
  '{}');

perform public.catalogue_set_point_clinical('SP15',
  $l$4 cun lateral to the centre of the umbilicus.$l$,
  $a$Regulates the intestines, moves stagnation, relieves constipation.$a$,
  $i$Constipation, diarrhoea, abdominal pain and distension, dysentery.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  $c$Caution in pregnancy.$c$,
  '{crossing}');

perform public.catalogue_set_point_clinical('SP16',
  $l$On the upper abdomen, 3 cun above the umbilicus, 4 cun lateral to the midline.$l$,
  $a$Regulates the middle burner, benefits digestion.$a$,
  $i$Abdominal pain, indigestion, dysentery, constipation.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  null,
  '{crossing}');

perform public.catalogue_set_point_clinical('SP17',
  $l$In the fifth intercostal space, 6 cun lateral to the midline.$l$,
  $a$Unbinds the chest, regulates qi, resolves dampness.$a$,
  $i$Chest and hypochondriac fullness and pain, belching, oedema.$i$,
  $n$Oblique or transverse, 0.5–0.8 cun.$n$,
  $c$Do not needle perpendicularly or deeply — pneumothorax risk.$c$,
  '{}');

perform public.catalogue_set_point_clinical('SP18',
  $l$In the fourth intercostal space, 6 cun lateral to the midline.$l$,
  $a$Benefits the breast, unbinds the chest.$a$,
  $i$Insufficient lactation, mastitis, breast pain, cough, chest pain.$i$,
  $n$Oblique or transverse, 0.5–0.8 cun.$n$,
  $c$Pneumothorax risk on deep perpendicular insertion.$c$,
  '{}');

perform public.catalogue_set_point_clinical('SP19',
  $l$In the third intercostal space, 6 cun lateral to the midline.$l$,
  $a$Unbinds the chest, descends rebellious qi.$a$,
  $i$Chest and hypochondriac pain and fullness, cough.$i$,
  $n$Oblique or transverse, 0.5–0.8 cun.$n$,
  $c$Pneumothorax risk on deep perpendicular insertion.$c$,
  '{}');

perform public.catalogue_set_point_clinical('SP20',
  $l$In the second intercostal space, 6 cun lateral to the midline.$l$,
  $a$Unbinds the chest, descends rebellious qi.$a$,
  $i$Cough, chest and hypochondriac pain, wheezing.$i$,
  $n$Oblique or transverse, 0.5–0.8 cun.$n$,
  $c$Pneumothorax risk on deep perpendicular insertion.$c$,
  '{}');

perform public.catalogue_set_point_clinical('SP21',
  $l$On the mid-axillary line, in the sixth intercostal space.$l$,
  $a$Governs the blood of the whole body, unbinds the chest, benefits the sinews and joints.$a$,
  $i$Generalised aching of the whole body, weakness of the limbs, chest and hypochondriac pain, asthma. The great luo-connecting point of the Spleen, which spreads over the chest and flanks.$i$,
  $n$Oblique or transverse, 0.5–0.8 cun.$n$,
  $c$Pneumothorax risk on deep perpendicular insertion.$c$,
  '{luo_connecting, group_luo}');

end
$seed$;
