-- ============================================================================
-- Classical formulas · 01 · Release exterior, clear heat, purge, harmonize,
--                          treat dryness, expel dampness, warm the interior
-- ============================================================================
-- Every call goes through public.upsert_formula (migration 20260906093000).
-- New formulas are inserted with needs_review = true; an existing formula
-- (matched by pinyin, case-insensitive) only has its empty fields filled and
-- any ingredients it lacks appended. Ingredients name herbs by pinyin; an
-- ingredient that is not in the catalogue becomes a review-flagged stub.
--
-- Doses are the usual daily decoction amounts in grams (Bensky & Barolet,
-- Chinese Herbal Medicine: Formulas & Strategies; Shang Han Lun; Wen Bing
-- Tiao Bian). "Gan Cao" carries a note when the honey-fried form is meant.
-- ============================================================================

do $seed$
begin

-- ---------------------------------------------------------------------------
-- Release the exterior
-- ---------------------------------------------------------------------------

perform public.upsert_formula('Ma Huang Tang','麻黄汤','Ephedra Decoction','release_exterior','Shang Han Lun (Zhang Zhong-Jing, c. 220)',
  $t$Releases the exterior, disperses cold, promotes sweating, and calms wheezing by facilitating the flow of Lung qi.$t$,
  $t$Exterior excess cold: fever and chills without sweating, headache, generalized body aches, wheezing, floating tight pulse.$t$,
  $t$Not for exterior deficiency with sweating, or for the weak, elderly, pregnant or hypertensive. Stop once sweating begins.$t$,
  '[{"h":"Ma Huang","d":9},{"h":"Gui Zhi","d":6},{"h":"Xing Ren","d":9},{"h":"Gan Cao","d":3,"n":"honey-fried"}]'::jsonb);

perform public.upsert_formula('Gui Zhi Tang','桂枝汤','Cinnamon Twig Decoction','release_exterior','Shang Han Lun',
  $t$Releases the muscle layer, harmonizes the nutritive and protective qi, and gently promotes sweating.$t$,
  $t$Exterior deficiency wind-cold: fever and chills with sweating that does not resolve the fever, aversion to wind, headache, stiff neck, floating moderate pulse. Also disharmony of nutritive and protective qi after illness or postpartum.$t$,
  $t$Not for exterior excess without sweating, or for warm disease with thirst and a rapid pulse. Take with warm rice porridge and keep covered.$t$,
  '[{"h":"Gui Zhi","d":9},{"h":"Bai Shao","d":9},{"h":"Sheng Jiang","d":9},{"h":"Da Zao","d":12,"n":"4 pieces"},{"h":"Gan Cao","d":6,"n":"honey-fried"}]'::jsonb);

perform public.upsert_formula('Xiao Qing Long Tang','小青龙汤','Minor Bluegreen Dragon Decoction','release_exterior','Shang Han Lun',
  $t$Releases the exterior, warms the Lung, transforms thin mucus and stops cough and wheezing.$t$,
  $t$Exterior cold with interior thin mucus: chills, fever, no sweating, cough and wheezing with copious watery white sputum, a stifled chest, floating tight pulse and a moist white coating. Chronic bronchitis and asthma with these signs.$t$,
  $t$Not for cough from yin deficiency or for Lung heat with yellow sputum. Contains Ma Huang and Xi Xin: keep the course short.$t$,
  '[{"h":"Ma Huang","d":9},{"h":"Gui Zhi","d":9},{"h":"Gan Jiang","d":9},{"h":"Xi Xin","d":3},{"h":"Wu Wei Zi","d":6},{"h":"Bai Shao","d":9},{"h":"Ban Xia","d":9},{"h":"Gan Cao","d":6,"n":"honey-fried"}]'::jsonb);

perform public.upsert_formula('Jiu Wei Qiang Huo Tang','九味羌活汤','Nine-Herb Decoction with Notopterygium','release_exterior','Ci Shi Nan Zhi (Zhang Yuan-Su, 13th c.)',
  $t$Releases the exterior, dispels wind-dampness and clears interior heat.$t$,
  $t$Wind-cold-damp exterior pattern with interior heat: chills, fever, no sweating, headache, stiff neck, heavy aching limbs and joints, bitter taste and thirst.$t$,
  $t$Not for yin deficiency, or for exterior cold without dampness or interior heat.$t$,
  '[{"h":"Qiang Huo","d":9},{"h":"Fang Feng","d":9},{"h":"Cang Zhu","d":9},{"h":"Xi Xin","d":3},{"h":"Chuan Xiong","d":6},{"h":"Bai Zhi","d":6},{"h":"Sheng Di Huang","d":6},{"h":"Huang Qin","d":6},{"h":"Gan Cao","d":3}]'::jsonb);

perform public.upsert_formula('Xiang Su San','香苏散','Cyperus and Perilla Leaf Powder','release_exterior','Tai Ping Hui Min He Ji Ju Fang (1107)',
  $t$Releases the exterior, disperses cold, moves qi and harmonizes the middle.$t$,
  $t$Wind-cold exterior pattern with qi constraint: chills, fever, headache, no sweating together with a stifled chest, epigastric fullness, belching and poor appetite. Common cold in patients prone to Liver constraint or during pregnancy.$t$,
  $t$Gentle. Not for exterior heat or yin deficiency.$t$,
  '[{"h":"Xiang Fu","d":12},{"h":"Zi Su Ye","d":12},{"h":"Chen Pi","d":6},{"h":"Gan Cao","d":3,"n":"honey-fried"}]'::jsonb);

perform public.upsert_formula('Yin Qiao San','银翘散','Honeysuckle and Forsythia Powder','release_exterior','Wen Bing Tiao Bian (Wu Ju-Tong, 1798)',
  $t$Disperses wind-heat, clears heat and resolves toxicity, and vents the exterior with cool acrid herbs.$t$,
  $t$Early-stage warm disease at the protective level: fever with slight or no chills, headache, thirst, sore throat, cough, floating rapid pulse, red tongue tip with a thin white or yellow coating. Influenza, tonsillitis, early measles and mumps with these signs.$t$,
  $t$Not for wind-cold, or damp-warmth. Decoct briefly; the aromatic herbs lose their effect with long boiling.$t$,
  '[{"h":"Jin Yin Hua","d":15},{"h":"Lian Qiao","d":15},{"h":"Jie Geng","d":6},{"h":"Bo He","d":6,"n":"add at the end"},{"h":"Dan Zhu Ye","d":4},{"h":"Gan Cao","d":5,"n":"raw"},{"h":"Jing Jie","d":5},{"h":"Dan Dou Chi","d":5},{"h":"Niu Bang Zi","d":9},{"h":"Lu Gen","d":15}]'::jsonb);

perform public.upsert_formula('Sang Ju Yin','桑菊饮','Mulberry Leaf and Chrysanthemum Drink','release_exterior','Wen Bing Tiao Bian',
  $t$Disperses wind-heat, diffuses the Lung and stops cough with light, cool acrid herbs.$t$,
  $t$Mild wind-heat with cough as the main sign: slight fever, mild thirst, cough, floating rapid pulse. Early upper respiratory infection, acute bronchitis, conjunctivitis with these signs.$t$,
  $t$Too light for a marked fever; use Yin Qiao San instead. Not for wind-cold.$t$,
  '[{"h":"Sang Ye","d":7.5},{"h":"Ju Hua","d":3},{"h":"Xing Ren","d":6},{"h":"Lian Qiao","d":5},{"h":"Bo He","d":2.5,"n":"add at the end"},{"h":"Jie Geng","d":6},{"h":"Gan Cao","d":2.5},{"h":"Lu Gen","d":6}]'::jsonb);

perform public.upsert_formula('Ma Xing Shi Gan Tang','麻杏石甘汤','Ephedra, Apricot Kernel, Gypsum and Licorice Decoction','release_exterior','Shang Han Lun',
  $t$Diffuses the Lung, clears heat, directs qi downward and calms wheezing.$t$,
  $t$Heat lodged in the Lung: fever with or without sweating, cough, wheezing, thirst, nasal flaring, yellow sputum, rapid pulse. Pneumonia, bronchitis and asthma with heat signs.$t$,
  $t$Not for wheezing from cold or deficiency. Shi Gao is dosed at two to five times Ma Huang.$t$,
  '[{"h":"Ma Huang","d":9},{"h":"Xing Ren","d":9},{"h":"Shi Gao","d":18,"n":"decoct first"},{"h":"Gan Cao","d":6,"n":"honey-fried"}]'::jsonb);

perform public.upsert_formula('Chai Ge Jie Ji Tang','柴葛解肌汤','Bupleurum and Kudzu Decoction to Release the Muscle Layer','release_exterior','Shang Han Liu Shu (Tao Hua, 1445)',
  $t$Releases the muscle layer and clears interior heat.$t$,
  $t$Wind-cold transforming into heat: increasing fever and decreasing chills, no sweating, headache, orbital pain, dry nose, irritability, insomnia, floating slightly flooding pulse.$t$,
  $t$Not for a pure exterior cold pattern or when heat has fully entered the interior.$t$,
  '[{"h":"Chai Hu","d":6},{"h":"Ge Gen","d":9},{"h":"Qiang Huo","d":3},{"h":"Bai Zhi","d":3},{"h":"Huang Qin","d":6},{"h":"Shi Gao","d":9,"n":"decoct first"},{"h":"Bai Shao","d":6},{"h":"Jie Geng","d":3},{"h":"Gan Cao","d":3},{"h":"Sheng Jiang","d":3},{"h":"Da Zao","d":6}]'::jsonb);

