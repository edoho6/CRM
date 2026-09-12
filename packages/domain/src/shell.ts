/**
 * The store apps — iOS and Android — are thin: a native web view that loads
 * this very site, with a suffix on its user agent so the site can tell it is
 * inside one. Everything the site does differently in a shell keys off that
 * one string, parsed here and nowhere else: no "add to home screen" hint, no
 * front-door redirect to the brochure page, a top bar that makes room for the
 * phone's status bar, downloads that step aside.
 *
 * The suffix is what `appendUserAgent` in each shell's capacitor.config.ts
 * appends. That file cannot import this one (the Capacitor CLI loads it on
 * its own, outside the workspace), so a test reads both configs and checks
 * that what they append still parses here.
 */
export type ShellApp = 'clinic' | 'portal';
export type ShellPlatform = 'ios' | 'android';

export interface ShellIdentity {
  app: ShellApp;
  platform: ShellPlatform;
  /** The shell's own version — the store build, not the site's. */
  version: string;
}

/** `HerbalistShell/1.2.0 (clinic; ios)` — version, app, platform. */
const SHELL_UA = /HerbalistShell\/(\d+(?:\.\d+)*) \((clinic|portal); (ios|android)\)/;

export function shellUserAgentSuffix(app: ShellApp, platform: ShellPlatform, version: string): string {
  return `HerbalistShell/${version} (${app}; ${platform})`;
}

export function parseShellUserAgent(userAgent: string | null | undefined): ShellIdentity | null {
  if (!userAgent) return null;
  const match = SHELL_UA.exec(userAgent);
  if (!match) return null;
  return { version: match[1], app: match[2] as ShellApp, platform: match[3] as ShellPlatform };
}

/**
 * Runs before first paint, from the blocking script in each root layout, so
 * the stylesheet can make room for the status bar in the very first frame.
 * A string for the same reason the theme script is one: a script rendered as
 * a React child runs after the paint it is meant to precede. It writes
 * `data-shell="ios|android"` on `<html>`; the CSS in base.css draws by it.
 */
export const shellInitScript = `try{var u=navigator.userAgent.match(${SHELL_UA.toString()});if(u)document.documentElement.dataset.shell=u[3];}catch(e){}`;
