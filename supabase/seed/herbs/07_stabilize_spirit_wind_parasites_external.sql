-- ============================================================================
-- Materia medica · 07 · Stabilize and bind, calm the spirit, open the orifices,
--                      extinguish wind, expel parasites, external application
-- ============================================================================
-- See 01 for conventions. Deliberately absent: She Xiang (musk) and Ling Yang
-- Jiao (saiga horn), both CITES-listed; Xiong Huang (realgar, arsenic) and Qing
-- Fen (calomel, mercury), both heavy-metal toxins.
-- ============================================================================

do $seed$
begin

-- ---------------------------------------------------------------------------
-- Stabilize and bind
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Wu Wei Zi','五味子','Schisandra chinensis (Fructus)','Fructus Schisandrae','Schisandra berry',
  'stabilize_bind','warm','{sour,sweet}','{lung,heart,kidney}',
  $t$Astringes the Lung and stops cough. Tonifies the Kidney and secures essence. Stops sweating. Generates fluids. Calms the spirit.$t$,
  $t$Chronic cough and wheezing from Lung and Kidney deficiency. Spermatorrhea, enuresis, chronic diarrhea. Spontaneous and night sweats. Thirst, wasting-thirst. Palpitations, insomnia, dream-disturbed sleep.$t$,
  $t$Not for exterior patterns, excess heat, or cough in its early stage. Crush before decocting.$t$,
  3, 6, 'Crush before use.');

perform public.catalogue_upsert_herb('Wu Mei','乌梅','Prunus mume (Fructus)','Fructus Mume','Smoked plum',
  'stabilize_bind','neutral','{sour,astringent}','{liver,spleen,lung,large_intestine}',
  $t$Astringes the Lung and stops cough. Astringes the intestines and stops diarrhea. Generates fluids and alleviates thirst. Calms roundworms. Topically corrodes warts.$t$,
  $t$Chronic cough from Lung deficiency. Chronic diarrhea and dysentery. Thirst, wasting-thirst. Roundworm abdominal pain and vomiting (Wu Mei Wan). Warts and corns (topical).$t$,
  $t$Not for exterior patterns or excess heat. Charred (Wu Mei Tan) for bleeding.$t$,
  3, 9, 'Up to 30 g for roundworms.');

perform public.catalogue_upsert_herb('Shan Zhu Yu','山茱萸','Cornus officinalis (Fructus)','Fructus Corni','Asiatic cornelian cherry',
  'stabilize_bind','slightly_warm','{sour,astringent}','{liver,kidney}',
  $t$Tonifies the Liver and Kidney. Secures essence and reduces urination. Stops sweating and rescues collapse. Stops uterine bleeding.$t$,
  $t$Dizziness, weak lower back, impotence, spermatorrhea, frequent urination from Liver and Kidney deficiency (Liu Wei Di Huang Wan). Profuse sweating and collapse (large doses). Uterine bleeding and heavy menses from deficiency.$t$,
  $t$Not for damp-heat or painful urination.$t$,
  6, 12, 'Up to 30 g for collapse with sweating.');

perform public.catalogue_upsert_herb('Fu Pen Zi','覆盆子','Rubus chingii (Fructus)','Fructus Rubi','Chinese raspberry',
  'stabilize_bind','slightly_warm','{sweet,sour}','{liver,kidney}',
  $t$Tonifies the Kidney and secures essence. Reduces urination. Brightens the eyes.$t$,
  $t$Spermatorrhea, impotence, enuresis, frequent urination from Kidney deficiency. Blurred vision from Liver and Kidney deficiency.$t$,
  $t$Not for yin deficiency with fire, or painful urination.$t$,
  6, 12, null);

perform public.catalogue_upsert_herb('Sang Piao Xiao','桑螵蛸','Tenodera sinensis (Ootheca)','Ootheca Mantidis','Mantis egg case',
  'stabilize_bind','neutral','{sweet,salty}','{liver,kidney}',
  $t$Tonifies Kidney yang and secures essence. Reduces urination.$t$,
  $t$Enuresis, frequent urination, spermatorrhea, leukorrhea from Kidney deficiency; especially enuresis in children and the elderly.$t$,
  $t$Not for yin deficiency with fire or damp-heat in the Bladder. Animal product; steamed.$t$,
  6, 9, null);

perform public.catalogue_upsert_herb('Jin Ying Zi','金樱子','Rosa laevigata (Fructus)','Fructus Rosae Laevigatae','Cherokee rose fruit',
  'stabilize_bind','neutral','{sour,astringent}','{kidney,bladder,large_intestine}',
  $t$Secures essence and reduces urination. Stops leukorrhea. Astringes the intestines and stops diarrhea.$t$,
  $t$Spermatorrhea, enuresis, frequent urination, leukorrhea, chronic diarrhea and prolapse from deficiency.$t$,
  $t$Not for excess patterns or damp-heat.$t$,
  6, 12, null);

perform public.catalogue_upsert_herb('Qian Shi','芡实','Euryale ferox (Semen)','Semen Euryales','Euryale seed, fox nut',
  'stabilize_bind','neutral','{sweet,astringent}','{spleen,kidney}',
  $t$Strengthens the Spleen and stops diarrhea. Tonifies the Kidney and secures essence. Stops leukorrhea and expels dampness.$t$,
  $t$Chronic diarrhea from Spleen deficiency. Spermatorrhea, frequent urination, leukorrhea from Kidney deficiency or with dampness.$t$,
  $t$Not for constipation, urinary retention, or postpartum. Also a food.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Lian Zi','莲子','Nelumbo nucifera (Semen)','Semen Nelumbinis','Lotus seed',
  'stabilize_bind','neutral','{sweet,astringent}','{spleen,kidney,heart}',
  $t$Tonifies the Spleen and stops diarrhea. Tonifies the Kidney and secures essence. Nourishes the Heart and calms the spirit.$t$,
  $t$Chronic diarrhea and poor appetite from Spleen deficiency. Spermatorrhea and leukorrhea. Palpitations, insomnia, irritability. Also a food.$t$,
  $t$Not for constipation or abdominal fullness. Remove the green core unless it is wanted for Heart fire.$t$,
  6, 15, null);

