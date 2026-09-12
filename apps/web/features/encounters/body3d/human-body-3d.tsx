'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, SegmentedControl, Skeleton, cn } from '@clinic/ui';
import { BodyMap, type MappedPoint } from '@/features/reference/body-map';
import type { PointInstance } from './instances';
import type { CameraView, ViewRequest } from './body-camera-controls';
import type { PickEvent } from './body-model';
import type { EditorBridge } from './body-scene';
import { useBodyPointInstances } from './use-body-point-instances';
import { useThemeColors } from './use-theme-colors';
import { SceneErrorBoundary } from './scene-error-boundary';

/*
 * three.js and the renderer are a few hundred kilobytes that the treatment
 * page must not pay for until the 3D view is actually on screen, and a
 * canvas has nothing to say on the server anyway.
 */
const BodyScene = dynamic(() => import('./body-scene'), { ssr: false, loading: () => null });

/*
 * The point editor exists in development builds only. The condition is a
 * build-time constant, so a production bundle carries neither the component
 * nor its chunk.
 */
const PointEditor =
  process.env.NODE_ENV === 'development'
    ? dynamic(() => import('./point-editor'), { ssr: false, loading: () => null })
    : null;

type ViewMode = '2d' | '3d';
const MODE_STORAGE_KEY = 'herbalist.bodyView';
const CAMERA_VIEWS: CameraView[] = ['front', 'back', 'left', 'right', 'reset'];

function readStoredMode(): ViewMode | null {
  try {
    const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
    return stored === '2d' || stored === '3d' ? stored : null;
  } catch {
    return null;
  }
}

/**
 * The body panel beside the point columns: the chosen points, drawn on a
 * body.
 *
 * It is a mirror of the list, not a second input — the same `MappedPoint[]`
 * the flat chart has always received drives it, so the two views can never
 * disagree about what was prescribed. The 3D body only changes where a
 * point is drawn, and only for points that have a recorded coordinate; the
 * rest are named underneath rather than guessed at.
 *
 * The flat chart stays one switch away. The coordinate set is small and
 * unvalidated until someone checks it against a reference, and a practitioner who
 * prefers the schematic loses nothing by choosing it.
 */
