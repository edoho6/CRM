'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { LockOpen } from 'lucide-react';
import { Alert, Button, Dialog, DialogContent, DialogFooter, Field, Spinner, Textarea, useToast } from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import { describeActionError } from '@/lib/action-error';
import { reopenEncounter } from './actions';

/**
 * Opens a signed record for editing — on purpose, with a reason.
 *
 * A signed record is locked because a clinical note that can be quietly
 * rewritten later is worth nothing as a record. But records do get
 * corrected. The way that is done properly is in the open: the earlier
 * signature stays on file with who reopened, when and why, the changes go
 * into the audit log as they always do, and the record has to be signed
 * again. This button asks for the why and does the rest.
 */
export function ReopenEncounterButton({ encounterId }: { encounterId: string }) {
  const t = useTranslations('encounters.reopen');
  const tc = useTranslations('common');
  const tAll = useTranslations();
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!reason.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await reopenEncounter(encounterId, reason);
      if (!result.ok) {
        setError(describeActionError(tAll, result.error.key));
        return;
      }
      setOpen(false);
      setReason('');
      toast({ tone: 'success', title: t('done') });
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <LockOpen className="h-4 w-4" aria-hidden />
        {t('button')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t('title')} description={t('body')} closeLabel={tc('close')}>
          <div className="space-y-4">
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <Field label={t('reason')} htmlFor="reopen_reason" hint={t('reasonHint')} required>
              <Textarea
                id="reopen_reason"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={isPending}
                data-autofocus
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
                {tc('cancel')}
              </Button>
              <Button type="button" onClick={submit} disabled={isPending || !reason.trim()}>
                {isPending ? <Spinner /> : <LockOpen className="h-4 w-4" aria-hidden />}
                {t('confirm')}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
