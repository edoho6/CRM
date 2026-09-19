'use client';

import * as React from 'react';
import { Share, X } from 'lucide-react';
import { Button } from './button';
import { cn } from './cn';

/** Chromium's install prompt, which the browser hands over before it would show its own bar. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** The device does not change under the page. */
const noSubscription = () => () => {};
const readIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const notIOS = () => false;

/**
 * The hint to put the app on the phone's home screen.
 *
 * Shown once, on a phone, when the app is not already running from the home
 * screen: a small sheet above the tab bar, never a banner in the page (the
 * page must not jump after it has painted). What it offers depends on what
 * the phone can do — Chromium hands over its own install prompt, so the
 * sheet has an install button; an iPhone has no such prompt, so the sheet
 * says where the share button is; anything else gets the browser-menu
 * wording. Dismissing it is remembered by this browser for good.
 */
export function InstallHint({
  storageKey,
  labels,
  icon,
  className,
}: {
  storageKey: string;
  labels: {
    title: string;
    body: string;
    install: string;
    ios: string;
    other: string;
    dismiss: string;
  };
  icon?: React.ReactNode;
  className?: string;
}) {
  const [show, setShow] = React.useState(false);
  // Which instructions to show: the browser's own install prompt when it has
  // offered one, the iPhone's share-sheet steps, or the general words. The
  // device is read as a store (no effect sets it); the prompt arrives as an event.
  const iOS = React.useSyncExternalStore(noSubscription, readIOS, notIOS);
  const [prompted, setPrompted] = React.useState(false);
  const platform: 'prompt' | 'ios' | 'other' = prompted ? 'prompt' : iOS ? 'ios' : 'other';
  const promptRef = React.useRef<BeforeInstallPromptEvent | null>(null);

  React.useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(storageKey) === '1';
    } catch {
      // Site data blocked: the hint shows, and dismissing it will not stick.
    }
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const phone = window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;
    // Inside the store app there is nothing to install: the pre-paint script
    // marks the document, and the bridge's own global is the second witness.
    const shell = Boolean(document.documentElement.dataset.shell) || 'Capacitor' in window;
    if (dismissed || standalone || shell || !phone) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as BeforeInstallPromptEvent;
      setPrompted(true);
    };
    const onInstalled = () => setShow(false);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    // After the page has settled, not in the middle of its arrival.
    const timer = window.setTimeout(() => setShow(true), 1500);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [storageKey]);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // Forgetting is the whole cost.
    }
  }

  async function install() {
    const prompt = promptRef.current;
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setShow(false);
  }

  if (!show) return null;

  return (
    <section
      aria-label={labels.title}
      data-install-hint
      className={cn(
        'no-print fixed inset-x-3 z-toast rounded-card border border-ink-200 bg-white p-3 shadow-lg',
        'bottom-[calc(var(--bottom-bar,0px)+env(safe-area-inset-bottom)+0.75rem)]',
        'motion-safe:animate-[slide-up_200ms_ease-out]',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-900">{labels.title}</p>
          <p className="mt-0.5 text-xs text-ink-600">{labels.body}</p>
          {platform === 'ios' ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-700">
              <Share className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{labels.ios}</span>
            </p>
          ) : platform === 'other' ? (
            <p className="mt-1.5 text-xs text-ink-700">{labels.other}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {platform === 'prompt' ? (
              <Button type="button" size="sm" onClick={install}>
                {labels.install}
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="secondary" onClick={dismiss}>
              {labels.dismiss}
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={labels.dismiss}
          title={labels.dismiss}
          className="-m-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}
