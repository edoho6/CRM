'use client';

import { useEffect, useState } from 'react';

/**
 * The scene's colours, read from the same tokens the rest of the page uses.
 *
 * WebGL cannot read a CSS variable, so the values are resolved once and
 * again whenever the theme attribute changes or the system preference
 * flips — the two events the theme toggle reacts to. The fallbacks are the
 * light-mode hexes, for the first render before the DOM is available.
 */
export interface SceneColors {
  body: string;
  marker: string;
  markerActive: string;
  editor: string;
}

const FALLBACK: SceneColors = {
  body: '#d9dde0',
  marker: '#15803c',
  markerActive: '#22c573',
  editor: '#d97706',
};

const TOKENS: Record<keyof SceneColors, string> = {
  body: '--color-ink-200',
  marker: '--color-jade-700',
  markerActive: '--color-jade-500',
  editor: '--color-amber-700',
};

function readColors(): SceneColors {
  if (typeof window === 'undefined') return FALLBACK;
  const style = getComputedStyle(document.documentElement);
  const out = { ...FALLBACK };
  for (const key of Object.keys(TOKENS) as (keyof SceneColors)[]) {
    const value = style.getPropertyValue(TOKENS[key]).trim();
    if (value) out[key] = value;
  }
  return out;
}

export function useThemeColors(): SceneColors {
  const [colors, setColors] = useState<SceneColors>(FALLBACK);

  useEffect(() => {
    const update = () => setColors(readColors());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    query.addEventListener('change', update);
    return () => {
      observer.disconnect();
      query.removeEventListener('change', update);
    };
  }, []);

  return colors;
}
