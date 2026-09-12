// ICD-10 codes as Wikidata holds them, made presentable.

/**
 * Some ICD-10 values on Wikidata carry their digits twice — hypertension is
 * "I10-I1515.", lung cancer "C3333.-C3434." (fourteen items in the corpus,
 * all the same slip). The code is what it says once.
 * @param {string | null | undefined} code
 */
export function cleanIcd(code) {
  return String(code ?? '')
    .replace(/([A-Z])(\d\d(?:\.\d+)?)\2\.?/g, '$1$2')
    .replace(/\.$/, '');
}
