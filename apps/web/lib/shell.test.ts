import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseShellUserAgent, shellInitScript, shellUserAgentSuffix } from '@clinic/domain/shell';

const CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
const SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

describe('the shell user agent', () => {
  it('is recognised on both platforms, for both apps', () => {
    expect(parseShellUserAgent(`${SAFARI} HerbalistShell/1.0.0 (clinic; ios)`)).toEqual({
      app: 'clinic',
      platform: 'ios',
      version: '1.0.0',
    });
    expect(parseShellUserAgent(`${CHROME} HerbalistShell/2.3 (portal; android)`)).toEqual({
      app: 'portal',
      platform: 'android',
      version: '2.3',
    });
  });

  it('is not seen in a plain browser, or in nothing', () => {
    expect(parseShellUserAgent(CHROME)).toBeNull();
    expect(parseShellUserAgent(SAFARI)).toBeNull();
    expect(parseShellUserAgent('')).toBeNull();
    expect(parseShellUserAgent(null)).toBeNull();
    // A near miss — an app the shells do not build — is a browser.
    expect(parseShellUserAgent('HerbalistShell/1.0 (admin; ios)')).toBeNull();
  });

  it('round-trips what the shells append', () => {
    const suffix = shellUserAgentSuffix('portal', 'ios', '1.4.2');
    expect(parseShellUserAgent(`${SAFARI} ${suffix}`)).toEqual({ app: 'portal', platform: 'ios', version: '1.4.2' });
  });

  it('agrees with what each shell config actually appends', () => {
    // The configs cannot import this module, so the format lives in two
    // places; this is what keeps them the same.
    const root = path.resolve(__dirname, '..', '..', '..');
    for (const app of ['clinic', 'portal'] as const) {
      const config = fs.readFileSync(path.join(root, 'apps', `mobile-${app}`, 'capacitor.config.ts'), 'utf8');
      for (const platform of ['ios', 'android'] as const) {
        const suffix = shellUserAgentSuffix(app, platform, '1.0.0');
        // The version comes from package.json at build time; the rest is literal.
        expect(config).toContain(suffix.replace('1.0.0', '${version}'));
      }
    }
  });
});

describe('the pre-paint shell script', () => {
  const run = (userAgent: string) => {
    const dataset: Record<string, string> = {};
    new Function('navigator', 'document', shellInitScript)({ userAgent }, { documentElement: { dataset } });
    return dataset;
  };

  it('is valid JavaScript', () => {
    expect(() => new Function(shellInitScript)).not.toThrow();
  });

  it('marks the platform on the document, and only in a shell', () => {
    expect(run(`${SAFARI} HerbalistShell/1.0.0 (clinic; ios)`)).toEqual({ shell: 'ios' });
    expect(run(`${CHROME} HerbalistShell/1.0.0 (portal; android)`)).toEqual({ shell: 'android' });
    expect(run(CHROME)).toEqual({});
  });
});
