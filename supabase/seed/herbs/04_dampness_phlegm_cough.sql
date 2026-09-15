-- ============================================================================
-- Materia medica · 04 · Aromatic dampness, phlegm, cough and wheezing
-- ============================================================================
-- See 01 for conventions. Ma Dou Ling (Aristolochia) is deliberately absent:
-- it is nephrotoxic and banned in most jurisdictions.
-- ============================================================================

do $seed$
begin

-- ---------------------------------------------------------------------------
-- Aromatic herbs that transform dampness
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Cang Zhu','苍术','Atractylodes lancea (Rhizoma)','Rhizoma Atractylodis','Black atractylodes',
  'aromatic_transform_dampness','warm','{acrid,bitter}','{spleen,stomach}',
  $t$Dries dampness and strengthens the Spleen. Dispels wind-dampness. Induces sweating and releases the exterior. Brightens the eyes.$t$,
  $t$Damp obstruction of the middle: epigastric fullness, poor appetite, nausea, loose stools, a thick greasy tongue coat. Damp bi with heavy, painful joints. Exterior wind-cold-damp. Night blindness.$t$,
  $t$Not for yin deficiency with heat, or exterior deficiency with sweating. Drying.$t$,
  3, 9, 'Dry-fried to reduce its acridity.');

perform public.catalogue_upsert_herb('Hou Po','厚朴','Magnolia officinalis (Cortex)','Cortex Magnoliae Officinalis','Magnolia bark',
  'aromatic_transform_dampness','warm','{bitter,acrid}','{spleen,stomach,lung,large_intestine}',
  $t$Moves qi and transforms dampness. Resolves stagnation and reduces fullness. Directs qi downward and calms wheezing.$t$,
  $t$Abdominal and epigastric distention and fullness from dampness, food stagnation or constipation. Cough and wheezing with copious phlegm. Plum-pit qi.$t$,
  $t$Use cautiously in pregnancy. Not for qi deficiency, or yin deficiency with dryness.$t$,
  3, 9, 'Ginger-processed to reduce throat irritation. Hou Po Hua (flower) is gentler.');

perform public.catalogue_upsert_herb('Huo Xiang','藿香','Pogostemon cablin (Herba)','Herba Pogostemonis','Patchouli',
  'aromatic_transform_dampness','slightly_warm','{acrid}','{spleen,stomach,lung}',
  $t$Transforms dampness and harmonizes the middle. Stops vomiting. Releases the exterior in summer damp.$t$,
  $t$Dampness obstructing the middle with nausea, vomiting, poor appetite. Summer exterior cold with internal dampness (Huo Xiang Zheng Qi San). Damp-warmth in the early stage.$t$,
  $t$Not for yin deficiency with heat, or Stomach heat vomiting. Add near the end of decoction.$t$,
  5, 9, 'Add at the end.');

perform public.catalogue_upsert_herb('Pei Lan','佩兰','Eupatorium fortunei (Herba)','Herba Eupatorii','Eupatorium',
  'aromatic_transform_dampness','neutral','{acrid}','{spleen,stomach}',
  $t$Transforms dampness and harmonizes the middle. Releases summer-heat.$t$,
  $t$Dampness in the middle with a sweet, sticky taste in the mouth, bad breath, poor appetite, nausea. Summer-heat with dampness.$t$,
  $t$Not for yin deficiency. Add near the end of decoction.$t$,
  5, 9, 'Add at the end.');

perform public.catalogue_upsert_herb('Sha Ren','砂仁','Amomum villosum (Fructus)','Fructus Amomi','Amomum fruit',
  'aromatic_transform_dampness','warm','{acrid}','{spleen,stomach,kidney}',
  $t$Transforms dampness and moves qi. Warms the middle and stops diarrhea. Calms the fetus. Prevents rich tonics from causing stagnation.$t$,
  $t$Dampness and qi stagnation in the middle: epigastric fullness, poor appetite, nausea. Diarrhea from Spleen cold. Morning sickness, restless fetus. Added to tonic formulas to aid digestion.$t$,
  $t$Not for yin deficiency with heat. Crush and add in the last few minutes of decoction.$t$,
  3, 6, 'Add at the end, crushed.');

