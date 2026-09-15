import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PageBody } from '@clinic/ui';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { SettingsNav } from '@/features/settings/settings-nav';
import { ClinicSettingsForm } from '@/features/settings/clinic-settings-form';
import { ReferenceCatalogueCard, type CatalogueCounts } from '@/features/settings/reference-catalogue-card';
import { pageTitle } from '@/lib/page-title';

export const generateMetadata = pageTitle('settings', 'title');

/** A row count and nothing else; null when the table is not there to count. */
async function countRows(supabase: SupabaseClient, table: string): Promise<number | null> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) return null;
  return count ?? 0;
}

/**
 * What the shared catalogue holds against what this clinic holds. The
 * catalogue tables arrive with migration 56; before it they do not exist,
 * the counts come back null, and the card says the catalogue is not
 * installed rather than the page failing.
 */
async function loadCatalogueCounts(supabase: SupabaseClient): Promise<CatalogueCounts> {
  const [cHerbs, cFormulas, cPoints, herbs, formulas, points] = await Promise.all([
    countRows(supabase, 'catalogue_herbs'),
    countRows(supabase, 'catalogue_formulas'),
    countRows(supabase, 'catalogue_points'),
    countRows(supabase, 'herbs'),
    countRows(supabase, 'herb_formulas'),
    countRows(supabase, 'acupuncture_points'),
  ]);
  return {
    catalogue:
      cHerbs === null || cFormulas === null || cPoints === null
        ? null
        : { herbs: cHerbs, formulas: cFormulas, points: cPoints },
    clinic: { herbs: herbs ?? 0, formulas: formulas ?? 0, points: points ?? 0 },
  };
}

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('settings');

  const scope = await getClinicScope();
  if (!scope) return null;

  const counts = await loadCatalogueCounts(scope.supabase);

  return (
    <>
      <PageHeader title={t('title')} description={t('subtitle')} below={<SettingsNav />} />
      <PageBody width="narrow">
        {/* The reminder's wording moved to the Messages tab, with everything
            else the clinic sends on its own. */}
        <ClinicSettingsForm
          name={scope.context.clinic.name}
          tracksInventory={scope.context.clinic.tracks_inventory !== false}
        />
        <div className="mt-6">
          <ReferenceCatalogueCard counts={counts} />
        </div>
      </PageBody>
    </>
  );
}
