import { KPI_MODES, PREF_KEYS, TABLE_SIZES } from './prefs';

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

export const THEME_STORAGE_KEY = PREF_KEYS.theme;

/** What the browser chrome is tinted, per theme: the page background of each. */
export const THEME_COLORS = { light: '#f7f8f8', dark: '#14181a' } as const;

/** Points the `theme-color` meta at the theme in force, so Safari's bars match. */
export function applyThemeColor(dark: boolean) {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = dark ? THEME_COLORS.dark : THEME_COLORS.light;
}

/**
 * Runs before first paint, from a blocking script in the document head, so the
 * page never renders light and then flips to dark — and never renders with
 * the sidebar open and then folds it, or with the tiles showing and then
 * hides them. Every remembered layout choice becomes an attribute on `<html>`
 * that the stylesheet already knows how to draw.
 *
 * Deliberately tiny — it is on the critical path of every page load — and
 * every read is wrapped in try/catch because a browser set to block site data
 * throws on storage access rather than returning null. One failure must not
 * stop the next read.
 */
export const themeInitScript = `(function(){var d=document.documentElement.dataset;
try{var s=localStorage.getItem('${PREF_KEYS.theme}');
var k=s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
d.theme=k?'dark':'light';
var m=document.querySelector('meta[name="theme-color"]');if(m)m.content=k?'${THEME_COLORS.dark}':'${THEME_COLORS.light}';
}catch(e){d.theme='light';}
try{if(localStorage.getItem('${PREF_KEYS.sidebarCollapsed}')==='1')d.sidebar='collapsed';}catch(e){}
try{var t=localStorage.getItem('${PREF_KEYS.tableSize}');if(${JSON.stringify(TABLE_SIZES)}.indexOf(t)>=0)d.tableSize=t;}catch(e){}
try{var p=localStorage.getItem('${PREF_KEYS.kpiMode}');if(${JSON.stringify(KPI_MODES)}.indexOf(p)>=0)d.kpiMode=p;}catch(e){}
try{if(localStorage.getItem('${PREF_KEYS.gettingStartedHidden}')==='1')d.gettingStarted='hidden';}catch(e){}
try{var o=sessionStorage.getItem('${PREF_KEYS.openFiles}');if(o&&o!=='[]')d.openFiles='1';}catch(e){}
})();`;
