-- ============================================================================
-- Point clinical reference · 05 · Kidney and Pericardium
-- ============================================================================
-- See 02_lung_large_intestine.sql for conventions.
-- ============================================================================

do $seed$
begin

-- ---------------------------------------------------------------------------
-- KI · Kidney
-- ---------------------------------------------------------------------------

perform public.catalogue_set_point_clinical('KI1',
  $l$On the sole, in the depression that forms when the foot is plantar-flexed, at the junction of the anterior third and posterior two-thirds of the sole.$l$,
  $a$Descends excess from the head, restores consciousness, calms the spirit, clears heat, nourishes yin.$a$,
  $i$Loss of consciousness, shock, hypertension and headache from yang rising, dizziness, insomnia and agitation, epilepsy, sore throat, hot soles, childhood convulsions. The lowest point on the body — the classical point for drawing excess downward.$i$,
  $n$Perpendicular, 0.3–0.5 cun. Sensitive; warn the patient. Moxa and pressure are often preferred.$n$,
  null,
  '{jing_well}');

perform public.catalogue_set_point_clinical('KI2',
  $l$On the medial foot, in the depression below the tuberosity of the navicular bone, on the border between red and white skin.$l$,
  $a$Clears deficiency heat, cools the blood, regulates the Kidney.$a$,
  $i$Night sweats, hot flushes, sore throat, seminal emission, irregular menstruation, genital itching, diabetes.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{ying_spring}');

perform public.catalogue_set_point_clinical('KI3',
  $l$In the depression between the tip of the medial malleolus and the Achilles tendon, level with the malleolus.$l$,
  $a$Tonifies Kidney yin and yang, benefits essence, strengthens the lower back and knees, anchors qi, benefits the ears and throat.$a$,
  $i$Chronic lower back pain, tinnitus and deafness, dizziness, chronic sore throat, asthma from Kidney deficiency, insomnia, impotence, irregular menstruation, frequent urination. The source point and the principal Kidney tonification point.$i$,
  $n$Perpendicular, 0.5–0.8 cun.$n$,
  $c$The posterior tibial artery lies close; palpate and needle beside it.$c$,
  '{shu_stream, yuan_source}');

perform public.catalogue_set_point_clinical('KI4',
  $l$Posterior and inferior to the medial malleolus, on the medial border of the Achilles tendon insertion, 0.5 cun below KI3.$l$,
  $a$Strengthens the will, calms the spirit, benefits the Kidney and Bladder.$a$,
  $i$Asthma with fear, timidity and lack of willpower, retention of urine, incontinence, heel pain, constipation.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{luo_connecting}');

perform public.catalogue_set_point_clinical('KI5',
  $l$1 cun below KI3, in the depression anterior and superior to the medial side of the calcaneum.$l$,
  $a$Regulates the uterus, relieves acute pain, promotes urination.$a$,
  $i$Acute dysmenorrhoea, amenorrhoea, uterine prolapse, difficult urination, blurred vision. The xi-cleft point.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{xi_cleft}');

perform public.catalogue_set_point_clinical('KI6',
  $l$In the depression 1 cun directly below the tip of the medial malleolus.$l$,
  $a$Nourishes Kidney yin, benefits the throat and eyes, calms the spirit, opens the Yin Qiao vessel, regulates menstruation.$a$,
  $i$Chronic dry sore throat, insomnia, hot flushes and night sweats, irregular menstruation, constipation from dryness, epilepsy at night. Confluent point of the Yin Qiao vessel, paired with LU7.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{confluent}');

perform public.catalogue_set_point_clinical('KI7',
  $l$2 cun directly above KI3, on the anterior border of the Achilles tendon.$l$,
  $a$Tonifies Kidney yang, regulates sweating, resolves oedema, strengthens the lower back.$a$,
  $i$Night sweats or absence of sweating, oedema, diarrhoea, borborygmus, lower back stiffness, weakness of the leg. The classical point for regulating sweat.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{jing_river}');

perform public.catalogue_set_point_clinical('KI8',
  $l$2 cun above KI3, 0.5 cun anterior to KI7, on the posterior border of the tibia.$l$,
  $a$Regulates the Chong and Ren vessels, stops uterine bleeding, regulates menstruation.$a$,
  $i$Irregular menstruation, uterine bleeding, uterine prolapse, testicular pain, constipation and diarrhoea. The xi-cleft point of the Yin Qiao vessel.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{xi_cleft}');

perform public.catalogue_set_point_clinical('KI9',
  $l$5 cun above KI3, on the line joining KI3 and KI10, on the medial border of the calf muscle.$l$,
  $a$Calms the spirit, resolves phlegm, regulates the lower burner.$a$,
  $i$Mental restlessness, mania and epilepsy, morning sickness, hernia, calf pain. The xi-cleft point of the Yin Wei vessel.$i$,
  $n$Perpendicular, 1–1.5 cun.$n$,
  null,
  '{xi_cleft}');

perform public.catalogue_set_point_clinical('KI10',
  $l$On the medial end of the popliteal crease, between the tendons of semitendinosus and semimembranosus, with the knee flexed.$l$,
  $a$Benefits the Kidney and the lower burner, clears damp-heat, benefits the knee.$a$,
  $i$Impotence, genital pain, difficult urination, uterine bleeding, knee and popliteal pain.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  null,
  '{he_sea}');

perform public.catalogue_set_point_clinical('KI11',
  $l$On the lower abdomen, 5 cun below the umbilicus, 0.5 cun lateral to the midline, at the upper border of the pubic symphysis.$l$,
  $a$Benefits the lower burner and genitals, regulates urination.$a$,
  $i$Genital pain, impotence, seminal emission, difficult urination, irregular menstruation.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  $c$Contraindicated in pregnancy. Empty the bladder before needling.$c$,
  '{crossing}');

perform public.catalogue_set_point_clinical('KI12',
  $l$4 cun below the umbilicus, 0.5 cun lateral to the midline.$l$,
  $a$Benefits essence, regulates the lower burner and the uterus.$a$,
  $i$Seminal emission, impotence, irregular menstruation, infertility, leucorrhoea, painful urination.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  $c$Contraindicated in pregnancy. Empty the bladder before needling.$c$,
  '{crossing}');

perform public.catalogue_set_point_clinical('KI13',
  $l$3 cun below the umbilicus, 0.5 cun lateral to the midline.$l$,
  $a$Regulates the Chong and Ren vessels, benefits the uterus and essence.$a$,
  $i$Irregular menstruation, infertility, dysmenorrhoea, abdominal pain, difficult urination.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  $c$Contraindicated in pregnancy. Empty the bladder before needling.$c$,
  '{crossing}');

perform public.catalogue_set_point_clinical('KI14',
  $l$2 cun below the umbilicus, 0.5 cun lateral to the midline.$l$,
  $a$Regulates qi in the lower burner, dissipates accumulation, regulates menstruation.$a$,
  $i$Abdominal pain and masses, irregular menstruation, constipation, dysmenorrhoea.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  $c$Contraindicated in pregnancy.$c$,
  '{crossing}');

perform public.catalogue_set_point_clinical('KI15',
  $l$1 cun below the umbilicus, 0.5 cun lateral to the midline.$l$,
  $a$Regulates the lower burner, moves stagnation.$a$,
  $i$Abdominal pain, irregular menstruation, constipation, dysentery.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  $c$Caution in pregnancy.$c$,
  '{crossing}');

perform public.catalogue_set_point_clinical('KI16',
  $l$0.5 cun lateral to the centre of the umbilicus.$l$,
  $a$Regulates the intestines, moves stagnation, benefits the lower burner.$a$,
  $i$Abdominal pain and distension, constipation, diarrhoea, periumbilical pain.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  $c$Caution in pregnancy.$c$,
  '{crossing}');

perform public.catalogue_set_point_clinical('KI17',
  $l$2 cun above the umbilicus, 0.5 cun lateral to the midline.$l$,
  $a$Regulates the intestines, harmonises the middle burner.$a$,
  $i$Abdominal pain, constipation, diarrhoea, poor appetite.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  null,
  '{crossing}');

perform public.catalogue_set_point_clinical('KI18',
  $l$3 cun above the umbilicus, 0.5 cun lateral to the midline.$l$,
  $a$Harmonises the Stomach, descends rebellious qi.$a$,
  $i$Vomiting, abdominal pain, constipation, hiccup, poor appetite.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  null,
  '{crossing}');

perform public.catalogue_set_point_clinical('KI19',
  $l$4 cun above the umbilicus, 0.5 cun lateral to the midline.$l$,
  $a$Harmonises the Stomach, descends rebellious qi.$a$,
  $i$Epigastric pain, vomiting, abdominal distension, constipation.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{crossing}');

perform public.catalogue_set_point_clinical('KI20',
  $l$5 cun above the umbilicus, 0.5 cun lateral to the midline.$l$,
  $a$Harmonises the Stomach, resolves food stagnation.$a$,
  $i$Abdominal pain and distension, vomiting, indigestion, diarrhoea.$i$,
  $n$Perpendicular, 0.5–0.8 cun.$n$,
  null,
  '{crossing}');

perform public.catalogue_set_point_clinical('KI21',
  $l$6 cun above the umbilicus, 0.5 cun lateral to the midline.$l$,
  $a$Harmonises the Stomach, descends rebellious qi, unbinds the chest.$a$,
  $i$Vomiting, morning sickness, epigastric pain, poor appetite, diarrhoea.$i$,
  $n$Perpendicular, 0.5–0.8 cun.$n$,
  $c$Needle shallowly in thin patients — the liver and stomach lie beneath.$c$,
  '{crossing}');

perform public.catalogue_set_point_clinical('KI22',
  $l$In the fifth intercostal space, 2 cun lateral to the midline.$l$,
  $a$Unbinds the chest, descends rebellious qi.$a$,
  $i$Cough, asthma, chest fullness and pain, vomiting, breast pain.$i$,
  $n$Oblique or transverse, 0.3–0.5 cun.$n$,
  $c$Never perpendicular and deep — pneumothorax risk.$c$,
  '{}');

perform public.catalogue_set_point_clinical('KI23',
  $l$In the fourth intercostal space, 2 cun lateral to the midline.$l$,
  $a$Unbinds the chest, benefits the breast, descends rebellious qi.$a$,
  $i$Cough, asthma, chest pain, mastitis, vomiting.$i$,
  $n$Oblique or transverse, 0.3–0.5 cun.$n$,
  $c$Never perpendicular and deep — pneumothorax risk.$c$,
  '{}');

perform public.catalogue_set_point_clinical('KI24',
  $l$In the third intercostal space, 2 cun lateral to the midline.$l$,
  $a$Unbinds the chest, descends rebellious qi.$a$,
  $i$Cough, asthma, chest and hypochondriac pain, mastitis.$i$,
  $n$Oblique or transverse, 0.3–0.5 cun.$n$,
  $c$Never perpendicular and deep — pneumothorax risk.$c$,
  '{}');

perform public.catalogue_set_point_clinical('KI25',
  $l$In the second intercostal space, 2 cun lateral to the midline.$l$,
  $a$Unbinds the chest, descends rebellious qi, calms the spirit.$a$,
  $i$Cough, asthma, chest pain and fullness, agitation.$i$,
  $n$Oblique or transverse, 0.3–0.5 cun.$n$,
  $c$Never perpendicular and deep — pneumothorax risk.$c$,
  '{}');

perform public.catalogue_set_point_clinical('KI26',
  $l$In the first intercostal space, 2 cun lateral to the midline.$l$,
  $a$Unbinds the chest, descends rebellious qi, transforms phlegm.$a$,
  $i$Cough with sputum, asthma, chest pain and fullness.$i$,
  $n$Oblique or transverse, 0.3–0.5 cun.$n$,
  $c$Never perpendicular and deep — pneumothorax risk.$c$,
  '{}');

perform public.catalogue_set_point_clinical('KI27',
  $l$In the depression at the lower border of the clavicle, 2 cun lateral to the midline.$l$,
  $a$Descends rebellious qi, transforms phlegm, unbinds the chest.$a$,
  $i$Cough, asthma, chest fullness, vomiting, poor appetite. Often tender in Lung and Kidney patterns.$i$,
  $n$Oblique or transverse, 0.3–0.5 cun.$n$,
  $c$Never perpendicular and deep — pneumothorax risk.$c$,
  '{}');

-- ---------------------------------------------------------------------------
-- PC · Pericardium
-- ---------------------------------------------------------------------------

perform public.catalogue_set_point_clinical('PC1',
  $l$In the fourth intercostal space, 1 cun lateral to the nipple, 5 cun lateral to the midline.$l$,
  $a$Unbinds the chest, benefits the breast, dissipates nodules.$a$,
  $i$Chest and hypochondriac fullness, breast pain and abscess, insufficient lactation, cough, axillary swelling.$i$,
  $n$Oblique or transverse laterally, 0.3–0.5 cun.$n$,
  $c$Never perpendicular and deep — pneumothorax risk.$c$,
  '{crossing}');

perform public.catalogue_set_point_clinical('PC2',
  $l$On the anterior upper arm, 2 cun below the anterior axillary fold, between the two heads of biceps brachii.$l$,
  $a$Unbinds the chest, activates the channel.$a$,
  $i$Cardiac pain, cough, chest and hypochondriac pain, pain of the medial arm.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{}');

perform public.catalogue_set_point_clinical('PC3',
  $l$On the cubital crease, on the ulnar side of the biceps brachii tendon, with the elbow slightly flexed.$l$,
  $a$Clears heat from the Heart and blood, harmonises the Stomach, calms the spirit.$a$,
  $i$Cardiac pain, palpitations, agitation and restlessness, vomiting, febrile disease, heat stroke, tremor of the hand and arm, elbow pain.$i$,
  $n$Perpendicular, 0.8–1 cun; or prick the vein to bleed for heat stroke and acute vomiting.$n$,
  $c$The brachial artery lies medially — palpate and avoid it.$c$,
  '{he_sea}');

perform public.catalogue_set_point_clinical('PC4',
  $l$On the palmar forearm, 5 cun above the wrist crease, between the tendons of palmaris longus and flexor carpi radialis.$l$,
  $a$Relieves acute cardiac pain, cools blood and stops bleeding, calms the spirit.$a$,
  $i$Acute cardiac pain and angina, palpitations, haemoptysis and nosebleed, agitation, boils. The xi-cleft point — for acute Heart conditions.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{xi_cleft}');

perform public.catalogue_set_point_clinical('PC5',
  $l$On the palmar forearm, 3 cun above the wrist crease, between the tendons of palmaris longus and flexor carpi radialis.$l$,
  $a$Transforms phlegm, calms the spirit, harmonises the Stomach, regulates menstruation.$a$,
  $i$Cardiac pain, palpitations, mania and epilepsy, vomiting, stomach pain, irregular menstruation, malaria.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{jing_river}');

perform public.catalogue_set_point_clinical('PC6',
  $l$On the palmar forearm, 2 cun above the wrist crease, between the tendons of palmaris longus and flexor carpi radialis.$l$,
  $a$Regulates the Heart and calms the spirit, harmonises the Stomach and stops nausea, unbinds the chest, opens the Yin Wei vessel.$a$,
  $i$Nausea and vomiting of any cause — including morning sickness, motion sickness and post-operative nausea; cardiac pain, palpitations, angina; insomnia, anxiety, depression; chest fullness; carpal tunnel. Command point of the chest; confluent point of the Yin Wei vessel, paired with SP4. One of the most-used points in the body.$i$,
  $n$Perpendicular, 0.5–1 cun. Directed proximally along the channel for chest conditions.$n$,
  $c$The median nerve runs beneath; reposition if the patient reports a sharp electric sensation into the fingers.$c$,
  '{luo_connecting, confluent, command}');

perform public.catalogue_set_point_clinical('PC7',
  $l$At the midpoint of the wrist crease, between the tendons of palmaris longus and flexor carpi radialis.$l$,
  $a$Clears Heart fire, calms the spirit, harmonises the Stomach, benefits the wrist.$a$,
  $i$Insomnia and agitation, mania and epilepsy, cardiac pain, palpitations, vomiting, wrist pain, foul breath. The source point.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{shu_stream, yuan_source, ghost_point}');

perform public.catalogue_set_point_clinical('PC8',
  $l$On the palm, between the second and third metacarpal bones, where the tip of the middle finger rests when a fist is made.$l$,
  $a$Clears Heart fire and heat from the blood, calms the spirit, harmonises the Stomach.$a$,
  $i$Mouth ulcers and foul breath, agitation and mania, cardiac pain, vomiting, fever, hot palms, eczema of the hand.$i$,
  $n$Perpendicular, 0.3–0.5 cun. Sensitive; warn the patient.$n$,
  null,
  '{ying_spring, ghost_point}');

perform public.catalogue_set_point_clinical('PC9',
  $l$At the centre of the tip of the middle finger.$l$,
  $a$Restores consciousness, clears heat, drains fire from the Heart.$a$,
  $i$Loss of consciousness, heat stroke, febrile disease with agitation, cardiac pain, childhood convulsions, stiff tongue. A revival point.$i$,
  $n$Shallow perpendicular 0.1 cun, or prick to bleed.$n$,
  null,
  '{jing_well}');

end
$seed$;
