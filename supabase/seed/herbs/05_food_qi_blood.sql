-- ============================================================================
-- Materia medica · 05 · Food stagnation, regulate qi, stop bleeding, invigorate blood
-- ============================================================================
-- See 01 for conventions. Chuan Shan Jia (pangolin) is deliberately absent:
-- it is CITES-listed and illegal to trade.
-- ============================================================================

do $seed$
begin

-- ---------------------------------------------------------------------------
-- Relieve food stagnation
-- ---------------------------------------------------------------------------

perform public.upsert_herb('Shan Zha','山楂','Crataegus pinnatifida (Fructus)','Fructus Crataegi','Chinese hawthorn fruit',
  'relieve_food_stagnation','slightly_warm','{sour,sweet}','{spleen,stomach,liver}',
  $t$Reduces food stagnation, especially from meat and greasy food. Invigorates the blood and dispels stasis. Charred, it stops diarrhea. Lowers blood lipids.$t$,
  $t$Abdominal distention, pain and diarrhea from food stagnation. Postpartum abdominal pain, hernia pain, dysmenorrhea from stasis. Hyperlipidemia, hypertension, coronary disease.$t$,
  $t$Not for Spleen deficiency without stagnation, or excess stomach acid. Pregnancy caution.$t$,
  9, 15, 'Charred (Jiao Shan Zha) for diarrhea; raw for lipids.');

perform public.upsert_herb('Shen Qu','神曲','Massa medicata fermentata (fermented mixture)','Massa Medicata Fermentata','Medicated leaven',
  'relieve_food_stagnation','warm','{sweet,acrid}','{spleen,stomach}',
  $t$Reduces food stagnation and harmonizes the Stomach. Aids the digestion of mineral-containing pills.$t$,
  $t$Food stagnation with epigastric fullness, poor appetite, diarrhea. Added to pills containing minerals to aid their absorption.$t$,
  $t$Not for Stomach fire. Contains wheat: note in gluten sensitivity.$t$,
  6, 15, null);

perform public.upsert_herb('Mai Ya','麦芽','Hordeum vulgare (Fructus germinatus)','Fructus Hordei Germinatus','Barley sprout',
  'relieve_food_stagnation','neutral','{sweet}','{spleen,stomach,liver}',
  $t$Reduces food stagnation, especially from starches. Strengthens the Spleen and opens the appetite. In large doses, inhibits lactation. Gently spreads Liver qi.$t$,
  $t$Food stagnation from rice, noodles and starches; poor appetite in Spleen deficiency. Weaning, breast distention. Liver qi constraint.$t$,
  $t$Not during breastfeeding unless weaning is intended. Small doses may instead promote milk.$t$,
  9, 15, 'Up to 60 g to stop lactation.');

perform public.upsert_herb('Gu Ya','谷芽','Setaria italica or Oryza sativa (Fructus germinatus)','Fructus Setariae Germinatus','Millet or rice sprout',
  'relieve_food_stagnation','neutral','{sweet}','{spleen,stomach}',
  $t$Reduces food stagnation and opens the appetite. Strengthens the Spleen and harmonizes the middle.$t$,
  $t$Poor appetite and indigestion with Spleen and Stomach deficiency; gentle enough for children and convalescents.$t$,
  $t$Gentle. Dry-fried for greater warmth.$t$,
  9, 15, null);

perform public.upsert_herb('Lai Fu Zi','莱菔子','Raphanus sativus (Semen)','Semen Raphani','Radish seed',
  'relieve_food_stagnation','neutral','{acrid,sweet}','{lung,spleen,stomach}',
  $t$Reduces food stagnation and moves qi. Directs qi downward and transforms phlegm.$t$,
  $t$Food stagnation with distention, belching and sour regurgitation. Cough and wheezing with copious phlegm and chest fullness.$t$,
  $t$Not for qi deficiency without stagnation. Traditionally not taken with Ren Shen, which it is said to weaken.$t$,
  5, 9, 'Dry-fried.');

perform public.upsert_herb('Ji Nei Jin','鸡内金','Gallus gallus domesticus (Endothelium corneum gigeriae)','Endothelium Corneum Gigeriae Galli','Chicken gizzard lining',
  'relieve_food_stagnation','neutral','{sweet}','{spleen,stomach,small_intestine,bladder}',
  $t$Reduces food stagnation of all kinds and strengthens the Spleen. Secures essence and stops enuresis. Dissolves stones.$t$,
  $t$Food stagnation, childhood nutritional impairment. Enuresis, spermatorrhea. Urinary and biliary stones.$t$,
  $t$Animal product. Powder is markedly stronger than decoction.$t$,
  3, 9, 'Powder 1.5 to 3 g.');

-- ---------------------------------------------------------------------------
-- Regulate qi
-- ---------------------------------------------------------------------------

perform public.upsert_herb('Chen Pi','陈皮','Citrus reticulata (Pericarpium)','Pericarpium Citri Reticulatae','Aged tangerine peel',
  'regulate_qi','warm','{acrid,bitter}','{spleen,lung}',
  $t$Regulates qi and harmonizes the middle. Dries dampness and transforms phlegm. Prevents tonics from causing stagnation.$t$,
  $t$Epigastric and abdominal distention, poor appetite, nausea and vomiting from qi stagnation. Cough with copious sputum from phlegm-damp. Added to tonifying formulas.$t$,
  $t$Not for yin deficiency with dry cough, or heat from excess. Aged peel is preferred.$t$,
  3, 9, 'Ju Hong (red outer peel) is more drying; Ju Luo (pith) unblocks collaterals.');

