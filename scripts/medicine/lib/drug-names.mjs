// The names a drug is looked up by in the American sources (openFDA labels,
// RxNorm): the name the corpus asked for, its American spelling, then
// Wikidata's label and aliases — cleaned of a chemist's racemate prefixes and
// of anything the services cannot take as a name. Shared by openfda.mjs and
// rxnorm.mjs so the two agree on what they searched for.

/** The international name on the left, the name the FDA and RxNorm file under on the right. */
export const US_NAMES = {
  paracetamol: 'acetaminophen',
  salbutamol: 'albuterol',
  adrenaline: 'epinephrine',
  noradrenaline: 'norepinephrine',
  glibenclamide: 'glyburide',
  ciclosporin: 'cyclosporine',
  aciclovir: 'acyclovir',
  beclometasone: 'beclomethasone',
  cefalexin: 'cephalexin',
  colestyramine: 'cholestyramine',
  'glyceryl trinitrate': 'nitroglycerin',
  hyoscine: 'scopolamine',
  isoprenaline: 'isoproterenol',
  mesalazine: 'mesalamine',
  oestradiol: 'estradiol',
  pethidine: 'meperidine',
  phenobarbitone: 'phenobarbital',
  rifampicin: 'rifampin',
  amfetamine: 'amphetamine',
  dexamfetamine: 'dextroamphetamine',
  lignocaine: 'lidocaine',
  frusemide: 'furosemide',
  levothyroxine: 'levothyroxine sodium',
  amoxycillin: 'amoxicillin',
  bendroflumethiazide: 'bendroflumethiazide',
  chlorphenamine: 'chlorpheniramine',
  dicycloverine: 'dicyclomine',
  dosulepin: 'dothiepin',
  fluticasone: 'fluticasone',
  methotrimeprazine: 'methotrimeprazine',
  moclobemide: 'moclobemide',
  salcatonin: 'calcitonin',
  sulfasalazine: 'sulfasalazine',
  tetracaine: 'tetracaine',
  thiopental: 'thiopental',
  trihexyphenidyl: 'trihexyphenidyl',
  'sodium valproate': 'valproate sodium',
  'sodium cromoglicate': 'cromolyn sodium',
  cromoglicic: 'cromolyn',
  dimeticone: 'dimethicone',
  'ethinylestradiol': 'ethinyl estradiol',
  'hydroxycarbamide': 'hydroxyurea',
  'levomepromazine': 'methotrimeprazine',
  'metamizole': 'dipyrone',
  'phenoxymethylpenicillin': 'penicillin v',
  'benzylpenicillin': 'penicillin g',
  'tioguanine': 'thioguanine',
  'tretinoin': 'tretinoin',
  'alimemazine': 'trimeprazine',
  'ciclesonide': 'ciclesonide',
  'clomifene': 'clomiphene',
  'colecalciferol': 'cholecalciferol',
  'ergocalciferol': 'ergocalciferol',
  'guaifenesin': 'guaifenesin',
  'indometacin': 'indomethacin',
  'mitomycin': 'mitomycin',
  'nicorandil': 'nicorandil',
  'oxybutynin': 'oxybutynin',
  'riboflavin': 'riboflavin',
  'sulfadiazine': 'sulfadiazine',
  'sulfamethoxazole': 'sulfamethoxazole',
  'trimethoprim': 'trimethoprim',
  'vitamin d3': 'cholecalciferol',
};

/** A name the services can take: letters, digits, spaces, hyphens; no formulas. */
export function usableName(name) {
  return /^[a-z0-9][a-z0-9 ,'()-]{1,70}$/i.test(name) && !/[0-9],[0-9]|\(\d|\bacid\b.*\bacid\b/.test(name);
}

/** Wikidata's label without the prefixes a chemist adds and a clinic does not say. */
export function cleanName(name) {
  return String(name ?? '')
    // The racemate prefix first, while its parentheses are still there to match.
    .replace(/^(rac|\(RS\)|\(±\)|\(\+\)|\(−\)|\(-\)|dl|d|l)-(?=[a-z])/i, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/^[\s-]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * How much a name looks like the name a label is filed under: one or two
 * lowercase words, no digits, no code. Wikidata's label is not always that —
 * one item is labelled "cytophosphane" with "cyclophosphamide" among the
 * aliases — so the candidates are ordered by this, not by where they came from.
 */
function awkwardness(name) {
  let score = 0;
  if (/\d/.test(name)) score += 3;
  if (name.split(' ').length > 2) score += 2;
  if (/[A-Z]{2,}/.test(name)) score += 2;
  if (/-/.test(name)) score += 1;
  if (name.length > 24) score += 1;
  return score;
}

/**
 * Candidate names in the order they are worth trying: the curated name
 * first, then the American spelling of each name, Wikidata's label and its
 * aliases — each once, the plainest first.
 * @param {{ labels?: { en?: string | null }, aliases?: { en?: string[] } }} record
 * @param {string | null} [curatedName]
 * @param {number} [limit]
 * @returns {string[]}
 */
export function candidateNames(record, curatedName = null, limit = 8) {
  const raw = [record.labels?.en, ...(record.aliases?.en ?? [])]
    .filter(Boolean)
    .map(cleanName)
    .filter((n) => n && usableName(n));
  const out = [];
  const push = (n) => {
    const key = n.toLowerCase();
    if (!out.some((x) => x.toLowerCase() === key)) out.push(n);
  };
  if (curatedName) {
    const us = US_NAMES[curatedName.toLowerCase()];
    if (us) push(us);
    push(curatedName);
  }
  const rest = [];
  for (const n of raw) {
    const us = US_NAMES[n.toLowerCase()];
    if (us) rest.push(us);
    rest.push(n);
  }
  rest.sort((a, b) => awkwardness(a) - awkwardness(b));
  for (const n of rest) push(n);
  return out.slice(0, limit);
}
