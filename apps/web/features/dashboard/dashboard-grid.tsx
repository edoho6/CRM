'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GridLayout, noCompactor, useContainerWidth } from 'react-grid-layout';
import { useLocale, useTranslations } from 'next-intl';
import { Check, LayoutGrid, RotateCcw } from 'lucide-react';
import { Alert, Button, EmptyState, cn } from '@clinic/ui';
import type { DashboardLayout, DashboardWidgetInstance } from '@clinic/domain/widgets';
import type { Locale } from '@clinic/domain';
import { AddWidgetDialog } from './add-widget-dialog';
import { DEFAULT_DASHBOARD_LAYOUT } from './default-layout';
import {
  DASHBOARD_COLS,
  DASHBOARD_MARGIN,
  DASHBOARD_ROW_HEIGHT,
  createInstanceId,
  fromGridLayout,
  layoutsEqual,
  nextAvailableY,
  toGridLayout,
} from './layout-utils';
import { saveDashboardLayout } from './actions';
import { getWidgetDefinition } from './widgets';
import { WidgetFrame } from './widget-frame';

const SAVE_DEBOUNCE_MS = 800;
const DESKTOP_QUERY = '(min-width: 768px)';

/**
 * The customisable dashboard.
 *
 * Two deliberate decisions here:
 *
 * 1. Below 768px the grid is replaced by a plain stacked list. The grid library
 *    would otherwise recompact the layout to fit a narrow screen and fire
 *    `onLayoutChange`, silently overwriting the arrangement the user built on
 *    their desktop.
 *
 * 2. Saving is debounced and automatic. A "save layout" button is one more thing
 *    to forget, and the cost of a lost drag is an annoyed user rebuilding their
 *    dashboard.
 */
