// What the Hebrew is written from, and the hash that names it. Shared by
// hebrew.mjs (which writes and reviews), verify-hebrew.mjs (which checks the
// numbers) and build.mjs (which folds the verdicts into the dataset), so all
// three agree on which English material a Hebrew text belongs to.
import crypto from 'node:crypto';

export const SECTION_KEYS = {
  condition: ['overview', 'symptoms', 'causes', 'diagnosis', 'treatment', 'urgent', 'self_care'],
  symptom: ['overview', 'possible_causes', 'urgent', 'self_care'],
  drug: ['what_for', 'how_to_take', 'side_effects', 'who_cannot', 'interactions', 'pregnancy'],
};

export function materialFor(entry) {
  return {
    kind: entry.kind,
    name_en: entry.name_en,
    name_he: entry.name_he,
    summary_en: entry.summary_en,
    sections_en: entry.sections?.en ?? {},
    allowed_sections: SECTION_KEYS[entry.kind],
  };
}

export function hashOf(material) {
  return crypto.createHash('sha1').update(JSON.stringify(material)).digest('hex').slice(0, 12);
}
