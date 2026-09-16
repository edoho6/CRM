import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createSupabaseDouble } from '@clinic/db/test-double';
import { testClinicScope } from '@/lib/test/clinic-scope';

/**
 * The money path, tested for the first time.
 *
 * Billing had no test of any kind: an invoice is built here, lines are priced
 * here, and the only thing that ever exercised it was a person clicking through
 * a seeded clinic. These cover the arithmetic and the rules that are easy to
 * break by accident and expensive to notice late — a second invoice for the same
 * visit, a line total that disagrees with its own quantity and price, a payment
 * row without the clinic it belongs to.
 *
 * What they cannot cover is whether the database would have allowed any of it;
 * the double has no Row Level Security. That proof lives in
 * `supabase/tests/tenant_isolation.sql`.
 */

const { getClinicScope } = vi.hoisted(() => ({ getClinicScope: vi.fn() }));
const { createPaymentProcess } = vi.hoisted(() => ({ createPaymentProcess: vi.fn() }));

vi.mock('@/lib/session', () => ({ getClinicScope }));
vi.mock('./grow-client', () => ({ createPaymentProcess }));
vi.mock('@clinic/db', () => ({
  readSupabaseEnv: () => ({ url: 'https://project.supabase.co', anonKey: 'anon' }),
  siteUrl: () => 'https://clinic.example',
}));

const {
  createInvoiceFromEncounter,
  createBlankInvoice,
  upsertInvoiceItem,
  cancelInvoice,
  recordManualPayment,
  createGrowPaymentLink,
} = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createInvoiceFromEncounter', () => {
  it('bills the visit and each dispensing, with the treatment line first', async () => {
    const db = createSupabaseDouble({
      tables: {
        encounters: [
          {
            id: 'enc-1',
            patient_id: 'patient-1',
            appointment_id: 'appt-1',
            encounter_date: '2026-03-01',
          },
        ],
        dispensing_records: [
          {
            id: 'disp-1',
            encounter_id: 'enc-1',
            items: [{ line_total: 40 }, { line_total: 12.5 }],
            formula: { name_english: 'Gui Zhi Tang', name_pinyin: 'Gui Zhi Tang' },
          },
        ],
      },
    });
    getClinicScope.mockResolvedValue(testClinicScope(db.client));

    const result = await createInvoiceFromEncounter('enc-1');

    expect(result.ok).toBe(true);
    const items = db.rows('invoice_items');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ description: 'Treatment', sequence: 0, unit_price: 0 });
    // The herbs are billed as one line at what the batches actually cost.
    expect(items[1]).toMatchObject({
      description: 'Herbs — Gui Zhi Tang',
      unit_price: 52.5,
      source_table: 'dispensing_records',
      sequence: 1,
    });
  });

  it('reuses the existing draft rather than billing the visit twice', async () => {
    const db = createSupabaseDouble({
      tables: {
        encounters: [{ id: 'enc-1', patient_id: 'patient-1', appointment_id: null }],
        invoices: [{ id: 'inv-existing', encounter_id: 'enc-1', status: 'draft' }],
      },
    });
    getClinicScope.mockResolvedValue(testClinicScope(db.client));

    const result = await createInvoiceFromEncounter('enc-1');

    expect(result).toEqual({ ok: true, data: { id: 'inv-existing' } });
    expect(db.rows('invoices')).toHaveLength(1);
    expect(db.rows('invoice_items')).toHaveLength(0);
  });

  it('refuses when nobody is signed in', async () => {
    getClinicScope.mockResolvedValue(null);
    const result = await createInvoiceFromEncounter('enc-1');
    expect(result.ok).toBe(false);
  });
});

describe('createBlankInvoice', () => {
  it('stamps the clinic and the practitioner onto the draft', async () => {
    const db = createSupabaseDouble();
    getClinicScope.mockResolvedValue(testClinicScope(db.client));

    await createBlankInvoice('patient-7');

    expect(db.rows('invoices')[0]).toMatchObject({
      clinic_id: 'clinic-1',
      patient_id: 'patient-7',
      status: 'draft',
      created_by: 'user-1',
    });
  });
});

describe('upsertInvoiceItem', () => {
  it('works the line total out rather than trusting one it was handed', async () => {
    const db = createSupabaseDouble();
    getClinicScope.mockResolvedValue(testClinicScope(db.client));

    await upsertInvoiceItem({
      invoiceId: 'inv-1',
      description: 'Cupping',
      quantity: 3,
      unitPrice: 33.33,
    });

    expect(db.rows('invoice_items')[0]).toMatchObject({ quantity: 3, line_total: 99.99 });
  });

  it('updates in place when given an id, instead of adding a second line', async () => {
    const db = createSupabaseDouble({
      tables: { invoice_items: [{ id: 'item-1', description: 'Cupping', quantity: 1 }] },
    });
    getClinicScope.mockResolvedValue(testClinicScope(db.client));

    await upsertInvoiceItem({
      id: 'item-1',
      invoiceId: 'inv-1',
      description: 'Cupping, long',
      quantity: 2,
      unitPrice: 50,
    });

    const items = db.rows('invoice_items');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ description: 'Cupping, long', line_total: 100 });
  });

  it('keeps a dash rather than an empty description', async () => {
    const db = createSupabaseDouble();
    getClinicScope.mockResolvedValue(testClinicScope(db.client));

    await upsertInvoiceItem({ invoiceId: 'inv-1', description: '   ', quantity: 1, unitPrice: 1 });

    expect(db.rows('invoice_items')[0].description).toBe('—');
  });
});

