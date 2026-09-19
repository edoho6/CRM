'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ImageIcon, Trash2, Upload } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Spinner,
  cn,
  useConfirm,
  useToast,
} from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import { removeHerbImage, uploadHerbImage } from './image-actions';
import { shrinkImage } from '@/lib/shrink-image';
import type { ReferenceImage } from './herb-reference-image';
import { useHerbGallery } from './herb-gallery';

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
  reference = null,
  alt,
}: {
  herbId: string;
  imageUrl: string | null;
  attribution: string | null;
  /** The catalogue's own photograph, shown while the clinic has none. */
  reference?: ReferenceImage | null;
  alt: string;
}) {
  const t = useTranslations('inventory.image');
  const tc = useTranslations('common');
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'error'>('idle');
  const confirm = useConfirm();
  const { toast } = useToast();
  const gallery = useHerbGallery();
  // The picture itself is the way to the large view, where a page has one.
  const openLarge = gallery
    ? { role: 'button' as const, tabIndex: 0, title: t('openLarge', { name: alt }), onClick: () => gallery.open(herbId),
        onKeyDown: (event: React.KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); gallery.open(herbId); } } }
    : {};

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('idle');
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const file = formData.get('file');
      if (file instanceof File) formData.set('file', await shrinkImage(file));
      const result = await uploadHerbImage(herbId, formData);
      if (!result.ok) {
        setStatus('error');
        return;
      }
      formRef.current?.reset();
      toast({ tone: 'success', title: t('uploaded') });
      router.refresh();
    });
  }

  async function handleRemove() {
    const confirmed = await confirm({
      title: tc('deleteNamed', { thing: tc('things.photo') }),
      body: tc('deleteConfirmBody'),
      confirmLabel: tc('delete'),
      destructive: true,
    });
    if (!confirmed) return;
    setStatus('idle');
    startTransition(async () => {
      const result = await removeHerbImage(herbId);
      if (!result.ok) {
        setStatus('error');
        return;
      }
      toast({ tone: 'success', title: tc('deleted') });
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        {imageUrl ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={isPending}
            className="text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            {t('remove')}
          </Button>
        ) : null}
      </CardHeader>
      <CardBody className="space-y-3">
        {imageUrl ? (
          <figure>
            <img
              src={imageUrl}
              alt={alt}
              {...openLarge}
              className={cn('aspect-square w-full rounded-lg border border-ink-100 object-cover', gallery && 'cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus')}
            />
            {attribution ? (
              <figcaption className="mt-1 text-xs text-ink-500" dir="auto">
                {attribution}
              </figcaption>
            ) : null}
          </figure>
        ) : reference ? (
          <figure>
            <img
              src={reference.src}
              alt={alt}
              {...openLarge}
              className={cn('aspect-square w-full rounded-lg border border-ink-100 object-cover', gallery && 'cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus')}
            />
            {/* The credit is a condition of the licence, not decoration: the
                photographer's name and the licence, with links to both. */}
            <figcaption className="mt-1 text-xs text-ink-500">
              <a href={reference.page} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                {t('referenceCredit', { author: reference.author, source: reference.source, licence: reference.licence })}
              </a>
              {' · '}
              <a href={reference.licenceUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline" dir="ltr">
                {reference.licence}
              </a>
              <span className="block text-ink-500">
                {t(reference.form === 'material' ? 'referenceMaterialNote' : 'referencePlantNote')}
              </span>
            </figcaption>
          </figure>
        ) : (
          <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-ink-200 bg-ink-50 text-ink-500">
            <ImageIcon className="h-8 w-8" aria-hidden />
            <span className="text-sm">{t('none')}</span>
          </div>
        )}

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
            <Input
              id="image_attribution"
              name="attribution"
              disabled={isPending}
              defaultValue={attribution ?? ''}
            />
          </Field>
          <p className="text-xs text-ink-500">{t('hint')}</p>
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={isPending}
            className="w-full"
          >
            {isPending ? <Spinner /> : <Upload className="h-4 w-4" />}
            {imageUrl ? t('replace') : t('upload')}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
