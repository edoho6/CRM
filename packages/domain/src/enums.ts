/**
 * Domain enums shared by both apps and mirrored by Postgres CHECK constraints.
 *
 * Every list here has an exact counterpart in `supabase/migrations`. When you add a
 * value, add it to the matching CHECK constraint in a new migration too, otherwise
 * inserts will be rejected by the database.
 *
 * Each enum is declared as a readonly tuple so it can be (a) iterated in the UI to
 * build dropdowns, and (b) passed straight to `z.enum()` for validation.
 */

export const LOCALES = ['he', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'he';

/** Staff roles inside a clinic. Milestone 1 only ever creates `owner`. */
export const MEMBERSHIP_ROLES = ['owner', 'practitioner', 'staff', 'assistant'] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

/** The roles an invitation may carry: ownership is handed over, never mailed. */
export const INVITABLE_ROLES = ['practitioner', 'staff', 'assistant'] as const;

/** Where the clinic name at the top of the menu may lead. Mirrors profiles_home_path_check. */
export const HOME_PATHS = ['/', '/calendar', '/patients', '/tasks', '/encounters'] as const;
export type HomePath = (typeof HOME_PATHS)[number];
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const SEXES = ['female', 'male', 'other', 'unspecified'] as const;
export type Sex = (typeof SEXES)[number];

/**
 * The colour a diary entry wears when nothing chose one for it.
 *
 * A hex rather than a token because these colours are stored per treatment
 * type, room and location — the person picks them — and a stored value cannot
 * be a variable. It is the palette's second series colour, so an uncoloured
 * entry looks deliberate beside the coloured ones, and it is not the accent
 * green, which already means something.
 *
 * One constant because there were three: the diary fell back to sky, the
 * dashboard to slate, and a newly created type was given cyan — so the same
 * appointment was a different colour on two screens.
 */
export const DEFAULT_ENTRY_COLOR = '#0369a1';

export const APPOINTMENT_STATUSES = [
  'scheduled',
  'confirmed',
  'checked_in',
  'completed',
  'cancelled',
  'no_show',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Statuses that still occupy a slot in the calendar (used by the overlap constraint). */
export const BLOCKING_APPOINTMENT_STATUSES = APPOINTMENT_STATUSES.filter(
  (status) => status !== 'cancelled',
);

export const ENCOUNTER_STATUSES = ['draft', 'signed'] as const;
export type EncounterStatus = (typeof ENCOUNTER_STATUSES)[number];

/** Mirrored by the CHECK constraint on `patient_documents.category`. */
export const DOCUMENT_CATEGORIES = [
  'intake_form',
  'lab_result',
  'id_scan',
  'tongue',
  'other',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** Treatment modalities used in a TCM session. */
export const TREATMENT_MODALITIES = [
  'acupuncture',
  'electro_acupuncture',
  'moxibustion',
  'cupping',
  'gua_sha',
  'tuina',
  'auricular',
  'herbal_formula',
  'dietary_advice',
] as const;
export type TreatmentModality = (typeof TREATMENT_MODALITIES)[number];

/** Needle technique applied at a point. */
export const NEEDLE_TECHNIQUES = ['even', 'tonifying', 'reducing', 'bleeding'] as const;
export type NeedleTechnique = (typeof NEEDLE_TECHNIQUES)[number];

export const POINT_SIDES = ['left', 'right', 'bilateral', 'midline'] as const;
export type PointSide = (typeof POINT_SIDES)[number];

/**
 * Where on the body a point was needled, as the treatment note groups them.
 *
 * One axis, not two: a prescription is written as "upper, lower, left, right,
 * centre", and asking for a level *and* a side would make the practitioner
 * answer the same question twice. The catalogue suggests the bucket; the
 * practitioner has the last word.
 */
export const POINT_REGIONS = ['upper', 'lower', 'left', 'right', 'center'] as const;
export type PointRegion = (typeof POINT_REGIONS)[number];

/**
 * Where a point was actually needled, as the treatment note records it.
 *
 * Side and level together, because that is how needling is remembered and said
 * out loud: "LI4 right, ST36 both below". Splitting them into two questions
 * meant answering the same thing twice and, worse, meant the body chart could
 * only ever draw a point on both sides.
 *
 * Laid out on screen as a cross, with each quadrant where it belongs, so the
 * shape of the prescription is visible before a word of it is read. Ear sits by
 * the centre: auricular points have no upper or lower, and putting them in one
 * of the quadrants would be a lie for the sake of a tidy grid.
 */
export const POINT_PLACEMENTS = ['right', 'left', 'center', 'ear'] as const;
export type PointPlacement = (typeof POINT_PLACEMENTS)[number];

/**
 * Older notes used other vocabularies, and all of them still have to open.
 *
 * Two generations precede this one: five flat regions, then four quadrants that
 * split each side into upper and lower. The quadrants were dropped because the
 * split was never used the way it was meant to be — a prescription is written as
 * "right, left, midline, ear", and asking whether SP6 is upper or lower is a
 * question about the grid rather than about the patient.
 *
 * The side is what survives the translation, because the side is the part that
 * was ever clinically meant. A value with no side at all lands on the right, so
 * the point appears somewhere the practitioner can see and move it rather than
 * vanishing from the record.
 */
const LEGACY_REGION_TO_PLACEMENT: Record<string, PointPlacement> = {
  upper: 'right',
  lower: 'right',
  right_upper: 'right',
  right_lower: 'right',
  left_upper: 'left',
  left_lower: 'left',
};

export function toPointPlacement(value: unknown): PointPlacement {
  if (typeof value !== 'string') return 'right';
  if ((POINT_PLACEMENTS as readonly string[]).includes(value)) return value as PointPlacement;
  return LEGACY_REGION_TO_PLACEMENT[value] ?? 'right';
}

/** Which side of the body a placement is on, or null when it has no side. */
export function placementSide(placement: PointPlacement): 'left' | 'right' | null {
  if (placement === 'left') return 'left';
  if (placement === 'right') return 'right';
  return null;
}

/**
 * How a herb is kept and dispensed.
 *
 * The unit follows from the preparation rather than being a separate choice: a
 * tincture is millilitres and a powder is not, and letting the two be picked
 * independently only ever produces "100g of tincture".
 */
/**
 * How a herb is kept and handed over, in the order a practitioner thinks of them.
 *
 * `powder` is the stored value for granules, and it stays that way: it is what
 * every existing row and every CHECK constraint already says, and renaming it to
 * match the label would mean a data migration to change nothing. The label is
 * where the 5:1 belongs anyway — the ratio is what the practitioner needs to see
 * and not what the column needs to hold.
 *
 * Three of the six are powders — granules, dry extract and ground herb — and
 * they behave identically at the point of dispensing, which is why the unit
 * lists below treat them as one.
 */
export const HERB_PREPARATIONS = [
  'dried_herb',
  'powder',
  'tincture',
  'dry_extract',
  'ground_herb',
  'capsule',
] as const;
export type HerbPreparation = (typeof HERB_PREPARATIONS)[number];

/** The three that are handled as a powder, whatever they are made from. */
const POWDERS: readonly HerbPreparation[] = ['powder', 'dry_extract', 'ground_herb'];

export function isPowder(preparation: HerbPreparation | null | undefined): boolean {
  return preparation ? POWDERS.includes(preparation) : false;
}

/**
 * The units a dose of each preparation is measured in.
 *
 * Not one unit per preparation but a list, because the same tincture is
 * prescribed in millilitres to one patient and in droppers to another — and a
 * dried decoction is measured by the gram when it is weighed out and by the cup
 * when the patient is told how to drink it. Forcing a single unit made the
 * instruction wrong for half the prescriptions written.
 *
 * The first entry is the default, so it is also the one that will be right most
 * of the time.
 */
export const PREPARATION_UNITS: Record<HerbPreparation, readonly HerbUnit[]> = {
  dried_herb: ['gram', 'teaspoon', 'tablespoon', 'cup', 'dose', 'milliliter', 'cap'],
  powder: ['gram', 'teaspoon', 'tablespoon'],
  dry_extract: ['gram', 'teaspoon', 'tablespoon'],
  ground_herb: ['gram', 'teaspoon', 'tablespoon'],
  tincture: ['milliliter', 'dropper'],
  capsule: ['capsule'],
};

export function preparationUnits(
  preparation: HerbPreparation | null | undefined,
): readonly HerbUnit[] {
  return PREPARATION_UNITS[preparation ?? 'dried_herb'] ?? PREPARATION_UNITS.dried_herb;
}

/**
 * The unit a preparation is measured in by default.
 *
 * Still here, and still one value, because stock is weighed rather than dosed:
 * a batch of tincture is received in millilitres whoever it is later prescribed
 * to in droppers.
 */
export function preparationUnit(preparation: HerbPreparation | null | undefined): HerbUnit {
  return preparationUnits(preparation)[0] ?? 'gram';
}

/**
 * When to take a dose, relative to eating.
 *
 * The four a Chinese-medicine prescription actually uses. It matters clinically
 * — a formula that harmonises the middle burner is taken with food, one that
 * tonifies is taken away from it — so it belongs in a field rather than in the
 * free-text note where it cannot be read back or printed on a label.
 */
export const DOSE_TIMINGS = ['before_meal', 'after_meal', 'with_meal', 'empty_stomach'] as const;
export type DoseTiming = (typeof DOSE_TIMINGS)[number];

/**
 * The status of a patient file — one question, not two.
 *
 * This began as a second field beside `is_active`, and having both meant
 * answering the same thing twice and being able to answer it inconsistently: a
 * file could be marked active and "stopped partway" at once. So `is_active` is
 * now derived from this, by a trigger in the database rather than by whichever
 * code path happened to write last. Only the first value counts as active.
 *
 * The distinctions past "not active" are the point: someone who stopped coming
 * and someone who finished and got better are both inactive, and a year later
 * that difference is the only part worth having.
 */
export const TREATMENT_STATUSES = [
  'active',
  'inactive',
  'completed',
  'dropped_out',
  'full_success',
  'partial_success',
  'unsuccessful',
] as const;
export type TreatmentStatus = (typeof TREATMENT_STATUSES)[number];

/** Whether a status means the file belongs in the working list. */
export function isActiveStatus(status: TreatmentStatus | null | undefined): boolean {
  return status === 'active' || status === undefined || status === null;
}

/** The fourteen channels the point catalogue is organised by. */
export const POINT_CHANNELS = [
  'lung',
  'large_intestine',
  'stomach',
  'spleen',
  'heart',
  'small_intestine',
  'bladder',
  'kidney',
  'pericardium',
  'san_jiao',
  'gallbladder',
  'liver',
  'ren',
  'du',
  'extra',
] as const;
export type PointChannel = (typeof POINT_CHANNELS)[number];

/** Which of the two body drawings a point is shown on. */
export const BODY_VIEWS = ['front', 'back'] as const;
export type BodyView = (typeof BODY_VIEWS)[number];

/**
 * Where on the body a point actually is.
 *
 * Distinct from `POINT_REGIONS`, which is the bucket a treatment note files a
 * point under. "Upper" covers the scalp, the ear, the shoulder and a fingertip
 * alike, which is fine for writing a prescription and useless for looking a
 * point up. This is the one a practitioner searches by. Ordered head to foot,
 * so a filter bar reads like a body rather than an alphabet.
 */
export const POINT_BODY_AREAS = [
  'head',
  'face',
  'ear',
  'neck',
  'shoulder',
  'chest',
  'abdomen',
  'upper_back',
  'lower_back',
  'sacrum',
  'buttock',
  'hip',
  'upper_arm',
  'elbow',
  'forearm',
  'wrist',
  'hand',
  'thigh',
  'knee',
  'lower_leg',
  'ankle',
  'foot',
] as const;
export type PointBodyArea = (typeof POINT_BODY_AREAS)[number];

/** Where a line on the order list stands. */
export const ORDER_LIST_STATUSES = ['pending', 'ordered', 'received'] as const;
export type OrderListStatus = (typeof ORDER_LIST_STATUSES)[number];

/** Physical form the herb is stocked in. */
export const HERB_CATEGORIES = [
  'raw_herb',
  'granule',
  'powder',
  'pill',
  'tincture',
  'patent_formula_product',
  'external_application',
] as const;
export type HerbCategory = (typeof HERB_CATEGORIES)[number];

/**
 * Units, for stock and for a dose.
 *
 * The first six are how a herb is bought and counted on a shelf. The rest are
 * how a patient is told to take it — a teaspoon, a capful, a dropper — and they
 * exist because a dosing instruction written in grams is one the patient cannot
 * follow without scales in the kitchen.
 */
export const HERB_UNITS = [
  'gram',
  'capsule',
  'bottle',
  'box',
  'milliliter',
  'packet',
  'teaspoon',
  'tablespoon',
  'cup',
  'dose',
  'cap',
  'dropper',
] as const;
export type HerbUnit = (typeof HERB_UNITS)[number];

export const FORMULA_CATEGORIES = ['classical', 'modified', 'custom'] as const;
export type FormulaCategory = (typeof FORMULA_CATEGORIES)[number];

/**
 * Stock ledger entry types. `receive` and `return` add stock (positive quantity),
 * `dispense`, `waste` add negative quantity, `adjustment` can be either.
 */
export const STOCK_MOVEMENT_TYPES = [
  'receive',
  'dispense',
  'adjustment',
  'waste',
  'return',
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const PURCHASE_ORDER_STATUSES = ['draft', 'ordered', 'received', 'cancelled'] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export const DISPENSING_STATUSES = ['dispensed', 'partially_returned', 'returned'] as const;
export type DispensingStatus = (typeof DISPENSING_STATUSES)[number];

export const AUDIT_ACTIONS = ['insert', 'update', 'delete', 'sign'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/* ---------------------------------------------------------------------------
 * Materia medica vocabulary
 * ---------------------------------------------------------------------------
 * These follow the standard textbook groupings (Bensky, Chinese Herbal
 * Medicine: Materia Medica), which is how practitioners were taught to think
 * about herbs and therefore how they expect to filter a catalogue.
 */

export const TCM_CATEGORIES = [
  'release_exterior_warm',
  'release_exterior_cool',
  'clear_heat_drain_fire',
  'clear_heat_cool_blood',
  'clear_heat_dry_dampness',
  'clear_heat_relieve_toxicity',
  'clear_deficient_heat',
  'clear_summer_heat',
  'downward_draining',
  'moist_laxative',
  'harsh_expellant',
  'drain_dampness',
  'dispel_wind_dampness',
  'aromatic_transform_dampness',
  'transform_phlegm_cold',
  'transform_phlegm_heat',
  'relieve_cough_wheezing',
  'relieve_food_stagnation',
  'regulate_qi',
  'stop_bleeding',
  'invigorate_blood',
  'warm_interior',
  'tonify_qi',
  'tonify_blood',
  'tonify_yang',
  'tonify_yin',
  'stabilize_bind',
  'calm_spirit_anchor',
  'calm_spirit_nourish',
  'aromatic_open_orifices',
  'extinguish_wind',
  'expel_parasites',
  'external_application',
  'other',
] as const;
export type TcmCategory = (typeof TCM_CATEGORIES)[number];

export const TEMPERATURES = [
  'hot',
  'warm',
  'slightly_warm',
  'neutral',
  'cool',
  'slightly_cold',
  'cold',
  'very_cold',
] as const;
export type Temperature = (typeof TEMPERATURES)[number];

export const TASTES = [
  'sweet',
  'bitter',
  'acrid',
  'sour',
  'salty',
  'bland',
  'astringent',
  'aromatic',
] as const;
export type Taste = (typeof TASTES)[number];

export const CHANNELS = [
  'lung',
  'large_intestine',
  'stomach',
  'spleen',
  'heart',
  'small_intestine',
  'bladder',
  'kidney',
  'pericardium',
  'san_jiao',
  'gallbladder',
  'liver',
] as const;
export type Channel = (typeof CHANNELS)[number];

export const FORMULA_TCM_CATEGORIES = [
  'release_exterior',
  'clear_heat',
  'purge',
  'harmonize',
  'treat_dryness',
  'expel_dampness',
  'warm_interior',
  'tonify',
  'regulate_qi',
  'invigorate_blood',
  'stop_bleeding',
  'stabilize_bind',
  'calm_spirit',
  'open_orifices',
  'extinguish_wind',
  'treat_phlegm',
  'reduce_food_stagnation',
  'expel_parasites',
  'other',
] as const;
export type FormulaTcmCategory = (typeof FORMULA_TCM_CATEGORIES)[number];

/**
 * The classical categories a point belongs to.
 *
 * Not decoration: "which is the xi-cleft point of this channel" and "show me
 * the back-shu points" are questions asked during a treatment, and a catalogue
 * that cannot answer them is a list of names. A point can hold several.
 *
 * Ordered as they are taught — the five transport points distal to proximal
 * first, then the connecting set, then the rest.
 */
export const POINT_CATEGORIES = [
  'jing_well',
  'ying_spring',
  'shu_stream',
  'jing_river',
  'he_sea',
  'yuan_source',
  'luo_connecting',
  'xi_cleft',
  'back_shu',
  'front_mu',
  'influential',
  'confluent',
  'command',
  'lower_he_sea',
  'window_of_sky',
  'sea_point',
  'ghost_point',
  'group_luo',
  'crossing',
  'entry',
  'exit',
] as const;
export type PointCategory = (typeof POINT_CATEGORIES)[number];

/* ---------------------------------------------------------------------------
 * Consent
 * ---------------------------------------------------------------------------
 * Marketing is its own kind from the outset. Bundling it with terms of use is
 * what makes a consent unfree, and separating it later means going back to
 * every patient to collect it again.
 */

export const CONSENT_KINDS = ['terms', 'privacy', 'treatment', 'marketing'] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

/** How a decision reached the clinic. A signature and a click are not the same evidence. */
export const CONSENT_METHODS = ['in_person', 'portal', 'paper_form', 'phone', 'email'] as const;
export type ConsentMethod = (typeof CONSENT_METHODS)[number];

/** What a patient can answer from the reminder link. Mirrored by the CHECK on `appointments.confirmation_response`. */
export const CONFIRMATION_RESPONSES = ['confirmed', 'declined'] as const;
export type ConfirmationResponse = (typeof CONFIRMATION_RESPONSES)[number];

/**
 * The tones a patient tag can wear. Names rather than hex codes, so each app
 * paints them from its own palette and they survive dark mode. Mirrored by the
 * CHECK on `patient_tags.color`.
 */
export const TAG_COLORS = ['ink', 'jade', 'sky', 'amber', 'red'] as const;
export type TagColor = (typeof TAG_COLORS)[number];

/**
 * How a task tells its owner that its moment has come. `app` is the bell in
 * the header and a browser notification; `push` is a notification on the
 * phone, for whoever has the store app signed in. Email and SMS are kept as
 * a choice for when a sending provider is connected.
 */
export const REMIND_CHANNELS = ['app', 'email', 'sms', 'push'] as const;
export type RemindChannel = (typeof REMIND_CHANNELS)[number];

/**
 * Price comparison — the shops whose prices are compared.
 *
 * A store's status is the whole of the fetch job's permission: only `active`
 * is read. `awaiting_permission` is a shop whose pages could be read but whose
 * terms ask for its agreement first; `unsupported` serves nothing to anything
 * but a browser.
 */
export const SHOP_STORE_STATUSES = ['active', 'paused', 'awaiting_permission', 'unsupported'] as const;
export type ShopStoreStatus = (typeof SHOP_STORE_STATUSES)[number];

/** How a shop's catalogue is read: a public product feed, or its own pages. */
export const SHOP_STORE_PLATFORMS = [
  'woocommerce',
  'shopify',
  'html_cashcow',
  'html_kala',
  'html_magento1',
  'unsupported',
] as const;
export type ShopStorePlatform = (typeof SHOP_STORE_PLATFORMS)[number];

/**
 * What a Chinese-medicine clinic buys. A product the classifier cannot place
 * here is not kept — cosmetics, spa furniture and massage chairs are the shops'
 * business, not the comparison's.
 */
export const SHOP_CATEGORIES = [
  'needles',
  'moxa',
  'cupping',
  'guasha',
  'ear_seeds',
  'tdp_lamps',
  'electro',
  'granules',
  'formulas',
  'raw_herbs',
  'consumables',
  'accessories',
] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

/** The kind of measurement in a product's size: 0.25×40 mm, 50 g, 250 ml, 30 mm, 5 %. */
export const SHOP_SIZE_KINDS = ['dims', 'mass', 'vol', 'len', 'pct'] as const;
export type ShopSizeKind = (typeof SHOP_SIZE_KINDS)[number];

/**
 * The Western medicine reference (med_entries): what an entry is, how far it
 * has been checked, and how two entries relate. Mirrored by the CHECK
 * constraints in migration 42.
 */
export const MED_KINDS = ['condition', 'symptom', 'drug', 'lab_test'] as const;
export type MedKind = (typeof MED_KINDS)[number];

export const MED_STATUSES = ['draft', 'cross_checked', 'verified'] as const;
export type MedStatus = (typeof MED_STATUSES)[number];

export const MED_RELATIONS = ['treats', 'symptom_of', 'side_effect', 'class', 'diagnoses', 'related'] as const;
export type MedRelation = (typeof MED_RELATIONS)[number];
