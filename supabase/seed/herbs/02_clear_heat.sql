-- ============================================================================
-- Materia medica · 02 · Herbs that clear heat
-- ============================================================================
-- Five sub-groups: drain fire, cool the blood, dry dampness, relieve toxicity,
-- clear deficiency heat, clear summer heat. See 01 for conventions.
-- ============================================================================

do $seed$
begin

-- ---------------------------------------------------------------------------
-- Clear heat and drain fire
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Shi Gao','石膏','Gypsum fibrosum (mineral, CaSO4·2H2O)','Gypsum Fibrosum','Gypsum',
  'clear_heat_drain_fire','very_cold','{sweet,acrid}','{lung,stomach}',
  $t$Clears heat and drains fire. Relieves irritability and thirst. Clears Lung heat. Clears Stomach fire. Calcined, it astringes and generates flesh topically.$t$,
  $t$High fever with sweating, thirst and a big pulse (yangming qi level). Cough and wheezing from Lung heat. Headache, toothache and gum swelling from Stomach fire. Calcined for eczema, burns and ulcers.$t$,
  $t$Not for Spleen and Stomach deficiency cold, or yang deficiency. Crush and decoct first, 20 to 30 minutes.$t$,
  15, 60, 'Decoct first. Calcined (Duan Shi Gao) for topical use only.');

perform public.catalogue_upsert_herb('Zhi Mu','知母','Anemarrhena asphodeloides (Rhizoma)','Rhizoma Anemarrhenae','Anemarrhena rhizome',
  'clear_heat_drain_fire','cold','{bitter,sweet}','{lung,stomach,kidney}',
  $t$Clears heat and drains fire. Nourishes yin and moistens dryness. Clears deficiency heat.$t$,
  $t$High fever with thirst (with Shi Gao). Dry cough from Lung heat. Wasting-thirst. Steaming bone, night sweats and heat in the five centers from yin deficiency. Constipation from dryness.$t$,
  $t$Not for diarrhea or Spleen deficiency. Moistening, so avoid in dampness.$t$,
  6, 12, 'Salt-fried to enter the Kidney.');

perform public.catalogue_upsert_herb('Zhi Zi','栀子','Gardenia jasminoides (Fructus)','Fructus Gardeniae','Gardenia fruit',
  'clear_heat_drain_fire','cold','{bitter}','{heart,lung,stomach,san_jiao}',
  $t$Clears heat and eliminates irritability. Drains damp-heat. Cools the blood and stops bleeding. Resolves toxicity and reduces swelling.$t$,
  $t$Irritability, restlessness and insomnia in febrile disease. Damp-heat jaundice and painful urination. Bleeding from heat in the blood (nosebleed, blood in urine). Topical for sprains and bruises.$t$,
  $t$Not for diarrhea from Spleen deficiency or Stomach cold.$t$,
  3, 9, 'Charred for bleeding; raw for irritability.');

perform public.catalogue_upsert_herb('Xia Ku Cao','夏枯草','Prunella vulgaris (Spica)','Spica Prunellae','Self-heal spike',
  'clear_heat_drain_fire','cold','{bitter,acrid}','{liver,gallbladder}',
  $t$Clears Liver fire and brightens the eyes. Dissipates nodules and reduces swelling. Lowers blood pressure.$t$,
  $t$Red, painful, swollen eyes; headache and dizziness from Liver fire. Scrofula, goiter, lipoma, breast lumps. Hypertension with Liver heat.$t$,
  $t$Not for Spleen and Stomach deficiency. Long-term use can injure Stomach qi.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Dan Zhu Ye','淡竹叶','Lophatherum gracile (Herba)','Herba Lophatheri','Lophatherum',
  'clear_heat_drain_fire','cold','{sweet,bland}','{heart,stomach,small_intestine}',
  $t$Clears heat and eliminates irritability. Promotes urination.$t$,
  $t$Irritability and thirst in febrile disease. Mouth and tongue sores with dark, painful urination (Heart fire descending to the Small Intestine).$t$,
  $t$Not for cold from deficiency. Pregnancy caution.$t$,
  6, 9, null);

perform public.catalogue_upsert_herb('Lu Gen','芦根','Phragmites communis (Rhizoma)','Rhizoma Phragmitis','Reed rhizome',
  'clear_heat_drain_fire','cold','{sweet}','{lung,stomach}',
  $t$Clears heat and generates fluids. Clears Lung heat. Clears Stomach heat and stops vomiting. Promotes urination.$t$,
  $t$Fever and thirst in warm disease. Cough from Lung heat, Lung abscess with foul sputum. Vomiting from Stomach heat. Painful urination from heat.$t$,
  $t$Not for Spleen and Stomach deficiency cold. Fresh herb is stronger; double the dose.$t$,
  15, 30, 'Fresh: 30 to 60 g.');

