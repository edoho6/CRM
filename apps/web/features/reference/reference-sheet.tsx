'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from '@clinic/i18n/navigation';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { BookOpen } from 'lucide-react';
import { Alert, Button, Dash, DetailRow, Dialog, DialogContent, Spinner } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import { localizedField } from '@clinic/domain';
import type { AcupuncturePoint, HerbFormulaWithItems } from '@clinic/db/types';
import { SourcesLine } from './sources-line';
import {
  formulaChineseName,
  formulaPrimaryName,
  herbBotanicalName,
  herbChineseName,
  herbPrimaryName,
} from '@/lib/display';
import { HerbMonographBody } from '@/features/inventory/herb-monograph-sheet';
import { MedicineBody } from '@/features/medicine/medicine-body';
import { FormulaComposition } from '@/features/inventory/formula-composition';
import {
  loadReferenceCard,
  type ReferenceCard,
  type ReferenceTarget,
} from './reference-card-action';
import { ReferenceChip, ReferenceSheetContext, useReferenceSheet } from './reference-context';

/**
 * The reference, one click from wherever a name appears.
 *
 * A herb in a prescription, a point in a treatment record, a formula in the
 * comparison — each used to be either plain text or a link that left the
 * page. Now each is a chip, and the chip opens the monograph over the page:
 * the practitioner reads what LI4 does or what is in Gui Pi Tang and goes on
 * writing, without losing the record they were in the middle of.
 *
 * One provider near the root holds one dialog; chips anywhere under it ask
 * it to open. A chip rendered with no provider above it is just its text.
 */

// The context and the chip live in reference-context.tsx, so a card body
// that draws chips of its own (the medicine entry) can import them without
// importing this file back. Every other caller still reaches them from here.
export { ReferenceChip, useReferenceSheet };

/** Cards already read this page, so reopening one costs nothing. */
const loaded = new Map<string, ReferenceCard>();

function cacheKey(target: ReferenceTarget): string {
  return JSON.stringify([
    target.kind,
    target.id ?? '',
    'pinyin' in target ? (target.pinyin ?? '') : '',
    'name' in target ? (target.name ?? '') : '',
    'code' in target ? (target.code ?? '') : '',
    'slug' in target ? (target.slug ?? '') : '',
  ]);
}

export function ReferenceSheetProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<ReferenceTarget | null>(null);
  const [card, setCard] = useState<ReferenceCard | null>(null);
  const [failed, setFailed] = useState(false);

  const open = useCallback((next: ReferenceTarget) => {
    setTarget(next);
  }, []);

  // "Full page" inside a card is a real navigation, and the provider lives
  // above the pages — so the card closes itself when the address changes,
  // instead of staying open over the page it linked to.
  const pathname = usePathname();
  useEffect(() => {
    setTarget(null);
  }, [pathname]);
  const api = useMemo(() => ({ open }), [open]);

  useEffect(() => {
    if (!target) return;
    const key = cacheKey(target);
    setFailed(false);
    const cached = loaded.get(key);
    if (cached) {
      setCard(cached);
      return;
    }
    setCard(null);
    let cancelled = false;
    loadReferenceCard(target).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        loaded.set(key, result.data);
        setCard(result.data);
      } else {
        setFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [target]);

  return (
    <ReferenceSheetContext.Provider value={api}>
      {children}
      <ReferenceDialog
        target={target}
        card={card}
        failed={failed}
        onClose={() => setTarget(null)}
      />
    </ReferenceSheetContext.Provider>
  );
}

