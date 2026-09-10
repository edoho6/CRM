import type { FormField } from '../schemas/forms';

/**
 * A filled-in questionnaire as a self-contained HTML page.
 *
 * This is what lands in the patient's file under documents: one page, no
 * stylesheet to fetch, no script, that reads the same in the app, in a
 * browser tab, printed, or saved as PDF from the print dialog. It is built
 * from the submission's own frozen copy of the questions, so it shows the
 * form as it was answered, not as it may have been edited since.
 *
 * Pure: strings in, string out. Both apps and the download route use it.
 */
export interface RenderedSubmissionInput {
  title: string;
  clinicName: string;
  patientName: string;
  /** Already formatted for the reader — "10/09/2026, 14:30". */
  submittedAt: string;
  fields: FormField[];
  answers: Record<string, unknown>;
  signature?: { method: 'drawn' | 'typed'; content: string } | null;
  locale: 'he' | 'en';
  labels: {
    patient: string;
    submittedAt: string;
    signature: string;
    noAnswer: string;
    yes: string;
    no: string;
  };
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function answerText(
  field: FormField,
  value: unknown,
  labels: RenderedSubmissionInput['labels'],
): string {
  if (value === undefined || value === null || value === '') return labels.noAnswer;
  if (field.type === 'yes_no') return value === true || value === 'yes' ? labels.yes : labels.no;
  if (Array.isArray(value)) return value.length ? value.map(String).join(', ') : labels.noAnswer;
  if (typeof value === 'number') return String(value);
  // A date answer is stored as YYYY-MM-DD; people read day/month/year.
  if (field.type === 'date') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  return String(value);
}

export function renderSubmissionHtml(input: RenderedSubmissionInput): string {
  const dir = input.locale === 'he' ? 'rtl' : 'ltr';
  const rows: string[] = [];
  for (const field of input.fields) {
    if (field.type === 'section') {
      rows.push(
        `<h2>${escapeHtml(field.label)}</h2>` +
          (field.help
            ? `<p class="note">${escapeHtml(field.help).replace(/\n/g, '<br>')}</p>`
            : ''),
      );
      continue;
    }
    const answer = answerText(field, input.answers[field.id], input.labels);
    rows.push(
      `<div class="q"><div class="label">${escapeHtml(field.label)}</div>` +
        `<div class="answer">${escapeHtml(answer).replace(/\n/g, '<br>')}</div></div>`,
    );
  }
  const signature = input.signature
    ? `<section class="signature"><h2>${escapeHtml(input.labels.signature)}</h2>` +
      (input.signature.method === 'drawn' &&
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input.signature.content)
        ? `<img src="${input.signature.content}" alt="${escapeHtml(input.labels.signature)}" width="320">`
        : `<p class="typed">${escapeHtml(input.signature.content)}</p>`) +
      `</section>`
    : '';

  return `<!doctype html>
<html lang="${input.locale}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(input.title)} · ${escapeHtml(input.patientName)}</title>
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1c1917; margin: 0; padding: 2rem; max-width: 52rem; line-height: 1.5; }
  header { border-bottom: 1px solid #d6d3d1; padding-bottom: 1rem; margin-bottom: 1.5rem; }
  h1 { font-size: 1.4rem; margin: 0 0 .25rem; }
  .meta { color: #57534e; font-size: .9rem; }
  h2 { font-size: 1.05rem; margin: 1.75rem 0 .5rem; border-bottom: 1px solid #e7e5e4; padding-bottom: .25rem; }
  .note { color: #44403c; white-space: normal; }
  .q { display: grid; grid-template-columns: minmax(12rem, 2fr) 3fr; gap: .75rem; padding: .45rem 0; border-bottom: 1px solid #f5f5f4; }
  .label { color: #57534e; }
  .answer { font-weight: 500; }
  .signature img { border: 1px solid #d6d3d1; border-radius: .5rem; background: #fff; }
  .typed { font-family: "Segoe Script", "Brush Script MT", cursive; font-size: 1.4rem; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(input.title)}</h1>
  <div class="meta">${escapeHtml(input.clinicName)}</div>
  <div class="meta">${escapeHtml(input.labels.patient)}: ${escapeHtml(input.patientName)} · ${escapeHtml(input.labels.submittedAt)}: ${escapeHtml(input.submittedAt)}</div>
</header>
${rows.join('\n')}
${signature}
</body>
</html>
`;
}
