import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createSupabaseDouble } from '@clinic/db/test-double';
import { testClinicScope } from '@/lib/test/clinic-scope';

/**
 * Consent, tested for the first time.
 *
 * This is the legal record — the thing a regulator or a lawyer reads to decide
 * whether a patient agreed to what was done to them — and it had no test at all.
 *
 * Two rules here are worth guarding against a well-meaning refactor:
 *
 *   · granting a consent requires the document it cites, because a consent that
 *     cites no text is the undated checkbox this system replaces;
 *   · a signature that fails to save does **not** roll back the decision. The
 *     patient withdrew consent; that they also signed is the smaller fact, and
 *     undoing the decision to keep the pair in step would be the wrong way round.
 */

const { getClinicScope } = vi.hoisted(() => ({ getClinicScope: vi.fn() }));
vi.mock('@/lib/session', () => ({ getClinicScope }));

const { publishConsentDocument, recordConsent } = await import('./actions');

const PATIENT = '11111111-1111-4111-8111-111111111111';
const DOCUMENT = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('publishConsentDocument', () => {
  it('lets the database allocate the version, and returns the new id', async () => {
    const db = createSupabaseDouble({
      rpc: { publish_consent_document: () => 'doc-1' },
    });
    getClinicScope.mockResolvedValue(testClinicScope(db.client));

    const result = await publishConsentDocument({
      kind: 'privacy',
      locale: 'he',
      title: 'הצהרת פרטיות',
      body: 'x'.repeat(40),
    });

    expect(result).toEqual({ ok: true, data: { id: 'doc-1' } });
    // Through the function and not a plain insert: two people publishing at
    // once must not land on the same version number.
    expect(db.callsTo('publish_consent_document')).toHaveLength(1);
  });

  it('rejects a body too short to be a document, without calling the database', async () => {
    const db = createSupabaseDouble({ rpc: { publish_consent_document: () => 'doc-1' } });
    getClinicScope.mockResolvedValue(testClinicScope(db.client));

    const result = await publishConsentDocument({ kind: 'privacy', title: 'x', body: 'short' });

    expect(result.ok).toBe(false);
    expect(db.calls).toHaveLength(0);
  });

  it('rejects a kind the system does not recognise', async () => {
    const db = createSupabaseDouble({ rpc: { publish_consent_document: () => 'doc-1' } });
    getClinicScope.mockResolvedValue(testClinicScope(db.client));

    const result = await publishConsentDocument({
      kind: 'something_else',
      title: 'A title',
      body: 'x'.repeat(40),
    });

    expect(result.ok).toBe(false);
    expect(db.calls).toHaveLength(0);
  });
});

describe('recordConsent', () => {
  it('records who took the decision and for which clinic', async () => {
    const db = createSupabaseDouble();
    getClinicScope.mockResolvedValue(testClinicScope(db.client));

    const result = await recordConsent({
      patient_id: PATIENT,
      document_id: DOCUMENT,
      kind: 'treatment',
      granted: true,
      method: 'in_person',
    });

    expect(result.ok).toBe(true);
    expect(db.rows('patient_consents')[0]).toMatchObject({
      patient_id: PATIENT,
      document_id: DOCUMENT,
      kind: 'treatment',
      granted: true,
      clinic_id: 'clinic-1',
      recorded_by: 'user-1',
    });
  });

  it('refuses to grant a consent that cites no document', async () => {
    const db = createSupabaseDouble();
    getClinicScope.mockResolvedValue(testClinicScope(db.client));

    const result = await recordConsent({
      patient_id: PATIENT,
      document_id: null,
      kind: 'marketing',
      granted: true,
    });

    expect(result.ok).toBe(false);
    expect(db.rows('patient_consents')).toHaveLength(0);
  });

  it('allows withdrawing without a document — the consent may predate them', async () => {
    const db = createSupabaseDouble();
    getClinicScope.mockResolvedValue(testClinicScope(db.client));

    const result = await recordConsent({
      patient_id: PATIENT,
      document_id: null,
      kind: 'marketing',
      granted: false,
    });

    expect(result.ok).toBe(true);
    expect(db.rows('patient_consents')[0]).toMatchObject({ granted: false, document_id: null });
  });

  it('stores the signature against the consent it belongs to', async () => {
    const db = createSupabaseDouble();
    getClinicScope.mockResolvedValue(testClinicScope(db.client));

    await recordConsent(
      { patient_id: PATIENT, document_id: DOCUMENT, kind: 'treatment', granted: true },
      { method: 'typed', content: 'A Patient' },
    );

    const consent = db.rows('patient_consents')[0];
    expect(db.rows('signatures')[0]).toMatchObject({
      consent_id: consent.id,
      patient_id: PATIENT,
      method: 'typed',
      witnessed_by: 'user-1',
    });
  });

  it('keeps the decision when the signature fails to save', async () => {
    const db = createSupabaseDouble({ failures: [{ target: 'signatures' }] });
    getClinicScope.mockResolvedValue(testClinicScope(db.client));

    const result = await recordConsent(
      { patient_id: PATIENT, document_id: DOCUMENT, kind: 'treatment', granted: true },
      { method: 'typed', content: 'A Patient' },
    );

    // The decision is the thing that had to be recorded.
    expect(result.ok).toBe(true);
    expect(db.rows('patient_consents')).toHaveLength(1);
    expect(db.rows('signatures')).toHaveLength(0);
  });

  it('rejects a drawn signature that is not an image, and records nothing', async () => {
    const db = createSupabaseDouble();
    getClinicScope.mockResolvedValue(testClinicScope(db.client));

    const result = await recordConsent(
      { patient_id: PATIENT, document_id: DOCUMENT, kind: 'treatment', granted: true },
      { method: 'drawn', content: 'not a data url' },
    );

    expect(result.ok).toBe(false);
    expect(db.rows('patient_consents')).toHaveLength(0);
  });

  it('records the consent with no signature when none was offered', async () => {
    const db = createSupabaseDouble();
    getClinicScope.mockResolvedValue(testClinicScope(db.client));

    await recordConsent({
      patient_id: PATIENT,
      document_id: DOCUMENT,
      kind: 'treatment',
      granted: true,
    });

    expect(db.rows('patient_consents')).toHaveLength(1);
    expect(db.rows('signatures')).toHaveLength(0);
  });

  it('refuses when nobody is signed in', async () => {
    getClinicScope.mockResolvedValue(null);
    const result = await recordConsent({ patient_id: PATIENT, kind: 'treatment', granted: false });
    expect(result.ok).toBe(false);
  });
});
