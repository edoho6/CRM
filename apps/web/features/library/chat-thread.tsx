'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BookMarked, Send } from 'lucide-react';
import { Alert, Button, Spinner, Textarea } from '@clinic/ui';
import { LIBRARY_DISCLAIMER_HE, LIBRARY_LIMITS, type LibraryStage } from '@clinic/domain';
import { AnswerText } from './answer-text';

export interface ThreadMessage {
  id: string;
  role: 'user' | 'assistant';
  status: 'answered' | 'no_sources' | 'refused_pii' | 'refused_quota' | 'error' | null;
  content: string;
}

export interface Progress {
  stage: LibraryStage;
  passages: number | null;
}

/**
 * One conversation: the messages, the wait, and the box to type in — which
 * stays at the bottom of the window while the page scrolls, above a
 * phone's tab bar. The disclaimer is one line under the box, shown once;
 * the answers carry no source list, by the practitioner's choice, and the
 * checks that used the sources have already run on the server.
 */
export function ChatThread({
  messages,
  pending,
  progress,
  failed,
  loading,
  revealId,
  examples,
  onSend,
}: {
  messages: ThreadMessage[];
  pending: boolean;
  progress: Progress | null;
  failed: boolean;
  loading: boolean;
  revealId: string | null;
  examples: string[];
  onSend: (text: string) => void;
}) {
  const t = useTranslations('library');
  const [question, setQuestion] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }, [messages, pending]);

  useEffect(() => {
    if (!pending) inputRef.current?.focus();
  }, [pending]);

  function submit(text: string) {
    const value = text.trim();
    if (!value || pending) return;
    setQuestion('');
    onSend(value);
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

  return (
    <div className="flex min-h-[60dvh] flex-col" data-chat-thread>
      <div ref={listRef} className="flex-1 space-y-4 pb-4" aria-live="polite" aria-busy={pending || loading}>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-ink-600" role="status">
            <Spinner className="h-4 w-4" />
            {t('chats.loading')}
          </p>
        ) : null}
        {!loading && messages.length === 0 && !pending ? (
          <div className="rounded-2xl border border-dashed border-ink-200 p-5">
            <p className="flex items-center gap-2 text-base font-medium text-ink-900">
              <BookMarked className="h-5 w-5 text-ink-500" aria-hidden />
              {t('chats.welcomeTitle')}
            </p>
            <p className="mt-1 text-sm text-ink-600">{t('chats.welcomeBody')}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {examples.map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    onClick={() => submit(example)}
                    className="rounded-full border border-ink-200 bg-white px-3 py-1 text-sm text-ink-800 hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {messages.map((message) =>
          message.role === 'user' ? <UserMessage key={message.id} text={message.content} /> : <AssistantMessage key={message.id} message={message} reveal={message.id === revealId} />,
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
          submit(question);
        }}
        className="sticky bottom-[var(--bottom-bar,0px)] z-10 -mx-1 border-t border-ink-100 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] pt-3 backdrop-blur"
      >
        <div className="rounded-2xl border border-ink-200 bg-white p-2 shadow-sm focus-within:border-ink-400">
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
            className="border-0 shadow-none focus-visible:ring-0"
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit(question);
              }
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1">
            <span className="text-xs text-ink-500">
              {t('enterHint')} · {t('chars', { count: question.length, max: LIBRARY_LIMITS.questionChars })}
            </span>
            <Button type="submit" size="sm" disabled={pending || !question.trim()} data-chat-send>
              <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
              {t('send')}
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs leading-5 text-ink-500">{LIBRARY_DISCLAIMER_HE}</p>
      </form>
    </div>
  );
}

function UserMessage({ text }: { text: string }) {
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

function AssistantMessage({ message, reveal }: { message: ThreadMessage; reveal: boolean }) {
  const t = useTranslations('library');
  const status = message.status ?? 'answered';
  const tone = status === 'answered' ? null : status === 'no_sources' ? 'info' : status === 'error' ? 'danger' : 'warning';
  return (
    <div className="flex items-start gap-3" data-chat-answer>
      <span className="mt-1 hidden h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-600 sm:flex" aria-hidden>
        <BookMarked className="h-4 w-4" />
      </span>
      <div className="min-w-0 max-w-full flex-1 rounded-2xl rounded-ss-sm border border-ink-200 bg-white px-4 py-3 shadow-sm">
        <span className="sr-only">{t('assistant')}: </span>
        {tone ? (
          <Alert tone={tone} title={t(`status.${status}` as never)}>
            {status === 'error' ? null : <span className="block whitespace-pre-wrap">{message.content}</span>}
          </Alert>
        ) : (
          <AnswerText text={message.content} reveal={reveal} />
        )}
      </div>
    </div>
  );
}