perform public.upsert_formula('Sheng Ma Ge Gen Tang','升麻葛根汤','Cimicifuga and Kudzu Decoction','release_exterior','Tai Ping Hui Min He Ji Ju Fang',
  $t$Releases the muscle layer and vents rashes.$t$,
  $t$Early-stage measles or other rashes that fail to erupt fully: fever, headache, slight aversion to wind, cough, red eyes, thirst.$t$,
  $t$Not once the rash has fully erupted, or for measles with high fever and dyspnea.$t$,
  '[{"h":"Sheng Ma","d":6},{"h":"Ge Gen","d":9},{"h":"Bai Shao","d":6},{"h":"Gan Cao","d":3,"n":"honey-fried"}]'::jsonb);

perform public.upsert_formula('Ren Shen Bai Du San','人参败毒散','Ginseng Powder to Overcome Pathogenic Influences','release_exterior','Tai Ping Hui Min He Ji Ju Fang',
  $t$Releases the exterior, dispels wind-dampness, and augments qi so the pathogen can be expelled.$t$,
  $t$Wind-cold-damp exterior pattern in a patient with underlying qi deficiency: chills and high fever, no sweating, stiff painful neck and head, heavy aching limbs, nasal congestion, cough with sputum, floating soggy pulse. Early dysentery with exterior signs ("reverse-flow" method).$t$,
  $t$Not for exterior heat, or an exterior pattern without deficiency.$t$,
  '[{"h":"Qiang Huo","d":9},{"h":"Du Huo","d":9},{"h":"Chai Hu","d":9},{"h":"Qian Hu","d":9},{"h":"Chuan Xiong","d":9},{"h":"Zhi Ke","d":9},{"h":"Jie Geng","d":9},{"h":"Fu Ling","d":9},{"h":"Ren Shen","d":6},{"h":"Gan Cao","d":3},{"h":"Sheng Jiang","d":3},{"h":"Bo He","d":3,"n":"add at the end"}]'::jsonb);

perform public.upsert_formula('Jia Jian Wei Rui Tang','加减葳蕤汤','Modified Solomon''s Seal Decoction','release_exterior','Chong Ding Tong Su Shang Han Lun (1916)',
  $t$Nourishes yin, clears heat, and releases the exterior.$t$,
  $t$Exterior wind-heat in a patient with yin deficiency: fever, slight chills, little or no sweating, headache, dry mouth and throat, cough, irritability, red tongue with a thin coating, rapid pulse.$t$,
  $t$Not for exterior patterns without yin deficiency.$t$,
  '[{"h":"Yu Zhu","d":9},{"h":"Cong Bai","d":6},{"h":"Jie Geng","d":5},{"h":"Dan Dou Chi","d":9},{"h":"Bo He","d":4.5,"n":"add at the end"},{"h":"Bai Wei","d":3},{"h":"Gan Cao","d":1.5,"n":"honey-fried"},{"h":"Da Zao","d":6}]'::jsonb);

-- ---------------------------------------------------------------------------
-- Clear heat
-- ---------------------------------------------------------------------------

perform public.upsert_formula('Bai Hu Tang','白虎汤','White Tiger Decoction','clear_heat','Shang Han Lun',
  $t$Clears qi-level heat, drains Stomach fire, generates fluids and alleviates thirst.$t$,
  $t$Blazing heat in the qi level or yang ming channel, the "four bigs": high fever, profuse sweating, great thirst, flooding forceful pulse; red face, aversion to heat, irritability.$t$,
  $t$Not for fever with chills and no sweating, deficiency heat, or a weak pulse. Not for Spleen and Stomach deficiency cold.$t$,
  '[{"h":"Shi Gao","d":30,"n":"decoct first"},{"h":"Zhi Mu","d":9},{"h":"Gan Cao","d":3,"n":"honey-fried"},{"h":"Jing Mi","d":9,"n":"non-glutinous rice"}]'::jsonb);

perform public.upsert_formula('Zhu Ye Shi Gao Tang','竹叶石膏汤','Lophatherum and Gypsum Decoction','clear_heat','Shang Han Lun',
  $t$Clears lingering heat, generates fluids, augments qi and harmonizes the Stomach.$t$,
  $t$Aftermath of a febrile disease with residual heat and injured qi and fluids: low-grade fever, sweating, irritability, thirst, dry mouth, nausea or vomiting, red dry tongue with little coating, deficient rapid pulse.$t$,
  $t$Not while the fever is still high or the pulse full, or for deficiency cold.$t$,
  '[{"h":"Dan Zhu Ye","d":6},{"h":"Shi Gao","d":30,"n":"decoct first"},{"h":"Ren Shen","d":6},{"h":"Mai Men Dong","d":15},{"h":"Ban Xia","d":9},{"h":"Gan Cao","d":3,"n":"honey-fried"},{"h":"Jing Mi","d":9,"n":"non-glutinous rice"}]'::jsonb);

perform public.upsert_formula('Qing Ying Tang','清营汤','Clear the Nutritive Level Decoction','clear_heat','Wen Bing Tiao Bian',
  $t$Clears the nutritive level, resolves toxicity, vents heat back out to the qi level, and nourishes yin.$t$,
  $t$Heat entering the nutritive level: fever worse at night, irritability, insomnia, delirium, faint rashes, thirst that is not marked, deep red dry tongue, thin rapid pulse. Severe infections and encephalitis with these signs.$t$,
  $t$Not while dampness is present (greasy coating). Shui Niu Jiao replaces the banned rhinoceros horn.$t$,
  '[{"h":"Shui Niu Jiao","d":30,"n":"decoct first"},{"h":"Sheng Di Huang","d":15},{"h":"Xuan Shen","d":9},{"h":"Dan Zhu Ye","d":3},{"h":"Mai Men Dong","d":9},{"h":"Dan Shen","d":6},{"h":"Huang Lian","d":5},{"h":"Jin Yin Hua","d":9},{"h":"Lian Qiao","d":6}]'::jsonb);

perform public.upsert_formula('Xi Jiao Di Huang Tang','犀角地黄汤','Rhinoceros Horn and Rehmannia Decoction (with water buffalo horn)','clear_heat','Bei Ji Qian Jin Yao Fang (Sun Si-Miao, 652)',
  $t$Clears heat, resolves toxicity, cools the blood, dispels stasis and stops bleeding.$t$,
  $t$Heat entering the blood level: high fever, delirium, purpura and rashes, hematemesis, epistaxis, bloody stool, deep red or purple tongue, thin rapid pulse. DIC-like presentations, severe infections with bleeding.$t$,
  $t$Not for bleeding from deficiency cold or Spleen failing to control blood. Shui Niu Jiao replaces rhinoceros horn.$t$,
  '[{"h":"Shui Niu Jiao","d":30,"n":"decoct first"},{"h":"Sheng Di Huang","d":24},{"h":"Chi Shao","d":12},{"h":"Mu Dan Pi","d":9}]'::jsonb);

perform public.upsert_formula('Huang Lian Jie Du Tang','黄连解毒汤','Coptis Decoction to Resolve Toxicity','clear_heat','Wai Tai Mi Yao (Wang Tao, 752)',
  $t$Drains fire and resolves toxicity in all three burners.$t$,
  $t$Fire toxin in the three burners: high fever, irritability, dry mouth and throat, delirium, insomnia, hematemesis or epistaxis from heat, dysentery, jaundice, sores and abscesses; red tongue with a yellow coating, rapid forceful pulse.$t$,
  $t$Very bitter and cold: not for deficiency patterns or prolonged use; injures the Stomach and yin.$t$,
  '[{"h":"Huang Lian","d":9},{"h":"Huang Qin","d":6},{"h":"Huang Bai","d":6},{"h":"Zhi Zi","d":9}]'::jsonb);

perform public.upsert_formula('Liang Ge San','凉膈散','Cool the Diaphragm Powder','clear_heat','Tai Ping Hui Min He Ji Ju Fang',
  $t$Drains fire, unblocks the bowels, and clears heat from the upper burner while purging the middle.$t$,
  $t$Accumulated heat in the upper and middle burners: fever, irritability, thirst, red face, mouth and tongue sores, sore throat, nosebleed, constipation, dark urine, red tongue with a yellow coating, slippery rapid pulse.$t$,
  $t$Not for deficiency, pregnancy or loose stools.$t$,
  '[{"h":"Da Huang","d":6},{"h":"Mang Xiao","d":6,"n":"dissolve in the strained decoction"},{"h":"Gan Cao","d":6},{"h":"Zhi Zi","d":3},{"h":"Bo He","d":3,"n":"add at the end"},{"h":"Huang Qin","d":3},{"h":"Lian Qiao","d":12},{"h":"Dan Zhu Ye","d":3}]'::jsonb);

