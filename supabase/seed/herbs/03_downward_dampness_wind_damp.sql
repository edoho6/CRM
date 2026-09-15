-- ============================================================================
-- Materia medica · 03 · Downward draining, drain dampness, dispel wind-dampness
-- ============================================================================
-- See 01 for conventions. Several herbs in this file are toxic or regulated;
-- their cautions state the limits plainly.
-- ============================================================================

do $seed$
begin

-- ---------------------------------------------------------------------------
-- Downward draining: purgatives
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Da Huang','大黄','Rheum palmatum (Radix et Rhizoma)','Radix et Rhizoma Rhei','Chinese rhubarb root',
  'downward_draining','cold','{bitter}','{spleen,stomach,large_intestine,liver,heart}',
  $t$Drains heat and purges accumulation. Drains fire and resolves toxicity. Invigorates the blood and dispels stasis. Clears damp-heat and relieves jaundice. Charred, it stops bleeding.$t$,
  $t$Constipation with heat, abdominal fullness, high fever and delirium. Red eyes, sore throat, mouth sores, sores and burns from fire toxin. Amenorrhea, abdominal masses and trauma from stasis. Damp-heat jaundice and dysentery. Bleeding from heat.$t$,
  $t$Contraindicated in pregnancy, menstruation and breastfeeding. Not for Spleen deficiency or exterior patterns. For purgation add in the last 5 minutes; longer cooking weakens the laxative effect. Wine-fried for stasis; charred for bleeding.$t$,
  3, 15, 'Add at the end for purgation; steeped for strongest effect.');

perform public.catalogue_upsert_herb('Mang Xiao','芒硝','Natrii sulfas (mineral)','Natrii Sulfas','Mirabilite, sodium sulfate',
  'downward_draining','cold','{salty,bitter}','{stomach,large_intestine}',
  $t$Purges accumulation and softens hardness. Clears heat. Topically reduces swelling and dissipates nodules.$t$,
  $t$Constipation with dry, hard stool and heat. Topical for breast abscess, sore throat, mouth sores, hemorrhoids.$t$,
  $t$Contraindicated in pregnancy. Not for Spleen and Stomach deficiency cold. Dissolve in the strained decoction; do not boil.$t$,
  6, 15, 'Dissolve in the finished decoction. Xuan Ming Fen is the refined form.');

perform public.catalogue_upsert_herb('Fan Xie Ye','番泻叶','Senna alexandrina (Folium)','Folium Sennae','Senna leaf',
  'downward_draining','cold','{sweet,bitter}','{large_intestine}',
  $t$Purges heat accumulation and unblocks the bowels.$t$,
  $t$Constipation with heat, abdominal fullness. Also used in small doses for habitual constipation.$t$,
  $t$Contraindicated in pregnancy, menstruation and breastfeeding. Not for chronic use: dependence and cramping. Steep rather than boil.$t$,
  1.5, 6, 'Steep in hot water; 1.5 to 3 g for a mild effect.');

perform public.catalogue_upsert_herb('Lu Hui','芦荟','Aloe vera or A. ferox (concentrated juice)','Aloe','Aloe',
  'downward_draining','cold','{bitter}','{liver,large_intestine}',
  $t$Purges heat and unblocks the bowels. Clears Liver fire. Kills parasites.$t$,
  $t$Constipation with Liver fire, headache, dizziness, irritability. Childhood nutritional impairment with parasites.$t$,
  $t$Contraindicated in pregnancy. Not for Spleen and Stomach deficiency cold. Taken in pills or powder, not decocted.$t$,
  1, 2, 'Pills or powder only.');

-- ---------------------------------------------------------------------------
-- Moist laxatives
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Huo Ma Ren','火麻仁','Cannabis sativa (Semen, heat-treated)','Semen Cannabis','Hemp seed',
  'moist_laxative','neutral','{sweet}','{spleen,stomach,large_intestine}',
  $t$Moistens the intestines and unblocks the bowels. Nourishes yin.$t$,
  $t$Constipation from dryness in the elderly, postpartum or after febrile disease. Constipation with blood deficiency.$t$,
  $t$Sold heat-treated (non-viable); legal status varies by country. Crush before decocting. Not for diarrhea.$t$,
  9, 15, 'Crush before use.');

