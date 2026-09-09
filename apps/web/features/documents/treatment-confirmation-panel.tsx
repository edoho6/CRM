'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { FileCheck, Plus, Printer, Trash2 } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  LtrInput,
  Spinner,
  TIME_INPUT_LANG,
  useConfirm,
  useToast,
} from '@clinic/ui';
import { Link, useRouter } from '@clinic/i18n/navigation';
import type { TreatmentConfirmation } from '@clinic/db/types';
import {
  deleteTreatmentConfirmation,
  issueTreatmentConfirmation,
} from './confirmation-actions';
import { formatDate } from '@clinic/i18n';

/**
 * The document a patient needs to claim on their health-fund insurance.
 *
 * The funds ask for two things no international product produces: the
 * practitioner's name and qualification, and — for a course of treatment — the
 * dates actually given. Both are here; the first comes from the personal area,
 * the second is chosen below.
 *
 * Dates come from two places on purpose. Ticking them off the record is the
 * common case and the one that cannot be got wrong. Typing them by hand covers
 * the case that actually happens in a first year: treatment given before this
 * system existed, which a document that could only read the database would
 * silently omit — and it would omit it exactly when the patient needs it most.
 */

export interface ConfirmableTreatment {
  id: string;
  /** `YYYY-MM-DD`, which is what the document stores and prints. */
  date: string;
}