perform public.catalogue_upsert_herb('Fu Xiao Mai','浮小麦','Triticum aestivum (Fructus levis)','Fructus Tritici Levis','Light wheat grain',
  'stabilize_bind','cool','{sweet}','{heart}',
  $t$Stops sweating. Nourishes the Heart and clears deficiency heat.$t$,
  $t$Spontaneous sweating from qi deficiency and night sweating from yin deficiency; steaming bone with sweating. Emotional lability (Gan Mai Da Zao Tang uses Xiao Mai).$t$,
  $t$Gentle. The grains that float in water are selected.$t$,
  15, 30, null);

perform public.catalogue_upsert_herb('Ma Huang Gen','麻黄根','Ephedra sinica (Radix)','Radix Ephedrae','Ephedra root',
  'stabilize_bind','neutral','{sweet}','{lung}',
  $t$Stops sweating.$t$,
  $t$Spontaneous sweating from qi deficiency and night sweating from yin deficiency; postpartum sweating. The root does the opposite of the stem.$t$,
  $t$Not for exterior patterns.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Rou Dou Kou','肉豆蔻','Myristica fragrans (Semen)','Semen Myristicae','Nutmeg',
  'stabilize_bind','warm','{acrid}','{spleen,stomach,large_intestine}',
  $t$Astringes the intestines and stops diarrhea. Warms the middle and moves qi.$t$,
  $t$Chronic diarrhea and daybreak diarrhea from Spleen and Kidney cold (Si Shen Wan). Epigastric pain, distention and poor appetite from cold.$t$,
  $t$Not for damp-heat dysentery. Roast to remove the oil before internal use; toxic in large amounts (myristicin).$t$,
  3, 9, 'Roasted (Wei Rou Dou Kou).');

perform public.catalogue_upsert_herb('He Zi','诃子','Terminalia chebula (Fructus)','Fructus Chebulae','Chebulic myrobalan',
  'stabilize_bind','neutral','{bitter,sour,astringent}','{lung,large_intestine}',
  $t$Astringes the intestines and stops diarrhea. Astringes the Lung, stops cough and benefits the voice.$t$,
  $t$Chronic diarrhea and dysentery, rectal prolapse. Chronic cough and hoarseness from Lung deficiency.$t$,
  $t$Not for exterior patterns, damp-heat or food stagnation. Roasted for diarrhea; raw for the throat.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Chi Shi Zhi','赤石脂','Halloysite (mineral)','Halloysitum Rubrum','Red halloysite clay',
  'stabilize_bind','warm','{sweet,sour,astringent}','{stomach,large_intestine}',
  $t$Astringes the intestines and stops diarrhea. Stops bleeding. Topically generates flesh and absorbs dampness.$t$,
  $t$Chronic diarrhea and dysentery with bleeding, rectal prolapse. Uterine bleeding, leukorrhea. Chronic ulcers and damp sores (topical).$t$,
  $t$Not for damp-heat dysentery or the early stage of diarrhea. Pregnancy caution. Traditionally incompatible with Rou Gui. Decoct first in a cloth bag.$t$,
  9, 15, 'Decoct first in a bag.');

perform public.catalogue_upsert_herb('Yu Yu Liang','禹余粮','Limonite (mineral)','Limonitum','Limonite',
  'stabilize_bind','neutral','{sweet,astringent}','{stomach,large_intestine}',
  $t$Astringes the intestines and stops diarrhea. Stops bleeding and leukorrhea.$t$,
  $t$Chronic diarrhea and dysentery. Uterine bleeding, leukorrhea.$t$,
  $t$Not for excess patterns. Pregnancy caution. Calcined; decoct first.$t$,
  9, 15, 'Decoct first.');

perform public.catalogue_upsert_herb('Shi Liu Pi','石榴皮','Punica granatum (Pericarpium)','Pericarpium Granati','Pomegranate rind',
  'stabilize_bind','warm','{sour,astringent}','{large_intestine}',
  $t$Astringes the intestines and stops diarrhea. Kills parasites. Stops bleeding.$t$,
  $t$Chronic diarrhea, dysentery, rectal prolapse. Tapeworm and roundworm. Uterine bleeding, leukorrhea. Tinea (wash).$t$,
  $t$Not for early-stage dysentery with heat.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Hai Piao Xiao','海螵蛸','Sepiella maindroni (Endoconcha)','Endoconcha Sepiae','Cuttlefish bone',
  'stabilize_bind','warm','{salty,astringent}','{liver,kidney}',
  $t$Secures essence and stops leukorrhea. Stops bleeding. Absorbs acid and alleviates pain. Topically dries dampness and generates flesh.$t$,
  $t$Spermatorrhea, leukorrhea. Uterine bleeding, hematemesis, bleeding from trauma. Acid reflux, gastric ulcer pain. Damp sores and ulcers (topical powder).$t$,
  $t$Not for yin deficiency with heat. Prolonged use causes constipation. Also called Wu Zei Gu.$t$,
  6, 12, 'Powder 1.5 to 3 g.');

perform public.catalogue_upsert_herb('Chun Pi','椿皮','Ailanthus altissima (Cortex)','Cortex Ailanthi','Tree of heaven bark',
  'stabilize_bind','cold','{bitter,astringent}','{large_intestine,stomach,liver}',
  $t$Clears heat and dries dampness. Astringes and stops leukorrhea, diarrhea and bleeding. Kills parasites.$t$,
  $t$Damp-heat leukorrhea, chronic dysentery, uterine bleeding with heat. Roundworms.$t$,
  $t$Not for Spleen and Stomach deficiency cold.$t$,
  6, 9, null);