perform public.catalogue_upsert_herb('Tian Hua Fen','天花粉','Trichosanthes kirilowii (Radix)','Radix Trichosanthis','Trichosanthes root',
  'clear_heat_drain_fire','cold','{bitter,sweet}','{lung,stomach}',
  $t$Clears heat and generates fluids. Moistens the Lung and transforms phlegm. Resolves toxicity and expels pus.$t$,
  $t$Thirst from heat injuring fluids, wasting-thirst. Dry cough with sticky sputum. Sores, abscesses and breast abscess.$t$,
  $t$Contraindicated in pregnancy. Not for Spleen and Stomach deficiency cold. Incompatible with Wu Tou.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Jue Ming Zi','决明子','Cassia obtusifolia (Semen)','Semen Cassiae','Cassia seed',
  'clear_heat_drain_fire','slightly_cold','{sweet,bitter,salty}','{liver,large_intestine}',
  $t$Clears the Liver and brightens the eyes. Calms Liver yang. Moistens the intestines and unblocks the bowels.$t$,
  $t$Red, swollen, painful eyes; photophobia; blurred vision. Headache and dizziness from Liver yang rising, hypertension. Constipation from dryness.$t$,
  $t$Not for diarrhea or loose stools. Dry-fry to reduce the laxative effect.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Han Shui Shi','寒水石','Glauberite or calcite (mineral)','Glauberitum','Glauberite',
  'clear_heat_drain_fire','cold','{salty}','{heart,stomach,kidney}',
  $t$Clears heat and drains fire. Relieves irritability and thirst.$t$,
  $t$High fever, irritability and thirst in warm disease. Topical for burns and swelling.$t$,
  $t$Not for Spleen and Stomach deficiency cold. Decoct first.$t$,
  9, 15, 'Decoct first.');

perform public.catalogue_upsert_herb('Mi Meng Hua','密蒙花','Buddleja officinalis (Flos)','Flos Buddlejae','Buddleja flower bud',
  'clear_heat_drain_fire','cool','{sweet}','{liver}',
  $t$Clears the Liver and brightens the eyes. Removes superficial visual obstruction.$t$,
  $t$Red, painful eyes with excessive tearing, photophobia, corneal opacity; also eye disorders from Liver blood deficiency.$t$,
  $t$Gentle; suitable for both excess and deficiency eye disorders.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Qing Xiang Zi','青葙子','Celosia argentea (Semen)','Semen Celosiae','Celosia seed',
  'clear_heat_drain_fire','cool','{bitter}','{liver}',
  $t$Clears Liver fire and brightens the eyes. Removes superficial visual obstruction.$t$,
  $t$Red, swollen, painful eyes, pterygium, blurred vision from Liver fire. Hypertension with Liver heat.$t$,
  $t$Dilates the pupil: contraindicated in glaucoma. Not for Liver or Kidney deficiency eye disorders.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Gu Jing Cao','谷精草','Eriocaulon buergerianum (Flos)','Flos Eriocauli','Pipewort flower',
  'clear_heat_drain_fire','neutral','{acrid,sweet}','{liver,lung}',
  $t$Disperses wind-heat and brightens the eyes. Removes superficial visual obstruction.$t$,
  $t$Red, painful eyes, photophobia, corneal opacity from wind-heat. Wind-heat headache and toothache.$t$,
  $t$Not for eye disorders from blood deficiency.$t$,
  6, 9, null);

-- ---------------------------------------------------------------------------
-- Clear heat and cool the blood
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Sheng Di Huang','生地黄','Rehmannia glutinosa (Radix)','Radix Rehmanniae','Raw rehmannia root',
  'clear_heat_cool_blood','cold','{sweet,bitter}','{heart,liver,kidney}',
  $t$Clears heat and cools the blood. Nourishes yin and generates fluids. Cools upward-blazing Heart fire.$t$,
  $t$Heat entering the ying and blood levels: high fever, a crimson tongue, bleeding, rashes. Yin deficiency with thirst, wasting-thirst, constipation from dryness. Mouth sores, irritability.$t$,
  $t$Not for Spleen deficiency with dampness, or abdominal fullness and loose stools.$t$,
  9, 30, null);