perform public.upsert_herb('Qing Pi','青皮','Citrus reticulata (Pericarpium viride)','Pericarpium Citri Reticulatae Viride','Green tangerine peel',
  'regulate_qi','warm','{bitter,acrid}','{liver,gallbladder,stomach}',
  $t$Spreads Liver qi and breaks up stagnation. Dissipates nodules. Reduces food stagnation.$t$,
  $t$Flank pain, breast distention and pain, hernia pain from Liver qi stagnation. Breast lumps. Food stagnation with abdominal pain.$t$,
  $t$Not for qi deficiency. Harsher than Chen Pi: drying and dispersing.$t$,
  3, 9, 'Vinegar-fried to enter the Liver.');

perform public.upsert_herb('Zhi Shi','枳实','Citrus aurantium (Fructus immaturus)','Fructus Aurantii Immaturus','Immature bitter orange',
  'regulate_qi','slightly_cold','{bitter,acrid}','{spleen,stomach,large_intestine}',
  $t$Breaks up qi stagnation and reduces accumulation. Transforms phlegm and unbinds the chest. With Huang Qi, raises prolapsed organs.$t$,
  $t$Epigastric and abdominal fullness with constipation or dysentery with tenesmus. Chest bi with phlegm. Prolapse of the rectum, uterus or stomach.$t$,
  $t$Contraindicated in pregnancy. Not for Spleen and Stomach deficiency. Strong.$t$,
  3, 9, 'Bran-fried to moderate.');

perform public.upsert_herb('Zhi Ke','枳壳','Citrus aurantium (Fructus)','Fructus Aurantii','Bitter orange',
  'regulate_qi','slightly_cold','{bitter,acrid}','{spleen,stomach}',
  $t$Moves qi and reduces distention. Milder than Zhi Shi.$t$,
  $t$Epigastric and abdominal distention, belching, poor appetite from qi stagnation; prolapse (with tonics).$t$,
  $t$Pregnancy caution. Not for qi deficiency.$t$,
  3, 9, null);

perform public.upsert_herb('Mu Xiang','木香','Aucklandia lappa (Radix)','Radix Aucklandiae','Costus root',
  'regulate_qi','warm','{acrid,bitter}','{spleen,stomach,large_intestine,gallbladder,san_jiao}',
  $t$Moves qi and alleviates pain. Strengthens the Spleen and prevents stagnation. Regulates Gallbladder qi.$t$,
  $t$Epigastric and abdominal pain and distention, poor appetite. Dysentery and diarrhea with tenesmus. Flank pain and jaundice from Liver-Gallbladder stagnation. Added to tonics to keep them moving.$t$,
  $t$Not for yin deficiency or dryness with heat. Add near the end of decoction; roasted for diarrhea.$t$,
  3, 9, 'Add at the end. Roasted (Wei Mu Xiang) to stop diarrhea.');

perform public.upsert_herb('Xiang Fu','香附','Cyperus rotundus (Rhizoma)','Rhizoma Cyperi','Nutgrass rhizome',
  'regulate_qi','neutral','{acrid,bitter,sweet}','{liver,spleen,san_jiao}',
  $t$Spreads Liver qi and relieves constraint. Regulates menstruation and alleviates pain.$t$,
  $t$Flank and epigastric pain, distention, irritability from Liver qi stagnation. Irregular menses, dysmenorrhea, breast distention. Called the commander of qi in gynecology.$t$,
  $t$Not for yin deficiency with heat, or qi deficiency without stagnation. Vinegar-fried for pain.$t$,
  6, 12, 'Vinegar-fried to enter the Liver and alleviate pain.');

perform public.upsert_herb('Wu Yao','乌药','Lindera aggregata (Radix)','Radix Linderae','Lindera root',
  'regulate_qi','warm','{acrid}','{lung,spleen,kidney,bladder}',
  $t$Moves qi and alleviates pain. Warms the Kidney and disperses cold.$t$,
  $t$Chest, flank and abdominal pain from qi stagnation with cold; hernia pain, dysmenorrhea. Frequent urination and enuresis from Kidney and Bladder cold.$t$,
  $t$Not for qi or blood deficiency, or internal heat.$t$,
  3, 9, null);

perform public.upsert_herb('Chuan Lian Zi','川楝子','Melia toosendan (Fructus)','Fructus Toosendan','Sichuan chinaberry fruit',
  'regulate_qi','cold','{bitter}','{liver,stomach,small_intestine,bladder}',
  $t$Moves Liver qi and alleviates pain. Clears heat. Kills parasites.$t$,
  $t$Flank, epigastric and hernia pain from Liver qi stagnation with heat (Jin Ling Zi San). Abdominal pain from roundworms. Tinea (topical).$t$,
  $t$Slightly toxic and hepatotoxic in overdose: keep within range and avoid long courses. Not for Spleen and Stomach deficiency cold.$t$,
  3, 9, null);

