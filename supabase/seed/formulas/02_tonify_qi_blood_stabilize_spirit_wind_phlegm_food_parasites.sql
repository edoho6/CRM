-- ============================================================================
-- Classical formulas · 02 · Tonify, regulate qi, invigorate blood, stop
--                          bleeding, stabilize and bind, calm the spirit,
--                          open the orifices, treat wind, treat phlegm,
--                          reduce food stagnation, expel parasites
-- ============================================================================
-- See 01 for conventions. Formulas whose classical versions depend on
-- cinnabar (Zhu Sha), realgar (Xiong Huang), lead (Qian Dan), musk (She
-- Xiang), rhinoceros horn or antelope horn are given without those
-- ingredients, with the modern substitute where one is standard, and the
-- omission is stated in the contraindications text.
-- ============================================================================

do $seed$
begin

-- ---------------------------------------------------------------------------
-- Tonify qi
-- ---------------------------------------------------------------------------

perform public.upsert_formula('Si Jun Zi Tang','四君子汤','Four-Gentlemen Decoction','tonify','Tai Ping Hui Min He Ji Ju Fang (1107)',
  $t$Tonifies qi and strengthens the Spleen.$t$,
  $t$Spleen and Stomach qi deficiency: pale complexion, low voice, fatigue, poor appetite, loose stool, pale tongue with a thin white coating, thin weak pulse. The base for most qi-tonifying formulas.$t$,
  $t$Not for excess patterns. Gentle enough for long-term use with modification.$t$,
  '[{"h":"Ren Shen","d":9},{"h":"Bai Zhu","d":9},{"h":"Fu Ling","d":9},{"h":"Gan Cao","d":6,"n":"honey-fried"}]'::jsonb);

perform public.upsert_formula('Liu Jun Zi Tang','六君子汤','Six-Gentlemen Decoction','tonify','Yi Xue Zheng Zhuan (Yu Tuan, 1515)',
  $t$Tonifies qi, strengthens the Spleen, transforms phlegm and stops vomiting.$t$,
  $t$Spleen qi deficiency with phlegm-dampness: poor appetite, fatigue, loose stool, nausea, vomiting, epigastric fullness, cough with thin sputum, pale tongue with a white greasy coating, weak slippery pulse. Chronic gastritis, functional dyspepsia, chemotherapy-related nausea.$t$,
  $t$Not for yin deficiency with dryness.$t$,
  '[{"h":"Ren Shen","d":9},{"h":"Bai Zhu","d":9},{"h":"Fu Ling","d":9},{"h":"Gan Cao","d":6,"n":"honey-fried"},{"h":"Chen Pi","d":9},{"h":"Ban Xia","d":12}]'::jsonb);

perform public.upsert_formula('Xiang Sha Liu Jun Zi Tang','香砂六君子汤','Six-Gentlemen Decoction with Aucklandia and Amomum','tonify','Gu Jin Ming Yi Fang Lun (Luo Mei, 1675)',
  $t$Tonifies qi, strengthens the Spleen, moves qi, transforms phlegm and harmonizes the Stomach.$t$,
  $t$Spleen and Stomach qi deficiency with dampness and qi stagnation: epigastric and abdominal distention and pain, belching, poor appetite, nausea, loose stool, fatigue, pale tongue with a white greasy coating. Chronic gastritis, peptic ulcer, IBS.$t$,
  $t$Not for yin deficiency or heat patterns.$t$,
  '[{"h":"Ren Shen","d":9},{"h":"Bai Zhu","d":9},{"h":"Fu Ling","d":9},{"h":"Gan Cao","d":6,"n":"honey-fried"},{"h":"Chen Pi","d":9},{"h":"Ban Xia","d":12},{"h":"Mu Xiang","d":6},{"h":"Sha Ren","d":3,"n":"add at the end"}]'::jsonb);

perform public.upsert_formula('Shen Ling Bai Zhu San','参苓白术散','Ginseng, Poria and Atractylodes Powder','tonify','Tai Ping Hui Min He Ji Ju Fang',
  $t$Augments qi, strengthens the Spleen, leaches out dampness and stops diarrhea.$t$,
  $t$Spleen qi deficiency with dampness: loose stool or chronic diarrhea, poor appetite, weakness of the limbs, emaciation, distention after eating, pale complexion, pale tongue with a white greasy coating, deficient moderate pulse. Chronic enteritis, chronic bronchitis with sputum from Spleen deficiency ("cultivate earth to generate metal"), anemia.$t$,
  $t$Not for damp-heat or yin deficiency.$t$,
  '[{"h":"Ren Shen","d":15},{"h":"Fu Ling","d":15},{"h":"Bai Zhu","d":15},{"h":"Shan Yao","d":15},{"h":"Bai Bian Dou","d":12},{"h":"Lian Zi","d":9},{"h":"Yi Yi Ren","d":9},{"h":"Sha Ren","d":6,"n":"add at the end"},{"h":"Jie Geng","d":6},{"h":"Gan Cao","d":9,"n":"honey-fried"}]'::jsonb);

perform public.upsert_formula('Bu Zhong Yi Qi Tang','补中益气汤','Tonify the Middle and Augment the Qi Decoction','tonify','Pi Wei Lun (Li Dong-Yuan, 1249)',
  $t$Tonifies the middle burner, augments qi, raises sunken yang and lifts prolapse.$t$,
  $t$Spleen qi deficiency with sinking of qi: fatigue, shortness of breath, low voice, spontaneous sweating, poor appetite, loose stool, intermittent fever that worsens on exertion, prolapse of the rectum, uterus or stomach, chronic diarrhea, uterine bleeding from deficiency, pale tongue, deficient large pulse. Chronic fatigue, myasthenia, recurrent infections, postpartum urinary retention.$t$,
  $t$Not for yin deficiency with fever, or excess heat.$t$,
  '[{"h":"Huang Qi","d":15},{"h":"Ren Shen","d":9},{"h":"Bai Zhu","d":9},{"h":"Gan Cao","d":6,"n":"honey-fried"},{"h":"Dang Gui","d":6},{"h":"Chen Pi","d":6},{"h":"Sheng Ma","d":3},{"h":"Chai Hu","d":3}]'::jsonb);

perform public.upsert_formula('Sheng Mai San','生脉散','Generate the Pulse Powder','tonify','Yi Xue Qi Yuan (Zhang Yuan-Su, 1186)',
  $t$Augments qi, generates fluids, preserves yin and stops sweating.$t$,
  $t$Qi and yin deficiency with profuse sweating: shortness of breath, fatigue, thirst, dry mouth, palpitations, spontaneous sweating, chronic dry cough with scanty sputum, dry red tongue, deficient rapid or thin pulse. Heat exhaustion, chronic bronchitis, coronary heart disease, recovery from febrile illness.$t$,
  $t$Not while an exterior pathogen or high fever is present, or with copious sputum.$t$,
  '[{"h":"Ren Shen","d":9},{"h":"Mai Men Dong","d":9},{"h":"Wu Wei Zi","d":6}]'::jsonb);

perform public.upsert_formula('Yu Ping Feng San','玉屏风散','Jade Windscreen Powder','tonify','Dan Xi Xin Fa (Zhu Dan-Xi, 1481)',
  $t$Augments qi, stabilizes the exterior and stops sweating.$t$,
  $t$Exterior deficiency with weak protective qi: spontaneous sweating, aversion to wind, pale complexion, recurrent colds, pale tongue with a white coating, floating deficient pulse. Prevention of recurrent respiratory infections, allergic rhinitis, chronic urticaria.$t$,
  $t$Not for night sweats from yin deficiency or during an acute exterior attack.$t$,
  '[{"h":"Huang Qi","d":18},{"h":"Bai Zhu","d":6},{"h":"Fang Feng","d":6}]'::jsonb);

-- ---------------------------------------------------------------------------
-- Tonify blood
-- ---------------------------------------------------------------------------

perform public.upsert_formula('Si Wu Tang','四物汤','Four-Substance Decoction','tonify','Xian Shou Li Shang Xu Duan Mi Fang (Tang dynasty)',
  $t$Tonifies and invigorates the blood and regulates the Liver and menstruation.$t$,
  $t$Blood deficiency with mild stasis: dizziness, blurred vision, pale lips and nails, lusterless complexion, palpitations, insomnia, irregular menses with scanty flow, periumbilical pain, pale tongue, thin wiry or thin choppy pulse. The base of most blood-tonifying and gynecological formulas.$t$,
  $t$Not for heavy bleeding, or for Spleen deficiency with loose stools without modification.$t$,
  '[{"h":"Shu Di Huang","d":12},{"h":"Dang Gui","d":9},{"h":"Bai Shao","d":9},{"h":"Chuan Xiong","d":6}]'::jsonb);

perform public.upsert_formula('Tao Hong Si Wu Tang','桃红四物汤','Four-Substance Decoction with Safflower and Peach Kernel','tonify','Yi Zong Jin Jian (1742)',
  $t$Nourishes blood, invigorates the blood and dispels stasis.$t$,
  $t$Blood deficiency with blood stasis: irregular or painful menses with dark clots, amenorrhea, abdominal pain, purple tongue with dark spots, wiry choppy pulse. Dysmenorrhea, endometriosis, post-surgical adhesions.$t$,
  $t$Contraindicated in pregnancy. Not for heavy bleeding.$t$,
  '[{"h":"Shu Di Huang","d":12},{"h":"Dang Gui","d":9},{"h":"Bai Shao","d":9},{"h":"Chuan Xiong","d":6},{"h":"Tao Ren","d":9},{"h":"Hong Hua","d":6}]'::jsonb);

perform public.upsert_formula('Dang Gui Bu Xue Tang','当归补血汤','Tangkuei Decoction to Tonify the Blood','tonify','Nei Wai Shang Bian Huo Lun (Li Dong-Yuan, 1247)',
  $t$Tonifies qi to generate blood.$t$,
  $t$Consumptive blood deficiency with floating yang: fever, red face, thirst for warm drinks, irritability, large but weak pulse; also blood loss after childbirth or surgery, and sores that fail to heal. Huang Qi is five times the dose of Dang Gui.$t$,
  $t$Not for fever from yin deficiency or excess heat.$t$,
  '[{"h":"Huang Qi","d":30},{"h":"Dang Gui","d":6}]'::jsonb);

perform public.upsert_formula('Gui Pi Tang','归脾汤','Restore the Spleen Decoction','tonify','Ji Sheng Fang (Yan Yong-He, 1253)',
  $t$Augments qi, tonifies the blood, strengthens the Spleen and nourishes the Heart.$t$,
  $t$Heart and Spleen deficiency with qi and blood insufficiency: palpitations, insomnia, forgetfulness, anxiety, fatigue, poor appetite, pale complexion; Spleen failing to control blood: heavy or prolonged menses, subcutaneous bleeding, bloody stool; pale tongue, thin weak pulse. Anemia, thrombocytopenia, insomnia from overthinking, menorrhagia.$t$,
  $t$Not for excess heat or damp patterns.$t$,
  '[{"h":"Ren Shen","d":6},{"h":"Huang Qi","d":12},{"h":"Bai Zhu","d":9},{"h":"Fu Shen","d":9},{"h":"Suan Zao Ren","d":12},{"h":"Long Yan Rou","d":9},{"h":"Mu Xiang","d":6},{"h":"Gan Cao","d":3,"n":"honey-fried"},{"h":"Dang Gui","d":9},{"h":"Yuan Zhi","d":6},{"h":"Sheng Jiang","d":3},{"h":"Da Zao","d":6}]'::jsonb);

perform public.upsert_formula('Ba Zhen Tang','八珍汤','Eight-Treasure Decoction','tonify','Zheng Ti Lei Yao (Xue Ji, 1529)',
  $t$Tonifies qi and blood together.$t$,
  $t$Qi and blood deficiency: pale or sallow complexion, dizziness, palpitations, fatigue, shortness of breath, poor appetite, irregular menses, pale tongue with a thin white coating, thin weak pulse. Anemia, recovery after illness, surgery or childbirth.$t$,
  $t$Not for excess patterns or when a pathogen is present.$t$,
  '[{"h":"Ren Shen","d":9},{"h":"Bai Zhu","d":9},{"h":"Fu Ling","d":9},{"h":"Gan Cao","d":5,"n":"honey-fried"},{"h":"Shu Di Huang","d":12},{"h":"Dang Gui","d":9},{"h":"Bai Shao","d":9},{"h":"Chuan Xiong","d":6}]'::jsonb);

