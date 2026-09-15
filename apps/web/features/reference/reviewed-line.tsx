import { getFormatter, getTranslations } from 'next-intl/server';
import { CheckCircle2 } from 'lucide-react';

/**
 * "Approved by Dana on 3/9/2026" — the trace a click on "approve" leaves on
 * a catalogue page. Nothing when the row was never approved: a row whose
 * flag was cleared by an edit has no one to name.
 */
export async function ReviewedLine({
  reviewedAt,
  reviewedByName,
  className,
}: {
  reviewedAt: string | null | undefined;
  reviewedByName: string | null | undefined;
  className?: string;
}) {
  if (!reviewedAt) return null;
  const t = await getTranslations('inventory.review');
  const format = await getFormatter();
  const date = format.dateTime(new Date(reviewedAt), { dateStyle: 'short' });
  return (
    <p className={`inline-flex items-center gap-1 text-xs text-ink-600 ${className ?? ''}`}>
      <CheckCircle2 className="h-3.5 w-3.5 text-jade-700" aria-hidden />
      {reviewedByName ? t('approvedBy', { name: reviewedByName, date }) : t('approvedOn', { date })}
    </p>
  );
}
