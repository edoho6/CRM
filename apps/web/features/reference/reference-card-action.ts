'use server';

import type { AcupuncturePoint, Herb, HerbFormulaWithItems, MedEntry, MedLinkedEntry } from '@clinic/db/types';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';
import { loadMedicineEntry, loadMedicineLinks } from '@/features/medicine/queries';

/**
 * What a chip on the treatment page points at.
 *
 * By id when the row that drew the chip had one; otherwise by the name it
 * showed — a pinyin for a herb, a code for a point, a name for a formula —
 * because the comparison and the prescription history carry names, not ids,
 * and a chip that only worked with an id would work on half the page.
 */
export type ReferenceTarget =
  | { kind: 'herb'; id?: string | null; pinyin?: string | null; name?: string | null; label?: string }
  | { kind: 'formula'; id?: string | null; name?: string | null; label?: string }
  | { kind: 'point'; id?: string | null; code?: string | null; label?: string }
  | { kind: 'medicine'; id?: string | null; slug?: string | null; name?: string | null; label?: string };

export type ReferenceCard =
  | { kind: 'herb'; herb: Herb }
  | { kind: 'formula'; formula: HerbFormulaWithItems }
  | { kind: 'point'; point: AcupuncturePoint }
  | { kind: 'medicine'; entry: MedEntry; links: MedLinkedEntry[] };

const UUID = /^[0-9a-f-]{36}$/i;

const FORMULA_SELECT =
  '*, items:herb_formula_items(*, herb:herbs(id, pinyin_name, chinese_name, english_name, hebrew_name, default_unit))';

/** A clean, bounded lookup value; anything else is not a name. */
function term(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed || trimmed.length > 120 || /[%_,()]/.test(trimmed)) return null;
  return trimmed;
}

/**
 * The card behind a chip, read on demand through the caller's own policies —
 * another clinic's row is simply not found.
 */
export async function loadReferenceCard(target: ReferenceTarget): Promise<ActionResult<ReferenceCard>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));
  const db = scope.supabase;

  if (target.kind === 'herb') {
    const byId = target.id && UUID.test(target.id) ? target.id : null;
    const pinyin = term(target.pinyin);
    const name = term(target.name);
    const attempts: (() => PromiseLike<{ data: Herb | null; error: { message: string } | null }>)[] = [];
    if (byId) attempts.push(() => db.from('herbs').select('*').eq('id', byId).maybeSingle<Herb>());
    if (pinyin) attempts.push(() => db.from('herbs').select('*').ilike('pinyin_name', pinyin).limit(1).maybeSingle<Herb>());
    for (const column of ['hebrew_name', 'english_name', 'pinyin_name'] as const) {
      if (name) attempts.push(() => db.from('herbs').select('*').ilike(column, name).limit(1).maybeSingle<Herb>());
    }
    for (const attempt of attempts) {
      const { data, error } = await attempt();
      if (error) return actionError(new Error(error.message));
      if (data) return actionOk({ kind: 'herb', herb: data });
    }
    return actionError(new Error('not_found'));
  }

  if (target.kind === 'formula') {
    const byId = target.id && UUID.test(target.id) ? target.id : null;
    const name = term(target.name);
    const attempts: (() => PromiseLike<{ data: HerbFormulaWithItems | null; error: { message: string } | null }>)[] = [];
    if (byId) attempts.push(() => db.from('herb_formulas').select(FORMULA_SELECT).eq('id', byId).maybeSingle<HerbFormulaWithItems>());
    for (const column of ['name_pinyin', 'name_hebrew', 'name_english'] as const) {
      if (name) {
        attempts.push(() =>
          db.from('herb_formulas').select(FORMULA_SELECT).ilike(column, name).limit(1).maybeSingle<HerbFormulaWithItems>(),
        );
      }
    }
    for (const attempt of attempts) {
      const { data, error } = await attempt();
      if (error) return actionError(new Error(error.message));
      if (data) return actionOk({ kind: 'formula', formula: data });
    }
    return actionError(new Error('not_found'));
  }

  if (target.kind === 'medicine') {
    const byId = target.id && UUID.test(target.id) ? target.id : null;
    const slug = term(target.slug);
    const name = term(target.name);
    let entry = byId ? await loadMedicineEntry(db, { id: byId }) : null;
    if (!entry && slug) entry = await loadMedicineEntry(db, { slug: slug.toLowerCase() });
    if (!entry && name) {
      // A name typed into a record: the Hebrew or English name first, then
      // the search text, which holds every alias in both languages.
      for (const column of ['name_he', 'name_en'] as const) {
        const { data, error } = await db.from('med_entries').select('*').ilike(column, name).limit(1).maybeSingle<MedEntry>();
        if (error) return actionError(new Error(error.message));
        if (data) {
          entry = data;
          break;
        }
      }
      if (!entry) {
        const { data, error } = await db.from('med_entries').select('*').ilike('search_text', `%${name}%`).limit(1).maybeSingle<MedEntry>();
        if (error) return actionError(new Error(error.message));
        entry = data;
      }
    }
    if (!entry) return actionError(new Error('not_found'));
    const links = await loadMedicineLinks(db, entry.id);
    return actionOk({ kind: 'medicine', entry, links });
  }

  const byId = target.id && UUID.test(target.id) ? target.id : null;
  const code = term(target.code)?.toUpperCase() ?? null;
  const query = byId
    ? db.from('acupuncture_points').select('*').eq('id', byId)
    : code
      ? db.from('acupuncture_points').select('*').ilike('code', code).limit(1)
      : null;
  if (!query) return actionError(new Error('not_found'));
  const { data, error } = await query.maybeSingle<AcupuncturePoint>();
  if (error) return actionError(new Error(error.message));
  if (!data) return actionError(new Error('not_found'));
  return actionOk({ kind: 'point', point: data });
}