perform public.catalogue_upsert_herb('Yu Li Ren','郁李仁','Prunus japonica (Semen)','Semen Pruni','Bush cherry pit',
  'moist_laxative','neutral','{acrid,bitter,sweet}','{spleen,large_intestine,small_intestine}',
  $t$Moistens the intestines and unblocks the bowels. Promotes urination and reduces edema.$t$,
  $t$Constipation from dryness with qi stagnation. Edema, abdominal distention, dysuria.$t$,
  $t$Contraindicated in pregnancy. Not for yin deficiency with depleted fluids.$t$,
  6, 12, 'Crush before use.');

perform public.catalogue_upsert_herb('Song Zi Ren','松子仁','Pinus koraiensis (Semen)','Semen Pini Koraiensis','Pine nut',
  'moist_laxative','warm','{sweet}','{lung,liver,large_intestine}',
  $t$Moistens the Lung and stops cough. Moistens the intestines and unblocks the bowels.$t$,
  $t$Dry cough. Constipation from dryness or blood deficiency. Dizziness from deficiency.$t$,
  $t$Not for loose stools or phlegm-damp.$t$,
  5, 10, null);

-- ---------------------------------------------------------------------------
-- Harsh expellants (all toxic; specialist use)
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Gan Sui','甘遂','Euphorbia kansui (Radix)','Radix Kansui','Kansui root',
  'harsh_expellant','cold','{bitter,sweet}','{lung,kidney,large_intestine}',
  $t$Drives out water through the stool and urine. Drives out phlegm. Topically reduces swelling.$t$,
  $t$Severe edema, ascites, pleural effusion with a strong constitution. Phlegm obstruction with mania. Topical for sores.$t$,
  $t$Toxic. Contraindicated in pregnancy and in weak patients. Taken only as vinegar-processed pills or powder, never decocted. Incompatible with Gan Cao. Specialist use.$t$,
  0.5, 1.5, 'Pills or powder only; vinegar-processed.');

perform public.catalogue_upsert_herb('Jing Da Ji','京大戟','Euphorbia pekinensis (Radix)','Radix Euphorbiae Pekinensis','Peking spurge root',
  'harsh_expellant','cold','{bitter,acrid}','{lung,kidney,large_intestine}',
  $t$Drives out water through the stool and urine. Dissipates nodules and reduces swelling.$t$,
  $t$Severe edema, ascites, pleural effusion. Scrofula and phlegm nodules. Topical for sores.$t$,
  $t$Toxic. Contraindicated in pregnancy and in weak patients. Incompatible with Gan Cao. Vinegar-processed; specialist use.$t$,
  1.5, 3, 'Powder 1 g. Vinegar-processed.');

perform public.catalogue_upsert_herb('Yuan Hua','芫花','Daphne genkwa (Flos)','Flos Genkwa','Genkwa flower',
  'harsh_expellant','warm','{acrid,bitter}','{lung,kidney,large_intestine}',
  $t$Drives out water and phlegm. Kills parasites topically.$t$,
  $t$Severe edema, ascites, pleural effusion, cough with copious thin sputum. Topical for scabies and scalp sores.$t$,
  $t$Toxic. Contraindicated in pregnancy and in weak patients. Incompatible with Gan Cao. Vinegar-processed; specialist use.$t$,
  1.5, 3, 'Powder 0.6 g. Vinegar-processed.');

perform public.catalogue_upsert_herb('Qian Niu Zi','牵牛子','Pharbitis nil (Semen)','Semen Pharbitidis','Morning glory seed',
  'harsh_expellant','cold','{bitter,acrid}','{lung,kidney,large_intestine}',
  $t$Drives out water. Purges accumulation. Drives out phlegm. Kills parasites.$t$,
  $t$Edema and ascites with constipation. Food stagnation with constipation. Wheezing with phlegm. Roundworm and tapeworm with abdominal pain.$t$,
  $t$Toxic. Contraindicated in pregnancy. Not for weak patients. Incompatible with Ba Dou. Powder is stronger than decoction.$t$,
  3, 6, 'Powder 1.5 to 3 g.');

