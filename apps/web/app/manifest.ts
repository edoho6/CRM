import type { MetadataRoute } from 'next';

/**
 * The clinic app as a home-screen app: opened from the phone's home screen
 * it runs full-screen, with the page colour behind the status bar and the
 * tab bar at the bottom where the thumb is — the shape the whole phone
 * layout was built for.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'הרבליסט',
    short_name: 'הרבליסט',
    description: 'Herbalist clinic management',
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
