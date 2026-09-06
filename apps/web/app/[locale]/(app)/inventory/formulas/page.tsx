import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { FlaskConical, Plus } from 'lucide-react';
import { Badge, Button, EmptyState, Table, TableWrapper, Td, Th, Tr } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type { HerbFormulaWithItems } from '@clinic/db/types';
import type { Locale } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { formulaPrimaryName, formulaSecondaryName } from '@/lib/display';
import { InventoryNav } from '@/features/inventory/inventory-nav';

export default async function FormulasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('inventory.formulas');
  const tCategory = await getTranslations('inventory.formulas.category');
  const tc = await getTranslations('common');
  const format = await getFormatter();

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data } = await scope.supabase
    .from('herb_formulas')
    .select('*, items:herb_formula_items(*, herb:herbs(id, pinyin_name, chinese_name, english_name, hebrew_name, default_unit))')
    .order('name_pinyin', { ascending: true })
    .limit(300)
    .returns<HerbFormulaWithItems[]>();

  const formulas = data ?? [];

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <Button asChild>
            <Link href="/inventory/formulas/new">
              <Plus className="h-4 w-4" />
              {t('new')}
            </Link>
          </Button>
        }
      />
      <InventoryNav />

      {formulas.length === 0 ? (
        <EmptyState
          icon={<FlaskConical className="h-8 w-8" />}
          title={t('empty')}
          description={t('emptyBody')}
          action={
            <Button asChild size="sm">
              <Link href="/inventory/formulas/new">{t('new')}</Link>
            </Button>
          }
        />
      ) : (
        <TableWrapper>
          <Table>
            <thead>
              <tr>
                <Th>{tc('name')}</Th>
                <Th>{t('fields.category')}</Th>
                <Th>{t('items')}</Th>
                <Th>{t('totalWeight')}</Th>
                <Th>{tc('status')}</Th>
              </tr>
            </thead>
            <tbody>
              {formulas.map((formula) => {
                const secondary = formulaSecondaryName(formula, locale as Locale);
                const total = formula.items.reduce((sum, item) => sum + Number(item.dosage), 0);
                return (
                  <Tr key={formula.id}>
                    <Td>
                      <Link
                        href={`/inventory/formulas/${formula.id}`}
                        className="font-medium text-jade-800 underline-offset-2 hover:underline"
                      >
                        {formulaPrimaryName(formula, locale as Locale)}
                      </Link>
                      {secondary ? (
                        <span className="block text-xs text-ink-500" dir="ltr">
                          {secondary}
                        </span>
                      ) : null}
                    </Td>
                    <Td>{tCategory(formula.category)}</Td>
                    <Td>
                      <span className="tabular-nums">{formula.items.length}</span>
                    </Td>
                    <Td>
                      <span dir="ltr" className="tabular-nums">
                        {format.number(total)}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={formula.is_active ? 'success' : 'muted'}>
                        {formula.is_active ? tc('active') : tc('inactive')}
                      </Badge>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrapper>
      )}
    </>
  );
}
