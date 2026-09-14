'use client';

import * as React from 'react';
import { Button } from './button';
import { Dialog, DialogContent, DialogFooter } from './dialog';

/**
 * "Are you sure?" — as a promise.
 *
 * `window.confirm` was doing this job in six places. It works, and it looks
 * like the browser, not the product: unstyled, unstranslatable in its buttons,
 * and it freezes the page. This keeps the one thing it had right — the calling
 * code reads as a single `if` — and puts the dialog in the design system:
 *
 *   if (!(await confirm({ title, body, destructive: true }))) return;
 *
 * Called outside `startTransition`, as `window.confirm` was, so the pending
 * state of the action does not begin until the person has answered.
 *
 * Focus lands on Cancel. A destructive dialog whose default is "delete" is one
 * that Enter, pressed a moment too early, carries out.
 */

export interface ConfirmOptions {
  /** A string, not a node: it also becomes the dialog's accessible name. */
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Paints the confirm button as danger. */
  destructive?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<Confirm | null>(null);

export function ConfirmProvider({
  confirmLabel,
  cancelLabel,
  closeLabel,
  children,
}: {
  /** Defaults, in the page's language; a call may override either. */
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  children: React.ReactNode;
}) {
  // `options` outlives `open`: the content has to stay mounted while the exit
  // animation plays, and it is the options that render it.
  const [options, setOptions] = React.useState<ConfirmOptions | null>(null);
  const [open, setOpen] = React.useState(false);
  const resolver = React.useRef<((value: boolean) => void) | null>(null);
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  const settle = React.useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpen(false);
  }, []);

  const confirm = React.useCallback<Confirm>((next) => {
    // A second question while the first is open answers the first with "no".
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOptions(next);
      setOpen(true);
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) settle(false);
        }}
      >
        {options ? (
          <DialogContent
            title={options.title}
            // Named for this dialog, not just "close": a confirmation opens over
            // another dialog whose own close is also "close", and a screen
            // reader could not tell the two ✕ buttons apart.
            closeLabel={`${closeLabel} · ${options.title}`}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              cancelRef.current?.focus();
            }}
          >
            {options.body ? <p className="text-sm text-ink-700">{options.body}</p> : null}
            {/* On a phone: stacked, full-width, the answer on top and Cancel
                under it — the shape of an action sheet. From `sm`: a row. */}
            <DialogFooter className="flex-col-reverse sm:flex-row">
              <Button
                ref={cancelRef}
                variant="secondary"
                className="h-11 w-full sm:h-10 sm:w-auto"
                onClick={() => settle(false)}
              >
                {options.cancelLabel ?? cancelLabel}
              </Button>
              <Button
                variant={options.destructive ? 'danger' : 'primary'}
                className="h-11 w-full sm:h-10 sm:w-auto"
                onClick={() => settle(true)}
              >
                {options.confirmLabel ?? confirmLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirm {
  const confirm = React.useContext(ConfirmContext);
  if (!confirm) {
    throw new Error(
      'useConfirm() needs a <ConfirmProvider> above it — mount one in the root layout.',
    );
  }
  return confirm;
}
