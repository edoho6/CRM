import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildOutboundRequest,
  OUTBOUND_COLUMNS,
  OutboundBlockedError,
  outboundResult,
  PATIENT_ID_COLUMN,
  PatientTokens,
  redactPatterns,
  restorePatients,
  sanitizeFreeText,
  type KnownPatient,
  type OutboundRequest,
} from '@/features/assistant/outbound';
import { callModel } from '@/features/assistant/anthropic';
import { QUERIES } from '@/features/assistant/queries';

const PATIENTS: KnownPatient[] = [
  { id: 'p-dana', first_name: 'דנה', last_name: 'לוי' },
  { id: 'p-david', first_name: 'דוד', last_name: 'שטרן' },
  { id: 'p-yosef', first_name: 'יוסף', last_name: 'אברמוביץ' },
  { id: 'p-noa1', first_name: 'נועה', last_name: 'כהן' },
  { id: 'p-noa2', first_name: 'נועה', last_name: 'פרידמן' },
  { id: 'p-latin', first_name: 'Sarah', last_name: 'Goldberg' },
];

function clean(text: string, tokens = new PatientTokens()) {
  return { result: sanitizeFreeText(text, PATIENTS, tokens), tokens };
}

function sent(text: string): string {
  const { result } = clean(text);
  if (!result.ok) throw new Error(`refused: ${result.reason}`);
  return result.text;
}

describe('names in the question', () => {
  it('replaces a full name, in either order', () => {
    expect(sent('מתי דנה לוי הגיעה לאחרונה?')).toBe('מתי [PATIENT_1] הגיעה לאחרונה?');
    expect(sent('מתי לוי דנה הגיעה?')).toBe('מתי [PATIENT_1] הגיעה?');
  });

  it('replaces a first name alone, or a last name alone, when one patient has it', () => {
    expect(sent('כמה פעמים דנה הגיעה')).toBe('כמה פעמים [PATIENT_1] הגיעה');
    expect(sent('מה החוב של שטרן')).toBe('מה החוב של [PATIENT_1]');
  });

  it('knows the common short forms of a first name', () => {
    expect(sent('האם יוסי שילם?')).toBe('האם [PATIENT_1] שילם?');
  });

  it('meets a spelling with vowel letters, niqqud or a final letter', () => {
    expect(sent('האם דויד שטרן שילם')).toBe('האם [PATIENT_1] שילם');
    expect(sent('האם דָּוִד הגיע')).toBe('האם [PATIENT_1] הגיע');
  });

  it('meets the same name written in Latin letters, and a Latin name in Hebrew', () => {
    expect(sent('did Dana Levi come in?')).toBe('did [PATIENT_1] come in?');
    expect(sent('מה עם שרה גולדברג')).toBe('מה עם [PATIENT_1]');
  });

  it('keeps one token per patient across the conversation', () => {
    const tokens = new PatientTokens();
    const a = sanitizeFreeText('דנה לוי', PATIENTS, tokens);
    const b = sanitizeFreeText('ושוב דנה', PATIENTS, tokens);
    expect(a.ok && a.text).toBe('[PATIENT_1]');
    expect(b.ok && b.text).toBe('ושוב [PATIENT_1]');
    expect(tokens.mapping['[PATIENT_1]']).toEqual({ id: 'p-dana', name: 'דנה לוי' });
  });

  it('refuses a first name two patients share, rather than guess', () => {
    expect(clean('האם נועה הגיעה?').result).toEqual({ ok: false, reason: 'ambiguous_name' });
  });

  it('but takes the full name of one of them', () => {
    expect(sent('האם נועה כהן הגיעה?')).toBe('האם [PATIENT_1] הגיעה?');
  });

  it('refuses a common first name that is none of the patients', () => {
    expect(clean('מה עם מיכל?').result).toEqual({ ok: false, reason: 'possible_name' });
    expect(clean('did Jennifer pay?').result).toEqual({ ok: false, reason: 'possible_name' });
  });

  it('does not take ordinary words for names', () => {
    // "כן" has the consonants of "כהן"; "חיים" and "שני" are names and words.
    expect(sent('כמה מטופלים כן הגיעו בחודש השני?')).toBe('כמה מטופלים כן הגיעו בחודש השני?');
    expect(sent('who has not been in for three months?')).toBe(
      'who has not been in for three months?',
    );
    expect(sent('מי לא הגיע כבר שלושה חודשים')).toBe('מי לא הגיע כבר שלושה חודשים');
  });
});

