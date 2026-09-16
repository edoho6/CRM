import type { AppointmentWithRelations } from '@clinic/db/types';
import { minutesSinceMidnight } from './date-utils';

/**
 * Where a day's bookings sit on the diary's grid.
 *
 * A module of its own, and not a helper inside the view, because this is a
 * calculation with a clinical consequence: get it wrong and a double booking
 * is drawn underneath another one, which reads as a free hour. The rule in
 * CLAUDE.md — a calculation lives in a tested module — is meant for exactly
 * this, and this one had been inside an 1,100-line component since it was
 * written.
 *
 * Everything here is in minutes and in slots. Turning slots into a length on
 * the screen is the view's business, and it does it at the last moment so the
 * grid can grow with the text size.
 */

/**
 * Visible hours. Outside these the grid would be mostly empty scrolling.
 *
 * Six to eleven rather than seven to ten: an early treatment before work and a
 * late one after it both fell outside the grid, and a booking the diary cannot
 * draw is a booking you find out about from the patient.
 */
export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 23;
export const SLOT_MINUTES = 30;

/**
 * The height of one half hour, in rem rather than px, so the grid grows with
 * the text: at 200% text size a 28px slot held a 24px line and cut it off.
 * Positions are computed in slots and turned into rem at the edge.
 */
export const SLOT_HEIGHT_REM = 1.75;
export const slotsToRem = (slots: number) => `${slots * SLOT_HEIGHT_REM}rem`;

export const TOTAL_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;
export const SLOT_COUNT = TOTAL_MINUTES / SLOT_MINUTES;

/** The shortest a block may be drawn, in slots: one line of text still fits. */
const MIN_HEIGHT_SLOTS = 0.65;
/** A booking shorter than this is drawn as this, so it can be clicked at all. */
const MIN_MINUTES = 15;

export interface PositionedAppointment {
  appointment: AppointmentWithRelations;
  /** Slots from the top of the grid. */
  top: number;
  /** Height in slots. */
  height: number;
  /** Which lane, counting from the start edge. */
  column: number;
  /** How many lanes this block's cluster is divided into. */
  columns: number;
}

/**
 * Lays out a day's appointments, splitting overlapping ones into side-by-side
 * columns so a double-booked slot is visible rather than hidden underneath.
 *
 * With rooms, the columns are the rooms: room one is always the first lane
 * and room two the second, all day, so a block's position says where it is
 * before its text is read. A day with no overlap at all keeps full-width
 * blocks — the lanes are worth their width only when something shares the
 * hour.
 */
export function positionDay(
  appointments: AppointmentWithRelations[],
  roomLane: Map<string, number>,
): PositionedAppointment[] {
  const sorted = [...appointments].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  );

  const positioned: PositionedAppointment[] = [];
  let cluster: AppointmentWithRelations[] = [];
  let clusterEnd = 0;

  // Whether anything in the day overlaps anything else, decided up front so
  // every cluster of the day is drawn with the same lanes.
  let overlaps = false;
  let runningEnd = 0;
  for (const appointment of sorted) {
    const start = new Date(appointment.start_at).getTime();
    if (start < runningEnd) overlaps = true;
    runningEnd = Math.max(runningEnd, new Date(appointment.end_at).getTime());
  }
  const laneCount = overlaps && roomLane.size >= 2 ? roomLane.size : 0;

  const flush = () => {
    if (cluster.length === 0) return;
    // Greedy column assignment within the cluster — after the room's own lane,
    // when there is one and it is free at that hour.
    const columnEnds: (number | undefined)[] = [];
    const assignments = cluster.map((appointment) => {
      const start = new Date(appointment.start_at).getTime();
      const end = new Date(appointment.end_at).getTime();
      const preferred =
        laneCount && appointment.room ? roomLane.get(appointment.room.id) : undefined;
      let column =
        preferred !== undefined &&
        (columnEnds[preferred] === undefined || columnEnds[preferred] <= start)
          ? preferred
          : columnEnds.findIndex((value) => value === undefined || value <= start);
      if (column === -1) {
        column = columnEnds.length;
      }
      columnEnds[column] = end;
      return { appointment, column };
    });

    const columns = Math.max(columnEnds.length, laneCount);
    for (const { appointment, column } of assignments) {
      const start = new Date(appointment.start_at);
      const end = new Date(appointment.end_at);
      const startMinutes = minutesSinceMidnight(start) - DAY_START_HOUR * 60;
      const endMinutes = minutesSinceMidnight(end) - DAY_START_HOUR * 60;
      const clampedStart = Math.max(0, startMinutes);
      const clampedEnd = Math.min(TOTAL_MINUTES, Math.max(endMinutes, clampedStart + MIN_MINUTES));

      positioned.push({
        appointment,
        // In slots. The floor keeps a fifteen-minute booking tall enough to
        // hold one line of text.
        top: clampedStart / SLOT_MINUTES,
        height: Math.max((clampedEnd - clampedStart) / SLOT_MINUTES, MIN_HEIGHT_SLOTS),
        column,
        columns,
      });
    }
    cluster = [];
    clusterEnd = 0;
  };

  for (const appointment of sorted) {
    const start = new Date(appointment.start_at).getTime();
    const end = new Date(appointment.end_at).getTime();
    if (cluster.length > 0 && start >= clusterEnd) {
      flush();
    }
    cluster.push(appointment);
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();

  return positioned;
}
