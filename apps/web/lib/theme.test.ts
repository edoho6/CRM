import { describe, expect, it } from 'vitest';
import { themeInitScript } from './theme';
import { PREF_KEYS } from './prefs';

describe('the pre-paint script', () => {
  it('is valid JavaScript', () => {
    expect(() => new Function(themeInitScript)).not.toThrow();
  });

  it('reads every remembered layout preference by its real key', () => {
    for (const key of [
      PREF_KEYS.theme,
      PREF_KEYS.sidebarCollapsed,
      PREF_KEYS.tableSize,
      PREF_KEYS.kpiMode,
      PREF_KEYS.gettingStartedHidden,
      PREF_KEYS.openFiles,
    ]) {
      expect(themeInitScript).toContain(`'${key}'`);
    }
  });

  it('paints the remembered layout from storage', () => {
    const dataset: Record<string, string> = {};
    const stored: Record<string, string> = {
      [PREF_KEYS.theme]: 'dark',
      [PREF_KEYS.sidebarCollapsed]: '1',
      [PREF_KEYS.tableSize]: 'compact',
      [PREF_KEYS.kpiMode]: 'hidden',
      [PREF_KEYS.gettingStartedHidden]: '1',
    };
    const storage = { getItem: (key: string) => stored[key] ?? null };
    const sandbox = {
      document: {
        documentElement: { dataset },
        querySelector: () => ({ content: '' }),
      },
      localStorage: storage,
      sessionStorage: { getItem: () => '[{"kind":"patient"}]' },
      window: { matchMedia: () => ({ matches: false }) },
    };
    new Function('document', 'localStorage', 'sessionStorage', 'window', themeInitScript)(
      sandbox.document,
      sandbox.localStorage,
      sandbox.sessionStorage,
      sandbox.window,
    );
    expect(dataset).toEqual({
      theme: 'dark',
      sidebar: 'collapsed',
      tableSize: 'compact',
      kpiMode: 'hidden',
      gettingStarted: 'hidden',
      openFiles: '1',
    });
  });

  it('ignores a value it does not recognise', () => {
    const dataset: Record<string, string> = {};
    const storage = { getItem: (key: string) => (key === PREF_KEYS.tableSize ? 'huge' : null) };
    new Function('document', 'localStorage', 'sessionStorage', 'window', themeInitScript)(
      { documentElement: { dataset }, querySelector: () => null },
      storage,
      { getItem: () => null },
      { matchMedia: () => ({ matches: false }) },
    );
    expect(dataset).toEqual({ theme: 'light' });
  });

  it('marks the store app from its user agent, before anything paints', () => {
    const run = (userAgent: string) => {
      const dataset: Record<string, string> = {};
      new Function('document', 'localStorage', 'sessionStorage', 'window', 'navigator', themeInitScript)(
        { documentElement: { dataset }, querySelector: () => null },
        { getItem: () => null },
        { getItem: () => null },
        { matchMedia: () => ({ matches: false }) },
        { userAgent },
      );
      return dataset;
    };
    expect(run('Mozilla/5.0 (iPhone) HerbalistShell/1.0.0 (clinic; ios)')).toEqual({ theme: 'light', shell: 'ios' });
    expect(run('Mozilla/5.0 (iPhone) Safari/605.1.15')).toEqual({ theme: 'light' });
  });
});
