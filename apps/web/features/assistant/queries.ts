import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/fetch-all';
import { PATIENT_ID_COLUMN } from './outbound';

/**
 * The closed set of questions the assistant can ask of the database.
 *
 * This file is the privacy boundary, and it is a list rather than a query
 * builder on purpose. A model that could compose SQL could compose *any* SQL,
 * and the only thing standing between it and a clinical record would be a
 * sentence in a prompt — which is not a control. Here, a question the list does
 * not cover simply cannot be asked.
 *
 * Every query runs through the caller's own RLS-scoped client, so the assistant
 * can never see further than the person using it. That is belt and braces: the
 * clinic filter is implicit in every one of these.
 *
 * **What deliberately never appears in a result row:** national ID numbers,
 * addresses, dates of birth, and the free text of any clinical record — the
 * complaint, the notes, the pattern, the questionnaire answers. The practitioner
 * chose to let the model see narrowed results, and that choice covers names,
 * dates and counts; it was not a choice to send a treatment record to an API.
 * Clinical prose has no bearing on "how many did I see in September" anyway.
 */

export type Row = Record<string, string | number | null>;

export interface QueryResult {
  /** Column order, so the table renders as it was asked for. */
  columns: string[];
  rows: Row[];
  /** True when the limit was hit and there is more behind it. */
  truncated: boolean;
}

/** Nothing returns more than this, whatever it is asked for. */
const MAX_ROWS = 50;

type Client = SupabaseClient;

/* -------------------------------------------------------------------------
 * Shared helpers
 * ---------------------------------------------------------------------- */