perform public.upsert_formula('Pu Ji Xiao Du Yin','普济消毒饮','Universal Benefit Drink to Eliminate Toxin','clear_heat','Dong Yuan Shi Xiao Fang (Li Dong-Yuan, 13th c.)',
  $t$Clears heat, resolves toxicity, disperses wind-heat and reduces swelling of the head and face.$t$,
  $t$Seasonal epidemic toxin in the head: swelling and redness of the head and face, fever, chills, sore throat, difficulty swallowing, dry mouth, thirst; red tongue with a yellow coating, floating rapid pulse. Mumps, facial cellulitis, acute tonsillitis.$t$,
  $t$Not for yin deficiency or Spleen and Stomach weakness.$t$,
  '[{"h":"Huang Qin","d":15},{"h":"Huang Lian","d":15},{"h":"Chen Pi","d":6},{"h":"Xuan Shen","d":6},{"h":"Chai Hu","d":6},{"h":"Jie Geng","d":6},{"h":"Lian Qiao","d":3},{"h":"Ban Lan Gen","d":3},{"h":"Ma Bo","d":3},{"h":"Niu Bang Zi","d":3},{"h":"Bo He","d":3,"n":"add at the end"},{"h":"Jiang Can","d":2},{"h":"Sheng Ma","d":2},{"h":"Gan Cao","d":6}]'::jsonb);

perform public.upsert_formula('Dao Chi San','导赤散','Guide Out the Red Powder','clear_heat','Xiao Er Yao Zheng Zhi Jue (Qian Yi, 1119)',
  $t$Clears Heart fire, promotes urination and nourishes yin.$t$,
  $t$Heart fire transferred to the Small Intestine: irritability, thirst, mouth and tongue sores, red face, dark scanty painful urination, red tongue tip, rapid pulse. Urinary tract infection and stomatitis with these signs.$t$,
  $t$Gentle; not for Spleen and Stomach deficiency cold.$t$,
  '[{"h":"Sheng Di Huang","d":9},{"h":"Mu Tong","d":6,"n":"Chuan Mu Tong only"},{"h":"Dan Zhu Ye","d":6},{"h":"Gan Cao","d":6,"n":"raw, use the tip"}]'::jsonb);

perform public.upsert_formula('Long Dan Xie Gan Tang','龙胆泻肝汤','Gentian Decoction to Drain the Liver','clear_heat','Yi Fang Ji Jie (Wang Ang, 1682)',
  $t$Drains excess fire from the Liver and Gallbladder and clears damp-heat from the lower burner.$t$,
  $t$Liver and Gallbladder fire rising: headache, red eyes, flank pain, bitter taste, deafness, ear swelling, irritability. Damp-heat in the Liver channel: painful dark urination, genital itching or swelling, foul leukorrhea, herpes zoster. Red tongue with a yellow coating, wiry rapid forceful pulse.$t$,
  $t$Bitter and cold: not for deficiency patterns or prolonged use. Use Chuan Mu Tong, never the aristolochic Guan Mu Tong.$t$,
  '[{"h":"Long Dan Cao","d":6},{"h":"Huang Qin","d":9},{"h":"Zhi Zi","d":9},{"h":"Ze Xie","d":12},{"h":"Mu Tong","d":6,"n":"Chuan Mu Tong only"},{"h":"Che Qian Zi","d":9,"n":"in a bag"},{"h":"Dang Gui","d":3},{"h":"Sheng Di Huang","d":9},{"h":"Chai Hu","d":6},{"h":"Gan Cao","d":6}]'::jsonb);

perform public.upsert_formula('Xie Bai San','泻白散','Drain the White Powder','clear_heat','Xiao Er Yao Zheng Zhi Jue',
  $t$Drains lurking heat from the Lung and calms wheezing.$t$,
  $t$Smoldering Lung heat: cough, wheezing, skin that feels hot to the touch, fever worse in the afternoon, dry mouth, red tongue with a yellow coating, thin rapid pulse. Chronic bronchitis and early pulmonary tuberculosis in children.$t$,
  $t$Not for cough from wind-cold or from deficiency without heat.$t$,
  '[{"h":"Sang Bai Pi","d":9},{"h":"Di Gu Pi","d":9},{"h":"Gan Cao","d":3,"n":"honey-fried"},{"h":"Jing Mi","d":9,"n":"non-glutinous rice"}]'::jsonb);

perform public.upsert_formula('Qing Wei San','清胃散','Clear the Stomach Powder','clear_heat','Pi Wei Lun (Li Dong-Yuan, 1249)',
  $t$Drains Stomach fire, cools the blood and nourishes yin.$t$,
  $t$Stomach fire blazing along the yang ming channel: toothache radiating to the head, facial swelling, bleeding gums, hot cheeks, dry mouth, bad breath, red tongue with a yellow coating, slippery rapid pulse. Gingivitis, periodontitis, trigeminal neuralgia with these signs.$t$,
  $t$Not for toothache from wind-cold or Kidney deficiency.$t$,
  '[{"h":"Sheng Di Huang","d":12},{"h":"Dang Gui","d":6},{"h":"Mu Dan Pi","d":9},{"h":"Huang Lian","d":6},{"h":"Sheng Ma","d":6}]'::jsonb);

perform public.upsert_formula('Yu Nu Jian','玉女煎','Jade Woman Decoction','clear_heat','Jing Yue Quan Shu (Zhang Jing-Yue, 1624)',
  $t$Clears Stomach heat and nourishes Kidney yin.$t$,
  $t$Stomach heat with Kidney yin deficiency: toothache, loose teeth, bleeding gums, thirst, irritability, headache, wasting-thirst; red dry tongue with a yellow coating, floating flooding pulse that is thin on pressure. Diabetes and periodontal disease with these signs.$t$,
  $t$Not for loose stools or Spleen deficiency.$t$,
  '[{"h":"Shi Gao","d":15,"n":"decoct first"},{"h":"Shu Di Huang","d":15},{"h":"Mai Men Dong","d":6},{"h":"Zhi Mu","d":5},{"h":"Niu Xi","d":5}]'::jsonb);

perform public.upsert_formula('Shao Yao Tang','芍药汤','Peony Decoction','clear_heat','Su Wen Bing Ji Qi Yi Bao Ming Ji (Liu Wan-Su, 1186)',
  $t$Clears damp-heat, regulates qi and blood, and stops dysentery.$t$,
  $t$Damp-heat dysentery: abdominal pain, tenesmus, stool with blood and pus, burning anus, dark scanty urine, greasy yellow coating, wiry rapid pulse.$t$,
  $t$Not for dysentery from deficiency cold or the early stage with exterior signs.$t$,
  '[{"h":"Bai Shao","d":15},{"h":"Dang Gui","d":9},{"h":"Huang Lian","d":9},{"h":"Bing Lang","d":5},{"h":"Mu Xiang","d":5},{"h":"Gan Cao","d":5,"n":"honey-fried"},{"h":"Da Huang","d":9},{"h":"Huang Qin","d":9},{"h":"Rou Gui","d":2}]'::jsonb);

perform public.upsert_formula('Bai Tou Weng Tang','白头翁汤','Pulsatilla Decoction','clear_heat','Shang Han Lun',
  $t$Clears heat, resolves toxicity, cools the blood and stops dysentery.$t$,
  $t$Heat toxin dysentery: abdominal pain, tenesmus, burning anus, stool with more blood than pus, thirst, red tongue with a yellow coating, wiry rapid pulse. Bacillary and amoebic dysentery, ulcerative colitis with these signs.$t$,
  $t$Not for dysentery from cold or deficiency.$t$,
  '[{"h":"Bai Tou Weng","d":15},{"h":"Huang Lian","d":6},{"h":"Huang Bai","d":12},{"h":"Qin Pi","d":12}]'::jsonb);

perform public.upsert_formula('Qing Hao Bie Jia Tang','青蒿鳖甲汤','Artemisia Annua and Soft-Shelled Turtle Shell Decoction','clear_heat','Wen Bing Tiao Bian',
  $t$Nourishes yin, vents heat lurking in the yin level and clears deficiency heat.$t$,
  $t$Late-stage warm disease with heat lurking in the yin level: night fever that resolves by morning without sweating, emaciation, red tongue with little coating, thin rapid pulse. Also chronic low-grade fever of unknown origin and steaming-bone fever.$t$,
  $t$Not for spasms or for excess heat. Qing Hao is added at the end.$t$,
  '[{"h":"Qing Hao","d":6,"n":"add at the end"},{"h":"Bie Jia","d":15,"n":"decoct first"},{"h":"Sheng Di Huang","d":12},{"h":"Zhi Mu","d":6},{"h":"Mu Dan Pi","d":9}]'::jsonb);

perform public.upsert_formula('Qing Shu Yi Qi Tang','清暑益气汤','Clear Summerheat and Augment the Qi Decoction (Wang)','clear_heat','Wen Re Jing Wei (Wang Meng-Ying, 1852)',
  $t$Clears summerheat, augments qi, nourishes yin and generates fluids.$t$,
  $t$Summerheat injuring qi and fluids: fever, sweating, thirst, irritability, fatigue, shortness of breath, scanty dark urine, red tongue with little coating, deficient rapid pulse. Heat exhaustion, summer fevers in children.$t$,
  $t$Not for summerheat with dampness (greasy coating).$t$,
  '[{"h":"Xi Yang Shen","d":5},{"h":"Shi Hu","d":15},{"h":"Mai Men Dong","d":9},{"h":"Huang Lian","d":3},{"h":"Dan Zhu Ye","d":6},{"h":"He Ye","d":15,"n":"stem or leaf"},{"h":"Zhi Mu","d":6},{"h":"Gan Cao","d":3},{"h":"Jing Mi","d":15,"n":"non-glutinous rice"},{"h":"Xi Gua Pi","d":30}]'::jsonb);