perform public.upsert_formula('Shi Quan Da Bu Tang','十全大补汤','All-Inclusive Great Tonifying Decoction','tonify','Tai Ping Hui Min He Ji Ju Fang',
  $t$Warms and tonifies qi and blood.$t$,
  $t$Qi and blood deficiency with cold: pale complexion, fatigue, cold limbs, dizziness, spontaneous sweating, poor appetite, chronic non-healing sores, uterine bleeding from deficiency, pale tongue, thin weak pulse. Convalescence, anemia, chemotherapy support.$t$,
  $t$Not for heat patterns or yin deficiency with fire.$t$,
  '[{"h":"Ren Shen","d":9},{"h":"Bai Zhu","d":9},{"h":"Fu Ling","d":9},{"h":"Gan Cao","d":5,"n":"honey-fried"},{"h":"Shu Di Huang","d":12},{"h":"Dang Gui","d":9},{"h":"Bai Shao","d":9},{"h":"Chuan Xiong","d":6},{"h":"Huang Qi","d":12},{"h":"Rou Gui","d":3}]'::jsonb);

perform public.upsert_formula('Zhi Gan Cao Tang','炙甘草汤','Honey-Fried Licorice Decoction','tonify','Shang Han Lun',
  $t$Augments qi, nourishes blood, enriches yin and restores the pulse.$t$,
  $t$Qi and blood deficiency with an irregular pulse: palpitations, intermittent or knotted pulse, shortness of breath, fatigue, emaciation, dry mouth and throat, constipation, pale shiny tongue. Arrhythmias, post-viral myocarditis, hyperthyroid palpitations.$t$,
  $t$Not for damp patterns or Spleen deficiency with loose stools. Traditionally decocted with wine.$t$,
  '[{"h":"Gan Cao","d":12,"n":"honey-fried"},{"h":"Sheng Jiang","d":9},{"h":"Gui Zhi","d":9},{"h":"Ren Shen","d":6},{"h":"Sheng Di Huang","d":30},{"h":"E Jiao","d":6,"n":"melt into the strained decoction"},{"h":"Mai Men Dong","d":9},{"h":"Huo Ma Ren","d":9},{"h":"Da Zao","d":12,"n":"10 pieces in the source"}]'::jsonb);

-- ---------------------------------------------------------------------------
-- Tonify yin
-- ---------------------------------------------------------------------------

perform public.upsert_formula('Liu Wei Di Huang Wan','六味地黄丸','Six-Ingredient Pill with Rehmannia','tonify','Xiao Er Yao Zheng Zhi Jue (Qian Yi, 1119)',
  $t$Enriches Kidney yin and gently drains the turbid, three tonics balanced by three draining herbs.$t$,
  $t$Kidney and Liver yin deficiency: weak sore lower back and knees, dizziness, tinnitus, deafness, night sweats, spermatorrhea, hot palms and soles, dry mouth, toothache, delayed closing of the fontanelle in children, red tongue with little coating, thin rapid pulse. Hypertension, diabetes, chronic nephritis, menopausal syndrome, chronic prostatitis.$t$,
  $t$Not for Spleen deficiency with loose stools or for damp patterns.$t$,
  '[{"h":"Shu Di Huang","d":24},{"h":"Shan Zhu Yu","d":12},{"h":"Shan Yao","d":12},{"h":"Ze Xie","d":9},{"h":"Mu Dan Pi","d":9},{"h":"Fu Ling","d":9}]'::jsonb);

perform public.upsert_formula('Zhi Bai Di Huang Wan','知柏地黄丸','Anemarrhena, Phellodendron and Rehmannia Pill','tonify','Yi Zong Jin Jian',
  $t$Enriches yin and drains deficiency fire.$t$,
  $t$Yin deficiency with vigorous fire: steaming-bone fever, night sweats, tidal fever, dry mouth, hot palms and soles, tinnitus, spermatorrhea, dark painful urination, red tongue with a dry coating, thin rapid pulse. Chronic urinary tract infection, hyperthyroidism, menopausal hot flushes, tuberculosis.$t$,
  $t$Not for Spleen deficiency or cold patterns.$t$,
  '[{"h":"Shu Di Huang","d":24},{"h":"Shan Zhu Yu","d":12},{"h":"Shan Yao","d":12},{"h":"Ze Xie","d":9},{"h":"Mu Dan Pi","d":9},{"h":"Fu Ling","d":9},{"h":"Zhi Mu","d":6},{"h":"Huang Bai","d":6}]'::jsonb);

perform public.upsert_formula('Qi Ju Di Huang Wan','杞菊地黄丸','Lycium Fruit, Chrysanthemum and Rehmannia Pill','tonify','Yi Ji (Dong Xi-Yuan, 1777)',
  $t$Enriches Liver and Kidney yin and brightens the eyes.$t$,
  $t$Liver and Kidney yin deficiency with eye symptoms: blurred vision, dry painful eyes, photophobia, tearing in wind, dizziness, tinnitus, red tongue with little coating, thin pulse. Dry eye, early cataract, optic atrophy, hypertension with dizziness.$t$,
  $t$Not for Spleen deficiency with loose stools.$t$,
  '[{"h":"Shu Di Huang","d":24},{"h":"Shan Zhu Yu","d":12},{"h":"Shan Yao","d":12},{"h":"Ze Xie","d":9},{"h":"Mu Dan Pi","d":9},{"h":"Fu Ling","d":9},{"h":"Gou Qi Zi","d":9},{"h":"Ju Hua","d":9}]'::jsonb);

perform public.upsert_formula('Mai Wei Di Huang Wan','麦味地黄丸','Ophiopogon, Schisandra and Rehmannia Pill','tonify','Yi Ji',
  $t$Enriches Lung and Kidney yin, astringes the Lung and stops cough.$t$,
  $t$Lung and Kidney yin deficiency: chronic dry cough, wheezing on exertion, night sweats, tidal fever, dry throat, weak lower back, red tongue with little coating, thin rapid pulse. Chronic bronchitis, tuberculosis, asthma in the elderly. Also called Ba Xian Chang Shou Wan.$t$,
  $t$Not for cough with copious sputum or an exterior pathogen.$t$,
  '[{"h":"Shu Di Huang","d":24},{"h":"Shan Zhu Yu","d":12},{"h":"Shan Yao","d":12},{"h":"Ze Xie","d":9},{"h":"Mu Dan Pi","d":9},{"h":"Fu Ling","d":9},{"h":"Mai Men Dong","d":9},{"h":"Wu Wei Zi","d":6}]'::jsonb);

perform public.upsert_formula('Zuo Gui Wan','左归丸','Restore the Left (Kidney) Pill','tonify','Jing Yue Quan Shu (Zhang Jing-Yue, 1624)',
  $t$Enriches Kidney yin, fills essence and marrow, and tonifies the yin with a little yang.$t$,
  $t$Pure Kidney yin and essence deficiency: dizziness, tinnitus, weak lower back and legs, night sweats, spermatorrhea, dry mouth, forgetfulness, delayed development in children, red tongue with little coating, thin pulse. Osteoporosis, infertility, premature ovarian failure.$t$,
  $t$Cloying: not for Spleen deficiency, dampness or phlegm. Purely tonifying, no draining herbs.$t$,
  '[{"h":"Shu Di Huang","d":24},{"h":"Shan Yao","d":12},{"h":"Gou Qi Zi","d":12},{"h":"Shan Zhu Yu","d":12},{"h":"Niu Xi","d":9},{"h":"Tu Si Zi","d":12},{"h":"Lu Jiao Jiao","d":12,"n":"melt into the strained decoction"},{"h":"Gui Jia","d":12,"n":"as tortoise shell glue (Gui Ban Jiao)"}]'::jsonb);

perform public.upsert_formula('Da Bu Yin Wan','大补阴丸','Great Tonify the Yin Pill','tonify','Dan Xi Xin Fa',
  $t$Enriches yin and directs fire downward.$t$,
  $t$Yin deficiency with blazing fire: steaming-bone fever, night sweats, cough with blood-streaked sputum, irritability, hot and weak knees and legs, spermatorrhea, red tongue with little coating, rapid forceful pulse in the rear positions. Tuberculosis, hyperthyroidism, diabetes.$t$,
  $t$Not for Spleen and Stomach deficiency with loose stools. The source uses pig spinal marrow and honey as the binder.$t$,
  '[{"h":"Shu Di Huang","d":18},{"h":"Gui Jia","d":18,"n":"decoct first"},{"h":"Huang Bai","d":12},{"h":"Zhi Mu","d":12}]'::jsonb);

perform public.upsert_formula('Yi Guan Jian','一贯煎','Linking Decoction','tonify','Liu Zhou Yi Hua (Wei Zhi-Xiu, 1770)',
  $t$Enriches Liver and Kidney yin and spreads Liver qi.$t$,
  $t$Liver and Kidney yin deficiency with qi stagnation: chest and flank pain, epigastric pain, dry mouth and throat, acid reflux, irritability, hernia, red dry tongue, thin wiry or deficient pulse. Chronic hepatitis, peptic ulcer, chronic gastritis, intercostal neuralgia.$t$,
  $t$Not for damp or phlegm patterns with a greasy coating.$t$,
  '[{"h":"Bei Sha Shen","d":9},{"h":"Mai Men Dong","d":9},{"h":"Dang Gui","d":9},{"h":"Sheng Di Huang","d":24},{"h":"Gou Qi Zi","d":12},{"h":"Chuan Lian Zi","d":4.5}]'::jsonb);

perform public.upsert_formula('Er Zhi Wan','二至丸','Two-Solstice Pill','tonify','Yi Bian (1747)',
  $t$Tonifies Liver and Kidney yin without cloying.$t$,
  $t$Liver and Kidney yin deficiency: dizziness, blurred vision, premature graying, weak lower back and knees, insomnia, dream-disturbed sleep, heavy menses from yin deficiency, red tongue, thin pulse. Gentle enough for long-term use.$t$,
  $t$Not for Spleen deficiency with loose stools.$t$,
  '[{"h":"Nu Zhen Zi","d":9},{"h":"Mo Han Lian","d":9}]'::jsonb);

-- ---------------------------------------------------------------------------
-- Tonify yang
-- ---------------------------------------------------------------------------

perform public.upsert_formula('Jin Gui Shen Qi Wan','金匮肾气丸','Kidney Qi Pill from the Golden Cabinet','tonify','Jin Gui Yao Lue',
  $t$Warms and tonifies Kidney yang by gently kindling the fire within the water.$t$,
  $t$Kidney yang deficiency: weak cold lower back and legs, cold lower body, frequent or difficult urination, nocturia, edema, impotence, wheezing on exertion, wasting-thirst, pale swollen tongue with a white coating, deficient weak pulse in the rear positions. Chronic nephritis, benign prostatic hypertrophy, diabetes, hypothyroidism, chronic asthma.$t$,
  $t$Not for yin deficiency with fire, or dry throat and red tongue.$t$,
  '[{"h":"Shu Di Huang","d":24,"n":"Sheng Di Huang in the source"},{"h":"Shan Yao","d":12},{"h":"Shan Zhu Yu","d":12},{"h":"Ze Xie","d":9},{"h":"Fu Ling","d":9},{"h":"Mu Dan Pi","d":9},{"h":"Gui Zhi","d":3},{"h":"Fu Zi","d":3,"n":"decoct first, 60 minutes"}]'::jsonb);

perform public.upsert_formula('You Gui Wan','右归丸','Restore the Right (Kidney) Pill','tonify','Jing Yue Quan Shu',
  $t$Warms and tonifies Kidney yang, fills essence and nourishes blood.$t$,
  $t$Kidney yang deficiency with declining fire of the gate of vitality: cold intolerance, cold limbs, weak lower back and knees, impotence, spermatorrhea, infertility, daybreak diarrhea, edema, pale tongue, deep slow pulse. Osteoporosis, hypothyroidism, chronic nephritis, male and female infertility.$t$,
  $t$Not for yin deficiency with fire or damp-heat. Purely tonifying.$t$,
  '[{"h":"Shu Di Huang","d":24},{"h":"Shan Yao","d":12},{"h":"Shan Zhu Yu","d":9},{"h":"Gou Qi Zi","d":12},{"h":"Du Zhong","d":12},{"h":"Tu Si Zi","d":12},{"h":"Fu Zi","d":6,"n":"decoct first, 60 minutes"},{"h":"Rou Gui","d":6},{"h":"Dang Gui","d":9},{"h":"Lu Jiao Jiao","d":12,"n":"melt into the strained decoction"}]'::jsonb);

perform public.upsert_formula('Er Xian Tang','二仙汤','Two-Immortal Decoction','tonify','Shanghai (1950s, Zhang Bo-Na)',
  $t$Warms Kidney yang, enriches Kidney yin, drains deficiency fire and regulates the Chong and Ren.$t$,
  $t$Kidney yin and yang deficiency with flaring fire: menopausal hot flushes, sweating, irritability, insomnia, palpitations, hypertension, fatigue, weak lower back, frequent urination, pale or red tongue, thin pulse. Menopausal syndrome, hypertension in menopause, amenorrhea.$t$,
  $t$Not for pure yin deficiency or pure yang deficiency without mixed signs.$t$,
  '[{"h":"Xian Mao","d":9},{"h":"Yin Yang Huo","d":9},{"h":"Ba Ji Tian","d":9},{"h":"Dang Gui","d":9},{"h":"Huang Bai","d":6},{"h":"Zhi Mu","d":6}]'::jsonb);

