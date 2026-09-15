import { z } from 'zod';
import {
  CHANNELS,
  FORMULA_CATEGORIES,
  FORMULA_TCM_CATEGORIES,
  DOSE_TIMINGS,
  HERB_CATEGORIES,
  HERB_PREPARATIONS,
  HERB_UNITS,
  STOCK_MOVEMENT_TYPES,
  TASTES,
  TCM_CATEGORIES,
  TEMPERATURES,
} from '../enums';
import {
  optionalDate,
  optionalNumber,
  optionalText,
  positiveQuantity,
  requiredText,
  uuidField,
} from './common';

/** `''` from an unselected <select> becomes null rather than failing the enum. */
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal(''), z.null()])
    .optional()
    .transform((value) => (value ? value : null));

/** Master catalogue entry for a single herb / granule / patent product. */
export const herbFormSchema = z
  .object({
    pinyin_name: optionalText(120),
    chinese_name: optionalText(120),
    english_name: optionalText(160),
    botanical_name: optionalText(200),
    pharmaceutical_name: optionalText(200),
    category: z.enum(HERB_CATEGORIES).default('granule'),
    default_unit: z.enum(HERB_UNITS).default('gram'),
    tcm_category: optionalEnum(TCM_CATEGORIES),
    temperature: optionalEnum(TEMPERATURES),
    tastes: z.array(z.enum(TASTES)).default([]),
    channels: z.array(z.enum(CHANNELS)).default([]),
    /** Free-text nature notes kept for anything the structured fields don't capture. */
    properties: optionalText(500),
    functions: optionalText(2000),
    indications: optionalText(2000),
    cautions: optionalText(2000),
    dosage_min_g: optionalNumber,
    dosage_max_g: optionalNumber,
    dosage_notes: optionalText(500),
    reorder_threshold: optionalNumber,
    reorder_quantity: optionalNumber,
    is_active: z.boolean().default(true),
  })
  .refine(
    (value) =>
      Boolean(value.pinyin_name || value.chinese_name || value.english_name),
    { error: 'at_least_one_name_required', path: ['pinyin_name'] },
  );

export type HerbFormValues = z.input<typeof herbFormSchema>;
export type HerbFormData = z.output<typeof herbFormSchema>;

/** A herb line inside a formula, with its dose. */
export const formulaItemSchema = z.object({
  herb_id: uuidField,
  dosage: positiveQuantity,
  unit: z.enum(HERB_UNITS).default('gram'),
  notes: optionalText(200),
});

export type FormulaItemValues = z.input<typeof formulaItemSchema>;

export const herbFormulaFormSchema = z.object({
  name_pinyin: optionalText(160),
  name_chinese: optionalText(160),
  name_english: optionalText(160),
  category: z.enum(FORMULA_CATEGORIES).default('custom'),
  /** Traditional grouping, the formula-level counterpart of a herb's tcm_category. */
  tcm_category: optionalEnum(FORMULA_TCM_CATEGORIES),
  /** Where the formula comes from, e.g. "Shang Han Lun". */
  source_text: optionalText(300),
  actions: optionalText(2000),
  description: optionalText(2000),
  indications: optionalText(2000),
  contraindications: optionalText(2000),
  modifications: optionalText(2000),
  dosage_notes: optionalText(500),
  is_active: z.boolean().default(true),
  items: z.array(formulaItemSchema).min(1, { error: 'formula_needs_at_least_one_herb' }),
});

export type HerbFormulaFormValues = z.input<typeof herbFormulaFormSchema>;
export type HerbFormulaFormData = z.output<typeof herbFormulaFormSchema>;

export const supplierFormSchema = z.object({
  name: requiredText(160),
  contact_name: optionalText(120),
  phone: optionalText(30),
  email: optionalText(160),
  address: optionalText(300),
  /** Free text — "שוטף + 30", "מזומן במסירה" — because every supplier says it differently. */
  payment_terms: optionalText(300),
  notes: optionalText(1000),
  is_active: z.boolean().default(true),
});

export type SupplierFormValues = z.input<typeof supplierFormSchema>;

/** Receiving stock: creates a batch plus a `receive` row in the ledger. */
export const receiveBatchSchema = z.object({
  herb_id: uuidField,
  supplier_id: z.union([uuidField, z.literal(''), z.null()]).transform((v) => (v ? v : null)),
  batch_number: optionalText(80),
  quantity: positiveQuantity,
  /**
   * Kept for the full receiving form, which shows it. Everywhere else the unit
   * is derived from the preparation, so a tincture cannot be booked in in grams.
   */
  unit: z.enum(HERB_UNITS).default('gram'),
  preparation: z.enum(HERB_PREPARATIONS).default('dried_herb'),
  unit_cost: optionalNumber,
  expiry_date: optionalDate,
  storage_location: optionalText(120),
  /**
   * Empty means today. The quick booking-in from the stock table does not ask,
   * because the answer is always today — that is why it is being typed.
   */
  received_date: optionalText(20),
  notes: optionalText(500),
});

export type ReceiveBatchValues = z.input<typeof receiveBatchSchema>;

/** Manual correction / waste write-off against a specific batch. */
export const stockAdjustmentSchema = z.object({
  batch_id: uuidField,
  movement_type: z.enum(STOCK_MOVEMENT_TYPES),
  /** Signed: negative removes stock. */
  quantity: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'number' ? v : Number(v)))
    .pipe(
      z
        .number()
        .finite()
        .refine((n) => n !== 0, { error: 'quantity_cannot_be_zero' }),
    ),
  notes: optionalText(500),
});

export type StockAdjustmentValues = z.input<typeof stockAdjustmentSchema>;

/** One herb + quantity to hand to the patient. */
export const dispenseItemSchema = z.object({
  herb_id: uuidField,
  quantity: positiveQuantity,
  unit: z.enum(HERB_UNITS).default('gram'),
});

/**
 * Dispensing request sent to the `dispense_formula` RPC.
 *
 * Either pick a saved formula (optionally scaled by `multiplier`, e.g. 7 days' worth)
 * or pass ad-hoc items. Stock allocation itself happens inside the database function.
 */
export const dispenseRequestSchema = z
  .object({
    encounter_id: uuidField,
    formula_id: z.union([uuidField, z.literal(''), z.null()]).transform((v) => (v ? v : null)),
    multiplier: z
      .union([z.string(), z.number()])
      .transform((v) => (typeof v === 'number' ? v : Number(v)))
      .pipe(z.number().positive().max(1000))
      .default(1),
    /**
     * Carried so the panel can send one shape to either function. The allocator
     * ignores these; the action writes them onto the record it creates.
     */
    preparation: z.enum(HERB_PREPARATIONS).optional(),
    days_supply: optionalText(80),
    dose_amount: optionalNumber,
    dose_unit: z
      .union([z.enum(HERB_UNITS), z.literal(''), z.null()])
      .transform((v) => (v ? v : null))
      .optional(),
    dose_timing: z
      .union([z.enum(DOSE_TIMINGS), z.literal(''), z.null()])
      .transform((v) => (v ? v : null))
      .optional(),
    doses_per_day: optionalNumber,
    items: z.array(dispenseItemSchema).default([]),
    notes: optionalText(1000),
  })
  .refine((value) => Boolean(value.formula_id) || value.items.length > 0, {
    error: 'formula_or_items_required',
    path: ['formula_id'],
  });

export type DispenseRequestValues = z.input<typeof dispenseRequestSchema>;
export type DispenseRequestData = z.output<typeof dispenseRequestSchema>;
