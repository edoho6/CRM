import { getTranslations } from 'next-intl/server';
import { SegmentedLinks } from '@/components/segmented-links';

/** The library's three screens: the questions, what it holds, who asked. */
export async function LibraryNav({ current }: { current: 'chat' | 'sources' | 'activity' }) {
  const t = await getTranslations('library.nav');
  return (
    <SegmentedLinks
      label={t('label')}
      items={[
        { href: '/library', label: t('chat'), active: current === 'chat' },
        { href: '/library/sources', label: t('sources'), active: current === 'sources' },
        { href: '/library/activity', label: t('activity'), active: current === 'activity' },
      ]}
    />
  );
}