perform public.catalogue_upsert_herb('Bai Dou Kou','白豆蔻','Amomum kravanh (Fructus)','Fructus Amomi Rotundus','Round cardamom',
  'aromatic_transform_dampness','warm','{acrid}','{lung,spleen,stomach}',
  $t$Transforms dampness and moves qi. Warms the middle and stops vomiting. Reaches the upper and middle burners.$t$,
  $t$Dampness obstructing the middle with fullness, poor appetite. Vomiting from Stomach cold. Early-stage damp-warmth with chest oppression.$t$,
  $t$Not for yin deficiency with heat. Crush and add at the end of decoction.$t$,
  3, 6, 'Add at the end, crushed.');

perform public.catalogue_upsert_herb('Cao Dou Kou','草豆蔻','Alpinia katsumadai (Semen)','Semen Alpiniae Katsumadai','Katsumada galangal seed',
  'aromatic_transform_dampness','warm','{acrid}','{spleen,stomach}',
  $t$Dries dampness and warms the middle. Moves qi and stops vomiting.$t$,
  $t$Cold-damp in the middle with epigastric pain, vomiting, poor appetite, loose stools.$t$,
  $t$Not for yin deficiency with heat.$t$,
  3, 6, null);

perform public.catalogue_upsert_herb('Cao Guo','草果','Amomum tsao-ko (Fructus)','Fructus Tsaoko','Tsaoko fruit',
  'aromatic_transform_dampness','warm','{acrid}','{spleen,stomach}',
  $t$Dries dampness and warms the middle. Dispels phlegm and treats malaria.$t$,
  $t$Cold-damp in the middle with distention and pain, vomiting, diarrhea. Malaria with turbid dampness.$t$,
  $t$Not for yin or blood deficiency. Strongly drying.$t$,
  3, 6, null);

-- ---------------------------------------------------------------------------
-- Warm herbs that transform cold phlegm
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Ban Xia','半夏','Pinellia ternata (Rhizoma)','Rhizoma Pinelliae','Pinellia rhizome',
  'transform_phlegm_cold','warm','{acrid}','{spleen,stomach,lung}',
  $t$Dries dampness and transforms phlegm. Directs rebellious qi downward and stops vomiting. Reduces distention and dissipates nodules. Topically reduces swelling.$t$,
  $t$Cough with copious white sputum, phlegm-damp dizziness and palpitations. Vomiting of all types (principal herb). Epigastric fullness, plum-pit qi, goiter, phlegm nodules.$t$,
  $t$Toxic raw: use only processed (Fa Ban Xia, Jiang Ban Xia, Qing Ban Xia). Contraindicated in pregnancy unless clearly indicated and processed. Not for dry cough from yin deficiency or bleeding. Incompatible with Wu Tou.$t$,
  3, 9, 'Processed forms only. Ginger-processed for vomiting; Fa Ban Xia for phlegm.');

perform public.catalogue_upsert_herb('Tian Nan Xing','天南星','Arisaema erubescens (Rhizoma)','Rhizoma Arisaematis','Jack-in-the-pulpit rhizome',
  'transform_phlegm_cold','warm','{bitter,acrid}','{lung,liver,spleen}',
  $t$Dries dampness and transforms phlegm. Dispels wind and stops spasms. Topically reduces swelling and alleviates pain.$t$,
  $t$Stubborn phlegm with cough and chest oppression. Wind-phlegm with dizziness, stroke, facial paralysis, epilepsy, tetanus. Topical for sores, swellings and trauma.$t$,
  $t$Toxic raw: use only processed (Zhi Nan Xing) internally. Contraindicated in pregnancy. Not for yin deficiency with dry phlegm. Dan Nan Xing (bile-processed) is cool and used for phlegm-heat convulsions.$t$,
  3, 9, 'Processed only for internal use. Raw form topical only.');

