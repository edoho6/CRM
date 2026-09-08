'use client';

import { useState, useTransition } from 'react';
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
}: {
  documentId: string;
  kind: 'terms' | 'privacy' | 'treatment' | 'marketing';
  title: string;
  body: string;
  version: number;
  /** True when a decision already exists for this kind. */
  decided: boolean;
  granted: boolean;
}) {
  const t = useTranslations('portal.consent');
  const tc = useTranslations('common');

  const [signature, setSignature] = useState<SignatureValue | null>(null);
  const [done, setDone] = useState<null | 'granted' | 'withdrawn'>(null);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

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

        {state === 'granted' ? <Alert tone="success">{t('granted')}</Alert> : null}
        {state === 'withdrawn' ? <Alert tone="info">{t('withdrawn')}</Alert> : null}

        {/* The text itself, scrollable rather than truncated: a document you can
            only see the first paragraph of is a document you have not read. */}
        <div
          className="max-h-72 overflow-y-auto rounded-lg border border-ink-200 bg-ink-50 p-3 text-sm whitespace-pre-line text-ink-800"
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

            <div className="flex justify-end">
              <Button onClick={() => decide(true)} disabled={isPending}>
                {isPending ? <Spinner /> : <Check className="h-4 w-4" />}
                {t('agree')}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => decide(false)} disabled={isPending}>
              {isPending ? <Spinner /> : <X className="h-4 w-4" />}
              {t('withdraw')}
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