-- ---------------------------------------------------------------------------
-- Regulate qi
-- ---------------------------------------------------------------------------

perform public.upsert_formula('Yue Ju Wan','越鞠丸','Escape Restraint Pill','regulate_qi','Dan Xi Xin Fa',
  $t$Moves qi and releases the six constraints of qi, blood, phlegm, fire, dampness and food.$t$,
  $t$Constraint with qi stagnation at the root: chest and epigastric fullness and pain, belching, acid reflux, nausea, poor appetite, indigestion, depression, thin greasy coating, wiry pulse. Functional dyspepsia, depression with digestive symptoms, PMS.$t$,
  $t$Not for constraint from deficiency.$t$,
  '[{"h":"Xiang Fu","d":9},{"h":"Chuan Xiong","d":9},{"h":"Cang Zhu","d":9},{"h":"Zhi Zi","d":9},{"h":"Shen Qu","d":9}]'::jsonb);

perform public.upsert_formula('Chai Hu Shu Gan San','柴胡疏肝散','Bupleurum Powder to Spread the Liver','regulate_qi','Jing Yue Quan Shu',
  $t$Spreads Liver qi, moves blood and alleviates pain.$t$,
  $t$Liver qi constraint: flank and chest pain and distention, irritability, belching, sighing, epigastric fullness, alternating chills and fever, thin white coating, wiry pulse. Chronic hepatitis, cholecystitis, intercostal neuralgia, functional dyspepsia, PMS.$t$,
  $t$Drying and dispersing: not for yin deficiency or for prolonged use.$t$,
  '[{"h":"Chai Hu","d":6},{"h":"Chen Pi","d":6},{"h":"Chuan Xiong","d":4.5},{"h":"Xiang Fu","d":4.5},{"h":"Zhi Ke","d":4.5},{"h":"Bai Shao","d":4.5},{"h":"Gan Cao","d":1.5,"n":"honey-fried"}]'::jsonb);

perform public.upsert_formula('Ban Xia Hou Po Tang','半夏厚朴汤','Pinellia and Magnolia Bark Decoction','regulate_qi','Jin Gui Yao Lue',
  $t$Moves qi, dissipates clumps, directs rebellious qi downward and transforms phlegm.$t$,
  $t$Phlegm and qi binding in the throat (plum-pit qi): sensation of something stuck in the throat that cannot be swallowed or coughed up, chest and flank fullness, cough, nausea, white greasy coating, wiry slippery pulse. Globus hystericus, chronic pharyngitis, anxiety, esophageal spasm, GERD.$t$,
  $t$Warming and drying: not for plum-pit qi from yin deficiency with a red tongue.$t$,
  '[{"h":"Ban Xia","d":12},{"h":"Hou Po","d":9},{"h":"Fu Ling","d":12},{"h":"Sheng Jiang","d":15},{"h":"Zi Su Ye","d":6}]'::jsonb);

perform public.upsert_formula('Gua Lou Xie Bai Bai Jiu Tang','栝楼薤白白酒汤','Trichosanthes, Chinese Garlic and Wine Decoction','regulate_qi','Jin Gui Yao Lue',
  $t$Unblocks yang, moves qi, dispels phlegm and opens the chest.$t$,
  $t$Chest painful obstruction from phlegm blocking yang: chest and back pain, stifling sensation, shortness of breath, wheezing, cough with sputum, white greasy coating, deep wiry or tight pulse. Angina, coronary heart disease, intercostal neuralgia, chronic bronchitis.$t$,
  $t$Not for chest pain from qi or yin deficiency without phlegm.$t$,
  '[{"h":"Gua Lou","d":12},{"h":"Xie Bai","d":9},{"h":"Bai Jiu","d":30,"n":"rice wine, added to the decoction"}]'::jsonb);

perform public.upsert_formula('Tian Tai Wu Yao San','天台乌药散','Top-Quality Lindera Powder','regulate_qi','Yi Xue Fa Ming (Li Dong-Yuan, 13th c.)',
  $t$Moves qi, spreads the Liver, disperses cold and alleviates pain.$t$,
  $t$Cold stagnating in the Liver channel: lower abdominal pain radiating to the testicles, hernia pain, testicular swelling, dysmenorrhea from cold, white coating, deep wiry pulse. Inguinal hernia, epididymitis, orchitis.$t$,
  $t$Not for hernia from damp-heat. In the source Chuan Lian Zi is processed with Ba Dou, which is then discarded.$t$,
  '[{"h":"Wu Yao","d":12},{"h":"Mu Xiang","d":6},{"h":"Xiao Hui Xiang","d":6},{"h":"Qing Pi","d":6},{"h":"Gao Liang Jiang","d":9},{"h":"Bing Lang","d":9},{"h":"Chuan Lian Zi","d":12}]'::jsonb);

perform public.upsert_formula('Su Zi Jiang Qi Tang','苏子降气汤','Perilla Fruit Decoction for Directing Qi Downward','regulate_qi','Tai Ping Hui Min He Ji Ju Fang',
  $t$Directs rebellious qi downward, calms wheezing, warms and transforms phlegm and tonifies the Kidney.$t$,
  $t$Excess above and deficiency below: cough and wheezing with copious sputum, stifling chest, shortness of breath worse on exertion, weak sore lower back, edema of the legs, fatigue, white greasy or slippery coating, slippery wiry pulse. Chronic bronchitis, emphysema, asthma in the elderly.$t$,
  $t$Not for wheezing from Lung and Kidney deficiency alone, or from heat.$t$,
  '[{"h":"Zi Su Zi","d":9},{"h":"Ban Xia","d":9},{"h":"Hou Po","d":6},{"h":"Qian Hu","d":6},{"h":"Rou Gui","d":3},{"h":"Dang Gui","d":6},{"h":"Gan Cao","d":6,"n":"honey-fried"},{"h":"Sheng Jiang","d":3},{"h":"Zi Su Ye","d":3},{"h":"Da Zao","d":3}]'::jsonb);

perform public.upsert_formula('Ding Chuan Tang','定喘汤','Arrest Wheezing Decoction','regulate_qi','She Sheng Zhong Miao Fang (Zhang Shi-Che, 1550)',
  $t$Disperses wind-cold, clears heat, transforms phlegm, directs qi downward and calms wheezing.$t$,
  $t$Wind-cold on the exterior with phlegm-heat in the Lung: cough and wheezing with thick yellow sputum, chest oppression, fever, slight chills, greasy yellow coating, slippery rapid pulse. Asthma, acute bronchitis, exacerbation of COPD.$t$,
  $t$Not for wheezing from deficiency, or for a cold pattern without heat. Bai Guo is dosed with care (toxic in excess).$t$,
  '[{"h":"Bai Guo","d":9},{"h":"Ma Huang","d":9},{"h":"Zi Su Zi","d":6},{"h":"Gan Cao","d":3},{"h":"Kuan Dong Hua","d":9},{"h":"Xing Ren","d":4.5},{"h":"Sang Bai Pi","d":9},{"h":"Huang Qin","d":4.5},{"h":"Ban Xia","d":9}]'::jsonb);

perform public.upsert_formula('Xuan Fu Dai Zhe Tang','旋覆代赭汤','Inula and Hematite Decoction','regulate_qi','Shang Han Lun',
  $t$Directs rebellious qi downward, transforms phlegm, augments qi and harmonizes the Stomach.$t$,
  $t$Stomach qi deficiency with phlegm and rebellious qi: epigastric hardness and fullness, persistent belching, hiccup, nausea, vomiting, white slippery coating, wiry deficient pulse. Gastritis, GERD, functional dyspepsia, hiccup after surgery.$t$,
  $t$Not for rebellious qi from heat or in pregnancy (Dai Zhe Shi). Xuan Fu Hua in a bag.$t$,
  '[{"h":"Xuan Fu Hua","d":9,"n":"in a bag"},{"h":"Dai Zhe Shi","d":9,"n":"decoct first"},{"h":"Ren Shen","d":6},{"h":"Ban Xia","d":9},{"h":"Sheng Jiang","d":10},{"h":"Gan Cao","d":6,"n":"honey-fried"},{"h":"Da Zao","d":12,"n":"4 pieces"}]'::jsonb);

perform public.upsert_formula('Ju Pi Zhu Ru Tang','橘皮竹茹汤','Tangerine Peel and Bamboo Shavings Decoction','regulate_qi','Jin Gui Yao Lue',
  $t$Directs rebellious qi downward, stops hiccup, clears heat and augments qi.$t$,
  $t$Stomach deficiency with heat and rebellious qi: hiccup, dry heaves, vomiting, thirst, red tender tongue, deficient rapid pulse. Hiccup after illness or surgery, morning sickness, gastritis.$t$,
  $t$Not for hiccup from cold or excess.$t$,
  '[{"h":"Chen Pi","d":12},{"h":"Zhu Ru","d":12},{"h":"Ren Shen","d":3},{"h":"Sheng Jiang","d":9},{"h":"Gan Cao","d":6,"n":"honey-fried"},{"h":"Da Zao","d":5}]'::jsonb);

perform public.upsert_formula('Ding Xiang Shi Di Tang','丁香柿蒂汤','Clove and Persimmon Calyx Decoction','regulate_qi','Zheng Yin Mai Zhi (Qin Jing-Ming, 1702)',
  $t$Warms the middle, augments qi, directs rebellious qi downward and stops hiccup.$t$,
  $t$Stomach deficiency cold with rebellious qi: hiccup, belching, vomiting, epigastric fullness, poor appetite, pale tongue with a white coating, deep slow pulse.$t$,
  $t$Not for hiccup from Stomach heat.$t$,
  '[{"h":"Ding Xiang","d":6},{"h":"Shi Di","d":9},{"h":"Ren Shen","d":3},{"h":"Sheng Jiang","d":6}]'::jsonb);

-- ---------------------------------------------------------------------------
-- Invigorate blood and dispel stasis
-- ---------------------------------------------------------------------------

perform public.upsert_formula('Xue Fu Zhu Yu Tang','血府逐瘀汤','Drive Out Stasis from the Mansion of Blood Decoction','invigorate_blood','Yi Lin Gai Cuo (Wang Qing-Ren, 1830)',
  $t$Invigorates the blood, dispels stasis, spreads Liver qi and unblocks the channels.$t$,
  $t$Blood stasis in the chest with qi constraint: chronic stabbing chest pain in a fixed location, headache, chronic hiccup, insomnia, palpitations, irritability, evening fever, dark red or purple tongue with dark spots, choppy or wiry tight pulse. Coronary heart disease, post-concussion headache, chronic insomnia, depression.$t$,
  $t$Contraindicated in pregnancy. Not for absence of stasis or with heavy bleeding.$t$,
  '[{"h":"Tao Ren","d":12},{"h":"Hong Hua","d":9},{"h":"Dang Gui","d":9},{"h":"Sheng Di Huang","d":9},{"h":"Chuan Xiong","d":4.5},{"h":"Chi Shao","d":6},{"h":"Niu Xi","d":9},{"h":"Jie Geng","d":4.5},{"h":"Chai Hu","d":3},{"h":"Zhi Ke","d":6},{"h":"Gan Cao","d":3}]'::jsonb);

perform public.upsert_formula('Bu Yang Huan Wu Tang','补阳还五汤','Tonify the Yang to Restore Five-Tenths Decoction','invigorate_blood','Yi Lin Gai Cuo',
  $t$Tonifies qi, invigorates the blood and unblocks the collaterals.$t$,
  $t$Sequelae of wind-stroke from qi deficiency with blood stasis: hemiplegia, facial paralysis, slurred speech, drooling, urinary incontinence, atrophy of the limbs, pale tongue with a white coating, moderate weak pulse. Post-stroke rehabilitation, peripheral neuropathy, post-polio. Huang Qi is dosed very high relative to the rest.$t$,
  $t$Not for stroke from Liver yang rising or phlegm-heat, or in the acute phase with a full pulse. Continue for months once effective.$t$,
  '[{"h":"Huang Qi","d":120},{"h":"Dang Gui","d":6,"n":"tail"},{"h":"Chi Shao","d":4.5},{"h":"Di Long","d":3},{"h":"Chuan Xiong","d":3},{"h":"Hong Hua","d":3},{"h":"Tao Ren","d":3}]'::jsonb);

