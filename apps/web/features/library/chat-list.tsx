'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MoreHorizontal, Pencil, Pin, PinOff, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  cn,
  useConfirm,
} from '@clinic/ui';
import { CHAT_TITLE_MAX, type ChatSummary } from './chat-types';

/**
 * The practitioner's conversations, pinned ones first. A row opens the
 * conversation; its menu pins, renames or deletes it. On a wide screen
 * this is the column beside the messages, on a phone the same list sits
 * in a drawer — the component does not know which.
 */
export function ChatList({
  chats,
  activeId,
  onSelect,
  onNew,
  onRename,
  onPin,
  onDelete,
}: {
  chats: ChatSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations('library.chats');
  const tc = useTranslations('common');
  const confirm = useConfirm();
  const localeTag = useLocaleTag();
  const [renaming, setRenaming] = useState<ChatSummary | null>(null);
  const [draft, setDraft] = useState('');

  const pinned = chats.filter((chat) => chat.pinned);
  const recent = chats.filter((chat) => !chat.pinned);

  async function remove(chat: ChatSummary) {
    const ok = await confirm({ title: t('deleteTitle'), body: t('deleteBody'), confirmLabel: tc('delete'), cancelLabel: tc('cancel'), destructive: true });
    if (ok) onDelete(chat.id);
  }

  const group = (label: string, items: ChatSummary[]) =>
    items.length === 0 ? null : (
      <section aria-label={label} className="space-y-0.5">
        <p className="px-2 pb-1 pt-2 text-xs font-medium text-ink-500">{label}</p>
        <ul className="space-y-0.5">
          {items.map((chat) => (
            <li key={chat.id} className={cn('group flex items-center gap-1 rounded-lg', chat.id === activeId ? 'bg-ink-100' : 'hover:bg-ink-50')}>
              <button
                type="button"
                onClick={() => onSelect(chat.id)}
                aria-current={chat.id === activeId ? 'true' : undefined}
                className="flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-lg px-2 py-1.5 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <span className="w-full truncate text-sm text-ink-900" dir="auto">
                  {chat.title}
                </span>
                <span className="text-xs text-ink-500">{whenLabel(chat.lastMessageAt, localeTag, tc('today'))}</span>
              </button>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={t('menu', { title: chat.title })}
                    className="me-1 rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onPin(chat.id, !chat.pinned)}>
                    {chat.pinned ? <PinOff className="h-4 w-4" aria-hidden /> : <Pin className="h-4 w-4" aria-hidden />}
                    {chat.pinned ? t('unpin') : t('pin')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      setDraft(chat.title);
                      setRenaming(chat);
                    }}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                    {t('rename')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void remove(chat)} className="text-danger">
                    <Trash2 className="h-4 w-4" aria-hidden />
                    {t('delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <nav aria-label={t('title')} className="flex flex-col gap-1" data-chat-list>
      <Button type="button" variant="secondary" onClick={onNew} className="justify-start" data-chat-new>
        <Plus className="h-4 w-4" aria-hidden />
        {t('new')}
      </Button>
      {chats.length === 0 ? <p className="px-2 py-3 text-sm text-ink-600">{t('empty')}</p> : null}
      {group(t('pinned'), pinned)}
      {group(t('recent'), recent)}

      <Dialog open={renaming !== null} onOpenChange={(open) => (open ? null : setRenaming(null))}>
        <DialogContent title={t('renameTitle')} closeLabel={tc('close')} className="max-w-md">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const title = draft.trim();
              if (renaming && title) onRename(renaming.id, title);
              setRenaming(null);
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="chat-title">{t('renameLabel')}</Label>
              <Input id="chat-title" value={draft} maxLength={CHAT_TITLE_MAX} onChange={(event) => setDraft(event.target.value)} autoFocus dir="auto" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setRenaming(null)}>
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={!draft.trim()}>
                {tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </nav>
  );
}

function useLocaleTag(): string {
  const locale = useLocale();
  return locale === 'he' ? 'he-IL' : 'en-GB';
}

/** Today's conversation shows its time, an older one its date — enough to tell them apart in a list. */
function whenLabel(iso: string, localeTag: string, today: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return `${today} ${new Intl.DateTimeFormat(localeTag, { hour: '2-digit', minute: '2-digit' }).format(date)}`;
  return new Intl.DateTimeFormat(localeTag, { day: 'numeric', month: 'short' }).format(date);
}
