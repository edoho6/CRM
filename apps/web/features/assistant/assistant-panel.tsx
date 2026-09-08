'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Send, Sparkles } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Input,
  Spinner,
  Table,
  TableWrapper,
  Td,
  Th,
  Tr,
} from '@clinic/ui';
import { askAssistant, type AssistantAnswer } from './actions';

/**
 * Ask a question about the clinic's own data.
 *
 * One question and one answer, not a chat. A conversation invites follow-ups
 * that assume the model remembers, and this one deliberately does not carry
 * history between turns — every question is answered from a query run fresh, so
 * an answer can never quietly drift from what the database says.
 *
 * The table is always shown beside the answer. That is the point rather than a
 * detail: the numbers are the answer and the sentence is a reading of it, and a
 * reading you cannot check against the numbers is a reading you have to trust.
 */
export function AssistantPanel({ examples }: { examples: string[] }) {
  const t = useTranslations('assistant');
  const tc = useTranslations('common');

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [asked, setAsked] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    setErrorKey(null);
    setAnswer(null);
    setAsked(trimmed);

    startTransition(async () => {
      const result = await askAssistant(trimmed);
      if (!result.ok) {
        setErrorKey(result.error.key);
        return;
      }
      setAnswer(result.data);
    });
  }

  function renderError() {
    if (!errorKey) return null;
    if (errorKey.endsWith('assistant_not_configured')) return t('notConfigured');
    if (errorKey.endsWith('assistant_unavailable')) return t('unavailable');
    if (errorKey.endsWith('assistant_gave_up')) return t('gaveUp');
    if (errorKey.endsWith('question_too_long')) return t('tooLong');
    return tc('errorGeneric');
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-3">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              ask(question);
            }}
            className="flex items-end gap-2"
          >
            <div className="min-w-0 flex-1">
              <label htmlFor="assistant_question" className="mb-1 block text-sm font-medium text-ink-800">
                {t('questionLabel')}
              </label>
              <Input
                id="assistant_question"
                ref={inputRef}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={t('placeholder')}
                maxLength={500}
                disabled={isPending}
              />
            </div>
            <Button type="submit" disabled={isPending || !question.trim()}>
              {isPending ? <Spinner /> : <Send className="h-4 w-4" />}
              {t('ask')}
            </Button>
          </form>

          {/* Examples that actually work, rather than a blank box and a hope.
              Clicking one asks it, because reading it and retyping it is the
              only other thing anyone would do with it. */}
          <div className="flex flex-wrap gap-1.5">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                disabled={isPending}
                onClick={() => {
                  setQuestion(example);
                  ask(example);
                  inputRef.current?.focus();
                }}
                className="rounded-full border border-ink-200 bg-ink-50 px-2.5 py-1 text-xs text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-900 disabled:opacity-50"
              >
                {example}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {errorKey ? <Alert tone="danger">{renderError()}</Alert> : null}

      {isPending ? (
        <p className="text-sm text-ink-600" role="status" aria-live="polite">
          {t('thinking')}
        </p>
      ) : null}

      {answer ? (
        <Card>
          <CardBody className="space-y-4">
            <p className="text-xs text-ink-600" dir="auto">
              {asked}
            </p>

            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-jade-700" aria-hidden />
              {/* `whitespace-pre-line` because the model writes in paragraphs and
                  they should stay paragraphs. */}
              <p className="min-w-0 whitespace-pre-line text-sm text-ink-900" dir="auto">
                {answer.text || t('noAnswer')}
              </p>
            </div>

            {answer.tables.map((table, index) => (
              <div key={`${table.query}:${index}`} className="space-y-1">
                <h3 className="text-xs font-medium text-ink-600">{table.query}</h3>
                {table.result.rows.length === 0 ? (
                  <p className="text-sm text-ink-600">{t('noRows')}</p>
                ) : (
                  <TableWrapper>
                    <Table>
                      <thead>
                        <tr>
                          {table.result.columns.map((column) => (
                            <Th key={column}>{column}</Th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {table.result.rows.map((row, rowIndex) => (
                          <Tr key={rowIndex}>
                            {table.result.columns.map((column) => {
                              const value = row[column];
                              const isNumber = typeof value === 'number';
                              return (
                                <Td
                                  key={column}
                                  dir={isNumber ? 'ltr' : 'auto'}
                                  className={isNumber ? 'tabular-nums' : undefined}
                                >
                                  {/* A dash, not a blank and not a zero — no
                                      value recorded is not a value of nought. */}
                                  {value === null || value === '' ? '—' : String(value)}
                                </Td>
                              );
                            })}
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrapper>
                )}
                {table.result.truncated ? (
                  <p className="text-xs text-ink-600">{t('truncated')}</p>
                ) : null}
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
