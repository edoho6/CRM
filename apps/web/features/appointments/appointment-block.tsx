'use client';

import { useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useFormatter, useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import type { AppointmentWithRelations } from '@clinic/db/types';
import { DEFAULT_ENTRY_COLOR, PAID_ENTRY_COLOR, type Locale } from '@clinic/domain';
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
  paid,
  past,
  showType,
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
  /**
   * Paid for: the block turns green, in the same light tint the type colour
   * uses, and says "paid" in words — the colour is never the only sign.
   */
  paid: boolean;
  /** Over by the time the page was drawn: the name is struck through. */
  past: boolean;
  /**
   * The type's name at the foot of the block, only when it says something:
   * not for the clinic's everyday visit, which every block would repeat.
   */
  showType: boolean;
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
  const tPayment = useTranslations('billing.payment.state');
  // The diary reads the drop against the block's column, which it finds from
  // the node itself; the ref travels with the drag's data.
  const nodeRef = useRef<HTMLButtonElement | null>(null);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: appointment.id,
    data: { appointment, node: nodeRef },
  });

  const isCancelled = appointment.status === 'cancelled';
  const isPaid = paid && !isCancelled;
  const color = isPaid
    ? PAID_ENTRY_COLOR
    : (appointment.appointment_type?.color ?? DEFAULT_ENTRY_COLOR);
  const widthPercent = 100 / columns;
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
      // Only while lifted: a button that always says "not pressed" reads as a
      // toggle with no meaning. dnd-kit sets the attribute; this narrows it.
      aria-pressed={lifted || undefined}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      style={{
        top: slotsToRem(top),
        height: slotsToRem(height),
        // Logical offsets keep events flowing in reading order.
        insetInlineStart: `calc(${column * widthPercent}% + 2px)`,
        width: `calc(${widthPercent}% - 4px)`,
        borderInlineStartColor: color,
        // Paid fills the whole box with the theme's light green (it turns
        // dark in the dark theme), not the faint tint the other bookings
        // wear: at ten percent a paid block read as grey.
        backgroundColor: isCancelled ? undefined : isPaid ? 'var(--color-jade-100)' : `${color}1a`,
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
        {/* In a narrow lane there is no room for the word: a tick, named. */}
        {isPaid && narrow ? (
          <Check
            className="h-3 w-3 shrink-0 text-jade-800"
            aria-label={tPayment('paid')}
            role="img"
          />
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
      <span className="flex items-baseline gap-1">
        <span
          className={cn(
            'block min-w-0 leading-tight',
            narrow ? 'line-clamp-2 text-xs font-medium' : 'truncate text-sm',
            past && 'line-through decoration-ink-500',
          )}
        >
          {patientFullName(appointment.patient)}
        </span>
        {/* Under the room, at the far end: where the eye already goes for
            the booking's facts. */}
        {isPaid && !narrow ? (
          <span className="ms-auto shrink-0 text-xs font-semibold leading-tight text-jade-800">
            {tPayment('paid')}
          </span>
        ) : null}
      </span>
      {showType && height > 1.5 && !narrow ? (
        <span className="block truncate text-xs text-ink-500">
          {appointmentTypeName(appointment.appointment_type, locale)}
        </span>
      ) : null}
    </button>
  );
}
