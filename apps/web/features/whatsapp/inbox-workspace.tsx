'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessagesSquare } from 'lucide-react';
import { Alert, Button, Sheet, SheetContent, useToast } from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import { ConversationList } from './conversation-list';
import { ConversationThread } from './conversation-thread';
import {
  linkConversationPatient,
  listConversations,
  loadConversation,
  markConversationRead,
  openConversationForPatient,
  retryChatMessage,
  sendChatMessage,
  sendOpener,
  setConversationStatus,
} from './actions';
import type { ConversationSummary, PatientOption, ThreadMessage } from './types';

/** How often the screen asks for news while it is open; a thread's pace, not a task's. */
const POLL_MS = 10_000;

/**
 * WhatsApp, inside the system: the threads in a column (a drawer on a
 * phone), the open one beside it. What patients write arrives through the
 * sending service and is read here every few seconds while the screen is
 * open, and again when the tab comes back into view. What the practitioner
 * writes shows at once and goes within seconds; the service's ticks follow.
 */
export function InboxWorkspace({
  lineConfigured,
  openerConfigured,
  conversations: initialConversations,
  initialActiveId,
  initialMessages,
  patients,
}: {
  lineConfigured: boolean;
  openerConfigured: boolean;
  conversations: ConversationSummary[];
  initialActiveId: string | null;
  initialMessages: ThreadMessage[];
  patients: PatientOption[];
}) {
  const t = useTranslations('messages.inbox');
  const tc = useTranslations('common');
  const { toast } = useToast();
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(initialActiveId);
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeRef = useRef(activeId);
  activeRef.current = activeId;

  const syncUrl = useCallback((id: string | null) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('c', id);
    else url.searchParams.delete('c');
    url.searchParams.delete('patient');
    window.history.replaceState(window.history.state, '', url);
  }, []);

  const active = conversations.find((row) => row.id === activeId) ?? null;

  /** What is new: the list, and the open thread. Quiet on failure — the next tick asks again. */
  const refresh = useCallback(async () => {
    const list = await listConversations();
    if (list.ok) setConversations(list.data);
    const id = activeRef.current;
    if (!id) return;
    const thread = await loadConversation(id);
    if (!thread.ok) return;
    setMessages(thread.data.messages);
    if (thread.data.conversation.unread > 0) {
      void markConversationRead(id);
      setConversations((rows) => rows.map((row) => (row.id === id ? { ...row, unread: 0 } : row)));
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  // The thread the page opened with counts as read the moment it is seen.
  useEffect(() => {
    if (initialActiveId && initialConversations.some((row) => row.id === initialActiveId && row.unread > 0)) {
      void markConversationRead(initialActiveId);
      setConversations((rows) => rows.map((row) => (row.id === initialActiveId ? { ...row, unread: 0 } : row)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function select(id: string) {
    setDrawerOpen(false);
    if (id === activeId) return;
    setActiveId(id);
    syncUrl(id);
    setLoading(true);
    setMessages([]);
    const result = await loadConversation(id);
    setLoading(false);
    if (!result.ok) {
      toast({ tone: 'danger', title: tc('errorGeneric') });
      return;
    }
    setMessages(result.data.messages);
    if (result.data.conversation.unread > 0) {
      void markConversationRead(id);
      setConversations((rows) => rows.map((row) => (row.id === id ? { ...row, unread: 0 } : row)));
    }
  }

  async function send(text: string) {
    if (!activeId) return;
    const temp: ThreadMessage = {
      id: `temp-${Date.now()}`,
      direction: 'out',
      kind: 'text',
      body: text,
      mediaUrl: null,
      status: 'queued',
      errorCode: null,
      templateId: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((list) => [...list, temp]);
    setSending(true);
    const result = await sendChatMessage(activeId, text);
    setSending(false);
    if (!result.ok) {
      setMessages((list) => list.filter((message) => message.id !== temp.id));
      toast({ tone: 'danger', title: tc('errorGeneric') });
      return;
    }
    setMessages((list) => list.map((message) => (message.id === temp.id ? result.data : message)));
    bump(activeId, text);
    // The ticks arrive a moment later.
    setTimeout(() => void refresh(), 3_000);
  }

  async function opener() {
    if (!activeId) return;
    setSending(true);
    const result = await sendOpener(activeId);
    setSending(false);
    if (!result.ok) {
      toast({ tone: 'danger', title: result.error.key === 'errors.serverError' ? tc('errorGeneric') : t('openerMissing') });
      return;
    }
    setMessages((list) => [...list, result.data]);
    bump(activeId, result.data.body ?? '');
    setTimeout(() => void refresh(), 3_000);
  }

  function bump(id: string, preview: string) {
    const now = new Date().toISOString();
    setConversations((rows) =>
      [...rows.map((row) => (row.id === id ? { ...row, lastMessageAt: now, preview } : row))].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)),
    );
  }

  async function retry(messageId: string) {
    setMessages((list) => list.map((message) => (message.id === messageId ? { ...message, status: 'queued', errorCode: null } : message)));
    const result = await retryChatMessage(messageId);
    if (!result.ok) toast({ tone: 'danger', title: tc('errorGeneric') });
    setTimeout(() => void refresh(), 3_000);
  }

  async function link(patientId: string | null): Promise<boolean> {
    if (!activeId) return false;
    const result = await linkConversationPatient(activeId, patientId);
    if (!result.ok) {
      toast({ tone: 'danger', title: tc('errorGeneric') });
      return false;
    }
    const patient = patientId ? patients.find((row) => row.id === patientId) : null;
    setConversations((rows) =>
      rows.map((row) =>
        row.id === activeId
          ? { ...row, patient: patient ? { id: patient.id, fullName: patient.fullName, firstName: patient.fullName.split(' ')[0] ?? patient.fullName } : null }
          : row,
      ),
    );
    return true;
  }

  async function status(next: 'open' | 'closed') {
    if (!activeId) return;
    const result = await setConversationStatus(activeId, next);
    if (!result.ok) {
      toast({ tone: 'danger', title: tc('errorGeneric') });
      return;
    }
    setConversations((rows) => rows.map((row) => (row.id === activeId ? { ...row, status: next } : row)));
  }

  async function openFor(patientId: string): Promise<boolean> {
    const result = await openConversationForPatient(patientId);
    if (!result.ok) {
      toast({ tone: 'danger', title: result.error.key === 'errors.serverError' ? tc('errorGeneric') : t('noPhone') });
      return false;
    }
    const list = await listConversations();
    if (list.ok) setConversations(list.data);
    await select(result.data.id);
    return true;
  }

  const list = <ConversationList conversations={conversations} activeId={activeId} patients={patients} onSelect={(id) => void select(id)} onOpenFor={openFor} />;
  const unread = conversations.reduce((sum, row) => sum + (row.unread > 0 ? 1 : 0), 0);

  return (
    <div className="space-y-3">
      {!lineConfigured ? (
        <Alert tone="warning">
          {t('notConnected')}{' '}
          <Link href="/settings/messaging" className="font-medium underline-offset-2 hover:underline">
            {t('toSettings')}
          </Link>
        </Alert>
      ) : null}
      <div className="flex gap-6">
        <aside className="hidden w-80 shrink-0 lg:block" aria-label={t('list')}>
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pe-1" data-scroll-panel>
            {list}
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center justify-between gap-2 lg:hidden">
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <Button type="button" variant="secondary" size="sm" onClick={() => setDrawerOpen(true)} data-conversation-drawer>
                <MessagesSquare className="h-4 w-4" aria-hidden />
                {t('open')}
                {unread > 0 ? <span className="text-ink-500">({unread})</span> : null}
              </Button>
              <SheetContent title={t('list')} closeLabel={tc('close')} side="start" className="lg:hidden">
                {list}
              </SheetContent>
            </Sheet>
          </div>
          <ConversationThread
            conversation={active}
            messages={messages}
            loading={loading}
            sending={sending}
            patients={patients}
            openerConfigured={openerConfigured}
            onSend={(text) => void send(text)}
            onOpener={() => void opener()}
            onRetry={(id) => void retry(id)}
            onLink={link}
            onStatus={(next) => void status(next)}
          />
        </div>
      </div>
    </div>
  );
}