perform public.catalogue_upsert_herb('Bai Fu Zi','白附子','Typhonium giganteum (Rhizoma)','Rhizoma Typhonii','Typhonium rhizome',
  'transform_phlegm_cold','warm','{acrid,sweet}','{stomach,liver}',
  $t$Dries dampness and transforms phlegm. Dispels wind and stops spasms. Resolves toxicity and dissipates nodules.$t$,
  $t$Wind-phlegm with facial paralysis, migraine, stroke with deviated mouth, tetanus. Scrofula and snakebite (topical).$t$,
  $t$Toxic: use only processed. Contraindicated in pregnancy. Not for blood deficiency wind.$t$,
  3, 6, 'Processed only.');

perform public.catalogue_upsert_herb('Bai Jie Zi','白芥子','Sinapis alba (Semen)','Semen Sinapis','White mustard seed',
  'transform_phlegm_cold','warm','{acrid}','{lung}',
  $t$Warms the Lung and expels phlegm. Moves qi and dissipates nodules. Reaches phlegm lodged in the channels and under the skin.$t$,
  $t$Cough and wheezing with thin, copious sputum and chest fullness. Phlegm lodged in the channels with numbness and joint pain. Phlegm nodules under the skin. Topical plaster for asthma (San Fu Tie).$t$,
  $t$Not for yin deficiency with heat, or cough with yellow sputum. Overdose irritates the digestive tract; topical use can blister.$t$,
  3, 9, 'Dry-fried.');

perform public.catalogue_upsert_herb('Jie Geng','桔梗','Platycodon grandiflorum (Radix)','Radix Platycodonis','Balloon flower root',
  'transform_phlegm_cold','neutral','{bitter,acrid}','{lung}',
  $t$Opens and disseminates Lung qi. Expels phlegm. Benefits the throat. Expels pus. Guides other herbs upward.$t$,
  $t$Cough with copious sputum, either cold or hot. Sore throat, loss of voice. Lung abscess with pus. Added to formulas to direct their action to the upper body.$t$,
  $t$Not for hemoptysis, or cough from yin deficiency with dry heat. Large doses cause nausea.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Xuan Fu Hua','旋覆花','Inula japonica (Flos)','Flos Inulae','Inula flower',
  'transform_phlegm_cold','slightly_warm','{bitter,acrid,salty}','{lung,spleen,stomach,large_intestine}',
  $t$Directs qi downward and transforms phlegm. Stops vomiting and belching. Disperses water accumulation.$t$,
  $t$Cough and wheezing with copious thin sputum, chest fullness. Belching, hiccup, vomiting from rebellious Stomach qi (Xuan Fu Dai Zhe Tang).$t$,
  $t$Not for yin deficiency dry cough or weak patients with loose stools. Decoct in a cloth bag: the hairs irritate the throat.$t$,
  3, 9, 'Decoct in a bag.');

perform public.catalogue_upsert_herb('Bai Qian','白前','Cynanchum stauntonii (Rhizoma)','Rhizoma Cynanchi Stauntonii','Cynanchum rhizome',
  'transform_phlegm_cold','slightly_warm','{acrid,sweet}','{lung}',
  $t$Directs Lung qi downward. Expels phlegm and stops cough.$t$,
  $t$Cough with copious sputum and wheezing from Lung qi failing to descend, whether cold or hot.$t$,
  $t$Gentle. Not for cough from Lung deficiency without phlegm.$t$,
  3, 9, 'Honey-fried for chronic cough.');

perform public.catalogue_upsert_herb('Zao Jiao Ci','皂角刺','Gleditsia sinensis (Spina)','Spina Gleditsiae','Honey locust thorn',
  'transform_phlegm_cold','warm','{acrid}','{liver,stomach}',
  $t$Reduces swelling and expels pus. Dispels wind and kills parasites.$t$,
  $t$Early-stage sores and abscesses that have not yet ulcerated; to bring them to a head. Scabies and leprosy (topical).$t$,
  $t$Contraindicated in pregnancy. Not for sores that have already ulcerated.$t$,
  3, 9, null);

