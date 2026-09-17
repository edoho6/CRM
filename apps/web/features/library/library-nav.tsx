import { getTranslations } from 'next-intl/server';
import { SegmentedLinks } from '@/components/segmented-links';

/**
 * The library's screens: the questions, who asked — and, for the platform
 * admin only, what it holds. A practitioner receives answers and never the
 * list of sources (migration 71), so the link is not shown to them.
 */
export async function LibraryNav({ current, admin = false }: { current: 'chat' | 'sources' | 'activity'; admin?: boolean }) {
  const t = await getTranslations('library.nav');
  return (
    <SegmentedLinks
      label={t('label')}
      items={[
        { href: '/library', label: t('chat'), active: current === 'chat' },
        ...(admin ? [{ href: '/library/sources', label: t('sources'), active: current === 'sources' }] : []),
        { href: '/library/activity', label: t('activity'), active: current === 'activity' },
      ]}
    />
  );
}
