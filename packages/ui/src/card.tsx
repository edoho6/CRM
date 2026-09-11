import * as React from 'react';
import { cn } from './cn';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-card border border-ink-200 bg-white shadow-xs', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3',
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-base font-semibold text-ink-900', className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 border-t border-ink-100 px-4 py-3',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Page section with a heading, used to break long forms into readable blocks.
 *
 * The heading is an h2: a form's sections sit right under the page's h1, and
 * an h3 there is a skipped level — a screen reader's heading list jumped from
 * the page to "personal details" with nothing in between. The finer headings
 * inside a section (tongue, pulse, points) are h3.
 */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  titleHidden = false,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /**
   * Keeps the heading for screen readers and takes it off the screen. For a
   * form whose field labels already say everything the heading said — the
   * treatment record, where "complaint and history" sat over a field called
   * "chief complaint" — and the practitioner asked for the furniture to go.
   */
  titleHidden?: boolean;
}) {
  if (titleHidden) {
    return (
      <section className={cn('space-y-3', className)}>
        <h2 className="sr-only">{title}</h2>
        {actions ? <div className="flex justify-end">{actions}</div> : null}
        {children}
      </section>
    );
  }
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
          {description ? <p className="text-xs text-ink-600">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