perform public.upsert_formula('Fu Yuan Huo Xue Tang','复元活血汤','Revive Health by Invigorating the Blood Decoction','invigorate_blood','Yi Xue Fa Ming',
  $t$Invigorates the blood, dispels stasis, spreads Liver qi and unblocks the collaterals.$t$,
  $t$Trauma with blood stasis in the flanks: severe pain of the chest and flanks after injury, bruising, restricted movement, purple tongue, choppy pulse. Rib contusion, post-surgical pain, intercostal neuralgia after trauma.$t$,
  $t$Contraindicated in pregnancy. Stop once the bowels move loosely. The source uses Chuan Shan Jia (pangolin, now CITES-banned); Wang Bu Liu Xing is the usual substitute.$t$,
  '[{"h":"Chai Hu","d":15},{"h":"Tian Hua Fen","d":9},{"h":"Dang Gui","d":9},{"h":"Hong Hua","d":6},{"h":"Gan Cao","d":6},{"h":"Wang Bu Liu Xing","d":9,"n":"substitute for pangolin scale"},{"h":"Da Huang","d":30,"n":"wine-washed"},{"h":"Tao Ren","d":9}]'::jsonb);

perform public.upsert_formula('Sheng Hua Tang','生化汤','Generation and Transformation Decoction','invigorate_blood','Fu Qing Zhu Nu Ke (Fu Shan, 1826)',
  $t$Invigorates the blood, transforms stasis, warms the channels and alleviates pain.$t$,
  $t$Postpartum retention of lochia with cold: lochia that stops or is scanty with dark clots, lower abdominal cold pain, pale purple tongue, deep thin choppy pulse. Postpartum recovery, retained placenta fragments, post-miscarriage.$t$,
  $t$Not for postpartum bleeding from heat or for stasis without cold. Traditionally decocted with wine.$t$,
  '[{"h":"Dang Gui","d":24},{"h":"Chuan Xiong","d":9},{"h":"Tao Ren","d":6},{"h":"Gan Jiang","d":2,"n":"blast-fried (Pao Jiang)"},{"h":"Gan Cao","d":2,"n":"honey-fried"}]'::jsonb);

perform public.upsert_formula('Wen Jing Tang','温经汤','Warm the Menses Decoction','invigorate_blood','Jin Gui Yao Lue',
  $t$Warms the channels, dispels cold, nourishes the blood and dispels stasis.$t$,
  $t$Deficiency cold of the Chong and Ren with blood stasis: irregular menses, early or late, prolonged or heavy uterine bleeding, dysmenorrhea, amenorrhea, infertility, cold lower abdomen, dry lips and mouth, hot palms and soles, evening fever, pale purple tongue, thin choppy pulse. Dysmenorrhea, infertility, menopausal bleeding, chronic pelvic inflammatory disease.$t$,
  $t$Not for menstrual disorders from heat or excess stasis without deficiency.$t$,
  '[{"h":"Wu Zhu Yu","d":9},{"h":"Gui Zhi","d":6},{"h":"Dang Gui","d":6},{"h":"Chuan Xiong","d":6},{"h":"Bai Shao","d":6},{"h":"E Jiao","d":6,"n":"melt into the strained decoction"},{"h":"Mai Men Dong","d":9},{"h":"Mu Dan Pi","d":6},{"h":"Ren Shen","d":6},{"h":"Gan Cao","d":6},{"h":"Sheng Jiang","d":6},{"h":"Ban Xia","d":6}]'::jsonb);

perform public.upsert_formula('Gui Zhi Fu Ling Wan','桂枝茯苓丸','Cinnamon Twig and Poria Pill','invigorate_blood','Jin Gui Yao Lue',
  $t$Invigorates the blood, transforms stasis and reduces masses gently.$t$,
  $t$Blood stasis with masses in the lower abdomen: fixed abdominal masses, dysmenorrhea with dark clots, amenorrhea, persistent bleeding in pregnancy from stasis with a mass, retained lochia, purple tongue, choppy pulse. Uterine fibroids, ovarian cysts, endometriosis, chronic pelvic inflammation.$t$,
  $t$Caution in pregnancy: only under supervision for the specific classical indication. Gentle; taken as pills over months.$t$,
  '[{"h":"Gui Zhi","d":9},{"h":"Fu Ling","d":9},{"h":"Mu Dan Pi","d":9},{"h":"Tao Ren","d":9},{"h":"Bai Shao","d":9,"n":"Chi Shao may be used instead"}]'::jsonb);

perform public.upsert_formula('Shi Xiao San','失笑散','Sudden Smile Powder','invigorate_blood','Tai Ping Hui Min He Ji Ju Fang',
  $t$Invigorates the blood, dispels stasis and alleviates pain.$t$,
  $t$Blood stasis pain: dysmenorrhea, postpartum abdominal pain, retained lochia, epigastric pain, chest pain, dark clots, purple tongue, choppy pulse. Dysmenorrhea, angina, gastric pain from stasis.$t$,
  $t$Contraindicated in pregnancy. Not for pain from deficiency without stasis. Traditionally taken with vinegar or wine.$t$,
  '[{"h":"Wu Ling Zhi","d":9,"n":"in a bag"},{"h":"Pu Huang","d":9,"n":"in a bag"}]'::jsonb);

perform public.upsert_formula('Dan Shen Yin','丹参饮','Salvia Drink','invigorate_blood','Shi Fang Ge Kuo (Chen Nian-Zu, 1801)',
  $t$Invigorates the blood, dispels stasis, moves qi and alleviates pain.$t$,
  $t$Qi and blood stasis in the middle burner: epigastric and abdominal pain, chest pain, fixed stabbing pain, purple tongue, wiry choppy pulse. Angina, chronic gastritis, peptic ulcer, chest pain from stasis.$t$,
  $t$Not for pain from deficiency without stasis.$t$,
  '[{"h":"Dan Shen","d":30},{"h":"Tan Xiang","d":4.5,"n":"add at the end"},{"h":"Sha Ren","d":4.5,"n":"add at the end"}]'::jsonb);

perform public.upsert_formula('Tao He Cheng Qi Tang','桃核承气汤','Peach Pit Decoction to Order the Qi','invigorate_blood','Shang Han Lun',
  $t$Drives out blood stasis and purges heat from the lower burner.$t$,
  $t$Blood accumulation in the lower burner: acute lower abdominal pain and tension, incontinence with normal urination, delirium, mania, restlessness, tidal fever, thirst, amenorrhea or dysmenorrhea with dark clots, purple tongue, deep excess or choppy pulse. Pelvic inflammatory disease, endometriosis, post-traumatic stasis, acute psychosis with these signs.$t$,
  $t$Contraindicated in pregnancy. Not for deficiency.$t$,
  '[{"h":"Tao Ren","d":12},{"h":"Da Huang","d":12},{"h":"Gui Zhi","d":6},{"h":"Mang Xiao","d":6,"n":"dissolve in the strained decoction"},{"h":"Gan Cao","d":6,"n":"honey-fried"}]'::jsonb);

perform public.upsert_formula('Shao Fu Zhu Yu Tang','少腹逐瘀汤','Drive Out Stasis from the Lower Abdomen Decoction','invigorate_blood','Yi Lin Gai Cuo',
  $t$Invigorates the blood, dispels stasis, warms the channels and alleviates pain.$t$,
  $t$Blood stasis with cold in the lower abdomen: lower abdominal masses with or without pain, dysmenorrhea with dark purple clots, irregular menses, low back pain and distention with menses, infertility, purple tongue, deep wiry choppy pulse. Dysmenorrhea, endometriosis, uterine fibroids, chronic pelvic inflammation, infertility from cold and stasis.$t$,
  $t$Contraindicated in pregnancy. Not for heat patterns.$t$,
  '[{"h":"Xiao Hui Xiang","d":1.5},{"h":"Gan Jiang","d":3},{"h":"Yan Hu Suo","d":3},{"h":"Mo Yao","d":6},{"h":"Dang Gui","d":9},{"h":"Chuan Xiong","d":6},{"h":"Rou Gui","d":3},{"h":"Chi Shao","d":6},{"h":"Pu Huang","d":9,"n":"in a bag"},{"h":"Wu Ling Zhi","d":6,"n":"in a bag"}]'::jsonb);

perform public.upsert_formula('Shen Tong Zhu Yu Tang','身痛逐瘀汤','Drive Out Stasis from a Painful Body Decoction','invigorate_blood','Yi Lin Gai Cuo',
  $t$Invigorates the blood, moves qi, dispels wind-dampness, unblocks the collaterals and alleviates pain.$t$,
  $t$Qi and blood stasis obstructing the channels: chronic fixed pain of the shoulders, arms, back, lower back or legs, joint pain that resists standard bi treatment, purple tongue, choppy pulse. Chronic arthritis, sciatica, fibromyalgia, post-traumatic pain.$t$,
  $t$Contraindicated in pregnancy. Not for bi from deficiency without stasis.$t$,
  '[{"h":"Qin Jiao","d":3},{"h":"Chuan Xiong","d":6},{"h":"Tao Ren","d":9},{"h":"Hong Hua","d":9},{"h":"Gan Cao","d":6},{"h":"Qiang Huo","d":3},{"h":"Mo Yao","d":6},{"h":"Dang Gui","d":9},{"h":"Wu Ling Zhi","d":6,"n":"in a bag"},{"h":"Xiang Fu","d":3},{"h":"Niu Xi","d":9},{"h":"Di Long","d":6}]'::jsonb);

perform public.upsert_formula('Huo Luo Xiao Ling Dan','活络效灵丹','Fantastically Effective Pill to Invigorate the Collaterals','invigorate_blood','Yi Xue Zhong Zhong Can Xi Lu (Zhang Xi-Chun, 1918)',
  $t$Invigorates the blood, dispels stasis, unblocks the collaterals and alleviates pain.$t$,
  $t$Qi and blood stasis in the channels and collaterals: pain anywhere in the body from stasis, trauma, abdominal masses, ulcerated or unulcerated sores, angina, purple tongue, choppy pulse. Angina, trauma, sciatica, dysmenorrhea.$t$,
  $t$Contraindicated in pregnancy. Ru Xiang and Mo Yao may upset the stomach: take after meals.$t$,
  '[{"h":"Dang Gui","d":15},{"h":"Dan Shen","d":15},{"h":"Ru Xiang","d":15},{"h":"Mo Yao","d":15}]'::jsonb);

-- ---------------------------------------------------------------------------
-- Stop bleeding
-- ---------------------------------------------------------------------------

perform public.upsert_formula('Shi Hui San','十灰散','Ten Partially-Charred Substances Powder','stop_bleeding','Shi Yao Shen Shu (Ge Ke-Jiu, 1348)',
  $t$Cools the blood and stops bleeding; all ten ingredients are charred.$t$,
  $t$Bleeding from blood heat in the upper body: hematemesis, hemoptysis, epistaxis, spitting of blood, with irritability, red tongue, rapid pulse. Upper gastrointestinal bleeding, bronchiectasis, pulmonary tuberculosis with hemoptysis.$t$,
  $t$Not for bleeding from deficiency cold. Charred until the surface is black while the inside keeps its nature ("charring preserving the nature").$t$,
  '[{"h":"Da Ji","d":9,"n":"charred"},{"h":"Xiao Ji","d":9,"n":"charred"},{"h":"He Ye","d":9,"n":"charred"},{"h":"Ce Bai Ye","d":9,"n":"charred"},{"h":"Bai Mao Gen","d":9,"n":"charred"},{"h":"Qian Cao","d":9,"n":"charred"},{"h":"Zhi Zi","d":9,"n":"charred"},{"h":"Da Huang","d":9,"n":"charred"},{"h":"Mu Dan Pi","d":9,"n":"charred"},{"h":"Zong Lu Tan","d":9}]'::jsonb);

perform public.upsert_formula('Ke Xue Fang','咳血方','Coughing of Blood Formula','stop_bleeding','Dan Xi Xin Fa',
  $t$Clears fire, transforms phlegm, preserves the Lung and stops bleeding.$t$,
  $t$Liver fire scorching the Lung: coughing of blood-streaked sputum that is hard to expectorate, irritability, flank pain, bitter taste, red cheeks, constipation, red tongue with a yellow coating, wiry rapid pulse. Bronchiectasis, chronic bronchitis with hemoptysis.$t$,
  $t$Not for cough from Lung yin deficiency alone or from cold.$t$,
  '[{"h":"Qing Dai","d":6},{"h":"Gua Lou","d":9,"n":"seed"},{"h":"Fu Hai Shi","d":9},{"h":"Zhi Zi","d":9},{"h":"He Zi","d":6}]'::jsonb);

perform public.upsert_formula('Xiao Ji Yin Zi','小蓟饮子','Cephalanoplos Drink','stop_bleeding','Ji Sheng Fang',
  $t$Cools the blood, stops bleeding, promotes urination and unblocks painful urinary dribbling.$t$,
  $t$Blood in the urine from heat in the lower burner: bloody, painful, burning, frequent urination, thirst, irritability, red tongue with a yellow coating, rapid pulse. Acute urinary tract infection, glomerulonephritis, urinary stones with hematuria.$t$,
  $t$Not for chronic hematuria from deficiency. Use Chuan Mu Tong.$t$,
  '[{"h":"Xiao Ji","d":30},{"h":"Ou Jie","d":9},{"h":"Pu Huang","d":9,"n":"in a bag"},{"h":"Sheng Di Huang","d":30},{"h":"Hua Shi","d":15,"n":"in a bag"},{"h":"Mu Tong","d":9,"n":"Chuan Mu Tong only"},{"h":"Dan Zhu Ye","d":9},{"h":"Zhi Zi","d":9},{"h":"Dang Gui","d":6},{"h":"Gan Cao","d":6,"n":"honey-fried"}]'::jsonb);

