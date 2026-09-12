import type { MetadataRoute } from 'next';

/**
 * The two public pages, in both languages, for the search engines that read
 * a sitemap. A clinic's booking page is the clinic's to publish — it is not
 * listed here, because listing it would take a read of every clinic's
 * settings that the public site has no business making.
 */
const PAGES = ['about', 'accessibility', 'privacy', 'terms', 'delete-account'] as const;
const LOCALES = ['he', 'en'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return PAGES.flatMap((page) =>
    LOCALES.map((locale) => ({
      url: `${base}/${locale}/${page}`,
      lastModified: new Date('2026-09-12'),
      changeFrequency: 'monthly' as const,
      priority: page === 'about' ? 1 : 0.5,
      alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `${base}/${l}/${page}`])) },
    })),
  );
}
