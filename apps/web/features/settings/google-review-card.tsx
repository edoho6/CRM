'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, CardBody, CardHeader, CardTitle, Field, LtrInput, useToast } from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import { saveGoogleReviewUrl } from './actions';

/**
 * Where the review request points: the clinic's own page on Google.
 *
 * One field. Google hands the link out in its business profile ("ask for
 * reviews"), and pasting it here is the whole of the setup; without it the
 * review request stays off whatever its switch says.
 */
export function GoogleReviewCard({ url }: { url: string | null }) {
  const t = useTranslations('settings.messaging.review');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState(url ?? '');
  const [invalid, setInvalid] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    setInvalid(false);
    startTransition(async () => {
      const result = await saveGoogleReviewUrl({ google_review_url: value });
      if (!result.ok) {
        setInvalid(true);
        return;
      }
      toast({ tone: 'success', title: tc('saved') });
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <Field label={t('url')} htmlFor="google_review_url" hint={t('hint')} error={invalid ? t('invalid') : undefined}>
          <LtrInput
            id="google_review_url"
            type="url"
            value={value}
            placeholder="https://g.page/r/…"
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>
        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={isPending} onClick={save}>
            {tc('save')}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