-- ---------------------------------------------------------------------------
-- Cool herbs that transform hot phlegm
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Chuan Bei Mu','川贝母','Fritillaria cirrhosa (Bulbus)','Bulbus Fritillariae Cirrhosae','Sichuan fritillary bulb',
  'transform_phlegm_heat','slightly_cold','{bitter,sweet}','{lung,heart}',
  $t$Moistens the Lung and stops cough. Clears heat and transforms phlegm. Dissipates nodules and reduces swelling.$t$,
  $t$Chronic cough from Lung yin deficiency or Lung heat with dryness; cough with scant, sticky or bloody sputum. Scrofula, breast lumps, Lung abscess.$t$,
  $t$Not for cough from cold-damp phlegm. Incompatible with Wu Tou. Expensive: usually taken as powder, which is more effective than decoction.$t$,
  3, 9, 'Powder 1 to 1.5 g, swallowed with the decoction.');

perform public.catalogue_upsert_herb('Zhe Bei Mu','浙贝母','Fritillaria thunbergii (Bulbus)','Bulbus Fritillariae Thunbergii','Zhejiang fritillary bulb',
  'transform_phlegm_heat','cold','{bitter}','{lung,heart}',
  $t$Clears heat and transforms phlegm. Dissipates nodules and reduces swelling. Stops cough.$t$,
  $t$Acute cough with yellow sputum from wind-heat or phlegm-heat. Scrofula, goiter, breast lumps, Lung abscess, sores.$t$,
  $t$Not for cough from cold or Spleen deficiency. Incompatible with Wu Tou. Stronger at dissipating nodules than Chuan Bei Mu; less moistening.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Gua Lou','瓜蒌','Trichosanthes kirilowii (Fructus)','Fructus Trichosanthis','Trichosanthes fruit',
  'transform_phlegm_heat','cold','{sweet,bitter}','{lung,stomach,large_intestine}',
  $t$Clears heat and transforms phlegm. Unbinds the chest and dissipates nodules. Moistens the intestines. Reduces abscesses.$t$,
  $t$Cough with thick yellow sputum. Chest bi with pain and oppression, angina (Gua Lou Xie Bai Ban Xia Tang). Constipation from dryness. Breast abscess, Lung abscess.$t$,
  $t$Not for Spleen deficiency with loose stools or cold-damp phlegm. Incompatible with Wu Tou. Gua Lou Pi (peel) for chest and phlegm; Gua Lou Ren (seed) for the intestines.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Zhu Ru','竹茹','Bambusa tuldoides (Caulis in taeniis)','Caulis Bambusae in Taenia','Bamboo shavings',
  'transform_phlegm_heat','slightly_cold','{sweet}','{lung,stomach,gallbladder}',
  $t$Clears heat and transforms phlegm. Clears Stomach heat and stops vomiting. Relieves irritability. Calms the fetus.$t$,
  $t$Cough with yellow sputum. Vomiting from Stomach heat, morning sickness. Insomnia, palpitations and irritability from Gallbladder phlegm-heat (Wen Dan Tang). Restless fetus with heat.$t$,
  $t$Not for vomiting from Stomach cold.$t$,
  6, 9, 'Ginger-processed to stop vomiting.');

