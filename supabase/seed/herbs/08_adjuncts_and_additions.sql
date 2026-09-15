-- ============================================================================
-- Materia medica · 08 · Adjuncts, vehicles and additions
-- ============================================================================
-- Two groups:
--   1. Substances the classical formulas call for that are foods, vehicles or
--      minor adjuncts rather than main medicinals (rice, egg yolk, wine, stove
--      earth). They are catalogued so the formula importer links to a real herb
--      instead of creating an unlabelled stub.
--   2. A short list of common medicinals that the first seven files did not
--      cover.
-- ============================================================================

do $seed$
begin

-- ---------------------------------------------------------------------------
-- Foods, vehicles and adjuncts used inside classical formulas
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Jing Mi','粳米','Oryza sativa (Semen)','Semen Oryzae','Non-glutinous rice',
  'tonify_qi','neutral','{sweet}','{spleen,stomach}',
  $t$Tonifies the Stomach and Spleen, generates fluids and protects the Stomach from cold, bitter herbs.$t$,
  $t$Included in Bai Hu Tang, Zhu Ye Shi Gao Tang, Mai Men Dong Tang and Xie Bai San to buffer the harshness of the other ingredients and preserve Stomach fluids.$t$,
  $t$A food. No practical restriction; it is cooked in the decoction until the grains split.$t$,
  9, 30, 'Decocted with the other herbs until the grains open.');

perform public.catalogue_upsert_herb('Ji Zi Huang','鸡子黄','Gallus gallus domesticus (Vitellus)','Vitellus Ovi Galli','Egg yolk',
  'tonify_yin','neutral','{sweet}','{heart,kidney}',
  $t$Nourishes yin and blood, moistens dryness and calms the spirit; reconnects the Heart and Kidney.$t$,
  $t$Insomnia and irritability from yin deficiency with Heart fire (Huang Lian E Jiao Tang). Internal wind from yin exhaustion (Da Ding Feng Zhu).$t$,
  $t$A food. Stirred raw into the strained decoction once it has cooled enough not to cook it. Avoid raw yolk where salmonella risk or immunosuppression is a concern; a pasteurised yolk is a reasonable substitute.$t$,
  1, 2, 'One to two yolks, stirred into the warm strained decoction.');

perform public.catalogue_upsert_herb('Bai Jiu','白酒','Fermented grain wine','Vinum','Clear rice wine',
  'invigorate_blood','warm','{acrid,sweet}','{heart,liver,stomach}',
  $t$Unblocks yang, invigorates the blood, disperses cold and carries other herbs upward and outward.$t$,
  $t$Chest painful obstruction (Gua Lou Xie Bai Bai Jiu Tang). Used as the decoction medium or as a carrier for powders in trauma and stasis formulas.$t$,
  $t$Not in pregnancy, liver disease, alcohol-use disorder, or with disulfiram-like drugs (metronidazole, cefoperazone). Omit or replace with water for anyone avoiding alcohol.$t$,
  15, 60, 'Added to the decoction water, or the powder is taken with warm wine.');

perform public.catalogue_upsert_herb('Li Pi','梨皮','Pyrus (Pericarpium)','Pericarpium Pyri','Pear peel',
  'relieve_cough_wheezing','cool','{sweet,sour}','{lung,stomach}',
  $t$Clears heat, moistens dryness, generates fluids and transforms phlegm.$t$,
  $t$Dry cough from warm dryness (Sang Xing Tang), thirst and dry throat after febrile disease. A whole fresh pear may be used instead of the peel.$t$,
  $t$Not for cough from cold, or in Spleen deficiency with loose stools.$t$,
  3, 9, 'Fresh: one pear, or 15 to 30 g of peel.');

perform public.catalogue_upsert_herb('Lian Xu','莲须','Nelumbo nucifera (Stamen)','Stamen Nelumbinis','Lotus stamen',
  'stabilize_bind','neutral','{sweet,astringent}','{heart,kidney}',
  $t$Secures essence, stops leakage and clears Heart fire.$t$,
  $t$Spermatorrhea, nocturnal emission, premature ejaculation, leukorrhea, uterine bleeding from Kidney deficiency (Jin Suo Gu Jing Wan).$t$,
  $t$Not for difficult urination or constipation.$t$,
  3, 9, null);

perform public.catalogue_upsert_herb('Wu Bei Zi','五倍子','Rhus chinensis (Galla)','Galla Chinensis','Chinese gallnut',
  'stabilize_bind','cold','{sour,astringent}','{lung,large_intestine,kidney}',
  $t$Astringes the Lung and stops cough. Astringes the intestines and stops diarrhea. Stops sweating and bleeding. Topically resolves toxicity and generates flesh.$t$,
  $t$Chronic cough from Lung deficiency, chronic diarrhea and dysentery, spermatorrhea, night sweats, uterine bleeding (Gu Chong Tang). Topically: hemorrhoids, prolapse, ulcers, weeping sores.$t$,
  $t$Not for exterior patterns, damp-heat dysentery or the early stage of cough. Very high in tannin: separate from other medication and from iron by two hours. Usually taken as powder.$t$,
  1.5, 6, 'Powder 1 to 1.5 g; topically as needed.');