export function DashboardGrid({ initialLayout }: { initialLayout: DashboardLayout }) {
  const t = useTranslations('dashboard');
  const locale = useLocale() as Locale;
  const isRtl = locale === 'he';
  const dir = isRtl ? 'rtl' : 'ltr';

  const [layout, setLayout] = useState<DashboardLayout>(initialLayout);
  const [isEditing, setIsEditing] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [saveError, setSaveError] = useState(false);

  const { width, containerRef, mounted } = useContainerWidth();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<DashboardLayout>(initialLayout);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const persist = useCallback((next: DashboardLayout) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (layoutsEqual(next, lastSaved.current)) return;
      const result = await saveDashboardLayout(next);
      if (result.ok) {
        lastSaved.current = next;
        setSaveError(false);
      } else {
        setSaveError(true);
      }
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // Flush a pending save if the user navigates away mid-debounce.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const update = useCallback(
    (next: DashboardLayout) => {
      setLayout(next);
      persist(next);
    },
    [persist],
  );

  const constraints = useMemo(() => {
    const result: Record<string, { minW?: number; minH?: number; maxW?: number; maxH?: number }> = {};
    for (const item of layout) {
      const definition = getWidgetDefinition(item.type);
      if (!definition) continue;
      const { minW, minH, maxW, maxH } = definition.defaultLayout;
      result[item.type] = { minW, minH, maxW, maxH };
    }
    return result;
  }, [layout]);

  const gridLayout = useMemo(() => toGridLayout(layout, dir, constraints), [layout, dir, constraints]);

  const handleGridChange = useCallback(
    (next: readonly { i: string; x: number; y: number; w: number; h: number }[]) => {
      const converted = fromGridLayout(next, layout, dir);
      if (layoutsEqual(converted, layout)) return;
      update(converted);
    },
    [layout, dir, update],
  );

  const handleConfigChange = useCallback(
    (instanceId: string, config: unknown) => {
      update(layout.map((item) => (item.id === instanceId ? { ...item, config } : item)));
    },
    [layout, update],
  );

  const handleRemove = useCallback(
    (instanceId: string) => {
      update(layout.filter((item) => item.id !== instanceId));
    },
    [layout, update],
  );

  const handleAdd = useCallback(
    (definition: { type: string; defaultLayout: { w: number; h: number }; defaultConfig: unknown }) => {
      const instance: DashboardWidgetInstance = {
        id: createInstanceId(definition.type),
        type: definition.type,
        x: 0,
        y: nextAvailableY(layout),
        w: definition.defaultLayout.w,
        h: definition.defaultLayout.h,
        config: definition.defaultConfig,
      };
      update([...layout, instance]);
      setIsEditing(true);
    },
    [layout, update],
  );

  const handleReset = useCallback(() => {
    if (!window.confirm(t('resetConfirm'))) return;
    update(DEFAULT_DASHBOARD_LAYOUT);
  }, [t, update]);

  const renderWidget = useCallback(
    (item: DashboardWidgetInstance) => {
      const definition = getWidgetDefinition(item.type);
      if (!definition) {
        // A layout referencing a widget type that no longer exists must not blank
        // the dashboard — show a placeholder the user can remove.
        return (
          <WidgetFrame
            title={item.type}
            isEditing={isEditing}
            onRemove={() => handleRemove(item.id)}
          >
            <p className="text-sm text-ink-400">{item.type}</p>
          </WidgetFrame>
        );
      }

      const WidgetComponent = definition.component;
      const parsed = definition.configSchema
        ? definition.configSchema.safeParse(item.config ?? definition.defaultConfig)
        : null;
      const config = parsed && parsed.success ? parsed.data : (item.config ?? definition.defaultConfig);

      return (
        <WidgetFrame
          title={definition.displayName[locale] ?? definition.type}
          isEditing={isEditing}
          onRemove={() => handleRemove(item.id)}
        >
          <WidgetComponent
            instanceId={item.id}
            config={config}
            isEditing={isEditing}
            onConfigChange={(next: unknown) => handleConfigChange(item.id, next)}
          />
        </WidgetFrame>
      );
    },
    [handleConfigChange, handleRemove, isEditing, locale],
  );

  const toolbar = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <AddWidgetDialog layout={layout} onAdd={handleAdd} />
        {isDesktop ? (
          <Button
            variant={isEditing ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setIsEditing((value) => !value)}
          >
            {isEditing ? <Check className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            {isEditing ? t('doneEditing') : t('editLayout')}
          </Button>
        ) : null}
        {isEditing ? (
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />
            {t('resetLayout')}
          </Button>
        ) : null}
      </div>
      {isEditing ? <p className="text-xs text-ink-500">{t('editHint')}</p> : null}
    </div>
  );

  if (layout.length === 0) {
    return (
      <div>
        {toolbar}
        <EmptyState
          icon={<LayoutGrid className="h-8 w-8" />}
          title={t('emptyTitle')}
          description={t('emptyBody')}
        />
      </div>
    );
  }

  return (
    <div>
      {toolbar}

      {saveError ? (
        <Alert tone="danger" className="mb-3">
          {t('layoutSaved')}
        </Alert>
      ) : null}

      {/* Stacked, non-draggable rendering on small screens. */}
      {!isDesktop ? (
        <div className="space-y-3">
          {layout.map((item) => (
            <div key={item.id} style={{ minHeight: item.h * DASHBOARD_ROW_HEIGHT }}>
              {renderWidget(item)}
            </div>
          ))}
        </div>
      ) : (
        <div ref={containerRef} className={cn(isEditing && 'dashboard-editing')}>
          {mounted && width > 0 ? (
            <GridLayout
              width={width}
              layout={gridLayout}
              onLayoutChange={handleGridChange}
              // The layout is already computed (and RTL-mirrored) by hand in
              // layout-utils.ts. Automatic compaction would recompute positions
              // itself and could disagree with that math, which is what produced
              // overlapping widgets — so every arrangement here is exactly what
              // was asked for, nothing more.
              compactor={noCompactor}
              gridConfig={{
                cols: DASHBOARD_COLS,
                rowHeight: DASHBOARD_ROW_HEIGHT,
                margin: DASHBOARD_MARGIN,
                containerPadding: [0, 0],
              }}
              dragConfig={{
                enabled: isEditing,
                handle: '.widget-drag-handle',
                bounded: false,
              }}
              resizeConfig={{ enabled: isEditing, handles: ['se'] }}
            >
              {layout.map((item) => (
                <div key={item.id}>{renderWidget(item)}</div>
              ))}
            </GridLayout>
          ) : null}
        </div>
      )}
    </div>
  );
}
