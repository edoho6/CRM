import { Link } from '@clinic/i18n/navigation';
import { cn } from '@clinic/ui/cn';
import { tcmStyle, type TcmScale } from '@/lib/tcm-colors';

/**
 * One coloured token from a materia medica scale.
 *
 * The same component renders the chip in the herb list, in the herb's own page
 * and inside the filter bar, so a colour always means the same thing wherever
 * the eye lands on it.
 *
 * Given an `href` it becomes a link. On a herb's page every chip points at the
 * list filtered by that value, which turns reading an entry into browsing:
 * "warm" on Gui Zhi is one click from every other warm herb.
 */
export function TcmChip({
  scale,
  value,
  children,
  size = 'md',
  href,
  className,
}: {
  scale: TcmScale;
  value: string | null | undefined;
  children: React.ReactNode;
  size?: 'sm' | 'md';
  href?: { pathname: string; query: Record<string, string> };
  className?: string;
}) {
  const classes = cn(
    'inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap',
    size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs',
    tcmStyle(scale, value).chip,
    href && 'transition-all hover:-translate-y-px hover:shadow-xs focus-visible:-translate-y-px',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return <span className={classes}>{children}</span>;
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
      className={cn(
        'inline-block h-2.5 w-2.5 shrink-0 rounded-full',
        tcmStyle(scale, value).dot,
        className,
      )}
    />
  );
}

/** A row of chips, or an em dash when the list is empty. */
export function TcmChips({
  scale,
  values,
  render,
  size = 'md',
  hrefFor,
}: {
  scale: TcmScale;
  values: readonly string[];
  render: (value: string) => string;
  size?: 'sm' | 'md';
  /** When given, each chip links to the list filtered by that value. */
  hrefFor?: (value: string) => { pathname: string; query: Record<string, string> };
}) {
  if (values.length === 0) return <span className="text-ink-500">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {values.map((value) => (
        <TcmChip key={value} scale={scale} value={value} size={size} href={hrefFor?.(value)}>
          {render(value)}
        </TcmChip>
      ))}
    </span>
  );
}
