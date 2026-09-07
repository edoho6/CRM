'use client';

import type { DraggableAttributes } from '@dnd-kit/core';
import { GripVertical, Maximize2, X } from 'lucide-react';

/** The pointer/keyboard listeners `useSortable` returns for the drag handle. */
type DragListeners = Record<string, (event: React.SyntheticEvent) => void> | undefined;
import { useTranslations } from 'next-intl';
import { cn, Spinner } from '@clinic/ui';
import type { WidgetSize } from '@clinic/domain/widgets';

/**
 * Chrome shared by every widget: title bar, drag handle, resize and remove.
 *
 * Only the header carries the drag listeners, so text and controls inside a
 * widget stay clickable and selectable while the dashboard is in edit mode.
 */
export function WidgetFrame({
  title,
  isEditing,
  size,
  onRemove,
  onResize,
  dragHandle,
  children,
  headerAction,
  className,
  bodyClassName,
}: {
  title: React.ReactNode;
  isEditing: boolean;
  size: WidgetSize;
  onRemove?: () => void;
  onResize?: () => void;
  dragHandle?: { attributes: DraggableAttributes; listeners: DragListeners };
  children: React.ReactNode;
  headerAction?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const t = useTranslations('dashboard');

  return (
    <section
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-card border border-ink-200 bg-white shadow-xs',
        isEditing && 'ring-2 ring-jade-500/30',
        className,
      )}
    >
      <header
        className={cn(
          'flex shrink-0 items-center gap-2 border-b border-ink-100 px-3 py-2',
          isEditing && 'widget-drag-handle bg-ink-50',
        )}
        {...(isEditing ? dragHandle?.attributes : {})}
        {...(isEditing ? dragHandle?.listeners : {})}
      >
        {isEditing ? <GripVertical className="h-3.5 w-3.5 shrink-0 text-ink-500" aria-hidden /> : null}
        <h2 className="min-w-0 flex-1 truncate text-xs font-semibold tracking-wide text-ink-600 uppercase">
          {title}
        </h2>
        {headerAction}
        {isEditing && onResize ? (
          <button
            type="button"
            onClick={onResize}
            // Stop the drag sensor from treating this click as a drag start.
            onPointerDown={(event) => event.stopPropagation()}
            aria-label={t('resize')}
            title={`${t('resize')} · ${t(`sizes.${size}`)}`}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-ink-500 transition-colors hover:bg-jade-50 hover:text-jade-800"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            {t(`sizes.${size}`)}
          </button>
        ) : null}
        {isEditing && onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            onPointerDown={(event) => event.stopPropagation()}
            aria-label={t('removeWidget')}
            className="rounded-md p-1 text-ink-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </header>
      <div className={cn('min-h-0 flex-1 overflow-y-auto p-3', bodyClassName)}>{children}</div>
    </section>
  );
}

export function WidgetLoading() {
  return (
    <div className="flex h-full items-center justify-center text-ink-300">
      <Spinner />
    </div>
  );
}

export function WidgetEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center px-2 text-center text-sm text-ink-500">
      {children}
    </div>
  );
}
