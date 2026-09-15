-- ============================================================================
-- Point clinical reference · 03 · Heart and Small Intestine
-- ============================================================================
-- See 02_lung_large_intestine.sql for conventions.
-- ============================================================================

do $seed$
begin

-- ---------------------------------------------------------------------------
-- HT · Heart
-- ---------------------------------------------------------------------------

perform public.catalogue_set_point_clinical('HT1',
  $l$At the centre of the axilla, where the axillary artery pulses, with the arm abducted.$l$,
  $a$Unbinds the chest, regulates qi and blood, activates the channel.$a$,
  $i$Chest and hypochondriac pain, palpitations, cold and pain of the elbow and arm, scrofula of the axilla, dry throat and thirst.$i$,
  $n$Perpendicular, 0.3–0.5 cun, avoiding the axillary artery.$n$,
  $c$The axillary artery and the brachial plexus lie here. Palpate the pulse, needle beside it, and withdraw on any sharp radiating sensation. Moxa is not used.$c$,
  '{}');

perform public.catalogue_set_point_clinical('HT2',
  $l$On the medial upper arm, 3 cun above the medial end of the cubital crease, in the groove medial to biceps brachii.$l$,
  $a$Activates the channel, benefits the arm and shoulder, brightens the eyes.$a$,
  $i$Pain of the shoulder, arm and hypochondrium, headache, jaundice, blurred vision.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  $c$Avoid the ulnar nerve; stop and reposition on a sharp electric sensation into the hand.$c$,
  '{}');

