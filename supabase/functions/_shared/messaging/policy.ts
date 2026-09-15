// What the sender decides before it sends anything.

import type { QueuedMessage } from './types.ts';

/** The one row a sandbox clinic may still send: the practitioner's own test. */
export const TEST_TEMPLATE_KEY = 'test_message';

/**
 * Why a row must not go, or null when it may.
 *
 * A clinic marked as a sandbox holds fictional patients with numbers that
 * are not allocated to anyone — but the credit would still be spent, and the
 * practitioner's own clinic wears the mark while it is being tried out. So
 * nothing to a patient leaves such a clinic; the test message to the
 * practitioner's own phone is the exception, because it is how they learn
 * the service is connected.
 */
export function skipReason(message: Pick<QueuedMessage, 'clinicSynthetic' | 'template_key'>): string | null {
  if (message.clinicSynthetic && message.template_key !== TEST_TEMPLATE_KEY) return 'synthetic_clinic';
  return null;
}

/** One clinic's WhatsApp template ids by message kind, as read from `clinic_automations`. */
export type TemplateMap = Map<string, Map<string, string>>;

export function buildTemplateMap(
  rows: readonly { clinic_id: string; kind: string; whatsapp_template_id: string | null }[],
): TemplateMap {
  const map: TemplateMap = new Map();
  for (const row of rows) {
    const id = row.whatsapp_template_id?.trim();
    if (!id) continue;
    let byKind = map.get(row.clinic_id);
    if (!byKind) {
      byKind = new Map();
      map.set(row.clinic_id, byKind);
    }
    byKind.set(row.kind, id);
  }
  return map;
}

export function templateIdFor(map: TemplateMap, clinicId: string, templateKey: string): string | null {
  return map.get(clinicId)?.get(templateKey) ?? null;
}
