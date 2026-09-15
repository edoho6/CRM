// Two sources, one fact sheet. Bara comes first wherever both speak — the
// practitioner's decision of 15.9: Bara is the Israeli supplier the clinic
// dispenses from, so its doses, ingredients and groups are the ones that
// hold here — and American Dragon fills what Bara does not cover and adds
// its English. Where the two disagree the sheet says so, and the report
// lists it; nothing is decided silently.
import {
  inferFormulaCategory,
  mapChannels,
  mapFormulaCategory,
  mapHerbCategory,
  mapTastes,
  mapTemperature,
  normalizePinyin,
} from './map.ts';
import type {
  DoseFact,
  Fact,
  FormulaFacts,
  FormulaSource,
  HerbFacts,
  HerbSource,
  IngredientFact,
  PointFacts,
  PointSource,
  SourceRef,
} from './types.ts';

function ref(source: HerbSource | FormulaSource | PointSource): SourceRef {
  return { name: source.source, url: source.url, title: source.title };
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value));
}

export function mergeHerb(bara: HerbSource | null, dragon: HerbSource | null): HerbFacts | null {
  const primary = bara ?? dragon;
  if (!primary) return null;
  const pinyin = bara?.pinyin ?? dragon?.pinyin ?? null;
  const key = pinyin ? normalizePinyin(pinyin) : normalizePinyin(bara?.botanical ?? '');
  if (!key) return null;
  const disagreements: string[] = [];

  const baraCategory = mapHerbCategory(bara?.categoryRaw, 'he');
  const dragonCategory = mapHerbCategory(dragon?.categoryRaw, 'en');
  const kind = bara?.kind ?? 'chinese';
  const category = kind === 'western' ? 'western' : (baraCategory ?? dragonCategory);
  if (baraCategory && dragonCategory && baraCategory !== dragonCategory) {
    disagreements.push(
      `category: bara "${bara!.categoryRaw}" → ${baraCategory}; americandragon "${dragon!.categoryRaw}" → ${dragonCategory}`,
    );
  }

  const baraTemperature = mapTemperature(bara?.temperatureRaw, 'he');
  const dragonTemperature = mapTemperature(dragon?.temperatureRaw, 'en');
  const temperature = baraTemperature ?? dragonTemperature;
  if (baraTemperature && dragonTemperature && baraTemperature !== dragonTemperature) {
    disagreements.push(
      `temperature: bara "${bara!.temperatureRaw}" → ${baraTemperature}; americandragon "${dragon!.temperatureRaw}" → ${dragonTemperature}`,
    );
  }

  const baraTastes = mapTastes(bara?.tastesRaw, 'he');
  const dragonTastes = mapTastes(dragon?.tastesRaw, 'en');
  const tastes = baraTastes.length ? baraTastes : dragonTastes;
  if (baraTastes.length && dragonTastes.length && !sameSet(baraTastes, dragonTastes)) {
    disagreements.push(
      `tastes: bara ${baraTastes.join('+')}; americandragon ${dragonTastes.join('+')}`,
    );
  }

  const baraChannels = mapChannels(bara?.channelsRaw);
  const dragonChannels = mapChannels(dragon?.channelsRaw);
  const channels = baraChannels.length ? baraChannels : dragonChannels;
  if (baraChannels.length && dragonChannels.length && !sameSet(baraChannels, dragonChannels)) {
    disagreements.push(
      `channels: bara ${baraChannels.join('+')}; americandragon ${dragonChannels.join('+')}`,
    );
  }

  const gramDoses = (source: HerbSource | null): DoseFact[] =>
    (source?.doses ?? []).filter(
      (dose) => dose.unit === 'g' && !/tincture|exceptional|טינקטורה/i.test(dose.raw),
    );
  const baraDose = gramDoses(bara)[0] ?? null;
  const dragonDose = gramDoses(dragon)[0] ?? null;
  const dose = baraDose ?? dragonDose;
  if (
    baraDose &&
    dragonDose &&
    (baraDose.min !== dragonDose.min || baraDose.max !== dragonDose.max)
  ) {
    disagreements.push(
      `dose: bara ${baraDose.min}-${baraDose.max}g; americandragon ${dragonDose.min}-${dragonDose.max}g`,
    );
  }
  const otherDoses = [...(bara?.doses ?? []), ...(dragon?.doses ?? [])].filter(
    (candidate) => candidate !== dose,
  );

  const facts = (...lists: Array<Fact[] | undefined>): Fact[] =>
    lists.flatMap((list) => list ?? []);

  return {
    key,
    pinyin: pinyin ?? bara?.botanical ?? '',
    kind,
    chinese: bara?.chinese ?? dragon?.chinese ?? null,
    botanical: bara?.botanical ?? dragon?.botanical ?? null,
    pharmaceutical: dragon?.pharmaceutical ?? bara?.pharmaceutical ?? null,
    english: dragon?.english[0] ?? bara?.english[0] ?? null,
    hebrew: bara?.hebrew[0] ?? null,
    category,
    categoryRaw: {
      ...(bara?.categoryRaw ? { bara: bara.categoryRaw } : {}),
      ...(dragon?.categoryRaw ? { americandragon: dragon.categoryRaw } : {}),
    },
    temperature,
    tastes,
    channels,
    dose,
    otherDoses,
    partUsed: bara?.partUsed ?? null,
    family: bara?.family ?? null,
    classicalSource: bara?.classicalSource ?? null,
    actions: [...(bara?.actions ?? []), ...(dragon?.actions ?? [])],
    indications: facts(bara?.indications, dragon?.indications),
    contraindications: facts(bara?.contraindications, dragon?.contraindications),
    interactions: facts(bara?.interactions, dragon?.interactions),
    incompatibilities: facts(bara?.incompatibilities, dragon?.incompatibilities),
    pregnancy: [bara?.pregnancy, dragon?.pregnancy].filter((fact): fact is Fact => Boolean(fact)),
    lactation: [bara?.lactation, dragon?.lactation].filter((fact): fact is Fact => Boolean(fact)),
    combinations: [...(bara?.combinations ?? []), ...(dragon?.combinations ?? [])],
    substitutes: bara?.substitutes ?? [],
    notes: facts(bara?.notes, dragon?.notes),
    restrictedInIsrael: Boolean(bara?.restrictedInIsrael),
    toxic: Boolean(bara?.toxic || dragon?.toxic),
    sources: [bara, dragon].filter((source): source is HerbSource => Boolean(source)).map(ref),
    disagreements,
  };
}