perform public.catalogue_upsert_herb('Tian Zhu Huang','天竺黄','Bambusa textilis (Concretio silicea)','Concretio Silicea Bambusae','Tabasheer, bamboo silica',
  'transform_phlegm_heat','cold','{sweet}','{heart,liver}',
  $t$Clears heat and transforms phlegm. Clears the Heart and stops convulsions.$t$,
  $t$Childhood convulsions and febrile seizures with phlegm-heat. Stroke with phlegm obstruction. Cough with thick sputum.$t$,
  $t$Not for cold phlegm or Spleen deficiency.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Zhu Li','竹沥','Bambusa (Succus)','Succus Bambusae','Bamboo sap',
  'transform_phlegm_heat','cold','{sweet}','{heart,lung,stomach}',
  $t$Clears heat and drains stubborn phlegm. Extinguishes wind.$t$,
  $t$Stroke with phlegm blocking the orifices, epilepsy, mania. Cough with thick, hard-to-expel sputum from Lung heat.$t$,
  $t$Not for cold phlegm, Spleen deficiency or loose stools. A liquid: add to the finished decoction, often with ginger juice.$t$,
  30, 60, 'Dose in millilitres; mixed into the strained decoction.');

perform public.catalogue_upsert_herb('Qian Hu','前胡','Peucedanum praeruptorum (Radix)','Radix Peucedani','Peucedanum root',
  'transform_phlegm_heat','slightly_cold','{bitter,acrid}','{lung}',
  $t$Directs qi downward and transforms phlegm. Disperses wind-heat.$t$,
  $t$Cough and wheezing with thick yellow sputum. Wind-heat exterior pattern with cough and headache.$t$,
  $t$Not for cough from yin deficiency or cold phlegm.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Kun Bu','昆布','Laminaria japonica (Thallus)','Thallus Laminariae','Kelp',
  'transform_phlegm_heat','cold','{salty}','{liver,stomach,kidney}',
  $t$Softens hardness and dissipates nodules. Transforms phlegm. Promotes urination.$t$,
  $t$Goiter, scrofula, testicular swelling. Edema and beriberi.$t$,
  $t$Not for Spleen and Stomach deficiency cold. Iodine content: care in thyroid disease.$t$,
  6, 12, null);

perform public.catalogue_upsert_herb('Hai Zao','海藻','Sargassum pallidum (Thallus)','Sargassum','Sargassum seaweed',
  'transform_phlegm_heat','cold','{salty,bitter}','{liver,stomach,kidney}',
  $t$Softens hardness and dissipates nodules. Transforms phlegm. Promotes urination.$t$,
  $t$Goiter, scrofula, testicular swelling and pain. Edema.$t$,
  $t$Not for Spleen and Stomach deficiency cold. Traditionally incompatible with Gan Cao, though Hai Zao Yu Hu Tang uses both deliberately.$t$,
  6, 12, null);

perform public.catalogue_upsert_herb('Hai Ge Ke','海蛤壳','Meretrix meretrix or Cyclina sinensis (Concha)','Concha Meretricis seu Cyclinae','Clam shell',
  'transform_phlegm_heat','cold','{salty,bitter}','{lung,stomach,kidney}',
  $t$Clears Lung heat and transforms phlegm. Softens hardness and dissipates nodules. Calcined, it absorbs acid and stops pain.$t$,
  $t$Cough with thick sputum or blood from Lung heat, chest pain. Goiter, scrofula. Acid reflux and epigastric pain (calcined). Topical for eczema.$t$,
  $t$Not for cold phlegm or Spleen deficiency. Decoct first, crushed.$t$,
  6, 15, 'Decoct first. Calcined (Duan Ge Ke) for acid.');

perform public.catalogue_upsert_herb('Pang Da Hai','胖大海','Sterculia lychnophora (Semen)','Semen Sterculiae Lychnophorae','Sterculia seed, boat sterculia',
  'transform_phlegm_heat','cold','{sweet}','{lung,large_intestine}',
  $t$Clears Lung heat and benefits the throat. Moistens the intestines.$t$,
  $t$Hoarseness, sore throat and dry cough from Lung heat; loss of voice in teachers and singers. Constipation with heat.$t$,
  $t$Not for cough from cold or Spleen deficiency. Steeped in hot water rather than decocted; 2 to 4 seeds.$t$,
  2, 4, 'Dose is in seeds; steep in hot water.');

