import type { CapacitorConfig } from '@capacitor/cli';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The staff app in the stores: a native shell around the live site.
 *
 * Nothing of the site is bundled. `server.url` points the web view at the
 * real address, so the app is always the current release and a store update
 * is only ever for the shell itself. The address comes from the environment
 * — a build for a test server must not be handed the real one by accident —
 * and the user agent suffix is what the site recognises the shell by
 * (packages/domain/src/shell.ts; a test there reads this file).
 *
 * Loaded by the Capacitor CLI on its own, outside the workspace, which is
 * why it reads package.json by hand instead of importing anything of ours.
 */
const { version } = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8')) as { version: string };

const site = process.env.HERBALIST_APP_URL;
if (!site) throw new Error('HERBALIST_APP_URL is not set: the address the app opens, e.g. https://app.example.com');
const portal = process.env.HERBALIST_PORTAL_URL;
const hosts = [site, portal].filter((url): url is string => Boolean(url)).map((url) => new URL(url).host);

const config: CapacitorConfig = {
  appId: 'il.co.herbalist.clinic',
  appName: 'הרבליסט',
  webDir: 'www',
  server: {
    url: site,
    // Our two sites stay in the web view; any other address opens in the
    // phone's browser.
    allowNavigation: hosts,
    // When the site cannot be reached: the local page with a retry button.
    errorPath: 'error.html',
  },
  ios: {
    appendUserAgent: `HerbalistShell/${version} (clinic; ios)`,
  },
  android: {
    appendUserAgent: `HerbalistShell/${version} (clinic; android)`,
  },
  // The messaging plugin's own note: without this, Swift Package Manager
  // trips over two packages with one identity.
  experimental: {
    ios: {
      spm: {
        packageOptions: {
          '@capacitor-firebase/messaging': { symlink: true },
        },
      },
    },
  },
  plugins: {
    FirebaseMessaging: {
      presentationOptions: ['alert', 'badge', 'sound'],
    },
    SplashScreen: {
      // Up until the first page has painted (the bridge hides it), and no
      // longer than this if the page never gets there.
      launchAutoHide: true,
      launchShowDuration: 3000,
      launchFadeOutDuration: 200,
      backgroundColor: '#16a25c',
      showSpinner: false,
    },
    StatusBar: {
      // The light theme's page background; the bridge follows the theme from there.
      style: 'LIGHT',
      backgroundColor: '#f7f8f8',
    },
  },
};

export default config;
