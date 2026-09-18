'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  TREATMENT_STATUSES,
  patientFormSchema,
  patientMedicalHistorySchema,
  patientTagLinksSchema,
} from '@clinic/domain';
import { getClinicScope } from '@/lib/session';
import { actionError, actionOk, type ActionResult } from '@/lib/errors';
import {
  findDuplicate,
  nationalIdKey,
  phoneKey,
  type DuplicateCandidate,
  type DuplicateMatch,
} from './duplicate';
import {
  IMPORT_FIELDS,
  IMPORT_MAX_ROWS,
  planImport,
  type ImportProblem,
  type ImportRowStatus,
} from './csv-import';

/**
 * Patient mutations.
 *
 * Every action re-validates with the same zod schema the form used. The client
 * copy is for fast feedback; this one is the one that counts, because a Server
 * Action is a public endpoint.
 */

export async function createPatient(input: unknown): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = patientFormSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  // The id is chosen here and the insert asks for nothing back. A practitioner
  // reads a patient only once the file is linked to them, and the link is made
  // by the table's after-insert trigger, in the same statement — but a
  // RETURNING clause is checked against the read policy before that trigger
  // runs, and refused. Having created a file grants nothing by itself: the link
  // does, and the owner can take it away.
  const id = randomUUID();
  const { error } = await scope.supabase.from('patients').insert({
    ...parsed.data,
    id,
    clinic_id: scope.context.clinic.id,
    created_by: scope.context.membership.user_id,
  });

  if (error) return actionError(error);
  return actionOk({ id });
}

export async function updatePatient(id: string, input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = patientFormSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase
    .from('patients')
    .update(parsed.data)
    .eq('id', id)
    .select('id');

  if (error) return actionError(error);
  // No row back: the rules refused it or it is gone. Not "saved".
  if (!data?.length) return actionError(new Error('not_found'));
  return actionOk();
}

/**
 * Medical background lives in its own table, so this upserts rather than updates —
 * the row is created the first time anything is recorded, not when the patient is.
 */
export async function saveMedicalHistory(patientId: string, input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = patientMedicalHistorySchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { error } = await scope.supabase.from('patient_medical_history').upsert(
    {
      ...parsed.data,
      patient_id: patientId,
      clinic_id: scope.context.clinic.id,
      updated_by: scope.context.membership.user_id,
    },
    { onConflict: 'patient_id' },
  );

  if (error) return actionError(error);
  return actionOk();
}

/**
 * Sets the patient's status, from the list or from anywhere else.
 *
 * `is_active` is not written here: a trigger derives it from the status, so the
 * two cannot drift apart no matter which code path did the update. That is also
 * why the old `setPatientActive` is gone — writing the flag directly was exactly
 * the thing that let a file be active and "stopped partway" at once.
 *
 * The value is re-validated even though the caller is a `<select>` with a fixed
 * option list, because a Server Action is a public endpoint and the option list
 * is a suggestion to the browser rather than a constraint on the request.
 */
export async function setPatientStatus(id: string, status: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = z.enum(TREATMENT_STATUSES).safeParse(status);
  if (!parsed.success) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase
    .from('patients')
    .update({ treatment_status: parsed.data })
    .eq('id', id)
    .select('id');

  if (error) return actionError(error);
  // No row back: the rules refused it or it is gone. Not "saved".
  if (!data?.length) return actionError(new Error('not_found'));
  return actionOk();
}

/**
 * Sets the whole set of tags on one file.
 *
 * Replace rather than toggle: the picker shows every tag with a tick, and
 * "save what is ticked" cannot drift out of step with the screen the way a
 * sequence of add/remove calls can when one of them fails halfway.
 *
 * Removals first, then additions, each as one statement. The unique
 * constraint on (patient, tag) makes a repeat harmless.
 */
export async function setPatientTags(input: unknown): Promise<ActionResult> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const parsed = patientTagLinksSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const { patient_id, tag_ids } = parsed.data;
  const wanted = new Set(tag_ids);

  const { data: current, error: readError } = await scope.supabase
    .from('patient_tag_links')
    .select('tag_id')
    .eq('patient_id', patient_id)
    .returns<{ tag_id: string }[]>();
  if (readError) return actionError(readError);

  const have = new Set((current ?? []).map((row) => row.tag_id));
  const toRemove = [...have].filter((id) => !wanted.has(id));
  const toAdd = [...wanted].filter((id) => !have.has(id));

  if (toRemove.length > 0) {
    const { error } = await scope.supabase
      .from('patient_tag_links')
      .delete()
      .eq('patient_id', patient_id)
      .in('tag_id', toRemove);
    if (error) return actionError(error);
  }

  if (toAdd.length > 0) {
    const { error } = await scope.supabase.from('patient_tag_links').insert(
      toAdd.map((tag_id) => ({
        patient_id,
        tag_id,
        clinic_id: scope.context.clinic.id,
        created_by: scope.context.membership.user_id,
      })),
    );
    if (error) return actionError(error);
  }

  return actionOk();
}