perform public.catalogue_upsert_herb('Fu Hai Shi','浮海石','Pumex (mineral)','Pumex','Pumice',
  'transform_phlegm_heat','cold','{salty}','{lung}',
  $t$Clears Lung heat and transforms sticky phlegm. Softens hardness. Promotes urination and expels stones.$t$,
  $t$Cough with thick, sticky, hard-to-expel sputum from Lung heat. Scrofula, goiter. Painful, stony urination.$t$,
  $t$Not for cold phlegm or Spleen deficiency. Decoct first.$t$,
  6, 9, 'Decoct first.');

perform public.catalogue_upsert_herb('Meng Shi','礞石','Chlorite schist (mineral)','Lapis Chloriti','Chlorite schist',
  'transform_phlegm_heat','neutral','{sweet,salty}','{lung,liver}',
  $t$Drives out stubborn phlegm. Calms the Liver and stops convulsions.$t$,
  $t$Stubborn phlegm-heat with wheezing, mania, epilepsy, palpitations (Meng Shi Gun Tan Wan).$t$,
  $t$Contraindicated in pregnancy. Not for weak patients or Spleen deficiency. Calcined; decoct first or use in pills.$t$,
  9, 15, 'Decoct first; pills 1.5 to 3 g.');

-- ---------------------------------------------------------------------------
-- Herbs that relieve cough and wheezing
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Xing Ren','杏仁','Prunus armeniaca (Semen amarum)','Semen Armeniacae Amarum','Bitter apricot kernel',
  'relieve_cough_wheezing','slightly_warm','{bitter}','{lung,large_intestine}',
  $t$Stops cough and calms wheezing by directing Lung qi downward. Moistens the intestines and unblocks the bowels.$t$,
  $t$Cough and wheezing of any type; the principal cough herb, combined according to pattern. Constipation from dryness.$t$,
  $t$Slightly toxic (amygdalin): keep within range and never give to infants; overdose can be fatal. Not for loose stools. Crush before decocting.$t$,
  3, 9, 'Crush before use. Not for infants.');

perform public.catalogue_upsert_herb('Zi Su Zi','紫苏子','Perilla frutescens (Fructus)','Fructus Perillae','Perilla seed',
  'relieve_cough_wheezing','warm','{acrid}','{lung,large_intestine}',
  $t$Directs qi downward and transforms phlegm. Stops cough and calms wheezing. Moistens the intestines.$t$,
  $t$Cough and wheezing with copious sputum and chest fullness from rebellious Lung qi. Constipation from dryness with qi stagnation.$t$,
  $t$Not for loose stools or qi deficiency wheezing.$t$,
  5, 9, null);

perform public.catalogue_upsert_herb('Bai Bu','百部','Stemona sessilifolia (Radix)','Radix Stemonae','Stemona root',
  'relieve_cough_wheezing','slightly_warm','{sweet,bitter}','{lung}',
  $t$Moistens the Lung and stops cough. Kills lice and parasites.$t$,
  $t$Cough of any type, especially chronic cough, whooping cough and tuberculosis. Head lice, pinworms, scabies (topical or enema).$t$,
  $t$Not for Spleen deficiency with loose stools. Honey-fried for chronic cough.$t$,
  5, 9, 'Honey-fried for cough; raw for parasites.');

perform public.catalogue_upsert_herb('Zi Wan','紫菀','Aster tataricus (Radix)','Radix Asteris','Aster root',
  'relieve_cough_wheezing','slightly_warm','{bitter,acrid,sweet}','{lung}',
  $t$Moistens the Lung and directs qi downward. Transforms phlegm and stops cough.$t$,
  $t$Cough with copious sputum, acute or chronic, cold or hot; cough with blood from Lung deficiency.$t$,
  $t$Gentle; combine according to pattern. Honey-fried for chronic cough.$t$,
  5, 9, 'Usually paired with Kuan Dong Hua.');

