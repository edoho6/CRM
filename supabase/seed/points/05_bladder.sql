-- ============================================================================
-- Point clinical reference · 04 · Bladder
-- ============================================================================
-- See 02_lung_large_intestine.sql for conventions.
--
-- The back-shu points (BL13–BL28) share one caution that is stated once here
-- rather than repeated on every row: on the thorax they are needled obliquely
-- toward the spine, never perpendicularly and deeply, because the pleura lies
-- directly beneath. Each thoracic row repeats it anyway, because a caution that
-- is only in a file header is a caution nobody reads.
-- ============================================================================

do $seed$
begin

perform public.set_point_clinical('BL1',
  $l$0.1 cun superior and medial to the inner canthus of the eye.$l$,
  $a$Brightens the eyes, expels wind, clears heat, stops lacrimation.$a$,
  $i$Almost all eye disorders — redness, pain, itching, blurred vision, night blindness, glaucoma, excessive tearing, twitching eyelid.$i$,
  $n$Ask the patient to close the eye and look laterally. Push the eyeball gently aside and insert slowly perpendicular along the orbital wall, 0.3–0.5 cun. No lifting, thrusting or rotating.$n$,
  $c$Haematoma is common and expected; warn the patient. No manipulation, no moxa. Press firmly for a full minute after withdrawal.$c$,
  '{crossing}');

perform public.set_point_clinical('BL2',
  $l$In the depression at the medial end of the eyebrow, above the inner canthus.$l$,
  $a$Expels wind, brightens the eyes, relieves frontal pain.$a$,
  $i$Frontal headache, sinus congestion and pain, eye pain and redness, excessive tearing, twitching eyelid, hiccup.$i$,
  $n$Transverse insertion laterally along the eyebrow, or obliquely downward, 0.3–0.5 cun.$n$,
  $c$Avoid deep perpendicular insertion toward the orbit.$c$,
  '{}');

