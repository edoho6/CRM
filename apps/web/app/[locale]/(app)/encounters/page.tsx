import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { ClipboardList } from 'lucide-react';
import { Badge, EmptyState, SortBody, SortTh, SortableTable, TableWrapper, Td, Tr } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type { Encounter, Patient } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';

type EncounterRow = Encounter & {
  patient: Pick<Patient, 'id' | 'full_name'> | null;
};

export default async function EncountersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('encounters');
  const tc = await getTranslations('common');
  const tPatients = await getTranslations('patients');
  const format = await getFormatter();

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data } = await scope.supabase
    .from('encounters')
    .select('*, patient:patients(id, full_name)')
    .order('encounter_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)
    .returns<EncounterRow[]>();

  const encounters = data ?? [];

  return (
    <>
      <PageHeader title={t('title')} />

      {encounters.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-8 w-8" />} title={t('empty')} />
      ) : (
        <TableWrapper>
          <SortableTable defaultSortKey="date" defaultSortDirection="desc">
            <thead>
              <tr>
                <SortTh sortKey="date">{tc('date')}</SortTh>
                <SortTh sortKey="patient">{tPatients('title')}</SortTh>
                <SortTh sortKey="status">{tc('status')}</SortTh>
              </tr>
            </thead>
            <SortBody locale={locale}>
              {encounters.map((encounter) => (
                <Tr
                  key={encounter.id}
                  sort={{
                    date: new Date(encounter.encounter_date).getTime(),
                    patient: encounter.patient?.full_name ?? null,
                    status: t(`status.${encounter.status}`),
                  }}
                >
                  <Td>
                    <Link
                      href={`/encounters/${encounter.id}`}
                      className="font-medium text-jade-800 underline-offset-2 hover:underline"
                      dir="ltr"
                    >
                      {format.dateTime(new Date(encounter.encounter_date), 'short')}
                    </Link>
                  </Td>
                  <Td>
                    {encounter.patient ? (
                      <Link
                        href={`/patients/${encounter.patient.id}`}
                        className="text-ink-800 underline-offset-2 hover:underline"
                      >
                        {encounter.patient.full_name}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td>
                    <Badge tone={encounter.status === 'signed' ? 'success' : 'warning'}>
                      {t(`status.${encounter.status}`)}
                    </Badge>
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
