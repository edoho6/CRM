'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from './cn';
import { focusRing } from './focus';

/**
 * A panel that slides in from the edge — the phone's navigation drawer.
 *
 * Built on Radix Dialog, which is what gives it the things the old inline
 * mobile menu lacked: a backdrop, a focus trap, Escape, focus returned to the
 * button that opened it, and `aria-modal` so a screen reader does not wander
 * into the page behind.
 *
 * Direction is logical. `side="start"` is the left edge in English and the
 * right in Hebrew, and the slide comes from whichever that is. The keyframe
 * reads `--sheet-offset`; the classes below set it from side and direction so
 * one animation serves all four cases.
 */

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  className,
  children,
  title,
  description,
  closeLabel = 'Close',
  side = 'start',
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  closeLabel?: string;
  side?: 'start' | 'end';
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-overlay bg-ink-900/40 backdrop-blur-[1px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-y-0 z-overlay flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-white shadow-lg',
          side === 'start'
            ? 'start-0 border-e border-ink-200 rtl:[--sheet-offset:100%]'
            : 'end-0 border-s border-ink-200 [--sheet-offset:100%] rtl:[--sheet-offset:-100%]',
          'data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out',
          className,
        )}
        {...props}
      >
        <div className="flex items-center justify-between gap-4 border-b border-ink-100 px-4 py-3">
          <DialogPrimitive.Title className="text-sm font-semibold text-ink-900">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {description ?? title}
          </DialogPrimitive.Description>
          <DialogPrimitive.Close
            aria-label={closeLabel}
            className={cn(
              'rounded-md p-1 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800',
              focusRing,
            )}
          >
            <X className="h-4 w-4" aria-hidden />
          </DialogPrimitive.Close>
        </div>
        <div className="flex-1 p-3">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
