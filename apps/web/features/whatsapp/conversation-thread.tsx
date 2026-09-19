'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  Check,
  CheckCheck,
  Clock,
  Link2,
  Link2Off,
  Paperclip,
  Send,
  UserPlus,
} from 'lucide-react';
import {
  Alert,
  Button,
  Combobox,
  Dialog,
  DialogContent,
  DialogFooter,
  Spinner,
  Textarea,
  cn,
  type ComboboxValue,
} from '@clinic/ui';
import { WHATSAPP_WINDOW_HOURS, addDaysIn, dateKeyIn } from '@clinic/domain';
import { CLINIC_TIME_ZONE, formatDate, formatTime } from '@clinic/i18n';
import { Link } from '@clinic/i18n/navigation';
import { useNow } from '@/lib/use-now';
import { ExternalLink } from '@/components/external-link';
import { messageErrorKey } from '@/features/messages/error-labels';
import {
  CHAT_MESSAGE_MAX,
  type ConversationSummary,
  type PatientOption,
  type ThreadMessage,
} from './types';

/**
 * One thread: who it is with, what was said either way, and the box to
 * answer from. The service's ticks sit under the clinic's messages; a
 * message it refused says why, with a way to try again. The box knows the
 * rule WhatsApp imposes — free text for a day after the patient last wrote,
 * an approved template after that — and says so rather than letting a
 * message go out to be refused.
 */