describe('identifiers in free text', () => {
  it('removes phone, identity number, e-mail and street address', () => {
    const text = redactPatterns(
      'טלפון 050-123-4567, ת"ז 123456782, dana@example.com, רחוב הרצל 12',
    );
    expect(text).not.toMatch(/050|123456782|example|הרצל 12/);
    expect(text).toContain('[REDACTED_PHONE]');
    expect(text).toContain('[REDACTED_EMAIL]');
    expect(text).toContain('[REDACTED_ADDRESS]');
  });

  it('keeps amounts and years', () => {
    expect(redactPatterns('הכנסות 2026 היו 15,400 ש"ח')).toBe('הכנסות 2026 היו 15,400 ש"ח');
  });
});

describe('the conversation that goes back to the model', () => {
  it('checks every message again: a name in the history is replaced too', () => {
    const tokens = new PatientTokens();
    const request = buildOutboundRequest(
      {
        system: 'system',
        tools: [],
        messages: [
          { role: 'user', content: 'מי לא הגיע?' },
          { role: 'assistant', content: [{ type: 'text', text: 'דנה לוי לא הגיעה מאז יוני' }] },
          { role: 'user', content: 'ומה עם 050-1234567?' },
        ],
      },
      PATIENTS,
      tokens,
    );
    const body = JSON.stringify(request);
    expect(body).not.toContain('דנה');
    expect(body).not.toContain('050-1234567');
    expect(body).toContain('[PATIENT_1]');
  });

  it('will not build a request around a name it cannot place', () => {
    expect(() =>
      buildOutboundRequest(
        { system: 's', tools: [], messages: [{ role: 'user', content: 'ומה עם נועה?' }] },
        PATIENTS,
        new PatientTokens(),
      ),
    ).toThrow(OutboundBlockedError);
  });
});

describe('query results', () => {
  it('sends only the allowed columns, the patient as a token and never the id', () => {
    const tokens = new PatientTokens();
    const out = outboundResult(
      'inactive_patients',
      {
        columns: ['patient', 'last_treatment', 'status', 'phone'],
        rows: [
          {
            patient: 'דנה לוי',
            last_treatment: '2026-06-01',
            status: 'active',
            phone: '0501234567',
            [PATIENT_ID_COLUMN]: 'p-dana',
          },
        ],
        truncated: false,
      },
      tokens,
    );
    expect(out.columns).toEqual(['patient', 'last_treatment', 'status']);
    expect(out.rows[0]).toEqual({
      patient: '[PATIENT_1]',
      last_treatment: '2026-06-01',
      status: 'active',
    });
    expect(JSON.stringify(out)).not.toMatch(/p-dana|דנה|050/);
  });

  it('sends nothing of a query that is not on the list', () => {
    const out = outboundResult(
      'some_new_query',
      { columns: ['x'], rows: [{ x: 1 }], truncated: false },
      new PatientTokens(),
    );
    expect(out).toEqual({ columns: [], rows: [], truncated: false, withheld: true });
  });

  it('has an allowlist entry for every query the assistant can run', () => {
    for (const query of QUERIES) expect(OUTBOUND_COLUMNS[query.name], query.name).toBeDefined();
  });
});

describe('names come back only on our side', () => {
  it('restores a token it knows, and leaves one it does not', () => {
    const map = { '[PATIENT_1]': { id: 'p-dana', name: 'דנה לוי' } };
    expect(restorePatients('[PATIENT_1] ו-[PATIENT_7] לא הגיעו', map)).toEqual([
      { type: 'patient', token: '[PATIENT_1]', patient: { id: 'p-dana', name: 'דנה לוי' } },
      { type: 'text', text: ' ו-[PATIENT_7] לא הגיעו' },
    ]);
  });
});

describe('there is one door to the API', () => {
  it('callModel takes only a request built by outbound.ts', () => {
    // @ts-expect-error — a plain object is not an OutboundRequest
    const attempt = () => callModel({ system: 's', messages: [], tools: [] });
    expect(typeof attempt).toBe('function');
    const typed: (request: OutboundRequest) => unknown = callModel;
    expect(typed).toBe(callModel);
  });

  it('nothing else in the feature talks to Anthropic or calls the model', () => {
    const dir = join(__dirname, '..', 'features', 'assistant');
    for (const file of readdirSync(dir).filter((name) => /\.tsx?$/.test(name))) {
      const source = readFileSync(join(dir, file), 'utf8');
      if (file !== 'anthropic.ts') expect(source, file).not.toContain('api.anthropic.com');
      if (!['anthropic.ts', 'actions.ts', 'outbound.ts'].includes(file)) {
        expect(source, file).not.toMatch(/\bcallModel\(/);
      }
    }
  });
});
