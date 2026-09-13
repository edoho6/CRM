'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BookMarked, Send, Trash2 } from 'lucide-react';
import { Alert, Button, EmptyState, Spinner, Textarea, cn } from '@clinic/ui';
import { LIBRARY_LIMITS, type LibraryAnswer, type LibraryCitation, type LibraryStage, type LibraryStreamEvent } from '@clinic/domain';
import { ExternalLink } from '@/components/external-link';
import { readNdjson } from './ndjson';

/**
 * The conversation with the library. It lives in this tab and nowhere else:
 * the turns sit in sessionStorage, the server keeps none of them, and each
 * question goes up with at most the last few turns for a follow-up. The
 * server's reply is shown as it came — the answer with its markers, the
 * passages it cites, and the disclaimer field under every answer, whatever
 * its status.
 *
 * The wait is streamed, the answer is not: the reply arrives line by line
 * (searching, reading N passages, writing, checking) and the text only
 * comes once the checks have passed it. On the page the new answer is then
 * revealed word by word — a reveal, not a stream, because a sentence the
 * checks would strike must never be read before they strike it.
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

interface Progress {
  stage: LibraryStage;
  passages: number | null;
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
  const [progress, setProgress] = useState<Progress | null>(null);
  // Only the answer that has just arrived is revealed word by word; the
  // ones read back from the tab's storage are simply there.
  const [revealId, setRevealId] = useState<string | null>(null);
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
        headers: { 'content-type': 'application/json', accept: 'application/x-ndjson, application/json' },
        body: JSON.stringify({ question: value, history }),
      });
      if (!response.ok) throw new Error(`http_${response.status}`);
      const reply = await readReply(response, setProgress);
      const answerTurn: Turn = { id: crypto.randomUUID(), role: 'assistant', content: reply.answer, reply };
      const after = [...next, answerTurn];
      setRevealId(answerTurn.id);
      setTurns(after);
      writeStored(after);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
      setProgress(null);
      inputRef.current?.focus();
    }
  }

  const progressText = (current: Progress | null) => {
    if (!current) return t('thinking');
    switch (current.stage) {
      case 'searching':
        return t('stages.searching');
      case 'reading':
        return t('stages.reading', { count: current.passages ?? 0 });
      case 'writing':
        return t('stages.writing');
      case 'checking':
        return t('stages.checking');
    }
  };

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
        {turns.map((turn) =>
          turn.role === 'user' ? <UserTurn key={turn.id} text={turn.content} /> : <AssistantTurn key={turn.id} turn={turn} reveal={turn.id === revealId} />,
        )}
        {pending ? (
          <p className="flex items-center gap-2 text-sm text-ink-600" role="status">
            <Spinner className="h-4 w-4" />
            {progressText(progress)}
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

function AssistantTurn({ turn, reveal }: { turn: Turn; reveal: boolean }) {
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
          <RevealedText text={reply.answer} animate={reveal} />
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

/**
 * The answer written out over a second or two. The whole text is in the
 * page from the first frame for a screen reader (the live region reads it
 * once); only what the eye sees grows. Reduced motion shows it at once.
 */
function RevealedText({ text, animate }: { text: string; animate: boolean }) {
  const [shown, setShown] = useState(animate ? 0 : text.length);
  useEffect(() => {
    if (!animate) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(text.length);
      return;
    }
    const step = Math.max(3, Math.ceil(text.length / 90));
    let count = 0;
    let frame = requestAnimationFrame(function tick() {
      count = Math.min(text.length, count + step);
      setShown(count);
      if (count < text.length) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [animate, text]);
  if (shown >= text.length) return <Marked text={text} />;
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        <Marked text={text.slice(0, shown)} />
        <span className="ms-0.5 inline-block h-4 w-0.5 animate-pulse bg-ink-500 align-middle" />
      </span>
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