perform public.catalogue_upsert_herb('Ba Dou','巴豆','Croton tiglium (Fructus, defatted)','Fructus Crotonis Pulveratus','Croton seed',
  'harsh_expellant','hot','{acrid}','{stomach,large_intestine,lung}',
  $t$Purges cold accumulation. Drives out water. Drives out phlegm and opens the throat. Corrodes sores topically.$t$,
  $t$Cold accumulation with severe constipation and abdominal pain. Ascites. Phlegm obstruction of the throat in children. Topical for abscesses.$t$,
  $t$Extremely toxic. Only the defatted powder (Ba Dou Shuang) is used, in pills, at 0.1 to 0.3 g. Contraindicated in pregnancy and in all but robust patients. Incompatible with Qian Niu Zi. Do not take with hot liquids. Specialist use only.$t$,
  0.1, 0.3, 'Defatted powder in pills only.');

perform public.catalogue_upsert_herb('Shang Lu','商陆','Phytolacca acinosa (Radix)','Radix Phytolaccae','Pokeweed root',
  'harsh_expellant','cold','{bitter}','{lung,spleen,kidney,large_intestine}',
  $t$Drives out water through the stool and urine. Topically reduces swelling and dissipates nodules.$t$,
  $t$Edema, ascites and constipation with a strong constitution. Topical for sores and swellings.$t$,
  $t$Toxic. Contraindicated in pregnancy. Not for weak patients or edema from Spleen deficiency. Vinegar-processed.$t$,
  3, 9, 'Vinegar-processed.');

-- ---------------------------------------------------------------------------
-- Drain dampness
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Fu Ling','茯苓','Poria cocos (Sclerotium)','Poria','Poria, hoelen',
  'drain_dampness','neutral','{sweet,bland}','{heart,spleen,kidney}',
  $t$Promotes urination and drains dampness. Strengthens the Spleen and harmonizes the middle. Calms the spirit.$t$,
  $t$Edema, difficult urination, phlegm-damp. Spleen deficiency with poor appetite, loose stools, fatigue. Palpitations, insomnia and forgetfulness from Heart-Spleen deficiency.$t$,
  $t$Not for yin deficiency without dampness. Gentle; the most widely used damp-draining herb.$t$,
  9, 15, 'Fu Ling Pi (peel) for edema; Fu Shen (with root) to calm the spirit; Chi Fu Ling for damp-heat.');

perform public.catalogue_upsert_herb('Zhu Ling','猪苓','Polyporus umbellatus (Sclerotium)','Polyporus','Polyporus',
  'drain_dampness','neutral','{sweet,bland}','{kidney,bladder}',
  $t$Promotes urination and drains dampness.$t$,
  $t$Edema, scanty urination, diarrhea, cloudy urine, leukorrhea from dampness. Stronger diuretic than Fu Ling but does not tonify.$t$,
  $t$Not for absence of dampness; prolonged use injures yin.$t$,
  6, 12, null);

perform public.catalogue_upsert_herb('Ze Xie','泽泻','Alisma orientale (Rhizoma)','Rhizoma Alismatis','Water plantain rhizome',
  'drain_dampness','cold','{sweet,bland}','{kidney,bladder}',
  $t$Promotes urination and drains dampness. Drains Kidney fire and clears deficiency heat. Reduces turbid lipids.$t$,
  $t$Edema, scanty urination, diarrhea, dizziness from phlegm-damp. Painful urination from damp-heat. Steaming bone from Kidney yin deficiency with fire (in Liu Wei Di Huang Wan). Hyperlipidemia.$t$,
  $t$Not for Kidney yang deficiency with spermatorrhea, or absence of dampness.$t$,
  6, 12, 'Salt-fried to enter the Kidney.');