-- ---------------------------------------------------------------------------
-- Calm the spirit: heavy substances that anchor
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Long Gu','龙骨','Fossilized mammal bone','Os Draconis','Dragon bone (fossil)',
  'calm_spirit_anchor','neutral','{sweet,astringent}','{heart,liver,kidney}',
  $t$Calms the Liver and anchors yang. Calms the spirit. Astringes and stops leakage. Calcined, it dries dampness and generates flesh topically.$t$,
  $t$Palpitations, insomnia, dream-disturbed sleep, mania, seizures. Dizziness and irritability from Liver yang rising. Spontaneous sweating, spermatorrhea, uterine bleeding, leukorrhea. Damp sores and chronic ulcers (calcined, topical).$t$,
  $t$Not for damp-heat or excess with exterior pattern. Decoct first, 30 minutes. Raw to calm; calcined to astringe.$t$,
  15, 30, 'Decoct first.');

perform public.catalogue_upsert_herb('Mu Li','牡蛎','Ostrea gigas (Concha)','Concha Ostreae','Oyster shell',
  'calm_spirit_anchor','slightly_cold','{salty,astringent}','{liver,kidney}',
  $t$Calms the Liver and anchors yang. Calms the spirit. Softens hardness and dissipates nodules. Astringes and stops leakage. Calcined, it absorbs acid.$t$,
  $t$Dizziness, tinnitus, irritability from Liver yang rising; internal wind from yin deficiency. Palpitations and insomnia. Goiter, scrofula, abdominal masses. Spontaneous sweating, spermatorrhea, leukorrhea. Acid reflux (calcined).$t$,
  $t$Not for Spleen and Stomach deficiency cold. Decoct first, 30 minutes. Raw to calm and soften; calcined to astringe.$t$,
  15, 30, 'Decoct first.');

perform public.catalogue_upsert_herb('Ci Shi','磁石','Magnetite (mineral, Fe3O4)','Magnetitum','Magnetite',
  'calm_spirit_anchor','cold','{salty}','{kidney,liver,heart}',
  $t$Anchors yang and calms the spirit. Benefits the Kidney and improves hearing and vision. Helps the Kidney grasp qi.$t$,
  $t$Palpitations, insomnia, seizures from disturbed spirit. Tinnitus, deafness, blurred vision from Kidney deficiency (Er Long Zuo Ci Wan). Wheezing from Kidney deficiency.$t$,
  $t$Not for Spleen and Stomach weakness; hard to digest, so not long-term. Calcined and vinegar-quenched; decoct first.$t$,
  9, 30, 'Decoct first.');

perform public.catalogue_upsert_herb('Zhen Zhu','珍珠','Pteria martensii or Hyriopsis cumingii (Margarita)','Margarita','Pearl',
  'calm_spirit_anchor','cold','{sweet,salty}','{heart,liver}',
  $t$Calms the spirit and settles fright. Clears the Liver and brightens the eyes. Topically generates flesh and heals ulcers.$t$,
  $t$Palpitations, seizures, childhood convulsions. Red eyes, corneal opacity. Chronic ulcers, mouth sores, skin blemishes (topical powder).$t$,
  $t$Not for absence of heat or deficiency without fire. Taken as very fine powder, never decocted. Expensive.$t$,
  0.1, 0.3, 'Powder only.');

perform public.catalogue_upsert_herb('Zhen Zhu Mu','珍珠母','Hyriopsis cumingii or Pteria (Concha usta)','Concha Margaritiferae Usta','Mother of pearl',
  'calm_spirit_anchor','cold','{salty}','{liver,heart}',
  $t$Calms the Liver and anchors yang. Calms the spirit. Clears the Liver and brightens the eyes.$t$,
  $t$Dizziness, headache, tinnitus, irritability from Liver yang rising. Palpitations, insomnia, seizures. Red eyes, blurred vision, cataract.$t$,
  $t$Not for Spleen and Stomach deficiency cold. Decoct first.$t$,
  15, 30, 'Decoct first.');

perform public.catalogue_upsert_herb('Hu Po','琥珀','Fossil resin','Succinum','Amber',
  'calm_spirit_anchor','neutral','{sweet}','{heart,liver,bladder}',
  $t$Calms the spirit and settles fright. Invigorates the blood and dispels stasis. Promotes urination and resolves painful urination.$t$,
  $t$Palpitations, insomnia, dream-disturbed sleep, seizures, childhood convulsions. Amenorrhea, abdominal masses from stasis. Painful, bloody or stony urination.$t$,
  $t$Not for yin deficiency with heat. Powder swallowed with the decoction; never boiled.$t$,
  1.5, 3, 'Powder only.');

perform public.catalogue_upsert_herb('Zi Shi Ying','紫石英','Fluorite (mineral, CaF2)','Fluoritum','Fluorite',
  'calm_spirit_anchor','warm','{sweet}','{heart,liver,lung,kidney}',
  $t$Anchors the Heart and calms the spirit. Warms the Lung and directs qi downward. Warms the uterus.$t$,
  $t$Palpitations, insomnia, seizures from Heart deficiency with fright. Wheezing from cold in the Lung. Infertility and cold in the uterus.$t$,
  $t$Not for yin deficiency with fire, or Lung heat. Calcined and vinegar-quenched; decoct first.$t$,
  9, 15, 'Decoct first.');

