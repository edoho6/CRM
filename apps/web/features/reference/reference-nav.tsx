'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { usePathname } from '@clinic/i18n/navigation';
import { SegmentedLinks } from '@/components/segmented-links';

/**
 * Sub-navigation for the reference library.
 *
 * Three catalogues, none of which knows anything about stock: what a herb is,
 * what a formula is made of, where a point sits.
 */
const SECTIONS = [
  { href: '/reference/herbs', labelKey: 'herbs' },
  { href: '/reference/formulas', labelKey: 'formulas' },
  { href: '/reference/points', labelKey: 'points' },
] as const;

/** On the compare page the catalogue is in the query, not the path. */
const KIND_TO_SECTION: Record<string, string> = {
  herb: '/reference/herbs',
  formula: '/reference/formulas',
  point: '/reference/points',
};

export function ReferenceNav() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const comparing = pathname.startsWith('/reference/compare')
    ? KIND_TO_SECTION[searchParams.get('kind') ?? '']
    : undefined;

  return (
    <SegmentedLinks
      as="nav"
      label={t('reference')}
      className="mb-5"
      items={SECTIONS.map((section) => ({
        href: section.href,
        label: t(section.labelKey),
        active: pathname.startsWith(section.href) || comparing === section.href,
      }))}
    />
  );
}
