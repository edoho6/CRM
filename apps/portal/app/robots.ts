import type { MetadataRoute } from 'next';

/**
 * The patient portal has nothing for a search engine: every page is a
 * patient's own, behind a link sent to them, and the sign-in page is only
 * a form. Nothing is indexed.
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: ['/'] }] };
}