perform public.upsert_formula('Wu Wei Xiao Du Yin','五味消毒饮','Five-Ingredient Drink to Eliminate Toxin','clear_heat','Yi Zong Jin Jian (1742)',
  $t$Clears heat, resolves toxicity, cools the blood and reduces abscesses.$t$,
  $t$Boils, carbuncles, furuncles and abscesses in their early stage: red, hot, hard, painful swellings; fever, chills, red tongue with a yellow coating, rapid pulse. Mastitis, cellulitis, acne with heat toxin.$t$,
  $t$Not for yin-type sores that are pale, flat and cold. Zi Bei Tian Kui is often omitted when unavailable.$t$,
  '[{"h":"Jin Yin Hua","d":15},{"h":"Ye Ju Hua","d":6},{"h":"Pu Gong Ying","d":6},{"h":"Zi Hua Di Ding","d":6},{"h":"Zi Bei Tian Kui","d":6,"n":"Semiaquilegia root; optional"}]'::jsonb);

-- ---------------------------------------------------------------------------
-- Purge (drain downward)
-- ---------------------------------------------------------------------------

perform public.upsert_formula('Da Cheng Qi Tang','大承气汤','Major Order the Qi Decoction','purge','Shang Han Lun',
  $t$Vigorously purges heat accumulation and unblocks the bowels.$t$,
  $t$Yang ming organ excess: constipation, abdominal fullness, hardness and pain that refuses pressure, tidal fever, delirium, profuse sweating of the limbs; dry yellow or black coating with prickles, deep excess pulse. Also heat-type diarrhea with foul watery stool around a hard mass, and internal heat causing convulsions or mania.$t$,
  $t$Not for deficiency, pregnancy, or accumulation without full heat signs. Stop as soon as the bowels move. Hou Po is decocted first, Da Huang added later, Mang Xiao dissolved in the strained liquid.$t$,
  '[{"h":"Da Huang","d":12,"n":"add near the end"},{"h":"Mang Xiao","d":9,"n":"dissolve in the strained decoction"},{"h":"Zhi Shi","d":12},{"h":"Hou Po","d":24}]'::jsonb);

perform public.upsert_formula('Xiao Cheng Qi Tang','小承气汤','Minor Order the Qi Decoction','purge','Shang Han Lun',
  $t$Purges mild heat accumulation and moves stagnant qi in the bowels.$t$,
  $t$Yang ming organ excess of a milder degree: constipation, abdominal fullness and distention, tidal fever, delirium, yellow coating, slippery rapid pulse; without the hard dry stool of Da Cheng Qi Tang.$t$,
  $t$Not for deficiency or pregnancy.$t$,
  '[{"h":"Da Huang","d":12},{"h":"Zhi Shi","d":9},{"h":"Hou Po","d":6}]'::jsonb);

perform public.upsert_formula('Tiao Wei Cheng Qi Tang','调胃承气汤','Regulate the Stomach and Order the Qi Decoction','purge','Shang Han Lun',
  $t$Softens hardness, moistens dryness, purges heat and harmonizes the Stomach.$t$,
  $t$Yang ming heat with dryness but little qi stagnation: constipation, thirst, irritability, abdominal fullness that is not markedly painful, yellow coating, slippery rapid pulse. Also toothache, gum bleeding or nosebleed from Stomach heat.$t$,
  $t$Not for deficiency or pregnancy.$t$,
  '[{"h":"Da Huang","d":12},{"h":"Mang Xiao","d":9,"n":"dissolve in the strained decoction"},{"h":"Gan Cao","d":6,"n":"honey-fried"}]'::jsonb);

perform public.upsert_formula('Ma Zi Ren Wan','麻子仁丸','Hemp Seed Pill','purge','Shang Han Lun',
  $t$Moistens the intestines, drains heat, moves qi and unblocks the bowels.$t$,
  $t$Constipation from heat and dryness in the Stomach and intestines with frequent urination ("Spleen-bound" constipation); habitual constipation in the elderly and postpartum with mild heat.$t$,
  $t$Not for pregnancy or constipation from qi or blood deficiency without heat. Usually taken as pills.$t$,
  '[{"h":"Huo Ma Ren","d":20},{"h":"Bai Shao","d":9},{"h":"Zhi Shi","d":9},{"h":"Da Huang","d":12},{"h":"Hou Po","d":9},{"h":"Xing Ren","d":9}]'::jsonb);

perform public.upsert_formula('Da Huang Fu Zi Tang','大黄附子汤','Rhubarb and Prepared Aconite Decoction','purge','Jin Gui Yao Lue',
  $t$Warms the interior, disperses cold, and purges cold accumulation.$t$,
  $t$Cold accumulation obstructing the bowels: constipation, abdominal pain that improves with warmth, one-sided flank pain, cold limbs, low fever, white greasy coating, deep wiry tight pulse.$t$,
  $t$Not for heat accumulation or in pregnancy.$t$,
  '[{"h":"Da Huang","d":9},{"h":"Fu Zi","d":9,"n":"decoct first, 60 minutes"},{"h":"Xi Xin","d":3}]'::jsonb);

perform public.upsert_formula('Wen Pi Tang','温脾汤','Warm the Spleen Decoction','purge','Bei Ji Qian Jin Yao Fang',
  $t$Warms and tonifies Spleen yang while purging cold accumulation.$t$,
  $t$Cold accumulation with Spleen yang deficiency: constipation or chronic dysentery with abdominal pain that likes warmth and pressure, cold limbs, pale tongue with a white coating, deep wiry pulse.$t$,
  $t$Not for heat accumulation.$t$,
  '[{"h":"Da Huang","d":12},{"h":"Fu Zi","d":9,"n":"decoct first, 60 minutes"},{"h":"Gan Jiang","d":6},{"h":"Ren Shen","d":6},{"h":"Gan Cao","d":6,"n":"honey-fried"}]'::jsonb);

perform public.upsert_formula('Zeng Ye Cheng Qi Tang','增液承气汤','Increase the Fluids and Order the Qi Decoction','purge','Wen Bing Tiao Bian',
  $t$Nourishes yin, generates fluids, drains heat and unblocks the bowels.$t$,
  $t$Yang ming heat with severe fluid damage: constipation that does not respond to fluid-increasing formulas alone, dry mouth and lips, dry red tongue with a scorched coating, thin rapid pulse.$t$,
  $t$Not for constipation from cold or qi deficiency.$t$,
  '[{"h":"Xuan Shen","d":30},{"h":"Mai Men Dong","d":24},{"h":"Sheng Di Huang","d":24},{"h":"Da Huang","d":9},{"h":"Mang Xiao","d":4.5,"n":"dissolve in the strained decoction"}]'::jsonb);

-- ---------------------------------------------------------------------------
-- Harmonize
-- ---------------------------------------------------------------------------

perform public.upsert_formula('Xiao Chai Hu Tang','小柴胡汤','Minor Bupleurum Decoction','harmonize','Shang Han Lun',
  $t$Harmonizes the lesser yang (shao yang) and vents the pathogen from the half-exterior, half-interior.$t$,
  $t$Shao yang disorder: alternating chills and fever, fullness of the chest and flanks, bitter taste, dry throat, dizziness, irritability, nausea, poor appetite, thin white coating, wiry pulse. Also malarial disorders, heat entering the blood chamber in women, and many chronic conditions with Liver and Gallbladder disharmony.$t$,
  $t$Not for excess above with deficiency below (Liver yang rising with Kidney deficiency), or for a purely interior or exterior pattern. Rare reports of interstitial pneumonitis with long-term use in Japan.$t$,
  '[{"h":"Chai Hu","d":24},{"h":"Huang Qin","d":9},{"h":"Ban Xia","d":9},{"h":"Ren Shen","d":9},{"h":"Gan Cao","d":9,"n":"honey-fried"},{"h":"Sheng Jiang","d":9},{"h":"Da Zao","d":12,"n":"4 pieces"}]'::jsonb);

perform public.upsert_formula('Da Chai Hu Tang','大柴胡汤','Major Bupleurum Decoction','harmonize','Shang Han Lun',
  $t$Harmonizes the lesser yang and purges interior heat accumulation in the yang ming.$t$,
  $t$Combined shao yang and yang ming disorder: alternating chills and fever, fullness and pain of the chest and flanks, bitter taste, persistent vomiting, epigastric hardness, constipation or burning diarrhea, yellow coating, wiry forceful pulse. Cholecystitis, gallstones, pancreatitis with these signs.$t$,
  $t$Not for deficiency, or for shao yang disorder without interior excess.$t$,
  '[{"h":"Chai Hu","d":15},{"h":"Huang Qin","d":9},{"h":"Bai Shao","d":9},{"h":"Ban Xia","d":9},{"h":"Zhi Shi","d":9},{"h":"Da Huang","d":6},{"h":"Sheng Jiang","d":15},{"h":"Da Zao","d":12,"n":"4 pieces"}]'::jsonb);

