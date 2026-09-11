'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { formatDate } from '@clinic/i18n';
import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  SignaturePad,
  Spinner,
  type SignatureValue,
} from '@clinic/ui';
import { recordPortalConsent } from '../forms/actions';

/**
 * One consent document, read and decided by the patient themself.
 *
 * The full text is on the page rather than behind a link. A consent recorded
 * against a document the person could have read is worth less than one recorded
 * against a document they had to scroll past, and the difference costs nothing.
 *
 * Withdrawing is offered beside granting, in the same weight of button. A
 * consent that is easy to give and hard to take back is not consent, and the
 * portal is the one place a patient can do it without asking someone.
 */
export function ConsentCard({
  documentId,
  kind,
  title,
  body,
  version,
  decided,
  granted,
  decidedAt = null,
}: {
  documentId: string;
  kind: 'terms' | 'privacy' | 'treatment' | 'marketing';
  title: string;
  body: string;
  version: number;
  /** True when a decision already exists for this kind. */
  decided: boolean;
  granted: boolean;
  /** When that decision was made, for "agreed on". */
  decidedAt?: string | null;
}) {
  const t = useTranslations('portal.consent');
  const tc = useTranslations('common');

  const [signature, setSignature] = useState<SignatureValue | null>(null);
  const [done, setDone] = useState<null | 'granted' | 'withdrawn'>(null);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

  // "I agree" opens only once the whole document has been in view: a
  // consent given to a text you could only see the first paragraph of is
  // not consent. A short document that fits without scrolling counts as
  // read at once.
  const bodyRef = useRef<HTMLDivElement>(null);
  const [readToEnd, setReadToEnd] = useState(false);
  const noteEnd = () => {
    const el = bodyRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setReadToEnd(true);
  };
  useEffect(() => {
    const el = bodyRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 4) setReadToEnd(true);
  }, []);

  function decide(grant: boolean) {
    setError(false);
    startTransition(async () => {
      const result = await recordPortalConsent({
        document_id: documentId,
        kind,
        granted: grant,
        // Withdrawal is never signed: asking someone to sign in order to take a
        // permission back is an obstacle in front of a right.
        signature: grant ? signature : null,
      });
      if (!result.ok) {
        setError(true);
        return;
      }
      setSignature(null);
      setDone(grant ? 'granted' : 'withdrawn');
    });
  }

  const state = done ?? (decided ? (granted ? 'granted' : 'withdrawn') : null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        {error ? <Alert tone="danger">{tc('errorGeneric')}</Alert> : null}

        {state === 'granted' ? (
          <Alert tone="success">
            {decidedAt && !done
              ? t('grantedOn', { date: formatDate(new Date(decidedAt)) })
              : t('granted')}
          </Alert>
        ) : null}
        {state === 'withdrawn' ? <Alert tone="info">{t('withdrawn')}</Alert> : null}

        {/* The text itself, scrollable rather than truncated: a document you can
            only see the first paragraph of is a document you have not read. */}
        <div
          ref={bodyRef}
          onScroll={noteEnd}
          className="max-h-72 overflow-y-auto overscroll-contain rounded-lg border border-ink-200 bg-ink-50 p-3 text-sm whitespace-pre-line text-ink-800 print:max-h-none print:overflow-visible"
          dir="auto"
          tabIndex={0}
          role="region"
          aria-label={title}
        >
          {body}
        </div>

        <p className="text-xs text-ink-600">{t('version', { version })}</p>

        {state !== 'granted' ? (
          <>
            <div className="rounded-lg border border-ink-200 p-3">
              <SignaturePad
                value={signature}
                onChange={setSignature}
                labels={{
                  legend: t('signature.legend'),
                  draw: t('signature.draw'),
                  type: t('signature.type'),
                  drawHint: t('signature.drawHint'),
                  typeHint: t('signature.typeHint'),
                  typedLabel: t('signature.typedLabel'),
                  clear: t('signature.clear'),
                }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              {!readToEnd ? (
                <p className="text-xs text-ink-600" role="status">
                  {t('readAll')}
                </p>
              ) : null}
              <Button size="lg" onClick={() => decide(true)} disabled={isPending || !readToEnd}>
                {isPending ? <Spinner /> : <Check className="h-4 w-4" />}
                {t('agree')}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex justify-end">
            <Button size="lg" variant="secondary" onClick={() => decide(false)} disabled={isPending}>
              {isPending ? <Spinner /> : <X className="h-4 w-4" />}
              {t('withdraw')}
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