perform public.catalogue_upsert_herb('Yi Yi Ren','薏苡仁','Coix lacryma-jobi (Semen)','Semen Coicis','Job''s tears, coix seed',
  'drain_dampness','slightly_cold','{sweet,bland}','{spleen,stomach,lung}',
  $t$Promotes urination and drains dampness. Strengthens the Spleen and stops diarrhea. Clears heat and expels pus. Relaxes the sinews and relieves damp bi.$t$,
  $t$Edema, difficult urination, diarrhea from Spleen deficiency with dampness. Lung abscess, intestinal abscess. Damp bi with cramping and limited movement. Warts (large doses).$t$,
  $t$Use cautiously in pregnancy (large doses). Slow-acting: use large doses and long courses. Also eaten as a food.$t$,
  9, 30, 'Raw to clear heat; dry-fried to strengthen the Spleen.');

perform public.catalogue_upsert_herb('Che Qian Zi','车前子','Plantago asiatica (Semen)','Semen Plantaginis','Plantain seed',
  'drain_dampness','cold','{sweet}','{kidney,liver,lung,small_intestine}',
  $t$Promotes urination and clears damp-heat. Stops diarrhea by separating clear from turbid. Clears the Liver and brightens the eyes. Expels phlegm and stops cough.$t$,
  $t$Painful, hot urination, edema. Watery diarrhea, especially summer diarrhea. Red, painful eyes; cataract from Liver heat. Cough with copious sputum.$t$,
  $t$Not for Kidney deficiency with spermatorrhea. Decoct in a cloth bag.$t$,
  9, 15, 'Decoct in a bag. Che Qian Cao (whole herb) also cools blood.');

perform public.catalogue_upsert_herb('Hua Shi','滑石','Talcum (mineral, hydrated magnesium silicate)','Talcum','Talc',
  'drain_dampness','cold','{sweet,bland}','{stomach,bladder}',
  $t$Promotes urination and clears damp-heat. Clears summer-heat. Topically absorbs dampness.$t$,
  $t$Painful, hot, difficult urination; urinary stones. Summer-heat with thirst and diarrhea (Liu Yi San). Topical for eczema and prickly heat.$t$,
  $t$Contraindicated in pregnancy. Not for Spleen deficiency, or urinary problems from Kidney deficiency. Decoct in a cloth bag.$t$,
  9, 15, 'Decoct in a bag.');

perform public.catalogue_upsert_herb('Mu Tong','木通','Akebia quinata or A. trifoliata (Caulis)','Caulis Akebiae','Akebia stem',
  'drain_dampness','cold','{bitter}','{heart,small_intestine,bladder}',
  $t$Promotes urination and clears damp-heat. Drains Heart fire through the Small Intestine. Promotes lactation. Unblocks the channels.$t$,
  $t$Painful, hot urination, edema. Mouth and tongue sores with irritability. Insufficient lactation. Damp-heat bi.$t$,
  $t$Use only Akebia (or Chuan Mu Tong, Clematis). Guan Mu Tong (Aristolochia manshuriensis) is nephrotoxic and banned; verify the source. Contraindicated in pregnancy. Not for absence of damp-heat.$t$,
  3, 6, 'Verify botanical source: Akebia only.');

perform public.catalogue_upsert_herb('Tong Cao','通草','Tetrapanax papyrifer (Medulla)','Medulla Tetrapanacis','Rice paper plant pith',
  'drain_dampness','slightly_cold','{sweet,bland}','{lung,stomach}',
  $t$Promotes urination and clears heat. Promotes lactation.$t$,
  $t$Painful, hot urination, edema. Insufficient lactation.$t$,
  $t$Contraindicated in pregnancy. Not for absence of damp-heat. Very light: use a low weight.$t$,
  3, 6, null);

