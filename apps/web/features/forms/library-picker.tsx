'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { BookOpen, Plus } from 'lucide-react';
import { Button, Dialog, DialogContent, Spinner, useToast } from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import { describeActionError } from '@/lib/action-error';
import { addFormFromLibrary } from './actions';

/**
 * "From the library": a ready-made questionnaire, added to the clinic in
 * one click and opened in the builder straight away.
 */
export function LibraryPicker({
  entries,
}: {
  entries: { key: string; title: string; description: string; questions: number }[];
}) {
  const t = useTranslations('forms.library');
  const tAll = useTranslations();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function add(key: string) {
    setBusy(key);
    startTransition(async () => {
      const result = await addFormFromLibrary(key);
      setBusy(null);
      if (!result.ok) {
        toast({ tone: 'danger', title: describeActionError(tAll, result.error?.key) });
        return;
      }
      toast({ tone: 'success', title: t('added') });
      setOpen(false);
      router.push(`/forms/${result.data.id}`);
    });
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <BookOpen className="h-4 w-4" aria-hidden />
        {t('button')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={t('title')}
          description={t('intro')}
          closeLabel={tAll('common.close')}
        >
          <ul className="divide-y divide-ink-100">
            {entries.map((entry) => (
              <li key={entry.key} className="flex flex-wrap items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-900">{entry.title}</p>
                  <p className="mt-0.5 text-xs text-ink-600">{entry.description}</p>
                  <p className="mt-1 text-xs text-ink-500">
                    {t('questions', { count: entry.questions })}
                  </p>
                </div>
                <Button type="button" size="sm" disabled={isPending} onClick={() => add(entry.key)}>
                  {busy === entry.key ? <Spinner /> : <Plus className="h-4 w-4" aria-hidden />}
                  {t('add')}
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-500">{t('filedNote')}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
