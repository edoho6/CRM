import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CalendarX2, Plus, Users, X } from 'lucide-react';
import {
  Button,
  EmptyState,
  SortBody,
  SortTh,
  SortableTable,
  TableWrapper,
  Td,
  Th,
  Tr,
  cn,
  Dash,
} from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import { formatDate, formatTime, formatWeekday } from '@clinic/i18n';
import { TREATMENT_STATUSES, type TreatmentStatus } from '@clinic/domain';
import type { PatientTag, PatientWithDiary } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { SegmentedLinks } from '@/components/segmented-links';
import { PAGE_SIZE, Pagination, pageFrom, pageRange } from '@/components/pagination';
import { getClinicScope } from '@/lib/session';
import { ageFromDateOfBirth } from '@/lib/display';
import { PatientSearch } from '@/features/patients/patient-search';
import { PatientStatusCell } from '@/features/patients/status-cell';
import { PatientRowActions } from '@/features/patients/row-actions';
import { PhoneActions } from '@/components/phone-actions';
import { PatientStatusSummary, type StatusCounts } from '@/features/patients/status-summary';
import { TagChipLink, type TagChip } from '@/features/patients/patient-tags';
import { TAG_CLASSES } from '@/features/patients/tag-colors';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('patients', 'title');

type TagLinkRow = { patient_id: string; tag: TagChip | null };

/** A uuid no row has, so an empty "in" list matches nothing rather than everything. */
const NO_ROWS = '00000000-0000-0000-0000-000000000000';

