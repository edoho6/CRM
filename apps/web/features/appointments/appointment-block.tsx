'use client';

import { useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useFormatter } from 'next-intl';
import type { AppointmentWithRelations } from '@clinic/db/types';
import { DEFAULT_ENTRY_COLOR, type Locale } from '@clinic/domain';
import { cn } from '@clinic/ui';
import { appointmentTypeName, patientFullName } from '@/lib/display';
import { ConfirmationDot } from './confirmation-status';
import { addDays, addMinutes } from './date-utils';

/** A drag lands on the quarter hour: finer than that is noise, coarser is a fight. */
export const DRAG_SNAP_MINUTES = 15;

/**
 * One booking on the time grid: a button that opens the details, and a
 * draggable that moves the booking to another hour — or, in the week, to
 * another day.
 *
 * The block itself moves under the pointer, no ghost, and while it moves
 * its hour reads the hour it would land on, snapped to the quarter, so the
 * hand knows where it is before it lets go. A click without movement still
 * opens the details; on a phone a long press picks the block up and a
 * short swipe scrolls the day as before; for the keyboard, Space picks it
 * up, the arrows move it, Space drops it, and Enter still opens it. Where
 * it lands is the diary's decision — it knows the columns and the hours.
 */
export function AppointmentBlock({
  appointment,
  top,
  height,
  column,
  columns,
  narrow,
  locale,
  slotHeightRem,
  slotMinutes,
  onOpen,
  keyOffset,
  onKeyDown,
  onBlur,
}: {
  appointment: AppointmentWithRelations;
  /** Position and size in half-hour slots. */
  top: number;
  height: number;
  column: number;
  columns: number;
  /** A week's lane: only the hour and the name fit. */
  narrow: boolean;
  locale: Locale;
  slotHeightRem: number;
  slotMinutes: number;
  onOpen: () => void;
  /** The keyboard's move so far — the block is lifted while this is set. */
  keyOffset: { minutes: number; days: number } | null;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  onBlur: () => void;
}) {
  const format = useFormatter();
  // The diary reads the drop against the block's column, which it finds from
  // the node itself; the ref travels with the drag's data.
  const nodeRef = useRef<HTMLButtonElement | null>(null);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: appointment.id,
    data: { appointment, node: nodeRef },
  });

  const color = appointment.appointment_type?.color ?? DEFAULT_ENTRY_COLOR;
  const isCancelled = appointment.status === 'cancelled';
  const widthPercent = 100 / columns;
  const roomColor = appointment.room?.color ?? null;
  const start = new Date(appointment.start_at);
  const slotsToRem = (slots: number) => `${slots * slotHeightRem}rem`;

  // The hour the block would land on, read from how far it has moved. The
  // slot's height in pixels comes from the root font size, so it follows
  // the text-size setting like the grid does.
  let shown = start;
  let keyTransform: string | undefined;
  if (keyOffset) {
    // Lifted by the keyboard: the offset is whole quarter hours and days,
    // drawn as rem down the column and as column widths across.
    shown = addMinutes(addDays(start, keyOffset.days), keyOffset.minutes);
    const column = nodeRef.current?.closest<HTMLElement>('[data-day-column]');
    const width = column?.getBoundingClientRect().width ?? 0;
    const rtl = column ? getComputedStyle(column).direction === 'rtl' : false;
    const x = keyOffset.days * width * (rtl ? -1 : 1);
    keyTransform = `translate(${x}px, ${(keyOffset.minutes / slotMinutes) * slotHeightRem}rem)`;
  } else if (isDragging && transform) {
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const slotPx = rootPx * slotHeightRem;
    const minutes =
      Math.round(((transform.y / slotPx) * slotMinutes) / DRAG_SNAP_MINUTES) * DRAG_SNAP_MINUTES;
    shown = addMinutes(start, minutes);
  }
  const lifted = isDragging || Boolean(keyOffset);

  return (
    <button
      ref={(element) => {
        setNodeRef(element);
        nodeRef.current = element;
      }}
      type="button"
      aria-haspopup="dialog"
      onClick={onOpen}
      {...attributes}
      {...listeners}
      aria-pressed={lifted}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      style={{
        top: slotsToRem(top),
        height: slotsToRem(height),
        // Logical offsets keep events flowing in reading order.
        insetInlineStart: `calc(${column * widthPercent}% + 2px)`,
        width: `calc(${widthPercent}% - 4px)`,
        borderInlineStartColor: roomColor ?? color,
        backgroundColor: isCancelled ? undefined : `${color}1a`,
        transform: keyTransform ?? CSS.Translate.toString(transform),
      }}
      className={cn(
        'absolute overflow-hidden rounded-md border-s-3 text-start transition-shadow hover:shadow-md',
        narrow ? 'px-1 py-0.5' : 'px-1.5 py-0.5',
        isCancelled ? 'bg-ink-100 text-ink-500 line-through' : 'text-ink-900',
        // Lifted while it moves: above its neighbours, with a shadow and a
        // ring, and no transition on the shadow so it does not lag the hand.
        lifted && 'z-30 cursor-grabbing shadow-lg ring-2 ring-jade-500 transition-none',
      )}
    >
      <span className="flex items-center gap-1">
        {/* Whether the patient said they are coming, as a
            dot beside the hour: grey, amber, green, red. */}
        {!isCancelled ? (
          <ConfirmationDot appointment={appointment} className={narrow ? 'h-2 w-2' : undefined} />
        ) : null}
        <span className="block truncate text-xs font-semibold tabular-nums" dir="ltr">
          {format.dateTime(shown, 'time')}
        </span>
        {appointment.room && !narrow ? (
          <span
            className="ms-auto max-w-[45%] truncate rounded px-1 text-xs font-medium leading-4"
            style={{
              backgroundColor: `${appointment.room.color}33`,
              color: 'inherit',
            }}
            title={appointment.room.name}
          >
            {appointment.room.name}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          'block leading-tight',
          narrow ? 'line-clamp-2 text-xs font-medium' : 'truncate text-sm',
        )}
      >
        {patientFullName(appointment.patient)}
      </span>
      {height > 1.5 && !narrow ? (
        <span className="block truncate text-xs text-ink-500">
          {appointmentTypeName(appointment.appointment_type, locale)}
        </span>
      ) : null}
    </button>
  );
}
