'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from '@clinic/i18n/navigation';
import { SegmentedLinks } from '@/components/segmented-links';

/**
 * One strip for everything that is set up once.
 *
 * The clinic's settings and the practitioner's personal area are two places
 * — one is about the practice, the other about the person — but for a clinic
 * of one that distinction is invisible, and the personal area used to be
 * reachable only from the menu behind your own name. Both areas now show the
 * same strip, so from either you can see, and reach, the other.
 */
const SECTIONS = [
  { href: '/settings', labelKey: 'general', exact: true },
  { href: '/account', labelKey: 'account', exact: false },
  { href: '/settings/booking', labelKey: 'booking', exact: false },
  { href: '/settings/tags', labelKey: 'tags', exact: false },
  { href: '/settings/access', labelKey: 'access', exact: false },
  { href: '/settings/consent', labelKey: 'consent', exact: false },
  { href: '/billing/settings', labelKey: 'billing', exact: false },
] as const;

export function SettingsNav() {
  const t = useTranslations('settings.nav');
  const pathname = usePathname();

  return (
    <SegmentedLinks
      as="nav"
      label={t('label')}
      className="mb-5"
      items={SECTIONS.map((section) => ({
        href: section.href,
        label: t(section.labelKey),
        active: section.exact ? pathname === section.href : pathname.startsWith(section.href),
      }))}
    />
  );
}
