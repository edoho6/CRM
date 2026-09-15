-- ============================================================================
-- Materia medica · 06 · Warm the interior; tonify qi, blood, yang and yin
-- ============================================================================
-- See 01 for conventions. Zi He Che (human placenta) and Hai Ma (seahorse)
-- are deliberately absent for ethical and regulatory reasons.
-- ============================================================================

do $seed$
begin

-- ---------------------------------------------------------------------------
-- Warm the interior
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Fu Zi','附子','Aconitum carmichaelii (Radix lateralis praeparata)','Radix Aconiti Lateralis Praeparata','Prepared aconite',
  'warm_interior','hot','{acrid,sweet}','{heart,kidney,spleen}',
  $t$Restores devastated yang. Warms Kidney and Spleen yang. Disperses cold and alleviates pain.$t$,
  $t$Yang collapse with cold limbs, profuse sweating and a faint pulse. Kidney yang deficiency with cold, impotence, edema, daybreak diarrhea. Spleen yang deficiency with cold pain. Cold bi with severe pain.$t$,
  $t$Toxic: only processed forms (Zhi Fu Zi, Hei Fu Pian), decocted first for 30 to 60 minutes until no numbing taste remains. Contraindicated in pregnancy and in yin deficiency with heat. Incompatible with Ban Xia, Gua Lou, Bei Mu, Bai Lian and Bai Ji. Regulated in many countries.$t$,
  3, 15, 'Decoct first, 30 to 60 minutes. Processed only.');

perform public.catalogue_upsert_herb('Gan Jiang','干姜','Zingiber officinale (Rhizoma exsiccatum)','Rhizoma Zingiberis','Dried ginger',
  'warm_interior','hot','{acrid}','{spleen,stomach,heart,lung}',
  $t$Warms the middle and expels cold. Restores yang and unblocks the channels. Warms the Lung and transforms thin mucus.$t$,
  $t$Cold in the middle with abdominal pain, vomiting, diarrhea. Yang collapse (with Fu Zi). Cough with thin watery sputum from Lung cold.$t$,
  $t$Not for yin deficiency with heat, or heat-type bleeding. Pregnancy caution. Pao Jiang (blast-fried) is gentler and stops bleeding from cold.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Rou Gui','肉桂','Cinnamomum cassia (Cortex)','Cortex Cinnamomi','Cinnamon bark',
  'warm_interior','hot','{acrid,sweet}','{kidney,spleen,heart,liver}',
  $t$Warms Kidney yang and returns fire to its source. Disperses cold and alleviates pain. Warms the channels and unblocks them. Encourages the generation of qi and blood.$t$,
  $t$Kidney yang deficiency with cold, impotence, frequent urination, wheezing. Floating deficiency fire with flushed face and cold feet. Cold abdominal pain, dysmenorrhea, amenorrhea from cold. Added to tonics in chronic deficiency.$t$,
  $t$Contraindicated in pregnancy. Not for yin deficiency with fire or heat-type bleeding. Add at the end of decoction or take as powder.$t$,
  1, 4.5, 'Add at the end, or powder 1 to 2 g.');

perform public.catalogue_upsert_herb('Wu Zhu Yu','吴茱萸','Evodia rutaecarpa (Fructus)','Fructus Evodiae','Evodia fruit',
  'warm_interior','hot','{acrid,bitter}','{liver,spleen,stomach,kidney}',
  $t$Warms the middle and disperses cold. Alleviates pain. Directs rebellious qi downward. Warms the Spleen and stops diarrhea.$t$,
  $t$Vertex headache with vomiting of clear fluid (jueyin). Cold abdominal pain, hernia, dysmenorrhea. Vomiting and acid regurgitation. Daybreak diarrhea (Si Shen Wan). Topical on the soles for mouth sores and hypertension.$t$,
  $t$Slightly toxic: small doses and short courses. Not for yin deficiency with heat. Pregnancy caution.$t$,
  1.5, 4.5, 'Processed with Gan Cao water to reduce toxicity.');

perform public.catalogue_upsert_herb('Hua Jiao','花椒','Zanthoxylum bungeanum (Pericarpium)','Pericarpium Zanthoxyli','Sichuan pepper',
  'warm_interior','hot','{acrid}','{spleen,stomach,kidney}',
  $t$Warms the middle and alleviates pain. Kills parasites. Stops itching topically.$t$,
  $t$Cold abdominal pain, vomiting, diarrhea. Roundworm abdominal pain. Eczema and vaginal itching (wash).$t$,
  $t$Not for yin deficiency with heat. Pregnancy caution. Also called Chuan Jiao or Shu Jiao.$t$,
  3, 6, null);

perform public.catalogue_upsert_herb('Ding Xiang','丁香','Syzygium aromaticum (Flos)','Flos Caryophylli','Clove',
  'warm_interior','warm','{acrid}','{spleen,stomach,kidney}',
  $t$Warms the middle and directs rebellious qi downward. Warms Kidney yang.$t$,
  $t$Hiccup, vomiting and poor appetite from Stomach cold. Impotence and cold in the lower back from Kidney yang deficiency.$t$,
  $t$Not for heat patterns. Traditionally not combined with Yu Jin.$t$,
  1, 3, null);

perform public.catalogue_upsert_herb('Gao Liang Jiang','高良姜','Alpinia officinarum (Rhizoma)','Rhizoma Alpiniae Officinarum','Galangal',
  'warm_interior','hot','{acrid}','{spleen,stomach}',
  $t$Warms the middle and disperses cold. Alleviates pain and stops vomiting.$t$,
  $t$Epigastric and abdominal pain, vomiting and belching from Stomach cold (Liang Fu Wan).$t$,
  $t$Not for Stomach heat or yin deficiency.$t$,
  3, 6, null);

