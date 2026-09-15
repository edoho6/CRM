-- ============================================================================
-- Materia medica · 01 · Herbs that release the exterior
-- ============================================================================
-- Loaded through public.catalogue_upsert_herb (migration 20260915200000) into the
-- shared catalogue; each clinic copies it with clinic_load_catalogue(). Every row
-- is created with needs_review = true: the practitioner confirms it, and the
-- flag clears itself when they edit the clinical fields.
--
-- Doses are classical decoction ranges in grams per day (Bensky, Materia
-- Medica, 3rd ed. conventions). Granule doses differ by concentrate ratio.
--
-- Argument order: pinyin, chinese, botanical, pharmaceutical, english,
--   tcm_category, temperature, tastes, channels,
--   actions, indications, cautions, dose_min, dose_max, dosage_notes
-- ============================================================================

do $seed$
begin

-- ---------------------------------------------------------------------------
-- Warm, acrid herbs that release the exterior
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Ma Huang','麻黄','Ephedra sinica (Herba)','Herba Ephedrae','Ephedra',
  'release_exterior_warm','warm','{acrid,bitter}','{lung,bladder}',
  $t$Induces sweating and releases the exterior. Disseminates Lung qi and calms wheezing. Promotes urination and reduces edema.$t$,
  $t$Wind-cold with no sweating, chills and fever, body aches. Cough and wheezing from obstructed Lung qi. Edema with an exterior pattern.$t$,
  $t$Not for exterior deficiency with spontaneous sweating, yin deficiency, hypertension, insomnia or palpitations. Regulated substance in many countries; honey-fried form is milder.$t$,
  2, 9, 'Honey-fried (Zhi Ma Huang) for wheezing; raw for sweating.');

perform public.catalogue_upsert_herb('Gui Zhi','桂枝','Cinnamomum cassia (Ramulus)','Ramulus Cinnamomi','Cinnamon twig',
  'release_exterior_warm','warm','{acrid,sweet}','{heart,lung,bladder}',
  $t$Releases the exterior and harmonizes ying and wei. Warms the channels and unblocks yang. Warms and transforms water qi. Assists Heart yang.$t$,
  $t$Wind-cold with sweating (taiyang wind-strike). Cold bi pain in joints and limbs. Palpitations and edema from yang deficiency. Cold in the blood with menstrual pain.$t$,
  $t$Not in warm-heat disease, yin deficiency with heat signs, or blood heat. Use cautiously in pregnancy and heavy menstruation.$t$,
  3, 9, 'Up to 15 g in warming formulas.');

perform public.catalogue_upsert_herb('Zi Su Ye','紫苏叶','Perilla frutescens (Folium)','Folium Perillae','Perilla leaf',
  'release_exterior_warm','warm','{acrid}','{lung,spleen}',
  $t$Releases the exterior and disperses cold. Moves qi and harmonizes the middle. Calms the fetus. Resolves seafood poisoning.$t$,
  $t$Wind-cold with chest and abdominal fullness. Nausea, vomiting, morning sickness. Poisoning from fish or crab.$t$,
  $t$Not for exterior deficiency with sweating or qi deficiency. Add near the end of decoction.$t$,
  5, 9, 'Zi Su Geng (stem) regulates qi and calms the fetus; Zi Su Zi (seed) directs Lung qi downward.');

perform public.catalogue_upsert_herb('Jing Jie','荆芥','Schizonepeta tenuifolia (Herba)','Herba Schizonepetae','Schizonepeta',
  'release_exterior_warm','slightly_warm','{acrid}','{lung,liver}',
  $t$Releases the exterior and expels wind. Vents rashes and relieves itching. Charred, it stops bleeding.$t$,
  $t$Wind-cold or wind-heat exterior patterns (gentle, works with either). Early measles, itchy rashes, sores. Charred for bleeding in the stool or uterus.$t$,
  $t$Not for fully erupted measles or exterior deficiency. Add near the end of decoction.$t$,
  5, 9, 'Charred (Jing Jie Tan) for bleeding.');

