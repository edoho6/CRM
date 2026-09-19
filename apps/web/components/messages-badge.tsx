'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@clinic/ui';
import { unreadConversations } from '@/features/whatsapp/actions';

/** How often the menu asks. A minute is soon enough for a count beside a word. */
const POLL_MS = 60_000;

/**
 * The number beside "Messages" in the menu: how many WhatsApp threads hold
 * something unread. Polled while the app is open and again when the tab
 * comes back into view; nothing is shown when the answer is zero.
 */
export function MessagesBadge({ className }: { className?: string }) {
  const t = useTranslations('messages.inbox');
  const [count, setCount] = useState(0);

  useEffect(() => {
    // The answer lands in a callback, never in the effect's own turn: a count
    // set synchronously here would draw the badge twice on every mount.
    const poll = () => {
      void unreadConversations().then((result) => {
        if (result.ok) setCount(result.data);
      });
    };
    poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (count === 0) return null;
  return (
    <span className={cn('rounded-full bg-accent px-1.5 py-0.5 text-xs font-semibold leading-none text-accent-fg', className)}>
      <span className="sr-only">{t('unreadThreads', { count })}</span>
      <span aria-hidden>{count}</span>
    </span>
  );
}
