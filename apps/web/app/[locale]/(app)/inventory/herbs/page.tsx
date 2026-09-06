import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Plus, Sprout } from 'lucide-react';
import { Badge, Button, EmptyState, Table, TableWrapper, Td, Th, Tr } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type { Herb } from '@clinic/db/types';
import type { Locale } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { herbPrimaryName, herbSecondaryName } from '@/lib/display';
import { InventoryNav } from '@/features/inventory/inventory-nav';
import { HerbSearch } from '@/features/inventory/herb-search';

export default async function HerbsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q = '' } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('inventory.herbs');
  const tCategory = await getTranslations('inventory.category');
  const tUnit = await getTranslations('inventory.unit');
  const tc = await getTranslations('common');

  const scope = await getClinicScope();
  if (!scope) return null;

  let query = scope.supabase
    .from('herbs')
    .select('*')
    .order('pinyin_name', { ascending: true })
    .limit(500);

  const term = q.trim();
  if (term) {
    const escaped = term.replace(/[%,()]/g, ' ');
    query = query.or(
      `pinyin_name.ilike.%${escaped}%,chinese_name.ilike.%${escaped}%,english_name.ilike.%${escaped}%,hebrew_name.ilike.%${escaped}%`,
    );
  }

  const { data } = await query.returns<Herb[]>();
  const herbs = data ?? [];

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <Button asChild>
            <Link href="/inventory/herbs/new">
              <Plus className="h-4 w-4" />
              {t('new')}
            </Link>
          </Button>
        }
      />
      <InventoryNav />

      <div className="mb-4">
        <HerbSearch initialQuery={q} />
      </div>

      {herbs.length === 0 ? (
        <EmptyState
          icon={<Sprout className="h-8 w-8" />}
          title={term ? tc('noResults') : t('empty')}
          description={term ? undefined : t('emptyBody')}
        />
      ) : (
        <TableWrapper>
          <Table>
            <thead>
              <tr>
                <Th>{tc('name')}</Th>
                <Th>{t('fields.category')}</Th>
                <Th>{t('fields.defaultUnit')}</Th>
                <Th>{tc('status')}</Th>
              </tr>
            </thead>
            <tbody>
              {herbs.map((herb) => {
                const secondary = herbSecondaryName(herb, locale as Locale);
                return (
                  <Tr key={herb.id}>
                    <Td>
                      <Link
                        href={`/inventory/herbs/${herb.id}`}
                        className="font-medium text-jade-800 underline-offset-2 hover:underline"
                      >
                        {herbPrimaryName(herb, locale as Locale)}
                      </Link>
                      {secondary ? (
                        <span className="block text-xs text-ink-500" dir="ltr">
                          {secondary}
                        </span>
                      ) : null}
                    </Td>
                    <Td>{tCategory(herb.category)}</Td>
                    <Td>{tUnit(herb.default_unit)}</Td>
                    <Td>
                      <Badge tone={herb.is_active ? 'success' : 'muted'}>
                        {herb.is_active ? tc('active') : tc('inactive')}
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