perform public.catalogue_upsert_herb('Xiao Hui Xiang','小茴香','Foeniculum vulgare (Fructus)','Fructus Foeniculi','Fennel fruit',
  'warm_interior','warm','{acrid}','{liver,kidney,spleen,stomach}',
  $t$Disperses cold and alleviates pain. Regulates qi and harmonizes the Stomach.$t$,
  $t$Hernia pain, lower abdominal cold pain, testicular pain, dysmenorrhea from cold. Epigastric distention, poor appetite, vomiting from Stomach cold.$t$,
  $t$Not for yin deficiency with heat.$t$,
  3, 6, 'Salt-fried to enter the Kidney.');

perform public.catalogue_upsert_herb('Bi Ba','荜茇','Piper longum (Fructus)','Fructus Piperis Longi','Long pepper',
  'warm_interior','hot','{acrid}','{stomach,large_intestine}',
  $t$Warms the middle and disperses cold. Alleviates pain. Stops vomiting and diarrhea.$t$,
  $t$Epigastric and abdominal cold pain, vomiting, diarrhea. Toothache from cold (topical).$t$,
  $t$Not for heat patterns or yin deficiency.$t$,
  1.5, 3, null);

perform public.catalogue_upsert_herb('Hu Jiao','胡椒','Piper nigrum (Fructus)','Fructus Piperis','Black pepper',
  'warm_interior','hot','{acrid}','{stomach,large_intestine}',
  $t$Warms the middle and disperses cold. Alleviates pain. Directs qi downward.$t$,
  $t$Epigastric cold pain, vomiting and diarrhea from Stomach cold. Also a kitchen spice; small medicinal doses.$t$,
  $t$Not for heat patterns, yin deficiency or hemorrhoids with heat.$t$,
  1, 3, 'Powder 0.5 to 1 g.');

-- ---------------------------------------------------------------------------
-- Tonify qi
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Ren Shen','人参','Panax ginseng (Radix)','Radix Ginseng','Ginseng root',
  'tonify_qi','slightly_warm','{sweet,bitter}','{spleen,lung,heart}',
  $t$Strongly tonifies source qi and rescues collapse. Tonifies Spleen and Lung qi. Generates fluids. Calms the spirit and benefits the intellect.$t$,
  $t$Collapse with weak pulse, shortness of breath, cold limbs (Du Shen Tang). Spleen qi deficiency with fatigue and poor appetite. Lung qi deficiency with wheezing. Wasting-thirst. Palpitations, insomnia, forgetfulness.$t$,
  $t$Not for excess heat, damp-heat, or Liver yang rising. Incompatible with Li Lu; traditionally not with Wu Ling Zhi; Lai Fu Zi reduces its effect. Avoid tea and radish. Decoct separately.$t$,
  3, 9, 'Decoct separately. Up to 30 g for collapse. Hong Shen (red) is warmer.');

perform public.catalogue_upsert_herb('Xi Yang Shen','西洋参','Panax quinquefolius (Radix)','Radix Panacis Quinquefolii','American ginseng',
  'tonify_qi','cool','{sweet,bitter}','{heart,lung,kidney}',
  $t$Tonifies qi and nourishes yin. Clears heat and generates fluids.$t$,
  $t$Qi and yin deficiency with fatigue, thirst and irritability, especially after febrile disease or in hot weather. Chronic cough with blood from Lung yin deficiency. Wasting-thirst.$t$,
  $t$Not for cold-damp in the middle or yang deficiency. Incompatible with Li Lu. Decoct separately.$t$,
  3, 6, 'Decoct separately.');

perform public.catalogue_upsert_herb('Dang Shen','党参','Codonopsis pilosula (Radix)','Radix Codonopsis','Codonopsis root',
  'tonify_qi','neutral','{sweet}','{spleen,lung}',
  $t$Tonifies Spleen and Lung qi. Nourishes blood and generates fluids.$t$,
  $t$Spleen qi deficiency with fatigue, poor appetite, loose stools. Lung qi deficiency with cough and shortness of breath. Qi and blood deficiency with pale face. The everyday substitute for Ren Shen.$t$,
  $t$Not for excess heat. Incompatible with Li Lu.$t$,
  9, 30, null);

perform public.catalogue_upsert_herb('Tai Zi Shen','太子参','Pseudostellaria heterophylla (Radix)','Radix Pseudostellariae','Prince ginseng',
  'tonify_qi','neutral','{sweet,bitter}','{spleen,lung}',
  $t$Tonifies qi and strengthens the Spleen. Generates fluids and moistens the Lung.$t$,
  $t$Mild Spleen and Lung qi deficiency with fatigue, poor appetite, dry cough, spontaneous sweating; convalescence; children.$t$,
  $t$Gentle; the mildest of the ginseng-like herbs.$t$,
  9, 30, null);

perform public.catalogue_upsert_herb('Huang Qi','黄芪','Astragalus membranaceus (Radix)','Radix Astragali','Astragalus root',
  'tonify_qi','slightly_warm','{sweet}','{lung,spleen}',
  $t$Tonifies qi and raises yang. Strengthens the defensive qi and consolidates the exterior. Promotes urination and reduces edema. Generates flesh and expels pus. Generates fluids and nourishes blood.$t$,
  $t$Spleen and Lung qi deficiency with fatigue, poor appetite, loose stools. Prolapse, chronic diarrhea, uterine bleeding from sinking qi. Spontaneous sweating and frequent colds. Edema from qi deficiency. Chronic ulcers that fail to heal. Wasting-thirst, numbness, hemiplegia (Bu Yang Huan Wu Tang).$t$,
  $t$Not for excess patterns, exterior excess, qi stagnation, damp obstruction, or yin deficiency with heat.$t$,
  9, 30, 'Up to 60 g in Bu Yang Huan Wu Tang. Honey-fried to tonify the middle.');