-- ---------------------------------------------------------------------------
-- Calm the spirit: substances that nourish
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Suan Zao Ren','酸枣仁','Ziziphus jujuba var. spinosa (Semen)','Semen Ziziphi Spinosae','Sour jujube seed',
  'calm_spirit_nourish','neutral','{sweet,sour}','{heart,liver,gallbladder}',
  $t$Nourishes the Heart and Liver and calms the spirit. Stops sweating. Generates fluids.$t$,
  $t$Insomnia, palpitations, irritability, dream-disturbed sleep from Heart and Liver blood deficiency (Suan Zao Ren Tang, Gui Pi Tang). Spontaneous and night sweats. Thirst from fluid deficiency.$t$,
  $t$Not for excess heat or phlegm-fire. Dry-fried for insomnia; crush before decocting.$t$,
  9, 15, 'Dry-fried and crushed. Up to 30 g.');

perform public.catalogue_upsert_herb('Bai Zi Ren','柏子仁','Platycladus orientalis (Semen)','Semen Platycladi','Arborvitae seed',
  'calm_spirit_nourish','neutral','{sweet}','{heart,kidney,large_intestine}',
  $t$Nourishes the Heart and calms the spirit. Moistens the intestines. Stops night sweats.$t$,
  $t$Insomnia, palpitations, forgetfulness from Heart blood deficiency. Constipation from dryness in the elderly and postpartum. Night sweats from yin deficiency.$t$,
  $t$Not for loose stools or phlegm. Defatted (Bai Zi Ren Shuang) when the bowels are loose.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Yuan Zhi','远志','Polygala tenuifolia (Radix)','Radix Polygalae','Polygala root',
  'calm_spirit_nourish','slightly_warm','{bitter,acrid}','{heart,kidney,lung}',
  $t$Calms the spirit and benefits the intellect. Expels phlegm and opens the orifices. Transforms phlegm and stops cough. Reduces abscesses.$t$,
  $t$Insomnia, palpitations, forgetfulness, anxiety from Heart and Kidney failing to communicate. Confusion, seizures from phlegm obstruction. Cough with copious sputum. Breast abscess, sores (internal and topical).$t$,
  $t$Not for yin deficiency with fire. Irritates the stomach: not with ulcers or gastritis; honey-fried or licorice-processed.$t$,
  3, 9, 'Honey-fried or processed with Gan Cao.');

perform public.catalogue_upsert_herb('He Huan Pi','合欢皮','Albizia julibrissin (Cortex)','Cortex Albiziae','Mimosa tree bark',
  'calm_spirit_nourish','neutral','{sweet}','{heart,liver}',
  $t$Calms the spirit and relieves constraint. Invigorates the blood and reduces swelling.$t$,
  $t$Depression, irritability, insomnia, forgetfulness from constrained emotions. Trauma with pain and swelling; Lung abscess; sores.$t$,
  $t$Pregnancy caution.$t$,
  6, 12, null);

perform public.catalogue_upsert_herb('He Huan Hua','合欢花','Albizia julibrissin (Flos)','Flos Albiziae','Mimosa tree flower',
  'calm_spirit_nourish','neutral','{sweet}','{heart,liver}',
  $t$Calms the spirit and relieves constraint. Gentler than the bark.$t$,
  $t$Depression, irritability, insomnia, forgetfulness and chest oppression from Liver constraint.$t$,
  $t$Gentle. Pregnancy caution.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Ye Jiao Teng','夜交藤','Polygonum multiflorum (Caulis)','Caulis Polygoni Multiflori','Fleeceflower stem',
  'calm_spirit_nourish','neutral','{sweet}','{heart,liver}',
  $t$Nourishes the Heart and calms the spirit. Unblocks the channels and dispels wind. Stops itching topically.$t$,
  $t$Insomnia, dream-disturbed sleep from blood deficiency. Numbness and bi pain from blood deficiency. Itchy skin lesions (wash).$t$,
  $t$Gentle. Also called Shou Wu Teng.$t$,
  9, 30, null);

perform public.catalogue_upsert_herb('Ling Zhi','灵芝','Ganoderma lucidum (fruiting body)','Ganoderma','Reishi mushroom',
  'calm_spirit_nourish','neutral','{sweet}','{heart,lung,liver,kidney}',
  $t$Tonifies qi and nourishes the Heart. Calms the spirit. Stops cough and calms wheezing. Supports the constitution.$t$,
  $t$Insomnia, palpitations, forgetfulness, fatigue. Chronic cough and wheezing from deficiency. Weakness after illness; adjunct in chronic disease and oncology support.$t$,
  $t$Generally safe. Caution with anticoagulants.$t$,
  6, 12, null);

perform public.catalogue_upsert_herb('Fu Shen','茯神','Poria cocos (Sclerotium with pine root)','Poria cum Pini Radice','Poria with pine root',
  'calm_spirit_nourish','neutral','{sweet,bland}','{heart,spleen}',
  $t$Calms the spirit. Promotes urination and strengthens the Spleen.$t$,
  $t$Palpitations, insomnia, forgetfulness, anxiety from Heart and Spleen deficiency. The spirit-calming form of Fu Ling.$t$,
  $t$Gentle.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Lian Zi Xin','莲子心','Nelumbo nucifera (Plumula)','Plumula Nelumbinis','Lotus seed embryo',
  'calm_spirit_nourish','cold','{bitter}','{heart,kidney}',
  $t$Clears Heart fire and calms the spirit. Reconnects the Heart and Kidney. Stops bleeding. Lowers blood pressure.$t$,
  $t$Insomnia, irritability, restlessness from Heart fire; delirium in febrile disease. Spermatorrhea with Heart heat. Hematemesis (minor). Hypertension.$t$,
  $t$Not for Spleen and Stomach deficiency cold. Very bitter.$t$,
  1.5, 3, null);

