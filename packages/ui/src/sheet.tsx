'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from './cn';
import { useUiLabels } from './ui-labels';
import { isInsideFloatingPanel } from './dialog';
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
  closeLabel,
  side = 'start',
  onOpenAutoFocus,
  onCloseAutoFocus,
  onPointerDownOutside,
  onFocusOutside,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  closeLabel?: string;
  side?: 'start' | 'end';
}) {
  // The word comes from the app's labels when the caller has none of its
  // own; the English fallback exists only for a kit used outside the apps.
  const uiLabels = useUiLabels();
  const closeText = closeLabel ?? uiLabels.dialog?.close ?? 'Close';
  // Same as DialogContent: the sheet is opened through `open` state, not a
  // trigger, so Radix would return focus to nothing when it closes.
  const openerRef = React.useRef<HTMLElement | null>(null);
  const rememberOpener = (event: Event) => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    onOpenAutoFocus?.(event);
  };
  const returnFocus = (event: Event) => {
    onCloseAutoFocus?.(event);
    if (event.defaultPrevented) return;
    const opener = openerRef.current;
    const target = opener && opener.isConnected ? opener : document.getElementById('main-content');
    if (target) {
      event.preventDefault();
      target.focus({ preventScroll: target !== opener });
    }
  };
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-overlay bg-ink-900/40 backdrop-blur-[1px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-y-0 z-overlay flex w-72 max-w-[85vw] flex-col overflow-y-auto overscroll-contain bg-white shadow-lg',
          'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
          side === 'start'
            ? 'start-0 border-e border-ink-200 rtl:[--sheet-offset:100%]'
            : 'end-0 border-s border-ink-200 [--sheet-offset:100%] rtl:[--sheet-offset:-100%]',
          'data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out',
          className,
        )}
        onOpenAutoFocus={rememberOpener}
        onCloseAutoFocus={returnFocus}
        onPointerDownOutside={(event) => {
          if (isInsideFloatingPanel(event.detail.originalEvent)) event.preventDefault();
          onPointerDownOutside?.(event);
        }}
        onFocusOutside={(event) => {
          if (isInsideFloatingPanel(event.detail.originalEvent)) event.preventDefault();
          onFocusOutside?.(event);
        }}
        data-scroll-panel
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
            aria-label={closeText}
            className={cn(
              '-my-2 -me-2 flex h-10 w-10 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800 active:bg-ink-200',
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