perform public.catalogue_upsert_herb('Xuan Shen','玄参','Scrophularia ningpoensis (Radix)','Radix Scrophulariae','Scrophularia root',
  'clear_heat_cool_blood','cold','{bitter,sweet,salty}','{lung,stomach,kidney}',
  $t$Clears heat and cools the blood. Nourishes yin. Resolves toxicity and dissipates nodules. Benefits the throat.$t$,
  $t$Ying-level heat with fever, a crimson tongue, delirium. Yin deficiency with thirst and constipation. Swollen sore throat, scrofula, goiter, sores and abscesses.$t$,
  $t$Not for Spleen deficiency with dampness or loose stools. Incompatible with Li Lu.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Mu Dan Pi','牡丹皮','Paeonia suffruticosa (Cortex)','Cortex Moutan','Moutan bark',
  'clear_heat_cool_blood','slightly_cold','{bitter,acrid}','{heart,liver,kidney}',
  $t$Clears heat and cools the blood. Invigorates the blood and dispels stasis. Clears deficiency heat. Drains pus and reduces swelling.$t$,
  $t$Blood-heat with bleeding, rashes, bone-steaming without sweating. Amenorrhea, abdominal masses and traumatic injury from blood stasis. Intestinal abscess and sores.$t$,
  $t$Not for blood deficiency with cold, or excessive menstruation. Pregnancy caution.$t$,
  6, 12, 'Raw to cool blood; wine-fried to invigorate.');

perform public.catalogue_upsert_herb('Chi Shao','赤芍','Paeonia veitchii (Radix)','Radix Paeoniae Rubra','Red peony root',
  'clear_heat_cool_blood','slightly_cold','{bitter}','{liver}',
  $t$Clears heat and cools the blood. Invigorates the blood and dispels stasis. Clears Liver fire.$t$,
  $t$Blood-heat with rashes and bleeding. Amenorrhea, dysmenorrhea, abdominal masses, trauma. Red, swollen eyes from Liver fire. Abscesses with heat.$t$,
  $t$Not for blood deficiency without stasis, or blood cold. Incompatible with Li Lu.$t$,
  6, 12, null);

perform public.catalogue_upsert_herb('Zi Cao','紫草','Arnebia euchroma (Radix)','Radix Arnebiae','Arnebia, gromwell root',
  'clear_heat_cool_blood','cold','{sweet,salty}','{heart,liver}',
  $t$Cools the blood and invigorates the blood. Vents rashes and resolves toxicity. Moistens the intestines.$t$,
  $t$Dark, unerupted measles or macules from blood heat. Topical for burns, eczema and sores. Constipation with heat.$t$,
  $t$Not for diarrhea from Spleen deficiency.$t$,
  3, 9, 'Often used as an oil for burns.');

perform public.catalogue_upsert_herb('Shui Niu Jiao','水牛角','Bubalus bubalis (Cornu)','Cornu Bubali','Water buffalo horn',
  'clear_heat_cool_blood','cold','{bitter,salty}','{heart,liver,stomach}',
  $t$Clears heat and cools the blood. Resolves toxicity. Calms fright and stops convulsions.$t$,
  $t$Blood-level heat with high fever, delirium, convulsions, bleeding and rashes. The standard substitute for rhinoceros horn.$t$,
  $t$Not for Spleen and Stomach deficiency cold. Animal product; decoct first, 30 to 60 minutes, or use as powder.$t$,
  15, 30, 'Decoct first; powder 1.5 to 3 g.');

-- ---------------------------------------------------------------------------
-- Clear heat and dry dampness
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Huang Qin','黄芩','Scutellaria baicalensis (Radix)','Radix Scutellariae','Baikal skullcap root',
  'clear_heat_dry_dampness','cold','{bitter}','{lung,gallbladder,stomach,large_intestine}',
  $t$Clears heat and dries dampness, especially in the upper burner. Drains fire and resolves toxicity. Cools the blood and stops bleeding. Calms the fetus.$t$,
  $t$Damp-heat with fever, jaundice, dysentery, painful urination. Cough with thick yellow sputum from Lung heat. Bleeding from heat. Restless fetus with heat.$t$,
  $t$Not for Spleen and Stomach deficiency cold. Very bitter and cold.$t$,
  3, 9, 'Raw for damp-heat; wine-fried for upper burner; charred for bleeding.');

perform public.catalogue_upsert_herb('Huang Lian','黄连','Coptis chinensis (Rhizoma)','Rhizoma Coptidis','Coptis rhizome',
  'clear_heat_dry_dampness','cold','{bitter}','{heart,liver,stomach,large_intestine}',
  $t$Clears heat and dries dampness, especially in the middle burner. Drains fire and resolves toxicity. Clears Heart fire. Stops vomiting.$t$,
  $t$Damp-heat dysentery, diarrhea, vomiting. Irritability, insomnia and mouth sores from Heart fire. Sores, abscesses, red eyes. Wasting-thirst.$t$,
  $t$Not for Spleen and Stomach deficiency cold, or yin deficiency with irritability. Very bitter and cold; short-term use.$t$,
  2, 9, 'Ginger-fried to stop vomiting; wine-fried for upper body heat.');

