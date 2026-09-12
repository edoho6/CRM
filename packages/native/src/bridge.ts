import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import type { ShellIdentity } from '@clinic/domain/shell';

/**
 * What the shell adds to the page, started once per page load inside a shell
 * and torn down with it. Loaded on demand by `NativeShellBridge`; nothing here
 * runs in a browser.
 *
 * Every call to the phone is wrapped: a plugin missing from one build must
 * cost that one feature, not the page.
 */
export async function startBridge(shell: ShellIdentity): Promise<() => void> {
  // The user agent says shell; the bridge the shell injects is the proof.
  // Without it (a copied user agent, a test) there is nothing to talk to.
  if (!Capacitor.isNativePlatform()) return () => {};
  const cleanups: Array<() => void> = [];

  /* The status bar follows the theme: dark text on the light theme, light on
     the dark. The theme script keeps `data-theme` and the theme-colour meta
     current, so both are read from the document rather than asked again. */
  const applyStatusBar = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
    if (shell.platform === 'android') {
      const color = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content;
      if (color) void StatusBar.setBackgroundColor({ color }).catch(() => {});
    }
  };
  const observer = new MutationObserver(applyStatusBar);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  applyStatusBar();
  cleanups.push(() => observer.disconnect());

  /* Android's back button. Listening replaces the default, so the three
     things it should do are spelled out: close what is open (as Escape
     does), go back, or step out of the app when there is nowhere back to. */
  try {
    const back = await App.addListener('backButton', ({ canGoBack }) => {
      const open = document.querySelector(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [data-floating]',
      );
      if (open) {
        const target = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
        return;
      }
      if (canGoBack) window.history.back();
      else void App.minimizeApp().catch(() => {});
    });
    cleanups.push(() => void back.remove());
  } catch {
    /* No back button to listen to. */
  }

  /* A link to this site opened from outside — a reminder, a message — lands
     on its page rather than on the front door. Only our own origin; anything
     else is left to the phone. */
  try {
    const opened = await App.addListener('appUrlOpen', ({ url }) => {
      try {
        const target = new URL(url);
        if (target.origin === window.location.origin) {
          window.location.assign(target.pathname + target.search + target.hash);
        }
      } catch {
        /* Not an address. */
      }
    });
    cleanups.push(() => void opened.remove());
  } catch {
    /* Nothing to open. */
  }

  /* The splash stays up until the first page has painted — the shell's config
     keeps it, this lets it go. A page that never gets here is covered by the
     shell's own time limit. */
  void SplashScreen.hide().catch(() => {});

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