export function HumanBody3D({
  points,
  onSelect,
  className,
}: {
  points: MappedPoint[];
  /** Called when a marker or its chip is activated, to open the point's page. */
  onSelect?: (point: MappedPoint) => void;
  className?: string;
}) {
  const t = useTranslations('encounters.body3d');
  const colors = useThemeColors();
  const { instances, missingCodes } = useBodyPointInstances(points);

  const [mode, setMode] = useState<ViewMode>('3d');
  useEffect(() => {
    const stored = readStoredMode();
    if (stored) setMode(stored);
  }, []);
  const chooseMode = (next: ViewMode) => {
    setMode(next);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // A private window forgets the choice; the default is still sensible.
    }
  };

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [viewRequest, setViewRequest] = useState<ViewRequest | null>(null);
  const [ready, setReady] = useState(false);
  // Bumped to remount the scene after a failed load, so it is tried afresh.
  const [attempt, setAttempt] = useState(0);

  const onReady = useCallback(() => setReady(true), []);
  const retry = async () => {
    // The loader remembers a failure; forget it before asking again.
    const { clearBodyModel } = await import('./body-model');
    clearBodyModel();
    setReady(false);
    setAttempt((n) => n + 1);
  };

  const requestView = (view: CameraView) =>
    setViewRequest((previous) => ({ view, seq: (previous?.seq ?? 0) + 1 }));

  const select = (instance: PointInstance) => {
    const point = points.find((candidate) => candidate.pointId === instance.pointId);
    if (point) onSelect?.(point);
  };

  // Development-only editor state. In production `PointEditor` is null and
  // none of this is reachable.
  const [editorOpen, setEditorOpen] = useState(false);
  const [picked, setPicked] = useState<PickEvent | null>(null);
  useEffect(() => {
    if (!PointEditor) return;
    setEditorOpen(new URLSearchParams(window.location.search).get('pointEditor') === '1');
  }, []);
  const editor = useMemo<EditorBridge | null>(
    () => (editorOpen ? { onPick: setPicked, preview: picked?.position ?? null } : null),
    [editorOpen, picked],
  );

  const sideLabel = (side: PointInstance['side']) =>
    side === 'right' ? t('sideRight') : side === 'left' ? t('sideLeft') : t('sideMidline');

  return (
    <div
      role="group"
      aria-label={t('viewLabel')}
      className={cn('rounded-card border border-ink-200 bg-white p-3', className)}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          label={t('viewLabel')}
          value={mode}
          onChange={chooseMode}
          options={[
            { value: '3d', label: t('mode3d') },
            { value: '2d', label: t('mode2d') },
          ]}
        />
        {mode === '3d' ? (
          <div role="group" aria-label={t('cameraLabel')} className="flex flex-wrap gap-0.5">
            {CAMERA_VIEWS.map((view) => (
              <Button
                key={view}
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => requestView(view)}
              >
                {t(view)}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      {mode === '2d' ? (
        <BodyMap points={points} onSelect={onSelect} className="rounded-none border-0 p-0" />
      ) : (
        <figure>
          {/*
            The canvas is pinned to LTR: a WebGL viewport has no reading
            direction, and letting the page's RTL flip the overlay positions
            would put every tooltip on the wrong side of its marker. The
            tooltip itself sets its own direction from its text.
          */}
          <div
            dir="ltr"
            role="img"
            aria-label={t('sceneLabel', { count: instances.length })}
            className="relative h-[20rem] w-full overflow-hidden rounded-md sm:h-[22rem]"
          >
            <SceneErrorBoundary
              key={attempt}
              fallback={
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-ink-600">
                  <p>{t('loadFailed')}</p>
                  <Button type="button" variant="secondary" size="sm" onClick={retry}>
                    {t('retry')}
                  </Button>
                </div>
              }
            >
              <BodyScene
                instances={instances}
                activeKey={activeKey}
                onActiveChange={setActiveKey}
                onSelect={select}
                viewRequest={viewRequest}
                colors={colors}
                onReady={onReady}
                editor={editor}
              />
              {!ready ? (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-white"
                  aria-live="polite"
                >
                  <span className="sr-only">{t('loading')}</span>
                  <Skeleton shape="block" className="h-4/5 w-1/3 rounded-full" />
                </div>
              ) : null}
            </SceneErrorBoundary>
          </div>

          {instances.length > 0 ? (
            <ul aria-label={t('markersLabel')} className="mt-2 flex flex-wrap gap-1">
              {instances.map((instance) => {
                const active = instance.key === activeKey;
                return (
                  <li key={instance.key}>
                    {/*
                      The keyboard's route to a marker. A WebGL sphere cannot
                      take focus; this chip can, and focusing it lights the
                      marker and its label exactly as hovering does.
                    */}
                    <button
                      type="button"
                      aria-label={t('markerLabel', { code: instance.code, side: sideLabel(instance.side) })}
                      title={t('markerLabel', { code: instance.code, side: sideLabel(instance.side) })}
                      onFocus={() => setActiveKey(instance.key)}
                      onBlur={() => setActiveKey((current) => (current === instance.key ? null : current))}
                      onMouseEnter={() => setActiveKey(instance.key)}
                      onMouseLeave={() => setActiveKey((current) => (current === instance.key ? null : current))}
                      onClick={() => select(instance)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition-colors',
                        'focus-visible:ring-2 focus-visible:ring-jade-500 focus-visible:outline-none',
                        active
                          ? 'border-jade-700 bg-jade-50 text-jade-900'
                          : 'border-ink-200 text-ink-700 hover:bg-ink-50',
                      )}
                    >
                      <span dir="ltr">{instance.code}</span>
                      {instance.side !== 'midline' ? (
                        <span className="text-ink-600">· {sideLabel(instance.side)}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {missingCodes.length > 0 ? (
            <p className="mt-2 text-xs leading-snug text-ink-600">
              {t('noPosition', { codes: missingCodes.join(', ') })}
            </p>
          ) : null}

          <figcaption className="mt-2 text-center text-xs leading-snug text-ink-600">
            {t('modelCaption')}
          </figcaption>

          {PointEditor && editorOpen ? (
            <PointEditor picked={picked} onClear={() => setPicked(null)} />
          ) : null}
        </figure>
      )}
    </div>
  );
}
