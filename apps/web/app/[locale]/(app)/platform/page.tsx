import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Building2 } from 'lucide-react';
import { Badge, EmptyState, SortBody, SortTh, SortableTable, TableWrapper, Td, Tr, Dash } from '@clinic/ui';
import { formatDate, formatDateTime } from '@clinic/i18n';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';

interface PlatformClinicRow {
  id: string;
  name: string;
  created_at: string;
  is_synthetic: boolean;
  owner_email: string | null;
  members: number;
  patients: number;
  appointments_30d: number;
  last_booking_at: string | null;
}

/**
 * Every clinic on the service, for whoever runs it.
 *
 * Counts, never contents: this page answers "who is using it and how much",
 * and nothing on it is a patient's. The function behind it returns nothing
 * at all for anyone not on the platform list, and the page itself is a 404
 * for them — not a locked door, a door that is not there.
 */
export default async function PlatformPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const scope = await getClinicScope();
  if (!scope) return null;
  if (!scope.context.isPlatformAdmin) notFound();

  const t = await getTranslations('platform');
  const tc = await getTranslations('common');

  const { data } = await scope.supabase.rpc('platform_clinics');
  const rows = (Array.isArray(data) ? data : []) as PlatformClinicRow[];

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle', { count: rows.length })} />

      {rows.length === 0 ? (
        <EmptyState icon={<Building2 className="h-8 w-8" />} title={t('empty')} />
      ) : (
        <TableWrapper>
          <SortableTable defaultSortKey="created" defaultSortDirection="desc">
            <thead>
              <tr>
                <SortTh sortKey="name">{tc('name')}</SortTh>
                <SortTh sortKey="owner">{t('owner')}</SortTh>
                <SortTh sortKey="created">{t('joined')}</SortTh>
                <SortTh sortKey="members">{t('members')}</SortTh>
                <SortTh sortKey="patients">{t('patients')}</SortTh>
                <SortTh sortKey="appointments">{t('appointments30d')}</SortTh>
                <SortTh sortKey="last">{t('lastBooking')}</SortTh>
              </tr>
            </thead>
            <SortBody locale={locale}>
              {rows.map((row) => (
                <Tr
                  key={row.id}
                  sort={{
                    name: row.name,
                    owner: row.owner_email,
                    created: new Date(row.created_at).getTime(),
                    members: row.members,
                    patients: row.patients,
                    appointments: row.appointments_30d,
                    last: row.last_booking_at ? new Date(row.last_booking_at).getTime() : null,
                  }}
                >
                  <Td>
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-ink-900" dir="auto">
                        {row.name}
                      </span>
                      {row.is_synthetic ? <Badge tone="warning">{t('synthetic')}</Badge> : null}
                    </span>
                  </Td>
                  <Td>
                    {row.owner_email ? (
                      <span dir="ltr">{row.owner_email}</span>
                    ) : (
                      <Dash />
                    )}
                  </Td>
                  <Td>
                    <span dir="ltr">{formatDate(row.created_at)}</span>
                  </Td>
                  <Td className="tabular-nums">{row.members}</Td>
                  <Td className="tabular-nums">{row.patients}</Td>
                  <Td className="tabular-nums">{row.appointments_30d}</Td>
                  <Td>
                    {row.last_booking_at ? (
                      <span dir="ltr">{formatDateTime(row.last_booking_at)}</span>
                    ) : (
                      <Dash />
                    )}
                  </Td>
                </Tr>
              ))}
            </SortBody>
          </SortableTable>
        </TableWrapper>
      )}
    </>
  );
}