perform public.catalogue_upsert_herb('Bai Zhu','白术','Atractylodes macrocephala (Rhizoma)','Rhizoma Atractylodis Macrocephalae','White atractylodes',
  'tonify_qi','warm','{bitter,sweet}','{spleen,stomach}',
  $t$Tonifies qi and strengthens the Spleen. Dries dampness and promotes urination. Stops sweating. Calms the fetus.$t$,
  $t$Spleen qi deficiency with poor appetite, loose stools, fatigue. Edema, phlegm-damp dizziness. Spontaneous sweating from qi deficiency. Restless fetus from Spleen deficiency. Constipation from Spleen deficiency (large raw doses).$t$,
  $t$Not for yin deficiency with dryness, or qi stagnation with fullness.$t$,
  6, 15, 'Dry-fried to strengthen the Spleen; raw for dampness and constipation.');

perform public.catalogue_upsert_herb('Shan Yao','山药','Dioscorea opposita (Rhizoma)','Rhizoma Dioscoreae','Chinese yam',
  'tonify_qi','neutral','{sweet}','{spleen,lung,kidney}',
  $t$Tonifies Spleen qi and nourishes Stomach yin. Tonifies Lung qi and yin. Tonifies the Kidney and secures essence.$t$,
  $t$Spleen deficiency with poor appetite, diarrhea, fatigue. Chronic cough and wheezing from Lung deficiency. Spermatorrhea, frequent urination, leukorrhea from Kidney deficiency. Wasting-thirst.$t$,
  $t$Not for excess dampness or accumulation.$t$,
  15, 30, 'Up to 60 g. Dry-fried to stop diarrhea.');

perform public.catalogue_upsert_herb('Gan Cao','甘草','Glycyrrhiza uralensis (Radix et Rhizoma)','Radix et Rhizoma Glycyrrhizae','Licorice root',
  'tonify_qi','neutral','{sweet}','{heart,lung,spleen,stomach}',
  $t$Tonifies Spleen qi. Moistens the Lung and stops cough. Clears heat and resolves toxicity (raw). Moderates spasms and alleviates pain. Harmonizes the other herbs in a formula.$t$,
  $t$Spleen qi deficiency with fatigue and loose stools. Cough of any type. Sores, sore throat, drug and food poisoning (raw). Abdominal or muscle spasms and pain (Shao Yao Gan Cao Tang). Palpitations with irregular pulse (honey-fried, in Zhi Gan Cao Tang).$t$,
  $t$Not for damp fullness, edema or nausea. Long-term or high-dose use raises blood pressure and lowers potassium (glycyrrhizin). Incompatible with Gan Sui, Da Ji, Yuan Hua and Hai Zao.$t$,
  2, 9, 'Honey-fried (Zhi Gan Cao) to tonify and warm; raw to clear heat.');

perform public.catalogue_upsert_herb('Da Zao','大枣','Ziziphus jujuba (Fructus)','Fructus Jujubae','Jujube date',
  'tonify_qi','warm','{sweet}','{spleen,stomach}',
  $t$Tonifies the Spleen and qi. Nourishes the blood and calms the spirit. Moderates the harshness of other herbs.$t$,
  $t$Spleen qi deficiency with fatigue and poor appetite. Restless organ disorder with emotional lability (Gan Mai Da Zao Tang). Paired with Sheng Jiang to harmonize ying and wei, and with harsh herbs to protect the Stomach.$t$,
  $t$Not for damp fullness, food stagnation, phlegm or parasites. Split before decocting.$t$,
  9, 30, 'Usually 3 to 12 dates.');

perform public.catalogue_upsert_herb('Huang Jing','黄精','Polygonatum sibiricum (Rhizoma)','Rhizoma Polygonati','Siberian Solomon''s seal',
  'tonify_qi','neutral','{sweet}','{spleen,lung,kidney}',
  $t$Tonifies qi and nourishes yin. Moistens the Lung. Strengthens the Spleen. Tonifies the Kidney and essence.$t$,
  $t$Dry cough from Lung yin deficiency. Fatigue, poor appetite, dry mouth from Spleen qi and yin deficiency. Weak lower back, dizziness, premature greying from Kidney essence deficiency. Wasting-thirst.$t$,
  $t$Not for Spleen deficiency with dampness, phlegm, or loose stools. Cloying. Use the steamed, processed form.$t$,
  9, 15, 'Steamed (Zhi Huang Jing).');

perform public.catalogue_upsert_herb('Yi Tang','饴糖','Maltose (from grain)','Saccharum Granorum','Maltose, barley sugar',
  'tonify_qi','warm','{sweet}','{spleen,stomach,lung}',
  $t$Tonifies the middle and moderates spasmodic pain. Moistens the Lung and stops cough.$t$,
  $t$Abdominal pain relieved by warmth and pressure from Spleen deficiency with cold (Xiao Jian Zhong Tang). Dry cough from Lung deficiency.$t$,
  $t$Not for damp fullness, food stagnation, vomiting or diabetes. Dissolve in the strained decoction.$t$,
  30, 60, 'Dissolve in the finished decoction.');

perform public.catalogue_upsert_herb('Feng Mi','蜂蜜','Apis mellifera (Mel)','Mel','Honey',
  'tonify_qi','neutral','{sweet}','{lung,spleen,large_intestine}',
  $t$Tonifies the middle and moderates spasms. Moistens the Lung and stops cough. Moistens the intestines. Resolves toxicity, including that of Wu Tou.$t$,
  $t$Dry cough, constipation from dryness, epigastric pain from deficiency. Used to process herbs (honey-frying) and to bind pills.$t$,
  $t$Never for infants under one year. Not for damp fullness, loose stools or diabetes.$t$,
  15, 30, 'Dissolve in the finished decoction.');

