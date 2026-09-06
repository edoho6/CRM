import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Plus, Sprout } from 'lucide-react';
import { Badge, Button, EmptyState, Table, TableWrapper, Td, Th, Tr } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type { Herb } from '@clinic/db/types';
import { TCM_CATEGORIES, type Locale } from '@clinic/domain';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { herbBotanicalName, herbChineseName, herbPrimaryName } from '@/lib/display';
import { InventoryNav } from '@/features/inventory/inventory-nav';
import { HerbSearch } from '@/features/inventory/herb-search';

export default async function HerbsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; cat?: string; review?: string }>;
}) {
  const { locale } = await params;
  const { q = '', cat = '', review } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('inventory.herbs');
  const tCategory = await getTranslations('inventory.category');
  const tUnit = await getTranslations('inventory.unit');
  const tTcm = await getTranslations('inventory.tcmCategory');
  const tReview = await getTranslations('inventory.review');
  const tc = await getTranslations('common');

  const scope = await getClinicScope();
  if (!scope) return null;

  let query = scope.supabase
    .from('herbs')
    .select('*')
    .order('pinyin_name', { ascending: true })
    .limit(1000);

  const term = q.trim();
  if (term) {
    const escaped = term.replace(/[%,()]/g, ' ');
    query = query.or(
      `pinyin_name.ilike.%${escaped}%,chinese_name.ilike.%${escaped}%,english_name.ilike.%${escaped}%,hebrew_name.ilike.%${escaped}%,botanical_name.ilike.%${escaped}%`,
    );
  }
  if (cat && (TCM_CATEGORIES as readonly string[]).includes(cat)) {
    query = query.eq('tcm_category', cat);
  }
  if (review === '1') {
    query = query.eq('needs_review', true);
  }

  const { data } = await query.returns<Herb[]>();
  const herbs = data ?? [];
  const reviewCount = herbs.filter((herb) => herb.needs_review).length;

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

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <HerbSearch initialQuery={q} />
        {/* Plain GET form: the filter is a URL, so it can be bookmarked and shared. */}
        <form method="get" className="flex flex-wrap items-center gap-2">
          {term ? <input type="hidden" name="q" value={term} /> : null}
          <select
            name="cat"
            defaultValue={cat}
            className="h-10 cursor-pointer rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-800 shadow-xs"
          >
            <option value="">{t('filters.allCategories')}</option>
            {TCM_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {tTcm(value)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-ink-600">
            <input type="checkbox" name="review" value="1" defaultChecked={review === '1'} className="h-4 w-4 accent-jade-600" />
            {t('filters.needsReview')}
          </label>
          <Button type="submit" variant="secondary" size="sm">
            {tc('filter')}
          </Button>
        </form>
        {reviewCount > 0 ? (
          <span className="text-xs text-amber-700">{tReview('countHint', { count: reviewCount })}</span>
        ) : null}
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
                <Th>{t('fields.tcmCategory')}</Th>
                <Th>{t('fields.category')}</Th>
                <Th>{tc('status')}</Th>
              </tr>
            </thead>
            <tbody>
              {herbs.map((herb) => {
                const chinese = herbChineseName(herb);
                const botanical = herbBotanicalName(herb);
                return (
                  <Tr key={herb.id}>
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
                        {chinese ? (
                          <span className="text-base text-ink-600">{chinese}</span>
                        ) : null}
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
                    <Td>{herb.tcm_category ? tTcm(herb.tcm_category) : <span className="text-ink-400">—</span>}</Td>
                    <Td>
                      <span className="text-ink-700">{tCategory(herb.category)}</span>
                      <span className="block text-xs text-ink-400">{tUnit(herb.default_unit)}</span>
                    </Td>
                    <Td>
                      <span className="flex flex-wrap gap-1">
                        <Badge tone={herb.is_active ? 'success' : 'muted'}>
                          {herb.is_active ? tc('active') : tc('inactive')}
                        </Badge>
                        {herb.needs_review ? <Badge tone="warning">{tReview('badge')}</Badge> : null}
                      </span>
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