perform public.catalogue_upsert_herb('Fang Feng','防风','Saposhnikovia divaricata (Radix)','Radix Saposhnikoviae','Siler root',
  'release_exterior_warm','slightly_warm','{acrid,sweet}','{bladder,liver,spleen}',
  $t$Expels wind and releases the exterior. Expels wind-dampness and alleviates pain. Stops spasms. Relieves diarrhea from Liver-Spleen disharmony.$t$,
  $t$Exterior wind-cold or wind-heat with headache and body aches. Wind-damp bi pain. Itchy skin conditions. Tetanus and trembling. Painful diarrhea with borborygmus.$t$,
  $t$Not for yin deficiency with heat, or spasms from blood deficiency. The gentlest of the wind herbs.$t$,
  5, 9, null);

perform public.catalogue_upsert_herb('Qiang Huo','羌活','Notopterygium incisum (Rhizoma et Radix)','Rhizoma et Radix Notopterygii','Notopterygium',
  'release_exterior_warm','warm','{acrid,bitter}','{bladder,kidney}',
  $t$Releases the exterior and disperses cold. Expels wind-dampness and alleviates pain, especially in the upper body and occiput. Guides to the taiyang channel.$t$,
  $t$Wind-cold-damp with headache, stiff neck and body aches. Upper-body bi pain, shoulder and arm.$t$,
  $t$Not for yin or blood deficiency, or pain from qi and blood deficiency. Strong and drying; can cause nausea in large doses.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Gao Ben','藁本','Ligusticum sinense (Rhizoma)','Rhizoma Ligustici','Chinese lovage root',
  'release_exterior_warm','warm','{acrid}','{bladder}',
  $t$Disperses cold and expels wind. Alleviates pain, reaching the vertex.$t$,
  $t$Wind-cold headache at the vertex, migraine, toothache. Wind-cold-damp bi.$t$,
  $t$Not for headache from blood deficiency or heat. Drying.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Bai Zhi','白芷','Angelica dahurica (Radix)','Radix Angelicae Dahuricae','Dahurian angelica root',
  'release_exterior_warm','warm','{acrid}','{lung,stomach}',
  $t$Expels wind and alleviates pain, especially in the yangming region. Opens the nasal passages. Reduces swelling and expels pus. Dries dampness and stops leukorrhea.$t$,
  $t$Frontal headache, supraorbital pain, toothache. Sinus congestion and nasal discharge. Early-stage sores and abscesses. Cold-damp leukorrhea.$t$,
  $t$Not for yin or blood deficiency with heat. Sores that have already ulcerated.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Xi Xin','细辛','Asarum heterotropoides (Herba cum Radice)','Herba Asari','Asarum, wild ginger',
  'release_exterior_warm','warm','{acrid}','{lung,kidney,heart}',
  $t$Disperses cold and alleviates pain. Warms the Lung and transforms thin mucus. Opens the orifices. Releases the exterior from the shaoyin level.$t$,
  $t$Headache, toothache and body pain from wind-cold. Cough with copious thin sputum. Nasal congestion. Wind-cold with underlying yang deficiency.$t$,
  $t$Toxic in overdose: do not exceed 3 g in decoction; powder form limited to 1 g. Not for yin deficiency, headache from blood deficiency, or dry cough. Incompatible with Li Lu. Aristolochic-acid concerns: use only root material from reputable suppliers.$t$,
  1, 3, 'Maximum 3 g in decoction.');