-- ---------------------------------------------------------------------------
-- Aromatic substances that open the orifices
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Bing Pian','冰片','Dryobalanops aromatica (Borneolum) or synthetic','Borneolum','Borneol',
  'aromatic_open_orifices','cool','{acrid,bitter}','{heart,spleen,lung}',
  $t$Opens the orifices and revives the spirit. Clears heat and alleviates pain. Topically resolves toxicity and reduces swelling.$t$,
  $t$Loss of consciousness from heat or phlegm closed disorder (An Gong Niu Huang Wan). Sore throat, mouth sores, eye inflammation, ear infections, sores (topical). Angina (in Su Xiao Jiu Xin Wan).$t$,
  $t$Contraindicated in pregnancy. Not for deficiency collapse. Never decocted: pills, powder or topical only. Dose is tiny.$t$,
  0.03, 0.1, 'Pills or powder only.');

perform public.catalogue_upsert_herb('Shi Chang Pu','石菖蒲','Acorus tatarinowii (Rhizoma)','Rhizoma Acori Tatarinowii','Grassleaf sweetflag',
  'aromatic_open_orifices','warm','{acrid,bitter}','{heart,stomach}',
  $t$Opens the orifices and transforms phlegm. Quiets the spirit and benefits the intellect. Transforms dampness and harmonizes the Stomach.$t$,
  $t$Confusion, seizures, deafness, tinnitus, forgetfulness from phlegm misting the orifices. Epigastric fullness, poor appetite, damp obstruction. Damp-warmth with clouded spirit.$t$,
  $t$Not for yin deficiency with heat, spontaneous sweating or bleeding.$t$,
  3, 9, 'Fresh: 9 to 24 g.');

perform public.catalogue_upsert_herb('Su He Xiang','苏合香','Liquidambar orientalis (Resina)','Styrax','Storax',
  'aromatic_open_orifices','warm','{acrid}','{heart,spleen}',
  $t$Opens the orifices and disperses cold. Alleviates pain.$t$,
  $t$Loss of consciousness from cold or phlegm closed disorder: stroke, coma with cold limbs (Su He Xiang Wan). Chest and abdominal pain from cold stagnation; angina.$t$,
  $t$Contraindicated in pregnancy. Not for heat closed disorder or deficiency collapse. Pills only.$t$,
  0.3, 1, 'Pills only.');

perform public.catalogue_upsert_herb('An Xi Xiang','安息香','Styrax benzoin (Resina)','Benzoinum','Benzoin',
  'aromatic_open_orifices','neutral','{acrid,bitter}','{heart,spleen}',
  $t$Opens the orifices and revives the spirit. Invigorates the blood and alleviates pain.$t$,
  $t$Sudden loss of consciousness, stroke with phlegm. Chest and abdominal pain from stasis; postpartum fainting.$t$,
  $t$Contraindicated in pregnancy. Not for deficiency collapse. Pills or powder only.$t$,
  0.3, 1.5, 'Pills or powder only.');

-- ---------------------------------------------------------------------------
-- Extinguish wind and stop tremors
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Tian Ma','天麻','Gastrodia elata (Rhizoma)','Rhizoma Gastrodiae','Gastrodia rhizome',
  'extinguish_wind','neutral','{sweet}','{liver}',
  $t$Extinguishes wind and stops spasms. Calms the Liver and anchors yang. Dispels wind-dampness and unblocks the channels.$t$,
  $t$Childhood convulsions, epilepsy, tetanus. Dizziness, headache, migraine from Liver yang rising or wind-phlegm (Tian Ma Gou Teng Yin, Ban Xia Bai Zhu Tian Ma Tang). Numbness, hemiplegia, bi pain. Suitable for excess and deficiency alike.$t$,
  $t$Not for blood deficiency without wind. Powder is more effective than decoction.$t$,
  3, 9, 'Powder 1 to 1.5 g.');

perform public.catalogue_upsert_herb('Gou Teng','钩藤','Uncaria rhynchophylla (Ramulus cum uncis)','Ramulus Uncariae cum Uncis','Gambir vine with hooks',
  'extinguish_wind','cool','{sweet}','{liver,pericardium}',
  $t$Extinguishes wind and stops spasms. Clears heat and calms the Liver.$t$,
  $t$Childhood convulsions, febrile seizures, eclampsia. Headache, dizziness, red eyes, irritability from Liver heat or yang rising; hypertension.$t$,
  $t$Add in the last 5 minutes of decoction; prolonged boiling destroys the active constituents.$t$,
  6, 15, 'Add at the end.');

perform public.catalogue_upsert_herb('Shi Jue Ming','石决明','Haliotis diversicolor (Concha)','Concha Haliotidis','Abalone shell',
  'extinguish_wind','cold','{salty}','{liver}',
  $t$Calms the Liver and anchors yang. Clears the Liver and brightens the eyes.$t$,
  $t$Dizziness, headache, tinnitus from Liver yang rising; hypertension. Red, painful eyes, photophobia, cataract, pterygium from Liver heat.$t$,
  $t$Not for Spleen and Stomach deficiency cold. Decoct first, 30 minutes.$t$,
  15, 30, 'Decoct first.');

perform public.catalogue_upsert_herb('Dai Zhe Shi','代赭石','Hematite (mineral, Fe2O3)','Haematitum','Hematite',
  'extinguish_wind','cold','{bitter}','{liver,heart}',
  $t$Calms the Liver and anchors yang. Directs rebellious qi downward. Cools the blood and stops bleeding.$t$,
  $t$Dizziness, tinnitus, headache from Liver yang rising (Zhen Gan Xi Feng Tang). Belching, hiccup, vomiting, wheezing from rebellious qi (Xuan Fu Dai Zhe Tang). Hematemesis, nosebleed from heat.$t$,
  $t$Contraindicated in pregnancy. Not for Spleen and Stomach deficiency cold. Contains trace arsenic: not for long-term use. Decoct first.$t$,
  9, 30, 'Decoct first.');