export function TreatmentConfirmationPanel({
  patientId,
  treatments,
  issued,
  practitionerReady,
}: {
  patientId: string;
  /** This patient's recorded treatments, newest first. */
  treatments: ConfirmableTreatment[];
  issued: TreatmentConfirmation[];
  /** False when the practitioner has not filled in their own name yet. */
  practitionerReady: boolean;
}) {
  const t = useTranslations('confirmations');
  const tc = useTranslations('common');
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState<string[]>([]);
  const [manualDraft, setManualDraft] = useState('');
  const [purpose, setPurpose] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  /** Ticked plus typed, de-duplicated and in order — the same shape the server stores. */
  const dates = useMemo(
    () => [...new Set([...selected, ...manual])].sort(),
    [selected, manual],
  );

  function toggle(date: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  function addManual() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(manualDraft)) return;
    setManual((current) => [...new Set([...current, manualDraft])]);
    setManualDraft('');
  }

  function issue() {
    if (dates.length === 0) return;
    setErrorKey(null);
    startTransition(async () => {
      const result = await issueTreatmentConfirmation({
        patient_id: patientId,
        treatment_dates: dates,
        purpose,
        notes: '',
      });
      if (!result.ok) {
        setErrorKey(result.error.key);
        return;
      }
      setSelected(new Set());
      setManual([]);
      setPurpose('');
      toast({ tone: 'success', title: t('issuedToast') });
      router.refresh();
    });
  }

  function renderError() {
    if (!errorKey) return null;
    if (errorKey.endsWith('practitioner_details_missing')) return t('missingPractitioner');
    return tc('errorGeneric');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-ink-600" aria-hidden />
            {t('title')}
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-ink-700">{t('subtitle')}</p>

        {errorKey ? <Alert tone="danger">{renderError()}</Alert> : null}

        {/* Said before the work rather than after it, so nobody picks fifteen
            dates and only then learns the document cannot be issued. */}
        {!practitionerReady ? (
          <Alert tone="warning">
            {t('missingPractitioner')}{' '}
            <Link href="/account" className="font-medium underline underline-offset-4">
              {t('goToProfile')}
            </Link>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ink-900">{t('fromRecord')}</h3>
          {treatments.length === 0 ? (
            <p className="text-sm text-ink-600">{t('noTreatments')}</p>
          ) : (
            <ul className="max-h-56 space-y-0.5 overflow-y-auto rounded-lg border border-ink-200 p-2">
              {treatments.map((treatment) => (
                <li key={treatment.id}>
                  <label className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-ink-50">
                    <input
                      type="checkbox"
                      checked={selected.has(treatment.date)}
                      onChange={() => toggle(treatment.date)}
                      className="h-4 w-4 rounded border-ink-300 accent-jade-700"
                    />
                    <span dir="ltr" className="tabular-nums text-ink-800">
                      {formatDate(new Date(treatment.date))}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2 border-t border-ink-100 pt-3">
          <h3 className="text-sm font-semibold text-ink-900">{t('addByHand')}</h3>
          <p className="text-xs text-ink-600">{t('addByHandHint')}</p>
          <div className="flex flex-wrap items-end gap-2">
            <Field label={tc('date')} htmlFor="manual_date" density="compact">
              <LtrInput
                id="manual_date"
                type="date"
                lang={TIME_INPUT_LANG}
                className="w-44"
                value={manualDraft}
                onChange={(event) => setManualDraft(event.target.value)}
              />
            </Field>
            <Button type="button" variant="secondary" size="sm" onClick={addManual}>
              <Plus className="h-4 w-4" />
              {tc('add')}
            </Button>
          </div>

          {manual.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {manual.map((date) => (
                <li key={date}>
                  <span className="inline-flex items-center gap-1 rounded-md border border-ink-200 bg-ink-50 py-0.5 ps-2 pe-0.5 text-xs">
                    <span dir="ltr" className="tabular-nums">
                      {date}
                    </span>
                    <button
                      type="button"
                      onClick={() => setManual((current) => current.filter((d) => d !== date))}
                      aria-label={tc('delete')}
                      className="rounded p-0.5 text-ink-500 hover:bg-ink-200 hover:text-ink-900"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <Field label={t('purpose')} htmlFor="confirmation_purpose" hint={t('purposeHint')}>
          <Input
            id="confirmation_purpose"
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
          />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-3">
          <p className="text-sm text-ink-700" role="status" aria-live="polite">
            {t('selectedCount', { count: dates.length })}
          </p>
          <Button
            type="button"
            onClick={issue}
            disabled={isPending || dates.length === 0 || !practitionerReady}
          >
            {isPending ? <Spinner /> : <FileCheck className="h-4 w-4" />}
            {t('issue')}
          </Button>
        </div>

        {issued.length > 0 ? (
          <div className="space-y-1 border-t border-ink-100 pt-3">
            <h3 className="text-sm font-semibold text-ink-900">{t('issuedBefore')}</h3>
            <ul className="divide-y divide-ink-100">
              {issued.map((confirmation) => (
                <li
                  key={confirmation.id}
                  className="flex flex-wrap items-center gap-2 py-1.5 text-sm"
                >
                  <span dir="ltr" className="shrink-0 tabular-nums text-ink-600">
                    {formatDate(new Date(confirmation.issued_at))}
                  </span>
                  <span className="text-ink-800">
                    {t('datesCount', { count: confirmation.treatment_dates.length })}
                  </span>
                  {confirmation.purpose ? (
                    <span className="truncate text-xs text-ink-600" dir="auto">
                      · {confirmation.purpose}
                    </span>
                  ) : null}
                  <span className="ms-auto flex items-center gap-1">
                    <Button asChild variant="ghost" size="sm">
                      {/* A new tab: printing is the point, and losing the
                          patient file behind it is a needless step back. */}
                      <a
                        href={`/print/confirmation/${confirmation.id}`}
                        target="_blank"
                        rel="noopener"
                      >
                        <Printer className="h-4 w-4" />
                        {t('print')}
                      </a>
                    </Button>
                    <button
                      type="button"
                      aria-label={tc('delete')}
                      disabled={isPending}
                      onClick={async () => {
                        const confirmed = await confirm({
                          title: tc('deleteConfirmTitle'),
                          body: tc('deleteConfirmBody'),
                          confirmLabel: tc('delete'),
                          destructive: true,
                        });
                        if (!confirmed) return;
                        setErrorKey(null);
                        startTransition(async () => {
                          const result = await deleteTreatmentConfirmation(confirmation.id);
                          if (!result.ok) {
                            setErrorKey(result.error.key);
                            return;
                          }
                          toast({ tone: 'success', title: tc('deleted') });
                          router.refresh();
                        });
                      }}
                      className="rounded-md p-1.5 text-ink-500 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