perform public.catalogue_upsert_herb('Sheng Jiang','生姜','Zingiber officinale (Rhizoma recens)','Rhizoma Zingiberis Recens','Fresh ginger',
  'release_exterior_warm','warm','{acrid}','{lung,spleen,stomach}',
  $t$Releases the exterior and disperses cold. Warms the middle and stops vomiting. Warms the Lung and stops cough. Resolves the toxicity of Ban Xia, Tian Nan Xing and seafood.$t$,
  $t$Mild wind-cold. Nausea and vomiting from Stomach cold. Cough with thin white sputum.$t$,
  $t$Not for heat patterns, yin deficiency with heat, or heat-type vomiting.$t$,
  3, 9, 'Sheng Jiang Pi (peel) promotes urination; Gan Jiang (dried) warms the interior.');

perform public.catalogue_upsert_herb('Cong Bai','葱白','Allium fistulosum (Bulbus)','Bulbus Allii Fistulosi','Scallion white',
  'release_exterior_warm','warm','{acrid}','{lung,stomach}',
  $t$Releases the exterior and induces sweating. Unblocks yang and disperses cold. Resolves toxicity topically.$t$,
  $t$Early wind-cold with chills and mild fever. Abdominal pain and distention from cold obstruction. Topical for sores.$t$,
  $t$Not for exterior deficiency with sweating. Not with honey.$t$,
  3, 9, 'Usually 2 to 5 stalks, added at the end.');

perform public.catalogue_upsert_herb('Xiang Ru','香薷','Mosla chinensis (Herba)','Herba Moslae','Mosla, aromatic madder',
  'release_exterior_warm','slightly_warm','{acrid}','{lung,stomach}',
  $t$Releases the exterior and disperses cold. Transforms dampness and harmonizes the middle. Promotes urination and reduces edema.$t$,
  $t$Summer exterior cold with internal dampness: chills, fever, no sweating, abdominal pain, vomiting, diarrhea. Edema with an exterior pattern.$t$,
  $t$Not for summer-heat with sweating or exterior deficiency. Take cool to avoid vomiting. Known as summer Ma Huang.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Cang Er Zi','苍耳子','Xanthium sibiricum (Fructus)','Fructus Xanthii','Cocklebur fruit',
  'release_exterior_warm','warm','{acrid,bitter}','{lung}',
  $t$Opens the nasal passages. Dispels wind-dampness and alleviates pain. Dispels wind and stops itching.$t$,
  $t$Sinusitis and rhinitis with thick discharge, headache. Wind-damp bi. Itchy skin conditions.$t$,
  $t$Slightly toxic: do not overdose or use raw; not with blood-deficiency headache. Incompatible with pork per tradition.$t$,
  3, 9, 'Dry-fried to reduce toxicity.');

perform public.catalogue_upsert_herb('Xin Yi Hua','辛夷','Magnolia biondii (Flos)','Flos Magnoliae','Magnolia flower bud',
  'release_exterior_warm','warm','{acrid}','{lung,stomach}',
  $t$Expels wind-cold and opens the nasal passages.$t$,
  $t$Nasal congestion, rhinitis, sinusitis, loss of smell, frontal headache.$t$,
  $t$Not for yin deficiency with heat. Decoct wrapped in cloth: the hairs irritate the throat.$t$,
  3, 9, 'Decoct in a cloth bag.');

perform public.catalogue_upsert_herb('Hu Sui','胡荽','Coriandrum sativum (Herba)','Herba Coriandri','Coriander',
  'release_exterior_warm','warm','{acrid}','{lung,stomach}',
  $t$Vents rashes. Promotes digestion and opens the Stomach.$t$,
  $t$Early measles with incomplete eruption. Poor appetite, food stagnation.$t$,
  $t$Not once a rash has fully erupted, or with heat toxin.$t$,
  3, 6, null);

-- ---------------------------------------------------------------------------
-- Cool, acrid herbs that release the exterior
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Bo He','薄荷','Mentha haplocalyx (Herba)','Herba Menthae','Field mint',
  'release_exterior_cool','cool','{acrid}','{lung,liver}',
  $t$Disperses wind-heat. Clears the head and eyes and benefits the throat. Vents rashes. Spreads Liver qi.$t$,
  $t$Wind-heat with fever, headache, sore throat, red eyes. Early measles. Chest and flank distention from constrained Liver qi.$t$,
  $t$Not for exterior deficiency with sweating or yin deficiency. Add in the last few minutes of decoction.$t$,
  3, 6, 'Add at the end of decoction.');

