-- ============================================================================
-- Point clinical reference · 07 · Liver, Ren vessel and Du vessel
-- ============================================================================
-- See 02_lung_large_intestine.sql for conventions.
-- ============================================================================

do $seed$
begin

-- ---------------------------------------------------------------------------
-- LR · Liver
-- ---------------------------------------------------------------------------

perform public.set_point_clinical('LR1',
  $l$On the lateral side of the great toe, 0.1 cun proximal to the corner of the nail.$l$,
  $a$Stops bleeding, regulates the lower burner, restores consciousness, benefits the genitals.$a$,
  $i$Uterine bleeding, excessive menstrual bleeding, hernia, genital pain and swelling, difficult urination, loss of consciousness, epilepsy.$i$,
  $n$Shallow perpendicular 0.1 cun, or prick to bleed. Moxa is classical for bleeding and hernia.$n$,
  null,
  '{jing_well}');

perform public.set_point_clinical('LR2',
  $l$On the dorsum of the foot, proximal to the web margin between the first and second toes.$l$,
  $a$Drains Liver fire, clears heat, subdues rising yang, cools the blood.$a$,
  $i$Headache and dizziness from Liver fire, red and painful eyes, irritability and anger, hypertension, insomnia, epilepsy, painful menstruation, genital pain, nosebleed. The main point for draining Liver fire.$i$,
  $n$Perpendicular or oblique proximally, 0.5–0.8 cun.$n$,
  null,
  '{ying_spring}');

perform public.set_point_clinical('LR3',
  $l$On the dorsum of the foot, in the depression distal to the junction of the first and second metatarsal bones.$l$,
  $a$Spreads Liver qi, subdues Liver yang, nourishes Liver blood, calms the spirit, benefits the eyes and the lower burner.$a$,
  $i$Irritability, depression and emotional constraint; headache and dizziness; hypertension; red eyes; irregular and painful menstruation; hypochondriac pain; insomnia; cramps and spasms. The source point and one of the most-used points in the body — often paired with LI4 as the Four Gates.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  $c$Caution in pregnancy when combined with LI4, which together move qi and blood strongly.$c$,
  '{shu_stream, yuan_source}');

perform public.set_point_clinical('LR4',
  $l$On the medial ankle, anterior to the medial malleolus, in the depression medial to the tendon of tibialis anterior.$l$,
  $a$Spreads Liver qi, clears damp-heat from the lower burner, benefits the ankle.$a$,
  $i$Ankle pain and sprain, hernia, genital pain, difficult urination, jaundice, seminal emission.$i$,
  $n$Perpendicular, 0.5–0.8 cun.$n$,
  null,
  '{jing_river}');

perform public.set_point_clinical('LR5',
  $l$5 cun above the tip of the medial malleolus, on the medial surface of the tibia.$l$,
  $a$Regulates the lower burner and genitals, clears damp-heat, regulates menstruation.$a$,
  $i$Genital itching and pain, leucorrhoea, irregular menstruation, difficult urination, hernia, depression.$i$,
  $n$Transverse or oblique along the tibia, 0.5–0.8 cun.$n$,
  null,
  '{luo_connecting}');

perform public.set_point_clinical('LR6',
  $l$7 cun above the tip of the medial malleolus, on the medial surface of the tibia.$l$,
  $a$Regulates the Liver, relieves acute pain, stops uterine bleeding.$a$,
  $i$Acute hypochondriac pain, acute dysmenorrhoea, uterine bleeding, hernia, lower abdominal pain. The xi-cleft point.$i$,
  $n$Transverse or oblique along the tibia, 0.5–0.8 cun.$n$,
  null,
  '{xi_cleft}');