perform public.upsert_formula('Huai Hua San','槐花散','Sophora Japonica Flower Powder','stop_bleeding','Pu Ji Ben Shi Fang (Xu Shu-Wei, 1132)',
  $t$Clears intestinal heat, stops bleeding, disperses wind and moves qi.$t$,
  $t$Bleeding from wind-heat or damp-heat in the intestines: bright red blood before or after stool, hemorrhoidal bleeding, red tongue, wiry rapid or soggy rapid pulse. Hemorrhoids, anal fissure, ulcerative colitis with bleeding.$t$,
  $t$Not for bleeding from deficiency cold. Not for prolonged use.$t$,
  '[{"h":"Huai Hua","d":12,"n":"dry-fried"},{"h":"Ce Bai Ye","d":12},{"h":"Jing Jie","d":6,"n":"charred"},{"h":"Zhi Ke","d":6}]'::jsonb);

perform public.upsert_formula('Huang Tu Tang','黄土汤','Yellow Earth Decoction','stop_bleeding','Jin Gui Yao Lue',
  $t$Warms yang, strengthens the Spleen, nourishes blood and stops bleeding.$t$,
  $t$Spleen yang deficiency failing to control blood: dark bloody stool, hematemesis, epistaxis, uterine bleeding with pale complexion, cold limbs, pale tongue, deep thin weak pulse. Chronic gastrointestinal bleeding, peptic ulcer bleeding, functional uterine bleeding.$t$,
  $t$Not for bleeding from heat. Zao Xin Tu (stove earth) is hard to source; Chi Shi Zhi is the usual substitute.$t$,
  '[{"h":"Zao Xin Tu","d":30,"n":"stove earth; Chi Shi Zhi substitutes"},{"h":"Fu Zi","d":9,"n":"decoct first, 60 minutes"},{"h":"Bai Zhu","d":9},{"h":"Sheng Di Huang","d":9},{"h":"E Jiao","d":9,"n":"melt into the strained decoction"},{"h":"Huang Qin","d":9},{"h":"Gan Cao","d":9,"n":"honey-fried"}]'::jsonb);

perform public.upsert_formula('Jiao Ai Tang','胶艾汤','Ass-Hide Gelatin and Mugwort Decoction','stop_bleeding','Jin Gui Yao Lue',
  $t$Nourishes the blood, stops bleeding, regulates menses and calms the fetus.$t$,
  $t$Uterine bleeding from deficiency of the Chong and Ren: prolonged or heavy menses, bleeding during pregnancy, postpartum bleeding, threatened miscarriage, abdominal pain, pale tongue, thin weak pulse. Also called Xiong Gui Jiao Ai Tang.$t$,
  $t$Not for bleeding from heat or stasis. Traditionally decocted with wine.$t$,
  '[{"h":"E Jiao","d":6,"n":"melt into the strained decoction"},{"h":"Ai Ye","d":9},{"h":"Sheng Di Huang","d":12},{"h":"Dang Gui","d":9},{"h":"Chuan Xiong","d":6},{"h":"Bai Shao","d":12},{"h":"Gan Cao","d":6,"n":"honey-fried"}]'::jsonb);

-- ---------------------------------------------------------------------------
-- Stabilize and bind
-- ---------------------------------------------------------------------------

perform public.upsert_formula('Mu Li San','牡蛎散','Oyster Shell Powder','stabilize_bind','Tai Ping Hui Min He Ji Ju Fang',
  $t$Stabilizes the exterior, stops sweating and augments qi.$t$,
  $t$Spontaneous sweating from qi deficiency, or night sweating with mild yin deficiency: profuse sweating worse at night, palpitations, fatigue, shortness of breath, irritability, pale red tongue, thin weak pulse. Post-illness sweating, hyperhidrosis, post-surgical sweating.$t$,
  $t$Not for sweating from an exterior pathogen or from excess heat.$t$,
  '[{"h":"Mu Li","d":30,"n":"calcined; decoct first"},{"h":"Huang Qi","d":30},{"h":"Ma Huang Gen","d":30},{"h":"Fu Xiao Mai","d":30}]'::jsonb);

perform public.upsert_formula('Jin Suo Gu Jing Wan','金锁固精丸','Metal Lock Pill to Stabilize the Essence','stabilize_bind','Yi Fang Ji Jie (Wang Ang, 1682)',
  $t$Tonifies the Kidney, secures essence and stops leakage.$t$,
  $t$Kidney deficiency with unstable essence: chronic spermatorrhea, nocturnal emissions, premature ejaculation, fatigue, weak lower back, tinnitus, pale tongue, thin weak pulse in the rear positions.$t$,
  $t$Not for spermatorrhea from damp-heat or Heart fire. Lian Xu (lotus stamen) may be replaced by more Lian Zi.$t$,
  '[{"h":"Sha Yuan Zi","d":12},{"h":"Qian Shi","d":12},{"h":"Lian Zi","d":12},{"h":"Lian Xu","d":6,"n":"lotus stamen"},{"h":"Long Gu","d":15,"n":"calcined; decoct first"},{"h":"Mu Li","d":15,"n":"calcined; decoct first"}]'::jsonb);

perform public.upsert_formula('Sang Piao Xiao San','桑螵蛸散','Mantis Egg-Case Powder','stabilize_bind','Ben Cao Yan Yi (Kou Zong-Shi, 1116)',
  $t$Regulates and tonifies the Heart and Kidney, secures essence and stops urination.$t$,
  $t$Heart and Kidney deficiency with unstable essence: frequent urination, enuresis, incontinence, cloudy urine, spermatorrhea, forgetfulness, disorientation, pale tongue with a white coating, thin slow pulse. Enuresis in children, urinary frequency in the elderly, neurogenic bladder.$t$,
  $t$Not for urinary frequency from damp-heat in the Bladder.$t$,
  '[{"h":"Sang Piao Xiao","d":9},{"h":"Yuan Zhi","d":6},{"h":"Shi Chang Pu","d":6},{"h":"Long Gu","d":15,"n":"decoct first"},{"h":"Ren Shen","d":9},{"h":"Fu Shen","d":9},{"h":"Dang Gui","d":9},{"h":"Gui Jia","d":15,"n":"decoct first"}]'::jsonb);

perform public.upsert_formula('Suo Quan Wan','缩泉丸','Restrict the Fountain Pill','stabilize_bind','Fu Ren Liang Fang (Chen Zi-Ming, 1237)',
  $t$Warms the Kidney, dispels cold, secures urine and stops frequency.$t$,
  $t$Kidney deficiency cold with unstable Bladder: frequent clear urination, enuresis, nocturia, incontinence, cold lower back, pale tongue with a white coating, deep weak pulse. Enuresis in children, overactive bladder, urinary frequency in the elderly.$t$,
  $t$Not for urinary frequency from heat.$t$,
  '[{"h":"Wu Yao","d":9},{"h":"Yi Zhi Ren","d":9},{"h":"Shan Yao","d":9}]'::jsonb);

perform public.upsert_formula('Si Shen Wan','四神丸','Four-Miracle Pill','stabilize_bind','Nei Ke Zhai Yao (Xue Ji, 16th c.)',
  $t$Warms and tonifies the Spleen and Kidney, astringes the intestines and stops diarrhea.$t$,
  $t$Spleen and Kidney yang deficiency: daybreak (cock-crow) diarrhea, chronic diarrhea with undigested food, abdominal pain, poor appetite, cold limbs, weak lower back, fatigue, pale tongue with a white coating, deep slow weak pulse. Chronic colitis, IBS with morning diarrhea, intestinal tuberculosis.$t$,
  $t$Not for diarrhea from damp-heat or food stagnation.$t$,
  '[{"h":"Bu Gu Zhi","d":12},{"h":"Wu Zhu Yu","d":3},{"h":"Rou Dou Kou","d":6,"n":"roasted"},{"h":"Wu Wei Zi","d":6},{"h":"Sheng Jiang","d":6},{"h":"Da Zao","d":9}]'::jsonb);

perform public.upsert_formula('Zhen Ren Yang Zang Tang','真人养脏汤','True Man''s Decoction to Nourish the Organs','stabilize_bind','Tai Ping Hui Min He Ji Ju Fang',
  $t$Warms the middle, tonifies deficiency, astringes the intestines and stops diarrhea.$t$,
  $t$Chronic diarrhea or dysentery from Spleen and Kidney deficiency cold with unstable intestines: unremitting diarrhea, incontinence of stool, rectal prolapse, abdominal pain that likes warmth and pressure, poor appetite, fatigue, pale tongue with a white coating, slow thin pulse. Chronic colitis, chronic dysentery, rectal prolapse.$t$,
  $t$Not for diarrhea with a pathogen still present. The source contains Ying Su Ke (poppy husk), a controlled substance omitted here; increase He Zi and Rou Dou Kou instead.$t$,
  '[{"h":"Ren Shen","d":6},{"h":"Dang Gui","d":9},{"h":"Bai Zhu","d":12},{"h":"Rou Dou Kou","d":12,"n":"roasted"},{"h":"Rou Gui","d":3},{"h":"Gan Cao","d":6,"n":"honey-fried"},{"h":"Bai Shao","d":15},{"h":"Mu Xiang","d":9},{"h":"He Zi","d":12}]'::jsonb);

perform public.upsert_formula('Gu Chong Tang','固冲汤','Stabilize Gushing Decoction','stabilize_bind','Yi Xue Zhong Zhong Can Xi Lu',
  $t$Augments qi, strengthens the Spleen, secures the Chong and stops uterine bleeding.$t$,
  $t$Uterine bleeding from Spleen qi deficiency with unstable Chong: profuse or continuous menstrual bleeding that is thin and pale, palpitations, shortness of breath, fatigue, weak lower back, pale tongue, deficient large or thin weak pulse. Dysfunctional uterine bleeding, menorrhagia, postpartum hemorrhage from deficiency.$t$,
  $t$Not for bleeding from heat or stasis. Wu Bei Zi is taken as powder with the decoction.$t$,
  '[{"h":"Bai Zhu","d":30},{"h":"Huang Qi","d":18},{"h":"Long Gu","d":24,"n":"calcined; decoct first"},{"h":"Mu Li","d":24,"n":"calcined; decoct first"},{"h":"Shan Zhu Yu","d":24},{"h":"Bai Shao","d":12},{"h":"Hai Piao Xiao","d":12},{"h":"Qian Cao","d":9},{"h":"Zong Lu Tan","d":6},{"h":"Wu Bei Zi","d":1.5,"n":"gallnut; powder"}]'::jsonb);

perform public.upsert_formula('Wan Dai Tang','完带汤','End Discharge Decoction','stabilize_bind','Fu Qing Zhu Nu Ke',
  $t$Tonifies the Spleen, spreads the Liver, transforms dampness and stops leukorrhea.$t$,
  $t$Leukorrhea from Spleen deficiency with Liver constraint and dampness: profuse thin white or pale yellow discharge without odor, fatigue, poor appetite, loose stool, pale complexion, pale tongue with a white coating, soggy weak pulse. Chronic vaginitis, cervicitis, chronic pelvic inflammation.$t$,
  $t$Not for leukorrhea from damp-heat (yellow, foul) or Kidney deficiency.$t$,
  '[{"h":"Bai Zhu","d":30},{"h":"Shan Yao","d":30},{"h":"Ren Shen","d":6},{"h":"Bai Shao","d":15},{"h":"Che Qian Zi","d":9,"n":"in a bag"},{"h":"Cang Zhu","d":9},{"h":"Gan Cao","d":3},{"h":"Chen Pi","d":1.5},{"h":"Jing Jie","d":1.5,"n":"charred"},{"h":"Chai Hu","d":1.8}]'::jsonb);

perform public.upsert_formula('Yi Huang Tang','易黄汤','Change Yellow Discharge Decoction','stabilize_bind','Fu Qing Zhu Nu Ke',
  $t$Tonifies the Kidney, clears heat, dries dampness and stops leukorrhea.$t$,
  $t$Yellow leukorrhea from Kidney deficiency with damp-heat: thick sticky yellow discharge with a fishy odor, weak lower back, pale or red tongue with a yellow greasy coating, soggy or thin rapid pulse. Chronic vaginitis, cervicitis.$t$,
  $t$Not for leukorrhea from pure cold-damp Spleen deficiency.$t$,
  '[{"h":"Shan Yao","d":30},{"h":"Qian Shi","d":30},{"h":"Huang Bai","d":6},{"h":"Che Qian Zi","d":3,"n":"in a bag"},{"h":"Bai Guo","d":12}]'::jsonb);

