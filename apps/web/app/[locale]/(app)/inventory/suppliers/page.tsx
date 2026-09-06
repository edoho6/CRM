import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Truck } from 'lucide-react';
import { Badge, EmptyState, Table, TableWrapper, Td, Th, Tr } from '@clinic/ui';
import type { Supplier } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { InventoryNav } from '@/features/inventory/inventory-nav';
import { NewSupplierDialog } from '@/features/inventory/supplier-form';

export default async function SuppliersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('inventory.suppliers');
  const tPatients = await getTranslations('patients.fields');
  const tc = await getTranslations('common');

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data } = await scope.supabase
    .from('suppliers')
    .select('*')
    .order('name', { ascending: true })
    .returns<Supplier[]>();

  const suppliers = data ?? [];

  return (
    <>
      <PageHeader title={t('title')} actions={<NewSupplierDialog />} />
      <InventoryNav />

      {suppliers.length === 0 ? (
        <EmptyState icon={<Truck className="h-8 w-8" />} title={t('empty')} />
      ) : (
        <TableWrapper>
          <Table>
            <thead>
              <tr>
                <Th>{tc('name')}</Th>
                <Th>{t('contactName')}</Th>
                <Th>{tPatients('phone')}</Th>
                <Th>{tPatients('email')}</Th>
                <Th>{tc('status')}</Th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <Tr key={supplier.id}>
                  <Td className="font-medium text-ink-900">{supplier.name}</Td>
                  <Td>{supplier.contact_name ?? '—'}</Td>
                  <Td>
                    {supplier.phone ? (
                      <span dir="ltr" className="tabular-nums">
                        {supplier.phone}
                      </span>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td>
                    {supplier.email ? (
                      <span dir="ltr">{supplier.email}</span>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td>
                    <Badge tone={supplier.is_active ? 'success' : 'muted'}>
                      {supplier.is_active ? tc('active') : tc('inactive')}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>
      )}
    </>
  );
}