export function ConversationThread({
  conversation,
  messages,
  loading,
  sending,
  patients,
  openerConfigured,
  onSend,
  onOpener,
  onRetry,
  onLink,
  onStatus,
}: {
  conversation: ConversationSummary | null;
  messages: ThreadMessage[];
  loading: boolean;
  sending: boolean;
  patients: PatientOption[];
  openerConfigured: boolean;
  /** Resolves false when the message did not go, so the text can be put back. */
  onSend: (text: string) => Promise<boolean>;
  onOpener: () => void;
  onRetry: (messageId: string) => void;
  onLink: (patientId: string | null) => Promise<boolean>;
  onStatus: (status: 'open' | 'closed') => void;
}) {
  const t = useTranslations('messages.inbox');
  const tc = useTranslations('common');
  const tErrors = useTranslations('messages.errors');
  const [draft, setDraft] = useState('');
  const [linking, setLinking] = useState(false);
  const [choice, setChoice] = useState<ComboboxValue | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }, [messages.length, conversation?.id]);

  // A clock that ticks, so "3 hours left" counts down and the window closes on
  // screen when it closes, instead of whenever the thread happens to redraw.
  const now = useNow();
  const lastInboundMs = conversation?.lastInboundAt
    ? new Date(conversation.lastInboundAt).getTime()
    : null;
  const withinWindow =
    lastInboundMs !== null && now - lastInboundMs < WHATSAPP_WINDOW_HOURS * 3_600_000;
  const hoursLeft =
    lastInboundMs !== null
      ? Math.max(0, Math.ceil((lastInboundMs + WHATSAPP_WINDOW_HOURS * 3_600_000 - now) / 3_600_000))
      : 0;

  const options = useMemo(
    () =>
      patients.map((patient) => ({
        id: patient.id,
        label: patient.fullName,
        tertiary: patient.phone,
        keywords: patient.phone ?? undefined,
      })),
    [patients],
  );

  async function submit() {
    const value = draft.trim();
    if (!value || sending || !withinWindow) return;
    setDraft('');
    inputRef.current?.focus();
    // A message that did not go comes back into the box, unless something new
    // has been typed there in the meantime — typing a long reply twice is the
    // failure worth avoiding.
    const sent = await onSend(value);
    if (!sent) setDraft((current) => (current.trim() ? current : value));
  }

  async function link() {
    if (!choice?.id) return;
    const ok = await onLink(choice.id);
    if (ok) {
      setLinking(false);
      setChoice(null);
    }
  }

  if (!conversation) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center rounded-2xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-600">
        {t('selectPrompt')}
      </div>
    );
  }

  const name = conversation.patient?.fullName ?? conversation.contactName ?? t('unknownContact');
  const closed = conversation.status === 'closed';

  return (
    <div className="flex min-h-[60dvh] flex-col" data-conversation-thread>
      {/* Who: the file when there is one, a way to choose it when there is not. */}
      <header className="mb-3 flex flex-wrap items-center gap-2 border-b border-ink-100 pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-ink-900" dir="auto">
            {name}
          </h2>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-600">
            {conversation.phone ? (
              <span dir="ltr" className="tabular-nums">
                {conversation.phone}
              </span>
            ) : null}
            {conversation.contactName && conversation.patient ? (
              <span dir="auto">{conversation.contactName}</span>
            ) : null}
            {closed ? <span className="text-ink-500">{t('closed')}</span> : null}
          </p>
        </div>
        {conversation.patient ? (
          <>
            <Button asChild size="sm" variant="secondary">
              <Link href={`/patients/${conversation.patient.id}`}>{t('openFile')}</Link>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void onLink(null)}
              title={t('unlink')}
              aria-label={t('unlink')}
            >
              <Link2Off className="h-4 w-4" aria-hidden />
            </Button>
          </>
        ) : (
          <>
            <Button type="button" size="sm" variant="secondary" onClick={() => setLinking(true)}>
              <Link2 className="h-4 w-4" aria-hidden />
              {t('linkPatient')}
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/patients/new">
                <UserPlus className="h-4 w-4" aria-hidden />
                {t('newPatient')}
              </Link>
            </Button>
          </>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onStatus(closed ? 'open' : 'closed')}
          title={closed ? t('reopen') : t('close')}
          aria-label={closed ? t('reopen') : t('close')}
        >
          {closed ? (
            <ArchiveRestore className="h-4 w-4" aria-hidden />
          ) : (
            <Archive className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </header>

      <div
        ref={listRef}
        className="flex flex-1 flex-col gap-1.5 pb-4"
        aria-live="polite"
        aria-busy={loading}
      >
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-ink-600" role="status">
            <Spinner className="h-4 w-4" />
            {tc('loading')}
          </p>
        ) : null}
        {!loading && messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-500">{t('threadEmpty')}</p>
        ) : null}
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const newDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
          return (
            <div key={message.id} className="contents">
              {newDay ? (
                <p className="my-2 text-center text-xs text-ink-500">
                  {dayLabel(message.createdAt, t('today'), t('yesterday'))}
                </p>
              ) : null}
              <Bubble
                message={message}
                onRetry={onRetry}
                labels={{
                  attachment: t('attachment'),
                  attachmentHint: t('attachmentHint'),
                  retry: t('retry'),
                  template: t('templateSent'),
                  kind: (kind) => t(`kinds.${kind}`),
                  status: (status) => t(`status.${status}`),
                  error: (code) => tErrors(messageErrorKey(code)),
                  newTab: tc('opensInNewTab'),
                }}
              />
            </div>
          );
        })}
      </div>

      {/* The box: free text for a day after the patient wrote, a template after. */}
      <div className="sticky bottom-[var(--bottom-bar,0px)] z-10 -mx-1 border-t border-ink-100 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] pt-3 backdrop-blur">
        {withinWindow ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
            className="rounded-2xl border border-ink-200 bg-white p-2 shadow-sm focus-within:border-ink-400"
          >
            <label htmlFor="chat-message" className="sr-only">
              {t('composer')}
            </label>
            <Textarea
              id="chat-message"
              ref={inputRef}
              rows={2}
              value={draft}
              maxLength={CHAT_MESSAGE_MAX}
              placeholder={t('composer')}
              disabled={sending}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
              className="min-h-12 resize-none border-0 bg-transparent shadow-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            />
            <div className="flex items-center justify-between gap-2 px-1">
              <p className="text-xs text-ink-500">{t('windowOpen', { hours: hoursLeft })}</p>
              <Button type="submit" size="sm" disabled={sending || !draft.trim()} data-chat-send>
                {sending ? <Spinner /> : <Send className="h-4 w-4" aria-hidden />}
                {t('send')}
              </Button>
            </div>
          </form>
        ) : (
          <Alert tone="info">
            <div className="space-y-2">
              <p>{t('windowClosed')}</p>
              {openerConfigured ? (
                <Button type="button" size="sm" disabled={sending} onClick={onOpener}>
                  {sending ? <Spinner /> : <Send className="h-4 w-4" aria-hidden />}
                  {t('sendOpener')}
                </Button>
              ) : (
                <p className="text-xs">
                  {t('openerMissing')}{' '}
                  <Link
                    href="/settings/messaging"
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {t('toSettings')}
                  </Link>
                </p>
              )}
            </div>
          </Alert>
        )}
      </div>

      <Dialog open={linking} onOpenChange={setLinking}>
        {linking ? (
          <DialogContent title={t('linkTitle')} closeLabel={tc('close')}>
            <Combobox
              id="link_patient"
              label={t('choosePatient')}
              options={options}
              value={choice}
              onChange={setChoice}
              placeholder={t('choosePatient')}
              autoFocus
            />
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setLinking(false)}>
                {tc('cancel')}
              </Button>
              <Button type="button" disabled={!choice?.id} onClick={() => void link()}>
                {t('link')}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function Bubble({
  message,
  onRetry,
  labels,
}: {
  message: ThreadMessage;
  onRetry: (id: string) => void;
  labels: {
    attachment: string;
    attachmentHint: string;
    retry: string;
    template: string;
    kind: (kind: ThreadMessage['kind']) => string;
    status: (status: ThreadMessage['status']) => string;
    error: (code: string | null) => string;
    newTab: string;
  };
}) {
  const out = message.direction === 'out';
  const text = message.body ?? (message.kind !== 'text' ? `[${labels.kind(message.kind)}]` : '');
  return (
    <div className={cn('flex', out ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-xs sm:max-w-[70%]',
          out ? 'rounded-ee-sm bg-jade-50 text-ink-900' : 'rounded-es-sm bg-ink-100 text-ink-900',
        )}
      >
        {message.kind !== 'text' && message.kind !== 'template' && message.kind !== 'button' ? (
          <p className="mb-0.5 text-xs text-ink-500">{labels.kind(message.kind)}</p>
        ) : null}
        {text ? (
          <p className="whitespace-pre-wrap break-words" dir="auto">
            {text}
          </p>
        ) : null}
        {message.mediaUrl ? (
          <p className="mt-1 text-xs">
            <ExternalLink
              href={message.mediaUrl}
              newTabLabel={labels.newTab}
              className="inline-flex items-center gap-1 text-jade-800 underline-offset-2 hover:underline"
            >
              <Paperclip className="h-3.5 w-3.5" aria-hidden />
              {labels.attachment}
            </ExternalLink>{' '}
            <span className="text-ink-500">{labels.attachmentHint}</span>
          </p>
        ) : null}
        <p
          className={cn(
            'mt-1 flex items-center gap-1 text-xs text-ink-500',
            out ? 'justify-end' : 'justify-start',
          )}
        >
          {message.kind === 'template' ? <span>{labels.template} ·</span> : null}
          <span dir="ltr">{formatTime(message.createdAt)}</span>
          {out ? <Ticks status={message.status} label={labels.status(message.status)} /> : null}
        </p>
        {out && message.status === 'failed' ? (
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-red-700">
            <span>{labels.error(message.errorCode)}</span>
            <button
              type="button"
              onClick={() => onRetry(message.id)}
              className="font-medium underline-offset-2 hover:underline"
            >
              {labels.retry}
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** One grey tick sent, two delivered, two blue read — and words for a screen reader. */
function Ticks({ status, label }: { status: ThreadMessage['status']; label: string }) {
  const icon =
    status === 'read' ? (
      <CheckCheck className="h-3.5 w-3.5 text-sky-600" aria-hidden />
    ) : status === 'delivered' ? (
      <CheckCheck className="h-3.5 w-3.5" aria-hidden />
    ) : status === 'sent' ? (
      <Check className="h-3.5 w-3.5" aria-hidden />
    ) : status === 'failed' ? (
      <AlertCircle className="h-3.5 w-3.5 text-red-600" aria-hidden />
    ) : (
      <Clock className="h-3.5 w-3.5" aria-hidden />
    );
  return (
    <span className="inline-flex items-center">
      {icon}
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** The clinic's calendar day of a message: the separators and "today" agree with the times beside them. */
function dayKey(iso: string): string {
  return dateKeyIn(new Date(iso), CLINIC_TIME_ZONE);
}

function dayLabel(iso: string, today: string, yesterday: string): string {
  const now = new Date();
  if (dayKey(iso) === dateKeyIn(now, CLINIC_TIME_ZONE)) return today;
  if (dayKey(iso) === dateKeyIn(addDaysIn(now, -1, CLINIC_TIME_ZONE), CLINIC_TIME_ZONE))
    return yesterday;
  return formatDate(iso);
}
