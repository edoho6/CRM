'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Camera, X } from 'lucide-react';
import { Alert, Button, Dialog, DialogContent, Spinner, useConfirm, useToast } from '@clinic/ui';
import { cn } from '@clinic/ui/cn';
import { useRouter } from '@clinic/i18n/navigation';
import { formatDate } from '@clinic/i18n';
import { deleteDocument, uploadDocument } from '@/features/documents/actions';
import { DEFAULT_ZOOM_VIEW, ZoomFrame, type ZoomView } from './zoom-frame';

/**
 * The tongue, photographed, on the page.
 *
 * Tongue diagnosis is visual, and a description in three fields — colour,
 * shape, coating — is a description of something that was seen and then gone.
 * The photograph keeps it. It is shown here as an image, not a file: opening a
 * "tongue_2026-09-09.jpg" from a list is a step that would never be taken
 * mid-consultation, and a picture beside the fields is what the fields are for.
 *
 * The frame is the practitioner's to shape. A phone photograph is taller than
 * the column is wide, so it is cropped to fit — and which part shows, and how
 * close, should be their choice, not the browser's: the wheel zooms, the two
 * buttons zoom, dragging moves the picture, the bottom corner pulls the frame
 * taller or shorter. All of it is remembered for this photograph in this
 * browser. A still click opens it at full size; from there, any earlier
 * photograph of the same patient goes beside it, each with its own zoom.
 *
 * One photograph per treatment. Taking another replaces it — the earlier
 * visits' photographs are untouched — and the cross beside the camera removes
 * it, after asking. With no photograph there is nothing here but the camera:
 * an empty frame saying "no photo" is a box that says nothing.
 *
 * Storage is the patient's document file, category `tongue`, tied to this
 * treatment: the same bucket, the same row-level rules, the same access log.
 * The picture is served through the documents route in its inline mode, which
 * records a view rather than an export.
 */

export interface TonguePhoto {
  id: string;
  encounterId: string | null;
  /** The date of the treatment it belongs to, or of the upload when unattached. */
  date: string;
}

/** Where the picture sits, how close, and how tall its frame is. */
interface View extends ZoomView {
  height: number;
}

const DEFAULT_VIEW: View = { ...DEFAULT_ZOOM_VIEW, height: 180 };
const MIN_HEIGHT = 96;
const MAX_HEIGHT = 640;

const clampHeight = (value: number) =>
  Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Number.isFinite(value) ? value : DEFAULT_VIEW.height));

// A new key from the previous framing model, which stored an object-position;
// those values mean nothing to this one and are simply left behind.
const viewKey = (photoId: string) => `herbalist-tongue-view2:${photoId}`;

function loadView(photoId: string): View {
  try {
    const raw = localStorage.getItem(viewKey(photoId));
    if (!raw) return DEFAULT_VIEW;
    const parsed = JSON.parse(raw) as Partial<View>;
    const number = (value: unknown, fallback: number) =>
      typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    return {
      cx: number(parsed.cx, 50),
      cy: number(parsed.cy, 50),
      zoom: number(parsed.zoom, 1),
      height: clampHeight(number(parsed.height, DEFAULT_VIEW.height)),
    };
  } catch {
    return DEFAULT_VIEW;
  }
}

function saveView(photoId: string, view: View) {
  try {
    localStorage.setItem(viewKey(photoId), JSON.stringify(view));
  } catch {
    // Site data blocked: the frame resets next time, and that is the whole cost.
  }
}

const inlineSrc = (id: string) => `/api/documents/${id}?inline=1`;