perform public.catalogue_upsert_herb('Ci Wu Jia','刺五加','Eleutherococcus senticosus (Radix et Rhizoma)','Radix et Rhizoma Acanthopanacis Senticosi','Siberian ginseng, eleuthero',
  'tonify_qi','warm','{acrid,bitter}','{spleen,kidney,heart}',
  $t$Tonifies qi and strengthens the Spleen and Kidney. Calms the spirit. Invigorates the blood and unblocks the channels.$t$,
  $t$Fatigue, poor appetite, weak lower back and knees. Insomnia and forgetfulness. Bi pain. Widely used as an adaptogen for stress and endurance.$t$,
  $t$Not for yin deficiency with heat. Not to be confused with Wu Jia Pi (a different plant).$t$,
  9, 27, null);

perform public.catalogue_upsert_herb('Hong Jing Tian','红景天','Rhodiola crenulata (Radix et Rhizoma)','Radix et Rhizoma Rhodiolae','Rhodiola',
  'tonify_qi','cold','{sweet,bitter}','{lung,heart}',
  $t$Tonifies qi and clears the Lung. Invigorates the blood and unblocks the channels. Calms the spirit.$t$,
  $t$Fatigue, shortness of breath, altitude sickness. Chest pain from qi deficiency with stasis. Cough with blood from Lung heat. Low mood and poor concentration.$t$,
  $t$Not for excess heat without deficiency. Pregnancy caution.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Jiao Gu Lan','绞股蓝','Gynostemma pentaphyllum (Herba)','Herba Gynostemmatis','Gynostemma, jiaogulan',
  'tonify_qi','cold','{sweet,bitter}','{lung,spleen,kidney}',
  $t$Tonifies qi and strengthens the Spleen. Clears heat and resolves toxicity. Transforms phlegm and stops cough. Lowers blood lipids.$t$,
  $t$Fatigue with heat signs. Cough with yellow sputum. Hyperlipidemia, fatty liver. Often taken as tea.$t$,
  $t$Not for Spleen and Stomach deficiency cold. Occasional nausea in large doses.$t$,
  10, 20, null);

-- ---------------------------------------------------------------------------
-- Tonify blood
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Dang Gui','当归','Angelica sinensis (Radix)','Radix Angelicae Sinensis','Chinese angelica root',
  'tonify_blood','warm','{sweet,acrid}','{liver,heart,spleen}',
  $t$Tonifies and invigorates the blood. Regulates menstruation and alleviates pain. Moistens the intestines. Reduces swelling and generates flesh.$t$,
  $t$Blood deficiency with pale face, dizziness, palpitations. Irregular menses, dysmenorrhea, amenorrhea, postpartum pain (principal gynecological herb). Bi pain, trauma, abscesses. Constipation from blood deficiency.$t$,
  $t$Not for diarrhea or damp fullness, or heavy menstrual bleeding. Dang Gui Shen (body) tonifies; Dang Gui Wei (tail) invigorates; Quan Dang Gui (whole) does both.$t$,
  6, 12, 'Wine-fried to invigorate.');

perform public.catalogue_upsert_herb('Shu Di Huang','熟地黄','Rehmannia glutinosa (Radix praeparata)','Radix Rehmanniae Praeparata','Prepared rehmannia root',
  'tonify_blood','slightly_warm','{sweet}','{liver,kidney}',
  $t$Tonifies the blood. Nourishes yin and replenishes essence. Fills the marrow.$t$,
  $t$Blood deficiency with pale face, dizziness, palpitations, irregular menses, uterine bleeding. Kidney yin deficiency with night sweats, tinnitus, weak lower back. Essence deficiency with premature greying, developmental delay. Wasting-thirst.$t$,
  $t$Not for Spleen deficiency with dampness, loose stools or qi stagnation: heavy and cloying. Combine with Sha Ren or Chen Pi to aid digestion.$t$,
  9, 30, null);

perform public.catalogue_upsert_herb('Bai Shao','白芍','Paeonia lactiflora (Radix, prepared)','Radix Paeoniae Alba','White peony root',
  'tonify_blood','cool','{bitter,sour}','{liver,spleen}',
  $t$Nourishes the blood and regulates menstruation. Preserves yin and stops sweating. Softens the Liver and alleviates pain. Calms Liver yang.$t$,
  $t$Blood deficiency with pale face and irregular menses. Spontaneous or night sweating from disharmony of ying and wei. Abdominal, flank or limb spasms and pain (Shao Yao Gan Cao Tang). Headache and dizziness from Liver yang rising.$t$,
  $t$Not for cold from yang deficiency, or diarrhea from cold. Incompatible with Li Lu.$t$,
  6, 15, 'Up to 30 g for spasm. Dry-fried to soften its coolness.');

perform public.catalogue_upsert_herb('He Shou Wu','何首乌','Polygonum multiflorum (Radix, prepared)','Radix Polygoni Multiflori Praeparata','Fleeceflower root',
  'tonify_blood','slightly_warm','{bitter,sweet,astringent}','{liver,kidney}',
  $t$Prepared: tonifies the Liver and Kidney, nourishes blood and essence, blackens the hair. Raw: moistens the intestines, resolves toxicity, dissipates nodules, treats malaria.$t$,
  $t$Blood and essence deficiency with dizziness, premature greying, weak lower back, infertility. Hyperlipidemia. Raw for constipation, scrofula and sores.$t$,
  $t$Hepatotoxicity has been reported, mostly with raw or unprocessed root and prolonged use: use the prepared form (Zhi He Shou Wu), keep courses moderate, and stop if jaundice or fatigue appear. Not for Spleen deficiency with loose stools.$t$,
  9, 30, 'Prepared (Zhi He Shou Wu) for tonifying.');

perform public.catalogue_upsert_herb('E Jiao','阿胶','Equus asinus (Colla corii)','Colla Corii Asini','Donkey-hide gelatin',
  'tonify_blood','neutral','{sweet}','{lung,liver,kidney}',
  $t$Nourishes the blood. Stops bleeding. Nourishes yin and moistens the Lung.$t$,
  $t$Blood deficiency with pale face, dizziness, palpitations. Bleeding of any type with deficiency: uterine bleeding, hemoptysis, blood in stool. Dry cough with blood from Lung yin deficiency. Irritability and insomnia from yin deficiency (Huang Lian E Jiao Tang).$t$,
  $t$Animal product; cloying. Not for Spleen deficiency with poor digestion or loose stools. Melt separately in the strained decoction.$t$,
  3, 9, 'Melt into the finished decoction.');

