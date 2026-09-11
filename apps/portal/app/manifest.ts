import type { MetadataRoute } from 'next';

/**
 * The portal as a home-screen app. A patient who adds it gets a full-screen
 * window with the clinic's colour behind the status bar, instead of a
 * browser tab; the icon is the same leaf as the tab's.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'הרבליסט — אזור המטופל',
    short_name: 'הרבליסט',
    description: 'Herbalist patient portal',
    start_url: '/he',
    display: 'standalone',
    background_color: '#f7f8f8',
    theme_color: '#f7f8f8',
    dir: 'rtl',
    lang: 'he',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
