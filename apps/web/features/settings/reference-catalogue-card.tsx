'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { BookOpen } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Spinner,
  useToast,
} from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import {
  loadReferenceCatalogue,
  refreshReferenceCatalogueText,
  type CatalogueLoadResult,
} from '@/features/reference/catalogue-actions';

export interface CatalogueCounts {
  /** Rows in the shared catalogue; null when the catalogue is not installed yet. */
  catalogue: { herbs: number; formulas: number; points: number } | null;
  /** What this clinic holds today. */
  clinic: { herbs: number; formulas: number; points: number };
}

/**
 * The button that fills a clinic's reference lists from the shared
 * catalogue. It shows the two numbers side by side — what the service has,
 * what this clinic has — because the whole question the card answers is
 * "is anything missing here?".
 */
export function ReferenceCatalogueCard({ counts }: { counts: CatalogueCounts }) {
  const t = useTranslations('settings.catalogue');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [result, setResult] = useState<CatalogueLoadResult | null>(null);

  const installed = counts.catalogue !== null;
  const empty =
    installed &&
    counts.catalogue!.herbs + counts.catalogue!.formulas + counts.catalogue!.points === 0;
  const complete =
    installed &&
    !empty &&
    counts.clinic.herbs >= counts.catalogue!.herbs &&
    counts.clinic.formulas >= counts.catalogue!.formulas &&
    counts.clinic.points >= counts.catalogue!.points;

  const load = () =>
    startTransition(async () => {
      const outcome = await loadReferenceCatalogue();
      if (!outcome.ok) {
        toast({ tone: 'danger', title: tc('errorGeneric') });
        return;
      }
      setResult(outcome.data);
      const added =
        outcome.data.herbs_added + outcome.data.formulas_added + outcome.data.points_added;
      toast({
        tone: 'success',
        title: added > 0 ? t('loaded', { count: added }) : t('nothingToAdd'),
      });
      router.refresh();
    });

  // The facts-based text (migration 57): every entry nobody approved follows the catalogue.
  const refresh = () => {
    setIsRefreshing(true);
    startTransition(async () => {
      try {
        const outcome = await refreshReferenceCatalogueText();
        if (!outcome.ok) {
          toast({ tone: 'danger', title: tc('errorGeneric') });
          return;
        }
        setResult(outcome.data.loaded);
        const count =
          outcome.data.herbs_refreshed +
          outcome.data.formulas_refreshed +
          outcome.data.points_refreshed;
        toast({ tone: 'success', title: t('refreshed', { count }) });
        router.refresh();
      } finally {
        setIsRefreshing(false);
      }
    });
  };

  const rows: Array<{ key: 'herbs' | 'formulas' | 'points'; label: string }> = [
    { key: 'herbs', label: t('herbs') },
    { key: 'formulas', label: t('formulas') },
    { key: 'points', label: t('points') },
  ];

  return (
    <Card id="catalogue">
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-ink-500" aria-hidden />
            {t('title')}
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-700">{t('intro')}</p>

        {!installed ? (
          <Alert tone="info">{t('notInstalled')}</Alert>
        ) : empty ? (
          <Alert tone="info">{t('emptyCatalogue')}</Alert>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-ink-600">
                <th scope="col" className="py-1 text-start font-medium">
                  {t('what')}
                </th>
                <th scope="col" className="py-1 text-end font-medium">
                  {t('inCatalogue')}
                </th>
                <th scope="col" className="py-1 text-end font-medium">
                  {t('inClinic')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-ink-100">
                  <th scope="row" className="py-1.5 text-start font-normal text-ink-800">
                    {row.label}
                  </th>
                  <td className="py-1.5 text-end tabular-nums">{counts.catalogue![row.key]}</td>
                  <td className="py-1.5 text-end tabular-nums">{counts.clinic[row.key]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {result ? (
          <p className="text-xs text-ink-600" aria-live="polite">
            {t('lastResult', {
              herbs: result.herbs_added,
              formulas: result.formulas_added,
              points: result.points_added,
            })}
          </p>
        ) : null}

        <p className="text-xs leading-relaxed text-ink-600">{t('safe')}</p>
        <p className="text-xs leading-relaxed text-ink-600">{t('refreshHint')}</p>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {complete ? <span className="text-xs text-ink-600">{t('upToDate')}</span> : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isPending || !installed || empty}
            onClick={refresh}
          >
            {isRefreshing ? <Spinner className="h-4 w-4" /> : null}
            {t('refresh')}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isPending || !installed || empty}
            onClick={load}
          >
            {isPending && !isRefreshing ? <Spinner className="h-4 w-4" /> : null}
            {t('load')}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