perform public.upsert_herb('Xie Bai','薤白','Allium macrostemon (Bulbus)','Bulbus Allii Macrostemi','Chinese chive bulb',
  'regulate_qi','warm','{acrid,bitter}','{lung,stomach,large_intestine}',
  $t$Unblocks yang and disperses cold. Unbinds the chest and moves qi. Relieves tenesmus.$t$,
  $t$Chest bi with pain, oppression and wheezing from phlegm and cold obstructing yang, including angina (Gua Lou Xie Bai Bai Jiu Tang). Dysentery with tenesmus.$t$,
  $t$Not for qi deficiency without stagnation, or Stomach weakness.$t$,
  5, 9, null);

perform public.upsert_herb('Tan Xiang','檀香','Santalum album (Lignum)','Lignum Santali Albi','Sandalwood',
  'regulate_qi','warm','{acrid}','{spleen,stomach,lung}',
  $t$Moves qi and alleviates pain. Harmonizes the Stomach and stops vomiting. Warms the middle.$t$,
  $t$Chest and epigastric pain from cold and qi stagnation; angina. Vomiting and poor appetite from Stomach cold.$t$,
  $t$Not for yin deficiency with fire. Add at the end of decoction, or use as powder.$t$,
  1.5, 3, 'Add at the end.');

perform public.upsert_herb('Chen Xiang','沉香','Aquilaria sinensis (Lignum resinatum)','Lignum Aquilariae Resinatum','Agarwood, aloeswood',
  'regulate_qi','warm','{acrid,bitter}','{spleen,stomach,kidney}',
  $t$Moves qi and alleviates pain. Directs rebellious qi downward. Warms the Kidney and helps it grasp qi.$t$,
  $t$Chest and abdominal pain from cold stagnation. Vomiting and hiccup from rebellious Stomach qi. Wheezing from Kidney failing to grasp qi.$t$,
  $t$Not for yin deficiency with fire or qi sinking. Expensive and CITES-regulated: taken as powder, or added at the very end.$t$,
  1, 3, 'Powder 0.5 to 1 g. Never boiled long.');

perform public.upsert_herb('Fo Shou','佛手','Citrus medica var. sarcodactylis (Fructus)','Fructus Citri Sarcodactylis','Buddha''s hand citron',
  'regulate_qi','warm','{acrid,bitter,sour}','{liver,spleen,stomach,lung}',
  $t$Spreads Liver qi and harmonizes the Stomach. Dries dampness and transforms phlegm.$t$,
  $t$Flank and epigastric pain, distention, poor appetite from Liver-Stomach disharmony. Cough with phlegm and chest oppression.$t$,
  $t$Gentle. Not for yin deficiency with heat.$t$,
  3, 9, null);

perform public.upsert_herb('Xiang Yuan','香橼','Citrus medica or C. wilsonii (Fructus)','Fructus Citri','Citron fruit',
  'regulate_qi','warm','{acrid,bitter,sour}','{liver,spleen,lung}',
  $t$Spreads Liver qi and harmonizes the middle. Transforms phlegm.$t$,
  $t$Flank and epigastric distention and pain; belching; cough with phlegm. Similar to Fo Shou.$t$,
  $t$Not for yin deficiency with heat.$t$,
  3, 9, null);

perform public.upsert_herb('Da Fu Pi','大腹皮','Areca catechu (Pericarpium)','Pericarpium Arecae','Betel husk',
  'regulate_qi','slightly_warm','{acrid}','{spleen,stomach,large_intestine,small_intestine}',
  $t$Moves qi and reduces distention. Promotes urination and reduces edema.$t$,
  $t$Abdominal distention and fullness from dampness and food stagnation. Edema and beriberi with distention.$t$,
  $t$Not for qi deficiency.$t$,
  5, 9, null);

perform public.upsert_herb('Shi Di','柿蒂','Diospyros kaki (Calyx)','Calyx Kaki','Persimmon calyx',
  'regulate_qi','neutral','{bitter,astringent}','{stomach}',
  $t$Directs rebellious Stomach qi downward and stops hiccup.$t$,
  $t$Hiccup of any type, combined according to whether it is cold or hot.$t$,
  $t$Gentle.$t$,
  5, 9, null);

perform public.upsert_herb('Mei Gui Hua','玫瑰花','Rosa rugosa (Flos)','Flos Rosae Rugosae','Rose bud',
  'regulate_qi','warm','{sweet,bitter}','{liver,spleen}',
  $t$Spreads Liver qi and relieves constraint. Harmonizes the blood and alleviates pain.$t$,
  $t$Flank and epigastric distention, irritability, breast distention, irregular menses from Liver constraint. Trauma with pain. Gentle enough for daily tea.$t$,
  $t$Not for yin deficiency with fire. Add at the end, or steep.$t$,
  3, 6, 'Add at the end.');

perform public.upsert_herb('Li Zhi He','荔枝核','Litchi chinensis (Semen)','Semen Litchi','Lychee seed',
  'regulate_qi','warm','{sweet,astringent}','{liver,kidney}',
  $t$Moves qi and disperses cold. Alleviates pain.$t$,
  $t$Hernia pain, testicular swelling and pain, lower abdominal pain, dysmenorrhea from cold and qi stagnation.$t$,
  $t$Not for absence of cold stagnation.$t$,
  6, 9, null);

