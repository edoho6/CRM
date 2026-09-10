'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from './cn';
import { focusRing } from './focus';

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
        className={cn(
          // Phone: a drawer pinned to the bottom edge, full width, that
          // slides up. From `sm` on: the centred card.
          'fixed inset-x-0 bottom-0 z-overlay h-fit max-h-[calc(100dvh-3rem)] w-full overflow-y-auto',
          'rounded-t-card border-t border-ink-200 bg-white shadow-lg pb-[env(safe-area-inset-bottom)]',
          'data-[state=open]:animate-drawer-in data-[state=closed]:animate-drawer-out',
          'sm:inset-0 sm:m-auto sm:w-[calc(100%-2rem)] sm:max-w-lg sm:max-h-[calc(100vh-4rem)] sm:pb-0',
          'sm:rounded-card sm:border',
          'sm:data-[state=open]:animate-dialog-in sm:data-[state=closed]:animate-dialog-out',
          className,
        )}
        onOpenAutoFocus={focusFirstField}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-3">
          <div>
            <DialogPrimitive.Title className="text-sm font-semibold text-ink-900">
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
        <div data-dialog-body className="px-5 py-4">
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-5 flex justify-end gap-2', className)} {...props} />;
}
