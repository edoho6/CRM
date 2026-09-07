-- ============================================================================
-- Point clinical reference · 06 · San Jiao and Gallbladder
-- ============================================================================
-- See 02_lung_large_intestine.sql for conventions.
-- ============================================================================

do $seed$
begin

-- ---------------------------------------------------------------------------
-- SJ · San Jiao (Triple Burner)
-- ---------------------------------------------------------------------------

perform public.set_point_clinical('SJ1',
  $l$On the ulnar side of the ring finger, 0.1 cun proximal to the corner of the nail.$l$,
  $a$Clears heat, benefits the throat and tongue, restores consciousness.$a$,
  $i$Sore throat, headache, red eyes, stiff tongue, febrile disease, loss of consciousness, deafness.$i$,
  $n$Shallow perpendicular 0.1 cun, or prick to bleed.$n$,
  null,
  '{jing_well}');

perform public.set_point_clinical('SJ2',
  $l$On the dorsum of the hand, proximal to the web margin between the ring and little fingers.$l$,
  $a$Clears heat, benefits the ear and throat.$a$,
  $i$Sore throat, headache, red eyes, deafness and tinnitus, malaria, hand pain.$i$,
  $n$Perpendicular or oblique proximally, 0.3–0.5 cun.$n$,
  null,
  '{ying_spring}');