perform public.catalogue_upsert_herb('Jiang Can','僵蚕','Bombyx mori infected with Beauveria (larva)','Bombyx Batryticatus','Silkworm larva',
  'extinguish_wind','neutral','{salty,acrid}','{liver,lung,stomach}',
  $t$Extinguishes wind and stops spasms. Dispels wind and alleviates pain. Transforms phlegm and dissipates nodules.$t$,
  $t$Convulsions, facial paralysis, tetanus, tics. Headache, sore throat, itchy skin from wind. Scrofula and phlegm nodules.$t$,
  $t$Animal product. Not for blood deficiency without wind. Dry-fried.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Quan Xie','全蝎','Buthus martensii (whole body)','Scorpio','Scorpion',
  'extinguish_wind','neutral','{acrid}','{liver}',
  $t$Extinguishes wind and stops spasms. Attacks toxin and dissipates nodules. Unblocks the collaterals and alleviates pain.$t$,
  $t$Convulsions, seizures, tetanus, stroke with facial paralysis and hemiplegia. Stubborn migraine, bi pain, trigeminal neuralgia. Scrofula, sores (topical).$t$,
  $t$Toxic and an animal product: keep within range. Contraindicated in pregnancy. Not for wind from blood deficiency. Powder is stronger.$t$,
  2, 5, 'Powder 0.6 to 1 g.');

perform public.catalogue_upsert_herb('Wu Gong','蜈蚣','Scolopendra subspinipes (whole body)','Scolopendra','Centipede',
  'extinguish_wind','warm','{acrid}','{liver}',
  $t$Extinguishes wind and stops spasms. Attacks toxin and dissipates nodules. Unblocks the collaterals and alleviates pain.$t$,
  $t$Severe convulsions, tetanus, stroke with paralysis. Stubborn headache and bi pain. Scrofula, snakebite, sores (topical). Stronger than Quan Xie.$t$,
  $t$Toxic and an animal product: keep within range. Contraindicated in pregnancy. Not for wind from blood deficiency.$t$,
  1, 3, 'Usually 1 to 3 pieces; powder 0.6 to 1 g.');

perform public.catalogue_upsert_herb('Di Long','地龙','Pheretima aspergillum (whole body)','Pheretima','Earthworm',
  'extinguish_wind','cold','{salty}','{liver,lung,bladder}',
  $t$Clears heat and extinguishes wind. Calms wheezing. Unblocks the collaterals. Promotes urination. Lowers blood pressure.$t$,
  $t$High fever with convulsions, mania. Wheezing from Lung heat. Hemiplegia, numbness, bi pain (Bu Yang Huan Wu Tang). Painful urination, edema. Hypertension.$t$,
  $t$Not for Spleen and Stomach deficiency cold, or absence of heat. Animal product.$t$,
  5, 15, null);

perform public.catalogue_upsert_herb('Ci Ji Li','刺蒺藜','Tribulus terrestris (Fructus)','Fructus Tribuli','Tribulus fruit',
  'extinguish_wind','neutral','{bitter,acrid}','{liver}',
  $t$Calms the Liver and anchors yang. Spreads Liver qi. Dispels wind and brightens the eyes. Stops itching.$t$,
  $t$Headache, dizziness from Liver yang rising. Flank pain, breast distention, insufficient lactation from Liver constraint. Red, painful, teary eyes. Urticaria and itching.$t$,
  $t$Contraindicated in pregnancy. Not for blood deficiency. Also called Bai Ji Li.$t$,
  6, 9, 'Dry-fried to remove the thorns.');

perform public.catalogue_upsert_herb('Luo Bu Ma','罗布麻','Apocynum venetum (Folium)','Folium Apocyni Veneti','Dogbane leaf',
  'extinguish_wind','cool','{sweet,bitter}','{liver}',
  $t$Calms the Liver and clears heat. Promotes urination.$t$,
  $t$Hypertension with headache, dizziness and irritability from Liver yang rising. Edema. Often taken as tea.$t$,
  $t$Not for Spleen deficiency with loose stools.$t$,
  6, 12, null);

perform public.catalogue_upsert_herb('Niu Huang','牛黄','Bos taurus (Calculus)','Calculus Bovis','Ox gallstone, bezoar',
  'extinguish_wind','cool','{bitter}','{heart,liver}',
  $t$Clears heat and resolves toxicity. Extinguishes wind and stops spasms. Transforms phlegm and opens the orifices.$t$,
  $t$High fever with delirium and convulsions, stroke with phlegm blocking the orifices (An Gong Niu Huang Wan). Sore throat, mouth sores, sores and abscesses.$t$,
  $t$Contraindicated in pregnancy. Not for deficiency cold. Natural bezoar is rare and expensive; cultivated (Ti Wai Pei Yu Niu Huang) or synthetic (Ren Gong Niu Huang) are the usual forms. Pills or powder only.$t$,
  0.15, 0.35, 'Pills or powder only.');

perform public.catalogue_upsert_herb('Shan Yang Jiao','山羊角','Capra hircus (Cornu)','Cornu Caprae','Goat horn',
  'extinguish_wind','cold','{salty}','{liver}',
  $t$Calms the Liver and extinguishes wind. Clears heat and settles fright. The accepted substitute for antelope horn.$t$,
  $t$High fever with convulsions, seizures, eclampsia. Dizziness and headache from Liver yang rising. Red eyes.$t$,
  $t$Not for Spleen and Stomach deficiency cold. Animal product; decoct first, or as powder.$t$,
  15, 30, 'Decoct first. Powder 1 to 3 g.');

-- ---------------------------------------------------------------------------
-- Expel parasites
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Shi Jun Zi','使君子','Quisqualis indica (Fructus)','Fructus Quisqualis','Rangoon creeper fruit',
  'expel_parasites','warm','{sweet}','{spleen,stomach}',
  $t$Kills roundworms and pinworms. Strengthens the Spleen and treats childhood nutritional impairment.$t$,
  $t$Roundworm and pinworm infestation, especially in children; abdominal pain with a poor appetite and thin body.$t$,
  $t$Do not take with hot tea: causes hiccup. Overdose causes hiccup, dizziness and vomiting. Children: one and a half kernels per year of age, up to 20.$t$,
  6, 9, 'Chew the roasted kernels, 1 to 3 days.');

