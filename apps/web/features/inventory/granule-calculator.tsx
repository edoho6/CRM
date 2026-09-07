'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { ArrowLeftRight, Calculator } from 'lucide-react';
import { Field, LtrInput, Popover } from '@clinic/ui';
import { GRANULE_RATIO, granulesToRaw, rawToGranules } from './dosing';

/**
 * Dried herb ↔ granule conversion.
 *
 * Granule extracts are concentrated 5:1 — one gram of granule stands for five
 * grams of the raw herb. The arithmetic is trivial and doing it in your head
 * nine times while writing a formula is exactly how a decimal point ends up in
 * the wrong place, so it is here instead.
 *
 * The ratio is stated on screen rather than assumed. Concentrations vary by
 * manufacturer and by herb, and a calculator that hides its assumption is worse
 * than none — a practitioner using a 3:1 line needs to see immediately that this
 * does not apply to them.
 */

export function GranuleCalculator({ className }: { className?: string }) {
  const t = useTranslations('inventory.granules');
  const tUnit = useTranslations('inventory.unit');
  const format = useFormatter();

  const [raw, setRaw] = useState('');
  const [granule, setGranule] = useState('');

  function fromRaw(value: string) {
    setRaw(value);
    const grams = Number(value);
    setGranule(value.trim() === '' || !Number.isFinite(grams) ? '' : String(rawToGranules(grams)));
  }

  function fromGranule(value: string) {
    setGranule(value);
    const grams = Number(value);
    setRaw(value.trim() === '' || !Number.isFinite(grams) ? '' : String(granulesToRaw(grams)));
  }

  return (
    <Popover
      width={280}
      align="start"
      panelLabel={t('title')}
      triggerLabel={t('title')}
      triggerClassName="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 transition-colors hover:bg-ink-50"
      triggerContent={
        <>
          <Calculator className="h-3.5 w-3.5" aria-hidden />
          {t('title')}
        </>
      }
      className={className}
    >
      <div className="space-y-2">
        <p className="text-xs leading-relaxed text-ink-600">
          {t('explainer', { ratio: GRANULE_RATIO })}
        </p>

        {/* Both directions, live: whichever box is typed in fills the other, so
            there is no "convert" button to press and no stale result to read. */}
        <Field label={`${t('rawHerb')} · ${tUnit('gram')}`} htmlFor="granule-raw" density="compact">
          <LtrInput
            id="granule-raw"
            type="number"
            min={0}
            step="0.1"
            value={raw}
            onChange={(event) => fromRaw(event.target.value)}
          />
        </Field>

        <div className="flex justify-center text-ink-500" aria-hidden>
          <ArrowLeftRight className="h-3.5 w-3.5 rotate-90" />
        </div>

        <Field
          label={`${t('granules')} · ${tUnit('gram')}`}
          htmlFor="granule-out"
          density="compact"
        >
          <LtrInput
            id="granule-out"
            type="number"
            min={0}
            step="0.1"
            value={granule}
            onChange={(event) => fromGranule(event.target.value)}
          />
        </Field>

        {Number(raw) > 0 ? (
          <p className="rounded-md bg-jade-50 px-2 py-1.5 text-xs text-jade-800" role="status">
            {t('result', {
              raw: format.number(Number(raw)),
              granules: format.number(Number(granule) || 0),
            })}
          </p>
        ) : null}
      </div>
    </Popover>
  );
}
