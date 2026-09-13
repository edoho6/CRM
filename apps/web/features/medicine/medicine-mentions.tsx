'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@clinic/ui';
import type { MedicineMention } from '@clinic/domain';
import { ReferenceChip } from '@/features/reference/reference-context';
import { MedicineKindIcon } from './medicine-body';
import { findMedicineMentions } from './mentions-action';

/** Half a second after the last keystroke: long enough not to ask on every letter, short enough to feel live. */
const SETTLE_MS = 500;

/**
 * Under a free-text field of the file — medications, chronic conditions, the
 * Western diagnosis — the names the reference recognises in it, as chips
 * that open the entry over the page. The text itself is never touched: the
 * practitioner writes as they write, and the row below follows.
 *
 * Nothing is announced as the row changes; a screen-reader user typing in
 * the field would hear a chip list rebuilt after every pause. The chips are
 * in the tab order, right after the field, which is where they are looked for.
 */
export function MedicineMentions({ text, className }: { text: string; className?: string }) {
  const t = useTranslations('medicine');
  const [mentions, setMentions] = useState<MedicineMention[]>([]);
  // Answers can overtake each other; only the latest question's counts.
  const latest = useRef(0);

  useEffect(() => {
    const value = text.trim();
    const run = ++latest.current;
    if (value.length < 3) {
      setMentions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const result = await findMedicineMentions(value);
      if (run !== latest.current) return;
      setMentions(result.ok ? result.data : []);
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  if (mentions.length === 0) return null;
  return (
    <p className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-600', className)} data-medicine-mentions>
      <span>{t('mentions.label')}:</span>
      {mentions.map((mention) => (
        <span key={mention.id} className="inline-flex items-center gap-1 text-sm">
          <MedicineKindIcon kind={mention.kind} className="h-3.5 w-3.5 text-sky-800" />
          <ReferenceChip target={{ kind: 'medicine', id: mention.id, slug: mention.slug, label: mention.label }} className="font-medium text-ink-900">
            {mention.label}
          </ReferenceChip>
        </span>
      ))}
    </p>
  );
}