perform public.catalogue_upsert_herb('Niu Bang Zi','牛蒡子','Arctium lappa (Fructus)','Fructus Arctii','Burdock fruit',
  'release_exterior_cool','cold','{acrid,bitter}','{lung,stomach}',
  $t$Disperses wind-heat and benefits the throat. Vents rashes. Clears heat and resolves toxicity, reduces swelling. Moistens the intestines.$t$,
  $t$Wind-heat with cough and sore, swollen throat. Incomplete measles eruption. Mumps, acute sores, carbuncles.$t$,
  $t$Not for diarrhea from Spleen deficiency, or open sores from qi deficiency.$t$,
  6, 12, null);

perform public.catalogue_upsert_herb('Chan Tui','蝉蜕','Cryptotympana pustulata (Periostracum)','Periostracum Cicadae','Cicada moulting',
  'release_exterior_cool','cold','{sweet}','{lung,liver}',
  $t$Disperses wind-heat and benefits the throat and voice. Vents rashes and relieves itching. Clears the eyes and removes superficial visual obstruction. Extinguishes wind and stops spasms.$t$,
  $t$Wind-heat with hoarseness or loss of voice. Measles and itchy rashes. Red eyes, pterygium. Childhood convulsions, night crying, tetanus.$t$,
  $t$Animal product. Use cautiously in pregnancy.$t$,
  3, 6, 'Up to 15 g for spasms.');

perform public.catalogue_upsert_herb('Sang Ye','桑叶','Morus alba (Folium)','Folium Mori','Mulberry leaf',
  'release_exterior_cool','cold','{sweet,bitter}','{lung,liver}',
  $t$Disperses wind-heat. Clears the Lung and moistens dryness. Clears the Liver and brightens the eyes. Cools the blood.$t$,
  $t$Wind-heat with headache, cough, sore throat. Dry cough from Lung heat or autumn dryness. Red, painful, dry eyes. Minor bleeding from heat.$t$,
  $t$Not for cough from cold.$t$,
  5, 9, 'Honey-fried for moistening the Lung.');

perform public.catalogue_upsert_herb('Ju Hua','菊花','Chrysanthemum morifolium (Flos)','Flos Chrysanthemi','Chrysanthemum flower',
  'release_exterior_cool','slightly_cold','{sweet,bitter}','{lung,liver}',
  $t$Disperses wind-heat. Clears the Liver and brightens the eyes. Calms Liver yang. Clears heat and resolves toxicity.$t$,
  $t$Wind-heat with headache and fever. Red, swollen, painful eyes; blurred vision. Dizziness and headache from Liver yang rising. Sores and swellings.$t$,
  $t$Not for diarrhea from Spleen deficiency. Yellow flower (Huang Ju) disperses wind; white (Bai Ju) calms the Liver; wild (Ye Ju Hua) resolves toxicity.$t$,
  5, 15, null);

perform public.catalogue_upsert_herb('Man Jing Zi','蔓荆子','Vitex trifolia (Fructus)','Fructus Viticis','Vitex fruit',
  'release_exterior_cool','cool','{acrid,bitter}','{bladder,liver,stomach}',
  $t$Disperses wind-heat. Clears the head and eyes and alleviates pain.$t$,
  $t$Wind-heat headache, eye pain, tearing, dizziness. Wind-damp bi with pain.$t$,
  $t$Not for headache from blood deficiency or yin deficiency.$t$,
  5, 9, null);