perform public.catalogue_upsert_herb('Huang Bai','黄柏','Phellodendron chinense (Cortex)','Cortex Phellodendri','Phellodendron bark',
  'clear_heat_dry_dampness','cold','{bitter}','{kidney,bladder,large_intestine}',
  $t$Clears heat and dries dampness, especially in the lower burner. Drains Kidney fire and clears deficiency heat. Resolves toxicity.$t$,
  $t$Damp-heat leukorrhea, painful urination, jaundice, dysentery, damp-heat in the legs. Steaming bone and night sweats from Kidney yin deficiency with fire. Topical for damp sores.$t$,
  $t$Not for Spleen and Stomach deficiency cold.$t$,
  3, 12, 'Salt-fried to enter the Kidney and clear deficiency heat.');

perform public.catalogue_upsert_herb('Long Dan Cao','龙胆草','Gentiana scabra (Radix)','Radix Gentianae','Chinese gentian root',
  'clear_heat_dry_dampness','cold','{bitter}','{liver,gallbladder,stomach}',
  $t$Drains damp-heat from the Liver and Gallbladder channels. Drains Liver fire.$t$,
  $t$Damp-heat jaundice, genital eczema and itching, leukorrhea, painful urination. Headache, red eyes, tinnitus, flank pain and convulsions from Liver fire.$t$,
  $t$Not for Spleen and Stomach deficiency cold, or yin deficiency. Extremely bitter; injures the Stomach in overdose.$t$,
  3, 6, null);

perform public.catalogue_upsert_herb('Ku Shen','苦参','Sophora flavescens (Radix)','Radix Sophorae Flavescentis','Sophora root',
  'clear_heat_dry_dampness','cold','{bitter}','{heart,liver,stomach,large_intestine,bladder}',
  $t$Clears heat and dries dampness. Expels wind and kills parasites. Stops itching. Promotes urination.$t$,
  $t$Damp-heat dysentery, jaundice, leukorrhea. Eczema, scabies, itchy skin lesions (internal or as a wash). Painful urination.$t$,
  $t$Not for Spleen and Stomach deficiency cold. Incompatible with Li Lu. Very bitter.$t$,
  3, 9, 'External wash: 30 to 60 g.');

perform public.catalogue_upsert_herb('Qin Pi','秦皮','Fraxinus rhynchophylla (Cortex)','Cortex Fraxini','Ash bark',
  'clear_heat_dry_dampness','cold','{bitter,astringent}','{liver,gallbladder,large_intestine}',
  $t$Clears heat and dries dampness. Astringes and stops dysentery. Clears the Liver and brightens the eyes.$t$,
  $t$Damp-heat dysentery with blood and pus. Leukorrhea. Red, swollen, painful eyes with a film.$t$,
  $t$Not for Spleen and Stomach deficiency cold.$t$,
  6, 12, null);

perform public.catalogue_upsert_herb('Bai Xian Pi','白鲜皮','Dictamnus dasycarpus (Cortex)','Cortex Dictamni','Dittany root bark',
  'clear_heat_dry_dampness','cold','{bitter}','{spleen,stomach}',
  $t$Clears heat and dries dampness. Expels wind and resolves toxicity. Stops itching.$t$,
  $t$Damp-heat skin lesions: eczema, urticaria, scabies with oozing and itching. Damp-heat jaundice. Damp-heat bi.$t$,
  $t$Not for deficiency cold.$t$,
  6, 9, null);

-- ---------------------------------------------------------------------------
-- Clear heat and relieve toxicity
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Jin Yin Hua','金银花','Lonicera japonica (Flos)','Flos Lonicerae','Honeysuckle flower',
  'clear_heat_relieve_toxicity','cold','{sweet}','{lung,stomach,large_intestine}',
  $t$Clears heat and resolves toxicity. Disperses wind-heat. Cools the blood and stops dysentery.$t$,
  $t$Sores, carbuncles, abscesses, breast abscess. Wind-heat with fever and sore throat; early warm disease. Damp-heat dysentery with blood.$t$,
  $t$Not for Spleen and Stomach deficiency cold, or open sores from qi deficiency.$t$,
  6, 15, 'Up to 30 g for sores. Charred for dysentery with blood.');

perform public.catalogue_upsert_herb('Lian Qiao','连翘','Forsythia suspensa (Fructus)','Fructus Forsythiae','Forsythia fruit',
  'clear_heat_relieve_toxicity','slightly_cold','{bitter}','{lung,heart,gallbladder}',
  $t$Clears heat and resolves toxicity. Reduces abscesses and dissipates nodules. Disperses wind-heat. Clears Heart heat.$t$,
  $t$Sores, abscesses, scrofula. Wind-heat with fever, headache and sore throat. Irritability and delirium from heat entering the Pericardium. Painful urination from heat.$t$,
  $t$Not for Spleen and Stomach deficiency cold or open sores with clear pus.$t$,
  6, 15, null);