/** `months` ago, at the start of that day. Clamped so a bad number cannot ask for all of history. */
function monthsAgo(months: number): string {
  const safe = Math.min(Math.max(Math.round(months), 1), 60);
  const date = new Date();
  date.setMonth(date.getMonth() - safe);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function startOfMonth(offset: number): { from: string; to: string } {
  const safe = Math.min(Math.max(Math.round(offset), 0), 60);
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - safe, 1);
  const to = new Date(now.getFullYear(), now.getMonth() - safe + 1, 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

function result(columns: string[], rows: Row[]): QueryResult {
  return { columns, rows: rows.slice(0, MAX_ROWS), truncated: rows.length > MAX_ROWS };
}

/**
 * Raised when the database refuses a query, rather than returning no rows.
 *
 * The distinction matters more here than anywhere else in the app. A query that
 * errors and is treated as empty makes the assistant say "you had no treatments
 * in September" — confidently, and wrongly. An error has to reach the surface as
 * an error, because the one thing worse than no answer is a false one.
 */
export class QueryFailedError extends Error {
  constructor(readonly query: string) {
    super(`query_failed:${query}`);
    this.name = 'QueryFailedError';
  }
}

/** Unwraps a Supabase result, turning an error into a thrown one. */
function rows<T>(
  name: string,
  response: { data: T[] | null; error: { message: string } | null },
): T[] {
  if (response.error) throw new QueryFailedError(name);
  return response.data ?? [];
}

/* -------------------------------------------------------------------------
 * The queries
 * ---------------------------------------------------------------------- */

export interface QueryDefinition {
  name: string;
  /** Shown to the model, so it knows when this one answers the question. */
  description: string;
  /** JSON Schema for the arguments, as the tools API expects. */
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
  run: (client: Client, args: Record<string, unknown>) => Promise<QueryResult>;
}

const number = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const QUERIES: QueryDefinition[] = [
  {
    name: 'patient_counts',
    description:
      'How many patients the clinic has, split by treatment status (active, in treatment, ' +
      'finished, and so on). Use for "how many patients do I have".',
    parameters: { type: 'object', properties: {} },
    async run(client) {
      const data = rows(
        'patient_counts',
        await fetchAllRows((lo, hi) =>
          client
            .from('patients')
            .select('treatment_status')
            .order('id', { ascending: true })
            .range(lo, hi)
            .returns<{ treatment_status: string | null }[]>(),
        ),
      );

      const counts = new Map<string, number>();
      for (const row of data) {
        const key = row.treatment_status ?? 'unknown';
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }

      return result(
        ['status', 'count'],
        [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([status, count]) => ({ status, count })),
      );
    },
  },

  {
    name: 'new_patients_by_month',
    description:
      'How many new patient files were opened in each of the last N months. Use for ' +
      '"how many new patients in September" or "is the practice growing".',
    parameters: {
      type: 'object',
      properties: {
        months: { type: 'number', description: 'How many months back, 1 to 24. Defaults to 12.' },
      },
    },
    async run(client, args) {
      const months = Math.min(Math.max(number(args.months, 12), 1), 24);
      const data = rows(
        'new_patients_by_month',
        await fetchAllRows((lo, hi) =>
          client
            .from('patients')
            .select('created_at')
            .gte('created_at', monthsAgo(months))
            .order('id', { ascending: true })
            .range(lo, hi)
            .returns<{ created_at: string }[]>(),
        ),
      );

      const counts = new Map<string, number>();
      for (const row of data) {
        const key = row.created_at.slice(0, 7);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }

      return result(
        ['month', 'count'],
        [...counts.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, count]) => ({ month, count })),
      );
    },
  },

  {
    name: 'treatments_by_month',
    description:
      'How many treatments were recorded in each of the last N months. Use for "how busy ' +
      'was I" or "how many treatments this year".',
    parameters: {
      type: 'object',
      properties: {
        months: { type: 'number', description: 'How many months back, 1 to 24. Defaults to 12.' },
      },
    },
    async run(client, args) {
      const months = Math.min(Math.max(number(args.months, 12), 1), 24);
      const data = rows(
        'treatments_by_month',
        await fetchAllRows((lo, hi) =>
          client
            .from('encounters')
            .select('encounter_date')
            .gte('encounter_date', monthsAgo(months))
            .order('id', { ascending: true })
            .range(lo, hi)
            .returns<{ encounter_date: string }[]>(),
        ),
      );

      const counts = new Map<string, number>();
      for (const row of data) {
        const key = row.encounter_date.slice(0, 7);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }

      return result(
        ['month', 'count'],
        [...counts.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, count]) => ({ month, count })),
      );
    },
  },

  {
    name: 'appointments_summary',
    description:
      'Bookings in a month, counted by status (scheduled, completed, cancelled, no-show). ' +
      'Use for "how many cancellations last month" or "what is my no-show rate".',
    parameters: {
      type: 'object',
      properties: {
        months_ago: {
          type: 'number',
          description: '0 for this month, 1 for last month, and so on. Defaults to 0.',
        },
      },
    },
    async run(client, args) {
      const { from, to } = startOfMonth(number(args.months_ago, 0));
      const data = rows(
        'appointments_summary',
        await fetchAllRows((lo, hi) =>
          client
            .from('appointments')
            .select('status')
            .gte('start_at', from)
            .lt('start_at', to)
            .order('id', { ascending: true })
            .range(lo, hi)
            .returns<{ status: string }[]>(),
        ),
      );

      const counts = new Map<string, number>();
      for (const row of data) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);

      return result(
        ['status', 'count'],
        [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([status, count]) => ({ status, count })),
      );
    },
  },

  {
    name: 'inactive_patients',
    description:
      'Patients with no treatment in the last N months, most recently seen first. Use for ' +
      '"who has not been in for a while" or "who should I follow up".',
    parameters: {
      type: 'object',
      properties: {
        months: {
          type: 'number',
          description: 'How many months of silence, 1 to 36. Defaults to 3.',
        },
      },
    },
    async run(client, args) {
      const months = Math.min(Math.max(number(args.months, 3), 1), 36);
      const cutoff = monthsAgo(months);

      const [patientsResult, encountersResult] = await Promise.all([
        fetchAllRows((lo, hi) =>
          client
            .from('patients')
            .select('id, full_name, treatment_status')
            .order('id', { ascending: true })
            .range(lo, hi)
            .returns<{ id: string; full_name: string; treatment_status: string | null }[]>(),
        ),
        fetchAllRows((lo, hi) =>
          client
            .from('encounters')
            .select('patient_id, encounter_date')
            .order('encounter_date', { ascending: false })
            .order('id', { ascending: true })
            .range(lo, hi)
            .returns<{ patient_id: string; encounter_date: string }[]>(),
        ),
      ]);

      const patients = rows('inactive_patients', patientsResult);
      const encounters = rows('inactive_patients', encountersResult);

      // The first row per patient is their most recent, because the query is
      // ordered — no need to compare dates again.
      const lastSeen = new Map<string, string>();
      for (const row of encounters) {
        if (!lastSeen.has(row.patient_id)) lastSeen.set(row.patient_id, row.encounter_date);
      }

      const out: Row[] = [];
      for (const patient of patients) {
        const last = lastSeen.get(patient.id) ?? null;
        // Never seen at all counts as inactive: a file opened and never used is
        // exactly the follow-up this question is looking for.
        if (last !== null && last >= cutoff) continue;
        out.push({
          patient: patient.full_name,
          // Kept for our side only: the name leaves as a token mapped to this id (outbound.ts).
          [PATIENT_ID_COLUMN]: patient.id,
          last_treatment: last ? last.slice(0, 10) : null,
          status: patient.treatment_status,
        });
      }

      out.sort((a, b) =>
        String(b.last_treatment ?? '').localeCompare(String(a.last_treatment ?? '')),
      );
      return result(['patient', 'last_treatment', 'status'], out);
    },
  },

  {
    name: 'top_herbs',
    description:
      'The herbs dispensed most often over the last N months, with how many times and the ' +
      'total quantity. Use for "which herbs do I use most" or "what should I restock".',
    parameters: {
      type: 'object',
      properties: {
        months: { type: 'number', description: 'How many months back, 1 to 36. Defaults to 12.' },
      },
    },
    async run(client, args) {
      const months = Math.min(Math.max(number(args.months, 12), 1), 36);
      const data = rows(
        'top_herbs',
        await fetchAllRows((lo, hi) =>
          client
            .from('dispensing_items')
            .select(
              'quantity, custom_name, herb:herbs(pinyin_name), record:dispensing_records!inner(dispensed_at)',
            )
            .gte('record.dispensed_at', monthsAgo(months))
            .order('id', { ascending: true })
            .range(lo, hi)
            .returns<
              {
                quantity: number;
                custom_name: string | null;
                herb: { pinyin_name: string | null } | null;
              }[]
            >(),
        ),
      );

      const totals = new Map<string, { times: number; quantity: number }>();
      for (const row of data) {
        const name = row.custom_name ?? row.herb?.pinyin_name;
        if (!name) continue;
        const entry = totals.get(name) ?? { times: 0, quantity: 0 };
        entry.times += 1;
        entry.quantity += Number(row.quantity) || 0;
        totals.set(name, entry);
      }

      return result(
        ['herb', 'times', 'total_quantity'],
        [...totals.entries()]
          .sort((a, b) => b[1].times - a[1].times)
          .map(([herb, entry]) => ({
            herb,
            times: entry.times,
            total_quantity: Math.round(entry.quantity * 100) / 100,
          })),
      );
    },
  },

  {
    name: 'top_points',
    description:
      'The acupuncture points used most often over the last N months. Use for "which points ' +
      'do I needle most".',
    parameters: {
      type: 'object',
      properties: {
        months: { type: 'number', description: 'How many months back, 1 to 36. Defaults to 12.' },
      },
    },
    async run(client, args) {
      const months = Math.min(Math.max(number(args.months, 12), 1), 36);
      const data = rows(
        'top_points',
        await fetchAllRows((lo, hi) =>
          client
            .from('tcm_notes')
            .select('points_used, encounter:encounters!inner(encounter_date)')
            .gte('encounter.encounter_date', monthsAgo(months))
            .order('id', { ascending: true })
            .range(lo, hi)
            .returns<{ points_used: { point?: string }[] }[]>(),
        ),
      );

      const counts = new Map<string, number>();
      for (const note of data) {
        for (const point of note.points_used ?? []) {
          const code = point.point?.trim();
          if (!code) continue;
          counts.set(code, (counts.get(code) ?? 0) + 1);
        }
      }

      return result(
        ['point', 'times'],
        [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([point, times]) => ({ point, times })),
      );
    },
  },

  {
    name: 'revenue_by_month',
    description:
      'Invoiced and paid amounts per month for the last N months. Use for "how much did I ' +
      'bill" or "what is outstanding".',
    parameters: {
      type: 'object',
      properties: {
        months: { type: 'number', description: 'How many months back, 1 to 24. Defaults to 12.' },
      },
    },
    async run(client, args) {
      const months = Math.min(Math.max(number(args.months, 12), 1), 24);
      const data = rows(
        'revenue_by_month',
        await fetchAllRows((lo, hi) =>
          client
            .from('invoices')
            .select('issued_at, total, amount_paid, status')
            .gte('issued_at', monthsAgo(months))
            .neq('status', 'cancelled')
            .order('id', { ascending: true })
            .range(lo, hi)
            .returns<{ issued_at: string; total: number; amount_paid: number; status: string }[]>(),
        ),
      );

      const totals = new Map<string, { billed: number; paid: number }>();
      for (const row of data) {
        const key = row.issued_at.slice(0, 7);
        const entry = totals.get(key) ?? { billed: 0, paid: 0 };
        entry.billed += Number(row.total) || 0;
        entry.paid += Number(row.amount_paid) || 0;
        totals.set(key, entry);
      }

      return result(
        ['month', 'billed', 'paid', 'outstanding'],
        [...totals.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, entry]) => ({
            month,
            billed: Math.round(entry.billed * 100) / 100,
            paid: Math.round(entry.paid * 100) / 100,
            outstanding: Math.round((entry.billed - entry.paid) * 100) / 100,
          })),
      );
    },
  },

  {
    name: 'unpaid_invoices',
    description:
      'Invoices that are not fully paid, oldest first, with the patient and the amount ' +
      'outstanding. Use for "who owes me money".',
    parameters: { type: 'object', properties: {} },
    async run(client) {
      const data = rows(
        'unpaid_invoices',
        await client
          .from('invoices')
          .select('invoice_number, issued_at, total, amount_paid, patient:patients(id, full_name)')
          .in('status', ['draft', 'sent', 'partially_paid'])
          .order('issued_at', { ascending: true })
          .limit(200)
          .returns<
            {
              invoice_number: number | null;
              issued_at: string | null;
              total: number;
              amount_paid: number;
              patient: { id: string; full_name: string } | null;
            }[]
          >(),
      );

      const out: Row[] = [];
      for (const row of data) {
        const outstanding = (Number(row.total) || 0) - (Number(row.amount_paid) || 0);
        // A rounding remainder of a few agorot is paid, not outstanding.
        if (outstanding <= 0.01) continue;
        out.push({
          invoice: row.invoice_number,
          patient: row.patient?.full_name ?? null,
          [PATIENT_ID_COLUMN]: row.patient?.id ?? null,
          issued: row.issued_at ? row.issued_at.slice(0, 10) : null,
          outstanding: Math.round(outstanding * 100) / 100,
        });
      }

      return result(['invoice', 'patient', 'issued', 'outstanding'], out);
    },
  },

  {
    name: 'busiest_days',
    description:
      'Which weekday and hour hold the most bookings over the last N months. Use for "when ' +
      'am I busiest" or "should I open another day".',
    parameters: {
      type: 'object',
      properties: {
        months: { type: 'number', description: 'How many months back, 1 to 24. Defaults to 6.' },
      },
    },
    async run(client, args) {
      const months = Math.min(Math.max(number(args.months, 6), 1), 24);
      const data = rows(
        'busiest_days',
        await fetchAllRows((lo, hi) =>
          client
            .from('appointments')
            .select('start_at')
            .gte('start_at', monthsAgo(months))
            .neq('status', 'cancelled')
            .order('id', { ascending: true })
            .range(lo, hi)
            .returns<{ start_at: string }[]>(),
        ),
      );

      const counts = new Map<string, number>();
      for (const row of data) {
        const date = new Date(row.start_at);
        const key = `${date.getDay()}:${date.getHours()}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }

      return result(
        ['weekday', 'hour', 'bookings'],
        [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([key, bookings]) => {
            const [weekday, hour] = key.split(':');
            return { weekday: Number(weekday), hour: Number(hour), bookings };
          }),
      );
    },
  },

  {
    name: 'low_stock',
    description:
      'Herbs at or below their reorder threshold. Use for "what am I running low on". ' +
      'Returns nothing when the clinic keeps no stock.',
    parameters: { type: 'object', properties: {} },
    async run(client) {
      // Two queries, not an embed: the stock level is a view, and PostgREST
      // cannot follow a foreign key through a view, so `herb:herbs(...)` failed
      // and this section showed "could not load" on every reports page.
      const data = rows(
        'low_stock',
        await client
          .from('herb_stock_levels')
          .select('herb_id, total_remaining, default_unit')
          .eq('is_below_threshold', true)
          .limit(200)
          .returns<{ herb_id: string; total_remaining: number; default_unit: string }[]>(),
      );
      const names = new Map<string, string | null>();
      if (data.length > 0) {
        const herbs = rows(
          'low_stock',
          await client
            .from('herbs')
            .select('id, pinyin_name')
            .in(
              'id',
              data.map((row) => row.herb_id),
            )
            .returns<{ id: string; pinyin_name: string | null }[]>(),
        );
        for (const herb of herbs) names.set(herb.id, herb.pinyin_name);
      }

      return result(
        ['herb', 'remaining', 'unit'],
        data.map((row) => ({
          herb: names.get(row.herb_id) ?? null,
          remaining: Number(row.total_remaining),
          unit: row.default_unit,
        })),
      );
    },
  },

  {
    name: 'new_vs_returning_by_month',
    description:
      "For each of the last N months, how many treatments were a patient's first ever and " +
      'how many were a return. Use for "am I keeping patients" or "how many first visits".',
    parameters: {
      type: 'object',
      properties: {
        months: { type: 'number', description: 'How many months back, 1 to 24. Defaults to 12.' },
      },
    },
    async run(client, args) {
      const months = Math.min(Math.max(number(args.months, 12), 1), 24);
      const cutoff = monthsAgo(months);

      /*
       * Every encounter, not only the ones in the window.
       *
       * "First ever" cannot be decided from inside the window: a patient treated
       * in January and again in June is a return in June, and a query that only
       * saw June would call them new. So the whole history is read in date order
       * and the first appearance of each patient is what marks the first visit.
       */
      const data = rows(
        'new_vs_returning_by_month',
        await fetchAllRows((lo, hi) =>
          client
            .from('encounters')
            .select('patient_id, encounter_date')
            .order('encounter_date', { ascending: true })
            .order('id', { ascending: true })
            .range(lo, hi)
            .returns<{ patient_id: string; encounter_date: string }[]>(),
        ),
      );

      const seen = new Set<string>();
      const counts = new Map<string, { first: number; returning: number }>();

      for (const row of data) {
        const isFirst = !seen.has(row.patient_id);
        seen.add(row.patient_id);

        if (row.encounter_date < cutoff) continue;

        const key = row.encounter_date.slice(0, 7);
        const entry = counts.get(key) ?? { first: 0, returning: 0 };
        if (isFirst) entry.first += 1;
        else entry.returning += 1;
        counts.set(key, entry);
      }

      return result(
        ['month', 'first_visit', 'returning'],
        [...counts.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, entry]) => ({
            month,
            first_visit: entry.first,
            returning: entry.returning,
          })),
      );
    },
  },

  {
    name: 'appointment_outcomes_by_month',
    description:
      'Bookings per month for the last N months, split by status, so cancellations and ' +
      'no-shows can be seen as a trend. Use for "are no-shows getting worse".',
    parameters: {
      type: 'object',
      properties: {
        months: { type: 'number', description: 'How many months back, 1 to 24. Defaults to 12.' },
      },
    },
    async run(client, args) {
      const months = Math.min(Math.max(number(args.months, 12), 1), 24);
      const data = rows(
        'appointment_outcomes_by_month',
        await fetchAllRows((lo, hi) =>
          client
            .from('appointments')
            .select('start_at, status')
            .gte('start_at', monthsAgo(months))
            .order('id', { ascending: true })
            .range(lo, hi)
            .returns<{ start_at: string; status: string }[]>(),
        ),
      );

      const counts = new Map<string, Map<string, number>>();
      const statuses = new Set<string>();

      for (const row of data) {
        const key = row.start_at.slice(0, 7);
        const month = counts.get(key) ?? new Map<string, number>();
        month.set(row.status, (month.get(row.status) ?? 0) + 1);
        counts.set(key, month);
        statuses.add(row.status);
      }

      // A column per status that actually occurred, so a clinic with no no-shows
      // does not get a column of zeroes explaining that it has none.
      const columns = ['month', ...[...statuses].sort()];

      return result(
        columns,
        [...counts.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, byStatus]) => {
            const row: Row = { month };
            for (const status of statuses) row[status] = byStatus.get(status) ?? 0;
            return row;
          }),
      );
    },
  },

  {
    name: 'bookings_by_weekday',
    description:
      'How many bookings fall on each day of the week over the last N months. Use for ' +
      '"which day is busiest" or "is Friday worth opening".',
    parameters: {
      type: 'object',
      properties: {
        months: { type: 'number', description: 'How many months back, 1 to 24. Defaults to 12.' },
      },
    },
    async run(client, args) {
      const months = Math.min(Math.max(number(args.months, 12), 1), 24);
      const data = rows(
        'bookings_by_weekday',
        await fetchAllRows((lo, hi) =>
          client
            .from('appointments')
            .select('start_at')
            .gte('start_at', monthsAgo(months))
            .neq('status', 'cancelled')
            .order('id', { ascending: true })
            .range(lo, hi)
            .returns<{ start_at: string }[]>(),
        ),
      );

      const counts = new Array<number>(7).fill(0);
      for (const row of data) counts[new Date(row.start_at).getDay()] += 1;

      // Every weekday is returned, including the empty ones. A day with no
      // bookings is the answer to "should I open on Friday", so dropping it
      // would remove the finding.
      return result(
        ['weekday', 'bookings'],
        counts.map((bookings, weekday) => ({ weekday, bookings })),
      );
    },
  },
];

export const QUERY_BY_NAME = new Map(QUERIES.map((query) => [query.name, query]));