perform public.catalogue_upsert_herb('Bian Xu','萹蓄','Polygonum aviculare (Herba)','Herba Polygoni Avicularis','Knotweed',
  'drain_dampness','slightly_cold','{bitter}','{bladder}',
  $t$Promotes urination and clears damp-heat. Kills parasites and stops itching.$t$,
  $t$Painful, hot, bloody or stony urination. Damp-heat jaundice. Itchy skin lesions, vaginal itching (wash). Intestinal parasites.$t$,
  $t$Not for Spleen deficiency or absence of damp-heat.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Qu Mai','瞿麦','Dianthus superbus (Herba)','Herba Dianthi','Fringed pink',
  'drain_dampness','cold','{bitter}','{heart,small_intestine,bladder}',
  $t$Promotes urination and clears damp-heat. Invigorates the blood and unblocks menses.$t$,
  $t$Painful, bloody, stony urination. Amenorrhea from blood stasis with heat.$t$,
  $t$Contraindicated in pregnancy. Not for Spleen and Kidney deficiency.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Di Fu Zi','地肤子','Kochia scoparia (Fructus)','Fructus Kochiae','Kochia fruit',
  'drain_dampness','cold','{acrid,bitter}','{bladder}',
  $t$Clears damp-heat and promotes urination. Expels wind and stops itching.$t$,
  $t$Painful, hot urination. Eczema, urticaria, scabies, itchy damp skin lesions (internal and wash). Damp-heat leukorrhea.$t$,
  $t$Not for absence of damp-heat.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Hai Jin Sha','海金沙','Lygodium japonicum (Spora)','Spora Lygodii','Lygodium spores',
  'drain_dampness','cold','{sweet}','{bladder,small_intestine}',
  $t$Clears damp-heat and promotes urination. Expels stones and alleviates pain.$t$,
  $t$Painful, hot urination; urinary stones with pain; bloody urination.$t$,
  $t$Not for Kidney yin deficiency. Decoct in a cloth bag.$t$,
  6, 15, 'Decoct in a bag.');

perform public.catalogue_upsert_herb('Shi Wei','石韦','Pyrrosia lingua (Folium)','Folium Pyrrosiae','Pyrrosia leaf',
  'drain_dampness','slightly_cold','{bitter,sweet}','{lung,bladder}',
  $t$Promotes urination and clears damp-heat. Clears Lung heat and stops cough. Cools the blood and stops bleeding.$t$,
  $t$Painful, stony, bloody urination. Cough and wheezing from Lung heat. Bleeding from heat: hemoptysis, uterine bleeding.$t$,
  $t$Not for yin deficiency without damp-heat.$t$,
  6, 12, null);

perform public.catalogue_upsert_herb('Jin Qian Cao','金钱草','Lysimachia christinae (Herba)','Herba Lysimachiae','Lysimachia, coin grass',
  'drain_dampness','slightly_cold','{sweet,bland}','{liver,gallbladder,kidney,bladder}',
  $t$Promotes urination and expels stones. Clears damp-heat and relieves jaundice. Resolves toxicity and reduces swelling.$t$,
  $t$Urinary and biliary stones. Damp-heat jaundice, gallbladder inflammation. Sores, snakebite (topical).$t$,
  $t$Not for absence of damp-heat. Large doses and long courses for stones.$t$,
  15, 60, null);

perform public.catalogue_upsert_herb('Yin Chen Hao','茵陈蒿','Artemisia scoparia or A. capillaris (Herba)','Herba Artemisiae Scopariae','Capillaris, virgate wormwood',
  'drain_dampness','slightly_cold','{bitter,acrid}','{spleen,stomach,liver,gallbladder}',
  $t$Clears damp-heat and relieves jaundice. Clears heat and resolves toxicity.$t$,
  $t$Jaundice of all types (principal herb): damp-heat with Da Huang and Zhi Zi; cold-damp with Fu Zi and Gan Jiang. Damp-heat skin lesions. Gallbladder inflammation, hepatitis.$t$,
  $t$Not for jaundice from blood deficiency without dampness.$t$,
  9, 30, null);

perform public.catalogue_upsert_herb('Dong Gua Pi','冬瓜皮','Benincasa hispida (Exocarpium)','Exocarpium Benincasae','Winter melon peel',
  'drain_dampness','slightly_cold','{sweet}','{lung,small_intestine}',
  $t$Promotes urination and reduces edema. Clears summer-heat.$t$,
  $t$Edema, especially of the lower body; summer-heat with thirst and scanty urine.$t$,
  $t$Not for edema from yang deficiency. Dong Gua Zi (seed) clears Lung and intestinal abscess.$t$,
  15, 30, null);

