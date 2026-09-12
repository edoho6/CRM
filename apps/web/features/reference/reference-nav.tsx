'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { usePathname } from '@clinic/i18n/navigation';
import { FlaskConical, MapPin, Sprout, Stethoscope } from 'lucide-react';
import { SegmentedLinks } from '@/components/segmented-links';

/**
 * Sub-navigation for the reference library.
 *
 * Four catalogues, none of which knows anything about stock: what a herb is,
 * what a formula is made of, where a point sits — and, apart from the three
 * of Chinese medicine, the Western medicine reference of conditions,
 * symptoms and drugs. Each tab carries an icon, because the fourth is a
 * different discipline and should look like one before its name is read.
 */
const SECTIONS = [
  { href: '/reference/herbs', labelKey: 'herbs', Icon: Sprout },
  { href: '/reference/formulas', labelKey: 'formulas', Icon: FlaskConical },
  { href: '/reference/points', labelKey: 'points', Icon: MapPin },
  { href: '/reference/medicine', labelKey: 'medicine', Icon: Stethoscope },
] as const;

/** On the compare page the catalogue is in the query, not the path. */
const KIND_TO_SECTION: Record<string, string> = {
  herb: '/reference/herbs',
  formula: '/reference/formulas',
  point: '/reference/points',
};

/**
 * `compact` is the form for a single record's header: small pills beside the
 * actions, so the switch between catalogues stays one click away without a
 * row of its own pushing the monograph down.
 */
export function ReferenceNav({ compact = false }: { compact?: boolean }) {
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
      size={compact ? 'sm' : 'md'}
      items={SECTIONS.map(({ href, labelKey, Icon }) => ({
        href,
        label: t(labelKey),
        icon: <Icon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />,
        active: pathname.startsWith(href) || comparing === href,
      }))}
    />
  );
}