-- ---------------------------------------------------------------------------
-- Stop bleeding
-- ---------------------------------------------------------------------------

perform public.upsert_herb('San Qi','三七','Panax notoginseng (Radix)','Radix Notoginseng','Notoginseng, tienchi',
  'stop_bleeding','warm','{sweet,bitter}','{liver,stomach}',
  $t$Stops bleeding without causing stasis. Invigorates the blood and dispels stasis. Reduces swelling and alleviates pain.$t$,
  $t$Bleeding of any kind, internal or external: hemoptysis, hematemesis, blood in stool or urine, uterine bleeding, trauma. Pain and swelling from trauma; chest pain from stasis; angina.$t$,
  $t$Use cautiously in pregnancy and in blood deficiency without stasis. Powder is the usual form.$t$,
  3, 9, 'Powder 1 to 3 g, swallowed. Also called Tian Qi.');

perform public.upsert_herb('Bai Ji','白及','Bletilla striata (Rhizoma)','Rhizoma Bletillae','Bletilla rhizome',
  'stop_bleeding','slightly_cold','{bitter,sweet,astringent}','{lung,liver,stomach}',
  $t$Astringes and stops bleeding. Reduces swelling and generates flesh.$t$,
  $t$Hemoptysis, hematemesis, bleeding from ulcers or wounds. Sores, burns, cracked skin, anal fissures (topical).$t$,
  $t$Not for bleeding from excess heat in the early stage, or Lung abscess with active pus. Incompatible with Wu Tou. Powder is stronger.$t$,
  3, 9, 'Powder 1.5 to 3 g.');

perform public.upsert_herb('Xian He Cao','仙鹤草','Agrimonia pilosa (Herba)','Herba Agrimoniae','Agrimony',
  'stop_bleeding','neutral','{bitter,astringent}','{lung,liver,spleen}',
  $t$Astringes and stops bleeding of any kind. Stops diarrhea and dysentery. Kills parasites. Tonifies and relieves fatigue.$t$,
  $t$Bleeding of any type and any pattern, cold or hot. Chronic diarrhea and dysentery. Trichomonas vaginitis (wash). Fatigue and weakness.$t$,
  $t$Gentle and broadly applicable.$t$,
  9, 15, 'Up to 30 g.');

perform public.upsert_herb('Di Yu','地榆','Sanguisorba officinalis (Radix)','Radix Sanguisorbae','Burnet root',
  'stop_bleeding','slightly_cold','{bitter,sour,astringent}','{liver,large_intestine,stomach}',
  $t$Cools the blood and stops bleeding, especially in the lower body. Clears heat and resolves toxicity. Generates flesh topically.$t$,
  $t$Bleeding hemorrhoids, blood in stool, bloody dysentery, uterine bleeding. Burns, eczema and sores (topical powder or oil).$t$,
  $t$Not for bleeding from deficiency cold or with stasis. Do not apply over extensive burns: absorbed tannins are hepatotoxic.$t$,
  9, 15, 'Charred for bleeding.');

perform public.upsert_herb('Huai Hua','槐花','Styphnolobium japonicum (Flos)','Flos Sophorae','Pagoda tree flower',
  'stop_bleeding','slightly_cold','{bitter}','{liver,large_intestine}',
  $t$Cools the blood and stops bleeding. Clears Liver fire.$t$,
  $t$Bleeding hemorrhoids, blood in stool, bloody dysentery, uterine bleeding from heat. Red eyes, headache and hypertension from Liver fire.$t$,
  $t$Not for bleeding from deficiency cold. Huai Jiao (fruit) is similar and also moistens the intestines.$t$,
  6, 9, 'Charred for bleeding; raw for Liver fire.');

perform public.upsert_herb('Ce Bai Ye','侧柏叶','Platycladus orientalis (Cacumen)','Cacumen Platycladi','Arborvitae twig',
  'stop_bleeding','slightly_cold','{bitter,astringent}','{lung,liver,spleen}',
  $t$Cools the blood and stops bleeding. Stops cough and expels phlegm. Promotes hair growth.$t$,
  $t$Bleeding of any type, especially with heat. Cough with sticky sputum from Lung heat. Hair loss and premature greying (topical tincture).$t$,
  $t$Not for bleeding from deficiency cold in large doses.$t$,
  6, 12, 'Charred for bleeding.');

perform public.upsert_herb('Da Ji','大蓟','Cirsium japonicum (Herba)','Herba Cirsii Japonici','Japanese thistle',
  'stop_bleeding','cool','{sweet,bitter}','{heart,liver}',
  $t$Cools the blood and stops bleeding. Resolves toxicity and reduces abscesses.$t$,
  $t$Hemoptysis, hematemesis, blood in urine, uterine bleeding from heat. Sores and abscesses (fresh herb topically).$t$,
  $t$Not for bleeding from deficiency cold or Spleen deficiency.$t$,
  9, 15, null);

perform public.upsert_herb('Xiao Ji','小蓟','Cirsium setosum (Herba)','Herba Cirsii','Field thistle',
  'stop_bleeding','cool','{sweet,bitter}','{heart,liver}',
  $t$Cools the blood and stops bleeding, especially in the urine. Resolves toxicity and reduces abscesses. Promotes urination.$t$,
  $t$Blood in urine, painful bloody urination (Xiao Ji Yin Zi). Other bleeding from heat. Sores.$t$,
  $t$Not for bleeding from deficiency cold or Spleen deficiency.$t$,
  9, 15, null);