-- ---------------------------------------------------------------------------
-- Calm the spirit
-- ---------------------------------------------------------------------------

perform public.upsert_formula('Suan Zao Ren Tang','酸枣仁汤','Sour Jujube Decoction','calm_spirit','Jin Gui Yao Lue',
  $t$Nourishes the blood, calms the spirit, clears heat and eliminates irritability.$t$,
  $t$Liver blood deficiency with deficiency heat disturbing the spirit: insomnia, irritability, palpitations, night sweats, dizziness, dry throat and mouth, red dry tongue, wiry thin pulse. Chronic insomnia, anxiety, menopausal insomnia, neurasthenia.$t$,
  $t$Not for insomnia from phlegm-heat or excess fire.$t$,
  '[{"h":"Suan Zao Ren","d":15,"n":"dry-fried, crushed"},{"h":"Fu Ling","d":6},{"h":"Zhi Mu","d":6},{"h":"Chuan Xiong","d":6},{"h":"Gan Cao","d":3}]'::jsonb);

perform public.upsert_formula('Tian Wang Bu Xin Dan','天王补心丹','Emperor of Heaven''s Special Pill to Tonify the Heart','calm_spirit','She Sheng Mi Pou (Hong Ji, 1638)',
  $t$Enriches yin, nourishes blood, tonifies the Heart and calms the spirit.$t$,
  $t$Heart and Kidney yin deficiency with deficiency fire: insomnia, palpitations, anxiety, forgetfulness, restlessness, dream-disturbed sleep, night sweats, dry mouth and stools, mouth sores, red tongue with little coating, thin rapid pulse. Chronic insomnia, anxiety disorders, hyperthyroidism, menopausal syndrome.$t$,
  $t$Cloying: not for Spleen deficiency with loose stools or phlegm-damp. The source coats the pills with cinnabar, omitted here.$t$,
  '[{"h":"Sheng Di Huang","d":24},{"h":"Ren Shen","d":6},{"h":"Xuan Shen","d":6},{"h":"Dan Shen","d":6},{"h":"Fu Ling","d":6},{"h":"Wu Wei Zi","d":6},{"h":"Yuan Zhi","d":6},{"h":"Jie Geng","d":6},{"h":"Dang Gui","d":12},{"h":"Tian Men Dong","d":12},{"h":"Mai Men Dong","d":12},{"h":"Bai Zi Ren","d":12},{"h":"Suan Zao Ren","d":12}]'::jsonb);

perform public.upsert_formula('Gan Mai Da Zao Tang','甘麦大枣汤','Licorice, Wheat and Jujube Decoction','calm_spirit','Jin Gui Yao Lue',
  $t$Nourishes the Heart, calms the spirit and harmonizes the middle burner.$t$,
  $t$Restless organ disorder (zang zao) from Heart yin and blood deficiency: emotional lability, weeping without cause, restlessness, insomnia, frequent yawning, disorientation, pale red tongue, thin wiry pulse. Anxiety, depression, hysteria, menopausal mood swings, night crying in children.$t$,
  $t$Gentle; suitable for children and long-term use. The source uses whole wheat (Xiao Mai); Fu Xiao Mai is the usual modern form.$t$,
  '[{"h":"Gan Cao","d":9},{"h":"Fu Xiao Mai","d":30,"n":"whole wheat in the source"},{"h":"Da Zao","d":12,"n":"10 pieces in the source"}]'::jsonb);

perform public.upsert_formula('Huang Lian E Jiao Tang','黄连阿胶汤','Coptis and Ass-Hide Gelatin Decoction','calm_spirit','Shang Han Lun',
  $t$Enriches yin, drains fire and calms the spirit.$t$,
  $t$Shao yin heat pattern with Heart fire and Kidney yin deficiency: severe insomnia, irritability, palpitations, dry mouth and throat, hot palms and soles, red tongue with a dry yellow coating, thin rapid pulse. Insomnia after febrile illness, anxiety, hyperthyroidism, oral ulcers.$t$,
  $t$Not for insomnia from blood deficiency without heat. Egg yolk is stirred into the slightly cooled decoction.$t$,
  '[{"h":"Huang Lian","d":12},{"h":"Huang Qin","d":6},{"h":"Bai Shao","d":6},{"h":"E Jiao","d":9,"n":"melt into the strained decoction"},{"h":"Ji Zi Huang","d":2,"n":"egg yolks, stirred in warm"}]'::jsonb);

perform public.upsert_formula('Bai Zi Yang Xin Wan','柏子养心丸','Arborvitae Seed Pill to Nourish the Heart','calm_spirit','Ti Ren Hui Bian (Peng Yong-Guang, 1549)',
  $t$Nourishes the Heart, calms the spirit, enriches yin and tonifies the Kidney.$t$,
  $t$Heart blood and Kidney yin deficiency: insomnia, palpitations, forgetfulness, anxiety, night sweats, dizziness, pale or red tongue, thin pulse. Neurasthenia, anxiety with insomnia.$t$,
  $t$Not for Spleen deficiency with loose stools.$t$,
  '[{"h":"Bai Zi Ren","d":12},{"h":"Gou Qi Zi","d":9},{"h":"Mai Men Dong","d":6},{"h":"Dang Gui","d":6},{"h":"Shi Chang Pu","d":6},{"h":"Fu Shen","d":6},{"h":"Xuan Shen","d":6},{"h":"Shu Di Huang","d":6},{"h":"Gan Cao","d":3}]'::jsonb);

perform public.upsert_formula('Chai Hu Jia Long Gu Mu Li Tang','柴胡加龙骨牡蛎汤','Bupleurum plus Dragon Bone and Oyster Shell Decoction','calm_spirit','Shang Han Lun',
  $t$Harmonizes the shao yang, unblocks the three burners, drains heat, anchors the spirit and calms fright.$t$,
  $t$Shao yang disorder with heat harassing the Heart: chest fullness, irritability, palpitations, fright, insomnia, delirious speech, heaviness of the body, difficult urination, constipation, red tongue with a yellow coating, wiry rapid pulse. Anxiety, panic disorder, epilepsy, hypertension, menopausal syndrome, post-traumatic stress.$t$,
  $t$Not for deficiency without heat or stagnation. The source contains Qian Dan (lead oxide), omitted here.$t$,
  '[{"h":"Chai Hu","d":12},{"h":"Long Gu","d":5,"n":"decoct first"},{"h":"Huang Qin","d":5},{"h":"Sheng Jiang","d":5},{"h":"Ren Shen","d":5},{"h":"Gui Zhi","d":5},{"h":"Fu Ling","d":5},{"h":"Ban Xia","d":6},{"h":"Da Huang","d":6},{"h":"Mu Li","d":5,"n":"decoct first"},{"h":"Da Zao","d":6}]'::jsonb);

-- ---------------------------------------------------------------------------
-- Open the orifices
-- ---------------------------------------------------------------------------

perform public.upsert_formula('An Gong Niu Huang Wan','安宫牛黄丸','Calm the Palace Pill with Cattle Gallstone','open_orifices','Wen Bing Tiao Bian',
  $t$Clears heat, resolves toxicity, transforms phlegm and opens the orifices.$t$,
  $t$Heat closed disorder with phlegm veiling the Pericardium: high fever, impaired or lost consciousness, delirium, convulsions, red or deep red tongue, rapid pulse. Encephalitis, meningitis, stroke, hepatic coma, septic encephalopathy with heat signs. An emergency formula used alongside conventional care.$t$,
  $t$Contraindicated in pregnancy and in cold or deficiency closed disorders. The classical pill contains She Xiang (musk), Zhu Sha (cinnabar) and Xiong Huang (realgar), omitted here; use a licensed manufactured product, never a home preparation. Amounts listed are proportions.$t$,
  '[{"h":"Niu Huang","d":1},{"h":"Yu Jin","d":1},{"h":"Shui Niu Jiao","d":1,"n":"concentrated powder"},{"h":"Huang Lian","d":1},{"h":"Huang Qin","d":1},{"h":"Zhi Zi","d":1},{"h":"Zhen Zhu","d":0.5},{"h":"Bing Pian","d":0.25}]'::jsonb,
  'Manufactured pill of about 3 g, one pill daily or every 12 hours in emergencies; never decocted.');

perform public.upsert_formula('Su He Xiang Wan','苏合香丸','Storax Pill','open_orifices','Tai Ping Hui Min He Ji Ju Fang',
  $t$Warms and aromatically opens the orifices, moves qi and dispels turbidity.$t$,
  $t$Cold closed disorder with phlegm and turbidity: sudden loss of consciousness with clenched jaw, cold limbs, pale face, white greasy coating, deep slow pulse; also chest and abdominal cold pain. Stroke, coma from cold, angina, hysterical fainting, severe cold-type abdominal pain.$t$,
  $t$Contraindicated in pregnancy and in heat closed disorder or deficiency collapse. The classical pill contains She Xiang and Zhu Sha, omitted here; use a licensed manufactured product. Amounts listed are proportions.$t$,
  '[{"h":"Su He Xiang","d":1},{"h":"An Xi Xiang","d":2},{"h":"Bing Pian","d":1},{"h":"Chen Xiang","d":2},{"h":"Mu Xiang","d":2},{"h":"Tan Xiang","d":2},{"h":"Ding Xiang","d":2},{"h":"Xiang Fu","d":2},{"h":"Bi Ba","d":2},{"h":"Ru Xiang","d":1},{"h":"Bai Zhu","d":2},{"h":"He Zi","d":2},{"h":"Shui Niu Jiao","d":2,"n":"concentrated powder"}]'::jsonb,
  'Manufactured pill of about 3 g, one pill once or twice daily; never decocted.');

-- ---------------------------------------------------------------------------
-- Treat wind (external and internal)
-- ---------------------------------------------------------------------------

perform public.upsert_formula('Chuan Xiong Cha Tiao San','川芎茶调散','Ligusticum Powder to be Taken with Green Tea','extinguish_wind','Tai Ping Hui Min He Ji Ju Fang',
  $t$Disperses wind and alleviates headache.$t$,
  $t$Headache from external wind: headache anywhere on the head, worse with wind, with fever, chills, dizziness, nasal congestion, thin white coating, floating pulse. Tension headache, migraine, sinus headache, post-viral headache.$t$,
  $t$Not for headache from Liver yang rising, blood deficiency or qi deficiency. Taken as powder with green tea, which restrains the ascending, dispersing herbs.$t$,
  '[{"h":"Chuan Xiong","d":12},{"h":"Jing Jie","d":12},{"h":"Bo He","d":24,"n":"add at the end"},{"h":"Qiang Huo","d":6},{"h":"Bai Zhi","d":6},{"h":"Xi Xin","d":3},{"h":"Fang Feng","d":4.5},{"h":"Gan Cao","d":6}]'::jsonb);

perform public.upsert_formula('Xiao Feng San','消风散','Eliminate Wind Powder','extinguish_wind','Wai Ke Zheng Zong (Chen Shi-Gong, 1617)',
  $t$Disperses wind, eliminates dampness, clears heat, cools and nourishes the blood.$t$,
  $t$Wind, dampness and heat in the skin: weeping itchy red rashes or wheals over much of the body, worse with heat or wind, yellow or white coating, floating rapid pulse. Urticaria, eczema, atopic dermatitis, contact dermatitis, tinea.$t$,
  $t$Not for skin lesions from blood deficiency with dryness alone. Use Chuan Mu Tong. Avoid spicy food, alcohol and seafood during treatment.$t$,
  '[{"h":"Jing Jie","d":6},{"h":"Fang Feng","d":6},{"h":"Niu Bang Zi","d":6},{"h":"Chan Tui","d":6},{"h":"Cang Zhu","d":6},{"h":"Ku Shen","d":6},{"h":"Mu Tong","d":6,"n":"Chuan Mu Tong only"},{"h":"Shi Gao","d":6,"n":"decoct first"},{"h":"Zhi Mu","d":6},{"h":"Sheng Di Huang","d":6},{"h":"Dang Gui","d":6},{"h":"Hei Zhi Ma","d":6},{"h":"Gan Cao","d":3}]'::jsonb);

perform public.upsert_formula('Qian Zheng San','牵正散','Lead to Symmetry Powder','extinguish_wind','Yang Shi Jia Cang Fang (Yang Tan, 1178)',
  $t$Dispels wind, transforms phlegm and stops spasms.$t$,
  $t$Wind-phlegm in the channels of the face: sudden facial paralysis with deviation of the eye and mouth, facial twitching, numbness, white coating, floating wiry or slippery pulse. Bell's palsy, facial spasm, trigeminal neuralgia.$t$,
  $t$Not for facial paralysis from stroke with qi deficiency and stasis (Bu Yang Huan Wu Tang instead). Bai Fu Zi and Quan Xie are toxic: keep within range; not for pregnancy. Taken as powder with warm wine.$t$,
  '[{"h":"Bai Fu Zi","d":6},{"h":"Jiang Can","d":6},{"h":"Quan Xie","d":6}]'::jsonb,
  'Equal parts as powder, 3 g twice daily with warm wine, or decocted at 6 g each.');

