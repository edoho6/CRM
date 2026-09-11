'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@clinic/ui';

/**
 * A column of the treatment page, in the order the practitioner wants.
 *
 * Which block matters most differs by practice: one clinic dispenses herbs at
 * every visit and wants the prescription at the top, another writes the
 * history before the complaint. The order is theirs to set, and it stays set.
 * The same component lays out the side column (tongue and pulse, herbs, the
 * comparison, questionnaires) and the fields of the record itself.
 *
 * Nothing moves until the arrange switch is pressed — one switch, in the
 * page header, for both columns; the switch is the page's, not this
 * component's. A block that can be dragged at any time is a block that gets
 * dragged by accident while reaching for a field inside it; the switch makes
 * moving a deliberate act, and the grip bars appear only while it is on. The
 * order lives in this browser, like the collapsed sidebar — it is a
 * preference of the seat, not of the record.
 *
 * Same machinery as the dashboard widgets: dnd-kit with a keyboard sensor, so
 * a block can be moved with the arrow keys as well as a pointer.
 */

export interface SidePanel {
  id: string;
  title: string;
  node: React.ReactNode;
}

/** Stored order first, then anything newer that the stored order has never met. */
function mergeOrder(stored: string[], known: string[]): string[] {
  return [...stored.filter((id) => known.includes(id)), ...known.filter((id) => !stored.includes(id))];
}

export function SidePanels({
  panels,
  editing,
  storageKey,
  resizable = true,
  className,
}: {
  panels: SidePanel[];
  /** Whether the grip bars are out and the blocks can be dragged. */
  editing: boolean;
  /** Where this column's order is kept. One key per column. */
  storageKey: string;
  /** Each block can be pulled taller or shorter from its corner, like a text box. */
  resizable?: boolean;
  className?: string;
}) {
  // Keyed on the ids as a string, not on the array: the parent builds `panels`
  // inline on every keystroke, and an effect keyed on that would re-read the
  // stored order (and re-render) each time. The ids only change when a panel
  // is added or removed, which is when the stored order needs merging again.
  const knownKey = panels.map((panel) => panel.id).join(' ');
  const known = useMemo(() => knownKey.split(' '), [knownKey]);
  const [order, setOrder] = useState<string[]>(known);

  // Read after mount, so the server and the first client render agree.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const stored: unknown = JSON.parse(raw);
      if (Array.isArray(stored)) setOrder(mergeOrder(stored.filter((v) => typeof v === 'string'), known));
    } catch {
      // Site data blocked. The default order every time is the whole cost.
    }
  }, [known, storageKey]);

  const persist = useCallback(
    (next: string[]) => {
      setOrder(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // As above.
      }
    },
    [storageKey],
  );

  const sensors = useSensors(
    // A small distance threshold keeps a plain click on the bar from starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const from = order.indexOf(String(active.id));
      const to = order.indexOf(String(over.id));
      if (from === -1 || to === -1) return;
      persist(arrayMove(order, from, to));
    },
    [order, persist],
  );

  const ordered = mergeOrder(order, known)
    .map((id) => panels.find((panel) => panel.id === id))
    .filter((panel): panel is SidePanel => Boolean(panel));

  return (
    <div className={cn('min-w-0 space-y-4', className)}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ordered.map((panel) => panel.id)} strategy={verticalListSortingStrategy}>
          {ordered.map((panel) => (
            <SortablePanel key={panel.id} id={panel.id} title={panel.title} editing={editing} resizable={resizable}>
              {panel.node}
            </SortablePanel>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortablePanel({
  id,
  title,
  editing,
  resizable,
  children,
}: {
  id: string;
  title: string;
  editing: boolean;
  resizable: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editing,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'z-10 opacity-90')}
    >
      {editing ? (
        // Only the bar carries the listeners, so the block underneath keeps
        // working as a form while the order is being changed.
        <div
          {...attributes}
          {...listeners}
          className={cn(
            'widget-drag-handle flex items-center gap-2 rounded-t-lg border border-b-0 border-ink-200 bg-ink-50 px-3 py-1.5 text-xs font-medium text-ink-700',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          )}
        >
          <GripVertical className="h-3.5 w-3.5 shrink-0 text-ink-500" aria-hidden />
          <span className="truncate">{title}</span>
        </div>
      ) : null}
      {/* Pulled taller or shorter from the corner, like a text box: a long
          prescription history can be shrunk, the tongue and pulse stretched. */}
      <div
        className={cn(
          resizable && 'min-h-24 resize-y overflow-auto rounded-card',
          editing && 'rounded-t-none border border-t-0 border-ink-200 [&>*:first-child]:rounded-t-none',
        )}
      >
        {children}
      </div>
    </div>
  );
}