function ReferenceDialog({
  target,
  card,
  failed,
  onClose,
}: {
  target: ReferenceTarget | null;
  card: ReferenceCard | null;
  failed: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('reference.sheet');
  const tc = useTranslations('common');

  const title =
    card?.kind === 'herb'
      ? herbPrimaryName(card.herb)
      : card?.kind === 'formula'
        ? formulaPrimaryName(card.formula)
        : card?.kind === 'point'
          ? card.point.code
          : card?.kind === 'medicine'
            ? (card.entry.name_he ?? card.entry.name_en)
            : (target?.label ?? (target ? t(target.kind) : ''));

  const description =
    card?.kind === 'herb' ? (
      <HerbNames chinese={herbChineseName(card.herb)} botanical={herbBotanicalName(card.herb)} />
    ) : card?.kind === 'formula' ? (
      <span dir="ltr">{formulaChineseName(card.formula)}</span>
    ) : card?.kind === 'point' ? (
      <span dir="ltr">
        {[card.point.pinyin_name, card.point.chinese_name, card.point.english_name]
          .filter(Boolean)
          .join(' · ')}
      </span>
    ) : card?.kind === 'medicine' ? (
      <span dir="ltr">{card.entry.name_en}</span>
    ) : target ? (
      t(target.kind)
    ) : undefined;

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      {target ? (
        <DialogContent
          title={title}
          description={description || undefined}
          closeLabel={tc('close')}
          className="sm:max-w-2xl"
        >
          {failed ? (
            <Alert tone="danger">{t('failed')}</Alert>
          ) : !card ? (
            <p className="flex items-center gap-2 py-6 text-sm text-ink-600" role="status">
              <Spinner className="h-4 w-4" />
              {tc('loading')}
            </p>
          ) : card.kind === 'herb' ? (
            <HerbMonographBody herb={card.herb} />
          ) : card.kind === 'formula' ? (
            <FormulaBody formula={card.formula} />
          ) : card.kind === 'medicine' ? (
            <div className="space-y-4">
              <MedicineBody entry={card.entry} links={card.links} headingLevel="h3" />
              <div className="flex justify-end">
                <Button asChild variant="secondary">
                  <Link href={`/reference/medicine/${card.entry.slug}`}>
                    <BookOpen className="h-4 w-4" aria-hidden />
                    {t('fullPage')}
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <PointBody point={card.point} />
          )}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function HerbNames({ chinese, botanical }: { chinese: string; botanical: string }) {
  if (!chinese && !botanical) return null;
  return (
    <span dir="ltr">
      {chinese}
      {chinese && botanical ? ' · ' : ''}
      {botanical ? <span className="italic">{botanical}</span> : null}
    </span>
  );
}

function Prose({ text }: { text: string | null }) {
  if (!text) return <Dash />;
  return <span className="whitespace-pre-wrap">{text}</span>;
}

function FormulaBody({ formula }: { formula: HerbFormulaWithItems }) {
  const t = useTranslations('inventory.formulas');
  const tSheet = useTranslations('reference.sheet');
  const tCategory = useTranslations('inventory.formulas.category');
  const tTcm = useTranslations('inventory.formulaTcmCategory');
  const tUnit = useTranslations('inventory.unit');
  const format = useFormatter();
  const locale = useLocale();
  const items = [...(formula.items ?? [])].sort((a, b) => a.sequence - b.sequence);
  const total = items.reduce((sum, item) => sum + Number(item.dosage), 0);
  const actions = localizedField(formula, 'actions', locale);
  const contraindications = localizedField(formula, 'contraindications', locale);

  return (
    <div className="space-y-4">
      <dl>
        <DetailRow label={t('fields.category')}>
          {tCategory(formula.category)}
          {formula.tcm_category ? (
            <span className="text-ink-600"> · {tTcm(formula.tcm_category)}</span>
          ) : null}
        </DetailRow>
        <DetailRow label={t('fields.description')}>
          <Prose text={formula.description} />
        </DetailRow>
        <DetailRow label={t('fields.indications')}>
          <Prose text={localizedField(formula, 'indications', locale)} />
        </DetailRow>
        {actions ? (
          <DetailRow label={t('fields.actions')}>
            <Prose text={actions} />
          </DetailRow>
        ) : null}
        {contraindications ? (
          <DetailRow label={t('fields.contraindications')}>
            <Prose text={contraindications} />
          </DetailRow>
        ) : null}
        {formula.modifications ? (
          <DetailRow label={t('fields.modifications')}>
            <Prose text={formula.modifications} />
          </DetailRow>
        ) : null}
        {formula.dosage_notes ? (
          <DetailRow label={t('fields.dosageNotes')}>
            <Prose text={formula.dosage_notes} />
          </DetailRow>
        ) : null}
        {formula.source_text ? (
          <DetailRow label={t('fields.sourceText')}>{formula.source_text}</DetailRow>
        ) : null}
      </dl>
      <SourcesLine row={formula} />

      {items.length > 0 ? (
        <section aria-labelledby="reference-formula-composition" className="space-y-1.5">
          <h3 id="reference-formula-composition" className="text-sm font-semibold text-ink-900">
            {t('composition.title')}
          </h3>
          <FormulaComposition
            herbs={items.map((item) =>
              item.herb ? { ...item.herb, name: herbPrimaryName(item.herb) } : null,
            )}
          />
        </section>
      ) : null}

      {items.length > 0 ? (
        <section aria-labelledby="reference-formula-items" className="space-y-1.5">
          <h3 id="reference-formula-items" className="text-sm font-semibold text-ink-900">
            {t('items')}
            <span className="ms-2 text-xs font-normal text-ink-600">
              {tSheet('total', {
                amount: format.number(total),
                unit: tUnit(items[0]?.unit ?? 'gram'),
              })}
            </span>
          </h3>
          <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-sm"
              >
                {/* Each herb is a chip of its own: the formula's card opens the herb's. */}
                <ReferenceChip
                  target={{
                    kind: 'herb',
                    id: item.herb?.id ?? null,
                    pinyin: item.herb?.pinyin_name ?? null,
                    label: herbPrimaryName(item.herb),
                  }}
                  dir="auto"
                  className="font-medium text-ink-900"
                >
                  {item.herb ? herbPrimaryName(item.herb) : <Dash />}
                </ReferenceChip>
                <span className="shrink-0 tabular-nums text-ink-700">
                  {format.number(Number(item.dosage))} {tUnit(item.unit)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex justify-end">
        <Button asChild variant="secondary">
          <Link href={`/reference/formulas/${formula.id}`}>
            <BookOpen className="h-4 w-4" aria-hidden />
            {tSheet('fullPage')}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function PointBody({ point }: { point: AcupuncturePoint }) {
  const t = useTranslations('reference.points');
  const tSheet = useTranslations('reference.sheet');
  const tChannel = useTranslations('reference.pointChannel');
  const tArea = useTranslations('reference.bodyArea');
  const tCategory = useTranslations('reference.pointCategory');
  const locale = useLocale();
  const cautions = localizedField(point, 'cautions', locale);

  return (
    <div className="space-y-4">
      <dl>
        <DetailRow label={t('fields.channel')}>{tChannel(point.channel)}</DetailRow>
        <DetailRow label={t('fields.bodyArea')}>
          {point.body_area ? tArea(point.body_area) : <Dash />}
        </DetailRow>
        {point.point_categories.length > 0 ? (
          <DetailRow label={t('fields.categories')}>
            <span className="flex flex-wrap gap-1">
              {point.point_categories.map((entry) => (
                <span
                  key={entry}
                  className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-700"
                >
                  {tCategory(entry)}
                </span>
              ))}
            </span>
          </DetailRow>
        ) : null}
        <DetailRow label={t('fields.location')}>
          <Prose text={localizedField(point, 'location', locale)} />
        </DetailRow>
        <DetailRow label={t('fields.actions')}>
          <Prose text={localizedField(point, 'actions', locale)} />
        </DetailRow>
        <DetailRow label={t('fields.indications')}>
          <Prose text={localizedField(point, 'indications', locale)} />
        </DetailRow>
        <DetailRow label={t('fields.needling')}>
          <Prose text={localizedField(point, 'needling', locale)} />
        </DetailRow>
        {cautions ? (
          <DetailRow label={t('fields.cautions')}>
            <span className="whitespace-pre-wrap text-amber-900">{cautions}</span>
          </DetailRow>
        ) : null}
      </dl>
      <SourcesLine row={point} />

      <div className="flex justify-end">
        <Button asChild variant="secondary">
          <Link href={`/reference/points/${point.id}`}>
            <BookOpen className="h-4 w-4" aria-hidden />
            {tSheet('fullPage')}
          </Link>
        </Button>
      </div>
    </div>
  );
}