perform public.catalogue_upsert_herb('Zao Xin Tu','灶心土','Earth from the centre of a wood-fired stove','Terra Flava Usta','Stove earth, yellow earth',
  'stop_bleeding','warm','{acrid}','{spleen,stomach}',
  $t$Warms the middle, stops bleeding, harmonizes the Stomach and stops vomiting.$t$,
  $t$Bleeding from Spleen yang deficiency failing to control blood: bloody stool, hematemesis, uterine bleeding (Huang Tu Tang). Vomiting from Stomach cold, including in pregnancy.$t$,
  $t$Rarely obtainable now; Chi Shi Zhi is the accepted substitute at the same dose. Not for bleeding from heat. Decocted first, then the clear liquid is used to decoct the remaining herbs. Also called Fu Long Gan.$t$,
  15, 30, 'Decoct first and use the strained liquid; up to 60 g.');

perform public.catalogue_upsert_herb('Zi Bei Tian Kui','紫背天葵','Semiaquilegia adoxoides (Radix)','Radix Semiaquilegiae','Semiaquilegia root',
  'clear_heat_relieve_toxicity','cold','{sweet,acrid}','{liver,stomach}',
  $t$Clears heat, resolves toxicity, reduces swelling and dissipates nodules.$t$,
  $t$Sores, boils, carbuncles and abscesses in the early stage (Wu Wei Xiao Du Yin); scrofula, snakebite, breast abscess. Topically as a fresh poultice.$t$,
  $t$Not for yin-type sores or deficiency cold. Frequently unavailable and then simply omitted from Wu Wei Xiao Du Yin.$t$,
  9, 15, 'Fresh: 30 to 60 g.');

-- ---------------------------------------------------------------------------
-- Additions to the catalogue
-- ---------------------------------------------------------------------------

perform public.catalogue_upsert_herb('Chuan Niu Xi','川牛膝','Cyathula officinalis (Radix)','Radix Cyathulae','Cyathula root',
  'invigorate_blood','neutral','{sweet,bitter}','{liver,kidney}',
  $t$Invigorates the blood, unblocks the channels, promotes urination, and directs blood and fire downward. Compared with Huai Niu Xi it moves blood more and tonifies less.$t$,
  $t$Amenorrhea, dysmenorrhea, postpartum abdominal pain, trauma. Painful obstruction and weakness of the lower back and knees. Painful or bloody urination. Headache, dizziness, nosebleed and toothache from fire rising (Tian Ma Gou Teng Yin).$t$,
  $t$Contraindicated in pregnancy and with heavy menstrual bleeding.$t$,
  6, 9, null);

perform public.catalogue_upsert_herb('Ban Zhi Lian','半枝莲','Scutellaria barbata (Herba)','Herba Scutellariae Barbatae','Barbat skullcap',
  'clear_heat_relieve_toxicity','cool','{acrid,bitter}','{lung,liver,stomach}',
  $t$Clears heat, resolves toxicity, invigorates the blood, dispels stasis, promotes urination and reduces swelling.$t$,
  $t$Sores, abscesses, snakebite, appendicitis. Ascites and jaundice from Liver disease. Widely used with Bai Hua She She Cao as an adjunct in oncology support.$t$,
  $t$Contraindicated in pregnancy. Not for deficiency cold. As an oncology adjunct it belongs alongside conventional treatment, not in place of it.$t$,
  15, 30, 'Up to 60 g fresh.');

perform public.catalogue_upsert_herb('Wa Leng Zi','瓦楞子','Arca (Concha)','Concha Arcae','Ark shell, cockle shell',
  'transform_phlegm_cold','neutral','{salty}','{lung,stomach,liver}',
  $t$Transforms phlegm, softens hardness, dissipates nodules, invigorates the blood and, calcined, absorbs acid and alleviates pain.$t$,
  $t$Scrofula, goiter, abdominal masses, hepatosplenomegaly. Acid reflux and epigastric pain from Stomach cold (calcined). Chronic gastritis and peptic ulcer.$t$,
  $t$Not for absence of phlegm or stasis. Calcined for acid reflux, raw to dissipate nodules. Decoct first.$t$,
  9, 15, 'Decoct first; powder 1 to 3 g for reflux.');

perform public.catalogue_upsert_herb('Zi Su Geng','紫苏梗','Perilla frutescens (Caulis)','Caulis Perillae','Perilla stem',
  'regulate_qi','warm','{acrid,sweet}','{lung,spleen,stomach}',
  $t$Moves qi, expands the chest, harmonizes the middle and calms the fetus. Gentler and less dispersing than the leaf.$t$,
  $t$Chest and epigastric fullness, belching, nausea and poor appetite from qi stagnation. Morning sickness, restless fetus and threatened miscarriage with qi stagnation.$t$,
  $t$Gentle enough for use in pregnancy, which is its principal advantage over Zi Su Ye.$t$,
  4.5, 9, null);

perform public.catalogue_upsert_herb('Lu Lu Tong','路路通','Liquidambar formosana (Fructus)','Fructus Liquidambaris','Sweetgum fruit',
  'invigorate_blood','neutral','{bitter}','{liver,stomach,bladder}',
  $t$Dispels wind, unblocks the channels and collaterals, promotes urination and reduces swelling. Promotes lactation.$t$,
  $t$Painful obstruction with numbness and stiffness of the joints. Edema, difficult urination. Insufficient lactation and breast distention. Nasal congestion from wind.$t$,
  $t$Contraindicated in pregnancy and with heavy menstrual bleeding. Not for yin deficiency with dryness.$t$,
  5, 9, null);

end
$seed$;
