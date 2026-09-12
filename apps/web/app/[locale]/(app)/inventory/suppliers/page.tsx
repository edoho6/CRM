import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Truck } from 'lucide-react';
import {
  Dash,
  Badge,
  EmptyState,
  SortBody,
  SortTh,
  SortableTable,
  TableWrapper,
  Td,
  Tr,
} from '@clinic/ui';
import { switchTone } from '@clinic/domain';
import type { Supplier } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { Pagination, pageFrom, pageRange } from '@/components/pagination';
import { getClinicScope } from '@/lib/session';
import { InventoryNav } from '@/features/inventory/inventory-nav';
import { NewSupplierDialog } from '@/features/inventory/supplier-form';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('inventory.suppliers', 'title');

export default async function SuppliersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  const { page: pageParam } = await searchParams;
  const page = pageFrom(pageParam);
  setRequestLocale(locale);

  const t = await getTranslations('inventory.suppliers');
  const tPatients = await getTranslations('patients.fields');
  const tc = await getTranslations('common');

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data, count } = await scope.supabase
    .from('suppliers')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .range(...pageRange(page))
    .returns<Supplier[]>();

  const suppliers = data ?? [];

  return (
    <>
      <PageHeader title={t('title')} actions={<NewSupplierDialog />} below={<InventoryNav />} />

      {suppliers.length === 0 ? (
        <EmptyState
          icon={<Truck className="h-8 w-8" />}
          title={t('empty')}
          action={<NewSupplierDialog />}
        />
      ) : (
        <TableWrapper responsive>
          <SortableTable defaultSortKey="name">
            <thead>
              <tr>
                <SortTh sortKey="name">{tc('name')}</SortTh>
                <SortTh sortKey="contact">{t('contactName')}</SortTh>
                <SortTh sortKey="phone">{tPatients('phone')}</SortTh>
                <SortTh sortKey="email">{tPatients('email')}</SortTh>
                <SortTh sortKey="terms">{t('paymentTerms')}</SortTh>
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
                    terms: supplier.payment_terms ?? null,
                    status: supplier.is_active ? 0 : 1,
                  }}
                >
                  <Td data-card-title className="font-medium text-ink-900">{supplier.name}</Td>
                  <Td>{supplier.contact_name ?? <Dash />}</Td>
                  <Td>
                    {supplier.phone ? (
                      <span dir="ltr" className="tabular-nums">
                        {supplier.phone}
                      </span>
                    ) : (
                      <Dash />
                    )}
                  </Td>
                  <Td>{supplier.email ? <span dir="ltr">{supplier.email}</span> : <Dash />}</Td>
                  <Td>{supplier.payment_terms ? supplier.payment_terms : <Dash />}</Td>
                  <Td>
                    <Badge tone={switchTone(supplier.is_active)}>
                      {supplier.is_active ? tc('active') : tc('inactive')}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </SortBody>
          </SortableTable>
        </TableWrapper>
      )}
      <Pagination page={page} total={count ?? null} shown={suppliers.length} pathname="/inventory/suppliers" query={{}} />
    </>
  );
}
