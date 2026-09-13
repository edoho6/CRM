'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, PenLine, Trash2 } from 'lucide-react';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  EmptyNote,
  SketchPad,
  Spinner,
  useConfirm,
  useToast,
  type SketchPadHandle,
  type SketchPadLabels,
} from '@clinic/ui';
import { cn } from '@clinic/ui/cn';
import { useRouter } from '@clinic/i18n/navigation';
import { formatDate } from '@clinic/i18n';
import { HeaderTools } from '@/components/header-tools';
import { deleteDocument, uploadDocument } from '@/features/documents/actions';
import { loadSketchImage } from './sketch-actions';
import { ZoomFrame } from './zoom-frame';

/**
 * Pages written by hand on the treatment.
 *
 * Some practitioners write with a pen on a tablet; most type. So the way in
 * is one small icon in the page header, beside the arrange switch, and the
 * pages themselves are a side panel: each page a thumbnail, opened large on
 * a click, edited over or deleted from there.
 *
 * A page is a PNG in the patient's document file — category `sketch`, tied
 * to this treatment — so it has the same bucket, the same row-level rules
 * and the same access log as every other document, and it appears in the
 * documents tab of the file like any scan. Editing a page saves a new one
 * and then removes the old, never the other way round.
 *
 * The drawing itself is `SketchPad` in the shared kit: pointer events for
 * pen, finger and mouse alike, pressure from a stylus, palm rejection once a
 * pen is seen. This file only knows where a page goes.
 */

export interface Sketch {
  id: string;
  /** The date of the treatment, for the caption. */
  date: string;
}

const inlineSrc = (id: string) => `/api/documents/${id}?inline=1`;

/** What the pad is open on: a fresh page, or an existing one being edited. */
interface PadSession {
  editing: Sketch | null;
  /** The existing page's picture, once fetched; a fresh page has none. */
  background: string | null;
}

