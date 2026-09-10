'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from './cn';
import { focusRing } from './focus';
import { useSwipeDismiss } from './use-swipe-dismiss';

/**
 * A click on a floating panel (a combobox list, a popover) is not a click
 * outside the dialog, even though the panel is rendered into <body>. Without
 * this, choosing a patient from the list closed the dialog around it.
 */
export function isInsideFloatingPanel(event: { target: EventTarget | null }): boolean {
  const target = event.target;
  return target instanceof Element && Boolean(target.closest('[data-floating]'));
}

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  closeLabel = 'Close',
  onOpenAutoFocus,
  onPointerDownOutside,
  onFocusOutside,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  closeLabel?: string;
}) {
  /*
   * Focus lands on the first field, not on the ✕.
   *
   * The close button is rendered before the body, so it is the first focusable
   * thing and Radix would park focus there: open "new appointment" and the
   * first Enter closes it. A caller can mark the field it wants with
   * `data-autofocus`; otherwise the first enabled control in the body wins,
   * and a dialog with no controls at all keeps Radix's default.
   */
  const focusFirstField = (event: Event) => {
    onOpenAutoFocus?.(event);
    if (event.defaultPrevented) return;
    const content = event.currentTarget as HTMLElement | null;
    const body = content?.querySelector<HTMLElement>('[data-dialog-body]');
    const target =
      body?.querySelector<HTMLElement>('[data-autofocus]') ??
      body?.querySelector<HTMLElement>(
        'input:not([type=hidden]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled]), [role=combobox]:not([disabled])',
      );
    if (target) {
      event.preventDefault();
      target.focus();
    }
  };

  // On a phone the sheet is dragged closed from its handle or its header; the
  // hidden close button is how a drag turns into Radix's own close, so the
  // exit animation and focus return happen exactly as for the ✕.
  const contentRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const swipe = useSwipeDismiss(contentRef, () => closeRef.current?.click());

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-overlay bg-ink-900/40 backdrop-blur-[1px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
      {/* From `sm` up, centred by `inset-0` + `m-auto` on the content itself — the way a
          native <dialog> centres — rather than by a wrapping flex box.

          The wrapper was not harmless. Radix's Portal puts each direct child in
          its own Presence, which keeps an element mounted only for as long as
          its own animation runs; a plain div has none, so it was removed the
          instant the dialog closed and took the content with it. The exit
          animation could never play. Auto margins also need no translate(-50%),
          so there is no sign to flip for RTL. */}
      <DialogPrimitive.Content
        ref={contentRef}
        className={cn(
          // Phone: a sheet pinned to the bottom edge, full width, that slides
          // up with a spring, capped so the page behind stays visible, and
          // scrolling inside its body rather than as a whole — which is what
          // lets the footer stay put while the fields scroll under it.
          'fixed inset-x-0 bottom-0 z-overlay flex max-h-[85dvh] w-full flex-col',
          'rounded-t-card border-t border-ink-200 bg-white shadow-lg',
          'data-[state=open]:animate-drawer-in data-[state=closed]:animate-drawer-out',
          // From `sm` on: the centred card.
          'sm:inset-0 sm:m-auto sm:h-fit sm:w-[calc(100%-2rem)] sm:max-w-lg sm:max-h-[calc(100dvh-4rem)]',
          'sm:rounded-card sm:border',
          'sm:data-[state=open]:animate-dialog-in sm:data-[state=closed]:animate-dialog-out',
          className,
        )}
        onOpenAutoFocus={focusFirstField}
        onPointerDownOutside={(event) => {
          if (isInsideFloatingPanel(event.detail.originalEvent)) event.preventDefault();
          onPointerDownOutside?.(event);
        }}
        onFocusOutside={(event) => {
          if (isInsideFloatingPanel(event.detail.originalEvent)) event.preventDefault();
          onFocusOutside?.(event);
        }}
        {...props}
      >
        {/* The grab handle a sheet has: says "this can be pulled down" and is
            where the pull starts. Only on the phone layout. */}
        <div className="shrink-0 pt-2 sm:hidden" {...swipe}>
          <span
            data-drawer-handle
            aria-hidden
            className="mx-auto block h-1.5 w-10 rounded-full bg-ink-300"
          />
        </div>
        <div
          className="flex shrink-0 items-start justify-between gap-4 border-b border-ink-100 px-5 py-3"
          {...swipe}
        >
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-base font-semibold text-ink-900 sm:text-sm">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-0.5 text-xs text-ink-500">
                {description}
              </DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          {/* A 40px target drawn as a 16px glyph; the negative margins keep the
              header the height it was. */}
          <DialogPrimitive.Close
            ref={closeRef}
            aria-label={closeLabel}
            className={cn(
              '-my-2 -me-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800 active:bg-ink-200',
              focusRing,
            )}
          >
            <X className="h-4 w-4" aria-hidden />
          </DialogPrimitive.Close>
        </div>
        <div
          data-dialog-body
          data-scroll-panel
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-4"
        >
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/**
 * The dialog's buttons. On a phone they stay in view at the bottom of the
 * sheet while the fields scroll under them — with a keyboard up, the Save
 * button is the one thing that must not scroll away.
 */
export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'sticky bottom-0 -mx-5 -mb-[calc(env(safe-area-inset-bottom)+1rem)] mt-5 flex justify-end gap-2',
        'border-t border-ink-100 bg-white px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]',
        'sm:static sm:mx-0 sm:mb-0 sm:border-0 sm:bg-transparent sm:p-0',
        className,
      )}
      {...props}
    />
  );
}
