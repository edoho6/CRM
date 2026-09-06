import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Truck } from 'lucide-react';
import { Badge, EmptyState, SortBody, SortTh, SortableTable, TableWrapper, Td, Tr } from '@clinic/ui';
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
          <SortableTable defaultSortKey="name">
            <thead>
              <tr>
                <SortTh sortKey="name">{tc('name')}</SortTh>
                <SortTh sortKey="contact">{t('contactName')}</SortTh>
                <SortTh sortKey="phone">{tPatients('phone')}</SortTh>
                <SortTh sortKey="email">{tPatients('email')}</SortTh>
                <SortTh sortKey="status">{tc('status')}</SortTh>
              </tr>
            </thead>
            <SortBody locale={locale}>
              {suppliers.map((supplier) => (
                <Tr
                  key={supplier.id}
                  sort={{
                    name: supplier.name,
                    contact: supplier.contact_name,
                    phone: supplier.phone,
                    email: supplier.email,
                    status: supplier.is_active ? 0 : 1,
                  }}
                >
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
            </SortBody>
          </SortableTable>
        </TableWrapper>
      )}
    </>
  );
}
