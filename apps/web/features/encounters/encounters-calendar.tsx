import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@clinic/i18n/navigation';
import { formatDate } from '@clinic/i18n';
import { cn } from '@clinic/ui';
import {
  isSameDay,
  rangeGridDays,
  startOfDay,
  toDateKey,
} from '@/features/appointments/date-utils';

/** One treatment, reduced to what a calendar cell shows. */
export interface EncounterCalendarEntry {
  id: string;
  /** The day the cell belongs to, `YYYY-MM-DD`. */
  date: string;
  /** When it happened, as an instant — the booked hour where there is one. */
  time: string | null;
  patientName: string | null;
}

/** Treatments shown in one cell before the rest become a link to that day. */
const PER_DAY = 3;

/**
 * The treatment list drawn as a month.
 *
 * The same shape as the diary's month view, because it answers the same
 * question — "what happened that week" — and a practitioner should not have to
 * learn two calendars. It is deliberately a server component: every cell is a
 * link, nothing here needs state, and the list it replaces ships no client code
 * either.
 *
 * The count at the foot of a busy day links to that single day as a list rather
 * than opening a panel. It keeps the whole view linkable and reloadable, and it
 * lands on the view that can actually show six treatments with their status and
 * payment.
 */
export async function EncountersCalendar({
  from,
  to,
  entries,
}: {
  /** First day of the chosen span. */
  from: Date;
  /** Last day of the chosen span, inclusive. */
  to: Date;
  entries: EncounterCalendarEntry[];
}) {
  const t = await getTranslations('encounters');
  const tFilters = await getTranslations('filters');
  // "and {count} more" is the diary's wording for the same overflow; one term
  // for one thing, rather than a second key that drifts from it.
  const tApp = await getTranslations('appointments');
  const format = await getFormatter();

  const byDay = new Map<string, EncounterCalendarEntry[]>();
  for (const entry of entries) {
    const day = byDay.get(entry.date);
    if (day) day.push(entry);
    else byDay.set(entry.date, [entry]);
  }
  // Earliest first inside a day: the list is ordered newest-first for the table,
  // which upside down is not how a day is read.
  for (const day of byDay.values()) {
    day.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  }

  // Whole weeks, so the columns stay one weekday each; the padding days around
  // the chosen span are drawn muted.
  const days = rangeGridDays(from, to);
  const spanStart = startOfDay(from);
  const spanEnd = startOfDay(to);

  return (
    <section className="space-y-2">
      <p className="text-xs text-ink-600">
        <span dir="ltr">{formatDate(from)}</span>
        {' – '}
        <span dir="ltr">{formatDate(to)}</span>
      </p>

      <div className="overflow-x-auto rounded-card border border-ink-200 bg-white">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 border-b border-ink-200">
            {days.slice(0, 7).map((day) => (
              <div
                key={`head-${day.toISOString()}`}
                className="border-e border-ink-100 px-2 py-1.5 text-center text-xs font-medium text-ink-600 last:border-e-0"
              >
                {format.dateTime(day, { weekday: 'short' })}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = toDateKey(day);
              const dayEntries = byDay.get(key) ?? [];
              const today = isSameDay(day, new Date());
              const outside = day < spanStart || day > spanEnd;

              return (
                <div
                  key={key}
                  className={cn(
                    'min-h-24 border-b border-e border-ink-100 p-1 last:border-e-0',
                    outside && 'bg-ink-50/60',
                    today && 'bg-jade-50',
                  )}
                >
                  <span
                    className={cn(
                      'block px-1 text-sm font-medium tabular-nums',
                      today
                        ? 'font-semibold text-jade-800'
                        : outside
                          ? 'text-ink-500'
                          : 'text-ink-700',
                    )}
                  >
                    {format.dateTime(day, { day: 'numeric' })}
                  </span>

                  <ul className="mt-0.5 space-y-0.5">
                    {dayEntries.slice(0, PER_DAY).map((entry) => (
                      <li key={entry.id}>
                        <Link
                          href={`/encounters/${entry.id}`}
                          className="flex w-full items-baseline gap-1 rounded px-1 py-0.5 text-start text-xs hover:bg-ink-100"
                        >
                          {entry.time ? (
                            <span
                              dir="ltr"
                              className="shrink-0 font-medium tabular-nums text-ink-700"
                            >
                              {format.dateTime(new Date(entry.time), 'time')}
                            </span>
                          ) : null}
                          <span className="min-w-0 truncate text-ink-900">
                            {entry.patientName ?? t('single')}
                          </span>
                        </Link>
                      </li>
                    ))}
                    {dayEntries.length > PER_DAY ? (
                      <li>
                        <Link
                          href={`/encounters?from=${key}&to=${key}`}
                          className="block rounded px-1 py-0.5 text-xs text-ink-600 underline-offset-2 hover:bg-ink-100 hover:text-ink-900 hover:underline"
                        >
                          {tApp('moreInDay', { count: dayEntries.length - PER_DAY })}
                        </Link>
                      </li>
                    ) : null}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-ink-600">{tFilters('noneInRange')}</p>
      ) : null}
    </section>
  );
}