perform public.upsert_formula('Hao Qin Qing Dan Tang','蒿芩清胆汤','Artemisia Annua and Scutellaria Decoction to Clear the Gallbladder','harmonize','Chong Ding Tong Su Shang Han Lun',
  $t$Clears Gallbladder heat, transforms phlegm and dampness, harmonizes the Stomach and stops vomiting.$t$,
  $t$Damp-heat with phlegm in the shao yang: alternating chills and fever with more fever than chills, bitter taste, chest and flank fullness, nausea and vomiting of bitter fluid or sour phlegm, dark urine, red tongue with a greasy yellow coating, slippery rapid pulse. Malaria, hepatitis, cholecystitis.$t$,
  $t$Not for cold or deficiency patterns.$t$,
  '[{"h":"Qing Hao","d":6,"n":"add at the end"},{"h":"Huang Qin","d":9},{"h":"Zhu Ru","d":9},{"h":"Ban Xia","d":5},{"h":"Fu Ling","d":9,"n":"red poria (Chi Fu Ling) if available"},{"h":"Zhi Ke","d":5},{"h":"Chen Pi","d":5},{"h":"Hua Shi","d":9},{"h":"Qing Dai","d":1.5},{"h":"Gan Cao","d":1.5}]'::jsonb);

perform public.upsert_formula('Si Ni San','四逆散','Frigid Extremities Powder','harmonize','Shang Han Lun',
  $t$Vents constrained yang, spreads Liver qi, and harmonizes the Liver and Spleen.$t$,
  $t$Yang constraint from Liver qi stagnation: cold fingers and toes with a warm body, chest and flank distention, epigastric pain, irritability, red tongue with a yellow coating, wiry pulse. Liver and Spleen disharmony with abdominal pain and diarrhea. The root of Xiao Yao San and Chai Hu Shu Gan San.$t$,
  $t$Not for cold limbs from yang deficiency (use Si Ni Tang).$t$,
  '[{"h":"Chai Hu","d":6},{"h":"Bai Shao","d":9},{"h":"Zhi Shi","d":6},{"h":"Gan Cao","d":6,"n":"honey-fried"}]'::jsonb);

perform public.upsert_formula('Xiao Yao San','逍遥散','Rambling Powder','harmonize','Tai Ping Hui Min He Ji Ju Fang',
  $t$Spreads Liver qi, strengthens the Spleen, nourishes the blood and harmonizes the Liver and Spleen.$t$,
  $t$Liver constraint with blood deficiency and Spleen weakness: flank pain, headache, dizziness, bitter taste, fatigue, poor appetite, irregular menses, breast distention, irritability, pale red tongue, wiry deficient pulse. Premenstrual syndrome, functional dyspepsia, chronic hepatitis, depression.$t$,
  $t$Not for Liver yang rising or yin deficiency without constraint.$t$,
  '[{"h":"Chai Hu","d":9},{"h":"Dang Gui","d":9},{"h":"Bai Shao","d":9},{"h":"Bai Zhu","d":9},{"h":"Fu Ling","d":9},{"h":"Gan Cao","d":4.5,"n":"honey-fried"},{"h":"Bo He","d":3,"n":"add at the end"},{"h":"Sheng Jiang","d":3,"n":"roasted"}]'::jsonb);

perform public.upsert_formula('Jia Wei Xiao Yao San','加味逍遥散','Augmented Rambling Powder','harmonize','Nei Ke Zhai Yao (Xue Ji, 16th c.)',
  $t$Spreads Liver qi, strengthens the Spleen, nourishes blood and clears heat from constraint.$t$,
  $t$Xiao Yao San pattern with heat from constraint: irritability, hot flushes, red eyes, dry mouth, heavy or early menses, night sweats, red tongue edges, wiry rapid pulse. Menopausal syndrome, PMS with heat signs. Also called Dan Zhi Xiao Yao San.$t$,
  $t$Not for constraint without heat, or yin deficiency without constraint.$t$,
  '[{"h":"Chai Hu","d":9},{"h":"Dang Gui","d":9},{"h":"Bai Shao","d":9},{"h":"Bai Zhu","d":9},{"h":"Fu Ling","d":9},{"h":"Gan Cao","d":4.5,"n":"honey-fried"},{"h":"Bo He","d":3,"n":"add at the end"},{"h":"Sheng Jiang","d":3},{"h":"Mu Dan Pi","d":6},{"h":"Zhi Zi","d":6}]'::jsonb);

perform public.upsert_formula('Tong Xie Yao Fang','痛泻要方','Important Formula for Painful Diarrhea','harmonize','Dan Xi Xin Fa (Zhu Dan-Xi, 1481)',
  $t$Tonifies the Spleen, softens the Liver, dispels dampness and stops diarrhea.$t$,
  $t$Liver overacting on the Spleen: recurrent borborygmus, abdominal pain and diarrhea with the pain easing after the bowel movement, especially with stress; thin white coating, wiry moderate pulse. Irritable bowel syndrome.$t$,
  $t$Not for diarrhea from damp-heat or food stagnation.$t$,
  '[{"h":"Bai Zhu","d":9},{"h":"Bai Shao","d":6},{"h":"Chen Pi","d":4.5},{"h":"Fang Feng","d":6}]'::jsonb);

perform public.upsert_formula('Ban Xia Xie Xin Tang','半夏泻心汤','Pinellia Decoction to Drain the Epigastrium','harmonize','Shang Han Lun',
  $t$Harmonizes the Stomach, directs rebellious qi downward, disperses clumping and combines warm and cold herbs to restore ascending and descending.$t$,
  $t$Mixed heat and cold with focal distention: epigastric fullness and tightness that is soft on palpation, nausea, vomiting, borborygmus, diarrhea, poor appetite, thin greasy yellow coating, wiry rapid pulse. Gastritis, peptic ulcer, functional dyspepsia.$t$,
  $t$Not for focal distention from food stagnation or qi stagnation alone.$t$,
  '[{"h":"Ban Xia","d":12},{"h":"Huang Qin","d":9},{"h":"Gan Jiang","d":9},{"h":"Ren Shen","d":9},{"h":"Huang Lian","d":3},{"h":"Da Zao","d":12,"n":"4 pieces"},{"h":"Gan Cao","d":9,"n":"honey-fried"}]'::jsonb);

-- ---------------------------------------------------------------------------
-- Treat dryness
-- ---------------------------------------------------------------------------

perform public.upsert_formula('Xing Su San','杏苏散','Apricot Kernel and Perilla Leaf Powder','treat_dryness','Wen Bing Tiao Bian',
  $t$Gently disperses cool dryness, diffuses the Lung and transforms phlegm.$t$,
  $t$Externally-contracted cool dryness: slight headache, chills without sweating, cough with watery sputum, stuffy nose, dry throat, white coating, wiry pulse. Autumn colds with cough.$t$,
  $t$Not for warm dryness (use Sang Xing Tang) or heat patterns.$t$,
  '[{"h":"Zi Su Ye","d":9},{"h":"Xing Ren","d":9},{"h":"Ban Xia","d":9},{"h":"Fu Ling","d":9},{"h":"Qian Hu","d":9},{"h":"Jie Geng","d":6},{"h":"Zhi Ke","d":6},{"h":"Chen Pi","d":6},{"h":"Gan Cao","d":3},{"h":"Sheng Jiang","d":3},{"h":"Da Zao","d":6}]'::jsonb);

perform public.upsert_formula('Sang Xing Tang','桑杏汤','Mulberry Leaf and Apricot Kernel Decoction','treat_dryness','Wen Bing Tiao Bian',
  $t$Clears and disperses warm dryness, moistens the Lung and stops cough.$t$,
  $t$Externally-contracted warm dryness injuring the Lung: dry cough with little or sticky sputum, mild fever, headache, thirst, dry nose and throat, red tongue with a thin dry white coating, floating rapid pulse.$t$,
  $t$Not for cool dryness or wind-cold.$t$,
  '[{"h":"Sang Ye","d":3},{"h":"Xing Ren","d":4.5},{"h":"Bei Sha Shen","d":6},{"h":"Zhe Bei Mu","d":3},{"h":"Dan Dou Chi","d":3},{"h":"Zhi Zi","d":3},{"h":"Li Pi","d":3,"n":"pear peel; a whole pear may substitute"}]'::jsonb);

perform public.upsert_formula('Qing Zao Jiu Fei Tang','清燥救肺汤','Eliminate Dryness and Rescue the Lung Decoction','treat_dryness','Yi Men Fa Lu (Yu Chang, 1658)',
  $t$Clears dryness, moistens the Lung, nourishes yin and augments qi.$t$,
  $t$Warm dryness attacking the Lung and injuring qi and yin: headache, fever, dry cough without sputum or with scanty sticky sputum, wheezing, dry throat and nose, chest fullness and pain, dry red tongue with little coating, deficient rapid pulse.$t$,
  $t$Not for cough from wind-cold or with copious sputum.$t$,
  '[{"h":"Sang Ye","d":9},{"h":"Shi Gao","d":7.5,"n":"decoct first"},{"h":"Ren Shen","d":2},{"h":"Gan Cao","d":3},{"h":"Hei Zhi Ma","d":3},{"h":"E Jiao","d":2.4,"n":"melt into the strained decoction"},{"h":"Mai Men Dong","d":3.6},{"h":"Xing Ren","d":2},{"h":"Pi Pa Ye","d":3}]'::jsonb);