perform public.catalogue_upsert_herb('Pu Gong Ying','蒲公英','Taraxacum mongolicum (Herba)','Herba Taraxaci','Dandelion',
  'clear_heat_relieve_toxicity','cold','{bitter,sweet}','{liver,stomach}',
  $t$Clears heat and resolves toxicity. Reduces abscesses and dissipates nodules. Drains damp-heat. Promotes lactation.$t$,
  $t$Breast abscess and mastitis (principal herb). Sores, carbuncles, red eyes, sore throat. Damp-heat jaundice and painful urination. Insufficient lactation from obstruction.$t$,
  $t$Not for sores from cold or deficiency. Large doses can cause loose stools.$t$,
  9, 30, null);

perform public.catalogue_upsert_herb('Zi Hua Di Ding','紫花地丁','Viola yedoensis (Herba)','Herba Violae','Chinese violet',
  'clear_heat_relieve_toxicity','cold','{bitter,acrid}','{heart,liver}',
  $t$Clears heat and resolves toxicity. Reduces abscesses and swelling.$t$,
  $t$Deep-rooted sores, boils, carbuncles, breast abscess, snakebite. Red, swollen eyes.$t$,
  $t$Not for sores from deficiency cold.$t$,
  9, 15, 'Fresh herb crushed topically.');

perform public.catalogue_upsert_herb('Ye Ju Hua','野菊花','Chrysanthemum indicum (Flos)','Flos Chrysanthemi Indici','Wild chrysanthemum',
  'clear_heat_relieve_toxicity','slightly_cold','{bitter,acrid}','{lung,liver}',
  $t$Clears heat and resolves toxicity. Clears Liver fire and brightens the eyes.$t$,
  $t$Sores, boils, carbuncles, mumps, sore throat. Red, painful eyes; headache and dizziness from Liver fire. Hypertension.$t$,
  $t$Not for Spleen and Stomach deficiency cold.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Da Qing Ye','大青叶','Isatis indigotica (Folium)','Folium Isatidis','Isatis leaf',
  'clear_heat_relieve_toxicity','cold','{bitter}','{heart,lung,stomach}',
  $t$Clears heat and resolves toxicity. Cools the blood and reduces macules. Benefits the throat.$t$,
  $t$Warm disease with high fever, macules and rashes. Mumps, sore throat, mouth sores, erysipelas. Viral infections with heat toxin.$t$,
  $t$Not for Spleen and Stomach deficiency cold.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Ban Lan Gen','板蓝根','Isatis indigotica (Radix)','Radix Isatidis','Isatis root',
  'clear_heat_relieve_toxicity','cold','{bitter}','{heart,stomach}',
  $t$Clears heat and resolves toxicity. Cools the blood. Benefits the throat.$t$,
  $t$Warm disease with fever, sore and swollen throat, mumps, erysipelas, macules. Widely used for viral infections and influenza.$t$,
  $t$Not for Spleen and Stomach deficiency cold. Long-term use in the absence of heat is not appropriate.$t$,
  9, 15, 'Up to 30 g in acute infection.');

perform public.catalogue_upsert_herb('Qing Dai','青黛','Indigo naturalis (from Isatis or Baphicacanthus)','Indigo Naturalis','Natural indigo',
  'clear_heat_relieve_toxicity','cold','{salty}','{liver,lung,stomach}',
  $t$Clears heat and resolves toxicity. Cools the blood and reduces macules. Clears Liver fire and extinguishes wind. Clears Lung heat.$t$,
  $t$Macules, bleeding from heat, mumps, sore throat, mouth sores. Childhood convulsions from Liver fire. Cough with blood from Liver fire invading the Lung. Topical for eczema and psoriasis.$t$,
  $t$Not for Spleen and Stomach deficiency cold. Insoluble: take as powder or in capsules, not decocted.$t$,
  1.5, 3, 'Powder, swallowed with the decoction. Not decocted.');

perform public.catalogue_upsert_herb('Yu Xing Cao','鱼腥草','Houttuynia cordata (Herba)','Herba Houttuyniae','Houttuynia',
  'clear_heat_relieve_toxicity','slightly_cold','{acrid}','{lung}',
  $t$Clears heat and resolves toxicity. Reduces abscesses and expels pus. Drains dampness and promotes urination.$t$,
  $t$Lung abscess with foul sputum, Lung heat cough, pneumonia. Sores and abscesses. Damp-heat painful urination and diarrhea.$t$,
  $t$Not for cold-type sores. Volatile: add in the last few minutes of decoction.$t$,
  15, 30, 'Fresh: 30 to 60 g. Add at the end.');