export function Sketches({
  patientId,
  encounterId,
  sketches,
  disabled,
}: {
  patientId: string;
  encounterId: string;
  /** This treatment's pages, oldest first. */
  sketches: Sketch[];
  disabled: boolean;
}) {
  const t = useTranslations('encounters.sketches');
  const tp = useTranslations('encounters.sketches.pad');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirm();
  const padRef = useRef<SketchPadHandle>(null);
  const [isPending, startTransition] = useTransition();
  const [session, setSession] = useState<PadSession | null>(null);
  const [viewing, setViewing] = useState<Sketch | null>(null);
  const [dirty, setDirty] = useState(false);
  const [failed, setFailed] = useState(false);

  const labels: SketchPadLabels = {
    canvas: tp('canvas'),
    tool: tp('tool'),
    pen: tp('pen'),
    highlighter: tp('highlighter'),
    eraser: tp('eraser'),
    color: tp('color'),
    width: tp('width'),
    thin: tp('thin'),
    medium: tp('medium'),
    thick: tp('thick'),
    paper: tp('paper'),
    blank: tp('blank'),
    lines: tp('lines'),
    grid: tp('grid'),
    undo: tp('undo'),
    redo: tp('redo'),
    clear: tp('clear'),
    penOnly: tp('penOnly'),
    penOnlyHint: tp('penOnlyHint'),
    colors: [
      tp('colors.black'),
      tp('colors.blue'),
      tp('colors.red'),
      tp('colors.green'),
      tp('colors.orange'),
      tp('colors.violet'),
    ],
  };

  function open(editing: Sketch | null) {
    setFailed(false);
    setDirty(false);
    setViewing(null);
    setSession({ editing, background: null });
    if (!editing) return;
    // The page arrives as bytes the canvas can export again (see the action).
    // Without it there is nothing to draw over, and a save would replace the
    // page with a blank one — so a failed fetch closes the pad instead.
    startTransition(async () => {
      const result = await loadSketchImage(editing.id);
      if (!result.ok) {
        toast({ tone: 'danger', title: tc('errorGeneric') });
        setSession(null);
        return;
      }
      setSession((current) => (current?.editing?.id === editing.id ? { ...current, background: result.data.dataUrl } : current));
    });
  }

  // Closing with something on the page asks first. `onOpenChange(false)` is
  // Escape, the ✕ and a click outside alike, so the question sits here.
  async function requestClose() {
    if (dirty && !isPending) {
      const leave = await confirm({
        title: t('discard'),
        body: t('discardBody'),
        confirmLabel: t('discardConfirm'),
        cancelLabel: t('keepEditing'),
        destructive: true,
      });
      if (!leave) return;
    }
    setSession(null);
  }

  function save() {
    const pad = padRef.current;
    const current = session;
    if (!pad || !current) return;
    setFailed(false);
    startTransition(async () => {
      const blob = await pad.exportPng();
      if (!blob) {
        setFailed(true);
        return;
      }
      const name = `handwriting-${new Date().toISOString().slice(0, 10)}.png`;
      const formData = new FormData();
      formData.set('file', new File([blob], name, { type: 'image/png' }));
      formData.set('category', 'sketch');
      formData.set('encounter_id', encounterId);
      const result = await uploadDocument(patientId, formData);
      if (!result.ok) {
        setFailed(true);
        return;
      }
      // An edited page replaces its original — only once the new one is stored.
      if (current.editing) await deleteDocument(current.editing.id);
      toast({ tone: 'success', title: t('saved') });
      setSession(null);
      router.refresh();
    });
  }

  async function remove(sketch: Sketch) {
    const confirmed = await confirm({
      title: t('remove'),
      body: tc('deleteConfirmBody'),
      confirmLabel: tc('delete'),
      destructive: true,
    });
    if (!confirmed) return;
    startTransition(async () => {
      const result = await deleteDocument(sketch.id);
      if (!result.ok) {
        toast({ tone: 'danger', title: tc('errorGeneric') });
        return;
      }
      toast({ tone: 'success', title: t('deleted') });
      setViewing(null);
      router.refresh();
    });
  }

  const alt = (sketch: Sketch) => t('alt', { date: formatDate(sketch.date) });
  const zoomLabels = { zoomIn: t('zoomIn'), zoomOut: t('zoomOut'), hint: t('zoomHint') };

  return (
    <div className="space-y-3">
      {/* The way in: one small icon in the page header, before the arrange switch. */}
      {!disabled ? (
        <HeaderTools slotId="encounter-header-sketch" fallbackClassName="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            data-sketch-open
            aria-label={t('open')}
            title={t('openHint')}
            onClick={() => open(null)}
          >
            <PenLine className="h-4 w-4" aria-hidden />
          </Button>
        </HeaderTools>
      ) : null}

      {sketches.length === 0 ? (
        <EmptyNote>{t('empty')}</EmptyNote>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={t('pages')}>
          {sketches.map((sketch) => (
            <li key={sketch.id}>
              <button
                type="button"
                onClick={() => setViewing(sketch)}
                className={cn(
                  'group block w-full overflow-hidden rounded-lg border border-ink-200 text-start transition-colors hover:border-ink-400',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                )}
                aria-label={`${t('view')}: ${alt(sketch)}`}
              >
                {/* A real white behind the page whatever the theme: the ink on it is fixed. */}
                <span className="block aspect-[4/3] w-full" style={{ background: '#ffffff' }}>
                  <img
                    src={inlineSrc(sketch.id)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-contain object-top"
                  />
                </span>
                <span className="block border-t border-ink-100 bg-ink-50 px-2 py-1 text-xs text-ink-600">
                  {formatDate(sketch.date)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!disabled ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-ink-500">{t('count', { count: sketches.length })}</p>
          <Button type="button" variant="secondary" size="sm" onClick={() => open(null)}>
            <PenLine className="h-4 w-4" aria-hidden />
            {t('open')}
          </Button>
        </div>
      ) : null}

      {/* The page, open large, with edit and delete. */}
      <Dialog open={viewing !== null} onOpenChange={(isOpen) => !isOpen && setViewing(null)}>
        {viewing ? (
          <DialogContent title={alt(viewing)} className="sm:max-w-4xl" closeLabel={tc('close')}>
            <div className="rounded-lg border border-ink-200" style={{ background: '#ffffff' }}>
              <ZoomFrame
                src={inlineSrc(viewing.id)}
                alt={alt(viewing)}
                fit="contain"
                labels={zoomLabels}
                className="h-[60dvh] w-full"
              />
            </div>
            {!disabled ? (
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-red-700 hover:bg-red-50"
                  disabled={isPending}
                  onClick={() => remove(viewing)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  {t('remove')}
                </Button>
                <Button type="button" variant="secondary" disabled={isPending} onClick={() => open(viewing)}>
                  <Pencil className="h-4 w-4" aria-hidden />
                  {t('edit')}
                </Button>
              </DialogFooter>
            ) : null}
          </DialogContent>
        ) : null}
      </Dialog>

      {/* The pad. Tall enough to write on: most of the screen on a tablet or a
          phone held upright, a wide card on a desk. */}
      <Dialog open={session !== null} onOpenChange={(isOpen) => !isOpen && void requestClose()}>
        {session ? (
          <DialogContent
            title={session.editing ? t('editTitle') : t('dialogTitle')}
            className="sm:max-w-5xl"
            closeLabel={tc('close')}
          >
            <div className="h-[calc(85dvh-12rem)] sm:h-[calc(100dvh-15rem)] sm:min-h-[22rem]">
              <SketchPad
                ref={padRef}
                labels={labels}
                background={session.background}
                onDirtyChange={setDirty}
              />
            </div>
            {failed ? (
              <Alert tone="danger" className="mt-3">
                {t('uploadFailed')}
              </Alert>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="ghost" disabled={isPending} onClick={() => void requestClose()}>
                {tc('cancel')}
              </Button>
              <Button type="button" data-sketch-save disabled={isPending || !dirty} onClick={save}>
                {isPending ? <Spinner /> : null}
                {isPending ? t('saving') : t('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