perform public.catalogue_upsert_herb('Chi Xiao Dou','赤小豆','Vigna umbellata (Semen)','Semen Phaseoli','Rice bean, adzuki',
  'drain_dampness','neutral','{sweet,sour}','{heart,small_intestine}',
  $t$Promotes urination and reduces edema. Resolves toxicity and expels pus. Relieves jaundice.$t$,
  $t$Edema, ascites, beriberi. Sores and abscesses, intestinal abscess. Damp-heat jaundice.$t$,
  $t$Prolonged use injures fluids. Also eaten as a food.$t$,
  9, 30, null);

perform public.catalogue_upsert_herb('Bi Xie','萆薢','Dioscorea hypoglauca (Rhizoma)','Rhizoma Dioscoreae Hypoglaucae','Fish poison yam',
  'drain_dampness','neutral','{bitter}','{kidney,stomach,liver}',
  $t$Separates the clear from the turbid. Expels wind-dampness and relieves bi.$t$,
  $t$Cloudy, milky urine; leukorrhea. Wind-damp bi with lower back and knee pain.$t$,
  $t$Not for Kidney yin deficiency.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Deng Xin Cao','灯心草','Juncus effusus (Medulla)','Medulla Junci','Rush pith',
  'drain_dampness','slightly_cold','{sweet,bland}','{heart,lung,small_intestine}',
  $t$Promotes urination and clears heat. Clears Heart heat and calms the spirit.$t$,
  $t$Painful, hot urination. Irritability, night crying and insomnia in children from Heart heat. Mouth sores.$t$,
  $t$Gentle. Not for cold from deficiency. Very light: use a low weight.$t$,
  1, 3, 'Charred (Deng Xin Tan) for mouth sores, blown into the throat.');

-- ---------------------------------------------------------------------------
-- Dispel wind-dampness
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Du Huo','独活','Angelica pubescens (Radix)','Radix Angelicae Pubescentis','Pubescent angelica root',
  'dispel_wind_dampness','slightly_warm','{acrid,bitter}','{kidney,bladder}',
  $t$Dispels wind-dampness and alleviates pain, especially in the lower body. Releases the exterior. Reaches the shaoyin channel.$t$,
  $t$Wind-damp bi in the lower back, hips, knees and legs. Wind-cold-damp exterior patterns with body aches. Shaoyin headache reaching the teeth.$t$,
  $t$Not for yin or blood deficiency. Drying and warm.$t$,
  3, 9, 'Paired with Qiang Huo for whole-body pain.');

perform public.catalogue_upsert_herb('Wei Ling Xian','威灵仙','Clematis chinensis (Radix)','Radix Clematidis','Clematis root',
  'dispel_wind_dampness','warm','{acrid,salty}','{bladder}',
  $t$Dispels wind-dampness, unblocks the channels and alleviates pain. Softens fish bones lodged in the throat.$t$,
  $t$Wind-damp bi anywhere in the body with pain, numbness and limited movement. Fish bone in the throat (decoct alone, sip slowly).$t$,
  $t$Not for qi and blood deficiency. Dispersing: not for long-term use.$t$,
  6, 9, 'Up to 15 g for fish bone.');

perform public.catalogue_upsert_herb('Qin Jiao','秦艽','Gentiana macrophylla (Radix)','Radix Gentianae Macrophyllae','Large-leaf gentian root',
  'dispel_wind_dampness','slightly_cold','{bitter,acrid}','{stomach,liver,gallbladder}',
  $t$Dispels wind-dampness and relaxes the sinews. Clears deficiency heat. Clears damp-heat and relieves jaundice.$t$,
  $t$Wind-damp bi, especially with heat; hemiplegia; cramping. Steaming bone and low-grade fever from yin deficiency. Damp-heat jaundice.$t$,
  $t$Not for loose stools or frequent urination. The gentlest wind-damp herb: does not injure yin.$t$,
  6, 9, null);