perform public.catalogue_upsert_herb('Kuan Dong Hua','款冬花','Tussilago farfara (Flos)','Flos Farfarae','Coltsfoot flower',
  'relieve_cough_wheezing','warm','{acrid,bitter}','{lung}',
  $t$Moistens the Lung and directs qi downward. Stops cough and transforms phlegm.$t$,
  $t$Cough and wheezing of any type, especially with copious sputum; chronic cough with blood.$t$,
  $t$Contains pyrrolizidine alkaloids: avoid prolonged use, pregnancy and liver disease. Honey-fried.$t$,
  5, 9, 'Honey-fried. Short courses.');

perform public.catalogue_upsert_herb('Pi Pa Ye','枇杷叶','Eriobotrya japonica (Folium)','Folium Eriobotryae','Loquat leaf',
  'relieve_cough_wheezing','slightly_cold','{bitter}','{lung,stomach}',
  $t$Clears Lung heat, transforms phlegm and stops cough. Harmonizes the Stomach and stops vomiting.$t$,
  $t$Cough with yellow sputum from Lung heat; dry cough from Lung dryness. Vomiting, hiccup and thirst from Stomach heat.$t$,
  $t$Not for cough from cold. Decoct in a cloth bag: the hairs irritate the throat. Honey-fried for cough; ginger-processed for vomiting.$t$,
  6, 12, 'Decoct in a bag.');

perform public.catalogue_upsert_herb('Sang Bai Pi','桑白皮','Morus alba (Cortex radicis)','Cortex Mori','Mulberry root bark',
  'relieve_cough_wheezing','cold','{sweet}','{lung}',
  $t$Drains Lung heat and calms wheezing. Promotes urination and reduces edema.$t$,
  $t$Cough and wheezing with yellow sputum from Lung heat. Edema of the face and upper body with fullness and scanty urine. Hypertension.$t$,
  $t$Not for cough from cold or Lung deficiency.$t$,
  6, 12, 'Honey-fried for cough; raw for edema.');

perform public.catalogue_upsert_herb('Ting Li Zi','葶苈子','Descurainia sophia or Lepidium apetalum (Semen)','Semen Descurainiae seu Lepidii','Descurainia seed',
  'relieve_cough_wheezing','very_cold','{acrid,bitter}','{lung,bladder}',
  $t$Drains the Lung and calms wheezing. Promotes urination and reduces edema.$t$,
  $t$Wheezing and cough with copious phlegm, chest fullness and inability to lie flat; pleural effusion; edema with congestive heart failure.$t$,
  $t$Strong: not for wheezing from Lung deficiency or Spleen deficiency edema. Decoct in a cloth bag. Often paired with Da Zao to protect the Stomach.$t$,
  3, 9, 'Decoct in a bag.');

perform public.catalogue_upsert_herb('Bai Guo','白果','Ginkgo biloba (Semen)','Semen Ginkgo','Ginkgo nut',
  'relieve_cough_wheezing','neutral','{sweet,bitter,astringent}','{lung,kidney}',
  $t$Astringes the Lung and calms wheezing. Stops leukorrhea and reduces urinary frequency.$t$,
  $t$Chronic wheezing and cough with copious sputum. Leukorrhea, cloudy urine, frequent urination, enuresis.$t$,
  $t$Slightly toxic: always cooked, never raw; keep within range, especially in children, where overdose causes convulsions.$t$,
  3, 9, 'Cooked only; 5 to 10 nuts.');

perform public.catalogue_upsert_herb('Luo Han Guo','罗汉果','Siraitia grosvenorii (Fructus)','Fructus Siraitiae','Monk fruit',
  'relieve_cough_wheezing','cool','{sweet}','{lung,large_intestine}',
  $t$Clears Lung heat and moistens dryness. Benefits the throat and stops cough. Moistens the intestines.$t$,
  $t$Dry cough, sore throat and hoarseness from Lung heat; cough with sticky sputum. Constipation from dryness. A safe sweetener for diabetics.$t$,
  $t$Not for cough from cold. Often steeped as a tea.$t$,
  9, 15, 'Half to one fruit, steeped.');

end
$seed$;
