import { ExternalLink as ExternalLinkIcon } from 'lucide-react';
import { cn } from '@clinic/ui';

/**
 * A link that leaves the app.
 *
 * It opens in a new tab, because the reader is in the middle of a list they
 * will come back to; it says so to a screen reader, because a tab that
 * opens unannounced is a page that vanished; and it carries no referrer, so
 * the shop learns nothing about the clinic's page. The caller passes the
 * announcement text — this component has no translations of its own so a
 * client component can render it too.
 */
export function ExternalLink({
  href,
  children,
  newTabLabel,
  className,
  ...rest
}: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel'> & {
  href: string;
  newTabLabel: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('inline-flex items-center gap-1', className)}
      {...rest}
    >
      {children}
      <ExternalLinkIcon className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
      <span className="sr-only">{newTabLabel}</span>
    </a>
  );
}