perform public.upsert_herb('Bai Mao Gen','白茅根','Imperata cylindrica (Rhizoma)','Rhizoma Imperatae','Cogongrass rhizome',
  'stop_bleeding','cold','{sweet}','{lung,stomach,bladder}',
  $t$Cools the blood and stops bleeding. Clears heat and promotes urination. Generates fluids and alleviates thirst.$t$,
  $t$Nosebleed, hemoptysis, hematemesis, blood in urine from heat. Painful urination, edema, jaundice. Thirst and irritability in febrile disease. Gentle enough for children.$t$,
  $t$Not for Spleen and Stomach deficiency cold.$t$,
  9, 30, 'Fresh: 30 to 60 g.');

perform public.upsert_herb('Ou Jie','藕节','Nelumbo nucifera (Nodus rhizomatis)','Nodus Nelumbinis Rhizomatis','Lotus rhizome node',
  'stop_bleeding','neutral','{sweet,astringent}','{liver,lung,stomach}',
  $t$Stops bleeding and dispels stasis, gently.$t$,
  $t$Hemoptysis, hematemesis, nosebleed, blood in urine or stool, uterine bleeding. Safe in any pattern.$t$,
  $t$Gentle; combine according to pattern.$t$,
  9, 15, 'Charred for stronger astringency.');

perform public.upsert_herb('Pu Huang','蒲黄','Typha angustifolia (Pollen)','Pollen Typhae','Cattail pollen',
  'stop_bleeding','neutral','{sweet}','{liver,heart,pericardium}',
  $t$Charred, it stops bleeding. Raw, it invigorates the blood and dispels stasis. Promotes urination.$t$,
  $t$Bleeding of any type with stasis. Dysmenorrhea, postpartum abdominal pain, chest pain from stasis (Shi Xiao San). Painful, bloody urination.$t$,
  $t$Raw form contraindicated in pregnancy. Decoct in a cloth bag.$t$,
  3, 9, 'Decoct in a bag. Charred to stop bleeding; raw for stasis.');

perform public.upsert_herb('Ai Ye','艾叶','Artemisia argyi (Folium)','Folium Artemisiae Argyi','Mugwort leaf',
  'stop_bleeding','warm','{bitter,acrid}','{liver,spleen,kidney}',
  $t$Warms the channels and stops bleeding. Disperses cold and alleviates pain. Calms the fetus. Dries dampness and stops itching topically. The material for moxibustion.$t$,
  $t$Uterine bleeding and excessive menses from cold in the lower burner. Dysmenorrhea and infertility from cold. Threatened miscarriage with cold. Eczema and itching (wash).$t$,
  $t$Not for bleeding from blood heat or yin deficiency. Small doses.$t$,
  3, 9, 'Charred for bleeding; vinegar-processed to warm and alleviate pain.');

perform public.upsert_herb('Zong Lu Tan','棕榈炭','Trachycarpus fortunei (Petiolus carbonisatus)','Petiolus Trachycarpi Carbonisatus','Charred palm fiber',
  'stop_bleeding','neutral','{bitter,astringent}','{lung,liver,large_intestine}',
  $t$Astringes and stops bleeding.$t$,
  $t$Uterine bleeding, hematemesis, hemoptysis, blood in stool without stasis; chronic bleeding.$t$,
  $t$Not for bleeding with stasis or in the early stage of heat bleeding: purely astringent.$t$,
  3, 9, 'Powder 1 to 1.5 g.');

perform public.upsert_herb('Xue Yu Tan','血余炭','Crinis carbonisatus (charred human hair)','Crinis Carbonisatus','Charred hair',
  'stop_bleeding','neutral','{bitter}','{liver,stomach}',
  $t$Stops bleeding and dispels stasis. Promotes urination.$t$,
  $t$Hemoptysis, nosebleed, hematemesis, blood in urine or stool, uterine bleeding. Difficult urination.$t$,
  $t$Not for Stomach weakness. Usually taken as powder.$t$,
  6, 9, 'Powder 1.5 to 3 g.');

perform public.upsert_herb('Qian Cao','茜草','Rubia cordifolia (Radix)','Radix Rubiae','Madder root',
  'stop_bleeding','cold','{bitter}','{liver}',
  $t$Cools the blood and stops bleeding. Invigorates the blood and dispels stasis. Unblocks menses.$t$,
  $t$Bleeding from blood heat with stasis: uterine bleeding, hematemesis, nosebleed. Amenorrhea, trauma, joint pain from stasis.$t$,
  $t$Not for bleeding from deficiency cold. Charred for bleeding; raw for stasis.$t$,
  9, 15, 'Charred for bleeding; raw to invigorate.');

-- ---------------------------------------------------------------------------
-- Invigorate the blood
-- ---------------------------------------------------------------------------