perform public.catalogue_upsert_herb('Sang Zhi','桑枝','Morus alba (Ramulus)','Ramulus Mori','Mulberry twig',
  'dispel_wind_dampness','neutral','{bitter}','{liver}',
  $t$Dispels wind-dampness and benefits the joints. Unblocks the channels.$t$,
  $t$Wind-damp bi with joint pain, especially in the shoulders and arms. Numbness of the limbs. Edema.$t$,
  $t$Gentle and neutral; suitable for hot or cold bi.$t$,
  9, 30, null);

perform public.catalogue_upsert_herb('Mu Gua','木瓜','Chaenomeles speciosa (Fructus)','Fructus Chaenomelis','Chinese quince',
  'dispel_wind_dampness','warm','{sour}','{liver,spleen}',
  $t$Relaxes the sinews and unblocks the channels. Harmonizes the Stomach and transforms dampness.$t$,
  $t$Cramping and spasms of the calves, damp bi with heaviness, leg edema (beriberi). Vomiting and diarrhea with cramping from damp obstructing the middle.$t$,
  $t$Not for heat from deficiency or urinary difficulty from heat. Not for long-term use in excess.$t$,
  6, 9, null);

perform public.catalogue_upsert_herb('Hai Tong Pi','海桐皮','Erythrina variegata (Cortex)','Cortex Erythrinae','Erythrina bark',
  'dispel_wind_dampness','neutral','{bitter,acrid}','{liver,spleen}',
  $t$Dispels wind-dampness and unblocks the channels. Kills parasites and stops itching.$t$,
  $t$Wind-damp bi with pain and stiffness, especially in the lower back and knees. Scabies and eczema (wash).$t$,
  $t$Not for blood deficiency.$t$,
  6, 12, null);

perform public.catalogue_upsert_herb('Xi Xian Cao','豨莶草','Siegesbeckia orientalis (Herba)','Herba Siegesbeckiae','Siegesbeckia',
  'dispel_wind_dampness','cold','{bitter}','{liver,kidney}',
  $t$Dispels wind-dampness and unblocks the channels. Clears heat and resolves toxicity. Lowers blood pressure.$t$,
  $t$Wind-damp bi with numbness and weakness; hemiplegia. Sores and eczema. Hypertension with dizziness.$t$,
  $t$Not for absence of wind-damp. Raw clears heat; wine-steamed tonifies and warms.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Chou Wu Tong','臭梧桐','Clerodendrum trichotomum (Folium)','Folium Clerodendri','Harlequin glorybower leaf',
  'dispel_wind_dampness','cool','{acrid,bitter,sweet}','{liver}',
  $t$Dispels wind-dampness and unblocks the channels. Calms the Liver and lowers blood pressure.$t$,
  $t$Wind-damp bi with numbness. Hypertension with headache and dizziness (with Xi Xian Cao).$t$,
  $t$Do not decoct for long when treating hypertension.$t$,
  6, 15, null);

perform public.catalogue_upsert_herb('Luo Shi Teng','络石藤','Trachelospermum jasminoides (Caulis)','Caulis Trachelospermi','Star jasmine stem',
  'dispel_wind_dampness','slightly_cold','{bitter}','{heart,liver}',
  $t$Dispels wind-dampness and unblocks the channels. Cools the blood and reduces swelling.$t$,
  $t$Wind-damp bi with heat, spasms of the sinews. Sore throat, sores and abscesses.$t$,
  $t$Not for cold from yang deficiency.$t$,
  6, 15, null);

perform public.catalogue_upsert_herb('Sang Ji Sheng','桑寄生','Taxillus chinensis (Herba)','Herba Taxilli','Mulberry mistletoe',
  'dispel_wind_dampness','neutral','{bitter,sweet}','{liver,kidney}',
  $t$Dispels wind-dampness. Tonifies the Liver and Kidney and strengthens the sinews and bones. Calms the fetus. Lowers blood pressure.$t$,
  $t$Chronic bi with weak, sore lower back and knees. Threatened miscarriage, restless fetus, uterine bleeding in pregnancy from Liver-Kidney deficiency. Hypertension.$t$,
  $t$Gentle; suitable for deficiency patterns.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Wu Jia Pi','五加皮','Acanthopanax gracilistylus (Cortex radicis)','Cortex Acanthopanacis','Acanthopanax root bark',
  'dispel_wind_dampness','warm','{acrid,bitter}','{liver,kidney}',
  $t$Dispels wind-dampness. Strengthens the sinews and bones. Promotes urination and reduces edema.$t$,
  $t$Wind-damp bi with weakness of the lower back and legs; delayed walking in children. Edema and beriberi.$t$,
  $t$Not for yin deficiency with heat. Verify the source: Xiang Jia Pi (Periploca) is cardiotoxic and sometimes substituted.$t$,
  6, 9, 'Verify botanical source.');