perform public.catalogue_upsert_herb('Chai Hu','柴胡','Bupleurum chinense (Radix)','Radix Bupleuri','Bupleurum root',
  'release_exterior_cool','cool','{bitter,acrid}','{liver,gallbladder,pericardium,san_jiao}',
  $t$Releases the shaoyang and reduces fever. Spreads Liver qi and relieves constraint. Raises yang qi.$t$,
  $t$Alternating chills and fever, bitter taste, flank pain (shaoyang). Liver qi stagnation with chest and flank distention, irregular menses, emotional constraint. Prolapse from sinking qi.$t$,
  $t$Not for yin deficiency with rising Liver yang, or cough from Lung yin deficiency. Ascends and disperses; can aggravate headache and dizziness from yin deficiency.$t$,
  3, 9, 'Vinegar-fried to spread Liver qi; raw for fever.');

perform public.catalogue_upsert_herb('Sheng Ma','升麻','Cimicifuga foetida (Rhizoma)','Rhizoma Cimicifugae','Black cohosh rhizome (Chinese)',
  'release_exterior_cool','cool','{acrid,sweet}','{lung,spleen,stomach,large_intestine}',
  $t$Releases the exterior and vents rashes. Clears heat and resolves toxicity. Raises yang qi.$t$,
  $t$Early measles. Toothache, mouth sores, sore throat from Stomach heat. Prolapse of rectum or uterus, chronic diarrhea from sinking qi.$t$,
  $t$Not for fully erupted measles, breathing difficulty, or yin deficiency with rising yang. Small doses to raise yang; larger to resolve toxicity.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Ge Gen','葛根','Pueraria lobata (Radix)','Radix Puerariae','Kudzu root',
  'release_exterior_cool','cool','{sweet,acrid}','{spleen,stomach}',
  $t$Releases the muscle layer and reduces fever. Vents rashes. Generates fluids and alleviates thirst. Raises Spleen yang and stops diarrhea.$t$,
  $t$Exterior pattern with stiff neck and upper back. Early measles. Thirst in febrile disease or wasting-thirst. Diarrhea and dysentery, especially with heat. Hypertension with neck stiffness.$t$,
  $t$Use cautiously in Stomach cold with vomiting. Dry-fried for diarrhea.$t$,
  9, 15, 'Up to 20 g. Ge Hua (flower) relieves alcohol toxicity.');

perform public.catalogue_upsert_herb('Dan Dou Chi','淡豆豉','Glycine max (Semen praeparatum)','Semen Sojae Praeparatum','Prepared soybean',
  'release_exterior_cool','cool','{sweet,bitter}','{lung,stomach}',
  $t$Releases the exterior. Relieves irritability and restlessness.$t$,
  $t$Mild exterior patterns, either cold or heat depending on preparation. Irritability, insomnia and chest oppression after a febrile disease (with Zhi Zi).$t$,
  $t$Gentle. Preparation determines temperature: made with Sang Ye and Qing Hao it is cool; with Ma Huang and Zi Su Ye it is warm.$t$,
  6, 12, null);

perform public.catalogue_upsert_herb('Fu Ping','浮萍','Spirodela polyrrhiza (Herba)','Herba Spirodelae','Duckweed',
  'release_exterior_cool','cold','{acrid}','{lung,bladder}',
  $t$Induces sweating and releases the exterior. Vents rashes and stops itching. Promotes urination and reduces edema.$t$,
  $t$Wind-heat with no sweating. Incomplete measles, urticaria. Edema with an exterior pattern.$t$,
  $t$Not for exterior deficiency with spontaneous sweating.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Mu Zei','木贼','Equisetum hiemale (Herba)','Herba Equiseti Hiemalis','Scouring rush, horsetail',
  'release_exterior_cool','neutral','{sweet,bitter}','{lung,liver}',
  $t$Disperses wind-heat. Clears the eyes and removes superficial visual obstruction. Stops bleeding.$t$,
  $t$Red, teary eyes with pterygium or corneal opacity from wind-heat. Bleeding hemorrhoids or uterine bleeding (minor).$t$,
  $t$Not for eye disorders from qi or blood deficiency.$t$,
  3, 9, null);

end
$seed$;
