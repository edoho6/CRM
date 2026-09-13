'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, CardBody, CardHeader, CardTitle, Field, Textarea, useToast } from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import type { MedEntry } from '@clinic/db/types';
import { setMedicineStatus, type MedicineVerdict } from './review-action';

/**
 * The verdict box under an entry, for the person who runs the service —
 * pressed after a physician or a pharmacist has read the entry with them.
 * Approving needs nothing; flagging needs a note, because "wrong" without
 * "what" is a flag nobody can act on. Either mark can be removed, and the
 * entry goes back to what its sources said.
 */
export function MedicineReviewBox({ entry }: { entry: Pick<MedEntry, 'id' | 'status' | 'review_note'> }) {
  const t = useTranslations('medicine.review');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [note, setNote] = useState(entry.review_note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(verdict: MedicineVerdict) {
    if (verdict === 'flagged' && !note.trim()) {
      setError(t('noteRequired'));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await setMedicineStatus(entry.id, verdict, verdict === 'clear' ? '' : note);
      if (!result.ok) {
        toast({ tone: 'danger', title: tc('errorGeneric') });
        return;
      }
      if (verdict === 'clear') setNote('');
      toast({ tone: 'success', title: t('saved') });
      router.refresh();
    });
  }

  const marked = entry.status === 'verified' || entry.status === 'flagged';
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        <p className="text-xs text-ink-600">{t('hint')}</p>
        <Field label={t('noteLabel')} htmlFor="medicine-review-note" error={error ?? undefined}>
          <Textarea
            id="medicine-review-note"
            rows={2}
            value={note}
            disabled={pending}
            placeholder={t('notePlaceholder')}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          {marked ? (
            <Button type="button" variant="secondary" disabled={pending} onClick={() => submit('clear')}>
              {t('clear')}
            </Button>
          ) : null}
          {entry.status !== 'flagged' ? (
            <Button type="button" variant="secondary" disabled={pending} onClick={() => submit('flagged')}>
              {t('flag')}
            </Button>
          ) : null}
          {entry.status !== 'verified' ? (
            <Button type="button" disabled={pending} onClick={() => submit('verified')}>
              {t('verify')}
            </Button>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