perform public.upsert_formula('Tian Ma Gou Teng Yin','天麻钩藤饮','Gastrodia and Uncaria Drink','extinguish_wind','Za Bing Zheng Zhi Xin Yi (Hu Guang-Ci, 1958)',
  $t$Calms the Liver, extinguishes wind, clears heat, invigorates the blood and tonifies the Liver and Kidney.$t$,
  $t$Liver yang rising with internal wind: headache, dizziness, vertigo, tinnitus, blurred vision, insomnia, numbness or tremor of the limbs, red tongue with a yellow coating, wiry rapid pulse. Hypertension, vertebrobasilar insufficiency, Meniere's disease, early stroke.$t$,
  $t$Not for headache from deficiency or from external wind. Gou Teng is added at the end.$t$,
  '[{"h":"Tian Ma","d":9},{"h":"Gou Teng","d":12,"n":"add at the end"},{"h":"Shi Jue Ming","d":18,"n":"decoct first"},{"h":"Zhi Zi","d":9},{"h":"Huang Qin","d":9},{"h":"Niu Xi","d":12,"n":"Chuan Niu Xi"},{"h":"Du Zhong","d":9},{"h":"Yi Mu Cao","d":9},{"h":"Sang Ji Sheng","d":9},{"h":"Ye Jiao Teng","d":9},{"h":"Fu Shen","d":9}]'::jsonb);

perform public.upsert_formula('Zhen Gan Xi Feng Tang','镇肝熄风汤','Sedate the Liver and Extinguish Wind Decoction','extinguish_wind','Yi Xue Zhong Zhong Can Xi Lu',
  $t$Sedates the Liver, extinguishes wind, nourishes yin and anchors yang.$t$,
  $t$Liver and Kidney yin deficiency with Liver yang rising and wind stirring: dizziness, vertigo, distending headache, tinnitus, hot flushed face, irritability, numbness or twitching of the limbs, deviation of the mouth, sudden fainting or hemiplegia, red tongue, wiry long forceful pulse. Hypertension, stroke and its prevention, transient ischemic attack.$t$,
  $t$Not for stroke from qi deficiency or phlegm. Contains Dai Zhe Shi: not for pregnancy or long-term use.$t$,
  '[{"h":"Niu Xi","d":30},{"h":"Dai Zhe Shi","d":30,"n":"decoct first"},{"h":"Long Gu","d":15,"n":"decoct first"},{"h":"Mu Li","d":15,"n":"decoct first"},{"h":"Gui Jia","d":15,"n":"decoct first"},{"h":"Bai Shao","d":15},{"h":"Xuan Shen","d":15},{"h":"Tian Men Dong","d":15},{"h":"Chuan Lian Zi","d":6},{"h":"Mai Ya","d":6},{"h":"Yin Chen Hao","d":6},{"h":"Gan Cao","d":4.5}]'::jsonb);

perform public.upsert_formula('Ling Jiao Gou Teng Tang','羚角钩藤汤','Antelope Horn and Uncaria Decoction (with goat horn)','extinguish_wind','Tong Su Shang Han Lun (Yu Gen-Chu, 1776)',
  $t$Cools the Liver, extinguishes wind, increases fluids and relaxes the sinews.$t$,
  $t$Heat excess in the Liver channel generating wind: high fever, irritability, restlessness, convulsions, spasms of the limbs, opisthotonos, loss of consciousness, deep red dry tongue with prickles, wiry rapid pulse. Encephalitis, meningitis, febrile seizures, eclampsia, hypertensive crisis.$t$,
  $t$Not for wind from yin deficiency after prolonged fever (use Da Ding Feng Zhu). Ling Yang Jiao (saiga antelope horn, CITES-listed) is replaced by Shan Yang Jiao at ten times the dose.$t$,
  '[{"h":"Shan Yang Jiao","d":30,"n":"substitute for antelope horn; decoct first"},{"h":"Gou Teng","d":9,"n":"add at the end"},{"h":"Sang Ye","d":6},{"h":"Ju Hua","d":9},{"h":"Sheng Di Huang","d":15},{"h":"Bai Shao","d":9},{"h":"Chuan Bei Mu","d":12},{"h":"Zhu Ru","d":15},{"h":"Fu Shen","d":9},{"h":"Gan Cao","d":3}]'::jsonb);

perform public.upsert_formula('Da Ding Feng Zhu','大定风珠','Major Arrest Wind Pearl','extinguish_wind','Wen Bing Tiao Bian',
  $t$Nourishes yin, enriches fluids, anchors yang and extinguishes internal wind.$t$,
  $t$Yin deficiency wind after prolonged febrile disease: tremor of the hands and feet, twitching, weakness, fatigue, low-grade fever, heat in the palms and soles, deep red tongue with little coating, thin weak or faint pulse. Post-encephalitic sequelae, Parkinsonian tremor with yin deficiency, chronic seizures.$t$,
  $t$Not for wind from excess heat with a full pulse. Egg yolk is stirred into the warm decoction.$t$,
  '[{"h":"Bai Shao","d":18},{"h":"E Jiao","d":9,"n":"melt into the strained decoction"},{"h":"Gui Jia","d":12,"n":"decoct first"},{"h":"Sheng Di Huang","d":18},{"h":"Huo Ma Ren","d":6},{"h":"Wu Wei Zi","d":6},{"h":"Mu Li","d":12,"n":"decoct first"},{"h":"Mai Men Dong","d":18},{"h":"Gan Cao","d":12,"n":"honey-fried"},{"h":"Bie Jia","d":12,"n":"decoct first"},{"h":"Ji Zi Huang","d":2,"n":"egg yolks, stirred in warm"}]'::jsonb);

perform public.upsert_formula('Zhi Jing San','止痉散','Stop Spasms Powder','extinguish_wind','Fang Ji Xue (modern)',
  $t$Extinguishes wind, stops spasms, unblocks the collaterals and alleviates pain.$t$,
  $t$Internal wind with spasms and convulsions: tetany, seizures, opisthotonos, facial paralysis; also stubborn headache and joint pain from wind in the collaterals.$t$,
  $t$Toxic animal substances: keep within the dose range. Contraindicated in pregnancy. Powder only.$t$,
  '[{"h":"Quan Xie","d":1},{"h":"Wu Gong","d":1}]'::jsonb,
  'Equal parts as fine powder, 1 to 1.5 g two to four times daily, swallowed with water or a decoction.');

-- ---------------------------------------------------------------------------
-- Treat phlegm
-- ---------------------------------------------------------------------------

perform public.upsert_formula('Er Chen Tang','二陈汤','Two-Aged Decoction','treat_phlegm','Tai Ping Hui Min He Ji Ju Fang',
  $t$Dries dampness, transforms phlegm, regulates qi and harmonizes the middle.$t$,
  $t$Phlegm-dampness: cough with copious white sputum that is easy to expectorate, stifling chest, nausea, vomiting, dizziness, palpitations, white moist or greasy coating, slippery pulse. Chronic bronchitis, chronic gastritis, Meniere's disease. The base for most phlegm formulas.$t$,
  $t$Drying: not for cough from yin deficiency or dry-heat, or hemoptysis.$t$,
  '[{"h":"Ban Xia","d":15},{"h":"Chen Pi","d":15},{"h":"Fu Ling","d":9},{"h":"Gan Cao","d":4.5,"n":"honey-fried"},{"h":"Sheng Jiang","d":3},{"h":"Wu Mei","d":1}]'::jsonb);

perform public.upsert_formula('Wen Dan Tang','温胆汤','Warm the Gallbladder Decoction','treat_phlegm','San Yin Ji Yi Bing Zheng Fang Lun (Chen Yan, 1174)',
  $t$Regulates qi, transforms phlegm, clears the Gallbladder and harmonizes the Stomach.$t$,
  $t$Gallbladder and Stomach disharmony with phlegm-heat: irritability, insomnia, palpitations, timidity, dizziness, nausea, vomiting, bitter taste, chest oppression, seizures with copious sputum, greasy slightly yellow coating, wiry slippery pulse. Anxiety, insomnia, Meniere's disease, chronic gastritis, epilepsy, morning sickness.$t$,
  $t$Not for insomnia from blood or yin deficiency without phlegm.$t$,
  '[{"h":"Ban Xia","d":6},{"h":"Zhu Ru","d":6},{"h":"Zhi Shi","d":6},{"h":"Chen Pi","d":9},{"h":"Fu Ling","d":4.5},{"h":"Gan Cao","d":3,"n":"honey-fried"},{"h":"Sheng Jiang","d":5},{"h":"Da Zao","d":3}]'::jsonb);

perform public.upsert_formula('Qing Qi Hua Tan Wan','清气化痰丸','Clear the Qi and Transform Phlegm Pill','treat_phlegm','Yi Fang Kao (Wu Kun, 1584)',
  $t$Clears heat, transforms phlegm, regulates qi and stops cough.$t$,
  $t$Phlegm-heat in the Lung: cough with thick yellow sputum that is hard to expectorate, chest oppression, shortness of breath, nausea, greasy yellow coating, slippery rapid pulse. Acute and chronic bronchitis, pneumonia, COPD exacerbation.$t$,
  $t$Not for cough from yin deficiency or cold phlegm. Dan Nan Xing is bile-processed Tian Nan Xing.$t$,
  '[{"h":"Tian Nan Xing","d":9,"n":"bile-processed (Dan Nan Xing)"},{"h":"Gua Lou","d":9,"n":"seed"},{"h":"Huang Qin","d":9},{"h":"Chen Pi","d":9},{"h":"Xing Ren","d":9},{"h":"Zhi Shi","d":9},{"h":"Fu Ling","d":9},{"h":"Ban Xia","d":9}]'::jsonb);

perform public.upsert_formula('Bei Mu Gua Lou San','贝母瓜蒌散','Fritillaria and Trichosanthes Fruit Powder','treat_phlegm','Yi Xue Xin Wu (Cheng Guo-Peng, 1732)',
  $t$Moistens the Lung, clears heat, regulates qi and transforms phlegm.$t$,
  $t$Dry phlegm in the Lung: dry cough with scanty sticky sputum that is difficult to expectorate, dry throat, hoarseness, red dry tongue with a thin white coating, thin rapid or slippery pulse. Chronic bronchitis, pharyngitis, laryngitis with dryness.$t$,
  $t$Not for cough with copious thin sputum or from Lung yin deficiency with marked heat.$t$,
  '[{"h":"Chuan Bei Mu","d":4.5},{"h":"Gua Lou","d":3},{"h":"Tian Hua Fen","d":2.4},{"h":"Fu Ling","d":2.4},{"h":"Chen Pi","d":2.4},{"h":"Jie Geng","d":2.4}]'::jsonb);

perform public.upsert_formula('Ban Xia Bai Zhu Tian Ma Tang','半夏白术天麻汤','Pinellia, Atractylodes and Gastrodia Decoction','treat_phlegm','Yi Xue Xin Wu',
  $t$Dries dampness, transforms phlegm, calms the Liver and extinguishes wind.$t$,
  $t$Wind-phlegm rising upward: dizziness, vertigo, headache with a heavy sensation, nausea, vomiting, chest oppression, white greasy coating, wiry slippery pulse. Meniere's disease, vestibular vertigo, migraine with nausea, hypertension with dizziness.$t$,
  $t$Not for dizziness from yin deficiency or Liver yang rising without phlegm.$t$,
  '[{"h":"Ban Xia","d":9},{"h":"Tian Ma","d":6},{"h":"Bai Zhu","d":15},{"h":"Fu Ling","d":6},{"h":"Chen Pi","d":6},{"h":"Gan Cao","d":3},{"h":"Sheng Jiang","d":3},{"h":"Da Zao","d":6}]'::jsonb);

perform public.upsert_formula('Ling Gan Wu Wei Jiang Xin Tang','苓甘五味姜辛汤','Poria, Licorice, Schisandra, Ginger and Asarum Decoction','treat_phlegm','Jin Gui Yao Lue',
  $t$Warms the Lung, transforms thin mucus and stops cough.$t$,
  $t$Cold thin mucus in the Lung: cough with copious thin white or frothy sputum, chest oppression, aversion to cold, white slippery coating, wiry slippery pulse. Chronic bronchitis, emphysema, asthma with cold phlegm.$t$,
  $t$Not for cough from Lung heat or yin deficiency.$t$,
  '[{"h":"Fu Ling","d":12},{"h":"Gan Cao","d":6},{"h":"Wu Wei Zi","d":6},{"h":"Gan Jiang","d":9},{"h":"Xi Xin","d":3}]'::jsonb);

