'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BookMarked, Send, Trash2 } from 'lucide-react';
import { Alert, Button, EmptyState, Spinner, Textarea, cn } from '@clinic/ui';
import { LIBRARY_LIMITS, type LibraryAnswer, type LibraryCitation } from '@clinic/domain';
import { ExternalLink } from '@/components/external-link';

/**
 * The conversation with the library. It lives in this tab and nowhere else:
 * the turns sit in sessionStorage, the server keeps none of them, and each
 * question goes up with at most the last few turns for a follow-up. The
 * server's reply is shown as it came — the answer with its markers, the
 * passages it cites, and the disclaimer field under every answer, whatever
 * its status.
 */

interface Reply extends LibraryAnswer {
  retrieved: { sourceId: string; title: string; url: string | null; page: number | null }[];
  error?: string;
}

interface Turn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reply?: Reply;
}

const STORAGE_KEY = 'herbalist-library-chat';

function readStored(): Turn[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Turn[]) : [];
    return Array.isArray(parsed) ? parsed.slice(-40) : [];
  } catch {
    return [];
  }
}

function writeStored(turns: Turn[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(turns.slice(-40)));
  } catch {
    // A private window, or storage disabled: the conversation lasts as long as the page does.
  }
}

export function LibraryChat({ configured, examples }: { configured: boolean; examples: string[] }) {
  const t = useTranslations('library');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTurns(readStored());
  }, []);

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }, [turns, pending]);

  async function send(text: string) {
    const value = text.trim();
    if (!value || pending) return;
    setFailed(false);
    const userTurn: Turn = { id: crypto.randomUUID(), role: 'user', content: value };
    const next = [...turns, userTurn];
    setTurns(next);
    writeStored(next);
    setQuestion('');
    setPending(true);
    try {
      const history = turns
        .slice(-LIBRARY_LIMITS.historyTurns * 2)
        .map((turn) => ({ role: turn.role, content: turn.content.slice(0, LIBRARY_LIMITS.historyChars) }));
      const response = await fetch('/api/library/ask', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: value, history }),
      });
      if (!response.ok) throw new Error(`http_${response.status}`);
      const reply = (await response.json()) as Reply;
      const answerTurn: Turn = { id: crypto.randomUUID(), role: 'assistant', content: reply.answer, reply };
      const after = [...next, answerTurn];
      setTurns(after);
      writeStored(after);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  }

  function clear() {
    setTurns([]);
    writeStored([]);
    setFailed(false);
  }

  if (!configured) {
    return <EmptyState icon={<BookMarked className="h-8 w-8" />} title={t('notConfigured')} description={t('notConfiguredBody')} />;
  }

  return (
    <div className="space-y-4">
      <div ref={listRef} className="space-y-4" aria-live="polite" aria-busy={pending}>
        {turns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-200 p-4">
            <p className="text-sm text-ink-600">{t('empty')}</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {examples.map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    onClick={() => send(example)}
                    className="rounded-full border border-ink-200 bg-white px-3 py-1 text-sm text-ink-800 hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {turns.map((turn) => (turn.role === 'user' ? <UserTurn key={turn.id} text={turn.content} /> : <AssistantTurn key={turn.id} turn={turn} />))}
        {pending ? (
          <p className="flex items-center gap-2 text-sm text-ink-600" role="status">
            <Spinner className="h-4 w-4" />
            {t('thinking')}
          </p>
        ) : null}
        {failed ? <Alert tone="danger">{t('status.error')}</Alert> : null}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(question);
        }}
        className="rounded-xl border border-ink-200 bg-white p-3 shadow-sm"
      >
        <label htmlFor="library-question" className="sr-only">
          {t('placeholder')}
        </label>
        <Textarea
          id="library-question"
          ref={inputRef}
          rows={2}
          value={question}
          maxLength={LIBRARY_LIMITS.questionChars}
          disabled={pending}
          placeholder={t('placeholder')}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send(question);
            }
          }}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-ink-500">
            {t('enterHint')} · {t('chars', { count: question.length, max: LIBRARY_LIMITS.questionChars })}
          </span>
          <span className="flex items-center gap-2">
            {turns.length > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={pending}>
                <Trash2 className="h-4 w-4" aria-hidden />
                {t('clear')}
              </Button>
            ) : null}
            <Button type="submit" disabled={pending || !question.trim()}>
              <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
              {t('send')}
            </Button>
          </span>
        </div>
      </form>
    </div>
  );
}

function UserTurn({ text }: { text: string }) {
  const t = useTranslations('library');
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-ee-sm bg-jade-50 px-4 py-2 text-sm text-ink-900">
        <span className="sr-only">{t('you')}: </span>
        <span className="whitespace-pre-wrap" dir="auto">
          {text}
        </span>
      </div>
    </div>
  );
}

function AssistantTurn({ turn }: { turn: Turn }) {
  const t = useTranslations('library');
  const reply = turn.reply;
  if (!reply) return null;
  const tone = reply.status === 'answered' ? null : reply.status === 'no_sources' ? 'info' : reply.status === 'error' ? 'danger' : 'warning';
  return (
    <div className="max-w-[95%] space-y-3 rounded-2xl rounded-ss-sm border border-ink-200 bg-white p-4 shadow-sm">
      <span className="sr-only">{t('assistant')}: </span>
      {tone ? (
        <Alert tone={tone} title={t(`status.${reply.status}` as never)}>
          {reply.status === 'error' ? null : <span className="block whitespace-pre-wrap">{reply.answer}</span>}
        </Alert>
      ) : (
        <div className="whitespace-pre-wrap text-sm leading-6 text-ink-900" dir="auto">
          <Marked text={reply.answer} />
        </div>
      )}
      {reply.citations.length > 0 ? (
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold text-ink-600">{reply.status === 'answered' ? t('citations') : t('retrieved')}</h3>
          {reply.citations.map((citation) => (
            <Citation key={`${citation.sourceId}-${citation.n}`} citation={citation} />
          ))}
        </section>
      ) : null}
      {/* The disclaimer is the API's field, printed as it came, under every answer. */}
      <p className="border-t border-ink-100 pt-2 text-xs leading-5 text-ink-600">{reply.disclaimer}</p>
    </div>
  );
}

/** The answer with its [n] markers set small, so the eye reads the text and finds the source. */
function Marked({ text }: { text: string }) {
  const parts = text.split(/(\[[\d\s,]+\])/g);
  return (
    <>
      {parts.map((part, index) =>
        /^\[[\d\s,]+\]$/.test(part) ? (
          <sup key={index} className="ms-0.5 font-medium text-sky-800">
            {part}
          </sup>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

function Citation({ citation }: { citation: LibraryCitation }) {
  const t = useTranslations('library');
  const tc = useTranslations('common');
  return (
    <details className="rounded-lg border border-ink-200 bg-ink-50/60">
      <summary className={cn('cursor-pointer px-3 py-1.5 text-sm text-ink-800', 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus')}>
        <span className="font-medium text-sky-800">[{citation.n}]</span> <span dir="auto">{citation.title}</span>
        {citation.page ? <span className="text-ink-600"> · {t('page', { page: citation.page })}</span> : null}
      </summary>
      <div className="space-y-1.5 border-t border-ink-100 px-3 py-2">
        <p className="whitespace-pre-wrap text-sm text-ink-700" dir="auto">
          {citation.quote}
        </p>
        {citation.url ? (
          <ExternalLink href={citation.url} newTabLabel={tc('opensInNewTab')} className="text-xs underline-offset-2 hover:underline">
            {t('openSource')}
          </ExternalLink>
        ) : null}
      </div>
    </details>
  );
}
