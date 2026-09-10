import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';
import { Card, CardBody } from './card';
import { Table, TableWrapper, Td, Th } from './table';

/**
 * Placeholders for a page that is on its way.
 *
 * Shapes rather than a spinner, because a spinner says "wait" and a shape
 * says "here is where the thing will be" — the eye settles on the layout before
 * the data arrives, and nothing jumps when it does. Every `loading.tsx` builds
 * its skeleton from these, on the same `Card` and `Table` frames the real page
 * uses, so the outlines match to the pixel.
 *
 * `animate-pulse` rather than a shimmer: it is in Tailwind's default theme, so
 * it needs no token in either app, and under the global reduced-motion clamp
 * it becomes a still block — which is the right degraded state.
 */
const skeletonVariants = cva('animate-pulse bg-ink-200/70', {
  variants: {
    shape: {
      text: 'h-3.5 w-full rounded',
      heading: 'h-6 w-48 rounded-md',
      block: 'h-24 w-full rounded-lg',
      circle: 'h-10 w-10 rounded-full',
      button: 'h-9 w-24 rounded-lg',
      badge: 'h-5 w-16 rounded-full',
    },
  },
  defaultVariants: { shape: 'text' },
});

export function Skeleton({
  shape,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof skeletonVariants>) {
  return <div aria-hidden className={cn(skeletonVariants({ shape }), className)} {...props} />;
}

/** A paragraph's worth of lines, the last one shorter, as prose is. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  const widths = ['w-full', 'w-11/12', 'w-4/5'];
  return (
    <div className={cn('space-y-2', className)} aria-hidden>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={widths[index % widths.length]} />
      ))}
    </div>
  );
}

export function SkeletonCard({
  lines = 3,
  header = true,
  className,
}: {
  lines?: number;
  header?: boolean;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardBody className="space-y-3">
        {header ? <Skeleton shape="heading" className="w-32" /> : null}
        <SkeletonText lines={lines} />
      </CardBody>
    </Card>
  );
}

export function SkeletonTable({
  rows = 6,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  const cols = Array.from({ length: columns }, (_, index) => index);
  return (
    <TableWrapper className={className}>
      <Table>
        <thead>
          <tr>
            {cols.map((col) => (
              <Th key={col}>
                <Skeleton className="h-3 w-20" />
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row}>
              {cols.map((col) => (
                <Td key={col}>
                  <Skeleton className={col === 0 ? 'w-32' : 'w-20'} />
                </Td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrapper>
  );
}

/**
 * The frame around a page skeleton.
 *
 * One live region for the whole page, announced once, with every shape inside
 * it hidden from the accessibility tree. Without this a screen reader is
 * handed thirty empty boxes. The label is a prop rather than a translation
 * because this package has no access to the message catalogue.
 */
export function SkeletonPage({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={cn('space-y-5', className)}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