perform public.upsert_formula('Mai Men Dong Tang','麦门冬汤','Ophiopogon Decoction','treat_dryness','Jin Gui Yao Lue',
  $t$Nourishes Lung and Stomach yin, generates fluids and directs rebellious qi downward.$t$,
  $t$Lung and Stomach yin deficiency with rebellious qi: cough with scanty sticky sputum that is hard to expectorate, dry throat, thirst, dry heaves, dry red tongue with little coating, deficient rapid pulse. Chronic pharyngitis, atrophic gastritis, post-radiation dryness.$t$,
  $t$Not for cough with copious sputum or for Spleen deficiency with dampness.$t$,
  '[{"h":"Mai Men Dong","d":42},{"h":"Ban Xia","d":6},{"h":"Ren Shen","d":9},{"h":"Gan Cao","d":6,"n":"honey-fried"},{"h":"Jing Mi","d":9,"n":"non-glutinous rice"},{"h":"Da Zao","d":12,"n":"4 pieces"}]'::jsonb);

perform public.upsert_formula('Bai He Gu Jin Tang','百合固金汤','Lily Bulb Decoction to Preserve the Metal','treat_dryness','Shen Zhai Yi Shu (Zhou Zhi-Gan, 1573)',
  $t$Nourishes Lung and Kidney yin, moistens the Lung, transforms phlegm and stops cough and bleeding.$t$,
  $t$Lung and Kidney yin deficiency with deficiency fire: cough with blood-streaked sputum, wheezing, dry sore throat, afternoon fever, night sweats, hot palms and soles, red tongue with little coating, thin rapid pulse. Chronic bronchitis, bronchiectasis, pulmonary tuberculosis.$t$,
  $t$Not for cough from external pathogens, or Spleen deficiency with loose stools.$t$,
  '[{"h":"Sheng Di Huang","d":6},{"h":"Shu Di Huang","d":9},{"h":"Mai Men Dong","d":4.5},{"h":"Bai He","d":3},{"h":"Bai Shao","d":3},{"h":"Dang Gui","d":3},{"h":"Zhe Bei Mu","d":3},{"h":"Gan Cao","d":3,"n":"raw"},{"h":"Xuan Shen","d":2.4},{"h":"Jie Geng","d":2.4}]'::jsonb);

perform public.upsert_formula('Yang Yin Qing Fei Tang','养阴清肺汤','Nourish the Yin and Clear the Lung Decoction','treat_dryness','Chong Lou Yu Yao (Zheng Mei-Jian, 1838)',
  $t$Nourishes yin, clears the Lung, resolves toxicity and benefits the throat.$t$,
  $t$Diphtheria and diphtheria-like sore throat in a patient with yin deficiency: white membrane on the throat that is hard to remove, dry throat, fever, dry nose and lips, dry cough, red tongue with little coating, thin rapid pulse.$t$,
  $t$Not for sore throat from exterior wind-heat without yin deficiency.$t$,
  '[{"h":"Sheng Di Huang","d":6},{"h":"Mai Men Dong","d":4.5},{"h":"Xuan Shen","d":4.5},{"h":"Bai Shao","d":2.4},{"h":"Mu Dan Pi","d":2.4},{"h":"Zhe Bei Mu","d":2.4},{"h":"Bo He","d":1.5,"n":"add at the end"},{"h":"Gan Cao","d":1.5}]'::jsonb);

perform public.upsert_formula('Zeng Ye Tang','增液汤','Increase the Fluids Decoction','treat_dryness','Wen Bing Tiao Bian',
  $t$Generates fluids, nourishes yin and moistens dryness to unblock the bowels ("increasing the water to float the boat").$t$,
  $t$Constipation from fluid deficiency after a febrile disease or in the elderly: dry stool, thirst, dry red tongue, thin and slightly rapid pulse. Also dryness of the mouth and throat from yin deficiency.$t$,
  $t$Not for constipation from cold or qi deficiency, or for Spleen deficiency with loose stools.$t$,
  '[{"h":"Xuan Shen","d":30},{"h":"Mai Men Dong","d":24},{"h":"Sheng Di Huang","d":24}]'::jsonb);

-- ---------------------------------------------------------------------------
-- Expel dampness
-- ---------------------------------------------------------------------------

perform public.upsert_formula('Ping Wei San','平胃散','Calm the Stomach Powder','expel_dampness','Tai Ping Hui Min He Ji Ju Fang',
  $t$Dries dampness, strengthens the Spleen, moves qi and harmonizes the Stomach.$t$,
  $t$Damp-cold stagnating in the Spleen and Stomach: epigastric and abdominal distention, poor appetite, nausea, belching, heavy limbs, fatigue, loose stool, thick white greasy coating, moderate pulse. Chronic gastritis, functional dyspepsia.$t$,
  $t$Drying: not for yin deficiency or pregnancy without modification.$t$,
  '[{"h":"Cang Zhu","d":15},{"h":"Hou Po","d":9},{"h":"Chen Pi","d":9},{"h":"Gan Cao","d":4,"n":"honey-fried"},{"h":"Sheng Jiang","d":3},{"h":"Da Zao","d":6}]'::jsonb);

perform public.upsert_formula('Huo Xiang Zheng Qi San','藿香正气散','Agastache Powder to Rectify the Qi','expel_dampness','Tai Ping Hui Min He Ji Ju Fang',
  $t$Releases the exterior, transforms dampness, regulates qi and harmonizes the middle.$t$,
  $t$Externally-contracted wind-cold with internal dampness: chills, fever, headache, fullness of the chest and epigastrium, nausea, vomiting, borborygmus, diarrhea, white greasy coating, floating moderate pulse. Gastroenteritis, "stomach flu", motion sickness, summer colds.$t$,
  $t$Not for exterior heat or damp-heat.$t$,
  '[{"h":"Huo Xiang","d":9},{"h":"Zi Su Ye","d":3},{"h":"Bai Zhi","d":3},{"h":"Da Fu Pi","d":3},{"h":"Fu Ling","d":3},{"h":"Bai Zhu","d":6},{"h":"Chen Pi","d":6},{"h":"Ban Xia","d":6},{"h":"Hou Po","d":6},{"h":"Jie Geng","d":6},{"h":"Gan Cao","d":6,"n":"honey-fried"},{"h":"Sheng Jiang","d":3},{"h":"Da Zao","d":6}]'::jsonb);

perform public.upsert_formula('Yin Chen Hao Tang','茵陈蒿汤','Virgate Wormwood Decoction','expel_dampness','Shang Han Lun',
  $t$Clears heat, resolves dampness and reduces jaundice.$t$,
  $t$Yang-type jaundice from damp-heat: bright yellow skin and eyes, slight abdominal fullness, thirst, scanty dark urine, constipation or sticky stool, greasy yellow coating, slippery rapid pulse. Acute hepatitis, cholecystitis, cholelithiasis with jaundice.$t$,
  $t$Not for yin-type jaundice from cold-damp (dull yellow, cold signs).$t$,
  '[{"h":"Yin Chen Hao","d":18},{"h":"Zhi Zi","d":9},{"h":"Da Huang","d":6}]'::jsonb);

perform public.upsert_formula('San Ren Tang','三仁汤','Three-Seed Decoction','expel_dampness','Wen Bing Tiao Bian',
  $t$Diffuses the Lung, transforms dampness, clears heat and facilitates the qi mechanism in all three burners.$t$,
  $t$Early-stage damp-warmth with dampness predominant: headache, chills, afternoon fever, heavy body, chest oppression, poor appetite, pale complexion, white greasy coating, wiry thin soggy pulse. Typhoid, enteric fever, pyelonephritis, chronic sinusitis with these signs.$t$,
  $t$Not for heat predominant over dampness, or for yin deficiency.$t$,
  '[{"h":"Xing Ren","d":15},{"h":"Bai Dou Kou","d":6,"n":"add at the end"},{"h":"Yi Yi Ren","d":18},{"h":"Hou Po","d":6},{"h":"Ban Xia","d":15},{"h":"Tong Cao","d":6},{"h":"Hua Shi","d":18,"n":"in a bag"},{"h":"Dan Zhu Ye","d":6}]'::jsonb);

