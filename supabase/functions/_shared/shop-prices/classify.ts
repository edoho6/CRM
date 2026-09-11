// Which category a listing belongs to, or null for "not the comparison's business".
//
// Order matters and is the whole method: an exclusion on the name beats
// everything; then the name rules, because a shop's category is broad ("spa
// and massage" holds the tweezers, "acupuncture accessories" holds the
// alcohol pads) while a name says what the thing is; then the shop's category
// when it is mapped — to a category, or to "out of scope"; then the name
// rules once more, on the shop's own category names. A listing that reaches
// the end unplaced is dropped — better a missing product than a yoga mat
// under "needles".

import { normaliseText } from './normalise.ts';
import { CATEGORY_ORDER, EXCLUSIONS, HARD_EXCLUSIONS, NAME_RULES, RESCUES, STORE_CATEGORY_MAP } from './taxonomy.ts';
import type { ShopCategory } from './types.ts';

export interface Classifiable {
  name: string;
  categories: string[];
}

export function isExcluded(normalisedName: string): boolean {
  if (HARD_EXCLUSIONS.some((pattern) => pattern.test(normalisedName))) return true;
  if (!EXCLUSIONS.some((pattern) => pattern.test(normalisedName))) return false;
  return !RESCUES.some((pattern) => pattern.test(normalisedName));
}

export function categoryFromName(normalisedName: string): ShopCategory | null {
  for (const rule of NAME_RULES) {
    if (rule.pattern.test(normalisedName)) return rule.category;
  }
  return null;
}

const trimmedMaps = new Map<string, Record<string, ShopCategory | null>>();

function trimmedMap(storeSlug: string): Record<string, ShopCategory | null> {
  let map = trimmedMaps.get(storeSlug);
  if (!map) {
    map = {};
    for (const [key, value] of Object.entries(STORE_CATEGORY_MAP[storeSlug] ?? {})) map[key.trim()] = value;
    trimmedMaps.set(storeSlug, map);
  }
  return map;
}

export function classify(item: Classifiable, storeSlug: string): ShopCategory | null {
  const name = normaliseText(item.name);
  if (isExcluded(name)) return null;

  const byName = categoryFromName(name);
  if (byName) return byName;

  const map = trimmedMap(storeSlug);
  const mapped: (ShopCategory | null)[] = [];
  for (const category of item.categories) {
    const key = category.trim();
    if (key in map) mapped.push(map[key]);
  }
  const placed = mapped.filter((c): c is ShopCategory => c !== null);
  if (placed.length > 0) {
    // A product in two mapped categories takes the more specific one, which
    // is the one that comes first in the order the name rules use.
    return [...placed].sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b))[0];
  }
  if (mapped.length > 0) return null;

  const categoryText = normaliseText(item.categories.join(' | '));
  if (!categoryText || isExcluded(categoryText)) return null;
  return categoryFromName(categoryText);
}
