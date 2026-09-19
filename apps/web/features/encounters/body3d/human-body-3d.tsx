'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Button, SegmentedControl, Skeleton, cn } from '@clinic/ui';
import { BodyMap, type MappedPoint } from '@/features/reference/body-map';
import type { PointOption } from '@/features/encounters/points-editor';
import type { PointInstance } from './instances';
import type { CameraView, ViewRequest } from './body-camera-controls';
import type { PickEvent } from './body-model';
import type { EditorBridge } from './body-scene';
import { toBodyPointMap, type BodyPointMap, type BodyPointPosition, type BodyPointRow } from './points';
import { useBodyPointInstances } from './use-body-point-instances';
import { useThemeColors } from './use-theme-colors';
import { SceneErrorBoundary } from './scene-error-boundary';
import { useStoredRaw, writeStored } from '@/lib/use-stored';

/*
 * three.js and the renderer are a few hundred kilobytes that the treatment
 * page must not pay for until the 3D view is actually on screen, and a
 * canvas has nothing to say on the server anyway.
 */
const BodyScene = dynamic(() => import('./body-scene'), { ssr: false, loading: () => null });

/*
 * The placement tool is loaded only when it is opened: a platform admin sees
 * the button, nobody else does, and the chunk never travels to a page that
 * cannot use it.
 */
const PointPlacer = dynamic(() => import('./point-placer'), { ssr: false, loading: () => null });

type ViewMode = '2d' | '3d';
const MODE_STORAGE_KEY = 'herbalist.bodyView';
const CAMERA_VIEWS: CameraView[] = ['front', 'back', 'left', 'right', 'reset'];

/** The address does not change under the page; nothing to listen to. */
const noSubscription = () => () => {};
const readDevEditor = () =>
  process.env.NODE_ENV === 'development' &&
  new URLSearchParams(window.location.search).get('pointEditor') === '1';
const serverDevEditor = () => false;

/**
 * The body panel beside the point columns: the chosen points, drawn on a
 * body.
 *
 * It is a mirror of the list, not a second input — the same `MappedPoint[]`
 * the flat chart has always received drives it, so the two views can never
 * disagree about what was prescribed. The 3D body only changes where a
 * point is drawn, and only for points that have a recorded coordinate
 * (`body_points`, passed in as `positions`); the rest are named underneath
 * rather than guessed at.
 *
 * The flat chart stays one switch away. A practitioner who prefers the
 * schematic loses nothing by choosing it.
 *
 * `canPlace` opens the placement tool: where a point sits on the model is
 * decided by a person, for every clinic at once, and only a platform admin
 * may write it. In development the tool also opens with `?pointEditor=1`,
 * so the click-to-coordinate part can be tried without an admin account
 * (saving still needs one).
 */
export function HumanBody3D({
  points,
  positions,
  catalogue = [],
  canPlace = false,
  onSelect,
  className,
}: {
  points: MappedPoint[];
  /** Every row of body_points, as the page loaded it. */
  positions: BodyPointRow[];
  /** The point catalogue, for the placement tool's picker. */
  catalogue?: PointOption[];
  /** True for a platform admin. */
  canPlace?: boolean;
  /** Called when a marker or its chip is activated, to open the point's page. */
  onSelect?: (point: MappedPoint) => void;
  className?: string;
}) {
  const t = useTranslations('encounters.body3d');
  const colors = useThemeColors();

  // The coordinates, as loaded — and as changed by the placement tool
  // without waiting for the page to reload.
  const [positionMap, setPositionMap] = useState<BodyPointMap>(() => toBodyPointMap(positions));
  const [mapFor, setMapFor] = useState(positions);
  if (mapFor !== positions) {
    setMapFor(positions);
    setPositionMap(toBodyPointMap(positions));
  }
  const { instances, missingCodes } = useBodyPointInstances(points, positionMap);

  // 3-D until this browser has said otherwise (lib/use-stored).
  const storedMode = useStoredRaw(MODE_STORAGE_KEY);
  const mode: ViewMode = storedMode === '2d' ? '2d' : '3d';
  const chooseMode = (next: ViewMode) => writeStored(MODE_STORAGE_KEY, next);

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

  // The placement tool: offered to an admin, and in development to anyone
  // who asks for it in the address.
  const devEditor = useSyncExternalStore(noSubscription, readDevEditor, serverDevEditor);
  const placerAvailable = canPlace || devEditor;
  const [placing, setPlacing] = useState(false);
  const [picked, setPicked] = useState<PickEvent | null>(null);
  const editor = useMemo<EditorBridge | null>(
    () => (placing ? { onPick: setPicked, preview: picked?.position ?? null } : null),
    [placing, picked],
  );
  const clearPick = useCallback(() => setPicked(null), []);
  const onSaved = useCallback((entry: BodyPointPosition) => {
    setPositionMap((current) => {
      const next = new Map(current);
      next.set(entry.code, entry);
      return next;
    });
  }, []);
  const onDeleted = useCallback((code: string) => {
    setPositionMap((current) => {
      const next = new Map(current);
      next.delete(code);
      return next;
    });
  }, []);

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
            {placerAvailable ? (
              <Button
                type="button"
                variant={placing ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2 text-xs"
                aria-pressed={placing}
                onClick={() => {
                  setPlacing((current) => !current);
                  setPicked(null);
                }}
              >
                {placing ? t('placeClose') : t('placeToggle')}
              </Button>
            ) : null}
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

          {placing ? (
            <PointPlacer
              catalogue={catalogue}
              positions={positionMap}
              picked={picked}
              onClear={clearPick}
              onSaved={onSaved}
              onDeleted={onDeleted}
            />
          ) : null}
        </figure>
      )}
    </div>
  );
}
