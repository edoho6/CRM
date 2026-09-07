import { getTranslations, setRequestLocale } from 'next-intl/server';
import { UserPlus, Users } from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  SortBody,
  SortTh,
  SortableTable,
  TableWrapper,
  Td,
  Tr,
} from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type { Patient } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { ageFromDateOfBirth } from '@/lib/display';
import { PatientSearch } from '@/features/patients/patient-search';

export default async function PatientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; inactive?: string }>;
}) {
  const { locale } = await params;
  const { q = '', inactive } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('patients');
  const tc = await getTranslations('common');

  const scope = await getClinicScope();
  if (!scope) return null;

  let query = scope.supabase
    .from('patients')
    .select('*')
    .order('last_name', { ascending: true })
    .limit(200);

  if (inactive !== '1') {
    query = query.eq('is_active', true);
  }

  const term = q.trim();
  if (term) {
    // Matches on name, phone or email — whichever the front desk happens to have.
    const escaped = term.replace(/[%,()]/g, ' ');
    query = query.or(
      `full_name.ilike.%${escaped}%,phone.ilike.%${escaped}%,email.ilike.%${escaped}%`,
    );
  }

  const { data } = await query.returns<Patient[]>();
  const patients = data ?? [];

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('count', { count: patients.length })}
        actions={
          <Button asChild>
            <Link href="/patients/new">
              <UserPlus className="h-4 w-4" />
              {t('new')}
            </Link>
          </Button>
        }
      />

      <div className="mb-4">
        <PatientSearch initialQuery={q} showInactive={inactive === '1'} />
      </div>

      {patients.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title={term ? tc('noResults') : t('empty')}
          description={term ? undefined : t('emptyBody')}
          action={
            term ? null : (
              <Button asChild size="sm">
                <Link href="/patients/new">{t('new')}</Link>
              </Button>
            )
          }
        />
      ) : (
        <TableWrapper>
          <SortableTable defaultSortKey="name">
            <thead>
              <tr>
                <SortTh sortKey="name">{t('fields.fullName')}</SortTh>
                <SortTh sortKey="phone">{t('fields.phone')}</SortTh>
                <SortTh sortKey="age">{t('age')}</SortTh>
                <SortTh sortKey="city">{t('fields.city')}</SortTh>
                <SortTh sortKey="status">{tc('status')}</SortTh>
              </tr>
            </thead>
            <SortBody locale={locale}>
              {patients.map((patient) => {
                const age = ageFromDateOfBirth(patient.date_of_birth);
                return (
                  <Tr
                    key={patient.id}
                    sort={{
                      name: patient.full_name,
                      phone: patient.phone,
                      age,
                      city: patient.city,
                      status: patient.is_active ? 0 : 1,
                    }}
                  >
                    <Td>
                      <Link
                        href={`/patients/${patient.id}`}
                        className="font-medium text-jade-800 underline-offset-2 hover:underline"
                      >
                        {patient.full_name}
                      </Link>
                    </Td>
                    <Td>
                      {patient.phone ? (
                        <span dir="ltr" className="tabular-nums">
                          {patient.phone}
                        </span>
                      ) : (
                        <span className="text-ink-500">—</span>
                      )}
                    </Td>
                    <Td>{age === null ? <span className="text-ink-500">—</span> : age}</Td>
                    <Td>{patient.city ?? <span className="text-ink-500">—</span>}</Td>
                    <Td>
                      <Badge tone={patient.is_active ? 'success' : 'muted'}>
                        {patient.is_active ? tc('active') : tc('inactive')}
                      </Badge>
                    </Td>
                  </Tr>
                );
              })}
            </SortBody>
          </SortableTable>
        </TableWrapper>
      )}
    </>
  );
}