perform public.catalogue_set_point_clinical('HT3',
  $l$With the elbow flexed, midway between the medial end of the cubital crease and the medial epicondyle of the humerus.$l$,
  $a$Clears Heart fire, calms the spirit, transforms phlegm, benefits the elbow.$a$,
  $i$Cardiac pain, palpitations, mania and agitation, poor memory, tremor of the hand, numbness and pain of the elbow and arm, scrofula.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{he_sea}');

perform public.catalogue_set_point_clinical('HT4',
  $l$On the palmar forearm, 1.5 cun above the wrist crease, on the radial side of the flexor carpi ulnaris tendon.$l$,
  $a$Calms the spirit, benefits the voice, regulates the Heart.$a$,
  $i$Cardiac pain, sudden loss of voice, stiffness of the tongue, fright and fear, elbow and arm contracture.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  $c$The ulnar nerve and artery lie close; withdraw slightly on a radiating sensation.$c$,
  '{jing_river}');

perform public.catalogue_set_point_clinical('HT5',
  $l$On the palmar forearm, 1 cun above the wrist crease, on the radial side of the flexor carpi ulnaris tendon.$l$,
  $a$Calms the spirit, benefits the tongue and voice, regulates Heart rhythm, benefits the bladder.$a$,
  $i$Palpitations, bradycardia, sudden loss of voice, stiff tongue, aphasia after stroke, enuresis and frequent urination, depression and anxiety.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{luo_connecting}');

perform public.catalogue_set_point_clinical('HT6',
  $l$On the palmar forearm, 0.5 cun above the wrist crease, on the radial side of the flexor carpi ulnaris tendon.$l$,
  $a$Clears deficiency heat, stops night sweating, cools the blood and stops bleeding, calms the spirit.$a$,
  $i$Night sweats, steaming bone fever, cardiac pain, palpitations with anxiety, haemoptysis, nosebleed. The xi-cleft point and the principal point for night sweating.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{xi_cleft}');

perform public.catalogue_set_point_clinical('HT7',
  $l$On the wrist crease, in the depression on the radial side of the flexor carpi ulnaris tendon, at the proximal border of the pisiform.$l$,
  $a$Calms the spirit, clears Heart fire, tonifies Heart qi and blood, regulates the Heart.$a$,
  $i$Insomnia, anxiety, palpitations, poor memory, agitation, mania and depression, cardiac pain, dementia. The source point and the principal spirit-calming point of the body.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{shu_stream, yuan_source}');

perform public.catalogue_set_point_clinical('HT8',
  $l$On the palm, between the fourth and fifth metacarpal bones, where the tip of the little finger rests when a fist is made.$l$,
  $a$Clears Heart fire, calms the spirit, benefits the genitals.$a$,
  $i$Palpitations, chest pain, agitation and restlessness, genital itching and pain, difficult urination, spasm of the little finger.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{ying_spring}');

perform public.catalogue_set_point_clinical('HT9',
  $l$On the radial side of the little finger, 0.1 cun proximal to the corner of the nail.$l$,
  $a$Restores consciousness, clears heat, calms the spirit.$a$,
  $i$Loss of consciousness, cardiac pain, palpitations with fright, febrile disease, mania, chest and hypochondriac pain. A revival point in collapse.$i$,
  $n$Shallow perpendicular 0.1 cun, or prick to bleed.$n$,
  null,
  '{jing_well}');

-- ---------------------------------------------------------------------------
-- SI · Small Intestine
-- ---------------------------------------------------------------------------

perform public.catalogue_set_point_clinical('SI1',
  $l$On the ulnar side of the little finger, 0.1 cun proximal to the corner of the nail.$l$,
  $a$Clears heat, promotes lactation, restores consciousness, benefits the breast.$a$,
  $i$Insufficient lactation, mastitis, sore throat, headache, febrile disease, loss of consciousness, stiff tongue.$i$,
  $n$Shallow perpendicular 0.1 cun, or prick to bleed.$n$,
  null,
  '{jing_well}');

perform public.catalogue_set_point_clinical('SI2',
  $l$On the ulnar side of the little finger, distal to the fifth metacarpophalangeal joint, on the border between red and white skin.$l$,
  $a$Clears heat from the channel, benefits the head and neck.$a$,
  $i$Numbness of the fingers, sore throat, tinnitus, headache, stiff neck, febrile disease, insufficient lactation.$i$,
  $n$Perpendicular, 0.2–0.3 cun.$n$,
  null,
  '{ying_spring}');

perform public.catalogue_set_point_clinical('SI3',
  $l$On the ulnar side of the hand, proximal to the head of the fifth metacarpal bone, at the end of the crease made by a loose fist.$l$,
  $a$Expels wind, benefits the neck and spine, opens the Du vessel, calms the spirit, clears heat.$a$,
  $i$Acute stiff neck, occipital headache, pain along the whole spine, epilepsy, night sweats, tinnitus, contracture of the fingers. Confluent point of the Du vessel, paired with BL62 — the principal point for the neck and back.$i$,
  $n$Perpendicular toward the palm, 0.5–1 cun.$n$,
  null,
  '{shu_stream, confluent}');

perform public.catalogue_set_point_clinical('SI4',
  $l$On the ulnar side of the hand, in the depression between the base of the fifth metacarpal and the triquetral bone.$l$,
  $a$Clears damp-heat, benefits the wrist, resolves jaundice.$a$,
  $i$Wrist and hand pain, jaundice, headache, stiff neck, tinnitus, febrile disease, diabetes.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{yuan_source}');

perform public.catalogue_set_point_clinical('SI5',
  $l$On the ulnar side of the wrist, in the depression between the styloid process of the ulna and the triquetral bone.$l$,
  $a$Clears heat, calms the spirit, benefits the wrist and neck.$a$,
  $i$Wrist pain, stiff neck, mania and agitation, febrile disease, toothache, tinnitus.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  null,
  '{jing_river}');

perform public.catalogue_set_point_clinical('SI6',
  $l$With the palm facing the chest, in the bony cleft on the radial side of the styloid process of the ulna, 1 cun above the wrist crease.$l$,
  $a$Brightens the eyes, benefits the sinews and joints, relieves acute pain.$a$,
  $i$Blurred vision, acute lumbar sprain, acute shoulder and arm pain, stiff neck. The xi-cleft point, and a classical point for sudden lower back pain.$i$,
  $n$Oblique toward the elbow, 0.3–0.5 cun. Located with the palm turned to the chest.$n$,
  null,
  '{xi_cleft}');

perform public.catalogue_set_point_clinical('SI7',
  $l$On the ulnar forearm, 5 cun above the wrist crease, on the line between SI5 and SI8.$l$,
  $a$Calms the spirit, expels wind, benefits the neck and head.$a$,
  $i$Stiff neck, headache, dizziness, mania and fright, weakness and pain of the elbow and fingers, warts.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{luo_connecting}');

perform public.catalogue_set_point_clinical('SI8',
  $l$With the elbow flexed, in the groove between the olecranon and the medial epicondyle of the humerus.$l$,
  $a$Clears heat, calms the spirit, activates the channel.$a$,
  $i$Elbow and arm pain, numbness along the ulnar side, headache, epilepsy, swollen gums, deafness.$i$,
  $n$Perpendicular, 0.3–0.5 cun.$n$,
  $c$The ulnar nerve runs in this groove: needle gently and withdraw on a sharp electric sensation.$c$,
  '{he_sea}');

perform public.catalogue_set_point_clinical('SI9',
  $l$With the arm adducted, 1 cun above the posterior end of the axillary fold.$l$,
  $a$Benefits the shoulder, activates the channel, benefits the ear.$a$,
  $i$Shoulder pain and restricted movement, frozen shoulder, pain of the scapula, tinnitus and deafness.$i$,
  $n$Perpendicular, 1–1.5 cun.$n$,
  $c$Do not angle medially toward the chest.$c$,
  '{}');

perform public.catalogue_set_point_clinical('SI10',
  $l$Directly above SI9, in the depression below the spine of the scapula, with the arm adducted.$l$,
  $a$Benefits the shoulder, activates the channel, dissipates nodules.$a$,
  $i$Shoulder pain, weakness of the arm, swelling of the shoulder region.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  $c$Do not needle deeply or medially — the chest cavity lies beyond.$c$,
  '{crossing}');

perform public.catalogue_set_point_clinical('SI11',
  $l$In the infrascapular fossa, at the junction of the upper and middle thirds of a line from the midpoint of the scapular spine to the inferior angle of the scapula.$l$,
  $a$Benefits the breast, unbinds the chest, activates the channel.$a$,
  $i$Scapular and shoulder pain, mastitis and breast pain, insufficient lactation, asthma, chest fullness. Very often the tender point in frozen shoulder.$i$,
  $n$Perpendicular, 0.5–1 cun.$n$,
  null,
  '{}');

perform public.catalogue_set_point_clinical('SI12',
  $l$In the supraspinous fossa, directly above SI11, at the midpoint of the superior border of the scapular spine.$l$,
  $a$Expels wind, benefits the shoulder, descends Lung qi.$a$,
  $i$Shoulder and scapular pain, inability to raise the arm, cough, asthma.$i$,
  $n$Perpendicular, 0.5–0.8 cun.$n$,
  $c$Do not needle deeply — the apex of the lung lies beneath the supraspinous fossa.$c$,
  '{crossing}');

perform public.catalogue_set_point_clinical('SI13',
  $l$At the medial end of the supraspinous fossa, midway between SI10 and the spinous process of T1.$l$,
  $a$Expels wind, benefits the shoulder and scapula.$a$,
  $i$Shoulder and scapular pain and stiffness, inability to raise the arm.$i$,
  $n$Perpendicular, 0.5–0.8 cun.$n$,
  $c$Do not needle deeply — pneumothorax risk.$c$,
  '{}');

perform public.catalogue_set_point_clinical('SI14',
  $l$3 cun lateral to the lower border of the spinous process of T1.$l$,
  $a$Expels wind, benefits the neck and shoulder, activates the channel.$a$,
  $i$Pain and stiffness of the scapula, neck and shoulder, cold sensation in the back.$i$,
  $n$Oblique insertion laterally, 0.5–0.8 cun.$n$,
  $c$Do not needle perpendicularly and deeply — pneumothorax risk.$c$,
  '{}');

perform public.catalogue_set_point_clinical('SI15',
  $l$2 cun lateral to the lower border of the spinous process of C7.$l$,
  $a$Descends Lung qi, benefits the neck and shoulder.$a$,
  $i$Cough, asthma, neck and shoulder pain and stiffness, blurred vision.$i$,
  $n$Oblique insertion laterally, 0.3–0.5 cun.$n$,
  $c$Do not needle perpendicularly and deeply — pneumothorax risk.$c$,
  '{}');

perform public.catalogue_set_point_clinical('SI16',
  $l$On the lateral neck, level with the Adam''s apple, at the posterior border of sternocleidomastoid.$l$,
  $a$Benefits the ear and throat, calms the spirit.$a$,
  $i$Sore throat, deafness and tinnitus, stiff neck, sudden loss of voice, mania. A window of the sky point.$i$,
  $n$Perpendicular, 0.5–0.8 cun.$n$,
  $c$Avoid the carotid vessels; needle at the posterior border of the muscle.$c$,
  '{window_of_sky}');

perform public.catalogue_set_point_clinical('SI17',
  $l$Posterior to the angle of the mandible, in the depression at the anterior border of sternocleidomastoid.$l$,
  $a$Benefits the ear and throat, dissipates nodules.$a$,
  $i$Deafness and tinnitus, sore throat, goitre, swelling of the neck and cheek, stiff neck. A window of the sky point.$i$,
  $n$Perpendicular, 0.5–0.8 cun.$n$,
  $c$Avoid the carotid artery, which lies deep to this point. Needle with care.$c$,
  '{window_of_sky, crossing}');

perform public.catalogue_set_point_clinical('SI18',
  $l$Directly below the outer canthus, in the depression at the lower border of the zygomatic bone.$l$,
  $a$Expels wind, benefits the face, activates the channel, relieves pain.$a$,
  $i$Facial paralysis, trigeminal neuralgia, twitching of the eyelid, toothache of the upper jaw, swelling of the cheek.$i$,
  $n$Perpendicular 0.3–0.5 cun, or transverse toward the affected area up to 1 cun.$n$,
  null,
  '{crossing}');

perform public.catalogue_set_point_clinical('SI19',
  $l$Between the tragus and the mandibular joint, in the depression that forms when the mouth is open.$l$,
  $a$Benefits the ear, opens the orifices, activates the channel.$a$,
  $i$Deafness, tinnitus, ear discharge, temporomandibular joint pain, toothache.$i$,
  $n$With the mouth open, perpendicular 0.5–1 cun. Leave the mouth open during retention.$n$,
  null,
  '{crossing}');

end
$seed$;