perform public.upsert_herb('Chuan Xiong','川芎','Ligusticum chuanxiong (Rhizoma)','Rhizoma Chuanxiong','Sichuan lovage rhizome',
  'invigorate_blood','warm','{acrid}','{liver,gallbladder,pericardium}',
  $t$Invigorates the blood and moves qi. Expels wind and alleviates pain. Reaches upward to the head and downward to the sea of blood.$t$,
  $t$Dysmenorrhea, amenorrhea, difficult labor, postpartum pain from stasis. Headache of any type (principal herb). Bi pain, trauma, chest pain. Coronary disease.$t$,
  $t$Not for yin deficiency with fire, heavy menstrual bleeding, or headache from Liver yang rising without stasis. Pregnancy caution.$t$,
  3, 9, null);

perform public.upsert_herb('Dan Shen','丹参','Salvia miltiorrhiza (Radix)','Radix Salviae Miltiorrhizae','Red sage root',
  'invigorate_blood','slightly_cold','{bitter}','{heart,pericardium,liver}',
  $t$Invigorates the blood and dispels stasis. Cools the blood and reduces abscesses. Clears the Heart and calms the spirit.$t$,
  $t$Irregular menses, dysmenorrhea, amenorrhea, postpartum pain, abdominal masses. Chest pain, angina, coronary disease. Palpitations, insomnia and irritability from heat. Sores and abscesses.$t$,
  $t$Incompatible with Li Lu. Caution with anticoagulants and in bleeding tendency. Pregnancy caution.$t$,
  6, 15, 'Wine-fried to strengthen invigoration.');

perform public.upsert_herb('Yan Hu Suo','延胡索','Corydalis yanhusuo (Rhizoma)','Rhizoma Corydalis','Corydalis rhizome',
  'invigorate_blood','warm','{acrid,bitter}','{heart,liver,spleen}',
  $t$Invigorates the blood and moves qi. Alleviates pain anywhere in the body.$t$,
  $t$Pain from qi and blood stasis: chest, epigastric, abdominal, flank, hernia, dysmenorrhea, trauma, bi. One of the strongest analgesic herbs.$t$,
  $t$Contraindicated in pregnancy. Vinegar-fried to increase the analgesic effect; powder is stronger than decoction.$t$,
  3, 9, 'Vinegar-fried. Powder 1.5 to 3 g.');

perform public.upsert_herb('Yu Jin','郁金','Curcuma wenyujin or C. longa (Radix)','Radix Curcumae','Curcuma tuber',
  'invigorate_blood','cold','{acrid,bitter}','{heart,liver,gallbladder}',
  $t$Invigorates the blood and moves qi. Alleviates pain. Clears the Heart and opens the orifices. Cools the blood. Benefits the Gallbladder and reduces jaundice.$t$,
  $t$Chest, flank and abdominal pain from constraint with heat; dysmenorrhea. Confusion, epilepsy, mania from phlegm-heat blocking the Heart. Bleeding from heat with stasis. Damp-heat jaundice.$t$,
  $t$Not for yin deficiency without stasis, or pregnancy. Traditionally not combined with Ding Xiang.$t$,
  6, 12, null);

perform public.upsert_herb('Jiang Huang','姜黄','Curcuma longa (Rhizoma)','Rhizoma Curcumae Longae','Turmeric rhizome',
  'invigorate_blood','warm','{acrid,bitter}','{spleen,liver}',
  $t$Invigorates the blood and moves qi. Alleviates pain. Unblocks the channels, especially in the shoulders and arms.$t$,
  $t$Chest and abdominal pain, dysmenorrhea, amenorrhea from qi and blood stasis. Wind-damp bi in the shoulders and arms. Trauma and sores.$t$,
  $t$Contraindicated in pregnancy. Not for blood deficiency without stasis.$t$,
  3, 9, null);

perform public.upsert_herb('E Zhu','莪术','Curcuma phaeocaulis (Rhizoma)','Rhizoma Curcumae','Zedoary rhizome',
  'invigorate_blood','warm','{acrid,bitter}','{liver,spleen}',
  $t$Breaks up blood stasis and dissipates masses. Moves qi and alleviates pain. Reduces food stagnation.$t$,
  $t$Abdominal masses, amenorrhea from severe stasis. Abdominal distention and pain from food stagnation and qi stagnation. Adjunct in some tumors.$t$,
  $t$Contraindicated in pregnancy and in heavy menstruation. Not for weak patients without stasis. Vinegar-processed.$t$,
  3, 9, 'Usually paired with San Leng.');

perform public.upsert_herb('San Leng','三棱','Sparganium stoloniferum (Rhizoma)','Rhizoma Sparganii','Bur-reed rhizome',
  'invigorate_blood','neutral','{bitter,acrid}','{liver,spleen}',
  $t$Breaks up blood stasis and moves qi. Dissipates masses and alleviates pain.$t$,
  $t$Abdominal masses, amenorrhea, severe stasis pain. Food stagnation with fullness. Paired with E Zhu.$t$,
  $t$Contraindicated in pregnancy and in heavy menstruation. Not for weak patients. Vinegar-processed.$t$,
  3, 9, null);

