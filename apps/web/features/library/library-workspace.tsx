'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BookMarked, MessagesSquare } from 'lucide-react';
import { Button, EmptyState, Sheet, SheetContent, useToast } from '@clinic/ui';
import { LIBRARY_LIMITS, chatTitleFrom, type LibraryAnswer, type LibraryStreamEvent } from '@clinic/domain';
import { ChatList } from './chat-list';
import { ChatThread, type Progress, type ThreadMessage } from './chat-thread';
import { deleteChat, loadChatMessages, renameChat, setChatPinned } from './chats';
import type { ChatMessage, ChatSummary } from './chat-types';
import { readNdjson } from './ndjson';

/**
 * The library as a chat: the conversations in a column (a drawer on a
 * phone), the open one beside it. Conversations are the practitioner's
 * own and live in the system, so the same list meets them on every
 * device; a new one is opened by the server with its first answer, and
 * named after the question.
 *
 * The wait is streamed, the answer is not: the reply arrives line by line
 * (searching, reading N passages, writing, checking) and the text only
 * comes once the checks have passed it. Changes to the list (pin, rename,
 * delete) show at once and are undone with a word if the save fails.
 */

interface Reply extends LibraryAnswer {
  chatId?: string | null;
  error?: string;
}

const toThread = (message: ChatMessage): ThreadMessage => ({ id: message.id, role: message.role, status: message.status, content: message.content, general: message.general });