export default async function PatientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    inactive?: string;
    status?: string;
    tag?: string;
    noUpcoming?: string;
    page?: string;
  }>;
}) {
  const { locale } = await params;
  const { q = '', inactive, status, tag, noUpcoming, page: pageParam } = await searchParams;
  const page = pageFrom(pageParam);
  setRequestLocale(locale);

  const t = await getTranslations('patients');
  const tc = await getTranslations('common');

  const scope = await getClinicScope();
  if (!scope) return null;

  // The view is the table plus what the diary knows: the next and the last
  // kept appointment. It reads under the same row rules, and it is what makes
  // "everyone with nothing booked" one filter rather than a fetch of every
  // appointment in the practice.
  let query = scope.supabase
    .from('patients_with_diary')
    // The count is of everything the filters match, so the header can say
    // "showing 200 of 1,340" instead of silently stopping at 200.
    .select('*', { count: 'exact' })
    .order('last_name', { ascending: true })
    .range(...pageRange(page));

  if (inactive !== '1') {
    query = query.eq('is_active', true);
  }

  if (noUpcoming === '1') {
    query = query.is('next_appointment_at', null);
  }

  // The outcome filter is separate from the active flag on purpose: "show me
  // everyone who stopped partway" is a question about people who are, by
  // definition, no longer active.
  if (status && (TREATMENT_STATUSES as readonly string[]).includes(status)) {
    query = query.eq('treatment_status', status);
  }

  // Everyone carrying one tag. The link rows are fetched first because a view
  // cannot be joined through PostgREST; a tag is on dozens of files, not
  // thousands, so the list of ids is short.
  let activeTag: TagChip | null = null;
  if (tag) {
    const [{ data: tagRow }, { data: links }] = await Promise.all([
      scope.supabase
        .from('patient_tags')
        .select('id, name, color')
        .eq('id', tag)
        .maybeSingle<TagChip>(),
      scope.supabase
        .from('patient_tag_links')
        .select('patient_id')
        .eq('tag_id', tag)
        .limit(5000)
        .returns<{ patient_id: string }[]>(),
    ]);
    activeTag = tagRow ?? null;
    const ids = (links ?? []).map((link) => link.patient_id);
    query = query.in('id', ids.length > 0 ? ids : [NO_ROWS]);
  }

  const term = q.trim();
  if (term) {
    // Matches on name, phone or email — whichever the front desk happens to have.
    const escaped = term.replace(/[%,()]/g, ' ');
    query = query.or(
      `full_name.ilike.%${escaped}%,phone.ilike.%${escaped}%,email.ilike.%${escaped}%`,
    );
  }

  const { data, count: matching } = await query.returns<PatientWithDiary[]>();
  const patients = data ?? [];

  /*
   * The counts are of the whole practice, not of the rows on screen.
   *
   * One query returning just the status column, counted here. Aggregating in the
   * database would be tidier, but PostgREST has no GROUP BY and adding an RPC
   * for a tally of a few thousand short strings is more machinery than the
   * problem deserves — and a count over the loaded page would be wrong in a way
   * nobody would notice until they filtered.
   */
  const [{ data: statusRows }, { count: noUpcomingCount }, { data: tagLinks }] = await Promise.all([
    scope.supabase
      .from('patients')
      .select('treatment_status')
      .limit(20_000)
      .returns<{ treatment_status: TreatmentStatus | null }[]>(),
    scope.supabase
      .from('patients_with_diary')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .is('next_appointment_at', null),
    // The tags of the people on screen, in one query rather than one per row.
    patients.length > 0
      ? scope.supabase
          .from('patient_tag_links')
          .select('patient_id, tag:patient_tags(id, name, color)')
          .in(
            'patient_id',
            patients.map((patient) => patient.id),
          )
          .returns<TagLinkRow[]>()
      : Promise.resolve({ data: [] as TagLinkRow[] }),
  ]);

  const tagsByPatient = new Map<string, TagChip[]>();
  for (const link of tagLinks ?? []) {
    if (!link.tag) continue;
    const list = tagsByPatient.get(link.patient_id) ?? [];
    list.push(link.tag);
    tagsByPatient.set(link.patient_id, list);
  }

  const byStatus = Object.fromEntries(TREATMENT_STATUSES.map((value) => [value, 0])) as Record<
    TreatmentStatus,
    number
  >;

  for (const row of statusRows ?? []) {
    const value = row.treatment_status ?? 'active';
    if (value in byStatus) byStatus[value] += 1;
  }

  const total = statusRows?.length ?? 0;
  // Only "in treatment" counts as active — finishing a course, successfully or
  // not, is not being in treatment.
  const activeCount = byStatus.active;

  const counts: StatusCounts = {
    byStatus,
    active: activeCount,
    inactive: total - activeCount,
    total,
    noUpcoming: noUpcomingCount ?? 0,
  };

  // The URL without one filter, for the chip that clears it.
  const without = (key: 'tag' | 'noUpcoming') => {
    const next: Record<string, string> = {};
    if (q) next.q = q;
    if (inactive === '1' && key !== 'tag') next.inactive = '1';
    if (status) next.status = status;
    if (tag && key !== 'tag') next.tag = tag;
    if (noUpcoming === '1' && key !== 'noUpcoming') next.noUpcoming = '1';
    return { pathname: '/patients' as const, query: next };
  };

  /*
   * The URL for one outcome, for the filter row.
   *
   * Anything but "in treatment" describes a file that is by definition no longer
   * active, so choosing one has to widen the list past the active-only default
   * or it comes back empty — the same rule the tiles apply, written once here
   * for the row that is now the plain way to reach it. The page number goes: a
   * different filter is a different list.
   */
  const statusHref = (value: TreatmentStatus | null) => {
    const next: Record<string, string> = {};
    if (q) next.q = q;
    if (tag) next.tag = tag;
    if (noUpcoming === '1') next.noUpcoming = '1';
    if (value) next.status = value;
    if ((value && value !== 'active') || (!value && inactive === '1')) next.inactive = '1';
    return { pathname: '/patients' as const, query: next };
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        description={
          matching && matching > patients.length
            ? `${t('count', { count: matching })} · ${tc('showingOf', { shown: patients.length, total: matching })}`
            : t('count', { count: patients.length })
        }
        actions={
          <Button asChild>
            <Link href="/patients/new">
              <Plus className="h-4 w-4" />
              {t('new')}
            </Link>
          </Button>
        }
      />

      <div className="mb-4 space-y-3">
        <PatientStatusSummary counts={counts} />
        <PatientSearch initialQuery={q} showInactive={inactive === '1'} />

        {/* Every outcome, as a filter you can find.
            The tiles above filter too, but a tile is a number that happens to
            be clickable — it is read as a statistic, and an outcome with nobody
            in it yet is not drawn at all, so "show me everyone who stopped
            partway" had no control anywhere on the page. This is the plain
            row: all of them, always, with their counts. */}
        <SegmentedLinks
          label={t('treatmentStatus')}
          size="sm"
          items={[
            {
              href: statusHref(null),
              label: tc('all'),
              active: !status,
              count: counts.total,
            },
            ...TREATMENT_STATUSES.map((value) => ({
              href: statusHref(value),
              label: t(`status.${value}`),
              active: status === value,
              count: counts.byStatus[value] ?? 0,
            })),
          ]}
        />

        {/* The one filter that is not a status: "nothing booked" is a fact
            about the diary, and it combines with any outcome. */}
        <SegmentedLinks
          label={t('noUpcomingFilter')}
          size="sm"
          items={[
            {
              href:
                noUpcoming === '1'
                  ? without('noUpcoming')
                  : {
                      pathname: '/patients',
                      query: { ...without('noUpcoming').query, noUpcoming: '1' },
                    },
              label: t('noUpcomingFilter'),
              active: noUpcoming === '1',
              icon: <CalendarX2 className="h-3.5 w-3.5" aria-hidden />,
            },
          ]}
        />

        {activeTag ? (
          <p className="flex flex-wrap items-center gap-2 text-sm text-ink-700">
            {t('tags.filterBy')}
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                TAG_CLASSES[activeTag.color],
              )}
              dir="auto"
            >
              {activeTag.name}
            </span>
            <Link
              href={without('tag')}
              className="inline-flex items-center gap-1 text-xs text-ink-600 underline-offset-2 hover:underline"
            >
              <X className="h-3 w-3" aria-hidden />
              {t('tags.clearFilter')}
            </Link>
          </p>
        ) : null}
      </div>

      {patients.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title={term ? tc('noResults') : t('empty')}
          description={term || tag || noUpcoming ? undefined : t('emptyBody')}
          action={
            term || tag || noUpcoming ? null : (
              <Button asChild size="sm">
                <Link href="/patients/new">{t('new')}</Link>
              </Button>
            )
          }
        />
      ) : (
        <TableWrapper responsive>
          <SortableTable defaultSortKey="name" sortDisabled={(matching ?? 0) > PAGE_SIZE}>
            <thead>
              <tr>
                <SortTh sortKey="name">{t('fields.fullName')}</SortTh>
                <SortTh sortKey="phone">{t('fields.phone')}</SortTh>
                <SortTh sortKey="age">{t('age')}</SortTh>
                <SortTh sortKey="next">{t('nextAppointment')}</SortTh>
                <SortTh sortKey="tags">{t('tags.column')}</SortTh>
                <SortTh sortKey="status">{t('treatmentStatus')}</SortTh>
                <Th className="w-10 text-end">
                  <span className="sr-only">{tc('actions')}</span>
                </Th>
              </tr>
            </thead>
            <SortBody locale={locale}>
              {patients.map((patient) => {
                const age = ageFromDateOfBirth(patient.date_of_birth);
                const patientTags = tagsByPatient.get(patient.id) ?? [];
                return (
                  <Tr
                    key={patient.id}
                    sort={{
                      name: patient.full_name,
                      phone: patient.phone,
                      age,
                      tags: patientTags.map((entry) => entry.name).join(' ') || null,
                      next: patient.next_appointment_at
                        ? new Date(patient.next_appointment_at).getTime()
                        : null,
                      // Sorted by label rather than by the enum's order, so the
                      // column sorts the way it reads.
                      status: t(`status.${patient.treatment_status ?? 'active'}`),
                    }}
                  >
                    <Td data-card-title>
                      <Link
                        href={`/patients/${patient.id}`}
                        className="font-medium text-jade-800 underline-offset-2 hover:underline"
                      >
                        {patient.full_name}
                      </Link>
                    </Td>
                    <Td>
                      {/* Same control as the file and the diary: on a desk a
                          `tel:` link usually does nothing, and the thing
                          wanted is almost always the WhatsApp. */}
                      {patient.phone ? <PhoneActions phone={patient.phone} /> : <Dash />}
                    </Td>
                    <Td>{age === null ? <Dash /> : age}</Td>
                    <Td>
                      {/* Day, then date, then time, each its own run. As one
                          string the weekday ran into the date and the date into
                          the hour, and three fields read as one long number. */}
                      {patient.next_appointment_at ? (
                        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-ink-700">
                            {formatWeekday(patient.next_appointment_at, locale)}
                          </span>
                          <span dir="ltr" className="tabular-nums">
                            {formatDate(patient.next_appointment_at)}
                          </span>
                          <span dir="ltr" className="font-medium tabular-nums text-ink-900">
                            {formatTime(patient.next_appointment_at)}
                          </span>
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'text-ink-500',
                            patient.is_active && 'text-amber-800',
                          )}
                          title={patient.is_active ? t('noUpcomingHint') : undefined}
                        >
                          —
                        </span>
                      )}
                    </Td>
                    <Td>
                      {patientTags.length > 0 ? (
                        <span className="flex flex-wrap gap-1">
                          {patientTags.map((entry) => (
                            <TagChipLink key={entry.id} tag={entry} />
                          ))}
                        </span>
                      ) : (
                        <Dash />
                      )}
                    </Td>
                    <Td>
                      {/* Editable in place: marking a course finished is a
                          five-second thought, and making it cost a page load,
                          an edit form and a trip back is how a list fills up
                          with people who stopped coming two years ago. */}
                      <PatientStatusCell
                        patientId={patient.id}
                        status={patient.treatment_status ?? null}
                      />
                    </Td>
                    <Td className="text-end">
                      <PatientRowActions patientId={patient.id} name={patient.full_name} phone={patient.phone} />
                    </Td>
                  </Tr>
                );
              })}
            </SortBody>
          </SortableTable>
        </TableWrapper>
      )}
      <Pagination
        page={page}
        total={matching ?? null}
        shown={patients.length}
        pathname="/patients"
        query={{ q: q || undefined, inactive, status, tag, noUpcoming }}
      />
    </>
  );
}
