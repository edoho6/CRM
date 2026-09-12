import { describe, expect, it } from 'vitest';
import { foldArticle, splitArticle } from '../../../scripts/medicine/lib/wiki-sections.mjs';

/**
 * The part of the pipeline that turns a Wikipedia article into the entry's
 * sections. Two rules matter more than the rest: a dosage heading is never
 * carried over (a dose is quoted from a label), and a heading that means
 * nothing to a clinic (history, epidemiology, culture) is left behind.
 */

const HEBREW_ARTICLE = `אסתמה היא מחלת ריאות כרונית הפוגעת בדרכי הנשימה.

== תסמינים ==
צפצופים, שיעול ולחץ בחזה.

=== התקף ===
החמרה פתאומית של התסמינים.

== גורמים ==
גנטיקה וסביבה.

== אבחון ==
בדיקת תפקודי ריאות.

== טיפול ==
משאפים מרחיבי סימפונות.

=== מינון ===
שתי שאיפות כל ארבע שעות.

== היסטוריה ==
המחלה תוארה כבר בעת העתיקה.

== ראו גם ==
מחלות ריאה`;

const ENGLISH_ARTICLE = `Metformin is a medication used to treat type 2 diabetes.

== Medical uses ==
It is the first-line medication for type 2 diabetes.

== Dosage ==
Starting at 500 mg once daily.

== Side effects ==
Diarrhoea and nausea are common.

== Society and culture ==
It is on the WHO list of essential medicines.`;

describe('a Wikipedia article folded into sections', () => {
  it('splits the article at its headings and keeps the intro apart', () => {
    const parsed = splitArticle(HEBREW_ARTICLE);
    expect(parsed.intro).toContain('מחלת ריאות כרונית');
    expect(parsed.sections.map((s) => s.title)).toEqual(['תסמינים', 'התקף', 'גורמים', 'אבחון', 'טיפול', 'מינון', 'היסטוריה', 'ראו גם']);
  });

  it('maps Hebrew headings to the entry sections and folds a subsection under its parent', () => {
    const { sections } = foldArticle('condition', HEBREW_ARTICLE);
    expect(Object.keys(sections).sort()).toEqual(['causes', 'diagnosis', 'overview', 'symptoms', 'treatment']);
    expect(sections.overview).toContain('מחלת ריאות כרונית');
    expect(sections.symptoms).toContain('צפצופים');
    // The subsection under "תסמינים" comes with it, not on its own.
    expect(sections.symptoms).toContain('החמרה פתאומית');
  });

  it('never carries a dose over from an encyclopedia', () => {
    const hebrew = foldArticle('condition', HEBREW_ARTICLE);
    expect(JSON.stringify(hebrew.sections)).not.toContain('שתי שאיפות');
    const english = foldArticle('drug', ENGLISH_ARTICLE);
    expect(JSON.stringify(english.sections)).not.toContain('500 mg');
    expect(english.sections.how_to_take).toBeUndefined();
  });

  it('leaves out what a clinic has no use for', () => {
    const hebrew = foldArticle('condition', HEBREW_ARTICLE);
    expect(JSON.stringify(hebrew.sections)).not.toContain('העת העתיקה');
    const english = foldArticle('drug', ENGLISH_ARTICLE);
    expect(JSON.stringify(english.sections)).not.toContain('essential medicines');
  });

  it('maps an English drug article to the drug sections', () => {
    const { sections } = foldArticle('drug', ENGLISH_ARTICLE);
    expect(sections.what_for).toContain('first-line medication');
    expect(sections.side_effects).toContain('Diarrhoea');
    expect(sections.overview).toContain('used to treat type 2 diabetes');
  });

  it('clips a long section rather than carrying pages of it', () => {
    const long = `Intro.\n\n== Medical uses ==\n${'word '.repeat(2000)}`;
    const { sections } = foldArticle('drug', long, 500);
    expect(sections.what_for.length).toBeLessThanOrEqual(520);
    expect(sections.what_for.endsWith('[…]')).toBe(true);
  });
});
