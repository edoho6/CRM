// The shape of what the two sources give, once read: facts, not text. A
// fact sheet is what the writer sees and the only thing it may draw on; the
// checks after writing compare the text back to it.

export type SourceName = 'bara' | 'americandragon';

export interface SourceRef {
  name: SourceName;
  url: string;
  title?: string;
}

/** One statement from one source, in the source's language. */
export interface Fact {
  text: string;
  lang: 'he' | 'en';
  source: SourceName;
}

/** An action and what it is reached for, as the sources pair them. */
export interface ActionFact extends Fact {
  indications?: string[];
}

export interface DoseFact {
  min: number | null;
  max: number | null;
  /** Grams per day unless said otherwise. */
  unit: 'g' | 'ml';
  raw: string;
  source: SourceName;
}

export interface HerbSource {
  source: SourceName;
  url: string;
  title?: string;
  pinyin: string | null;
  chinese: string | null;
  botanical: string | null;
  pharmaceutical: string | null;
  english: string[];
  hebrew: string[];
  kind: 'chinese' | 'western';
  categoryRaw: string | null;
  temperatureRaw: string | null;
  tastesRaw: string[];
  channelsRaw: string[];
  doses: DoseFact[];
  partUsed: string | null;
  family: string | null;
  classicalSource: string | null;
  actions: ActionFact[];
  indications: Fact[];
  contraindications: Fact[];
  interactions: Fact[];
  incompatibilities: Fact[];
  pregnancy: Fact | null;
  lactation: Fact | null;
  combinations: Array<{ with: string[]; for: string }>;
  substitutes: string[];
  notes: Fact[];
  restrictedInIsrael: boolean;
  toxic: boolean;
}

export interface IngredientFact {
  pinyin: string;
  latin: string | null;
  /** Grams per day; a range when the source gives one. */
  doseMin: number | null;
  doseMax: number | null;
  note: string | null;
  actions: string | null;
  source: SourceName;
}

export interface FormulaSource {
  source: SourceName;
  url: string;
  title?: string;
  pinyin: string | null;
  chinese: string | null;
  english: string[];
  categoryRaw: string | null;
  classicalSource: string | null;
  ingredients: IngredientFact[];
  actions: Fact[];
  syndromes: Fact[];
  indications: Fact[];
  tongue: Fact | null;
  pulse: Fact | null;
  treats: string[];
  contraindications: Fact[];
  interactions: Fact[];
  notes: Fact[];
  nameMeaning: Fact | null;
}

export interface PointSource {
  source: SourceName;
  url: string;
  title?: string;
  /** Our code ("ST36"), or null for an extra point the catalogue does not hold. */
  code: string | null;
  codeRaw: string;
  pinyin: string | null;
  chinese: string | null;
  english: string[];
  location: Fact[];
  needling: Fact[];
  commandFunctions: Fact[];
  actions: Fact[];
  indications: Fact[];
  combinations: Array<{ with: string[]; for: string }>;
  contraindications: Fact[];
  notes: Fact[];
}

/** The merged sheet for one herb, every fact tagged with where it came from. */
export interface HerbFacts {
  key: string;
  pinyin: string;
  kind: 'chinese' | 'western';
  chinese: string | null;
  botanical: string | null;
  pharmaceutical: string | null;
  english: string | null;
  hebrew: string | null;
  category: string | null;
  categoryRaw: Partial<Record<SourceName, string>>;
  temperature: string | null;
  tastes: string[];
  channels: string[];
  dose: DoseFact | null;
  otherDoses: DoseFact[];
  partUsed: string | null;
  family: string | null;
  classicalSource: string | null;
  actions: ActionFact[];
  indications: Fact[];
  contraindications: Fact[];
  interactions: Fact[];
  incompatibilities: Fact[];
  pregnancy: Fact[];
  lactation: Fact[];
  combinations: Array<{ with: string[]; for: string }>;
  substitutes: string[];
  notes: Fact[];
  restrictedInIsrael: boolean;
  toxic: boolean;
  sources: SourceRef[];
  disagreements: string[];
}

export interface FormulaFacts {
  key: string;
  pinyin: string;
  chinese: string | null;
  english: string | null;
  category: string | null;
  categoryInferred: boolean;
  categoryRaw: Partial<Record<SourceName, string>>;
  classicalSource: string | null;
  ingredients: IngredientFact[];
  ingredientsFrom: SourceName | null;
  otherIngredients: IngredientFact[];
  actions: Fact[];
  syndromes: Fact[];
  indications: Fact[];
  tongue: Fact[];
  pulse: Fact[];
  treats: string[];
  contraindications: Fact[];
  interactions: Fact[];
  notes: Fact[];
  nameMeaning: Fact[];
  sources: SourceRef[];
  disagreements: string[];
}

export interface PointFacts {
  key: string;
  code: string;
  pinyin: string | null;
  chinese: string | null;
  english: string | null;
  location: Fact[];
  needling: Fact[];
  commandFunctions: Fact[];
  actions: Fact[];
  indications: Fact[];
  combinations: Array<{ with: string[]; for: string }>;
  contraindications: Fact[];
  notes: Fact[];
  sources: SourceRef[];
}

/** The text the writer produces for one entry, in both languages. */
export interface HerbText {
  functions: string;
  indications: string;
  cautions: string;
}
export interface FormulaText {
  actions: string;
  indications: string;
  contraindications: string;
}
export interface PointText {
  location: string;
  actions: string;
  indications: string;
  needling: string;
  cautions: string;
}
