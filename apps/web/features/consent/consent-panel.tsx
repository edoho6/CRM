'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Download, FileText, X } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Select,
  Spinner,
  SignaturePad,
  useToast,
  type SignatureValue,
} from '@clinic/ui';
import {
  CONSENT_KINDS,
  CONSENT_METHODS,
  type ConsentKind,
  type ConsentMethod,
} from '@clinic/domain';
import { useRouter } from '@clinic/i18n/navigation';
import type {
  ConsentDocument,
  PatientConsentStatus,
  PatientConsentWithDocument,
} from '@clinic/db/types';
import { recordConsent } from './actions';
import { formatDate, formatDateTime } from '@clinic/i18n';

/**
 * Consent, on the patient's file.
 *
 * The four kinds are always listed, including the ones never asked, because an
 * absent consent is a fact about this patient and an empty list would hide it.
 * Each row shows the standing answer and the version of the text it cites; the
 * full history sits underneath, since "granted, then withdrawn" is the part
 * that matters and a single current state cannot express it.
 *
 * Granting requires a published document. When none exists for a kind, the row
 * says so and points at where to publish one rather than offering a button that
 * would fail.
 */
export function ConsentPanel({
  patientId,
  patientName,
  statuses,
  history,
  documents,
}: {
  patientId: string;
  patientName: string;
  statuses: PatientConsentStatus[];
  history: PatientConsentWithDocument[];
  /** Current published document per kind, for the locale in use. */
  documents: ConsentDocument[];
}) {
  const t = useTranslations('consent');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<ConsentMethod>('in_person');

  /*
   * The signature is collected once and applies to the next grant.
   *
   * Not one pad per row: a patient signing in the room signs once, and four
   * canvases down the page would ask them to sign the same thing four times.
   * It is cleared after each decision so it cannot be reused for a consent the
   * person did not see.
   *
   * Withdrawing is deliberately not signed. A withdrawal has to be as easy as
   * possible, and asking someone to sign in order to take a permission back is
   * a small obstacle in front of a right.
   */
  const [signature, setSignature] = useState<SignatureValue | null>(null);

  const statusFor = (kind: ConsentKind) => statuses.find((entry) => entry.kind === kind) ?? null;
  const documentFor = (kind: ConsentKind) =>
    documents.filter((doc) => doc.kind === kind).sort((a, b) => b.version - a.version)[0] ?? null;

  function decide(kind: ConsentKind, granted: boolean) {
    setError(null);
    const document = documentFor(kind);
    startTransition(async () => {
      const result = await recordConsent(
        {
          patient_id: patientId,
          document_id: granted ? (document?.id ?? null) : null,
          kind,
          granted,
          method,
          notes: null,
        },
        granted ? signature : null,
      );
      if (!result.ok) {
        setError(tc('errorGeneric'));
        return;
      }
      setSignature(null);
      // A consent decision is evidence, and evidence recorded silently is
      // evidence someone will record twice to be sure.
      toast({ tone: 'success', title: t('decisionRecorded') });
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <label className="flex items-center gap-2 text-xs text-ink-600">
            {t('method')}
            <Select
              value={method}
              onChange={(event) => setMethod(event.target.value as ConsentMethod)}
              className="h-8 w-auto text-xs"
              aria-label={t('method')}
            >
              {CONSENT_METHODS.map((entry) => (
                <option key={entry} value={entry}>
                  {t(`methods.${entry}`)}
                </option>
              ))}
            </Select>
          </label>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-ink-700">{t('intro')}</p>

          {/* Above the decisions, because it is signed before the button is
              pressed rather than after. */}
          {method === 'in_person' || method === 'paper_form' ? (
            <div className="rounded-lg border border-ink-200 bg-ink-50 p-3">
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
              <p className="mt-2 text-xs text-ink-600">{t('signature.optional')}</p>
            </div>
          ) : null}

          <ul className="divide-y divide-ink-100">
            {CONSENT_KINDS.map((kind) => {
              const status = statusFor(kind);
              const document = documentFor(kind);
              const granted = status?.granted === true;
              return (
                <li key={kind} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                  <span className="min-w-40 flex-1">
                    <span className="block text-sm font-medium text-ink-900">
                      {t(`kinds.${kind}`)}
                    </span>
                    {status ? (
                      <span className="block text-xs text-ink-600">
                        {t(granted ? 'grantedOn' : 'withdrawnOn', {
                          date: formatDate(new Date(status.decided_at)),
                        })}
                        {status.document_version !== null
                          ? ` · ${t('version', { version: status.document_version })}`
                          : ''}
                      </span>
                    ) : (
                      <span className="block text-xs text-ink-600">{t('neverAsked')}</span>
                    )}
                  </span>

                  <Badge tone={granted ? 'success' : status ? 'danger' : 'muted'}>
                    {granted
                      ? t('status.granted')
                      : status
                        ? t('status.withdrawn')
                        : t('status.none')}
                  </Badge>

                  {document ? (
                    <span className="flex gap-1">
                      {!granted ? (
                        <Button size="sm" disabled={isPending} onClick={() => decide(kind, true)}>
                          {isPending ? <Spinner /> : <Check className="h-4 w-4" />}
                          {t('grant')}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={isPending}
                          onClick={() => decide(kind, false)}
                        >
                          {isPending ? <Spinner /> : <X className="h-4 w-4" />}
                          {t('withdraw')}
                        </Button>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-amber-800">{t('noDocument')}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('historyTitle')}</CardTitle>
          <span className="text-xs text-ink-600">{history.length}</span>
        </CardHeader>
        <CardBody className={history.length === 0 ? '' : 'p-0'}>
          {history.length === 0 ? (
            <EmptyState icon={<FileText className="h-8 w-8" />} title={t('historyEmpty')} />
          ) : (
            <ul className="divide-y divide-ink-100">
              {[...history].reverse().map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-2 text-sm"
                >
                  <span dir="ltr" className="text-xs tabular-nums text-ink-600">
                    {formatDateTime(new Date(entry.decided_at))}
                  </span>
                  <span className="font-medium text-ink-900">{t(`kinds.${entry.kind}`)}</span>
                  <Badge tone={entry.granted ? 'success' : 'danger'}>
                    {entry.granted ? t('status.granted') : t('status.withdrawn')}
                  </Badge>
                  <span className="text-xs text-ink-600">{t(`methods.${entry.method}`)}</span>
                  {entry.document ? (
                    <span className="text-xs text-ink-600">
                      {entry.document.title} · {t('version', { version: entry.document.version })}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('exportTitle')}</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-sm leading-relaxed text-ink-700">{t('exportBody')}</p>
          <Button asChild variant="secondary" size="sm" className="mt-3">
            {/* A plain link, not a fetch: the browser handles the download and
                the file never passes through this component. */}
            <a href={`/api/patients/${patientId}/export`} download>
              <Download className="h-4 w-4" />
              {t('exportButton', { name: patientName })}
            </a>
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
