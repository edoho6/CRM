import type { CapacitorConfig } from '@capacitor/cli';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The patient portal in the stores: a native shell around the live site.
 *
 * The same shape as the staff app's shell (see apps/mobile-clinic), with
 * the portal's address and identity. Nothing of the site is bundled: the
 * web view opens `server.url`, and the user agent suffix is what the site
 * recognises the shell by (packages/domain/src/shell.ts).
 */
const { version } = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8')) as { version: string };

const site = process.env.HERBALIST_PORTAL_URL;
if (!site) throw new Error('HERBALIST_PORTAL_URL is not set: the address the app opens, e.g. https://portal.example.com');
const staff = process.env.HERBALIST_APP_URL;
const hosts = [site, staff].filter((url): url is string => Boolean(url)).map((url) => new URL(url).host);

const config: CapacitorConfig = {
  appId: 'il.co.herbalist.portal',
  // The name under the icon: short, so a home screen does not cut it. The
  // store listing carries the full "הרבליסט — אזור המטופל".
  appName: 'הרבליסט מטופלים',
  webDir: 'www',
  server: {
    url: site,
    allowNavigation: hosts,
    errorPath: 'error.html',
  },
  ios: {
    appendUserAgent: `HerbalistShell/${version} (portal; ios)`,
  },
  android: {
    appendUserAgent: `HerbalistShell/${version} (portal; android)`,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 3000,
      launchFadeOutDuration: 200,
      backgroundColor: '#16a25c',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#f7f8f8',
    },
  },
};

export default config;