/** A tag typed into the picker that does not exist yet: made, and returned so it can be ticked. */
export async function createPatientTagInline(name: string): Promise<ActionResult<{ id: string }>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 60) return actionError(new Error('validation'));

  const { data, error } = await scope.supabase
    .from('patient_tags')
    .insert({ name: trimmed, clinic_id: scope.context.clinic.id })
    .select('id')
    .single<{ id: string }>();

  if (error) return actionError(error);
  return actionOk({ id: data.id });
}

/**
 * Whether this clinic already has a file on the same person.
 *
 * A read, called from the form before it saves, and not a constraint: two
 * people do share a phone, and the practitioner is the one who knows whether
 * this is a mother and daughter or the same patient entered twice. It reports;
 * it never refuses.
 *
 * The narrowing happens in the query and the deciding in `duplicate.ts`, which
 * is tested: a phone can be written five ways and the database cannot compare
 * them, so the query asks for anything that ends in the same seven digits and
 * the module says whether it is the same number.
 */
export async function findDuplicatePatient(input: {
  phone?: string | null;
  national_id?: string | null;
  excludeId?: string | null;
}): Promise<ActionResult<DuplicateMatch | null>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));

  const phone = phoneKey(input.phone);
  const nationalId = nationalIdKey(input.national_id);
  if (!phone && !nationalId) return actionOk(null);

  const filters: string[] = [];
  // The last four digits pull the candidates — seven in a row missed a number
  // stored as 050-123-4567 — and the module then decides on nine. `%` and `,` would be read as PostgREST syntax.
  if (phone) filters.push(`phone.ilike.%${phone.slice(-4)}%`);
  if (nationalId) filters.push(`national_id.ilike.%${nationalId}%`);

  const { data, error } = await scope.supabase
    .from('patients')
    .select('id, full_name, phone, national_id')
    .or(filters.join(','))
    .limit(200)
    .returns<DuplicateCandidate[]>();

  if (error) return actionError(error);
  return actionOk(findDuplicate(data ?? [], input, input.excludeId ?? null));
}

/* ---------------------------------------------------------------------------
 * Import from another system's CSV export
 * ------------------------------------------------------------------------ */

const importInputSchema = z.object({
  mapping: z.array(z.enum(IMPORT_FIELDS).nullable()).max(60),
  rows: z
    .array(
      z.object({ line: z.number().int().min(1), cells: z.array(z.string().max(5000)).max(60) }),
    )
    .min(1)
    .max(IMPORT_MAX_ROWS),
  /** True to see what would happen; false to write the new files. */
  dryRun: z.boolean(),
});

export interface ImportOutcome {
  plan: {
    line: number;
    name: string;
    status: ImportRowStatus;
    problems: ImportProblem[];
    matchName: string | null;
  }[];
  created: number;
}

/**
 * The plan is made here, against the patients the clinic has now, whatever
 * the browser showed: the preview is for the person, this is the one that
 * counts. Only rows with a name and no match on file (or earlier in the file)
 * are written, two hundred at a time; each insert passes the audit trigger
 * like any file opened at the desk.
 */
export async function importPatients(input: unknown): Promise<ActionResult<ImportOutcome>> {
  const scope = await getClinicScope();
  if (!scope) return actionError(new Error('unauthorized'));
  const parsed = importInputSchema.safeParse(input);
  if (!parsed.success) return actionError(new Error('validation'));

  const existing: DuplicateCandidate[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await scope.supabase
      .from('patients')
      .select('id, full_name, phone, national_id')
      .order('created_at', { ascending: true })
      .range(from, from + 999)
      .returns<DuplicateCandidate[]>();
    if (error) return actionError(error);
    existing.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const plan = planImport(parsed.data.rows, parsed.data.mapping, existing);
  let created = 0;
  if (!parsed.data.dryRun) {
    const fresh = plan.filter((row) => row.status === 'new');
    for (let i = 0; i < fresh.length; i += 200) {
      const batch = fresh.slice(i, i + 200).map(({ patient }) => ({
        ...patient,
        last_name: patient.last_name ?? '',
        preferred_locale: scope.context.clinic.default_locale,
        clinic_id: scope.context.clinic.id,
        created_by: scope.context.membership.user_id,
      }));
      const { error } = await scope.supabase.from('patients').insert(batch);
      if (error) return actionError(error);
      created += batch.length;
    }
  }

  return actionOk({
    plan: plan.map((row) => ({
      line: row.line,
      name: [row.patient.first_name, row.patient.last_name].filter(Boolean).join(' '),
      status: row.status,
      problems: row.problems,
      matchName: row.match?.name ?? null,
    })),
    created,
  });
}