perform public.upsert_formula('San Zi Yang Qin Tang','三子养亲汤','Three-Seed Decoction to Nourish One''s Parents','treat_phlegm','Han Shi Yi Tong (Han Mao, 1522)',
  $t$Directs qi downward, transforms phlegm, reduces food stagnation and calms wheezing.$t$,
  $t$Phlegm obstruction with qi stagnation in the elderly: cough and wheezing with copious sputum, chest oppression, poor appetite, indigestion, white greasy coating, slippery pulse. Chronic bronchitis, COPD, asthma in the elderly with food stagnation.$t$,
  $t$Not for wheezing from deficiency; strongly dispersing, so for short courses.$t$,
  '[{"h":"Bai Jie Zi","d":6},{"h":"Zi Su Zi","d":9},{"h":"Lai Fu Zi","d":9}]'::jsonb);

perform public.upsert_formula('Zhi Sou San','止嗽散','Stop Coughing Powder','treat_phlegm','Yi Xue Xin Wu',
  $t$Stops cough, transforms phlegm, diffuses the Lung and gently releases the exterior.$t$,
  $t$Lingering cough after wind-cold: cough with itchy throat, slight chills and fever, sputum that is hard to expectorate, thin white coating, floating moderate pulse. Post-viral cough, acute and chronic bronchitis, pertussis.$t$,
  $t$Not for cough from Lung heat, yin deficiency or with blood.$t$,
  '[{"h":"Zi Wan","d":9},{"h":"Bai Bu","d":9},{"h":"Bai Qian","d":9},{"h":"Jie Geng","d":9},{"h":"Jing Jie","d":9},{"h":"Chen Pi","d":6},{"h":"Gan Cao","d":3}]'::jsonb);

perform public.upsert_formula('Xiao Luo Wan','消瘰丸','Reduce Scrofula Pill','treat_phlegm','Yi Xue Zhong Zhong Can Xi Lu',
  $t$Clears heat, transforms phlegm, softens hardness and dissipates nodules.$t$,
  $t$Scrofula and phlegm nodules from Liver and Kidney yin deficiency with phlegm-fire: nodules in the neck that are hard and mobile, dry throat, red tongue, wiry slippery or thin rapid pulse. Lymphadenopathy, thyroid nodules, goiter, fibrocystic breast disease.$t$,
  $t$Not for nodules from cold-phlegm or qi deficiency.$t$,
  '[{"h":"Xuan Shen","d":12},{"h":"Mu Li","d":12,"n":"decoct first"},{"h":"Zhe Bei Mu","d":12}]'::jsonb);

perform public.upsert_formula('Hai Zao Yu Hu Tang','海藻玉壶汤','Sargassum Decoction for the Jade Flask','treat_phlegm','Wai Ke Zheng Zong',
  $t$Transforms phlegm, softens hardness, regulates qi, invigorates the blood and dissipates nodules.$t$,
  $t$Goiter and phlegm nodules from qi stagnation, phlegm and stasis: swelling at the front of the neck that is soft or firm, chest oppression, white greasy coating, wiry slippery pulse. Simple goiter, thyroid nodules, thyroid adenoma, lymphadenopathy.$t$,
  $t$Hai Zao and Gan Cao are traditionally incompatible yet deliberately combined here; many practitioners omit Gan Cao. Not for hyperthyroidism with heat signs without modification.$t$,
  '[{"h":"Hai Zao","d":9},{"h":"Kun Bu","d":9},{"h":"Ban Xia","d":6},{"h":"Chen Pi","d":6},{"h":"Qing Pi","d":6},{"h":"Lian Qiao","d":6},{"h":"Zhe Bei Mu","d":6},{"h":"Dang Gui","d":6},{"h":"Chuan Xiong","d":6},{"h":"Du Huo","d":6},{"h":"Gan Cao","d":3,"n":"often omitted"}]'::jsonb);

perform public.upsert_formula('Gun Tan Wan','滚痰丸','Vaporize Phlegm Pill','treat_phlegm','Yu Ji Wei Yi (Wang Yin-Jun, Yuan dynasty)',
  $t$Drains fire and drives out phlegm.$t$,
  $t$Excess phlegm-fire: mania, palpitations, fright, seizures, dizziness, tinnitus, nodules, chest oppression, constipation, thick greasy yellow coating, slippery rapid forceful pulse. Acute psychosis, epilepsy, bipolar mania with phlegm-fire.$t$,
  $t$Strongly purging: not for deficiency, pregnancy or long-term use. Meng Shi is calcined.$t$,
  '[{"h":"Meng Shi","d":9,"n":"calcined; decoct first"},{"h":"Da Huang","d":24},{"h":"Huang Qin","d":24},{"h":"Chen Xiang","d":1.5,"n":"powder"}]'::jsonb);

perform public.upsert_formula('Ding Xian Wan','定痫丸','Arrest Seizures Pill','treat_phlegm','Yi Xue Xin Wu',
  $t$Transforms phlegm, extinguishes wind, opens the orifices and calms the spirit.$t$,
  $t$Epilepsy from wind-phlegm: sudden loss of consciousness with convulsions, foaming at the mouth, upward-staring eyes, screaming, followed by exhaustion; between attacks, dizziness, chest oppression, white greasy coating, wiry slippery pulse.$t$,
  $t$Not for seizures from deficiency without phlegm. The source contains Zhu Sha (cinnabar), omitted here. Amounts are proportions for a pill batch; prepared with bamboo sap and ginger juice.$t$,
  '[{"h":"Tian Ma","d":30},{"h":"Chuan Bei Mu","d":30},{"h":"Ban Xia","d":30},{"h":"Fu Ling","d":30},{"h":"Fu Shen","d":30},{"h":"Tian Nan Xing","d":15,"n":"bile-processed"},{"h":"Shi Chang Pu","d":15},{"h":"Quan Xie","d":15},{"h":"Jiang Can","d":15},{"h":"Hu Po","d":15},{"h":"Chen Pi","d":21},{"h":"Yuan Zhi","d":21},{"h":"Dan Shen","d":60},{"h":"Mai Men Dong","d":60},{"h":"Zhu Li","d":100,"n":"bamboo sap, as binder"}]'::jsonb,
  'Pill batch proportions; 6 to 9 g of pills twice daily.');

-- ---------------------------------------------------------------------------
-- Reduce food stagnation
-- ---------------------------------------------------------------------------

perform public.upsert_formula('Bao He Wan','保和丸','Preserve Harmony Pill','reduce_food_stagnation','Dan Xi Xin Fa',
  $t$Reduces food stagnation and harmonizes the Stomach.$t$,
  $t$Food stagnation: epigastric and abdominal fullness and distention, foul belching, acid regurgitation, aversion to food, nausea, vomiting, diarrhea, thick greasy coating, slippery pulse. Overeating, acute gastroenteritis, functional dyspepsia, infant indigestion.$t$,
  $t$Not for food stagnation from Spleen deficiency without modification.$t$,
  '[{"h":"Shan Zha","d":18},{"h":"Shen Qu","d":6},{"h":"Ban Xia","d":9},{"h":"Fu Ling","d":9},{"h":"Chen Pi","d":3},{"h":"Lian Qiao","d":3},{"h":"Lai Fu Zi","d":3}]'::jsonb);

perform public.upsert_formula('Zhi Shi Dao Zhi Wan','枳实导滞丸','Unripe Bitter Orange Pill to Guide Out Stagnation','reduce_food_stagnation','Nei Wai Shang Bian Huo Lun',
  $t$Reduces food stagnation, guides out accumulation, clears heat and resolves dampness.$t$,
  $t$Food stagnation with damp-heat: epigastric and abdominal fullness and pain, constipation or dysentery-like diarrhea with tenesmus, scanty dark urine, greasy yellow coating, deep forceful pulse. Acute gastroenteritis, bacillary dysentery in the early stage, indigestion with constipation.$t$,
  $t$Not for deficiency, pregnancy or absence of heat.$t$,
  '[{"h":"Da Huang","d":30},{"h":"Zhi Shi","d":15},{"h":"Shen Qu","d":15},{"h":"Fu Ling","d":9},{"h":"Huang Qin","d":9},{"h":"Huang Lian","d":9},{"h":"Bai Zhu","d":9},{"h":"Ze Xie","d":6}]'::jsonb);

perform public.upsert_formula('Jian Pi Wan','健脾丸','Strengthen the Spleen Pill','reduce_food_stagnation','Zheng Zhi Zhun Sheng (Wang Ken-Tang, 1602)',
  $t$Strengthens the Spleen, harmonizes the Stomach, reduces food stagnation and stops diarrhea.$t$,
  $t$Spleen deficiency with food stagnation: poor appetite, indigestion, epigastric fullness after eating, loose stool, fatigue, slightly greasy yellow coating, deficient weak pulse. Chronic gastritis, chronic enteritis, indigestion in children and the elderly.$t$,
  $t$Not for food stagnation of the excess type without deficiency.$t$,
  '[{"h":"Bai Zhu","d":15},{"h":"Mu Xiang","d":6},{"h":"Huang Lian","d":6},{"h":"Gan Cao","d":6},{"h":"Fu Ling","d":9},{"h":"Ren Shen","d":9},{"h":"Shen Qu","d":9},{"h":"Chen Pi","d":9},{"h":"Sha Ren","d":9,"n":"add at the end"},{"h":"Mai Ya","d":9},{"h":"Shan Zha","d":9},{"h":"Shan Yao","d":9},{"h":"Rou Dou Kou","d":9,"n":"roasted"}]'::jsonb);

perform public.upsert_formula('Mu Xiang Bing Lang Wan','木香槟榔丸','Aucklandia and Betel Nut Pill','reduce_food_stagnation','Ru Men Shi Qin (Zhang Cong-Zheng, 1228)',
  $t$Moves qi, guides out stagnation, purges accumulation and clears heat.$t$,
  $t$Food and qi stagnation with damp-heat: epigastric and abdominal distention and pain, constipation or dysentery with tenesmus, foul belching, greasy yellow coating, deep excess pulse. Acute dysentery, food poisoning, indigestion with constipation.$t$,
  $t$Not for deficiency, pregnancy or the elderly without modification. Short courses only.$t$,
  '[{"h":"Mu Xiang","d":9},{"h":"Bing Lang","d":9},{"h":"Qing Pi","d":9},{"h":"Chen Pi","d":9},{"h":"E Zhu","d":9},{"h":"Huang Lian","d":9},{"h":"Huang Bai","d":9},{"h":"Da Huang","d":9},{"h":"Xiang Fu","d":9},{"h":"Qian Niu Zi","d":9},{"h":"Mang Xiao","d":9,"n":"dissolve in the strained decoction"}]'::jsonb);

-- ---------------------------------------------------------------------------
-- Expel parasites
-- ---------------------------------------------------------------------------

perform public.upsert_formula('Wu Mei Wan','乌梅丸','Mume Pill','expel_parasites','Shang Han Lun',
  $t$Warms the organs, calms roundworms, clears heat and tonifies deficiency.$t$,
  $t$Roundworm syndrome with mixed cold and heat: intermittent severe abdominal pain, vomiting of roundworms, cold limbs, irritability, hunger without desire to eat. Also chronic diarrhea and dysentery with mixed cold and heat, IBS, ulcerative colitis, biliary ascariasis.$t$,
  $t$Not for damp-heat dysentery of the excess type. Fu Zi is decocted first.$t$,
  '[{"h":"Wu Mei","d":30},{"h":"Xi Xin","d":3},{"h":"Gan Jiang","d":9},{"h":"Huang Lian","d":12},{"h":"Dang Gui","d":6},{"h":"Fu Zi","d":6,"n":"decoct first, 60 minutes"},{"h":"Hua Jiao","d":6},{"h":"Gui Zhi","d":6},{"h":"Ren Shen","d":6},{"h":"Huang Bai","d":6}]'::jsonb);

perform public.upsert_formula('Fei Er Wan','肥儿丸','Fat Baby Pill','expel_parasites','Yi Zong Jin Jian',
  $t$Kills parasites, reduces food accumulation, strengthens the Spleen and clears heat.$t$,
  $t$Childhood nutritional impairment with parasites: emaciation, distended abdomen, sallow face, poor appetite, intermittent abdominal pain, foul stool, irritability, low fever. Ascariasis and malnutrition in children.$t$,
  $t$Not for children without parasites or heat; Ku Lian Pi is toxic, so keep to short courses.$t$,
  '[{"h":"Shi Jun Zi","d":15},{"h":"Bing Lang","d":9},{"h":"Shen Qu","d":9},{"h":"Mai Ya","d":9},{"h":"Hu Huang Lian","d":9},{"h":"Lu Hui","d":3},{"h":"Ku Lian Pi","d":9}]'::jsonb);

end
$seed$;