perform public.catalogue_upsert_herb('Bing Lang','槟榔','Areca catechu (Semen)','Semen Arecae','Betel nut',
  'expel_parasites','warm','{acrid,bitter}','{stomach,large_intestine}',
  $t$Kills parasites, especially tapeworms. Moves qi and reduces accumulation. Promotes urination and reduces edema. Treats malaria.$t$,
  $t$Tapeworm (with Nan Gua Zi), roundworm, hookworm. Food stagnation with constipation, dysentery with tenesmus. Edema, beriberi. Malaria.$t$,
  $t$Not for qi deficiency or prolapse. Chewed as betel quid it is carcinogenic; medicinal decoction is a different use. Large doses for tapeworm.$t$,
  3, 9, '30 to 60 g for tapeworm.');

perform public.catalogue_upsert_herb('Nan Gua Zi','南瓜子','Cucurbita moschata (Semen)','Semen Cucurbitae','Pumpkin seed',
  'expel_parasites','neutral','{sweet}','{stomach,large_intestine}',
  $t$Kills tapeworms and roundworms without toxicity. Benefits the prostate.$t$,
  $t$Tapeworm (paralyzes the segments; Bing Lang then expels them), roundworm, schistosomiasis (adjunct). Benign prostatic enlargement.$t$,
  $t$Safe. Taken raw, ground, on an empty stomach.$t$,
  30, 60, 'Raw, ground, followed by Bing Lang decoction.');

perform public.catalogue_upsert_herb('Ku Lian Pi','苦楝皮','Melia azedarach (Cortex)','Cortex Meliae','Chinaberry bark',
  'expel_parasites','cold','{bitter}','{liver,spleen,stomach}',
  $t$Kills roundworms, pinworms and hookworms. Topically treats tinea and scabies.$t$,
  $t$Roundworm, pinworm, hookworm. Tinea and scabies (wash or ointment).$t$,
  $t$Toxic and hepatotoxic: short courses only; not for weak patients, liver disease or pregnancy. Do not use fresh bark internally in large amounts.$t$,
  6, 9, 'Fresh: 15 to 30 g. Short course.');

perform public.catalogue_upsert_herb('Guan Zhong','贯众','Dryopteris crassirhizoma (Rhizoma)','Rhizoma Dryopteridis Crassirhizomatis','Male fern rhizome',
  'expel_parasites','slightly_cold','{bitter}','{liver,spleen}',
  $t$Kills parasites. Clears heat and resolves toxicity. Charred, it stops bleeding.$t$,
  $t$Tapeworm, roundworm, hookworm. Warm disease, mumps, epidemic prevention (traditional). Uterine bleeding, bloody stool (charred).$t$,
  $t$Slightly toxic: keep within range. Contraindicated in pregnancy. Not for Spleen deficiency cold.$t$,
  5, 10, 'Charred (Guan Zhong Tan) for bleeding.');

perform public.catalogue_upsert_herb('Lei Wan','雷丸','Omphalia lapidescens (Sclerotium)','Omphalia','Omphalia',
  'expel_parasites','cold','{bitter}','{stomach,large_intestine}',
  $t$Kills tapeworms, roundworms and hookworms.$t$,
  $t$Tapeworm (principal), roundworm, hookworm; childhood nutritional impairment with parasites.$t$,
  $t$The active enzyme is destroyed by heat: taken only as powder with cool water, three times daily for three days. Slightly toxic; not for pregnancy or absence of parasites.$t$,
  6, 15, 'Powder only, with cool water.');

perform public.catalogue_upsert_herb('Fei Zi','榧子','Torreya grandis (Semen)','Semen Torreyae','Torreya nut',
  'expel_parasites','neutral','{sweet}','{lung,stomach,large_intestine}',
  $t$Kills parasites gently. Moistens the Lung and stops cough. Moistens the intestines.$t$,
  $t$Tapeworm, hookworm, roundworm, pinworm; suitable for children and weak patients. Dry cough, constipation.$t$,
  $t$Not for loose stools. Traditionally not taken with Lu Dou. Chewed, 10 to 30 nuts.$t$,
  9, 15, 'Chewed, or dry-fried.');

perform public.catalogue_upsert_herb('Da Suan','大蒜','Allium sativum (Bulbus)','Bulbus Allii Sativi','Garlic',
  'expel_parasites','warm','{acrid}','{spleen,stomach,lung}',
  $t$Kills parasites. Resolves toxicity and reduces swelling. Prevents infection. Warms the middle and reduces food stagnation.$t$,
  $t$Hookworm, pinworm (enema), amoebic dysentery, tuberculosis (adjunct). Sores and abscesses (topical), snakebite. Food stagnation with cold.$t$,
  $t$Not for yin deficiency with fire, or disorders of the eyes, mouth, tongue or throat. Prolonged topical use blisters the skin.$t$,
  6, 15, 'Raw: 3 to 5 cloves.');

-- ---------------------------------------------------------------------------
-- Substances for external application
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Liu Huang','硫黄','Sulfur (mineral)','Sulfur','Sulfur',
  'external_application','warm','{sour}','{kidney,large_intestine}',
  $t$Topically kills parasites, stops itching and resolves toxicity. Internally, warms and tonifies the fire of the gate of vitality and unblocks the bowels.$t$,
  $t$Scabies, tinea, eczema, chronic itchy skin lesions (ointment or wash). Internally, in processed form only: cold constipation, impotence and wheezing from yang deficiency in the elderly.$t$,
  $t$Toxic internally: only the processed form (Zhi Liu Huang), in pills, short courses. Contraindicated in pregnancy and yin deficiency with fire. Traditionally incompatible with Mang Xiao.$t$,
  1.5, 3, 'Topical use freely; internal in pills only.');