perform public.catalogue_upsert_herb('Bai Hua She She Cao','白花蛇舌草','Hedyotis diffusa (Herba)','Herba Hedyotidis','Oldenlandia',
  'clear_heat_relieve_toxicity','cold','{bitter,sweet}','{stomach,large_intestine,small_intestine}',
  $t$Clears heat and resolves toxicity. Reduces abscesses. Drains dampness and promotes urination.$t$,
  $t$Intestinal abscess, sores, snakebite, sore throat. Damp-heat jaundice and painful urination. Used adjunctively in oncology for heat-toxin patterns.$t$,
  $t$Not for deficiency cold. Pregnancy caution.$t$,
  15, 60, null);

perform public.catalogue_upsert_herb('Chuan Xin Lian','穿心莲','Andrographis paniculata (Herba)','Herba Andrographis','Andrographis',
  'clear_heat_relieve_toxicity','cold','{bitter}','{lung,stomach,large_intestine,small_intestine}',
  $t$Clears heat and resolves toxicity. Dries dampness. Reduces swelling.$t$,
  $t$Lung heat cough, sore throat, mouth sores. Damp-heat dysentery and painful urination. Snakebite and sores (topical).$t$,
  $t$Extremely bitter; injures the Stomach in overdose. Not for Spleen and Stomach deficiency cold. Often given as pills or powder to avoid the taste.$t$,
  6, 9, 'Powder 0.6 to 1.2 g.');

perform public.catalogue_upsert_herb('She Gan','射干','Belamcanda chinensis (Rhizoma)','Rhizoma Belamcandae','Blackberry lily rhizome',
  'clear_heat_relieve_toxicity','cold','{bitter}','{lung}',
  $t$Clears heat and resolves toxicity. Benefits the throat. Transforms phlegm and disperses nodules.$t$,
  $t$Sore, swollen, obstructed throat. Cough and wheezing with copious phlegm. Scrofula.$t$,
  $t$Contraindicated in pregnancy. Not for Spleen deficiency with loose stools.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Shan Dou Gen','山豆根','Sophora tonkinensis (Radix)','Radix Sophorae Tonkinensis','Sophora subprostrata root',
  'clear_heat_relieve_toxicity','cold','{bitter}','{lung,stomach}',
  $t$Clears heat and resolves toxicity. Benefits the throat and reduces swelling.$t$,
  $t$Severe sore, swollen throat from fire toxin. Gum swelling and toothache. Sores and abscesses.$t$,
  $t$Slightly toxic: overdose causes nausea, vomiting and dizziness. Keep within range. Not for Spleen and Stomach deficiency cold.$t$,
  3, 6, 'Do not exceed 6 g.');

perform public.catalogue_upsert_herb('Ma Bo','马勃','Lasiosphaera fenzlii or Calvatia (Fructificatio)','Lasiosphaera seu Calvatia','Puffball',
  'clear_heat_relieve_toxicity','neutral','{acrid}','{lung}',
  $t$Clears Lung heat and benefits the throat. Stops bleeding.$t$,
  $t$Sore throat and hoarseness from Lung heat. Coughing blood, nosebleed. Topical for traumatic bleeding.$t$,
  $t$Decoct in a cloth bag. Not for sore throat from wind-cold.$t$,
  1.5, 6, 'Decoct in a bag.');

perform public.catalogue_upsert_herb('Bai Tou Weng','白头翁','Pulsatilla chinensis (Radix)','Radix Pulsatillae','Pulsatilla root',
  'clear_heat_relieve_toxicity','cold','{bitter}','{large_intestine,stomach}',
  $t$Clears heat and resolves toxicity. Cools the blood and stops dysentery.$t$,
  $t$Heat-toxin dysentery with blood and pus, tenesmus; amoebic dysentery. Damp-heat leukorrhea.$t$,
  $t$Not for dysentery or diarrhea from deficiency cold.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Ma Chi Xian','马齿苋','Portulaca oleracea (Herba)','Herba Portulacae','Purslane',
  'clear_heat_relieve_toxicity','cold','{sour}','{large_intestine,liver}',
  $t$Clears heat and resolves toxicity. Cools the blood and stops bleeding. Stops dysentery.$t$,
  $t$Damp-heat or heat-toxin dysentery with blood. Bloody uterine bleeding, blood in the stool. Sores, erysipelas, snakebite (topical).$t$,
  $t$Contraindicated in pregnancy. Not for diarrhea from Spleen deficiency cold.$t$,
  9, 15, 'Fresh: 30 to 60 g.');

