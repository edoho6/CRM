import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware navigation primitives. Always import `Link`, `redirect`, `useRouter`
 * and `usePathname` from here rather than from `next/link` / `next/navigation`,
 * otherwise the `/he` `/en` prefix gets dropped and the user is bounced to the
 * default locale mid-session.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