perform public.catalogue_upsert_herb('Shen Jin Cao','伸筋草','Lycopodium japonicum (Herba)','Herba Lycopodii','Club moss',
  'dispel_wind_dampness','warm','{bitter,acrid}','{liver,spleen,kidney}',
  $t$Dispels wind-dampness and relaxes the sinews. Unblocks the channels.$t$,
  $t$Wind-damp bi with stiffness and limited movement; sequelae of trauma; hemiplegia.$t$,
  $t$Contraindicated in pregnancy.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Qian Nian Jian','千年健','Homalomena occulta (Rhizoma)','Rhizoma Homalomenae','Homalomena rhizome',
  'dispel_wind_dampness','warm','{acrid,bitter}','{liver,kidney}',
  $t$Dispels wind-dampness and strengthens the sinews and bones.$t$,
  $t$Wind-cold-damp bi with weak lower back and knees, especially in the elderly.$t$,
  $t$Not for yin deficiency with heat.$t$,
  6, 9, null);

perform public.catalogue_upsert_herb('Hai Feng Teng','海风藤','Piper kadsura (Caulis)','Caulis Piperis Kadsurae','Kadsura pepper stem',
  'dispel_wind_dampness','slightly_warm','{acrid,bitter}','{liver}',
  $t$Dispels wind-dampness, unblocks the channels and alleviates pain.$t$,
  $t$Wind-damp bi with pain, stiffness and spasms of the sinews.$t$,
  $t$Not for yin deficiency with heat.$t$,
  6, 12, null);

perform public.catalogue_upsert_herb('Wu Shao She','乌梢蛇','Zaocys dhumnades (whole body)','Zaocys','Black-striped snake',
  'dispel_wind_dampness','neutral','{sweet}','{liver}',
  $t$Dispels wind, unblocks the channels and stops spasms.$t$,
  $t$Chronic wind-damp bi with numbness, hemiplegia. Tetanus, convulsions. Chronic itchy skin diseases, leprosy.$t$,
  $t$Animal product. Not for blood deficiency without wind.$t$,
  6, 12, 'Powder 2 to 3 g.');

perform public.catalogue_upsert_herb('Qi She','蕲蛇','Agkistrodon acutus (whole body)','Agkistrodon','Long-nosed pit viper',
  'dispel_wind_dampness','warm','{sweet,salty}','{liver}',
  $t$Dispels wind, unblocks the channels and stops spasms. Attacks toxin.$t$,
  $t$Severe chronic bi with deformity, hemiplegia, facial paralysis. Tetanus, convulsions. Leprosy, severe itching.$t$,
  $t$Toxic and an animal product; regulated. Not for blood deficiency without wind. Powder in small doses.$t$,
  3, 9, 'Powder 1 to 1.5 g.');

perform public.catalogue_upsert_herb('Han Fang Ji','汉防己','Stephania tetrandra (Radix)','Radix Stephaniae Tetrandrae','Stephania root',
  'dispel_wind_dampness','cold','{bitter,acrid}','{bladder,kidney,spleen}',
  $t$Dispels wind-dampness and alleviates pain. Promotes urination and reduces edema.$t$,
  $t$Hot wind-damp bi with painful, swollen joints. Edema of the lower body, ascites, beriberi. Hypertension.$t$,
  $t$Use only Stephania. Guang Fang Ji (Aristolochia fangchi) is nephrotoxic and banned; verify the source. Not for yin deficiency, or absence of dampness.$t$,
  3, 9, 'Verify botanical source: Stephania only.');

end
$seed$;