perform public.catalogue_upsert_herb('Tu Fu Ling','土茯苓','Smilax glabra (Rhizoma)','Rhizoma Smilacis Glabrae','Smilax, glabrous greenbrier',
  'clear_heat_relieve_toxicity','neutral','{sweet,bland}','{liver,stomach}',
  $t$Resolves toxicity and eliminates dampness. Benefits the joints. Resolves mercury toxicity.$t$,
  $t$Damp-heat skin lesions, syphilis, damp-heat leukorrhea, painful urination. Joint pain from damp-heat. Mercury poisoning.$t$,
  $t$Not for yin deficiency. Traditionally not taken with tea.$t$,
  15, 60, null);

perform public.catalogue_upsert_herb('Bai Jiang Cao','败酱草','Patrinia scabiosifolia (Herba)','Herba Patriniae','Patrinia',
  'clear_heat_relieve_toxicity','slightly_cold','{acrid,bitter}','{stomach,large_intestine,liver}',
  $t$Clears heat and resolves toxicity. Expels pus. Dispels blood stasis and alleviates pain.$t$,
  $t$Intestinal abscess (appendicitis), Lung abscess. Sores and abscesses. Postpartum abdominal pain from stasis.$t$,
  $t$Not for Spleen and Stomach deficiency cold. Strong odor.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Ban Bian Lian','半边莲','Lobelia chinensis (Herba)','Herba Lobeliae Chinensis','Chinese lobelia',
  'clear_heat_relieve_toxicity','cold','{acrid}','{heart,small_intestine,lung}',
  $t$Clears heat and resolves toxicity. Promotes urination and reduces edema.$t$,
  $t$Snakebite, sores, boils. Ascites and edema. Damp-heat jaundice.$t$,
  $t$Not for deficiency edema.$t$,
  9, 15, 'Fresh: 30 to 60 g.');

perform public.catalogue_upsert_herb('Shan Ci Gu','山慈菇','Cremastra appendiculata (Pseudobulbus)','Pseudobulbus Cremastrae','Cremastra pseudobulb',
  'clear_heat_relieve_toxicity','cool','{sweet,acrid}','{liver,stomach}',
  $t$Clears heat and resolves toxicity. Dissipates nodules and reduces swelling.$t$,
  $t$Sores, carbuncles, snakebite. Scrofula, goiter, tumors and masses (adjunctive).$t$,
  $t$Slightly toxic: do not overdose or use long-term. Not for deficiency.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Ya Dan Zi','鸦胆子','Brucea javanica (Fructus)','Fructus Bruceae','Brucea fruit',
  'clear_heat_relieve_toxicity','cold','{bitter}','{large_intestine,liver}',
  $t$Clears heat and resolves toxicity. Stops dysentery. Treats malaria. Corrodes warts topically.$t$,
  $t$Amoebic dysentery, chronic dysentery. Malaria. Warts and corns (topical).$t$,
  $t$Toxic: take the kernels in capsules or wrapped in longan flesh, never decocted; 10 to 15 seeds per dose, short course. Not for children, pregnancy, or gastrointestinal bleeding.$t$,
  0.5, 2, 'Capsules only. Not decocted.');

perform public.catalogue_upsert_herb('Chong Lou','重楼','Paris polyphylla (Rhizoma)','Rhizoma Paridis','Paris rhizome',
  'clear_heat_relieve_toxicity','slightly_cold','{bitter}','{liver}',
  $t$Clears heat and resolves toxicity. Reduces swelling and alleviates pain. Calms the Liver and stops convulsions.$t$,
  $t$Sores, carbuncles, sore throat, snakebite. Trauma with swelling. Childhood convulsions from heat.$t$,
  $t$Slightly toxic: keep within range. Contraindicated in pregnancy. Also called Zao Xiu.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Lu Dou','绿豆','Vigna radiata (Semen)','Semen Phaseoli Radiati','Mung bean',
  'clear_heat_relieve_toxicity','cold','{sweet}','{heart,stomach}',
  $t$Clears heat and resolves toxicity. Clears summer-heat. Promotes urination.$t$,
  $t$Summer-heat with thirst and irritability. Sores and carbuncles. Poisoning from herbs (aconite, croton) or metals: as a first-aid decoction.$t$,
  $t$Not for Spleen and Stomach deficiency cold with diarrhea. May reduce the effect of warming herbs taken at the same time.$t$,
  15, 30, 'Up to 60 g for poisoning.');

-- ---------------------------------------------------------------------------
-- Clear deficiency heat
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Qing Hao','青蒿','Artemisia annua (Herba)','Herba Artemisiae Annuae','Sweet wormwood',
  'clear_deficient_heat','cold','{bitter,acrid}','{liver,gallbladder,kidney}',
  $t$Clears deficiency heat from yin deficiency. Cools the blood. Clears summer-heat. Treats malaria.$t$,
  $t$Steaming bone, night sweats and low-grade fever from yin deficiency; lingering fever after warm disease. Summer-heat with fever and headache. Malaria with alternating chills and fever.$t$,
  $t$Not for Spleen deficiency with diarrhea, or for postpartum blood deficiency. Add at the end of decoction; prolonged boiling destroys the active constituents.$t$,
  6, 12, 'Add at the end, or steep. Source of artemisinin.');

