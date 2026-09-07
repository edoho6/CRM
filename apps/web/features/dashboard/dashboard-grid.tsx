'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLocale, useTranslations } from 'next-intl';
import { Check, LayoutGrid, RotateCcw } from 'lucide-react';
import { Alert, Button, EmptyState, cn } from '@clinic/ui';
import type { DashboardLayout, DashboardWidgetInstance, WidgetSize } from '@clinic/domain/widgets';
import type { Locale } from '@clinic/domain';
import { AddWidgetDialog } from './add-widget-dialog';
import { DEFAULT_DASHBOARD_LAYOUT } from './default-layout';
import {
  SIZE_CLASSES,
  SIZE_MIN_HEIGHT,
  createInstanceId,
  layoutsEqual,
  nextSize,
} from './layout-utils';
import { saveDashboardLayout } from './actions';
import { getWidgetDefinition } from './widgets';
import { WidgetFrame } from './widget-frame';

const SAVE_DEBOUNCE_MS = 800;

/**
 * The customisable dashboard.
 *
 * A CSS grid in reading order, with drag-to-reorder and a size cycle per widget.
 * Nothing here computes a pixel position: the browser lays the grid out, which is
 * what makes it impossible for two widgets to overlap and makes Hebrew work with
 * no mirroring at all — the grid simply flows from the start edge.
 *
 * Saving is debounced and automatic. A "save layout" button is one more thing
 * to forget, and the cost of a lost drag is an annoyed user rebuilding their
 * dashboard.
 */
export function DashboardGrid({ initialLayout }: { initialLayout: DashboardLayout }) {
  const t = useTranslations('dashboard');
  const locale = useLocale() as Locale;

  const [layout, setLayout] = useState<DashboardLayout>(initialLayout);
  const [isEditing, setIsEditing] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<DashboardLayout>(initialLayout);

  const sensors = useSensors(
    // A small distance threshold keeps a plain click on the header from
    // starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  const ids = useMemo(() => layout.map((item) => item.id), [layout]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const from = layout.findIndex((item) => item.id === active.id);
      const to = layout.findIndex((item) => item.id === over.id);
      if (from === -1 || to === -1) return;
      update(arrayMove(layout, from, to));
    },
    [layout, update],
  );

  const handleConfigChange = useCallback(
    (instanceId: string, config: unknown) => {
      update(layout.map((item) => (item.id === instanceId ? { ...item, config } : item)));
    },
    [layout, update],
  );

  const handleRemove = useCallback(
    (instanceId: string) => update(layout.filter((item) => item.id !== instanceId)),
    [layout, update],
  );

  const handleResize = useCallback(
    (instanceId: string) => {
      update(
        layout.map((item) => {
          if (item.id !== instanceId) return item;
          const allowed = getWidgetDefinition(item.type)?.allowedSizes;
          return { ...item, size: nextSize(item.size, allowed) };
        }),
      );
    },
    [layout, update],
  );

  const handleAdd = useCallback(
    (definition: { type: string; defaultSize: WidgetSize; defaultConfig: unknown }) => {
      const instance: DashboardWidgetInstance = {
        id: createInstanceId(definition.type),
        type: definition.type,
        size: definition.defaultSize,
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

  const toolbar = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <AddWidgetDialog layout={layout} onAdd={handleAdd} />
        <Button
          variant={isEditing ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setIsEditing((value) => !value)}
        >
          {isEditing ? <Check className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
          {isEditing ? t('doneEditing') : t('editLayout')}
        </Button>
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
          {t('saveFailed')}
        </Alert>
      ) : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-6 xl:grid-cols-12', isEditing && 'dashboard-editing')}>
            {layout.map((item) => (
              <SortableWidget
                key={item.id}
                item={item}
                locale={locale}
                isEditing={isEditing}
                onRemove={() => handleRemove(item.id)}
                onResize={() => handleResize(item.id)}
                onConfigChange={(config) => handleConfigChange(item.id, config)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableWidget({
  item,
  locale,
  isEditing,
  onRemove,
  onResize,
  onConfigChange,
}: {
  item: DashboardWidgetInstance;
  locale: Locale;
  isEditing: boolean;
  onRemove: () => void;
  onResize: () => void;
  onConfigChange: (config: unknown) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !isEditing,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const definition = getWidgetDefinition(item.type);

  let body: React.ReactNode;
  let title: React.ReactNode = item.type;

  if (!definition) {
    // A layout referencing a widget type that no longer exists must not blank
    // the dashboard — show a placeholder the user can remove.
    body = <p className="text-sm text-ink-500">{item.type}</p>;
  } else {
    const WidgetComponent = definition.component;
    const parsed = definition.configSchema
      ? definition.configSchema.safeParse(item.config ?? definition.defaultConfig)
      : null;
    const config = parsed && parsed.success ? parsed.data : (item.config ?? definition.defaultConfig);
    title = definition.displayName[locale] ?? definition.type;
    body = (
      <WidgetComponent
        instanceId={item.id}
        config={config}
        isEditing={isEditing}
        size={item.size}
        onConfigChange={onConfigChange}
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(SIZE_CLASSES[item.size], SIZE_MIN_HEIGHT[item.size], isDragging && 'z-30 opacity-90')}
    >
      <WidgetFrame
        title={title}
        isEditing={isEditing}
        size={item.size}
        onRemove={onRemove}
        onResize={onResize}
        dragHandle={{ attributes, listeners: listeners as never }}
      >
        {body}
      </WidgetFrame>
    </div>
  );
}
