import { cn } from '@clinic/ui/cn';
import { tcmStyle, type TcmScale } from '@/lib/tcm-colors';

/**
 * One coloured token from a materia medica scale.
 *
 * The same component renders the chip in the herb list, in the herb's own page
 * and inside the filter bar, so a colour always means the same thing wherever
 * the eye lands on it.
 */
export function TcmChip({
  scale,
  value,
  children,
  size = 'md',
  className,
}: {
  scale: TcmScale;
  value: string | null | undefined;
  children: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs',
        tcmStyle(scale, value).chip,
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * The colour alone, with no label — for the leading edge of a table row, where
 * the category is already spelled out in its own column and repeating it would
 * only add noise.
 */
export function TcmDot({
  scale,
  value,
  title,
  className,
}: {
  scale: TcmScale;
  value: string | null | undefined;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      aria-hidden
      className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', tcmStyle(scale, value).dot, className)}
    />
  );
}

/** A row of chips, or an em dash when the list is empty. */
export function TcmChips({
  scale,
  values,
  render,
  size = 'md',
}: {
  scale: TcmScale;
  values: readonly string[];
  render: (value: string) => string;
  size?: 'sm' | 'md';
}) {
  if (values.length === 0) return <span className="text-ink-400">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {values.map((value) => (
        <TcmChip key={value} scale={scale} value={value} size={size}>
          {render(value)}
        </TcmChip>
      ))}
    </span>
  );
}
