import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageBody } from '@clinic/ui';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { NewInvoicePicker } from '@/features/billing/new-invoice-picker';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('billing', 'newPicker.title');

/**
 * "New invoice" from the billing page and the quick-create menu: pick whose,
 * then go. Invoices that follow a treatment are created from the treatment
 * itself and never pass through here.
 */
export default async function NewInvoicePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('billing');

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data: patients } = await scope.supabase
    .from('patients')
    .select('id, full_name, phone')
    .eq('is_active', true)
    .order('last_name', { ascending: true })
    .limit(2000)
    .returns<{ id: string; full_name: string; phone: string | null }[]>();

  return (
    <>
      <PageHeader title={t('newPicker.title')} description={t('newPicker.subtitle')} />
      <PageBody width="narrow">
        <NewInvoicePicker patients={patients ?? []} />
      </PageBody>
    </>
  );
}