perform public.upsert_formula('Gan Lu Xiao Du Dan','甘露消毒丹','Sweet Dew Special Pill to Eliminate Toxin','expel_dampness','Wen Re Jing Wei',
  $t$Resolves dampness, transforms turbidity, clears heat and resolves toxicity.$t$,
  $t$Damp-warmth with dampness and heat of equal weight: fever, fatigue, heavy aching limbs, chest oppression, abdominal distention, sore swollen throat, jaundice, scanty dark urine, greasy white or yellow coating. Also epidemic febrile diseases in summer, acute hepatitis, enteric fever.$t$,
  $t$Not for yin deficiency or for damp-cold. Use Chuan Mu Tong.$t$,
  '[{"h":"Hua Shi","d":15,"n":"in a bag"},{"h":"Yin Chen Hao","d":11},{"h":"Huang Qin","d":10},{"h":"Shi Chang Pu","d":6},{"h":"Chuan Bei Mu","d":5},{"h":"Mu Tong","d":5,"n":"Chuan Mu Tong only"},{"h":"Huo Xiang","d":4},{"h":"Lian Qiao","d":4},{"h":"Bai Dou Kou","d":4,"n":"add at the end"},{"h":"Bo He","d":4,"n":"add at the end"},{"h":"She Gan","d":4}]'::jsonb);

perform public.upsert_formula('Ba Zheng San','八正散','Eight-Herb Powder for Rectification','expel_dampness','Tai Ping Hui Min He Ji Ju Fang',
  $t$Clears heat, drains fire, promotes urination and unblocks painful urinary dribbling.$t$,
  $t$Damp-heat in the Bladder (heat lin): dark, turbid, scanty, painful, difficult urination, urgency, dry mouth, lower abdominal distention, yellow greasy coating, slippery rapid pulse. Acute urinary tract infection, urethritis, urinary stones.$t$,
  $t$Not for chronic urinary problems from deficiency, or in pregnancy. Use Chuan Mu Tong.$t$,
  '[{"h":"Che Qian Zi","d":9,"n":"in a bag"},{"h":"Qu Mai","d":9},{"h":"Bian Xu","d":9},{"h":"Hua Shi","d":9,"n":"in a bag"},{"h":"Zhi Zi","d":9},{"h":"Gan Cao","d":9,"n":"honey-fried"},{"h":"Mu Tong","d":9,"n":"Chuan Mu Tong only"},{"h":"Da Huang","d":9},{"h":"Deng Xin Cao","d":3}]'::jsonb);

perform public.upsert_formula('Wu Ling San','五苓散','Five-Ingredient Powder with Poria','expel_dampness','Shang Han Lun',
  $t$Promotes urination, drains dampness, strengthens the Spleen and warms yang to transform qi.$t$,
  $t$Water accumulation with failure of qi transformation: difficult urination, edema, thirst with vomiting after drinking, diarrhea, dizziness, fever with an exterior pattern, white coating, floating or moderate pulse. Edema, gastroenteritis, Meniere's disease, hydrocele.$t$,
  $t$Not for difficult urination from yin deficiency. Not for prolonged use.$t$,
  '[{"h":"Ze Xie","d":15},{"h":"Fu Ling","d":9},{"h":"Zhu Ling","d":9},{"h":"Bai Zhu","d":9},{"h":"Gui Zhi","d":6}]'::jsonb);

perform public.upsert_formula('Zhu Ling Tang','猪苓汤','Polyporus Decoction','expel_dampness','Shang Han Lun',
  $t$Promotes urination, clears heat and nourishes yin.$t$,
  $t$Water and heat clumping with yin damage: difficult, painful or bloody urination, fever, thirst with a desire to drink, irritability, insomnia, cough, nausea, diarrhea, red tongue with a thin yellow coating, thin rapid pulse. Cystitis, pyelonephritis, urinary stones.$t$,
  $t$Not for urinary difficulty from Spleen deficiency without heat.$t$,
  '[{"h":"Zhu Ling","d":9},{"h":"Fu Ling","d":9},{"h":"Ze Xie","d":9},{"h":"Hua Shi","d":9,"n":"in a bag"},{"h":"E Jiao","d":9,"n":"melt into the strained decoction"}]'::jsonb);

perform public.upsert_formula('Fang Ji Huang Qi Tang','防己黄芪汤','Stephania and Astragalus Decoction','expel_dampness','Jin Gui Yao Lue',
  $t$Augments qi, dispels wind, strengthens the Spleen and promotes urination.$t$,
  $t$Wind-edema or wind-damp with exterior deficiency: sweating, aversion to wind, heavy body, edema especially of the lower body, painful joints, difficult urination, pale tongue with a white coating, floating pulse. Chronic nephritis, rheumatoid arthritis, obesity with these signs.$t$,
  $t$Not for edema from excess without deficiency. Only Han Fang Ji (Stephania tetrandra); never Guang Fang Ji (Aristolochia).$t$,
  '[{"h":"Han Fang Ji","d":12},{"h":"Huang Qi","d":15},{"h":"Bai Zhu","d":9},{"h":"Gan Cao","d":6,"n":"honey-fried"},{"h":"Sheng Jiang","d":3},{"h":"Da Zao","d":6}]'::jsonb);

perform public.upsert_formula('Ling Gui Zhu Gan Tang','苓桂术甘汤','Poria, Cinnamon Twig, Atractylodes and Licorice Decoction','expel_dampness','Shang Han Lun',
  $t$Warms yang, strengthens the Spleen, promotes urination and transforms thin mucus.$t$,
  $t$Thin mucus (phlegm-fluids) from Spleen yang deficiency: fullness of the chest and epigastrium, palpitations, dizziness, shortness of breath, cough with clear watery sputum, pale swollen tongue with a white slippery coating, wiry slippery or deep tight pulse. Chronic bronchitis, cardiac edema, Meniere's disease.$t$,
  $t$Not for yin deficiency or damp-heat.$t$,
  '[{"h":"Fu Ling","d":12},{"h":"Gui Zhi","d":9},{"h":"Bai Zhu","d":6},{"h":"Gan Cao","d":6,"n":"honey-fried"}]'::jsonb);

perform public.upsert_formula('Zhen Wu Tang','真武汤','True Warrior Decoction','expel_dampness','Shang Han Lun',
  $t$Warms yang and promotes urination to drain water.$t$,
  $t$Kidney and Spleen yang deficiency with water flooding: edema of the limbs, heavy aching body, scanty urination, abdominal pain and diarrhea, cold limbs, palpitations, dizziness, muscle twitching, pale swollen tongue with a white slippery coating, deep thin pulse. Chronic nephritis, heart failure, hypothyroidism with edema.$t$,
  $t$Not for edema from damp-heat or yin deficiency.$t$,
  '[{"h":"Fu Zi","d":9,"n":"decoct first, 60 minutes"},{"h":"Bai Zhu","d":6},{"h":"Fu Ling","d":9},{"h":"Bai Shao","d":9},{"h":"Sheng Jiang","d":9}]'::jsonb);

perform public.upsert_formula('Shi Pi Yin','实脾饮','Bolster the Spleen Drink','expel_dampness','Chong Ding Yan Shi Ji Sheng Fang (Yan Yong-He, 1253)',
  $t$Warms yang, strengthens the Spleen, moves qi and promotes urination.$t$,
  $t$Yin-type edema from Spleen and Kidney yang deficiency: edema worse below the waist, cold limbs, chest and abdominal fullness, poor appetite, loose stool, scanty urine, thick greasy white coating, deep slow pulse.$t$,
  $t$Not for yang-type edema with heat signs.$t$,
  '[{"h":"Fu Zi","d":6,"n":"decoct first, 60 minutes"},{"h":"Gan Jiang","d":6},{"h":"Fu Ling","d":6},{"h":"Bai Zhu","d":6},{"h":"Mu Gua","d":6},{"h":"Hou Po","d":6},{"h":"Mu Xiang","d":6},{"h":"Da Fu Pi","d":6},{"h":"Cao Guo","d":6},{"h":"Gan Cao","d":3,"n":"honey-fried"},{"h":"Sheng Jiang","d":3},{"h":"Da Zao","d":6}]'::jsonb);

perform public.upsert_formula('Qiang Huo Sheng Shi Tang','羌活胜湿汤','Notopterygium Decoction to Overcome Dampness','expel_dampness','Pi Wei Lun',
  $t$Dispels wind-dampness from the exterior and alleviates pain.$t$,
  $t$Wind-dampness in the exterior and the tai yang channel: heavy painful head, stiff neck and back, generalized body aches, difficulty turning, slight chills and fever, white coating, floating pulse. Fibromyalgia, cervical spondylosis, tension headache with these signs.$t$,
  $t$Not for damp-heat or yin deficiency.$t$,
  '[{"h":"Qiang Huo","d":6},{"h":"Du Huo","d":6},{"h":"Gao Ben","d":3},{"h":"Fang Feng","d":3},{"h":"Chuan Xiong","d":3},{"h":"Man Jing Zi","d":2},{"h":"Gan Cao","d":3,"n":"honey-fried"}]'::jsonb);