perform public.catalogue_upsert_herb('Ming Fan','明矾','Alum (mineral, potassium aluminium sulfate)','Alumen','Alum',
  'external_application','cold','{sour,astringent}','{lung,spleen,liver,large_intestine}',
  $t$Topically resolves toxicity, kills parasites, dries dampness and stops itching. Internally stops bleeding and diarrhea, and transforms phlegm.$t$,
  $t$Eczema, tinea, scabies, damp sores, mouth sores, sore throat, rectal prolapse (wash, powder or gargle). Internally, in small doses: chronic diarrhea, bleeding, epilepsy from phlegm.$t$,
  $t$Internal use in the smallest amounts and never long-term; aluminium accumulates. Also called Bai Fan; calcined it is Ku Fan.$t$,
  0.6, 1.5, 'Topical use freely; internal in pills only.');

perform public.catalogue_upsert_herb('Er Cha','儿茶','Acacia catechu (extract)','Catechu','Catechu',
  'external_application','cool','{bitter,astringent}','{lung}',
  $t$Topically astringes, generates flesh and stops bleeding. Internally clears the Lung, transforms phlegm and stops bleeding.$t$,
  $t$Chronic ulcers, eczema, mouth sores, bleeding wounds (powder). Cough with thick sputum, hematemesis (internal).$t$,
  $t$Internal use in pills or powder only.$t$,
  1, 3, 'Topical freely; internal in pills.');

perform public.catalogue_upsert_herb('Peng Sha','硼砂','Borax (mineral)','Borax','Borax',
  'external_application','cool','{sweet,salty}','{lung,stomach}',
  $t$Topically clears heat and resolves toxicity. Internally clears the Lung and transforms phlegm.$t$,
  $t$Sore throat, mouth sores, tongue ulcers, eye inflammation (gargle, powder or wash, as in Bing Peng San).$t$,
  $t$Topical use only in practice: boron is toxic when swallowed. Not for internal use without specialist supervision.$t$,
  1.5, 3, 'Topical use recommended only.');

perform public.catalogue_upsert_herb('Lu Gan Shi','炉甘石','Smithsonite (mineral, ZnCO3)','Calamina','Calamine',
  'external_application','neutral','{sweet}','{liver,stomach}',
  $t$Brightens the eyes and removes superficial obstruction. Absorbs dampness, generates flesh and stops itching.$t$,
  $t$Red, teary, painful eyes, pterygium (eye wash). Eczema, weeping sores, chronic ulcers (powder or lotion).$t$,
  $t$Topical use only. Calcined and levigated to a fine powder.$t$,
  null, null, 'Topical only.');

perform public.catalogue_upsert_herb('She Chuang Zi','蛇床子','Cnidium monnieri (Fructus)','Fructus Cnidii','Cnidium fruit',
  'external_application','warm','{acrid,bitter}','{kidney}',
  $t$Topically kills parasites, dries dampness and stops itching. Internally warms Kidney yang and disperses cold-damp.$t$,
  $t$Eczema, scabies, vaginal itching, trichomonas vaginitis (wash or suppository). Internally: impotence, infertility, cold leukorrhea, cold-damp lower back pain.$t$,
  $t$Not for yin deficiency with fire, or damp-heat in the lower burner. Slightly toxic: keep internal doses within range.$t$,
  3, 9, 'Wash: 15 to 30 g.');

perform public.catalogue_upsert_herb('Mu Bie Zi','木鳖子','Momordica cochinchinensis (Semen)','Semen Momordicae','Cochinchin gourd seed',
  'external_application','cool','{bitter,sweet}','{liver,spleen,stomach}',
  $t$Topically reduces swelling, dissipates nodules and resolves toxicity.$t$,
  $t$Sores, abscesses, scrofula, hemorrhoids, tinea, trauma (ointment or paste).$t$,
  $t$Toxic: topical use only in practice. Contraindicated in pregnancy.$t$,
  0.6, 1.2, 'Topical use recommended only.');

perform public.catalogue_upsert_herb('Zhang Nao','樟脑','Cinnamomum camphora (crystallised oil)','Camphora','Camphor',
  'external_application','hot','{acrid}','{heart,spleen}',
  $t$Topically kills parasites, stops itching, alleviates pain and disperses cold.$t$,
  $t$Scabies, tinea, itchy skin, bi pain, sprains and cold pain (liniment or ointment).$t$,
  $t$Never taken internally. Contraindicated in pregnancy and on broken skin; keep away from children.$t$,
  null, null, 'Topical only.');

perform public.catalogue_upsert_herb('Song Xiang','松香','Pinus (Resina)','Colophonium','Rosin',
  'external_application','warm','{bitter,sweet}','{liver,spleen}',
  $t$Topically draws out toxin, generates flesh, dries dampness and alleviates pain.$t$,
  $t$Sores, abscesses, chronic ulcers, eczema, bi pain (plasters and ointments; a base for traditional plasters).$t$,
  $t$Topical use only.$t$,
  null, null, 'Topical only.');

perform public.catalogue_upsert_herb('Xue Jie','血竭','Daemonorops draco (Resina)','Sanguis Draconis','Dragon''s blood resin',
  'invigorate_blood','neutral','{sweet,salty}','{heart,liver}',
  $t$Invigorates the blood and alleviates pain. Stops bleeding. Topically generates flesh.$t$,
  $t$Trauma with swelling and pain, chest pain from stasis, postpartum abdominal pain. Bleeding wounds, chronic ulcers that fail to close (powder).$t$,
  $t$Contraindicated in pregnancy. Not for absence of stasis. Powder swallowed with the decoction, or topical.$t$,
  1, 1.5, 'Powder; not decocted.');

end
$seed$;
