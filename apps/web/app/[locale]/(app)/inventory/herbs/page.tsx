import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Plus, Sprout } from 'lucide-react';
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
import type { Herb } from '@clinic/db/types';
import { TEMPERATURES, type Locale } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { TcmChip, TcmChips } from '@/components/tcm-chip';
import { getClinicScope } from '@/lib/session';
import { herbBotanicalName, herbChineseName, herbPrimaryName } from '@/lib/display';
import { InventoryNav } from '@/features/inventory/inventory-nav';
import { HerbSearch } from '@/features/inventory/herb-search';
import { HerbFilters } from '@/features/inventory/herb-filters';
import { parseHerbFilters, type HerbSearchParams } from '@/features/inventory/herb-filter-params';

export default async function HerbsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<HerbSearchParams>;
}) {
  const { locale } = await params;
  const filters = parseHerbFilters(await searchParams);
  setRequestLocale(locale);

  const t = await getTranslations('inventory.herbs');
  const tCategory = await getTranslations('inventory.category');
  const tUnit = await getTranslations('inventory.unit');
  const tTcm = await getTranslations('inventory.tcmCategory');
  const tTemp = await getTranslations('inventory.temperature');
  const tTaste = await getTranslations('inventory.taste');
  const tReview = await getTranslations('inventory.review');
  const tc = await getTranslations('common');
  const format = await getFormatter();

  const scope = await getClinicScope();
  if (!scope) return null;

  let query = scope.supabase
    .from('herbs')
    .select('*')
    .order('pinyin_name', { ascending: true })
    .limit(2000);

  if (filters.q) {
    const escaped = filters.q.replace(/[%,()]/g, ' ');
    query = query.or(
      `pinyin_name.ilike.%${escaped}%,chinese_name.ilike.%${escaped}%,english_name.ilike.%${escaped}%,hebrew_name.ilike.%${escaped}%,botanical_name.ilike.%${escaped}%`,
    );
  }
  // Values within a facet are alternatives; the facets themselves narrow.
  if (filters.cat.length) query = query.in('tcm_category', filters.cat);
  if (filters.temp.length) query = query.in('temperature', filters.temp);
  if (filters.taste.length) query = query.overlaps('tastes', filters.taste);
  if (filters.chan.length) query = query.overlaps('channels', filters.chan);
  if (filters.review) query = query.eq('needs_review', true);

  const { data } = await query.returns<Herb[]>();
  const herbs = data ?? [];

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('count', { count: herbs.length })}
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

      <div className="mb-4 space-y-3">
        <HerbSearch initialQuery={filters.q} />
        <HerbFilters filters={filters} />
      </div>

      {herbs.length === 0 ? (
        <EmptyState
          icon={<Sprout className="h-8 w-8" />}
          title={filters.q ? tc('noResults') : t('empty')}
          description={filters.q ? undefined : t('emptyBody')}
        />
      ) : (
        <TableWrapper>
          <SortableTable defaultSortKey="name">
            <thead>
              <tr>
                <SortTh sortKey="name">{tc('name')}</SortTh>
                <SortTh sortKey="cat">{t('fields.tcmCategory')}</SortTh>
                <SortTh sortKey="temp">{t('fields.temperature')}</SortTh>
                <SortTh sortKey="taste">{t('fields.tastes')}</SortTh>
                <SortTh sortKey="dose">{t('fields.dosageRange')}</SortTh>
                <SortTh sortKey="status">{tc('status')}</SortTh>
              </tr>
            </thead>
            <SortBody locale={locale}>
              {herbs.map((herb) => {
                const chinese = herbChineseName(herb);
                const botanical = herbBotanicalName(herb);
                const tastes = herb.tastes ?? [];
                const dose =
                  herb.dosage_min_g !== null || herb.dosage_max_g !== null
                    ? `${herb.dosage_min_g !== null ? format.number(Number(herb.dosage_min_g)) : '?'}–${
                        herb.dosage_max_g !== null ? format.number(Number(herb.dosage_max_g)) : '?'
                      } g`
                    : null;
                return (
                  <Tr
                    key={herb.id}
                    sort={{
                      name: herbPrimaryName(herb, locale as Locale),
                      cat: herb.tcm_category ? tTcm(herb.tcm_category) : null,
                      // Sorted by how hot it is, not by how the word is spelled.
                      temp: herb.temperature ? TEMPERATURES.indexOf(herb.temperature) : null,
                      taste: tastes.map((value) => tTaste(value)).join(' '),
                      dose: herb.dosage_min_g === null ? null : Number(herb.dosage_min_g),
                      status: herb.needs_review ? 2 : herb.is_active ? 0 : 1,
                    }}
                  >
                    <Td>
                      <div className="flex items-start gap-3">
                        {herb.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={herb.image_url}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-lg border border-ink-100 object-cover"
                          />
                        ) : (
                          <span
                            aria-hidden
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-jade-50 text-jade-300"
                          >
                            <Sprout className="h-5 w-5" />
                          </span>
                        )}
                        <div className="min-w-0">
                          {/* Pinyin leads at full size with the Chinese characters
                              beside it; the botanical binomial gets its own line,
                              because it answers a different question. */}
                          <Link
                            href={`/inventory/herbs/${herb.id}`}
                            className="flex items-baseline gap-2 underline-offset-2 hover:underline"
                          >
                            <span className="text-base font-semibold text-jade-800">
                              {herbPrimaryName(herb, locale as Locale)}
                            </span>
                            {chinese ? <span className="text-base text-ink-600">{chinese}</span> : null}
                          </Link>
                          {botanical ? (
                            <span className="mt-0.5 block text-xs text-ink-500 italic" dir="ltr">
                              {botanical}
                            </span>
                          ) : null}
                          {herb.english_name ? (
                            <span className="block text-xs text-ink-400" dir="ltr">
                              {herb.english_name}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </Td>
                    <Td>
                      {herb.tcm_category ? (
                        <TcmChip scale="tcmCategory" value={herb.tcm_category}>
                          {tTcm(herb.tcm_category)}
                        </TcmChip>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </Td>
                    <Td>
                      {herb.temperature ? (
                        <TcmChip scale="temperature" value={herb.temperature}>
                          {tTemp(herb.temperature)}
                        </TcmChip>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </Td>
                    <Td>
                      <TcmChips scale="taste" values={tastes} render={(value) => tTaste(value as never)} size="sm" />
                    </Td>
                    <Td>
                      {dose ? (
                        <span dir="ltr" className="text-sm font-semibold tabular-nums text-ink-800">
                          {dose}
                        </span>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                      <span className="block text-xs text-ink-400">{tCategory(herb.category)}</span>
                    </Td>
                    <Td>
                      <span className="flex flex-wrap gap-1">
                        <Badge tone={herb.is_active ? 'success' : 'muted'}>
                          {herb.is_active ? tc('active') : tc('inactive')}
                        </Badge>
                        {herb.needs_review ? <Badge tone="warning">{tReview('badge')}</Badge> : null}
                      </span>
                      <span className="sr-only">{tUnit(herb.default_unit)}</span>
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
