import { describe, expect, it } from 'vitest';
import { renderSubmissionHtml } from '@clinic/domain';

const field = (partial: Record<string, unknown>) =>
  ({
    help: null,
    required: false,
    options: [],
    scale_min: 0,
    scale_max: 10,
    scale_min_label: null,
    scale_max_label: null,
    ...partial,
  }) as never;

const labels = {
  patient: 'מטופל',
  submittedAt: 'מולא',
  signature: 'חתימה',
  noAnswer: '—',
  yes: 'כן',
  no: 'לא',
};

describe('renderSubmissionHtml', () => {
  it('escapes what people typed and reads yes/no as words', () => {
    const html = renderSubmissionHtml({
      title: 'שאלון <קליטה>',
      clinicName: 'קליניקה',
      patientName: 'דנה & רון',
      submittedAt: '10/09/2026',
      locale: 'he',
      labels,
      fields: [
        field({ id: 'a', type: 'short_text', label: 'שם' }),
        field({ id: 'b', type: 'yes_no', label: 'סכרת' }),
        field({ id: 'c', type: 'multi_choice', label: 'תסמינים', options: ['x', 'y'] }),
        field({ id: 's', type: 'section', label: 'הצהרה', help: 'שורה 1\nשורה 2' }),
      ],
      answers: { a: '<script>alert(1)</script>', b: true, c: ['x', 'y'] },
      signature: { method: 'typed', content: 'דנה' },
    });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('שאלון &lt;קליטה&gt;');
    expect(html).toContain('דנה &amp; רון');
    expect(html).toContain('<div class="answer">כן</div>');
    expect(html).toContain('x, y');
    expect(html).toContain('שורה 1<br>שורה 2');
    expect(html).toContain('class="typed">דנה<');
    expect(html).toContain('dir="rtl"');
  });

  it('only embeds a drawn signature that is really an image data URL', () => {
    const base = {
      title: 't',
      clinicName: 'c',
      patientName: 'p',
      submittedAt: 'now',
      locale: 'en' as const,
      labels,
      fields: [],
      answers: {},
    };
    const good = renderSubmissionHtml({
      ...base,
      signature: { method: 'drawn', content: 'data:image/png;base64,iVBORw0KGgo=' },
    });
    expect(good).toContain('<img src="data:image/png;base64,iVBORw0KGgo="');
    const bad = renderSubmissionHtml({
      ...base,
      signature: { method: 'drawn', content: 'javascript:alert(1)' },
    });
    expect(bad).not.toContain('<img');
    expect(bad).toContain('javascript:alert(1)'.replace(/'/g, '&#39;').replace(/\(/g, '('));
  });
});
