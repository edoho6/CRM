'use client';

import { useEffect, useState } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { BookOpen } from 'lucide-react';
import { Alert, Button, Dash, DetailRow, Dialog, DialogContent, Spinner } from '@clinic/ui';
import type { Herb } from '@clinic/db/types';
import { localizedField } from '@clinic/domain';
import { Link } from '@clinic/i18n/navigation';
import { TcmChip, TcmChips } from '@/components/tcm-chip';
import { SourcesLine } from '@/features/reference/sources-line';
import { herbBotanicalName, herbChineseName, herbPrimaryName } from '@/lib/display';
import { loadHerbMonograph } from './herb-monograph-action';
import { doseRangeLabel } from './dose-range';

/** Where a chip sends you: the herb list, filtered by that value. */
const HERBS_PATH = '/reference/herbs';

/** Monographs already read this page, so reopening one costs nothing. */
const loaded = new Map<string, Herb>();

function Prose({ text }: { text: string | null }) {
  if (!text) return <Dash />;
  return <span className="whitespace-pre-wrap">{text}</span>;
}

/**
 * A herb's monograph as a pop-up over the gallery: what the herb's own page
 * puts above the fold — dose, temperature, tastes, channels, group — and the
 * text beneath, without leaving the comparison. The full page is one link
 * away for the stock and the formulas, which a comparison does not need.
 */
export function HerbMonographSheet({
  herbId,
  fallbackName,
  onClose,
}: {
  /** The herb to show; null keeps the sheet closed. */
  herbId: string | null;
  /** Shown in the title until the monograph arrives. */
  fallbackName: string;
  onClose: () => void;
}) {
  const ti = useTranslations('inventory.image');
  const tc = useTranslations('common');
  // What came back, kept with the herb it is about: opening another herb shows
  // "loading" rather than the last one's page under the new name.
  const [fetched, setFetched] = useState<{ id: string; herb: Herb | null; failed: boolean } | null>(
    null,
  );
  const herb = herbId
    ? (loaded.get(herbId) ?? (fetched?.id === herbId ? fetched.herb : null))
    : null;
  const failed = Boolean(herbId && fetched?.id === herbId && fetched.failed);

  useEffect(() => {
    if (!herbId || loaded.has(herbId)) return;
    let cancelled = false;
    loadHerbMonograph(herbId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        loaded.set(herbId, result.data);
        setFetched({ id: herbId, herb: result.data, failed: false });
      } else {
        setFetched({ id: herbId, herb: null, failed: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [herbId]);

  const primary = herb ? herbPrimaryName(herb) : fallbackName;
  const chinese = herb ? herbChineseName(herb) : '';
  const botanical = herb ? herbBotanicalName(herb) : '';

  return (
    <Dialog open={herbId !== null} onOpenChange={(open) => !open && onClose()}>
      {herbId !== null ? (
        <DialogContent
          title={primary}
          description={
            chinese || botanical ? (
              <span dir="ltr">
                {chinese}
                {chinese && botanical ? ' · ' : ''}
                {botanical ? <span className="italic">{botanical}</span> : null}
              </span>
            ) : undefined
          }
          closeLabel={tc('close')}
          className="sm:max-w-2xl"
        >
          {failed ? (
            <Alert tone="danger">{ti('monographFailed')}</Alert>
          ) : !herb ? (
            <p className="flex items-center gap-2 py-6 text-sm text-ink-600" role="status">
              <Spinner className="h-4 w-4" />
              {tc('loading')}
            </p>
          ) : (
            <HerbMonographBody herb={herb} />
          )}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

/**
 * The monograph itself — what the herb's page puts above the fold, and the
 * text beneath. Shared by the gallery's sheet and by the reference card that
 * opens from a chip anywhere else.
 */
export function HerbMonographBody({ herb }: { herb: Herb }) {
  const t = useTranslations('inventory.herbs');
  const locale = useLocale();
  const ti = useTranslations('inventory.image');
  const tCategory = useTranslations('inventory.category');
  const tTcm = useTranslations('inventory.tcmCategory');
  const tTemp = useTranslations('inventory.temperature');
  const tTaste = useTranslations('inventory.taste');
  const tChannel = useTranslations('inventory.channel');
  const tUnit = useTranslations('inventory.unit');
  const format = useFormatter();
  const dosage = doseRangeLabel(herb, (n) => format.number(n), tUnit('gram'));

  return (
    <div data-monograph-loaded className="space-y-4">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3 rounded-lg border border-ink-200 bg-ink-50 p-3">
        <div>
          <p className="text-xs font-medium text-ink-600">{t('fields.dosageRange')}</p>
          {dosage ? (
            <p className="text-2xl leading-tight font-bold tabular-nums text-jade-800">{dosage}</p>
          ) : (
            <p className="text-2xl leading-tight font-bold text-ink-500">
              <Dash />
            </p>
          )}
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-ink-600">{t('fields.temperature')}</p>
          {herb.temperature ? (
            <TcmChip
              scale="temperature"
              value={herb.temperature}
              href={{ pathname: HERBS_PATH, query: { temp: herb.temperature } }}
            >
              {tTemp(herb.temperature)}
            </TcmChip>
          ) : (
            <Dash />
          )}
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-ink-600">{t('fields.tastes')}</p>
          <TcmChips
            scale="taste"
            values={herb.tastes ?? []}
            render={(value) => tTaste(value as never)}
            hrefFor={(value) => ({ pathname: HERBS_PATH, query: { taste: value } })}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-ink-600">{t('fields.channels')}</p>
          <TcmChips
            scale="channel"
            values={herb.channels ?? []}
            render={(value) => tChannel(value as never)}
            hrefFor={(value) => ({ pathname: HERBS_PATH, query: { chan: value } })}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-ink-600">{t('fields.tcmCategory')}</p>
          {herb.tcm_category ? (
            <TcmChip
              scale="tcmCategory"
              value={herb.tcm_category}
              href={{ pathname: HERBS_PATH, query: { cat: herb.tcm_category } }}
            >
              {tTcm(herb.tcm_category)}
            </TcmChip>
          ) : (
            <Dash />
          )}
        </div>
      </div>

      <dl>
        <DetailRow label={t('fields.functions')}>
          <Prose text={localizedField(herb, 'functions', locale)} />
        </DetailRow>
        <DetailRow label={t('fields.indications')}>
          <Prose text={localizedField(herb, 'indications', locale)} />
        </DetailRow>
        <DetailRow label={t('fields.cautions')}>
          <Prose text={localizedField(herb, 'cautions', locale)} />
        </DetailRow>
        {herb.properties ? (
          <DetailRow label={t('fields.properties')}>{herb.properties}</DetailRow>
        ) : null}
        <DetailRow label={t('fields.category')}>{tCategory(herb.category)}</DetailRow>
        <DetailRow label={t('fields.pharmaceuticalName')}>
          <span dir="ltr">{herb.pharmaceutical_name ?? <Dash />}</span>
        </DetailRow>
        {localizedField(herb, 'dosage_notes', locale) ? (
          <DetailRow label={t('fields.dosageNotes')}>
            {localizedField(herb, 'dosage_notes', locale)}
          </DetailRow>
        ) : null}
      </dl>
      <SourcesLine row={herb} />

      <div className="flex justify-end">
        <Button asChild variant="secondary">
          <Link href={`/reference/herbs/${herb.id}`}>
            <BookOpen className="h-4 w-4" aria-hidden />
            {ti('fullPage')}
          </Link>
        </Button>
      </div>
    </div>
  );
}