perform public.catalogue_upsert_herb('Long Yan Rou','龙眼肉','Dimocarpus longan (Arillus)','Arillus Longan','Longan fruit',
  'tonify_blood','warm','{sweet}','{heart,spleen}',
  $t$Tonifies the Heart and Spleen. Nourishes the blood and calms the spirit.$t$,
  $t$Palpitations, insomnia, forgetfulness and fatigue from Heart and Spleen deficiency (Gui Pi Tang).$t$,
  $t$Not for damp fullness, phlegm or fire.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Gou Qi Zi','枸杞子','Lycium barbarum (Fructus)','Fructus Lycii','Goji berry',
  'tonify_blood','neutral','{sweet}','{liver,kidney,lung}',
  $t$Nourishes the Liver and Kidney. Nourishes blood and essence. Brightens the eyes. Moistens the Lung.$t$,
  $t$Dizziness, blurred vision, weak lower back, tinnitus, premature greying from Liver and Kidney deficiency. Wasting-thirst. Dry cough.$t$,
  $t$Not for Spleen deficiency with dampness or loose stools, or excess heat.$t$,
  6, 12, null);

perform public.catalogue_upsert_herb('Sang Shen','桑椹','Morus alba (Fructus)','Fructus Mori','Mulberry fruit',
  'tonify_blood','cold','{sweet}','{heart,liver,kidney}',
  $t$Nourishes yin and blood. Generates fluids. Moistens the intestines.$t$,
  $t$Dizziness, tinnitus, insomnia, premature greying from blood and yin deficiency. Thirst and wasting-thirst. Constipation from dryness.$t$,
  $t$Not for Spleen deficiency with loose stools.$t$,
  9, 15, null);

-- ---------------------------------------------------------------------------
-- Tonify yang
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Lu Rong','鹿茸','Cervus nippon or C. elaphus (Cornu pantotrichum)','Cornu Cervi Pantotrichum','Deer velvet antler',
  'tonify_yang','warm','{sweet,salty}','{liver,kidney}',
  $t$Tonifies Kidney yang. Replenishes essence and blood. Strengthens the sinews and bones. Regulates the Chong and Ren. Promotes the healing of sores.$t$,
  $t$Kidney yang deficiency with impotence, infertility, cold limbs, weak lower back. Developmental delay in children. Uterine bleeding and leukorrhea from cold deficiency. Chronic non-healing ulcers.$t$,
  $t$Not for yin deficiency with heat, excess heat, or phlegm-heat. Start with a small dose and increase. Animal product; expensive and regulated in some regions.$t$,
  1, 2, 'Powder 1 to 2 g, or in pills. Lu Jiao Shuang (degelatinized antler) is a gentler substitute.');

perform public.catalogue_upsert_herb('Lu Jiao Jiao','鹿角胶','Cervus (Colla cornus)','Colla Cornus Cervi','Deer antler gelatin',
  'tonify_yang','warm','{sweet,salty}','{liver,kidney}',
  $t$Tonifies Kidney yang and essence. Nourishes the blood and stops bleeding.$t$,
  $t$Kidney yang and essence deficiency with weak back, impotence, infertility. Uterine bleeding, blood in urine from deficiency cold. Yin-type sores.$t$,
  $t$Not for yin deficiency with heat. Animal product; melt separately.$t$,
  3, 9, 'Melt into the finished decoction.');

perform public.catalogue_upsert_herb('Rou Cong Rong','肉苁蓉','Cistanche deserticola (Herba)','Herba Cistanches','Cistanche',
  'tonify_yang','warm','{sweet,salty}','{kidney,large_intestine}',
  $t$Tonifies Kidney yang and replenishes essence and blood. Moistens the intestines and unblocks the bowels.$t$,
  $t$Impotence, infertility, weak lower back and knees from Kidney yang deficiency. Constipation in the elderly and postpartum from deficiency. Gentle and moist.$t$,
  $t$Not for yin deficiency with fire, or diarrhea from Spleen deficiency.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Ba Ji Tian','巴戟天','Morinda officinalis (Radix)','Radix Morindae Officinalis','Morinda root',
  'tonify_yang','warm','{acrid,sweet}','{kidney,liver}',
  $t$Tonifies Kidney yang. Strengthens the sinews and bones. Dispels wind-dampness.$t$,
  $t$Impotence, infertility, frequent urination, irregular menses from Kidney yang deficiency. Weak, painful lower back and knees; wind-damp bi with cold.$t$,
  $t$Not for yin deficiency with fire or damp-heat.$t$,
  6, 15, 'Salt-fried to enter the Kidney.');

perform public.catalogue_upsert_herb('Yin Yang Huo','淫羊藿','Epimedium brevicornu (Folium)','Herba Epimedii','Epimedium, horny goat weed',
  'tonify_yang','warm','{acrid,sweet}','{liver,kidney}',
  $t$Tonifies Kidney yang. Dispels wind-dampness and unblocks the channels.$t$,
  $t$Impotence, infertility, frequent urination, weak lower back from Kidney yang deficiency. Wind-damp bi with numbness and cold. Menopausal hypertension (Er Xian Tang).$t$,
  $t$Not for yin deficiency with fire. Long-term use can injure yin.$t$,
  6, 15, 'Processed with sheep fat to strengthen its warming.');

