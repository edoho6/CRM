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
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  closeLabel?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-overlay bg-ink-900/40 backdrop-blur-[1px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
      {/* Centred by `inset-0` + `m-auto` on the content itself — the way a
          native <dialog> centres — rather than by a wrapping flex box.

          The wrapper was not harmless. Radix's Portal puts each direct child in
          its own Presence, which keeps an element mounted only for as long as
          its own animation runs; a plain div has none, so it was removed the
          instant the dialog closed and took the content with it. The exit
          animation could never play. Auto margins also need no translate(-50%),
          so there is no sign to flip for RTL. */}
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-0 z-overlay m-auto h-fit w-[calc(100%-2rem)] max-w-lg',
          'rounded-card border border-ink-200 bg-white shadow-lg',
          'max-h-[calc(100vh-4rem)] overflow-y-auto',
          'data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out',
          className,
        )}
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
        <div className="px-5 py-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-5 flex justify-end gap-2', className)} {...props} />;
}
