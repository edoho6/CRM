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
import { fetchAllRows } from '@/lib/fetch-all';
import { getAbilities } from '@/lib/session';

interface AccessRow {
  action: string;
  changed_at: string;
  actor_name: string;
  table_name: string;
}

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
  // The whole file includes the clinical record, so it is for the roles that
  // read one (18.9); the database would hand anyone else a file with the
  // treatments missing, which is worse than no file.
  const abilities = await getAbilities();
  if (!abilities.clinicalRecords) {
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

  const [history, encounters, appointments, documents, consents, access, dispensing] =
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
        .order('id', { ascending: true })
        .returns<Encounter[]>(),
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
      // The trail is the owner's to read (18.9); for anyone else the file says
      // so rather than handing over an empty list that looks like "nobody".
      abilities.settings
        ? fetchAllRows<AccessRow>((from, to) =>
            supabase
              .from('access_activity')
              .select('action, changed_at, actor_name, table_name')
              .eq('record_id', id)
              .order('changed_at', { ascending: true })
              .order('id', { ascending: true })
              .range(from, to),
          )
        : Promise.resolve(null),
      supabase
        .from('dispensing_records')
        .select('*, items:dispensing_items(herb_id, quantity, unit)')
        .eq('patient_id', id)
        .order('dispensed_at', { ascending: true }),
    ]);

  // The notes hang off the treatments, so they are asked for by treatment id.
  // (Filtering an aliased embed by the table's name, as this did, is refused
  // by the data service — and the refusal went unread, so every export left
  // the treatment notes out.)
  const encounterIds = (encounters.data ?? []).map((encounter) => encounter.id);
  const notes =
    encounterIds.length > 0
      ? await supabase
          .from('tcm_notes')
          .select('*, encounter:encounters(encounter_date)')
          .in('encounter_id', encounterIds)
          .returns<(TcmNote & { encounter: { encounter_date: string } | null })[]>()
      : { data: [] as TcmNote[], error: null };

  // A legal copy of a file is all of it or nothing: a part that failed to load
  // is not written out as "there was none".
  const failed =
    [history, encounters, notes, appointments, documents, consents, dispensing].some(
      (result) => result.error,
    ) || Boolean(access?.error);
  if (failed) {
    return NextResponse.json({ error: 'export_failed' }, { status: 500 });
  }

  // The export is itself an access event, and a strong one.
  await logRecordAccess(supabase, 'patients', id, 'export');

  const payload = {
    exported_at: new Date().toISOString(),
    format: 'herbalist-patient-file/1',
    note:
      'Uploaded documents are listed here by name and date; the files themselves are downloaded ' +
      'individually from the clinic system. Access history covers reads recorded from the point ' +
      'access logging was introduced, not the whole life of the record, and is included when the ' +
      "clinic's owner exports the file (it is null otherwise).",
    patient,
    medical_history: history.data ?? null,
    appointments: appointments.data ?? [],
    encounters: encounters.data ?? [],
    clinical_notes: notes.data ?? [],
    prescriptions: dispensing.data ?? [],
    documents: documents.data ?? [],
    consents: consents.data ?? [],
    // null, not []: "not included" must not read as "nobody looked".
    access_history: access ? access.data : null,
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