export function LibraryWorkspace({
  configured,
  chats: initialChats,
  initialChatId,
  initialMessages,
  examples,
}: {
  configured: boolean;
  chats: ChatSummary[];
  initialChatId: string | null;
  initialMessages: ChatMessage[];
  examples: string[];
}) {
  const t = useTranslations('library');
  const tc = useTranslations('common');
  const { toast } = useToast();
  const [chats, setChats] = useState<ChatSummary[]>(initialChats);
  const [activeId, setActiveId] = useState<string | null>(initialChatId);
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages.map(toThread));
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [revealId, setRevealId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // What each conversation held when it was last seen, so switching back is instant.
  const cache = useRef(new Map<string, ThreadMessage[]>(initialChatId ? [[initialChatId, initialMessages.map(toThread)]] : []));

  const syncUrl = useCallback((id: string | null) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('chat', id);
    else url.searchParams.delete('chat');
    window.history.replaceState(window.history.state, '', url);
  }, []);

  const showMessages = (id: string | null, list: ThreadMessage[]) => {
    if (id) cache.current.set(id, list);
    setMessages(list);
  };

  async function select(id: string) {
    if (id === activeId || pending) return;
    setDrawerOpen(false);
    setFailed(false);
    setActiveId(id);
    syncUrl(id);
    const known = cache.current.get(id);
    if (known) {
      setMessages(known);
      return;
    }
    setLoading(true);
    setMessages([]);
    const result = await loadChatMessages(id);
    setLoading(false);
    if (!result.ok) {
      toast({ tone: 'danger', title: tc('errorGeneric') });
      return;
    }
    showMessages(id, result.data.map(toThread));
  }

  function startNew() {
    if (pending) return;
    setDrawerOpen(false);
    setFailed(false);
    setActiveId(null);
    setMessages([]);
    syncUrl(null);
  }

  async function send(value: string) {
    setFailed(false);
    const userMessage: ThreadMessage = { id: crypto.randomUUID(), role: 'user', status: null, content: value };
    const before = messages;
    const withQuestion = [...before, userMessage];
    showMessages(activeId, withQuestion);
    setPending(true);
    try {
      const history = before
        .slice(-LIBRARY_LIMITS.historyTurns * 2)
        .map((message) => ({ role: message.role, content: message.content.slice(0, LIBRARY_LIMITS.historyChars) }));
      const response = await fetch('/api/library/ask', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/x-ndjson, application/json' },
        body: JSON.stringify({ question: value, history, chatId: activeId ?? undefined }),
      });
      if (!response.ok) throw new Error(`http_${response.status}`);
      const reply = await readReply(response, setProgress);
      const answer: ThreadMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        status: reply.status,
        content: reply.answer,
        general: reply.general ?? null,
        trimmed: reply.trimmed,
      };
      const after = [...withQuestion, answer];
      setRevealId(answer.id);
      const now = new Date().toISOString();
      if (reply.chatId && !activeId) {
        // The server opened the conversation with this first answer.
        const opened: ChatSummary = { id: reply.chatId, title: chatTitleFrom(value) || '…', pinned: false, lastMessageAt: now };
        setChats((list) => [opened, ...list]);
        setActiveId(reply.chatId);
        syncUrl(reply.chatId);
        showMessages(reply.chatId, after);
      } else {
        showMessages(activeId, after);
        if (reply.chatId) setChats((list) => bumped(list, reply.chatId!, now));
      }
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
      setProgress(null);
    }
  }

  async function rename(id: string, title: string) {
    const previous = chats;
    setChats((list) => list.map((chat) => (chat.id === id ? { ...chat, title } : chat)));
    const result = await renameChat(id, title);
    if (!result.ok) {
      setChats(previous);
      toast({ tone: 'danger', title: tc('errorGeneric') });
    }
  }

  async function pin(id: string, pinned: boolean) {
    const previous = chats;
    setChats((list) => sorted(list.map((chat) => (chat.id === id ? { ...chat, pinned } : chat))));
    const result = await setChatPinned(id, pinned);
    if (!result.ok) {
      setChats(previous);
      toast({ tone: 'danger', title: tc('errorGeneric') });
    }
  }

  async function remove(id: string) {
    const previous = chats;
    setChats((list) => list.filter((chat) => chat.id !== id));
    if (id === activeId) {
      setActiveId(null);
      setMessages([]);
      syncUrl(null);
    }
    cache.current.delete(id);
    const result = await deleteChat(id);
    if (!result.ok) {
      setChats(previous);
      toast({ tone: 'danger', title: tc('errorGeneric') });
      return;
    }
    toast({ tone: 'success', title: tc('deleted') });
  }

  if (!configured) {
    return <EmptyState icon={<BookMarked className="h-8 w-8" />} title={t('notConfigured')} description={t('notConfiguredBody')} />;
  }

  const list = <ChatList chats={chats} activeId={activeId} onSelect={(id) => void select(id)} onNew={startNew} onRename={(id, title) => void rename(id, title)} onPin={(id, pinned) => void pin(id, pinned)} onDelete={(id) => void remove(id)} />;

  return (
    <div className="flex gap-6">
      <aside className="hidden w-64 shrink-0 lg:block" aria-label={t('chats.title')}>
        <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pe-1" data-scroll-panel>
          {list}
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center justify-between gap-2 lg:hidden">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <Button type="button" variant="secondary" size="sm" onClick={() => setDrawerOpen(true)} data-chat-drawer>
              <MessagesSquare className="h-4 w-4" aria-hidden />
              {t('chats.open')}
              {chats.length > 0 ? <span className="text-ink-500">({chats.length})</span> : null}
            </Button>
            <SheetContent title={t('chats.title')} closeLabel={tc('close')} side="start" className="lg:hidden">
              {list}
            </SheetContent>
          </Sheet>
        </div>
        <ChatThread messages={messages} pending={pending} progress={progress} failed={failed} loading={loading} revealId={revealId} examples={examples} onSend={(text) => void send(text)} />
      </div>
    </div>
  );
}

/** The reply, streamed when the server streams it and plain JSON otherwise. */
async function readReply(response: Response, onProgress: (progress: Progress) => void): Promise<Reply> {
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('application/x-ndjson') || !response.body) return (await response.json()) as Reply;
  let reply: Reply | null = null;
  for await (const event of readNdjson(response.body)) {
    const line = event as LibraryStreamEvent;
    if (line.type === 'stage') onProgress({ stage: line.stage, passages: line.passages ?? null });
    else if (line.type === 'done') reply = line.reply as Reply;
  }
  if (!reply) throw new Error('stream_ended');
  return reply;
}

/** Pinned first, then by last message — the same order the server lists in. */
function sorted(list: ChatSummary[]): ChatSummary[] {
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.lastMessageAt.localeCompare(a.lastMessageAt));
}

function bumped(list: ChatSummary[], id: string, at: string): ChatSummary[] {
  return sorted(list.map((chat) => (chat.id === id ? { ...chat, lastMessageAt: at } : chat)));
}