perform public.upsert_herb('Ru Xiang','乳香','Boswellia carterii (Gummi olibanum)','Olibanum','Frankincense',
  'invigorate_blood','warm','{acrid,bitter}','{heart,liver,spleen}',
  $t$Invigorates the blood and alleviates pain. Reduces swelling and generates flesh. Relaxes the sinews.$t$,
  $t$Trauma with pain and swelling, bi with stiff sinews, chest and abdominal pain, dysmenorrhea. Sores and ulcers that fail to heal (topical). Paired with Mo Yao.$t$,
  $t$Contraindicated in pregnancy. Not for weak Stomach: causes nausea; use processed and in small amounts.$t$,
  3, 9, 'Vinegar-processed to reduce nausea.');

perform public.upsert_herb('Mo Yao','没药','Commiphora myrrha (Gummi resina)','Myrrha','Myrrh',
  'invigorate_blood','neutral','{bitter}','{heart,liver,spleen}',
  $t$Invigorates the blood and dispels stasis. Alleviates pain. Reduces swelling and generates flesh.$t$,
  $t$Trauma, abdominal masses, dysmenorrhea, amenorrhea, bi pain from stasis. Sores and ulcers (topical). Paired with Ru Xiang.$t$,
  $t$Contraindicated in pregnancy. Not for weak Stomach; processed to reduce nausea.$t$,
  3, 9, 'Vinegar-processed.');

perform public.upsert_herb('Wu Ling Zhi','五灵脂','Trogopterus xanthipes (Faeces)','Faeces Trogopterori','Flying squirrel droppings',
  'invigorate_blood','warm','{bitter,sweet}','{liver}',
  $t$Invigorates the blood and alleviates pain. Charred, it stops bleeding with stasis.$t$,
  $t$Dysmenorrhea, amenorrhea, postpartum abdominal pain, epigastric pain from stasis (Shi Xiao San). Uterine bleeding with stasis.$t$,
  $t$Contraindicated in pregnancy. Traditionally incompatible with Ren Shen. Animal product; decoct in a cloth bag.$t$,
  3, 9, 'Decoct in a bag.');

perform public.upsert_herb('Tao Ren','桃仁','Prunus persica (Semen)','Semen Persicae','Peach kernel',
  'invigorate_blood','neutral','{bitter,sweet}','{heart,liver,large_intestine}',
  $t$Breaks up blood stasis. Moistens the intestines and unblocks the bowels. Stops cough. Reduces abscesses.$t$,
  $t$Amenorrhea, dysmenorrhea, abdominal masses, trauma, postpartum pain from stasis. Constipation from dryness. Lung abscess and intestinal abscess.$t$,
  $t$Contraindicated in pregnancy. Slightly toxic (amygdalin): keep within range. Crush before decocting.$t$,
  5, 9, 'Crush before use.');

perform public.upsert_herb('Hong Hua','红花','Carthamus tinctorius (Flos)','Flos Carthami','Safflower',
  'invigorate_blood','warm','{acrid}','{heart,liver}',
  $t$Invigorates the blood and unblocks the menses. Dispels stasis and alleviates pain. In small doses, harmonizes the blood. Vents dark rashes.$t$,
  $t$Amenorrhea, dysmenorrhea, retained lochia, abdominal masses. Trauma with swelling and pain. Chest pain, angina. Dark, unerupted rashes from stasis.$t$,
  $t$Contraindicated in pregnancy and in bleeding tendency. Small doses (1 to 3 g) harmonize; larger doses break stasis.$t$,
  3, 9, 'Zang Hong Hua (saffron) is the stronger, cooling relative.');

perform public.upsert_herb('Yi Mu Cao','益母草','Leonurus japonicus (Herba)','Herba Leonuri','Chinese motherwort',
  'invigorate_blood','slightly_cold','{acrid,bitter}','{heart,liver,bladder}',
  $t$Invigorates the blood and regulates menstruation. Promotes urination and reduces edema. Clears heat and resolves toxicity.$t$,
  $t$Irregular menses, dysmenorrhea, amenorrhea, retained lochia, postpartum abdominal pain. Edema with blood in the urine. Sores and itchy rashes.$t$,
  $t$Contraindicated in pregnancy. Not for blood deficiency without stasis.$t$,
  9, 30, 'Chong Wei Zi (seed) also brightens the eyes.');

perform public.upsert_herb('Ze Lan','泽兰','Lycopus lucidus (Herba)','Herba Lycopi','Bugleweed',
  'invigorate_blood','slightly_warm','{bitter,acrid}','{liver,spleen}',
  $t$Invigorates the blood and regulates menstruation. Promotes urination and reduces edema.$t$,
  $t$Irregular menses, dysmenorrhea, amenorrhea, postpartum pain from stasis. Postpartum edema, ascites. Trauma. Gentle enough for deficiency with stasis.$t$,
  $t$Not for blood deficiency without stasis.$t$,
  6, 12, null);

perform public.upsert_herb('Niu Xi','牛膝','Achyranthes bidentata (Radix)','Radix Achyranthis Bidentatae','Achyranthes root',
  'invigorate_blood','neutral','{bitter,sour,sweet}','{liver,kidney}',
  $t$Invigorates the blood and dispels stasis. Tonifies the Liver and Kidney and strengthens the sinews and bones. Guides blood and fire downward. Promotes urination.$t$,
  $t$Dysmenorrhea, amenorrhea, postpartum pain, trauma. Weak, sore lower back and knees. Headache, dizziness, nosebleed, toothache and mouth sores from fire rising. Painful, bloody urination.$t$,
  $t$Contraindicated in pregnancy and heavy menstruation. Not for Spleen deficiency with diarrhea. Huai Niu Xi tonifies; Chuan Niu Xi (Cyathula) invigorates more strongly.$t$,
  6, 15, 'Wine-fried to invigorate; raw to guide downward.');