perform public.catalogue_upsert_herb('Di Gu Pi','地骨皮','Lycium chinense (Cortex radicis)','Cortex Lycii','Lycium root bark',
  'clear_deficient_heat','cold','{sweet,bland}','{lung,liver,kidney}',
  $t$Clears deficiency heat and reduces steaming bone. Clears Lung heat. Cools the blood. Generates fluids.$t$,
  $t$Steaming bone, night sweats and irritability from yin deficiency. Cough and wheezing from Lung heat. Bleeding from blood heat. Wasting-thirst.$t$,
  $t$Not for exterior wind-cold or Spleen deficiency with loose stools.$t$,
  6, 15, null);

perform public.catalogue_upsert_herb('Yin Chai Hu','银柴胡','Stellaria dichotoma (Radix)','Radix Stellariae','Stellaria root',
  'clear_deficient_heat','slightly_cold','{sweet}','{liver,stomach}',
  $t$Clears deficiency heat. Reduces childhood nutritional impairment fever.$t$,
  $t$Steaming bone and low-grade fever from yin deficiency. Fever with emaciation in childhood nutritional impairment.$t$,
  $t$Not for exterior patterns or blood deficiency without heat.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Hu Huang Lian','胡黄连','Picrorhiza scrophulariiflora (Rhizoma)','Rhizoma Picrorhizae','Picrorhiza rhizome',
  'clear_deficient_heat','cold','{bitter}','{heart,liver,stomach,large_intestine}',
  $t$Clears deficiency heat. Reduces childhood nutritional impairment fever. Clears damp-heat.$t$,
  $t$Steaming bone and night sweats. Fever, abdominal distention and emaciation in childhood nutritional impairment. Damp-heat dysentery and hemorrhoids.$t$,
  $t$Not for Spleen and Stomach deficiency cold. Very bitter.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Bai Wei','白薇','Cynanchum atratum (Radix)','Radix Cynanchi Atrati','Cynanchum, blackend swallowwort root',
  'clear_deficient_heat','cold','{bitter,salty}','{stomach,liver,kidney}',
  $t$Clears heat and cools the blood. Clears deficiency heat. Promotes urination and resolves painful urination. Resolves toxicity.$t$,
  $t$Lingering low-grade fever after warm disease; postpartum fever from yin deficiency. Painful, bloody urination from heat. Sores and snakebite.$t$,
  $t$Not for Spleen deficiency with loose stools or cold from deficiency.$t$,
  6, 12, null);

-- ---------------------------------------------------------------------------
-- Clear summer heat
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('He Ye','荷叶','Nelumbo nucifera (Folium)','Folium Nelumbinis','Lotus leaf',
  'clear_summer_heat','neutral','{bitter}','{liver,spleen,stomach}',
  $t$Clears summer-heat and resolves dampness. Raises the clear yang of the Spleen. Charred, it stops bleeding.$t$,
  $t$Summer-heat with thirst, diarrhea, poor appetite. Dizziness from clear yang failing to rise. Charred for bleeding from the uterus or stool. Used in weight-management formulas.$t$,
  $t$Not for deficiency cold without summer-heat.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Xi Gua Pi','西瓜皮','Citrullus lanatus (Exocarpium)','Exocarpium Citrulli','Watermelon rind',
  'clear_summer_heat','cold','{sweet}','{heart,stomach,bladder}',
  $t$Clears summer-heat and relieves irritability and thirst. Promotes urination.$t$,
  $t$Summer-heat with fever, thirst, scanty urine. Edema. Mouth sores.$t$,
  $t$Not for Spleen and Stomach deficiency cold.$t$,
  15, 30, null);

perform public.catalogue_upsert_herb('Bai Bian Dou','白扁豆','Lablab purpureus (Semen)','Semen Lablab Album','Hyacinth bean',
  'clear_summer_heat','slightly_warm','{sweet}','{spleen,stomach}',
  $t$Strengthens the Spleen and transforms dampness. Clears summer-heat and harmonizes the middle.$t$,
  $t$Summer-heat with vomiting, diarrhea and poor appetite. Chronic loose stools and leukorrhea from Spleen deficiency with dampness.$t$,
  $t$Cook thoroughly: raw beans are mildly toxic. Gentle; suitable for children and the elderly.$t$,
  9, 15, 'Dry-fried to strengthen the Spleen.');

end
$seed$;