perform public.upsert_formula('Du Huo Ji Sheng Tang','独活寄生汤','Angelica Pubescens and Taxillus Decoction','expel_dampness','Bei Ji Qian Jin Yao Fang',
  $t$Dispels wind-dampness, alleviates painful obstruction, tonifies the Liver and Kidney, and augments qi and blood.$t$,
  $t$Chronic painful obstruction (bi) with Liver and Kidney deficiency: chronic pain, heaviness and stiffness of the lower back and knees, weak limbs, cold intolerance, palpitations, pale tongue with a white coating, thin weak pulse. Chronic arthritis, lumbar disc disease, sciatica, osteoarthritis.$t$,
  $t$Not for acute bi with heat signs.$t$,
  '[{"h":"Du Huo","d":9},{"h":"Sang Ji Sheng","d":6},{"h":"Du Zhong","d":6},{"h":"Niu Xi","d":6},{"h":"Xi Xin","d":3},{"h":"Qin Jiao","d":6},{"h":"Fu Ling","d":6},{"h":"Rou Gui","d":6},{"h":"Fang Feng","d":6},{"h":"Chuan Xiong","d":6},{"h":"Ren Shen","d":6},{"h":"Gan Cao","d":6},{"h":"Dang Gui","d":6},{"h":"Bai Shao","d":6},{"h":"Shu Di Huang","d":6}]'::jsonb);

perform public.upsert_formula('Er Miao San','二妙散','Two-Marvel Powder','expel_dampness','Dan Xi Xin Fa',
  $t$Clears heat and dries dampness in the lower burner.$t$,
  $t$Damp-heat pouring downward: hot painful swollen knees and feet, weakness or atrophy of the legs, yellow foul leukorrhea, damp eczema of the lower body, dark scanty urine, yellow greasy coating. With Niu Xi it is San Miao San; with Yi Yi Ren too it is Si Miao San.$t$,
  $t$Not for bi from cold-damp or from deficiency.$t$,
  '[{"h":"Cang Zhu","d":15},{"h":"Huang Bai","d":15}]'::jsonb);

perform public.upsert_formula('Si Miao San','四妙散','Four-Marvel Powder','expel_dampness','Cheng Fang Bian Du (Zhang Bing-Cheng, 1904)',
  $t$Clears heat, dries dampness, strengthens the sinews and directs the herbs to the lower body.$t$,
  $t$Damp-heat in the lower burner with atrophy or bi: red, hot, swollen, painful knees and ankles, weak heavy legs, numbness, yellow greasy coating, soggy rapid pulse. Gout, rheumatoid arthritis of the lower limbs, damp-heat leukorrhea.$t$,
  $t$Not for cold-damp or deficiency patterns.$t$,
  '[{"h":"Cang Zhu","d":12},{"h":"Huang Bai","d":12},{"h":"Niu Xi","d":12},{"h":"Yi Yi Ren","d":24}]'::jsonb);

-- ---------------------------------------------------------------------------
-- Warm the interior
-- ---------------------------------------------------------------------------

perform public.upsert_formula('Li Zhong Wan','理中丸','Regulate the Middle Pill','warm_interior','Shang Han Lun',
  $t$Warms the middle burner, dispels cold, augments qi and strengthens the Spleen.$t$,
  $t$Middle burner deficiency cold: diarrhea with watery stool, no thirst, nausea, vomiting, abdominal pain that likes warmth and pressure, poor appetite, cold limbs, pale tongue with a white coating, deep thin pulse. Also cold-type bleeding, excessive saliva, chronic gastritis. With Fu Zi it is Fu Zi Li Zhong Wan.$t$,
  $t$Not for yin deficiency or damp-heat.$t$,
  '[{"h":"Ren Shen","d":9},{"h":"Gan Jiang","d":9},{"h":"Bai Zhu","d":9},{"h":"Gan Cao","d":9,"n":"honey-fried"}]'::jsonb);

perform public.upsert_formula('Xiao Jian Zhong Tang','小建中汤','Minor Construct the Middle Decoction','warm_interior','Shang Han Lun',
  $t$Warms and tonifies the middle burner, moderates spasmodic abdominal pain and harmonizes yin and yang.$t$,
  $t$Consumptive deficiency with cold of the middle: intermittent spasmodic abdominal pain that likes warmth and pressure, palpitations, irritability, low-grade fever, dry throat, pale tongue with a white coating, thin wiry moderate pulse. Peptic ulcer, chronic gastritis, IBS, anemia, children who fail to thrive.$t$,
  $t$Not for vomiting, or for Stomach heat. Yi Tang (maltose) is essential and is dissolved into the strained decoction.$t$,
  '[{"h":"Gui Zhi","d":9},{"h":"Bai Shao","d":18},{"h":"Gan Cao","d":6,"n":"honey-fried"},{"h":"Sheng Jiang","d":9},{"h":"Da Zao","d":12,"n":"4 pieces"},{"h":"Yi Tang","d":30,"n":"dissolve into the strained decoction"}]'::jsonb);

perform public.upsert_formula('Wu Zhu Yu Tang','吴茱萸汤','Evodia Decoction','warm_interior','Shang Han Lun',
  $t$Warms and tonifies the Liver and Stomach, directs rebellious qi downward and stops vomiting.$t$,
  $t$Stomach deficiency cold with Liver cold rising: vomiting after eating, acid regurgitation, dry heaves with spitting of clear fluid, vertex headache, epigastric pain, cold limbs, diarrhea, pale tongue with a white slippery coating, thin slow or wiry pulse. Migraine with vomiting, chronic gastritis, Meniere's disease.$t$,
  $t$Not for vomiting or headache from heat.$t$,
  '[{"h":"Wu Zhu Yu","d":9},{"h":"Ren Shen","d":9},{"h":"Sheng Jiang","d":18},{"h":"Da Zao","d":12,"n":"4 pieces"}]'::jsonb);

perform public.upsert_formula('Da Jian Zhong Tang','大建中汤','Major Construct the Middle Decoction','warm_interior','Jin Gui Yao Lue',
  $t$Warms and tonifies the middle burner, directs rebellious qi downward and alleviates severe cold pain.$t$,
  $t$Severe middle burner cold with yang deficiency: excruciating epigastric and abdominal pain that refuses touch, visible peristalsis, vomiting, inability to eat, cold limbs, white slippery coating, thin tight pulse. Intestinal spasm, adhesive ileus, chronic pancreatitis with cold signs.$t$,
  $t$Not for heat patterns or for pain from qi stagnation or food accumulation.$t$,
  '[{"h":"Hua Jiao","d":6},{"h":"Gan Jiang","d":12},{"h":"Ren Shen","d":6},{"h":"Yi Tang","d":30,"n":"dissolve into the strained decoction"}]'::jsonb);

perform public.upsert_formula('Si Ni Tang','四逆汤','Frigid Extremities Decoction','warm_interior','Shang Han Lun',
  $t$Rescues devastated yang, warms the middle and stops diarrhea.$t$,
  $t$Kidney and Spleen yang collapse (shao yin cold): extremely cold limbs, aversion to cold, sleeping curled up, lethargy, vomiting, watery diarrhea with undigested food, abdominal pain, no thirst, pale tongue with a white slippery coating, deep faint pulse. Shock, heart failure, severe dehydration with cold signs.$t$,
  $t$Not for cold limbs from heat trapped inside (true heat, false cold). Fu Zi is decocted first for at least an hour.$t$,
  '[{"h":"Fu Zi","d":9,"n":"decoct first, 60 minutes"},{"h":"Gan Jiang","d":6},{"h":"Gan Cao","d":6,"n":"honey-fried"}]'::jsonb);

perform public.upsert_formula('Dang Gui Si Ni Tang','当归四逆汤','Tangkuei Decoction for Frigid Extremities','warm_interior','Shang Han Lun',
  $t$Warms the channels, disperses cold, nourishes the blood and unblocks the vessels.$t$,
  $t$Blood deficiency with cold in the channels: cold hands and feet, cold pain of the limbs, joints, lower back or abdomen, pale complexion, pale tongue with a white coating, deep thin or faint pulse. Raynaud's disease, chilblains, dysmenorrhea with cold, peripheral vascular disease.$t$,
  $t$Not for cold limbs from yang collapse (use Si Ni Tang) or from yang constraint (use Si Ni San).$t$,
  '[{"h":"Dang Gui","d":9},{"h":"Gui Zhi","d":9},{"h":"Bai Shao","d":9},{"h":"Xi Xin","d":3},{"h":"Gan Cao","d":6,"n":"honey-fried"},{"h":"Tong Cao","d":6},{"h":"Da Zao","d":12,"n":"8 pieces in the source"}]'::jsonb);

perform public.upsert_formula('Yang He Tang','阳和汤','Yang-Heartening Decoction','warm_interior','Wai Ke Quan Sheng Ji (Wang Wei-De, 1740)',
  $t$Warms yang, tonifies the blood, disperses cold and unblocks stagnation.$t$,
  $t$Yin-type sores from yang and blood deficiency with cold congealing: flat, diffuse, pale swellings without heat, deep bone or joint pain, no thirst, pale tongue with a white coating, deep thin or slow pulse. Chronic osteomyelitis, tuberculous lymphadenitis, thromboangiitis obliterans, deep abscesses.$t$,
  $t$Not for yang-type sores with redness and heat, or once a yin sore has ulcerated.$t$,
  '[{"h":"Shu Di Huang","d":30},{"h":"Lu Jiao Jiao","d":9,"n":"melt into the strained decoction"},{"h":"Rou Gui","d":3},{"h":"Ma Huang","d":2},{"h":"Bai Jie Zi","d":6},{"h":"Gan Jiang","d":2,"n":"blast-fried (Pao Jiang)"},{"h":"Gan Cao","d":3,"n":"raw"}]'::jsonb);

end
$seed$;