perform public.catalogue_upsert_herb('Xian Mao','仙茅','Curculigo orchioides (Rhizoma)','Rhizoma Curculiginis','Curculigo rhizome',
  'tonify_yang','hot','{acrid}','{kidney,liver}',
  $t$Tonifies Kidney yang and strengthens the sinews and bones. Expels cold-dampness.$t$,
  $t$Impotence, cold lower back and knees, cold-damp bi. Menopausal hypertension (Er Xian Tang).$t$,
  $t$Slightly toxic: not for long courses. Not for yin deficiency with fire.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Du Zhong','杜仲','Eucommia ulmoides (Cortex)','Cortex Eucommiae','Eucommia bark',
  'tonify_yang','warm','{sweet}','{liver,kidney}',
  $t$Tonifies the Liver and Kidney. Strengthens the sinews and bones. Calms the fetus. Lowers blood pressure.$t$,
  $t$Weak, sore lower back and knees, fatigue, frequent urination from Kidney deficiency. Threatened miscarriage, restless fetus. Hypertension with Kidney deficiency.$t$,
  $t$Not for yin deficiency with fire.$t$,
  9, 15, 'Salt-fried; the bark should snap with silky threads.');

perform public.catalogue_upsert_herb('Xu Duan','续断','Dipsacus asper (Radix)','Radix Dipsaci','Teasel root',
  'tonify_yang','slightly_warm','{bitter,sweet,acrid}','{liver,kidney}',
  $t$Tonifies the Liver and Kidney and strengthens the sinews and bones. Promotes the healing of fractures. Stops uterine bleeding and calms the fetus. Invigorates the blood.$t$,
  $t$Weak, sore lower back and knees. Fractures, trauma. Uterine bleeding, threatened miscarriage from Kidney deficiency. Bi pain.$t$,
  $t$Not for yin deficiency with fire.$t$,
  9, 15, 'Wine-fried for trauma; salt-fried for the Kidney.');

perform public.catalogue_upsert_herb('Gu Sui Bu','骨碎补','Drynaria fortunei (Rhizoma)','Rhizoma Drynariae','Drynaria rhizome',
  'tonify_yang','warm','{bitter}','{kidney,liver}',
  $t$Tonifies the Kidney and strengthens the bones. Invigorates the blood and promotes the healing of fractures. Stops bleeding from trauma.$t$,
  $t$Fractures, trauma, sprains. Weak lower back, tinnitus, loose teeth and toothache from Kidney deficiency. Alopecia and vitiligo (topical tincture).$t$,
  $t$Not for yin deficiency with fire or blood deficiency without stasis.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Bu Gu Zhi','补骨脂','Psoralea corylifolia (Fructus)','Fructus Psoraleae','Psoralea fruit',
  'tonify_yang','warm','{acrid,bitter}','{kidney,spleen}',
  $t$Tonifies Kidney yang and secures essence. Warms the Spleen and stops diarrhea. Helps the Kidney grasp qi. Topically treats vitiligo.$t$,
  $t$Impotence, spermatorrhea, enuresis, frequent urination from Kidney yang deficiency. Daybreak diarrhea (Si Shen Wan). Wheezing from Kidney deficiency. Vitiligo, alopecia (topical).$t$,
  $t$Not for yin deficiency with fire or constipation. Hepatotoxicity has been reported with prolonged use; keep courses moderate. Photosensitizing topically.$t$,
  6, 9, 'Salt-fried.');

perform public.catalogue_upsert_herb('Yi Zhi Ren','益智仁','Alpinia oxyphylla (Fructus)','Fructus Alpiniae Oxyphyllae','Bitter cardamom',
  'tonify_yang','warm','{acrid}','{spleen,kidney}',
  $t$Warms the Kidney and secures essence. Reduces urination. Warms the Spleen and stops diarrhea and drooling.$t$,
  $t$Enuresis, frequent or dribbling urination, spermatorrhea from Kidney cold. Diarrhea, cold abdominal pain and excessive saliva from Spleen cold.$t$,
  $t$Not for yin deficiency with fire, or urinary problems from damp-heat.$t$,
  3, 9, 'Salt-fried.');

perform public.catalogue_upsert_herb('Tu Si Zi','菟丝子','Cuscuta chinensis (Semen)','Semen Cuscutae','Dodder seed',
  'tonify_yang','neutral','{sweet,acrid}','{liver,kidney,spleen}',
  $t$Tonifies Kidney yang and yin in balance. Secures essence and reduces urination. Brightens the eyes. Calms the fetus. Stops diarrhea from Spleen and Kidney deficiency.$t$,
  $t$Impotence, spermatorrhea, frequent urination, infertility, weak lower back. Blurred vision from Liver and Kidney deficiency. Threatened miscarriage. Chronic diarrhea.$t$,
  $t$Not for yin deficiency with fire, or constipation. Gentle.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Sha Yuan Zi','沙苑子','Astragalus complanatus (Semen)','Semen Astragali Complanati','Flatstem milkvetch seed',
  'tonify_yang','warm','{sweet}','{liver,kidney}',
  $t$Tonifies the Kidney and secures essence. Nourishes the Liver and brightens the eyes.$t$,
  $t$Impotence, spermatorrhea, frequent urination, leukorrhea, weak lower back from Kidney deficiency. Blurred vision and dizziness.$t$,
  $t$Not for yin deficiency with fire.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Suo Yang','锁阳','Cynomorium songaricum (Herba)','Herba Cynomorii','Cynomorium',
  'tonify_yang','warm','{sweet}','{liver,kidney,large_intestine}',
  $t$Tonifies Kidney yang, essence and blood. Strengthens the sinews and bones. Moistens the intestines.$t$,
  $t$Impotence, infertility, weak lower back and knees, atrophy of the legs from Kidney deficiency. Constipation from deficiency in the elderly.$t$,
  $t$Not for yin deficiency with fire, or diarrhea.$t$,
  6, 15, null);

