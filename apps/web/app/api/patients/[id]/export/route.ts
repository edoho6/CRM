import { NextResponse } from 'next/server';
import { createServerSupabase, getCurrentUser, isSupabaseConfigured } from '@clinic/db';
import { checkRateLimit, recordFailure } from '@clinic/db/rate-limit';
import type {
  Appointment,
  Encounter,
  Patient,
  PatientDocument,
  PatientMedicalHistory,
  TcmNote,
} from '@clinic/db/types';
import { logRecordAccess } from '@/lib/access-log';

/**
 * The complete file the clinic holds on one patient, as one JSON download.
 *
 * This exists for two reasons that happen to want the same thing. A patient has
 * a right to a copy of their data in a portable form, and a clinic sometimes
 * has to hand a file to another practitioner or to a regulator. Both are better
 * served by everything at once than by a screen the reader has to transcribe.
 *
 * Two things are deliberately included that a naive export would leave out.
 * The access history — who opened this record and when — is part of what was
 * held about the person, and is the part that is hardest to reconstruct later.
 * And the consent history, with the version of each document, because "she
 * agreed to something in 2024" is not an answer.
 *
 * Documents are listed with their metadata, not embedded. The files live in
 * private storage and each needs its own signed link; a fifty-megabyte JSON
 * with base64 scans inside it is worse for everyone than a list plus the
 * existing download route.
 *
 * Every row this returns is fetched through the caller's own Row Level
 * Security, so the export can never reach further than the person running it.
 */

/** Twenty whole files a quarter of an hour. A person reads one at a time. */
const EXPORT_BUDGET = { max: 20 } as const;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const supabase = await createServerSupabase();

  // Whole patient files, counted per person. This route is the mass-download
  // pattern the access screen watches for — a loop over patient ids empties a
  // clinic through it — and twenty in a quarter of an hour is far more than a
  // practitioner does by hand. The log records each one either way; this bounds
  // how fast they can be taken while the log is still only being read weekly.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const limitKey = `export:${user.id}`;
  const limit = checkRateLimit(limitKey, EXPORT_BUDGET);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'too_many_requests' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .maybeSingle<Patient>();

  if (!patient) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  recordFailure(limitKey, EXPORT_BUDGET);

  const [history, encounters, notes, appointments, documents, consents, access, dispensing] =
    await Promise.all([
      supabase
        .from('patient_medical_history')
        .select('*')
        .eq('patient_id', id)
        .maybeSingle<PatientMedicalHistory>(),
      supabase
        .from('encounters')
        .select('*')
        .eq('patient_id', id)
        .order('encounter_date', { ascending: true })
        .returns<Encounter[]>(),
      supabase
        .from('tcm_notes')
        .select('*, encounter:encounters!inner(patient_id, encounter_date)')
        .eq('encounters.patient_id', id)
        .returns<(TcmNote & { encounter: { encounter_date: string } })[]>(),
      supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', id)
        .order('start_at', { ascending: true })
        .returns<Appointment[]>(),
      supabase
        .from('patient_documents')
        .select('id, file_name, mime_type, size_bytes, category, shared_with_patient, created_at')
        .eq('patient_id', id)
        .order('created_at', { ascending: true })
        .returns<Partial<PatientDocument>[]>(),
      supabase
        .from('patient_consents')
        .select('*, document:consent_documents(kind, version, locale, title, published_at)')
        .eq('patient_id', id)
        .order('decided_at', { ascending: true }),
      // Who looked at this record, which is part of what was held about them.
      supabase
        .from('access_activity')
        .select('action, changed_at, actor_name, table_name')
        .eq('record_id', id)
        .order('changed_at', { ascending: true })
        .limit(2000),
      supabase
        .from('dispensing_records')
        .select('*, items:dispensing_items(herb_id, quantity, unit)')
        .eq('patient_id', id)
        .order('dispensed_at', { ascending: true }),
    ]);

  // The export is itself an access event, and a strong one.
  await logRecordAccess(supabase, 'patients', id, 'export');

  const payload = {
    exported_at: new Date().toISOString(),
    format: 'herbalist-patient-file/1',
    note:
      'Uploaded documents are listed here by name and date; the files themselves are downloaded ' +
      'individually from the clinic system. Access history covers reads recorded from the point ' +
      'access logging was introduced, not the whole life of the record.',
    patient,
    medical_history: history.data ?? null,
    appointments: appointments.data ?? [],
    encounters: encounters.data ?? [],
    clinical_notes: notes.data ?? [],
    prescriptions: dispensing.data ?? [],
    documents: documents.data ?? [],
    consents: consents.data ?? [],
    access_history: access.data ?? [],
  };

  const safeName = (patient.full_name || 'patient').replace(/[^\p{L}\p{N} _-]/gu, '').trim();
  const filename = `${safeName || 'patient'}-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // RFC 5987 encoding, so a Hebrew name survives the header.
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  });
}