export function mergeFormula(
  bara: FormulaSource | null,
  dragon: FormulaSource | null,
): FormulaFacts | null {
  const pinyin = bara?.pinyin ?? dragon?.pinyin ?? null;
  if (!pinyin) return null;
  const disagreements: string[] = [];
  const baraCategory = mapFormulaCategory(bara?.categoryRaw);
  let category = baraCategory;
  let categoryInferred = false;
  if (!category && dragon?.actions.length) {
    category = inferFormulaCategory(dragon.actions.map((fact) => fact.text));
    categoryInferred = Boolean(category);
  }

  const ingredientsFrom = bara?.ingredients.length
    ? 'bara'
    : dragon?.ingredients.length
      ? 'americandragon'
      : null;
  const ingredients: IngredientFact[] =
    ingredientsFrom === 'bara' ? bara!.ingredients : (dragon?.ingredients ?? []);
  const otherIngredients: IngredientFact[] =
    ingredientsFrom === 'bara' ? (dragon?.ingredients ?? []) : [];
  if (bara?.ingredients.length && dragon?.ingredients.length) {
    const names = (list: IngredientFact[]) =>
      new Set(list.map((item) => normalizePinyin(item.pinyin)));
    const a = names(bara.ingredients);
    const b = names(dragon.ingredients);
    const onlyBara = [...a].filter((name) => !b.has(name));
    const onlyDragon = [...b].filter((name) => !a.has(name));
    if (onlyBara.length || onlyDragon.length) {
      disagreements.push(
        `ingredients: only bara ${onlyBara.join(',') || '—'}; only americandragon ${onlyDragon.join(',') || '—'}`,
      );
    }
  }

  const facts = (...lists: Array<Fact[] | undefined>): Fact[] =>
    lists.flatMap((list) => list ?? []);
  const optional = (...items: Array<Fact | null | undefined>): Fact[] =>
    items.filter((fact): fact is Fact => Boolean(fact));

  return {
    key: normalizePinyin(pinyin),
    pinyin,
    chinese: bara?.chinese ?? dragon?.chinese ?? null,
    english: dragon?.english[0] ?? bara?.english[0] ?? null,
    category,
    categoryInferred,
    categoryRaw: bara?.categoryRaw ? { bara: bara.categoryRaw } : {},
    classicalSource: bara?.classicalSource ?? dragon?.classicalSource ?? null,
    ingredients,
    ingredientsFrom,
    otherIngredients,
    actions: facts(bara?.actions, dragon?.actions),
    syndromes: facts(bara?.syndromes, dragon?.syndromes),
    indications: facts(bara?.indications, dragon?.indications),
    tongue: optional(bara?.tongue, dragon?.tongue),
    pulse: optional(bara?.pulse, dragon?.pulse),
    treats: [...new Set([...(bara?.treats ?? []), ...(dragon?.treats ?? [])])],
    contraindications: facts(bara?.contraindications, dragon?.contraindications),
    interactions: facts(bara?.interactions, dragon?.interactions),
    notes: facts(bara?.notes, dragon?.notes),
    nameMeaning: optional(bara?.nameMeaning, dragon?.nameMeaning),
    sources: [bara, dragon].filter((source): source is FormulaSource => Boolean(source)).map(ref),
    disagreements,
  };
}

export function mergePoint(dragon: PointSource): PointFacts | null {
  if (!dragon.code) return null;
  return {
    key: dragon.code,
    code: dragon.code,
    pinyin: dragon.pinyin,
    chinese: dragon.chinese,
    english: dragon.english[0] ?? null,
    location: dragon.location,
    needling: dragon.needling,
    commandFunctions: dragon.commandFunctions,
    actions: dragon.actions,
    indications: dragon.indications,
    combinations: dragon.combinations,
    contraindications: dragon.contraindications,
    notes: dragon.notes,
    sources: [ref(dragon)],
  };
}