perform public.catalogue_upsert_herb('Ge Jie','蛤蚧','Gekko gecko (whole body)','Gecko','Tokay gecko',
  'tonify_yang','neutral','{salty}','{lung,kidney}',
  $t$Tonifies the Lung and Kidney and helps the Kidney grasp qi. Replenishes essence and blood.$t$,
  $t$Chronic cough and wheezing from Lung and Kidney deficiency, with blood-streaked sputum. Impotence from Kidney deficiency.$t$,
  $t$Not for exterior patterns or phlegm-heat wheezing. Animal product; usually as powder or in wine, in pairs.$t$,
  3, 6, 'Powder 1 to 1.5 g.');

perform public.catalogue_upsert_herb('Dong Chong Xia Cao','冬虫夏草','Ophiocordyceps sinensis (fungus on larva)','Cordyceps','Cordyceps',
  'tonify_yang','warm','{sweet}','{lung,kidney}',
  $t$Tonifies Kidney yang and Lung yin. Stops bleeding and transforms phlegm. Restores the constitution after illness.$t$,
  $t$Chronic cough and wheezing with blood from Lung and Kidney deficiency; tuberculosis. Impotence, weak lower back. Fatigue and spontaneous sweating after illness.$t$,
  $t$Not for exterior patterns. Wild material is very expensive; cultivated mycelium (Cs-4) is the usual substitute.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Hu Tao Ren','胡桃仁','Juglans regia (Semen)','Semen Juglandis','Walnut',
  'tonify_yang','warm','{sweet}','{kidney,lung,large_intestine}',
  $t$Tonifies the Kidney and strengthens the back. Warms the Lung and calms wheezing. Moistens the intestines.$t$,
  $t$Weak lower back, frequent urination from Kidney deficiency. Chronic wheezing from Lung and Kidney cold deficiency. Constipation from dryness in the elderly.$t$,
  $t$Not for phlegm-heat cough, yin deficiency with fire, or loose stools.$t$,
  9, 30, null);

perform public.catalogue_upsert_herb('Jiu Cai Zi','韭菜子','Allium tuberosum (Semen)','Semen Allii Tuberosi','Chinese chive seed',
  'tonify_yang','warm','{acrid,sweet}','{liver,kidney}',
  $t$Tonifies Kidney yang and secures essence. Warms the Liver.$t$,
  $t$Impotence, spermatorrhea, enuresis, frequent urination, cold lower back from Kidney yang deficiency. Leukorrhea from cold.$t$,
  $t$Not for yin deficiency with fire.$t$,
  3, 9, null);

-- ---------------------------------------------------------------------------
-- Tonify yin
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Bei Sha Shen','北沙参','Glehnia littoralis (Radix)','Radix Glehniae','Glehnia root',
  'tonify_yin','slightly_cold','{sweet,bitter}','{lung,stomach}',
  $t$Nourishes Lung and Stomach yin. Clears heat and generates fluids.$t$,
  $t$Dry cough with scant sputum, hoarseness from Lung yin deficiency. Dry mouth, thirst, poor appetite from Stomach yin deficiency after febrile disease.$t$,
  $t$Not for cough from cold or Spleen deficiency with dampness. Incompatible with Li Lu.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Nan Sha Shen','南沙参','Adenophora tetraphylla (Radix)','Radix Adenophorae','Adenophora root',
  'tonify_yin','slightly_cold','{sweet}','{lung,stomach}',
  $t$Nourishes Lung and Stomach yin. Clears Lung heat and transforms phlegm. Tonifies qi mildly.$t$,
  $t$Dry cough with sticky sputum from Lung yin deficiency with heat. Thirst and poor appetite from Stomach yin deficiency. Milder than Bei Sha Shen, with more action on phlegm.$t$,
  $t$Not for cough from cold. Incompatible with Li Lu.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Mai Men Dong','麦门冬','Ophiopogon japonicus (Radix)','Radix Ophiopogonis','Ophiopogon tuber',
  'tonify_yin','slightly_cold','{sweet,bitter}','{lung,stomach,heart}',
  $t$Nourishes Lung and Stomach yin and generates fluids. Clears the Heart and calms the spirit. Moistens the intestines.$t$,
  $t$Dry cough, hoarseness, cough with blood from Lung yin deficiency. Thirst, dry mouth, vomiting from Stomach yin deficiency. Irritability and insomnia from Heart yin deficiency. Constipation from dryness. Wasting-thirst.$t$,
  $t$Not for cough from cold with phlegm, or diarrhea from Spleen deficiency.$t$,
  6, 12, 'Also written Mai Dong.');

perform public.catalogue_upsert_herb('Tian Men Dong','天门冬','Asparagus cochinchinensis (Radix)','Radix Asparagi','Asparagus tuber',
  'tonify_yin','cold','{sweet,bitter}','{lung,kidney}',
  $t$Nourishes Lung and Kidney yin. Clears heat and generates fluids. Moistens the intestines.$t$,
  $t$Dry cough with sticky or bloody sputum from Lung yin deficiency with heat. Steaming bone, night sweats from Kidney yin deficiency. Wasting-thirst. Constipation from dryness.$t$,
  $t$Colder and more cloying than Mai Men Dong. Not for Spleen deficiency with diarrhea, or cough from cold.$t$,
  6, 12, 'Also written Tian Dong.');

perform public.catalogue_upsert_herb('Shi Hu','石斛','Dendrobium nobile (Herba)','Herba Dendrobii','Dendrobium',
  'tonify_yin','slightly_cold','{sweet}','{stomach,kidney}',
  $t$Nourishes Stomach yin and generates fluids. Clears deficiency heat. Nourishes Kidney yin, brightens the eyes and strengthens the back.$t$,
  $t$Dry mouth, thirst, poor appetite and dry retching from Stomach yin deficiency. Low-grade fever after febrile disease. Blurred vision, weak lower back from Kidney yin deficiency.$t$,
  $t$Not for early-stage damp-warmth or Spleen and Stomach cold. Decoct first, 30 minutes.$t$,
  6, 12, 'Decoct first. Fresh: 15 to 30 g.');