describe('cancelInvoice', () => {
  it('cancels rather than deletes — the record of what was charged stays', async () => {
    const db = createSupabaseDouble({
      tables: { invoices: [{ id: 'inv-1', status: 'sent' }] },
    });
    getClinicScope.mockResolvedValue(testClinicScope(db.client));

    await cancelInvoice('inv-1');

    expect(db.rows('invoices')).toEqual([{ id: 'inv-1', status: 'cancelled' }]);
  });
});

describe('recordManualPayment', () => {
  it('records cash at the desk against the clinic and the invoice', async () => {
    const db = createSupabaseDouble();
    getClinicScope.mockResolvedValue(testClinicScope(db.client));

    const result = await recordManualPayment('inv-1', 250, 'cash');

    expect(result.ok).toBe(true);
    expect(db.rows('payments')[0]).toMatchObject({
      clinic_id: 'clinic-1',
      invoice_id: 'inv-1',
      amount: 250,
      method: 'cash',
      status: 'paid',
      provider: 'manual',
    });
  });

  it('refuses a zero or negative amount before it reaches the database', async () => {
    const db = createSupabaseDouble();
    getClinicScope.mockResolvedValue(testClinicScope(db.client));

    for (const amount of [0, -40]) {
      const result = await recordManualPayment('inv-1', amount, 'cash');
      expect(result.ok).toBe(false);
    }
    expect(db.rows('payments')).toHaveLength(0);
  });
});

describe('createGrowPaymentLink', () => {
  const settings = {
    id: 'settings-1',
    clinic_id: 'clinic-1',
    is_active: true,
    grow_user_id: 'grow-user',
    grow_page_code: 'page-code',
    environment: 'sandbox',
  };

  it('sends the callback to the Edge Function and never to this app', async () => {
    const db = createSupabaseDouble({
      tables: {
        clinic_payment_settings: [settings],
        invoices: [
          {
            id: 'inv-1',
            patient_id: 'patient-1',
            invoice_number: 'INV-0001',
            total: 300,
            amount_paid: 100,
            status: 'draft',
            issued_at: null,
          },
        ],
        patients: [{ id: 'patient-1', full_name: 'A Patient', phone: '0501234567', email: null }],
      },
    });
    getClinicScope.mockResolvedValue(testClinicScope(db.client));
    createPaymentProcess.mockResolvedValue({
      ok: true,
      data: { url: 'https://grow.example/pay/1', processId: 'p-1', processToken: 'secret-token' },
    });

    const result = await createGrowPaymentLink('inv-1');

    expect(result).toEqual({ ok: true, data: { url: 'https://grow.example/pay/1' } });
    // Migration 68: settling a payment needs the service role, which this app
    // does not hold. The callback belongs to the Edge Function.
    expect(createPaymentProcess.mock.calls[0][1]).toMatchObject({
      notifyUrl: 'https://project.supabase.co/functions/v1/grow-webhook',
      sum: 200,
    });
  });

  it('stores the process token before handing out the link', async () => {
    const db = createSupabaseDouble({
      tables: {
        clinic_payment_settings: [settings],
        invoices: [
          {
            id: 'inv-1',
            patient_id: 'patient-1',
            invoice_number: 'INV-0001',
            total: 200,
            amount_paid: 0,
            status: 'draft',
            issued_at: null,
          },
        ],
        patients: [{ id: 'patient-1', full_name: 'A Patient', phone: '0501234567', email: null }],
      },
    });
    getClinicScope.mockResolvedValue(testClinicScope(db.client));
    createPaymentProcess.mockResolvedValue({
      ok: true,
      data: { url: 'https://grow.example/pay/1', processId: 'p-1', processToken: 'secret-token' },
    });

    await createGrowPaymentLink('inv-1');

    // The token is the credential the callback must present. A payment row
    // without it can never be settled.
    expect(db.rows('payments')[0]).toMatchObject({
      provider_process_id: 'p-1',
      provider_process_token: 'secret-token',
      status: 'pending',
    });
    expect(db.rows('invoices')[0]).toMatchObject({ status: 'sent' });
  });

  it('stops before the provider when the patient has no phone', async () => {
    const db = createSupabaseDouble({
      tables: {
        clinic_payment_settings: [settings],
        invoices: [
          {
            id: 'inv-1',
            patient_id: 'patient-1',
            invoice_number: 'INV-0001',
            total: 200,
            amount_paid: 0,
          },
        ],
        patients: [{ id: 'patient-1', full_name: 'A Patient', phone: null, email: null }],
      },
    });
    getClinicScope.mockResolvedValue(testClinicScope(db.client));

    const result = await createGrowPaymentLink('inv-1');

    expect(result.ok).toBe(false);
    expect(createPaymentProcess).not.toHaveBeenCalled();
  });

  it('refuses to charge an invoice that is already paid in full', async () => {
    const db = createSupabaseDouble({
      tables: {
        clinic_payment_settings: [settings],
        invoices: [{ id: 'inv-1', patient_id: 'patient-1', total: 200, amount_paid: 200 }],
        patients: [{ id: 'patient-1', full_name: 'A Patient', phone: '0501234567' }],
      },
    });
    getClinicScope.mockResolvedValue(testClinicScope(db.client));

    const result = await createGrowPaymentLink('inv-1');

    expect(result.ok).toBe(false);
    expect(createPaymentProcess).not.toHaveBeenCalled();
    expect(db.rows('payments')).toHaveLength(0);
  });

  it('does nothing at all when the clinic has not configured a provider', async () => {
    const db = createSupabaseDouble({
      tables: { clinic_payment_settings: [{ ...settings, is_active: false }] },
    });
    getClinicScope.mockResolvedValue(testClinicScope(db.client));

    const result = await createGrowPaymentLink('inv-1');

    expect(result.ok).toBe(false);
    expect(createPaymentProcess).not.toHaveBeenCalled();
  });
});
