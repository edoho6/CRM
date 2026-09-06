'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ImageIcon, Trash2, Upload } from 'lucide-react';
import { Alert, Button, Card, CardBody, CardHeader, CardTitle, Field, Input, Spinner } from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import { removeHerbImage, uploadHerbImage } from './image-actions';

/**
 * The herb's photograph, with upload and replace.
 *
 * A plain <img> against the public bucket URL — no signed links, no image
 * optimizer configuration — because the picture is public by design and a
 * thumbnail should cost one request.
 */
export function HerbImageCard({
  herbId,
  imageUrl,
  attribution,
  alt,
}: {
  herbId: string;
  imageUrl: string | null;
  attribution: string | null;
  alt: string;
}) {
  const t = useTranslations('inventory.image');
  const tc = useTranslations('common');
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('idle');
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await uploadHerbImage(herbId, formData);
      if (!result.ok) {
        setStatus('error');
        return;
      }
      formRef.current?.reset();
      setStatus('saved');
      router.refresh();
    });
  }

  function handleRemove() {
    if (!window.confirm(tc('deleteConfirmBody'))) return;
    setStatus('idle');
    startTransition(async () => {
      const result = await removeHerbImage(herbId);
      setStatus(result.ok ? 'idle' : 'error');
      if (result.ok) router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        {imageUrl ? (
          <Button variant="ghost" size="sm" onClick={handleRemove} disabled={isPending} className="text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4" />
            {t('remove')}
          </Button>
        ) : null}
      </CardHeader>
      <CardBody className="space-y-3">
        {imageUrl ? (
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={alt}
              className="aspect-square w-full rounded-lg border border-ink-100 object-cover"
            />
            {attribution ? (
              <figcaption className="mt-1 text-xs text-ink-500" dir="auto">
                {attribution}
              </figcaption>
            ) : null}
          </figure>
        ) : (
          <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-ink-200 bg-ink-50 text-ink-400">
            <ImageIcon className="h-8 w-8" aria-hidden />
            <span className="text-sm">{t('none')}</span>
          </div>
        )}

        {status === 'saved' ? <Alert tone="success">{t('uploaded')}</Alert> : null}
        {status === 'error' ? <Alert tone="danger">{tc('errorGeneric')}</Alert> : null}

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-2">
          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            disabled={isPending}
            aria-label={imageUrl ? t('replace') : t('upload')}
            className="block w-full text-sm text-ink-700 file:me-3 file:rounded-lg file:border-0 file:bg-jade-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-jade-800 hover:file:bg-jade-100"
          />
          <Field label={t('attribution')} htmlFor="image_attribution">
            <Input id="image_attribution" name="attribution" disabled={isPending} defaultValue={attribution ?? ''} />
          </Field>
          <p className="text-xs text-ink-500">{t('hint')}</p>
          <Button type="submit" variant="secondary" size="sm" disabled={isPending} className="w-full">
            {isPending ? <Spinner /> : <Upload className="h-4 w-4" />}
            {imageUrl ? t('replace') : t('upload')}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