perform public.set_point_clinical('BL3',
  $l$0.5 cun within the anterior hairline, directly above BL2.$l$,
  $a$Expels wind, brightens the eyes, calms the spirit.$a$,
  $i$Headache, dizziness, nasal congestion, eye pain, epilepsy.$i$,
  $n$Transverse insertion posteriorly, 0.3–0.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('BL4',
  $l$0.5 cun within the anterior hairline, 1.5 cun lateral to the midline.$l$,
  $a$Expels wind, opens the nasal passages, brightens the eyes.$a$,
  $i$Headache, nasal congestion and discharge, nosebleed, blurred vision.$i$,
  $n$Transverse insertion posteriorly, 0.3–0.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('BL5',
  $l$1 cun within the anterior hairline, 1.5 cun lateral to the midline.$l$,
  $a$Expels wind, calms the spirit, brightens the eyes.$a$,
  $i$Headache, dizziness, epilepsy, blurred vision, nasal congestion.$i$,
  $n$Transverse insertion posteriorly, 0.3–0.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('BL6',
  $l$2.5 cun within the anterior hairline, 1.5 cun lateral to the midline.$l$,
  $a$Expels wind, brightens the eyes, opens the nasal passages.$a$,
  $i$Headache, dizziness, blurred vision, nasal congestion, vomiting.$i$,
  $n$Transverse insertion posteriorly, 0.3–0.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('BL7',
  $l$4 cun within the anterior hairline, 1.5 cun lateral to the midline, level with DU20.$l$,
  $a$Opens the nasal passages, expels wind, benefits the head.$a$,
  $i$Chronic nasal congestion and discharge, nasal polyps, loss of smell, headache, dizziness.$i$,
  $n$Transverse insertion, 0.3–0.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('BL8',
  $l$1.5 cun posterior to BL7, 1.5 cun lateral to the midline.$l$,
  $a$Calms the spirit, expels wind, benefits the head.$a$,
  $i$Dizziness, blurred vision, tinnitus, mania, headache, nasal congestion.$i$,
  $n$Transverse insertion, 0.3–0.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('BL9',
  $l$1.3 cun lateral to DU17, on the lateral side of the external occipital protuberance.$l$,
  $a$Expels wind, benefits the head and eyes, calms the spirit.$a$,
  $i$Occipital headache and stiff neck, dizziness, eye pain, nasal congestion, epilepsy.$i$,
  $n$Transverse insertion, 0.3–0.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('BL10',
  $l$1.3 cun lateral to DU15, within the posterior hairline, on the lateral border of trapezius.$l$,
  $a$Expels wind, benefits the head, neck and eyes, calms the spirit, descends rebellious qi.$a$,
  $i$Stiff and painful neck, occipital headache, dizziness, eye disorders, nasal congestion, insomnia, shoulder and back pain. A window of the sky point and a principal neck point.$i$,
  $n$Perpendicular or oblique, 0.5–0.8 cun.$n$,
  $c$Do not angle medially and upward toward the foramen magnum: the medulla lies beyond. Keep the direction straight or slightly lateral.$c$,
  '{window_of_sky}');

perform public.set_point_clinical('BL11',
  $l$1.5 cun lateral to the lower border of the spinous process of T1.$l$,
  $a$Expels wind, benefits the bones and the neck, descends Lung qi.$a$,
  $i$Neck and upper back stiffness and pain, cough and fever, bone disorders, osteoporosis. The influential point of bone.$i$,
  $n$Oblique insertion toward the spine, 0.5–0.8 cun.$n$,
  $c$Never perpendicular and deep — pneumothorax risk.$c$,
  '{influential, crossing}');

perform public.set_point_clinical('BL12',
  $l$1.5 cun lateral to the lower border of the spinous process of T2.$l$,
  $a$Expels wind, releases the exterior, descends and disseminates Lung qi.$a$,
  $i$Common cold, cough, fever with chills, stiff neck and upper back, asthma. The classical point for preventing wind invasion.$i$,
  $n$Oblique insertion toward the spine, 0.5–0.8 cun.$n$,
  $c$Never perpendicular and deep — pneumothorax risk.$c$,
  '{crossing}');

perform public.set_point_clinical('BL13',
  $l$1.5 cun lateral to the lower border of the spinous process of T3.$l$,
  $a$Tonifies Lung qi and yin, descends rebellious qi, clears heat from the Lung.$a$,
  $i$Cough, asthma, chest fullness, night sweats, tidal fever, haemoptysis, skin disorders. The back-shu point of the Lung.$i$,
  $n$Oblique insertion toward the spine, 0.5–0.8 cun.$n$,
  $c$Never perpendicular and deep — pneumothorax risk.$c$,
  '{back_shu}');

perform public.set_point_clinical('BL14',
  $l$1.5 cun lateral to the lower border of the spinous process of T4.$l$,
  $a$Regulates the Heart and unbinds the chest, calms the spirit.$a$,
  $i$Cardiac pain, palpitations, cough, vomiting, anxiety. The back-shu point of the Pericardium.$i$,
  $n$Oblique insertion toward the spine, 0.5–0.8 cun.$n$,
  $c$Never perpendicular and deep — pneumothorax risk.$c$,
  '{back_shu}');

perform public.set_point_clinical('BL15',
  $l$1.5 cun lateral to the lower border of the spinous process of T5.$l$,
  $a$Tonifies and regulates the Heart, calms the spirit, nourishes the blood.$a$,
  $i$Palpitations, cardiac pain, insomnia, poor memory, anxiety, night sweats, epilepsy, mania. The back-shu point of the Heart.$i$,
  $n$Oblique insertion toward the spine, 0.5–0.8 cun.$n$,
  $c$Never perpendicular and deep — pneumothorax risk.$c$,
  '{back_shu}');

perform public.set_point_clinical('BL16',
  $l$1.5 cun lateral to the lower border of the spinous process of T6.$l$,
  $a$Regulates qi in the chest, descends rebellious qi.$a$,
  $i$Cardiac pain, abdominal pain and borborygmus, chills and fever, hiccup. The back-shu point of the Du vessel.$i$,
  $n$Oblique insertion toward the spine, 0.5–0.8 cun.$n$,
  $c$Never perpendicular and deep — pneumothorax risk.$c$,
  '{back_shu}');

perform public.set_point_clinical('BL17',
  $l$1.5 cun lateral to the lower border of the spinous process of T7.$l$,
  $a$Invigorates and nourishes the blood, stops bleeding, descends rebellious qi, benefits the diaphragm.$a$,
  $i$Any blood disorder — anaemia, bleeding, blood stasis; hiccup, vomiting and belching; night sweats; chronic skin disease; asthma. The influential point of blood.$i$,
  $n$Oblique insertion toward the spine, 0.5–0.8 cun.$n$,
  $c$Never perpendicular and deep — pneumothorax risk.$c$,
  '{influential}');

perform public.set_point_clinical('BL18',
  $l$1.5 cun lateral to the lower border of the spinous process of T9.$l$,
  $a$Spreads Liver qi, benefits the eyes and sinews, cools Liver heat.$a$,
  $i$Hypochondriac pain, jaundice, irritability and depression, red eyes and blurred vision, dizziness, irregular menstruation. The back-shu point of the Liver.$i$,
  $n$Oblique insertion toward the spine, 0.5–0.8 cun.$n$,
  $c$Never perpendicular and deep — pneumothorax and, lower down, liver and kidney risk.$c$,
  '{back_shu}');

perform public.set_point_clinical('BL19',
  $l$1.5 cun lateral to the lower border of the spinous process of T10.$l$,
  $a$Clears damp-heat from the Gallbladder, benefits the middle burner.$a$,
  $i$Jaundice, bitter taste in the mouth, hypochondriac pain, tidal fever, vomiting. The back-shu point of the Gallbladder.$i$,
  $n$Oblique insertion toward the spine, 0.5–0.8 cun.$n$,
  $c$Never perpendicular and deep.$c$,
  '{back_shu}');

perform public.set_point_clinical('BL20',
  $l$1.5 cun lateral to the lower border of the spinous process of T11.$l$,
  $a$Tonifies the Spleen, resolves dampness, raises yang, nourishes blood.$a$,
  $i$Poor appetite, abdominal distension, diarrhoea, oedema, fatigue, bleeding from Spleen deficiency, prolapse. The back-shu point of the Spleen and a principal tonification point.$i$,
  $n$Oblique insertion toward the spine, 0.5–1 cun.$n$,
  $c$Never perpendicular and deep — the kidney lies beneath at this level in thin patients.$c$,
  '{back_shu}');

perform public.set_point_clinical('BL21',
  $l$1.5 cun lateral to the lower border of the spinous process of T12.$l$,
  $a$Harmonises the Stomach, descends rebellious qi, resolves stagnation.$a$,
  $i$Epigastric pain and distension, vomiting, poor appetite, indigestion, borborygmus. The back-shu point of the Stomach.$i$,
  $n$Oblique insertion toward the spine, 0.5–1 cun.$n$,
  $c$Never perpendicular and deep.$c$,
  '{back_shu}');

perform public.set_point_clinical('BL22',
  $l$1.5 cun lateral to the lower border of the spinous process of L1.$l$,
  $a$Regulates the water passages of the three burners, resolves dampness.$a$,
  $i$Oedema, difficult urination, abdominal distension, borborygmus, diarrhoea, lumbar pain. The back-shu point of the San Jiao.$i$,
  $n$Perpendicular or slightly oblique, 0.5–1 cun.$n$,
  $c$Avoid deep insertion in thin patients — the kidney lies beneath.$c$,
  '{back_shu}');

perform public.set_point_clinical('BL23',
  $l$1.5 cun lateral to the lower border of the spinous process of L2.$l$,
  $a$Tonifies Kidney yin and yang, strengthens the lower back, benefits essence, the ears and the bones.$a$,
  $i$Chronic lower back pain and weakness, tinnitus and deafness, impotence and seminal emission, infertility, irregular menstruation, oedema, asthma from Kidney deficiency, frequent urination. The back-shu point of the Kidney.$i$,
  $n$Perpendicular, 0.8–1.2 cun. Moxa is very commonly used.$n$,
  $c$Avoid deep insertion — the kidney lies beneath.$c$,
  '{back_shu}');

perform public.set_point_clinical('BL24',
  $l$1.5 cun lateral to the lower border of the spinous process of L3.$l$,
  $a$Regulates qi in the lower burner, strengthens the lower back.$a$,
  $i$Lower back pain, abdominal distension, borborygmus, haemorrhoids, irregular menstruation.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('BL25',
  $l$1.5 cun lateral to the lower border of the spinous process of L4.$l$,
  $a$Regulates the intestines, strengthens the lower back, resolves stagnation.$a$,
  $i$Lower back pain and sciatica, constipation and diarrhoea, abdominal distension, dysentery. The back-shu point of the Large Intestine and a principal lumbar point.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  null,
  '{back_shu}');

perform public.set_point_clinical('BL26',
  $l$1.5 cun lateral to the lower border of the spinous process of L5.$l$,
  $a$Tonifies the original qi, strengthens the lower back, regulates the lower burner.$a$,
  $i$Lower back pain, abdominal distension, diarrhoea, difficult urination, weakness of the legs.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('BL27',
  $l$1.5 cun lateral to the midline, level with the first posterior sacral foramen.$l$,
  $a$Separates the clear from the turbid, regulates the intestines and bladder.$a$,
  $i$Lower abdominal pain, difficult urination, blood in the urine, diarrhoea, sacral pain. The back-shu point of the Small Intestine.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  null,
  '{back_shu}');

perform public.set_point_clinical('BL28',
  $l$1.5 cun lateral to the midline, level with the second posterior sacral foramen.$l$,
  $a$Regulates the Bladder, resolves damp-heat in the lower burner, strengthens the lower back.$a$,
  $i$Difficult or painful urination, retention, enuresis, sacral and lumbar pain, diarrhoea, genital pain. The back-shu point of the Bladder.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  null,
  '{back_shu}');

perform public.set_point_clinical('BL29',
  $l$1.5 cun lateral to the midline, level with the third posterior sacral foramen.$l$,
  $a$Strengthens the lower back, regulates the lower burner.$a$,
  $i$Sacral and lumbar stiffness and pain, dysentery, hernia.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('BL30',
  $l$1.5 cun lateral to the midline, level with the fourth posterior sacral foramen.$l$,
  $a$Regulates the lower burner, benefits the genitals and anus.$a$,
  $i$Sacral pain, haemorrhoids, genital pain, irregular menstruation, leucorrhoea.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('BL31',
  $l$In the first posterior sacral foramen, between the posterior superior iliac spine and the midline.$l$,
  $a$Regulates the lower burner, benefits the uterus and genitals, strengthens the lower back.$a$,
  $i$Irregular menstruation, leucorrhoea, infertility, difficult urination, lumbosacral pain, sciatica.$i$,
  $n$Perpendicular into the foramen, 1–1.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('BL32',
  $l$In the second posterior sacral foramen.$l$,
  $a$Regulates the lower burner and the uterus, benefits urination, strengthens the lower back, relieves labour pain.$a$,
  $i$Dysmenorrhoea, irregular menstruation, infertility, labour pain, sciatica, lumbosacral pain, difficult urination. The most-used of the four sacral foramen points.$i$,
  $n$Perpendicular into the foramen, 1–1.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('BL33',
  $l$In the third posterior sacral foramen.$l$,
  $a$Regulates the lower burner, benefits urination and the genitals.$a$,
  $i$Difficult urination, constipation, leucorrhoea, irregular menstruation, lumbosacral pain.$i$,
  $n$Perpendicular into the foramen, 1–1.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('BL34',
  $l$In the fourth posterior sacral foramen.$l$,
  $a$Regulates the lower burner, benefits the anus and genitals.$a$,
  $i$Constipation, haemorrhoids, difficult urination, lumbosacral pain, leucorrhoea.$i$,
  $n$Perpendicular into the foramen, 1–1.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('BL35',
  $l$0.5 cun lateral to the tip of the coccyx.$l$,
  $a$Benefits the anus, resolves damp-heat in the lower burner.$a$,
  $i$Haemorrhoids, anal pain and prolapse, diarrhoea and dysentery, impotence.$i$,
  $n$Perpendicular, 0.5–1 cun, with the patient prone.$n$,
  null,
  '{}');

perform public.set_point_clinical('BL36',
  $l$At the midpoint of the transverse gluteal fold.$l$,
  $a$Activates the channel, relieves pain, benefits the lower back and leg.$a$,
  $i$Sciatica, lower back and buttock pain, weakness and paralysis of the leg, haemorrhoids, constipation.$i$,
  $n$Perpendicular, 1–2.5 cun.$n$,
  $c$The sciatic nerve lies deep here; a radiating sensation to the foot is expected, but do not repeat strong stimulation.$c$,
  '{}');

perform public.set_point_clinical('BL37',
  $l$On the posterior thigh, 6 cun below BL36, on the line between BL36 and BL40.$l$,
  $a$Activates the channel, benefits the lower back and leg.$a$,
  $i$Sciatica, posterior thigh pain, lower back pain, weakness of the leg.$i$,
  $n$Perpendicular, 1–2 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('BL38',
  $l$On the posterior knee, 1 cun above BL39, on the medial side of the biceps femoris tendon.$l$,
  $a$Activates the channel, relieves numbness and cramp.$a$,
  $i$Numbness and cramping of the popliteal region and leg, constipation.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('BL39',
  $l$On the popliteal crease, on the medial side of the biceps femoris tendon, lateral to BL40.$l$,
  $a$Regulates the water passages, benefits the bladder, relaxes the sinews.$a$,
  $i$Difficult urination, retention of urine, cramp of the leg, lower back and knee stiffness. The lower he-sea point of the San Jiao.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{lower_he_sea}');

perform public.set_point_clinical('BL40',
  $l$At the midpoint of the popliteal crease, between the tendons of biceps femoris and semitendinosus.$l$,
  $a$Relaxes the sinews, activates the channel, clears heat and cools the blood, benefits the lower back and knee.$a$,
  $i$Acute and chronic lower back pain, sciatica, knee pain and stiffness, hemiplegia, heat stroke, skin disease with heat, vomiting and diarrhoea. Command point of the back — the principal distal point for lumbar pain.$i$,
  $n$Perpendicular, 0.5–1.5 cun; or prick the small veins to bleed for acute heat and lumbar sprain.$n$,
  $c$The popliteal artery and tibial nerve lie deep; avoid deep insertion and strong stimulation.$c$,
  '{he_sea, command}');

perform public.set_point_clinical('BL41',
  $l$3 cun lateral to the lower border of the spinous process of T2.$l$,
  $a$Expels wind, activates the channel, benefits the neck and shoulder.$a$,
  $i$Stiff neck and shoulder, pain of the upper back and elbow, numbness of the arm.$i$,
  $n$Oblique insertion toward the spine, 0.5–0.8 cun.$n$,
  $c$Never perpendicular and deep — pneumothorax risk.$c$,
  '{crossing}');

perform public.set_point_clinical('BL42',
  $l$3 cun lateral to the lower border of the spinous process of T3.$l$,
  $a$Descends and disseminates Lung qi, benefits the corporeal soul.$a$,
  $i$Cough, asthma, chest fullness, stiff neck and shoulder, grief and sadness.$i$,
  $n$Oblique insertion toward the spine, 0.5–0.8 cun.$n$,
  $c$Never perpendicular and deep — pneumothorax risk.$c$,
  '{}');

perform public.set_point_clinical('BL43',
  $l$3 cun lateral to the lower border of the spinous process of T4.$l$,
  $a$Tonifies deficiency of any kind, nourishes Lung yin, strengthens the constitution.$a$,
  $i$Chronic weakness and exhaustion, chronic cough and asthma, tuberculosis, night sweats, poor memory, seminal emission. The classical point for profound depletion, treated principally with moxa.$i$,
  $n$Oblique insertion toward the spine, 0.5–0.8 cun. Moxibustion is the classical method here.$n$,
  $c$Never perpendicular and deep — pneumothorax risk.$c$,
  '{}');

perform public.set_point_clinical('BL44',
  $l$3 cun lateral to the lower border of the spinous process of T5.$l$,
  $a$Unbinds the chest, calms the spirit, regulates the Heart.$a$,
  $i$Cardiac pain, palpitations, cough and asthma, chest fullness, back stiffness.$i$,
  $n$Oblique insertion toward the spine, 0.5–0.8 cun.$n$,
  $c$Never perpendicular and deep — pneumothorax risk.$c$,
  '{}');

perform public.set_point_clinical('BL45',
  $l$3 cun lateral to the lower border of the spinous process of T6.$l$,
  $a$Clears heat, descends rebellious qi, unbinds the chest.$a$,
  $i$Cough, asthma, chest and hypochondriac pain, night sweats, malaria, shoulder and back pain.$i$,
  $n$Oblique insertion toward the spine, 0.5–0.8 cun.$n$,
  $c$Never perpendicular and deep — pneumothorax risk.$c$,
  '{}');

perform public.set_point_clinical('BL46',
  $l$3 cun lateral to the lower border of the spinous process of T7.$l$,
  $a$Benefits the diaphragm, descends rebellious qi, harmonises the Stomach.$a$,
  $i$Hiccup, belching, vomiting, difficulty swallowing, back stiffness and pain.$i$,
  $n$Oblique insertion toward the spine, 0.5–0.8 cun.$n$,
  $c$Never perpendicular and deep — pneumothorax risk.$c$,
  '{}');

perform public.set_point_clinical('BL47',
  $l$3 cun lateral to the lower border of the spinous process of T9.$l$,
  $a$Spreads Liver qi, benefits the ethereal soul, harmonises the middle burner.$a$,
  $i$Hypochondriac pain and fullness, vomiting, jaundice, irritability and depression, insomnia with dream-disturbed sleep.$i$,
  $n$Oblique insertion toward the spine, 0.5–0.8 cun.$n$,
  $c$Never perpendicular and deep.$c$,
  '{}');

perform public.set_point_clinical('BL48',
  $l$3 cun lateral to the lower border of the spinous process of T10.$l$,
  $a$Clears damp-heat from the Gallbladder, regulates the middle burner.$a$,
  $i$Jaundice, bitter taste, hypochondriac pain, vomiting, abdominal distension.$i$,
  $n$Oblique insertion toward the spine, 0.5–0.8 cun.$n$,
  $c$Never perpendicular and deep.$c$,
  '{}');

perform public.set_point_clinical('BL49',
  $l$3 cun lateral to the lower border of the spinous process of T11.$l$,
  $a$Strengthens the Spleen, resolves dampness, settles obsessive thought.$a$,
  $i$Abdominal distension, borborygmus, diarrhoea, jaundice, vomiting, overthinking and worry.$i$,
  $n$Oblique insertion toward the spine, 0.5–1 cun.$n$,
  $c$Never perpendicular and deep — the kidney lies beneath in thin patients.$c$,
  '{}');

perform public.set_point_clinical('BL50',
  $l$3 cun lateral to the lower border of the spinous process of T12.$l$,
  $a$Harmonises the Stomach, resolves food stagnation.$a$,
  $i$Abdominal distension, indigestion, constipation, oedema, back pain.$i$,
  $n$Oblique or perpendicular, 0.5–1 cun.$n$,
  $c$Avoid deep insertion.$c$,
  '{}');

perform public.set_point_clinical('BL51',
  $l$3 cun lateral to the lower border of the spinous process of L1.$l$,
  $a$Regulates the lower burner, dissipates masses.$a$,
  $i$Abdominal masses and pain, constipation, irregular menstruation, lumbar pain.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  $c$Avoid deep insertion — the kidney lies beneath.$c$,
  '{}');

perform public.set_point_clinical('BL52',
  $l$3 cun lateral to the lower border of the spinous process of L2, level with BL23.$l$,
  $a$Tonifies the Kidney, benefits essence, strengthens the will and the lower back.$a$,
  $i$Seminal emission, impotence, chronic lower back pain and stiffness, difficult urination, lack of willpower and drive, oedema.$i$,
  $n$Perpendicular, 0.8–1.2 cun. Moxa is commonly used.$n$,
  $c$Avoid deep insertion — the kidney lies beneath.$c$,
  '{}');

perform public.set_point_clinical('BL53',
  $l$3 cun lateral to the midline, level with the second posterior sacral foramen.$l$,
  $a$Regulates the lower burner, benefits urination.$a$,
  $i$Difficult urination, retention, constipation, borborygmus, lumbosacral stiffness.$i$,
  $n$Perpendicular, 1–1.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('BL54',
  $l$3 cun lateral to the midline, level with the fourth posterior sacral foramen.$l$,
  $a$Activates the channel, benefits the lower back and legs, resolves damp-heat.$a$,
  $i$Sciatica, lumbosacral pain, weakness and paralysis of the leg, haemorrhoids, difficult urination.$i$,
  $n$Perpendicular, 1.5–2.5 cun.$n$,
  $c$Deep insertion may reach the sciatic nerve; avoid repeated strong stimulation.$c$,
  '{}');

perform public.set_point_clinical('BL55',
  $l$2 cun below BL40, between the two heads of gastrocnemius.$l$,
  $a$Activates the channel, relaxes the sinews, stops bleeding.$a$,
  $i$Lower back and leg pain, cramp of the calf, uterine bleeding, hernia.$i$,
  $n$Perpendicular, 1–1.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('BL56',
  $l$On the calf, midway between BL55 and BL57, between the heads of gastrocnemius.$l$,
  $a$Relaxes the sinews, activates the channel.$a$,
  $i$Calf cramp and pain, haemorrhoids, lower back pain, nosebleed.$i$,
  $n$Perpendicular, 1–1.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('BL57',
  $l$In the depression below the belly of gastrocnemius, at the apex of the inverted V formed when the calf is contracted, 8 cun below BL40.$l$,
  $a$Relaxes the sinews, benefits the anus, activates the channel.$a$,
  $i$Haemorrhoids and anal prolapse, calf cramp, lower back and leg pain, constipation. The classical point for haemorrhoids.$i$,
  $n$Perpendicular, 1–2 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('BL58',
  $l$7 cun above BL60, on the posterior border of fibula, about 1 cun lateral and inferior to BL57.$l$,
  $a$Activates the channel, clears heat, benefits the head and the bladder.$a$,
  $i$Headache and dizziness, lower back and leg pain, haemorrhoids, nasal congestion, weakness of the leg.$i$,
  $n$Perpendicular, 1–1.5 cun.$n$,
  null,
  '{luo_connecting}');

perform public.set_point_clinical('BL59',
  $l$3 cun directly above BL60, on the posterior border of the fibula.$l$,
  $a$Activates the channel, relieves pain, benefits the heel.$a$,
  $i$Heel and ankle pain, lower back and leg pain, headache. The xi-cleft point of the Yang Qiao vessel.$i$,
  $n$Perpendicular, 0.8–1.2 cun.$n$,
  null,
  '{xi_cleft}');

perform public.set_point_clinical('BL60',
  $l$In the depression between the tip of the lateral malleolus and the Achilles tendon.$l$,
  $a$Expels wind, activates the whole channel, relaxes the sinews, relieves pain, promotes labour.$a$,
  $i$Occipital headache, stiff neck, lower back pain, sciatica, ankle and heel pain, dizziness, difficult labour. A principal point for pain anywhere along the Bladder channel.$i$,
  $n$Perpendicular, 0.5–0.8 cun.$n$,
  $c$Contraindicated in pregnancy — classically used to promote labour.$c$,
  '{jing_river}');

perform public.set_point_clinical('BL61',
  $l$On the lateral foot, directly below BL60, on the border between red and white skin at the lateral side of the calcaneum.$l$,
  $a$Relaxes the sinews, activates the channel, clears the head.$a$,
  $i$Heel pain, weakness of the leg, epilepsy, mania, lower back pain.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{}');

perform public.set_point_clinical('BL62',
  $l$On the lateral foot, in the depression directly below the tip of the lateral malleolus.$l$,
  $a$Benefits the head and eyes, calms the spirit, opens the Yang Qiao vessel, relaxes the sinews.$a$,
  $i$Insomnia, headache and dizziness, epilepsy, lower back and leg pain, ankle pain, stiff neck. Confluent point of the Yang Qiao vessel, paired with SI3.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{confluent}');

perform public.set_point_clinical('BL63',
  $l$On the lateral foot, in the depression anterior and inferior to BL62, on the border between red and white skin.$l$,
  $a$Relieves acute pain, calms the spirit, activates the channel.$a$,
  $i$Acute lower back pain, acute abdominal pain, epilepsy, childhood convulsions, ankle and foot pain. The xi-cleft point.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{xi_cleft}');

perform public.set_point_clinical('BL64',
  $l$On the lateral foot, below the tuberosity of the fifth metatarsal bone, on the border between red and white skin.$l$,
  $a$Clears the head and eyes, calms the spirit, activates the channel.$a$,
  $i$Headache, stiff neck, lower back pain, epilepsy, blurred vision, foot pain.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{yuan_source}');

perform public.set_point_clinical('BL65',
  $l$On the lateral foot, proximal to the head of the fifth metatarsal bone, on the border between red and white skin.$l$,
  $a$Clears the head, expels wind, calms the spirit.$a$,
  $i$Occipital headache, stiff neck, dizziness, back pain, mania, boils.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{shu_stream}');

perform public.set_point_clinical('BL66',
  $l$On the lateral foot, distal to the fifth metatarsophalangeal joint, on the border between red and white skin.$l$,
  $a$Clears heat, benefits the head and eyes.$a$,
  $i$Headache, stiff neck, dizziness, nosebleed, mania, chronic indigestion.$i$,
  $n$Perpendicular, 0.2–0.3 cun.$n$,
  null,
  '{ying_spring}');

perform public.set_point_clinical('BL67',
  $l$On the lateral side of the little toe, 0.1 cun proximal to the corner of the nail.$l$,
  $a$Expels wind, clears the head and eyes, turns the fetus, promotes labour.$a$,
  $i$Malposition of the fetus — the classical moxa point for breech presentation — difficult labour, retained placenta, headache, nasal congestion, eye pain.$i$,
  $n$Shallow perpendicular 0.1 cun, or prick to bleed. For fetal malposition, moxa is used rather than needling.$n$,
  $c$Contraindicated in pregnancy for needling. Moxa for breech presentation is a deliberate exception, done under supervision and normally around weeks 32–36.$c$,
  '{jing_well}');

end
$seed$;