perform public.set_point_clinical('SJ3',
  $l$On the dorsum of the hand, in the depression proximal to the fourth metacarpophalangeal joint, between the fourth and fifth metacarpals.$l$,
  $a$Benefits the ear, clears heat from the head, activates the channel.$a$,
  $i$Deafness and tinnitus, headache, red eyes, sore throat, pain of the hand and arm, fever. A principal ear point.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{shu_stream}');

perform public.set_point_clinical('SJ4',
  $l$On the wrist crease of the dorsum, in the depression lateral to the tendon of extensor digitorum.$l$,
  $a$Regulates the San Jiao, benefits the wrist, clears heat.$a$,
  $i$Wrist pain and weakness, deafness, sore throat, thirst and diabetes, malaria, shoulder and arm pain.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{yuan_source}');

perform public.set_point_clinical('SJ5',
  $l$On the dorsal forearm, 2 cun above the wrist crease, between the radius and ulna.$l$,
  $a$Releases the exterior and expels wind-heat, benefits the ear and the head, opens the Yang Wei vessel, activates the channel.$a$,
  $i$Common cold and fever, headache and stiff neck, tinnitus and deafness, migraine, pain of the shoulder, arm and wrist, rib-side pain. Confluent point of the Yang Wei vessel, paired with GB41. The counterpart of PC6 on the yang side.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{luo_connecting, confluent}');

perform public.set_point_clinical('SJ6',
  $l$On the dorsal forearm, 3 cun above the wrist crease, between the radius and ulna.$l$,
  $a$Clears heat, regulates qi, moves the bowels, benefits the rib-side.$a$,
  $i$Constipation, rib-side pain, shingles, sudden loss of voice, deafness, fever, shoulder and back pain. The classical point for constipation from qi stagnation.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{jing_river}');

perform public.set_point_clinical('SJ7',
  $l$On the dorsal forearm, 3 cun above the wrist crease, about 1 finger-breadth ulnar to SJ6.$l$,
  $a$Relieves acute pain, calms the spirit, activates the channel.$a$,
  $i$Acute pain along the channel, deafness, epilepsy, forearm pain. The xi-cleft point.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{xi_cleft}');

perform public.set_point_clinical('SJ8',
  $l$On the dorsal forearm, 4 cun above the wrist crease, between the radius and ulna.$l$,
  $a$Activates the channel, benefits the voice, relieves pain.$a$,
  $i$Sudden loss of voice, deafness, toothache, pain and numbness of the arm. A meeting point of the three arm yang channels.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('SJ9',
  $l$On the dorsal forearm, 5 cun below the olecranon, between the radius and ulna.$l$,
  $a$Benefits the ear and throat, activates the channel.$a$,
  $i$Deafness, sudden loss of voice, toothache, forearm pain, migraine.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('SJ10',
  $l$With the elbow flexed, in the depression about 1 cun above the olecranon.$l$,
  $a$Clears heat, transforms phlegm, dissipates nodules, benefits the elbow.$a$,
  $i$Elbow pain and stiffness, scrofula and goitre, epilepsy, migraine, cough.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{he_sea}');

perform public.set_point_clinical('SJ11',
  $l$On the posterior upper arm, 1 cun above SJ10 on the line to SJ14.$l$,
  $a$Activates the channel, relieves pain.$a$,
  $i$Pain of the elbow, upper arm and shoulder, headache.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('SJ12',
  $l$On the posterior upper arm, midway between SJ11 and SJ13.$l$,
  $a$Activates the channel, relieves pain.$a$,
  $i$Pain and stiffness of the arm, shoulder and neck, headache, toothache.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('SJ13',
  $l$On the posterior upper arm, 3 cun below SJ14, on the posterior border of the deltoid.$l$,
  $a$Dissipates nodules, benefits the shoulder and arm.$a$,
  $i$Shoulder and arm pain, goitre and scrofula, stiff neck.$i$,
  $n$Perpendicular, 1–1.5 cun.$n$,
  null,
  '{crossing}');

perform public.set_point_clinical('SJ14',
  $l$Posterior and inferior to the acromion, in the depression behind LI15 when the arm is abducted.$l$,
  $a$Benefits the shoulder, expels wind-damp, activates the channel.$a$,
  $i$Frozen shoulder, shoulder pain and restricted movement, arm weakness.$i$,
  $n$Perpendicular, 0.8–1.5 cun, or oblique toward the joint space.$n$,
  null,
  '{}');

perform public.set_point_clinical('SJ15',
  $l$Midway between GB21 and the medial border of the scapula, in the supraspinous fossa.$l$,
  $a$Expels wind, benefits the neck and shoulder, descends Lung qi.$a$,
  $i$Neck and shoulder stiffness and pain, fever with chills, cough.$i$,
  $n$Oblique insertion, 0.5–0.8 cun.$n$,
  $c$Do not needle perpendicularly and deeply — pneumothorax risk.$c$,
  '{crossing}');

perform public.set_point_clinical('SJ16',
  $l$On the lateral neck, posterior to sternocleidomastoid, level with the angle of the mandible.$l$,
  $a$Benefits the head, ears and eyes, descends rebellious qi.$a$,
  $i$Deafness and tinnitus, sudden blurred vision, headache, stiff neck, facial swelling. A window of the sky point.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  $c$Avoid the great vessels of the neck; needle behind the muscle border.$c$,
  '{window_of_sky}');

perform public.set_point_clinical('SJ17',
  $l$In the depression behind the earlobe, between the mastoid process and the mandible.$l$,
  $a$Benefits the ear, expels wind, activates the channel of the face.$a$,
  $i$Deafness, tinnitus, ear infection and discharge, facial paralysis, temporomandibular pain, toothache, mumps. The principal point for the ear.$i$,
  $n$Perpendicular, 0.5–1 cun, angled slightly toward the opposite eye.$n$,
  $c$Do not needle deeply — large vessels and the facial nerve lie beyond.$c$,
  '{crossing}');

perform public.set_point_clinical('SJ18',
  $l$Behind the ear, at the centre of the mastoid process, at the junction of the middle and lower thirds of the curve from SJ17 to SJ20.$l$,
  $a$Benefits the ear, calms fright, expels wind.$a$,
  $i$Tinnitus and deafness, childhood convulsions and fright, headache, vomiting in children.$i$,
  $n$Transverse, 0.2–0.3 cun; or prick the small vein to bleed.$n$,
  null,
  '{}');

perform public.set_point_clinical('SJ19',
  $l$Behind the ear, at the junction of the middle and upper thirds of the curve from SJ17 to SJ20.$l$,
  $a$Benefits the ear, calms the spirit.$a$,
  $i$Tinnitus and deafness, headache, childhood convulsions, ear pain.$i$,
  $n$Transverse, 0.2–0.3 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('SJ20',
  $l$Directly above the apex of the ear, within the hairline.$l$,
  $a$Expels wind-heat, benefits the ear and eyes, reduces swelling.$a$,
  $i$Mumps and swelling of the cheek, ear pain, temporal headache, red and painful eyes, toothache.$i$,
  $n$Transverse, 0.3–0.5 cun.$n$,
  null,
  '{crossing}');

perform public.set_point_clinical('SJ21',
  $l$Anterior to the supratragic notch, in the depression that forms when the mouth is open.$l$,
  $a$Benefits the ear, opens the orifices.$a$,
  $i$Deafness, tinnitus, ear discharge, toothache, temporomandibular pain.$i$,
  $n$With the mouth open, perpendicular 0.5–1 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('SJ22',
  $l$Anterior and superior to SJ21, at the posterior border of the temple hairline, where the superficial temporal artery pulses.$l$,
  $a$Expels wind, benefits the ear, relieves headache.$a$,
  $i$Migraine and temporal headache, tinnitus, lockjaw, facial paralysis.$i$,
  $n$Transverse, 0.1–0.3 cun, avoiding the artery.$n$,
  $c$The superficial temporal artery runs through this point: palpate and avoid it.$c$,
  '{crossing}');

perform public.set_point_clinical('SJ23',
  $l$In the depression at the lateral end of the eyebrow.$l$,
  $a$Expels wind, clears heat, brightens the eyes, relieves headache.$a$,
  $i$Temporal headache and migraine, red and painful eyes, twitching eyelid, dizziness, facial paralysis.$i$,
  $n$Transverse, 0.3–0.5 cun.$n$,
  $c$Moxa is not used here — the region is close to the eye.$c$,
  '{}');

-- ---------------------------------------------------------------------------
-- GB · Gallbladder
-- ---------------------------------------------------------------------------

perform public.set_point_clinical('GB1',
  $l$0.5 cun lateral to the outer canthus, in the depression on the lateral orbital margin.$l$,
  $a$Expels wind, clears heat, brightens the eyes.$a$,
  $i$Red and painful eyes, blurred vision, excessive tearing, temporal headache, facial paralysis, trigeminal neuralgia.$i$,
  $n$Transverse insertion laterally, 0.3–0.5 cun.$n$,
  null,
  '{crossing}');

perform public.set_point_clinical('GB2',
  $l$Anterior to the intertragic notch, in the depression that forms when the mouth is open.$l$,
  $a$Benefits the ear, opens the orifices, activates the channel of the jaw.$a$,
  $i$Deafness, tinnitus, ear discharge, toothache, temporomandibular pain, facial paralysis.$i$,
  $n$With the mouth open, perpendicular 0.5–1 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('GB3',
  $l$Anterior to the ear, on the upper border of the zygomatic arch, in the depression directly above ST7.$l$,
  $a$Benefits the ear, expels wind, relieves pain of the head and jaw.$a$,
  $i$Deafness and tinnitus, migraine, toothache, facial paralysis, lockjaw.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  $c$Needle shallowly. Do not needle deeply into the region of the temporal artery.$c$,
  '{crossing}');

perform public.set_point_clinical('GB4',
  $l$In the temple, at the junction of the upper quarter and lower three-quarters of the curved line from ST8 to GB7.$l$,
  $a$Expels wind, relieves temporal headache, benefits the ear.$a$,
  $i$Migraine and temporal headache, tinnitus, vertigo, toothache, trigeminal neuralgia.$i$,
  $n$Transverse, 0.3–0.5 cun.$n$,
  null,
  '{crossing}');

perform public.set_point_clinical('GB5',
  $l$In the temple, at the midpoint of the curved line from ST8 to GB7.$l$,
  $a$Expels wind, relieves temporal headache.$a$,
  $i$Migraine, temporal headache, red and painful eyes, toothache.$i$,
  $n$Transverse, 0.3–0.5 cun.$n$,
  null,
  '{crossing}');

perform public.set_point_clinical('GB6',
  $l$In the temple, at the junction of the lower quarter and upper three-quarters of the curved line from ST8 to GB7.$l$,
  $a$Expels wind, clears heat, relieves headache.$a$,
  $i$Migraine, facial swelling, tinnitus, toothache.$i$,
  $n$Transverse, 0.3–0.5 cun.$n$,
  null,
  '{crossing}');

perform public.set_point_clinical('GB7',
  $l$Anterior and superior to the auricle, at the junction of the vertical line from the anterior border of the ear and the horizontal line from the apex.$l$,
  $a$Expels wind, relieves pain of the jaw and temple.$a$,
  $i$Migraine, lockjaw, toothache, swelling of the cheek, facial paralysis.$i$,
  $n$Transverse, 0.3–0.5 cun.$n$,
  null,
  '{crossing}');

perform public.set_point_clinical('GB8',
  $l$Superior to the apex of the ear, 1.5 cun within the hairline.$l$,
  $a$Harmonises the Stomach, descends rebellious qi, relieves temporal headache.$a$,
  $i$Migraine with nausea and vomiting, vertigo, alcohol intoxication, temporal headache. The classical point for headache with vomiting.$i$,
  $n$Transverse, 0.5–0.8 cun.$n$,
  null,
  '{crossing}');

perform public.set_point_clinical('GB9',
  $l$Directly above the posterior border of the ear, 2 cun within the hairline.$l$,
  $a$Calms the spirit, expels wind.$a$,
  $i$Headache, epilepsy, tinnitus, toothache, fright.$i$,
  $n$Transverse, 0.3–0.5 cun.$n$,
  null,
  '{crossing}');

perform public.set_point_clinical('GB10',
  $l$Posterior and superior to the mastoid process, on the curve between GB9 and GB12.$l$,
  $a$Benefits the ear and teeth, expels wind.$a$,
  $i$Tinnitus and deafness, toothache, headache, stiff neck.$i$,
  $n$Transverse, 0.3–0.5 cun.$n$,
  null,
  '{crossing}');

perform public.set_point_clinical('GB11',
  $l$Posterior and superior to the mastoid process, on the curve between GB10 and GB12.$l$,
  $a$Benefits the ear, clears heat from the head.$a$,
  $i$Tinnitus and deafness, headache, neck stiffness, toothache.$i$,
  $n$Transverse, 0.3–0.5 cun.$n$,
  null,
  '{crossing}');

perform public.set_point_clinical('GB12',
  $l$In the depression posterior and inferior to the mastoid process.$l$,
  $a$Calms the spirit, expels wind, benefits the head and neck.$a$,
  $i$Insomnia, headache, stiff neck, toothache, facial paralysis, epilepsy.$i$,
  $n$Oblique insertion, 0.5–0.8 cun.$n$,
  null,
  '{crossing}');

perform public.set_point_clinical('GB13',
  $l$0.5 cun within the anterior hairline, 3 cun lateral to the midline.$l$,
  $a$Calms the spirit, clears the head, settles fright.$a$,
  $i$Anxiety and fright, insomnia, epilepsy, headache, dizziness, nasal congestion.$i$,
  $n$Transverse, 0.5–0.8 cun.$n$,
  null,
  '{crossing}');

perform public.set_point_clinical('GB14',
  $l$1 cun above the midpoint of the eyebrow, directly above the pupil.$l$,
  $a$Expels wind, brightens the eyes, relieves frontal headache.$a$,
  $i$Frontal headache, eye pain and blurred vision, twitching eyelid, facial paralysis, drooping eyelid, sinus pain.$i$,
  $n$Transverse insertion downward toward the eyebrow, 0.3–0.5 cun.$n$,
  null,
  '{crossing}');

perform public.set_point_clinical('GB15',
  $l$0.5 cun within the anterior hairline, directly above the pupil, midway between DU24 and ST8.$l$,
  $a$Expels wind, brightens the eyes, calms the spirit.$a$,
  $i$Headache, eye pain and excessive tearing, nasal congestion, insomnia.$i$,
  $n$Transverse, 0.3–0.5 cun.$n$,
  null,
  '{crossing}');

perform public.set_point_clinical('GB16',
  $l$1.5 cun within the anterior hairline, directly above the pupil, 1 cun posterior to GB15.$l$,
  $a$Brightens the eyes, expels wind.$a$,
  $i$Eye pain and blurred vision, headache, dizziness, nasal congestion.$i$,
  $n$Transverse, 0.3–0.5 cun.$n$,
  null,
  '{crossing}');

perform public.set_point_clinical('GB17',
  $l$1 cun posterior to GB16, directly above the pupil.$l$,
  $a$Expels wind, calms the spirit, harmonises the Stomach.$a$,
  $i$Headache and dizziness, vomiting, toothache, blurred vision.$i$,
  $n$Transverse, 0.3–0.5 cun.$n$,
  null,
  '{crossing}');

perform public.set_point_clinical('GB18',
  $l$1.5 cun posterior to GB17, directly above the pupil.$l$,
  $a$Descends Lung qi, expels wind, calms the spirit.$a$,
  $i$Headache, nasal congestion and discharge, cough with asthma, dizziness.$i$,
  $n$Transverse, 0.3–0.5 cun.$n$,
  null,
  '{crossing}');

perform public.set_point_clinical('GB19',
  $l$Directly above GB20, level with DU17, at the lateral side of the external occipital protuberance.$l$,
  $a$Expels wind, benefits the head and eyes, calms the spirit.$a$,
  $i$Occipital headache, dizziness, eye pain, stiff neck, palpitations with fright.$i$,
  $n$Transverse, 0.3–0.5 cun.$n$,
  null,
  '{crossing}');

perform public.set_point_clinical('GB20',
  $l$Below the occiput, in the depression between the upper ends of sternocleidomastoid and trapezius.$l$,
  $a$Expels interior and exterior wind, subdues Liver yang, benefits the head, eyes and ears, clears the senses.$a$,
  $i$Headache of any kind, dizziness and vertigo, hypertension, common cold, stiff neck, eye disorders, tinnitus, insomnia, stroke. One of the most-used points in the body.$i$,
  $n$Needle toward the tip of the opposite eye or the opposite GB20, 0.5–1 cun.$n$,
  $c$Never angle upward and medially toward the foramen magnum: the medulla lies beyond and deep insertion there has caused fatalities. Direction and depth both matter.$c$,
  '{crossing}');

perform public.set_point_clinical('GB21',
  $l$At the midpoint between DU14 and the acromion, at the highest point of the trapezius.$l$,
  $a$Descends qi, relaxes the sinews, promotes lactation and labour, dissipates nodules.$a$,
  $i$Neck and shoulder stiffness and pain, headache, difficult labour, insufficient lactation, mastitis, scrofula. The most-used point for a tight upper trapezius.$i$,
  $n$Perpendicular, 0.3–0.5 cun only, or oblique.$n$,
  $c$Contraindicated in pregnancy — classically used to promote labour. Deep perpendicular needling here is a well-documented cause of pneumothorax: the apex of the lung lies directly below. Keep to 0.5 cun.$c$,
  '{crossing}');

perform public.set_point_clinical('GB22',
  $l$On the mid-axillary line, in the fourth intercostal space, 3 cun below the axilla.$l$,
  $a$Unbinds the chest, activates the channel, benefits the rib-side.$a$,
  $i$Rib-side and chest pain, swelling of the axilla, arm pain and restricted movement.$i$,
  $n$Oblique or transverse along the intercostal space, 0.3–0.5 cun.$n$,
  $c$Never perpendicular and deep — pneumothorax risk.$c$,
  '{}');

perform public.set_point_clinical('GB23',
  $l$1 cun anterior to GB22, in the fourth intercostal space.$l$,
  $a$Unbinds the chest, descends rebellious qi.$a$,
  $i$Rib-side pain and fullness, asthma, vomiting, acid regurgitation.$i$,
  $n$Oblique or transverse along the intercostal space, 0.3–0.5 cun.$n$,
  $c$Never perpendicular and deep — pneumothorax risk.$c$,
  '{}');

perform public.set_point_clinical('GB24',
  $l$In the seventh intercostal space, directly below the nipple, one rib below LR14.$l$,
  $a$Benefits the Gallbladder, resolves damp-heat, harmonises the middle burner, descends rebellious qi.$a$,
  $i$Jaundice, gallstones and cholecystitis, bitter taste, hypochondriac pain, vomiting, acid regurgitation, hiccup. The front-mu point of the Gallbladder.$i$,
  $n$Oblique or transverse along the intercostal space, 0.3–0.5 cun.$n$,
  $c$Never perpendicular and deep — the liver lies beneath on the right.$c$,
  '{front_mu, crossing}');

perform public.set_point_clinical('GB25',
  $l$At the free end of the twelfth rib, on the lateral abdomen.$l$,
  $a$Benefits the Kidney and the water passages, strengthens the lower back.$a$,
  $i$Lumbar pain, difficult urination, oedema, borborygmus, diarrhoea, hypochondriac pain. The front-mu point of the Kidney.$i$,
  $n$Perpendicular, 0.5–0.8 cun.$n$,
  $c$Do not needle deeply — the kidney lies beneath.$c$,
  '{front_mu}');

perform public.set_point_clinical('GB26',
  $l$Directly below LR13, level with the umbilicus, on the lateral abdomen.$l$,
  $a$Regulates the Dai (girdling) vessel, resolves damp-heat, regulates menstruation.$a$,
  $i$Leucorrhoea, irregular menstruation, lower abdominal pain, lumbar pain, hernia. The principal point of the girdling vessel.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  $c$Caution in pregnancy.$c$,
  '{crossing}');

perform public.set_point_clinical('GB27',
  $l$On the lateral lower abdomen, at the level of the anterior superior iliac spine, 3 cun below GB26.$l$,
  $a$Regulates the lower burner and the Dai vessel, relieves pain.$a$,
  $i$Lower abdominal pain, hernia, leucorrhoea, irregular menstruation, constipation.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  $c$Caution in pregnancy.$c$,
  '{crossing}');

perform public.set_point_clinical('GB28',
  $l$0.5 cun anterior and inferior to the anterior superior iliac spine.$l$,
  $a$Regulates the lower burner and the Dai vessel, benefits the uterus.$a$,
  $i$Leucorrhoea, uterine prolapse, lower abdominal pain, hernia, constipation.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  $c$Caution in pregnancy.$c$,
  '{crossing}');

perform public.set_point_clinical('GB29',
  $l$Midway between the anterior superior iliac spine and the prominence of the greater trochanter.$l$,
  $a$Benefits the hip, activates the channel, expels wind-damp.$a$,
  $i$Hip pain and restricted movement, sciatica, weakness and paralysis of the leg, lumbar pain.$i$,
  $n$Perpendicular, 1–1.5 cun.$n$,
  null,
  '{crossing}');

perform public.set_point_clinical('GB30',
  $l$At the junction of the lateral third and medial two-thirds of a line from the prominence of the greater trochanter to the sacral hiatus, with the hip flexed.$l$,
  $a$Activates the channel, expels wind-damp, benefits the hip and the whole leg.$a$,
  $i$Sciatica — the principal point for it — hip pain, lumbar pain radiating to the leg, hemiplegia, weakness and numbness of the leg, urticaria.$i$,
  $n$Perpendicular, 1.5–3 cun, with the patient side-lying and the upper hip and knee flexed.$n$,
  $c$The sciatic nerve lies deep. A radiating sensation to the foot is the expected response, but do not repeat strong stimulation.$c$,
  '{crossing}');

perform public.set_point_clinical('GB31',
  $l$On the lateral thigh, 7 cun above the popliteal crease; where the middle finger reaches when the arm hangs at the side.$l$,
  $a$Expels wind-damp, activates the channel, benefits the skin.$a$,
  $i$Lateral thigh and leg pain, sciatica, weakness and numbness of the leg, generalised itching and urticaria, hemiplegia.$i$,
  $n$Perpendicular, 1–2 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('GB32',
  $l$On the lateral thigh, 2 cun below GB31.$l$,
  $a$Activates the channel, expels wind-damp.$a$,
  $i$Lateral thigh pain and numbness, weakness of the leg, hemiplegia.$i$,
  $n$Perpendicular, 1–2 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('GB33',
  $l$3 cun above GB34, in the depression above the lateral epicondyle of the femur.$l$,
  $a$Benefits the knee and the sinews, expels wind-damp.$a$,
  $i$Knee pain, swelling and stiffness, numbness of the leg, cramp of the calf.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('GB34',
  $l$In the depression anterior and inferior to the head of the fibula.$l$,
  $a$Benefits the sinews and joints, spreads Liver qi, clears damp-heat from the Gallbladder, benefits the knee.$a$,
  $i$Any sinew or tendon disorder — contracture, spasm, stiffness anywhere; knee pain; sciatica; hypochondriac pain; bitter taste; jaundice; vomiting. The influential point of the sinews.$i$,
  $n$Perpendicular, 1–1.5 cun.$n$,
  $c$The common peroneal nerve wraps the fibular neck just below; avoid strong stimulation there.$c$,
  '{he_sea, influential}');

perform public.set_point_clinical('GB35',
  $l$7 cun above the tip of the lateral malleolus, on the posterior border of the fibula.$l$,
  $a$Activates the channel, benefits the chest and rib-side. The xi-cleft point of the Yang Wei vessel.$a$,
  $i$Chest and rib-side pain, lateral leg pain, swelling of the face, asthma.$i$,
  $n$Perpendicular, 1–1.5 cun.$n$,
  null,
  '{xi_cleft}');

perform public.set_point_clinical('GB36',
  $l$7 cun above the tip of the lateral malleolus, on the anterior border of the fibula.$l$,
  $a$Relieves acute pain, clears heat, activates the channel.$a$,
  $i$Acute pain along the channel, neck pain, rabies prophylaxis in classical texts, lateral leg pain. The xi-cleft point.$i$,
  $n$Perpendicular, 1–1.5 cun.$n$,
  null,
  '{xi_cleft}');

perform public.set_point_clinical('GB37',
  $l$5 cun above the tip of the lateral malleolus, on the anterior border of the fibula.$l$,
  $a$Brightens the eyes, spreads Liver qi, activates the channel.$a$,
  $i$Eye disorders of every kind — blurred vision, night blindness, eye pain, atrophy of the optic nerve; leg pain; breast distension. The luo-connecting point, and the classical distal point for the eyes.$i$,
  $n$Perpendicular, 1–1.5 cun.$n$,
  null,
  '{luo_connecting}');

perform public.set_point_clinical('GB38',
  $l$4 cun above the tip of the lateral malleolus, on the anterior border of the fibula.$l$,
  $a$Clears heat from the channel, relieves headache and rib-side pain.$a$,
  $i$Migraine and temporal headache, rib-side pain, bitter taste, lateral leg pain, scrofula.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  null,
  '{jing_river}');

perform public.set_point_clinical('GB39',
  $l$3 cun above the tip of the lateral malleolus, at the anterior border of the fibula.$l$,
  $a$Benefits the marrow and bones, relaxes the sinews, clears Gallbladder heat, benefits the neck.$a$,
  $i$Stiff neck, sciatica and leg pain, hemiplegia, osteoporosis, tinnitus and dizziness from marrow deficiency. The influential point of marrow.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  null,
  '{influential}');

perform public.set_point_clinical('GB40',
  $l$Anterior and inferior to the lateral malleolus, in the depression lateral to the tendon of extensor digitorum longus.$l$,
  $a$Spreads Liver qi, clears damp-heat, benefits the ankle and rib-side.$a$,
  $i$Ankle pain and sprain, rib-side pain, bitter taste, vomiting, sciatica, swelling of the axilla. The source point.$i$,
  $n$Perpendicular, 0.5–0.8 cun.$n$,
  null,
  '{yuan_source}');

perform public.set_point_clinical('GB41',
  $l$On the dorsum of the foot, in the depression distal to the junction of the fourth and fifth metatarsal bones, lateral to the tendon of extensor digiti minimi.$l$,
  $a$Spreads Liver qi, opens the Dai vessel, benefits the breast and the eyes, clears the head.$a$,
  $i$Migraine and temporal headache, eye pain, breast distension and mastitis, irregular menstruation, dizziness, rib-side pain, foot pain. Confluent point of the Dai vessel, paired with SJ5.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{shu_stream, confluent}');

perform public.set_point_clinical('GB42',
  $l$On the dorsum of the foot, between the fourth and fifth metatarsal bones, proximal to the web margin.$l$,
  $a$Benefits the breast and the ear, clears heat.$a$,
  $i$Breast pain and mastitis, tinnitus, red eyes, foot swelling.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('GB43',
  $l$On the dorsum of the foot, proximal to the web margin between the fourth and fifth toes.$l$,
  $a$Clears heat from the head and the channel, benefits the ear.$a$,
  $i$Migraine, dizziness, tinnitus and deafness, red and painful eyes, rib-side pain, febrile disease.$i$,
  $n$Perpendicular or oblique, 0.3–0.5 cun.$n$,
  null,
  '{ying_spring}');

perform public.set_point_clinical('GB44',
  $l$On the lateral side of the fourth toe, 0.1 cun proximal to the corner of the nail.$l$,
  $a$Clears heat, calms the spirit, benefits the head and eyes.$a$,
  $i$Migraine, red and painful eyes, deafness, insomnia and restless dreaming, febrile disease, sore throat.$i$,
  $n$Shallow perpendicular 0.1 cun, or prick to bleed.$n$,
  null,
  '{jing_well}');

end
$seed$;
