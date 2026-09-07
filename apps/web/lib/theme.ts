/**
 * Theme constants, in a plain module on purpose.
 *
 * `themeInitScript` is read by the root layout, which is a server component. A
 * non-component value exported from a `'use client'` module arrives on the
 * server as a client reference rather than as the string itself, and fails at
 * runtime rather than in the build — so the constants live here and the toggle
 * imports them, not the other way round.
 */

export type ThemeChoice = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'herbalist-theme';

/**
 * Runs before first paint, from a blocking script in the document head, so the
 * page never renders light and then flips to dark.
 *
 * Deliberately tiny — it is on the critical path of every page load — and
 * wrapped in try/catch because a browser set to block site data throws on
 * localStorage access rather than returning null.
 */
export const themeInitScript = `(function(){try{
var s=localStorage.getItem('${THEME_STORAGE_KEY}');
var d=s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.dataset.theme=d?'dark':'light';
}catch(e){document.documentElement.dataset.theme='light';}})();`;
