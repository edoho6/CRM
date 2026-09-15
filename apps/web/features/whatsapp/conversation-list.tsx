'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageCircle, Plus, Search } from 'lucide-react';
import { Button, Combobox, Dialog, DialogContent, DialogFooter, EmptyNote, Input, SegmentedControl, cn, type ComboboxValue } from '@clinic/ui';
import { formatDate, formatTime } from '@clinic/i18n';
import type { ConversationSummary, PatientOption } from './types';

type Filter = 'all' | 'unread' | 'closed';

/**
 * The threads, most recent first, with what waits in each. A row opens the
 * thread; the switch narrows to the unread or the closed; the field finds a
 * name or a number. "New" opens a thread for a file's number, so a
 * practitioner can start a conversation, not only answer one.
 */
export function ConversationList({
  conversations,
  activeId,
  patients,
  onSelect,
  onOpenFor,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  patients: PatientOption[];
  onSelect: (id: string) => void;
  onOpenFor: (patientId: string) => Promise<boolean>;
}) {
  const t = useTranslations('messages.inbox');
  const tc = useTranslations('common');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [starting, setStarting] = useState(false);
  const [choice, setChoice] = useState<ComboboxValue | null>(null);
  const [busy, setBusy] = useState(false);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return conversations.filter((row) => {
      if (filter === 'unread' && row.unread === 0) return false;
      if (filter === 'closed' && row.status !== 'closed') return false;
      if (filter !== 'closed' && row.status === 'closed') return false;
      if (!needle) return true;
      return [row.patient?.fullName, row.contactName, row.phone, row.contactKey]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [conversations, filter, query]);

  const options = useMemo(
    () => patients.filter((patient) => patient.phone).map((patient) => ({ id: patient.id, label: patient.fullName, tertiary: patient.phone, keywords: patient.phone ?? undefined })),
    [patients],
  );

  async function start() {
    if (!choice?.id) return;
    setBusy(true);
    const ok = await onOpenFor(choice.id);
    setBusy(false);
    if (ok) {
      setStarting(false);
      setChoice(null);
    }
  }

  return (
    <div className="space-y-2" data-conversation-list>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search')}
            aria-label={t('search')}
            className="h-9 ps-8"
          />
        </div>
        <Button type="button" size="sm" onClick={() => setStarting(true)} data-conversation-new>
          <Plus className="h-4 w-4" aria-hidden />
          {t('newConversation')}
        </Button>
      </div>
      <SegmentedControl
        label={t('filterLabel')}
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: t('filters.all') },
          { value: 'unread', label: t('filters.unread') },
          { value: 'closed', label: t('filters.closed') },
        ]}
      />

      {shown.length === 0 ? (
        <EmptyNote>{conversations.length === 0 ? t('empty') : t('noMatch')}</EmptyNote>
      ) : (
        <ul className="space-y-0.5">
          {shown.map((row) => {
            const name = row.patient?.fullName ?? row.contactName ?? row.phone ?? row.contactKey;
            const active = row.id === activeId;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onSelect(row.id)}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                    active ? 'bg-ink-100' : 'hover:bg-ink-50',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                      row.patient ? 'bg-jade-50 text-jade-800' : 'bg-ink-100 text-ink-600',
                    )}
                  >
                    {initial(name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn('truncate text-sm', row.unread > 0 ? 'font-semibold text-ink-900' : 'text-ink-900')} dir="auto">
                        {name}
                      </span>
                      <span dir="ltr" className="shrink-0 text-xs tabular-nums text-ink-500">
                        {whenLabel(row.lastMessageAt)}
                      </span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-ink-600" dir="auto">
                        {row.preview ?? ''}
                      </span>
                      {row.unread > 0 ? (
                        <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold leading-none text-accent-fg">
                          <span className="sr-only">{t('unreadCount', { count: row.unread })}</span>
                          <span aria-hidden>{row.unread}</span>
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={starting} onOpenChange={setStarting}>
        {starting ? (
          <DialogContent title={t('newConversation')} closeLabel={tc('close')}>
            <div className="space-y-3">
              <p className="text-sm text-ink-600">{t('newIntro')}</p>
              <Combobox
                id="conversation_patient"
                label={t('choosePatient')}
                options={options}
                value={choice}
                onChange={setChoice}
                placeholder={t('choosePatient')}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setStarting(false)}>
                {tc('cancel')}
              </Button>
              <Button type="button" disabled={!choice?.id || busy} onClick={() => void start()}>
                <MessageCircle className="h-4 w-4" aria-hidden />
                {t('start')}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function initial(name: string): string {
  const first = name.trim().charAt(0);
  return /\d/.test(first) ? '#' : first.toUpperCase();
}

/** Today: the hour; otherwise the date. */
function whenLabel(iso: string): string {
  const at = new Date(iso);
  const now = new Date();
  const sameDay = at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth() && at.getDate() === now.getDate();
  return sameDay ? formatTime(at) : formatDate(at);
}
