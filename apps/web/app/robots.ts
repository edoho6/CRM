import type { MetadataRoute } from 'next';

/**
 * What search engines may index: the product's own page and the online
 * booking page, and nothing else.
 *
 * Everything behind the sign-in is invisible to a crawler anyway; the
 * sign-in and sign-up pages, the confirmation links and the calendar feeds
 * are reachable and must not turn up in a search. Two pages are wanted
 * found: /about, so a search for the product's name leads somewhere that
 * explains it, and the booking page, so a search for a clinic's name leads
 * a patient to the place to book — along with the stylesheets and pictures
 * a crawler needs to render them properly.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/he/about',
          '/en/about',
          '/he/book/',
          '/en/book/',
          '/_next/static/',
          '/_next/image',
          '/icons/',
          '/manifest.webmanifest',
        ],
        disallow: ['/'],
      },
    ],
  };
}