perform public.catalogue_upsert_herb('Yu Zhu','玉竹','Polygonatum odoratum (Rhizoma)','Rhizoma Polygonati Odorati','Fragrant Solomon''s seal',
  'tonify_yin','slightly_cold','{sweet}','{lung,stomach}',
  $t$Nourishes Lung and Stomach yin and moistens dryness. Generates fluids. Treats an exterior pattern in a patient with yin deficiency without trapping the pathogen.$t$,
  $t$Dry cough, dry throat, thirst from Lung and Stomach yin deficiency. Wasting-thirst. Wind-heat exterior pattern with underlying yin deficiency (Jia Jian Wei Rui Tang).$t$,
  $t$Not for Spleen deficiency with dampness or phlegm. Gentle and not cloying.$t$,
  6, 12, null);

perform public.catalogue_upsert_herb('Bai He','百合','Lilium brownii (Bulbus)','Bulbus Lilii','Lily bulb',
  'tonify_yin','slightly_cold','{sweet}','{lung,heart}',
  $t$Nourishes Lung yin and stops cough. Clears the Heart and calms the spirit.$t$,
  $t$Chronic dry cough with blood from Lung yin deficiency. Restlessness, insomnia, palpitations and vague distress after febrile disease (Bai He disease, Bai He Di Huang Tang).$t$,
  $t$Not for cough from cold with phlegm, or Spleen deficiency with loose stools.$t$,
  6, 12, 'Honey-fried to moisten the Lung.');

perform public.catalogue_upsert_herb('Mo Han Lian','墨旱莲','Eclipta prostrata (Herba)','Herba Ecliptae','Eclipta',
  'tonify_yin','cold','{sweet,sour}','{liver,kidney}',
  $t$Nourishes Liver and Kidney yin. Cools the blood and stops bleeding. Blackens the hair.$t$,
  $t$Dizziness, tinnitus, premature greying, weak lower back from Liver and Kidney yin deficiency. Bleeding from blood heat: hemoptysis, blood in urine or stool, uterine bleeding.$t$,
  $t$Not for Spleen and Kidney deficiency cold with diarrhea. Paired with Nu Zhen Zi as Er Zhi Wan.$t$,
  9, 15, 'Also called Han Lian Cao.');

perform public.catalogue_upsert_herb('Nu Zhen Zi','女贞子','Ligustrum lucidum (Fructus)','Fructus Ligustri Lucidi','Glossy privet fruit',
  'tonify_yin','cool','{sweet,bitter}','{liver,kidney}',
  $t$Nourishes Liver and Kidney yin. Clears deficiency heat. Brightens the eyes and blackens the hair.$t$,
  $t$Dizziness, blurred vision, tinnitus, premature greying, weak lower back from Liver and Kidney yin deficiency. Steaming bone from yin deficiency. Low white cell counts (adjunct).$t$,
  $t$Not for Spleen and Stomach deficiency cold with diarrhea. Gentle; wine-steamed.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Gui Jia','龟甲','Chinemys reevesii (Plastrum)','Plastrum Testudinis','Tortoise plastron',
  'tonify_yin','cold','{sweet,salty}','{liver,kidney,heart}',
  $t$Nourishes yin and anchors yang. Benefits the Kidney and strengthens the bones. Nourishes the blood and tonifies the Heart. Cools the blood and stops bleeding.$t$,
  $t$Steaming bone, night sweats, internal wind from yin deficiency with rising yang. Weak lower back and knees, developmental delay. Palpitations, insomnia, forgetfulness. Uterine bleeding from yin deficiency with heat.$t$,
  $t$Contraindicated in pregnancy. Not for Spleen and Stomach deficiency cold. Animal product, regulated in some regions; decoct first, or use Gui Jia Jiao (gelatin). Formerly Gui Ban.$t$,
  9, 24, 'Decoct first. Gui Jia Jiao 3 to 9 g melted separately.');

perform public.catalogue_upsert_herb('Bie Jia','鳖甲','Trionyx sinensis (Carapax)','Carapax Trionycis','Soft-shelled turtle shell',
  'tonify_yin','cold','{salty}','{liver,kidney}',
  $t$Nourishes yin and anchors yang. Clears deficiency heat. Softens hardness and dissipates nodules.$t$,
  $t$Steaming bone, night sweats, lingering low-grade fever from yin deficiency. Internal wind from yin deficiency. Abdominal masses, enlarged liver or spleen, malarial masses.$t$,
  $t$Contraindicated in pregnancy. Not for Spleen and Stomach deficiency cold. Animal product; decoct first.$t$,
  9, 24, 'Decoct first. Vinegar-processed to dissipate nodules.');

perform public.catalogue_upsert_herb('Hei Zhi Ma','黑芝麻','Sesamum indicum (Semen nigrum)','Semen Sesami Nigrum','Black sesame seed',
  'tonify_yin','neutral','{sweet}','{liver,kidney,large_intestine}',
  $t$Nourishes Liver and Kidney yin and blood. Moistens the intestines. Blackens the hair.$t$,
  $t$Dizziness, blurred vision, premature greying, weak lower back from Liver and Kidney deficiency. Constipation from dryness. Insufficient lactation.$t$,
  $t$Not for Spleen deficiency with loose stools. Dry-fried and crushed.$t$,
  9, 15, null);

perform public.catalogue_upsert_herb('Yin Er','银耳','Tremella fuciformis (fruiting body)','Tremella','Silver ear fungus',
  'tonify_yin','neutral','{sweet,bland}','{lung,stomach}',
  $t$Nourishes yin and moistens the Lung. Nourishes Stomach yin and generates fluids.$t$,
  $t$Dry cough with scant sputum, chronic cough with blood from Lung yin deficiency. Dry mouth and poor appetite from Stomach yin deficiency. Also a food.$t$,
  $t$Not for cough from cold with phlegm.$t$,
  3, 9, 'Soak before cooking.');

end
$seed$;