perform public.set_point_clinical('LR7',
  $l$With the knee flexed, below the medial condyle of the tibia, posterior and superior to SP9.$l$,
  $a$Benefits the knee, relaxes the sinews, expels wind-damp.$a$,
  $i$Knee pain and swelling, difficulty walking, pain of the medial thigh.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('LR8',
  $l$With the knee flexed, at the medial end of the popliteal crease, above the tendons of semitendinosus and semimembranosus.$l$,
  $a$Clears damp-heat from the lower burner, nourishes Liver blood and yin, benefits the knee and genitals.$a$,
  $i$Genital itching and pain, leucorrhoea, difficult urination, uterine prolapse, knee and medial thigh pain, seminal emission, infertility.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  null,
  '{he_sea}');

perform public.set_point_clinical('LR9',
  $l$On the medial thigh, 4 cun above the medial epicondyle of the femur, between vastus medialis and sartorius.$l$,
  $a$Regulates menstruation, benefits urination, activates the channel.$a$,
  $i$Irregular menstruation, lower abdominal pain, difficult urination or enuresis, pain of the medial thigh and lumbosacral region.$i$,
  $n$Perpendicular, 1–2 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('LR10',
  $l$On the medial thigh, 3 cun below ST30, at the anterior border of adductor longus.$l$,
  $a$Regulates qi in the lower burner, benefits urination and the genitals.$a$,
  $i$Lower abdominal distension, difficult urination, genital pain and swelling, medial thigh pain.$i$,
  $n$Perpendicular, 0.5–1 cun, avoiding the femoral artery.$n$,
  $c$The femoral artery lies close: palpate and avoid it.$c$,
  '{}');

perform public.set_point_clinical('LR11',
  $l$On the medial thigh, 2 cun below ST30, at the border of the pubic tubercle.$l$,
  $a$Regulates menstruation, benefits the genitals, warms the lower burner.$a$,
  $i$Irregular menstruation, infertility, genital pain, pain of the medial thigh.$i$,
  $n$Perpendicular, 0.5–1 cun, avoiding the femoral artery.$n$,
  $c$Avoid the femoral artery. Caution in pregnancy.$c$,
  '{}');

perform public.set_point_clinical('LR12',
  $l$In the groin, 2.5 cun lateral to the midline, at the level of the upper border of the pubic symphysis, inferior to ST30.$l$,
  $a$Regulates the lower burner, benefits the genitals and uterus.$a$,
  $i$Hernia, genital pain, uterine prolapse, lower abdominal pain.$i$,
  $n$Perpendicular, 0.5–1 cun, avoiding the femoral artery.$n$,
  $c$Avoid the femoral artery. Contraindicated in pregnancy.$c$,
  '{}');

perform public.set_point_clinical('LR13',
  $l$On the lateral abdomen, at the free end of the eleventh rib.$l$,
  $a$Harmonises the Liver and Spleen, resolves food stagnation, dissipates masses.$a$,
  $i$Abdominal distension and pain, borborygmus, vomiting, diarrhoea, hypochondriac pain, abdominal masses, jaundice. The front-mu point of the Spleen and the influential point of the zang organs.$i$,
  $n$Perpendicular or oblique, 0.5–0.8 cun.$n$,
  $c$Do not needle deeply — the spleen lies beneath on the left, the liver on the right.$c$,
  '{front_mu, influential, crossing}');

perform public.set_point_clinical('LR14',
  $l$In the sixth intercostal space, directly below the nipple, two ribs below the nipple line.$l$,
  $a$Spreads Liver qi, harmonises the Liver and Stomach, unbinds the chest, invigorates blood.$a$,
  $i$Hypochondriac and chest pain and fullness, hiccup and belching, acid regurgitation, vomiting, depression, mastitis, hepatitis. The front-mu point of the Liver.$i$,
  $n$Oblique or transverse along the intercostal space, 0.3–0.5 cun.$n$,
  $c$Never perpendicular and deep — the liver lies beneath on the right and pneumothorax is a risk on both sides.$c$,
  '{front_mu, crossing}');

-- ---------------------------------------------------------------------------
-- REN · Conception vessel
-- ---------------------------------------------------------------------------

perform public.set_point_clinical('REN1',
  $l$Between the anus and the posterior border of the scrotum in men, or the posterior labial commissure in women.$l$,
  $a$Restores consciousness, benefits the genitals and anus, regulates the lower burner.$a$,
  $i$Drowning and loss of consciousness, genital itching and pain, retention of urine, haemorrhoids, irregular menstruation.$i$,
  $n$Perpendicular, 0.5–1 cun, with the patient in a side-lying or lithotomy position.$n$,
  $c$Contraindicated in pregnancy. An intimate site: explain, obtain explicit consent, and use appropriate draping and, where available, a chaperone.$c$,
  '{crossing}');

perform public.set_point_clinical('REN2',
  $l$On the midline of the lower abdomen, at the upper border of the pubic symphysis, 5 cun below the umbilicus.$l$,
  $a$Benefits the bladder, regulates menstruation, warms the lower burner.$a$,
  $i$Retention of urine, difficult or painful urination, enuresis, irregular menstruation, impotence, uterine prolapse.$i$,
  $n$Perpendicular, 0.5–1 cun, directed slightly downward.$n$,
  $c$Contraindicated in pregnancy. Ask the patient to empty the bladder first — a full bladder rises above the pubic bone and can be punctured.$c$,
  '{crossing}');

perform public.set_point_clinical('REN3',
  $l$On the midline, 4 cun below the umbilicus.$l$,
  $a$Benefits the bladder, regulates the lower burner and the uterus, resolves damp-heat.$a$,
  $i$Retention and frequency of urination, cystitis, enuresis, irregular menstruation, leucorrhoea, infertility, impotence. The front-mu point of the Bladder.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  $c$Contraindicated in pregnancy. Empty the bladder before needling.$c$,
  '{front_mu, crossing}');

perform public.set_point_clinical('REN4',
  $l$On the midline, 3 cun below the umbilicus.$l$,
  $a$Tonifies original qi and the Kidney, nourishes blood and yin, warms and fortifies the lower burner, rescues yang.$a$,
  $i$Exhaustion and chronic deficiency, infertility, impotence and seminal emission, irregular and painful menstruation, uterine bleeding, frequent urination, diarrhoea, collapse. The front-mu point of the Small Intestine and one of the great tonification points, much used with moxa.$i$,
  $n$Perpendicular, 0.8–1.2 cun. Moxa is very commonly used.$n$,
  $c$Contraindicated in pregnancy. Empty the bladder before needling.$c$,
  '{front_mu, crossing}');

perform public.set_point_clinical('REN5',
  $l$On the midline, 2 cun below the umbilicus.$l$,
  $a$Regulates the water passages of the San Jiao, benefits the uterus and the lower burner.$a$,
  $i$Oedema, difficult urination, irregular menstruation, uterine bleeding, lower abdominal pain, hernia. The front-mu point of the San Jiao.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  $c$Contraindicated in pregnancy. Classically said to cause infertility if moxaed heavily in women — use judgement.$c$,
  '{front_mu}');

perform public.set_point_clinical('REN6',
  $l$On the midline, 1.5 cun below the umbilicus.$l$,
  $a$Tonifies and raises qi, rescues collapsed yang, regulates qi in the lower burner.$a$,
  $i$Fatigue and exhaustion, prolapse of the uterus or rectum, abdominal distension and pain, constipation, irregular menstruation, impotence, shock and collapse. The sea of qi — the principal qi-tonifying point of the abdomen.$i$,
  $n$Perpendicular, 0.8–1.2 cun. Moxa is very commonly used.$n$,
  $c$Contraindicated in pregnancy.$c$,
  '{sea_point}');

perform public.set_point_clinical('REN7',
  $l$On the midline, 1 cun below the umbilicus.$l$,
  $a$Regulates the uterus and the lower burner, benefits menstruation.$a$,
  $i$Irregular menstruation, uterine bleeding, postpartum abdominal pain, hernia, abdominal distension.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  $c$Contraindicated in pregnancy.$c$,
  '{crossing}');

perform public.set_point_clinical('REN8',
  $l$At the centre of the umbilicus.$l$,
  $a$Warms and rescues devastated yang, warms the Spleen and Kidney, regulates the intestines.$a$,
  $i$Collapse with cold limbs, chronic diarrhoea, abdominal pain and distension, oedema, prolapse.$i$,
  $n$Needling is contraindicated. Treated with indirect moxa, classically on salt or on a slice of ginger.$n$,
  $c$Never needled. Direct moxa on the skin is avoided; use salt or ginger as an insulating layer.$c$,
  '{}');

perform public.set_point_clinical('REN9',
  $l$On the midline, 1 cun above the umbilicus.$l$,
  $a$Regulates the water passages, resolves oedema, harmonises the intestines.$a$,
  $i$Oedema, ascites, difficult urination, borborygmus, diarrhoea, abdominal distension. The principal point for oedema on the Ren vessel.$i$,
  $n$Perpendicular, 0.8–1.2 cun. Moxa is favoured for oedema.$n$,
  $c$Caution in pregnancy.$c$,
  '{}');

perform public.set_point_clinical('REN10',
  $l$On the midline, 2 cun above the umbilicus.$l$,
  $a$Harmonises the Stomach, resolves food stagnation, descends rebellious qi.$a$,
  $i$Epigastric pain and distension, indigestion, vomiting, borborygmus, poor appetite.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  $c$Caution in pregnancy.$c$,
  '{crossing}');

perform public.set_point_clinical('REN11',
  $l$On the midline, 3 cun above the umbilicus.$l$,
  $a$Harmonises the middle burner, resolves stagnation.$a$,
  $i$Epigastric pain, abdominal distension, vomiting, poor appetite.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('REN12',
  $l$On the midline, 4 cun above the umbilicus, midway between the umbilicus and the sternocostal angle.$l$,
  $a$Harmonises and tonifies the Stomach and Spleen, descends rebellious qi, resolves dampness.$a$,
  $i$All Stomach disorders — epigastric pain, distension, vomiting, acid reflux, poor appetite, indigestion, ulcer; also diarrhoea, insomnia from Stomach disharmony. The front-mu point of the Stomach and the influential point of the fu organs.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  null,
  '{front_mu, influential, crossing}');

perform public.set_point_clinical('REN13',
  $l$On the midline, 5 cun above the umbilicus.$l$,
  $a$Harmonises the Stomach, descends rebellious qi, calms the spirit.$a$,
  $i$Epigastric pain, vomiting, hiccup, difficulty swallowing, palpitations, epilepsy.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  $c$Needle shallowly in thin patients — the stomach and liver lie beneath.$c$,
  '{crossing}');

perform public.set_point_clinical('REN14',
  $l$On the midline, 6 cun above the umbilicus, 2 cun below the sternocostal angle.$l$,
  $a$Regulates the Heart, calms the spirit, descends rebellious qi, unbinds the chest.$a$,
  $i$Cardiac pain, palpitations, anxiety and agitation, epilepsy and mania, vomiting, acid reflux, difficulty swallowing. The front-mu point of the Heart.$i$,
  $n$Perpendicular or oblique downward, 0.3–0.8 cun.$n$,
  $c$Do not needle upward or deeply — the heart and liver lie beneath, and in a patient with a short sternocostal angle the margin is small.$c$,
  '{front_mu}');

perform public.set_point_clinical('REN15',
  $l$Below the xiphoid process, on the midline, 7 cun above the umbilicus.$l$,
  $a$Calms the spirit, descends rebellious qi, regulates the Heart.$a$,
  $i$Cardiac pain, palpitations, epilepsy and mania, asthma, chest fullness, vomiting. The luo-connecting point of the Ren vessel.$i$,
  $n$Oblique insertion downward, 0.4–0.6 cun.$n$,
  $c$Do not needle upward or deeply. Classically listed among the forbidden points for deep needling.$c$,
  '{luo_connecting}');

perform public.set_point_clinical('REN16',
  $l$On the midline of the sternum, level with the fifth intercostal space.$l$,
  $a$Unbinds the chest, descends rebellious qi.$a$,
  $i$Chest pain and fullness, hiccup, vomiting, difficulty swallowing, poor appetite in children.$i$,
  $n$Transverse insertion, 0.3–0.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('REN17',
  $l$On the midline of the sternum, level with the fourth intercostal space, between the nipples.$l$,
  $a$Regulates and tonifies the qi of the chest, unbinds the chest, descends rebellious qi, benefits the breast.$a$,
  $i$Asthma and shortness of breath, chest pain and oppression, palpitations, insufficient lactation, mastitis, hiccup, anxiety. The front-mu point of the Pericardium, the influential point of qi, and the sea of qi of the upper burner.$i$,
  $n$Transverse insertion, usually downward, 0.3–0.5 cun.$n$,
  $c$Transverse only — never perpendicular. In an elderly patient the sternum can be thin.$c$,
  '{front_mu, influential, sea_point, crossing}');

perform public.set_point_clinical('REN18',
  $l$On the midline of the sternum, level with the third intercostal space.$l$,
  $a$Unbinds the chest, descends Lung qi.$a$,
  $i$Cough, asthma, chest pain and fullness, vomiting.$i$,
  $n$Transverse insertion, 0.3–0.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('REN19',
  $l$On the midline of the sternum, level with the second intercostal space.$l$,
  $a$Unbinds the chest, descends rebellious Lung qi.$a$,
  $i$Cough, asthma, chest pain, vomiting.$i$,
  $n$Transverse insertion, 0.3–0.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('REN20',
  $l$On the midline of the sternum, level with the first intercostal space.$l$,
  $a$Descends Lung qi, unbinds the chest.$a$,
  $i$Cough, asthma, chest pain, sore throat.$i$,
  $n$Transverse insertion, 0.3–0.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('REN21',
  $l$On the midline of the manubrium, 1 cun below REN22.$l$,
  $a$Descends Lung qi, benefits the throat.$a$,
  $i$Cough, asthma, chest pain, sore throat.$i$,
  $n$Transverse insertion, 0.3–0.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('REN22',
  $l$In the centre of the suprasternal fossa, 0.5 cun above the sternal notch.$l$,
  $a$Descends rebellious qi, benefits the throat and voice, transforms phlegm.$a$,
  $i$Asthma and wheezing, cough, sore throat, loss of voice, globus sensation, difficulty swallowing, goitre, hiccup.$i$,
  $n$Insert perpendicularly 0.2 cun, then turn the needle and direct it downward behind the sternum, 0.5–1 cun.$n$,
  $c$The angle is the safety. Never continue perpendicularly and never angle backward: the trachea, the great vessels and the pleural domes are all within reach.$c$,
  '{crossing}');

perform public.set_point_clinical('REN23',
  $l$Above the Adam''s apple, in the depression at the upper border of the hyoid bone.$l$,
  $a$Benefits the tongue and voice, descends rebellious qi, dissipates phlegm.$a$,
  $i$Aphasia and slurred speech after stroke, stiff tongue, loss of voice, difficulty swallowing, excessive salivation, sudden hoarseness.$i$,
  $n$Oblique insertion toward the root of the tongue, 0.5–1 cun.$n$,
  $c$Sensitive; may provoke gagging. Do not retain the needle for long.$c$,
  '{crossing}');

perform public.set_point_clinical('REN24',
  $l$In the depression at the centre of the mentolabial groove, below the lower lip.$l$,
  $a$Expels wind, benefits the face and mouth, generates fluids.$a$,
  $i$Facial paralysis, deviation of the mouth, excessive salivation, toothache and gum swelling, thirst and diabetes, sudden loss of voice.$i$,
  $n$Oblique insertion upward, 0.2–0.3 cun.$n$,
  null,
  '{crossing}');

-- ---------------------------------------------------------------------------
-- DU · Governing vessel
-- ---------------------------------------------------------------------------

perform public.set_point_clinical('DU1',
  $l$Midway between the tip of the coccyx and the anus, located with the patient prone or kneeling.$l$,
  $a$Benefits the anus, regulates the Du vessel, calms the spirit.$a$,
  $i$Haemorrhoids and anal prolapse, constipation and diarrhoea, coccygeal pain, epilepsy, mania. The luo-connecting point of the Du vessel.$i$,
  $n$Perpendicular or oblique upward parallel to the coccyx, 0.5–1 cun.$n$,
  $c$An intimate site: explain, obtain explicit consent and drape appropriately.$c$,
  '{luo_connecting}');

perform public.set_point_clinical('DU2',
  $l$In the sacral hiatus, at the lower end of the sacrum.$l$,
  $a$Strengthens the lower back, benefits the lower burner.$a$,
  $i$Lumbosacral pain and stiffness, haemorrhoids, irregular menstruation, epilepsy, weakness of the legs.$i$,
  $n$Oblique insertion upward, 0.5–1 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('DU3',
  $l$Below the spinous process of L4, level with the highest points of the iliac crests.$l$,
  $a$Strengthens the lower back and knees, benefits the lower burner, expels cold-damp.$a$,
  $i$Chronic lower back pain and stiffness, sciatica, weakness of the legs, irregular menstruation, impotence, seminal emission, diarrhoea.$i$,
  $n$Perpendicular or oblique upward, 0.5–1 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('DU4',
  $l$Below the spinous process of L2, between the two BL23 points.$l$,
  $a$Tonifies Kidney yang and the fire of the gate of vitality, strengthens the lower back, benefits essence.$a$,
  $i$Chronic lower back pain and coldness, impotence and seminal emission, infertility, chronic diarrhoea and daybreak diarrhoea, irregular menstruation, exhaustion. A principal moxa point for yang deficiency.$i$,
  $n$Perpendicular or oblique upward, 0.5–1 cun. Moxa is very commonly used.$n$,
  null,
  '{}');

perform public.set_point_clinical('DU5',
  $l$Below the spinous process of L1.$l$,
  $a$Strengthens the lower back, regulates the intestines.$a$,
  $i$Lumbar stiffness and pain, diarrhoea, abdominal distension, indigestion.$i$,
  $n$Oblique insertion upward, 0.5–1 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('DU6',
  $l$Below the spinous process of T11.$l$,
  $a$Strengthens the Spleen, resolves dampness, calms the spirit.$a$,
  $i$Epigastric pain, jaundice, diarrhoea, haemorrhoids, epilepsy, back stiffness.$i$,
  $n$Oblique insertion upward, 0.5–1 cun.$n$,
  $c$Angle upward along the spine; do not needle perpendicularly and deeply.$c$,
  '{}');

perform public.set_point_clinical('DU7',
  $l$Below the spinous process of T10.$l$,
  $a$Harmonises the middle burner, benefits the spine.$a$,
  $i$Epigastric pain, back stiffness and pain, poor appetite.$i$,
  $n$Oblique insertion upward, 0.5–1 cun.$n$,
  $c$Angle upward; never perpendicular and deep.$c$,
  '{}');

perform public.set_point_clinical('DU8',
  $l$Below the spinous process of T9.$l$,
  $a$Spreads Liver qi, relaxes the sinews, calms the spirit.$a$,
  $i$Muscular spasm and contraction, epilepsy, back stiffness, jaundice, gastric pain.$i$,
  $n$Oblique insertion upward, 0.5–1 cun.$n$,
  $c$Angle upward; never perpendicular and deep.$c$,
  '{}');

perform public.set_point_clinical('DU9',
  $l$Below the spinous process of T7, level with the lower angles of the scapulae.$l$,
  $a$Regulates the Liver and Gallbladder, resolves damp-heat, unbinds the chest.$a$,
  $i$Jaundice, chest and back pain, cough and asthma, epigastric pain.$i$,
  $n$Oblique insertion upward, 0.5–1 cun.$n$,
  $c$Angle upward; never perpendicular and deep — pneumothorax risk.$c$,
  '{}');

perform public.set_point_clinical('DU10',
  $l$Below the spinous process of T6.$l$,
  $a$Clears heat, benefits the skin, calms the spirit.$a$,
  $i$Boils and furuncles, back pain and stiffness, cough, asthma.$i$,
  $n$Oblique insertion upward, 0.5–1 cun.$n$,
  $c$Angle upward; never perpendicular and deep.$c$,
  '{}');

perform public.set_point_clinical('DU11',
  $l$Below the spinous process of T5.$l$,
  $a$Calms the spirit, regulates the Heart, unbinds the chest.$a$,
  $i$Palpitations, anxiety, poor memory, epilepsy, cough, back stiffness.$i$,
  $n$Oblique insertion upward, 0.5–1 cun.$n$,
  $c$Angle upward; never perpendicular and deep.$c$,
  '{}');

perform public.set_point_clinical('DU12',
  $l$Below the spinous process of T3.$l$,
  $a$Descends and disseminates Lung qi, calms the spirit, benefits the spine.$a$,
  $i$Cough and asthma, back stiffness and pain, epilepsy, fright in children.$i$,
  $n$Oblique insertion upward, 0.5–1 cun.$n$,
  $c$Angle upward; never perpendicular and deep — pneumothorax risk.$c$,
  '{}');

perform public.set_point_clinical('DU13',
  $l$Below the spinous process of T1.$l$,
  $a$Releases the exterior, clears heat, calms the spirit.$a$,
  $i$Fever and chills, malaria, stiff neck and back, headache, cough.$i$,
  $n$Oblique insertion upward, 0.5–1 cun.$n$,
  $c$Angle upward; never perpendicular and deep.$c$,
  '{crossing}');

perform public.set_point_clinical('DU14',
  $l$Below the spinous process of C7, the most prominent vertebra at the base of the neck.$l$,
  $a$Clears heat and releases the exterior, regulates the defensive qi, benefits the neck and spine, calms the spirit.$a$,
  $i$Fever of any kind, common cold, malaria, night sweats, stiff neck and upper back, cough and asthma, epilepsy, eczema and skin heat. The meeting point of all the yang channels with the Du vessel.$i$,
  $n$Oblique insertion upward, 0.5–1 cun. Cupping and bleeding are also used here for heat.$n$,
  $c$Angle upward along the spine. Perpendicular deep insertion can reach the spinal canal.$c$,
  '{crossing}');

perform public.set_point_clinical('DU15',
  $l$0.5 cun within the posterior hairline, in the depression below the spinous process of C1.$l$,
  $a$Benefits the tongue and voice, calms the spirit, expels wind.$a$,
  $i$Sudden loss of voice, stiff tongue and aphasia after stroke, epilepsy, mania, occipital headache, stiff neck.$i$,
  $n$Perpendicular or slightly downward, 0.5–0.8 cun, with the head in a neutral position.$n$,
  $c$Never angle upward: the medulla oblongata lies directly beyond. Depth and direction are both critical, and moxa is not used.$c$,
  '{crossing}');

perform public.set_point_clinical('DU16',
  $l$1 cun within the posterior hairline, in the depression below the external occipital protuberance.$l$,
  $a$Expels interior and exterior wind, benefits the head and neck, calms the spirit.$a$,
  $i$Occipital headache, stiff neck, dizziness, wind-stroke, aphasia, mania, common cold.$i$,
  $n$Perpendicular or slightly downward, 0.5–0.8 cun.$n$,
  $c$Never angle upward toward the foramen magnum. Do not exceed 0.8 cun.$c$,
  '{crossing}');

perform public.set_point_clinical('DU17',
  $l$1.5 cun above DU16, on the upper border of the external occipital protuberance.$l$,
  $a$Benefits the head and eyes, calms the spirit.$a$,
  $i$Headache, dizziness, blurred vision, stiff neck, epilepsy.$i$,
  $n$Transverse insertion, 0.3–0.5 cun.$n$,
  null,
  '{crossing}');

perform public.set_point_clinical('DU18',
  $l$On the midline of the head, 1.5 cun above DU17.$l$,
  $a$Calms the spirit, benefits the head.$a$,
  $i$Headache, dizziness, neck stiffness, epilepsy, insomnia.$i$,
  $n$Transverse insertion, 0.3–0.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('DU19',
  $l$On the midline, 1.5 cun posterior to DU20.$l$,
  $a$Calms the spirit, subdues rising yang.$a$,
  $i$Headache and dizziness, mania, epilepsy, insomnia.$i$,
  $n$Transverse insertion, 0.3–0.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('DU20',
  $l$On the midline of the head, 5 cun within the anterior hairline, at the midpoint of a line joining the apices of the ears.$l$,
  $a$Raises yang and lifts sinking qi, subdues Liver yang, calms the spirit, clears the senses, benefits the head.$a$,
  $i$Headache and dizziness, hypertension, prolapse of the uterus or rectum, haemorrhoids, insomnia and anxiety, poor memory, depression, stroke, nasal congestion. A meeting point of all the yang channels, and both a raising and a calming point.$i$,
  $n$Transverse insertion, usually posteriorly, 0.5–0.8 cun. Moxa is used for prolapse and sinking qi.$n$,
  $c$Avoid in unmedicated severe hypertension where strong raising is unwanted; use a sedating technique instead.$c$,
  '{crossing}');

perform public.set_point_clinical('DU21',
  $l$On the midline, 1.5 cun anterior to DU20, 3.5 cun within the anterior hairline.$l$,
  $a$Benefits the head and nose, calms the spirit.$a$,
  $i$Headache and dizziness, nasal congestion, epilepsy, infantile convulsions.$i$,
  $n$Transverse insertion, 0.3–0.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('DU22',
  $l$On the midline, 2 cun within the anterior hairline.$l$,
  $a$Benefits the nose, calms the spirit.$a$,
  $i$Nasal congestion and discharge, nosebleed, headache, dizziness, epilepsy.$i$,
  $n$Transverse insertion, 0.3–0.5 cun.$n$,
  $c$Not needled in infants, in whom the anterior fontanelle has not closed.$c$,
  '{}');

perform public.set_point_clinical('DU23',
  $l$On the midline, 1 cun within the anterior hairline.$l$,
  $a$Benefits the nose and eyes, clears heat from the head.$a$,
  $i$Nasal congestion and discharge, nosebleed, frontal headache, eye pain.$i$,
  $n$Transverse insertion, 0.3–0.5 cun; or prick to bleed for nosebleed.$n$,
  null,
  '{}');

perform public.set_point_clinical('DU24',
  $l$On the midline, 0.5 cun within the anterior hairline.$l$,
  $a$Calms the spirit, benefits the nose, clears the head.$a$,
  $i$Anxiety, insomnia, palpitations, headache and dizziness, nasal congestion, epilepsy.$i$,
  $n$Transverse insertion, 0.3–0.5 cun.$n$,
  null,
  '{crossing}');

perform public.set_point_clinical('DU25',
  $l$At the centre of the tip of the nose.$l$,
  $a$Restores consciousness, benefits the nose, clears heat.$a$,
  $i$Loss of consciousness, shock, nasal congestion and discharge, nosebleed, rosacea, low blood pressure.$i$,
  $n$Perpendicular or oblique upward, 0.2–0.3 cun; or prick to bleed.$n$,
  $c$Sensitive and painful. Moxa is not used.$c$,
  '{}');

perform public.set_point_clinical('DU26',
  $l$At the junction of the upper third and lower two-thirds of the philtrum.$l$,
  $a$Restores consciousness, calms the spirit, benefits the lumbar spine, expels wind from the face.$a$,
  $i$Loss of consciousness, fainting, shock, epilepsy, acute lumbar sprain, facial paralysis and swelling, heat stroke. The principal revival point in an emergency.$i$,
  $n$Oblique insertion upward toward the nasal septum, 0.3–0.5 cun, with strong stimulation in an emergency.$n$,
  $c$Very painful — which is part of how it works in collapse. In acute lumbar sprain, needle while the patient gently moves the back.$c$,
  '{crossing, ghost_point}');

perform public.set_point_clinical('DU27',
  $l$At the midpoint of the tubercle of the upper lip, at the junction of the lip and the philtrum.$l$,
  $a$Benefits the mouth and nose, calms the spirit.$a$,
  $i$Deviation of the mouth, gum swelling, nasal congestion, excessive salivation, mania.$i$,
  $n$Oblique insertion upward, 0.2–0.3 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('DU28',
  $l$Inside the upper lip, at the junction of the gum and the frenulum of the upper lip.$l$,
  $a$Benefits the gums and the face, clears heat, calms the spirit.$a$,
  $i$Gum swelling and bleeding, mouth ulcers, nasal polyps, mania, acute lumbar sprain.$i$,
  $n$Oblique insertion upward, 0.2–0.3 cun; or prick to bleed.$n$,
  $c$An intra-oral point: standard infection-control precautions apply and the needle is discarded immediately.$c$,
  '{crossing}');

end
$seed$;
