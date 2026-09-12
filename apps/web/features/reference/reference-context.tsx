'use client';

import { createContext, useContext } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@clinic/ui';
import type { ReferenceTarget } from './reference-card-action';

/**
 * The part of the reference sheet that a card body may import.
 *
 * The provider and the dialog live in reference-sheet.tsx and render the
 * bodies; a body that draws chips of its own (the medicine entry links to
 * other entries) needs the chip and the context — and importing them from
 * the sheet would import the sheet into itself. So the context and the chip
 * live here, and the sheet re-exports them for everyone else.
 */

export interface ReferenceSheetApi {
  open: (target: ReferenceTarget) => void;
}

export const ReferenceSheetContext = createContext<ReferenceSheetApi | null>(null);

export function useReferenceSheet(): ReferenceSheetApi | null {
  return useContext(ReferenceSheetContext);
}

/** A name that opens its card. Plain text when there is no sheet to open it in. */
export function ReferenceChip({
  target,
  children,
  className,
  dir,
}: {
  target: ReferenceTarget;
  children: React.ReactNode;
  className?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
}) {
  const sheet = useReferenceSheet();
  const t = useTranslations('reference.sheet');
  if (!sheet) {
    return (
      <span className={className} dir={dir}>
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      dir={dir}
      aria-haspopup="dialog"
      title={t('open')}
      onClick={(event) => {
        // Inside a row that is itself a button or a link, the chip wins.
        event.stopPropagation();
        event.preventDefault();
        sheet.open(target);
      }}
      className={cn(
        'rounded text-start underline decoration-dotted underline-offset-4 hover:decoration-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        // The Chinese medicine catalogues underline in jade; the Western
        // medicine reference in blue, the same split as its tab and its badges.
        target.kind === 'medicine' ? 'decoration-sky-700' : 'decoration-jade-400',
        className,
      )}
    >
      {children}
    </button>
  );
}