perform public.upsert_herb('Ji Xue Teng','鸡血藤','Spatholobus suberectus (Caulis)','Caulis Spatholobi','Spatholobus stem',
  'invigorate_blood','warm','{bitter,sweet}','{liver,kidney}',
  $t$Invigorates and nourishes the blood. Relaxes the sinews and unblocks the channels.$t$,
  $t$Irregular menses and dysmenorrhea from blood deficiency with stasis. Numbness, stiffness and bi pain; hemiplegia. Low blood counts after chemotherapy (adjunct).$t$,
  $t$Gentle; suitable for deficiency with stasis. Pregnancy caution.$t$,
  9, 15, 'Up to 30 g.');

perform public.upsert_herb('Wang Bu Liu Xing','王不留行','Vaccaria segetalis (Semen)','Semen Vaccariae','Vaccaria seed',
  'invigorate_blood','neutral','{bitter}','{liver,stomach}',
  $t$Invigorates the blood and unblocks the menses. Promotes lactation. Reduces breast abscess. Promotes urination.$t$,
  $t$Amenorrhea and dysmenorrhea from stasis. Insufficient lactation, breast abscess. Painful, stony urination. Also the standard seed for auricular pressure.$t$,
  $t$Contraindicated in pregnancy.$t$,
  6, 9, 'Dry-fried until it pops.');

perform public.upsert_herb('Su Mu','苏木','Caesalpinia sappan (Lignum)','Lignum Sappan','Sappan wood',
  'invigorate_blood','neutral','{sweet,salty}','{heart,liver,spleen}',
  $t$Invigorates the blood and dispels stasis. Reduces swelling and alleviates pain.$t$,
  $t$Trauma with swelling and pain, fractures. Amenorrhea, postpartum abdominal pain from stasis.$t$,
  $t$Contraindicated in pregnancy and heavy menstruation.$t$,
  3, 9, null);

perform public.upsert_herb('Shui Zhi','水蛭','Whitmania pigra or Hirudo nipponica (whole body)','Hirudo','Leech',
  'invigorate_blood','neutral','{salty,bitter}','{liver}',
  $t$Breaks up blood stasis and dissipates masses. Unblocks the menses.$t$,
  $t$Abdominal masses, amenorrhea from severe stasis, trauma with internal bleeding, stroke sequelae with stasis. Hirudin has anticoagulant activity.$t$,
  $t$Toxic and an animal product. Contraindicated in pregnancy and in bleeding tendency. Powder is far stronger than decoction; keep within range.$t$,
  1.5, 3, 'Powder 0.3 to 0.5 g.');

perform public.upsert_herb('Tu Bie Chong','土鳖虫','Eupolyphaga sinensis (whole body)','Eupolyphaga','Wingless cockroach',
  'invigorate_blood','cold','{salty}','{liver}',
  $t$Breaks up blood stasis. Heals fractures and knits sinews.$t$,
  $t$Fractures, trauma with stasis. Amenorrhea, abdominal masses, postpartum pain from stasis.$t$,
  $t$Toxic and an animal product. Contraindicated in pregnancy. Also called Zhe Chong.$t$,
  3, 9, 'Powder 1 to 1.5 g.');

perform public.upsert_herb('Yue Ji Hua','月季花','Rosa chinensis (Flos)','Flos Rosae Chinensis','China rose flower',
  'invigorate_blood','warm','{sweet}','{liver}',
  $t$Invigorates the blood and regulates menstruation. Spreads Liver qi. Reduces swelling.$t$,
  $t$Irregular or scanty menses, dysmenorrhea, breast distention from Liver constraint with stasis. Scrofula and sores (topical).$t$,
  $t$Pregnancy caution. Not for Spleen deficiency with loose stools. Gentle.$t$,
  3, 6, null);

perform public.upsert_herb('Liu Ji Nu','刘寄奴','Artemisia anomala (Herba)','Herba Artemisiae Anomalae','Anomalous artemisia',
  'invigorate_blood','warm','{bitter}','{heart,liver,spleen}',
  $t$Breaks up blood stasis and unblocks the menses. Stops bleeding from trauma. Reduces food stagnation.$t$,
  $t$Amenorrhea, postpartum pain from stasis. Trauma with bleeding and pain (internal and topical). Food stagnation with abdominal pain.$t$,
  $t$Contraindicated in pregnancy.$t$,
  3, 9, null);

perform public.upsert_herb('Zi Ran Tong','自然铜','Pyritum (mineral, FeS2)','Pyritum','Pyrite',
  'invigorate_blood','neutral','{acrid}','{liver}',
  $t$Dispels stasis and alleviates pain. Promotes the healing of fractures.$t$,
  $t$Fractures, trauma with swelling and pain.$t$,
  $t$Contraindicated in pregnancy. Not for blood deficiency without stasis. Calcined and vinegar-quenched; decoct first, or take as powder.$t$,
  3, 9, 'Decoct first. Powder 0.3 g.');

end
$seed$;
