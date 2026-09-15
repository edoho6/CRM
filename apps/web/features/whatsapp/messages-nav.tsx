import { getTranslations } from 'next-intl/server';
import { SegmentedLinks } from '@/components/segmented-links';

/** The two faces of Messages: the WhatsApp threads, and the queue of what goes out on its own. */
export async function MessagesNav({ current }: { current: 'inbox' | 'queue' }) {
  const t = await getTranslations('messages.nav');
  return (
    <SegmentedLinks
      as="nav"
      label={t('label')}
      items={[
        { href: '/messages', label: t('inbox'), active: current === 'inbox' },
        { href: '/messages/queue', label: t('queue'), active: current === 'queue' },
      ]}
    />
  );
}
