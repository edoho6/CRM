'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { Input, Select, Spinner } from '@clinic/ui';
import { POINT_CHANNELS } from '@clinic/domain';
import { usePathname, useRouter } from '@clinic/i18n/navigation';

/** Debounced search across every name a point has, plus a channel filter. */
export function PointSearch({ initialQuery, channel }: { initialQuery: string; channel: string }) {
  const t = useTranslations('reference.points');
  const tChannel = useTranslations('reference.pointChannel');
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (value.trim() === initialQuery) return;
      const query: Record<string, string> = {};
      if (value.trim()) query.q = value.trim();
      if (channel) query.channel = channel;
      startTransition(() => {
        router.replace({ pathname, query });
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [value, initialQuery, channel, pathname, router]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-64 flex-1">
        <Search
          className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-ink-400"
          aria-hidden
        />
        <Input
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="ps-9"
        />
      </div>
      <Select
        aria-label={t('fields.channel')}
        value={channel}
        className="w-auto"
        onChange={(event) => {
          const next: Record<string, string> = {};
          if (value.trim()) next.q = value.trim();
          if (event.target.value) next.channel = event.target.value;
          startTransition(() => router.replace({ pathname, query: next }));
        }}
      >
        <option value="">{t('allChannels')}</option>
        {POINT_CHANNELS.map((entry) => (
          <option key={entry} value={entry}>
            {tChannel(entry)}
          </option>
        ))}
      </Select>
      {isPending ? <Spinner className="text-ink-400" /> : null}
    </div>
  );
}
