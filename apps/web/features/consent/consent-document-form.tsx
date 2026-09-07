'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Alert, Button, Field, Input, Spinner, Textarea } from '@clinic/ui';
import type { ConsentKind } from '@clinic/domain';
import { useRouter } from '@clinic/i18n/navigation';
import { publishConsentDocument } from './actions';

/**
 * Publishes the next version of one consent text.
 *
 * Collapsed behind a button because publishing is rare and irreversible —
 * showing an open editor on a settings page invites a stray keystroke into
 * something that can never be edited afterwards. The warning above the submit
 * says what "publish" means here, since the word usually implies you can go
 * back and fix a typo.
 */
export function ConsentDocumentForm({ kind, locale }: { kind: ConsentKind; locale: string }) {
  const t = useTranslations('consent');
  const tc = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (title.trim().length < 2 || body.trim().length < 20) {
      setError(t('tooShort'));
      return;
    }
    startTransition(async () => {
      const result = await publishConsentDocument({ kind, locale, title, body });
      if (!result.ok) {
        setError(tc('errorGeneric'));
        return;
      }
      setTitle('');
      setBody('');
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        {t('publishNew')}
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-ink-200 bg-ink-50/50 p-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Field label={t('documentTitle')} htmlFor={`title-${kind}`}>
        <Input
          id={`title-${kind}`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
        />
      </Field>

      <Field label={t('documentBody')} htmlFor={`body-${kind}`} hint={t('bodyHint')}>
        <Textarea
          id={`body-${kind}`}
          rows={10}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </Field>

      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
        {t('publishWarning')}
      </p>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
          {tc('cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Spinner /> : null}
          {isPending ? tc('saving') : t('publish')}
        </Button>
      </div>
    </form>
  );
}