export function TonguePhotos({
  patientId,
  encounterId,
  photos,
  disabled,
}: {
  patientId: string;
  encounterId: string;
  /** Every tongue photo on the patient's file, newest first. */
  photos: TonguePhoto[];
  disabled: boolean;
}) {
  const t = useTranslations('encounters.tonguePhotos');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  const [lightbox, setLightbox] = useState<{ main: string; beside: string | null } | null>(null);

  const current = photos.filter((photo) => photo.encounterId === encounterId);
  const earlier = photos.filter((photo) => photo.encounterId !== encounterId);
  const latest = current[0] ?? null;
  const latestId = latest?.id ?? null;

  // The remembered framing, once we know which photograph this is.
  useEffect(() => {
    if (latestId) setView(loadView(latestId));
  }, [latestId]);

  // Remembered on every change rather than on some "done" moment there is
  // no such moment to hook: a wheel stops, a drag ends, a frame is pulled.
  useEffect(() => {
    if (latestId && view !== DEFAULT_VIEW) saveView(latestId, view);
  }, [latestId, view]);

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set('file', file);
    formData.set('category', 'tongue');
    formData.set('encounter_id', encounterId);
    const replacing = current.map((photo) => photo.id);
    setFailed(false);
    startTransition(async () => {
      const result = await uploadDocument(patientId, formData);
      if (inputRef.current) inputRef.current.value = '';
      if (!result.ok) {
        setFailed(true);
        return;
      }
      // One per treatment: the new one is in, so the old one goes — but only
      // after the new one is safely stored, never before.
      for (const id of replacing) await deleteDocument(id);
      toast({ tone: 'success', title: t('saved') });
      router.refresh();
    });
  }

  async function handleRemove() {
    if (!latest) return;
    const confirmed = await confirm({
      title: tc('deleteConfirmTitle'),
      body: tc('deleteConfirmBody'),
      confirmLabel: tc('delete'),
      destructive: true,
    });
    if (!confirmed) return;
    setFailed(false);
    startTransition(async () => {
      const result = await deleteDocument(latest.id);
      if (!result.ok) {
        setFailed(true);
        return;
      }
      toast({ tone: 'success', title: t('deleted') });
      router.refresh();
    });
  }

  function open(photo: TonguePhoto) {
    setLightbox({ main: photo.id, beside: null });
  }

  const alt = (photo: TonguePhoto) => t('alt', { date: formatDate(photo.date) });
  const photoById = (id: string) => photos.find((photo) => photo.id === id) ?? null;
  const zoomLabels = { zoomIn: t('zoomIn'), zoomOut: t('zoomOut'), hint: t('zoomHint') };

  return (
    <div className="space-y-2">
      {latest ? (
        <ZoomFrame
          src={inlineSrc(latest.id)}
          alt={alt(latest)}
          fit="cover"
          resizable
          view={view}
          onViewChange={(next) => setView((previous) => ({ ...previous, ...next }))}
          onFrameResize={({ height }) =>
            setView((previous) =>
              Math.abs(previous.height - height) < 1
                ? previous
                : { ...previous, height: clampHeight(height) },
            )
          }
          onActivate={() => open(latest)}
          labels={{ ...zoomLabels, activate: t('open') }}
          style={{ height: view.height }}
          className="w-full min-h-24 max-h-[70vh] rounded-lg border border-ink-200"
        />
      ) : null}

      {failed ? <Alert tone="danger">{t('uploadFailed')}</Alert> : null}

      {!disabled ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={handleFile}
            aria-label={latest ? t('replace') : t('take')}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isPending}
            title={latest ? t('replace') : undefined}
            onClick={() => inputRef.current?.click()}
          >
            {isPending ? <Spinner /> : <Camera className="h-4 w-4" aria-hidden />}
            {t('take')}
          </Button>
          {latest ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-ink-500 hover:bg-red-50 hover:text-red-600"
              disabled={isPending}
              aria-label={t('remove')}
              title={t('remove')}
              onClick={handleRemove}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      ) : null}

      {earlier.length > 0 ? (
        <ul className="flex gap-1.5 overflow-x-auto pb-1" aria-label={t('earlier')}>
          {earlier.map((photo) => (
            <li key={photo.id} className="shrink-0">
              <button
                type="button"
                onClick={() => open(photo)}
                className="block rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                title={alt(photo)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={inlineSrc(photo.id)}
                  alt={alt(photo)}
                  className="h-14 w-14 rounded-md border border-ink-200 object-cover"
                />
                <span className="mt-0.5 block text-center text-[11px] text-ink-500" dir="ltr">
                  {formatDate(photo.date)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog open={lightbox !== null} onOpenChange={(isOpen) => !isOpen && setLightbox(null)}>
        {lightbox ? (
          <LightboxContent
            lightbox={lightbox}
            photos={photos}
            encounterId={encounterId}
            photoById={photoById}
            alt={alt}
            zoomLabels={zoomLabels}
            onBeside={(id) =>
              setLightbox((previous) =>
                previous ? { ...previous, beside: previous.beside === id ? null : id } : previous,
              )
            }
            closeLabel={tc('close')}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

/**
 * The photograph at full size, and beside it — if wanted — any other of the
 * same patient's. Not a separate "compare" screen: comparison is one tap away
 * from looking, which is when the question "is it better than last time"
 * actually comes up. Each picture zooms on its own, so the same patch of
 * coating can be brought close in both.
 */
function LightboxContent({
  lightbox,
  photos,
  encounterId,
  photoById,
  alt,
  zoomLabels,
  onBeside,
  closeLabel,
}: {
  lightbox: { main: string; beside: string | null };
  photos: TonguePhoto[];
  encounterId: string;
  photoById: (id: string) => TonguePhoto | null;
  alt: (photo: TonguePhoto) => string;
  zoomLabels: { zoomIn: string; zoomOut: string; hint: string };
  onBeside: (id: string) => void;
  closeLabel: string;
}) {
  const t = useTranslations('encounters.tonguePhotos');
  const main = photoById(lightbox.main);
  const beside = lightbox.beside ? photoById(lightbox.beside) : null;
  const others = photos.filter((photo) => photo.id !== lightbox.main);
  if (!main) return null;

  const figure = (photo: TonguePhoto) => (
    <figure className="min-w-0">
      <ZoomFrame
        key={photo.id}
        src={inlineSrc(photo.id)}
        alt={alt(photo)}
        fit="contain"
        labels={zoomLabels}
        className="h-[60vh] w-full rounded-lg border border-ink-200"
      />
      <figcaption className="mt-1 text-center text-xs text-ink-600" dir="ltr">
        {formatDate(photo.date)}
        {photo.encounterId === encounterId ? ` · ${t('current')}` : ''}
      </figcaption>
    </figure>
  );

  return (
    <DialogContent title={alt(main)} closeLabel={closeLabel} className="max-w-5xl">
      <div className={cn('grid gap-3', beside ? 'sm:grid-cols-2' : 'grid-cols-1')}>
        {figure(main)}
        {beside ? figure(beside) : null}
      </div>

      {others.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-ink-600">{t('compareWith')}</p>
          <ul className="flex gap-1.5 overflow-x-auto pb-1">
            {others.map((photo) => {
              const selected = photo.id === lightbox.beside;
              return (
                <li key={photo.id} className="shrink-0">
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onBeside(photo.id)}
                    title={alt(photo)}
                    className={cn(
                      'block rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                      selected && 'ring-2 ring-focus-ring ring-offset-2 ring-offset-white',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={inlineSrc(photo.id)}
                      alt={alt(photo)}
                      className="h-14 w-14 rounded-md border border-ink-200 object-cover"
                    />
                    <span className="mt-0.5 block text-center text-[11px] text-ink-500" dir="ltr">
                      {formatDate(photo.date)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </DialogContent>
  );
}
