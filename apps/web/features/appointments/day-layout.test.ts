import { describe, expect, it } from 'vitest';
import type { AppointmentWithRelations } from '@clinic/db/types';
import {
  DAY_START_HOUR,
  SLOT_MINUTES,
  TOTAL_MINUTES,
  positionDay,
  slotsToRem,
} from './day-layout';

/**
 * The diary's own arithmetic, on a fixed day.
 *
 * Times are written as local hours, because that is how the grid reads them —
 * `minutesSinceMidnight` asks the Date for its local hour, so a UTC string
 * here would test the machine's time zone rather than the layout.
 */
function at(hour: number, minute = 0): string {
  return new Date(2026, 8, 16, hour, minute, 0, 0).toISOString();
}

let next = 0;
function booking(
  startHour: number,
  endHour: number,
  room?: string,
): AppointmentWithRelations {
  next += 1;
  return {
    id: `a${next}`,
    start_at: at(startHour),
    end_at: at(endHour),
    room: room ? { id: room, name: room, color: null } : null,
  } as unknown as AppointmentWithRelations;
}

describe('positionDay', () => {
  it('places a booking by the hour it starts, in slots from the top of the grid', () => {
    const [block] = positionDay([booking(10, 11)], new Map());
    expect(block!.top).toBe(((10 - DAY_START_HOUR) * 60) / SLOT_MINUTES);
    expect(block!.height).toBe(60 / SLOT_MINUTES);
    expect(block!.column).toBe(0);
    expect(block!.columns).toBe(1);
  });

  it('keeps a day without overlap full width, whatever the rooms are', () => {
    const rooms = new Map([
      ['r1', 0],
      ['r2', 1],
    ]);
    const blocks = positionDay([booking(9, 10, 'r1'), booking(10, 11, 'r2')], rooms);
    expect(blocks.map((block) => block.columns)).toEqual([1, 1]);
  });

  it('splits an overlap into lanes so neither booking hides the other', () => {
    const blocks = positionDay([booking(9, 11), booking(10, 12)], new Map());
    expect(blocks.map((block) => block.columns)).toEqual([2, 2]);
    expect(blocks.map((block) => block.column)).toEqual([0, 1]);
  });

  it('gives each room its own lane for the whole day once anything overlaps', () => {
    const rooms = new Map([
      ['r1', 0],
      ['r2', 1],
    ]);
    // Two that overlap in their own rooms, and a third later one in room two:
    // the lane is the room's, so the late booking is in lane two as well.
    const blocks = positionDay(
      [booking(9, 11, 'r1'), booking(10, 12, 'r2'), booking(14, 15, 'r2')],
      rooms,
    );
    expect(blocks.map((block) => block.column)).toEqual([0, 1, 1]);
    expect(blocks.every((block) => block.columns === 2)).toBe(true);
  });

  it('reuses a lane once it is free, rather than adding one per booking', () => {
    // Three bookings, the first two overlapping: the third starts after the
    // first ends and belongs in the first lane again.
    const blocks = positionDay([booking(9, 11), booking(10, 12), booking(11, 13)], new Map());
    expect(blocks.map((block) => block.column)).toEqual([0, 1, 0]);
  });

  it('orders the day by its start, whatever order the rows arrive in', () => {
    const late = booking(15, 16);
    const early = booking(8, 9);
    const blocks = positionDay([late, early], new Map());
    expect(blocks.map((block) => block.appointment.id)).toEqual([early.id, late.id]);
  });

  it('draws a very short booking tall enough to be read and clicked', () => {
    const quarter = positionDay([{ ...booking(10, 10), end_at: at(10, 5) }], new Map());
    expect(quarter[0]!.height).toBeGreaterThanOrEqual(0.65);
  });

  it('clamps a booking that starts before the grid does', () => {
    const early = { ...booking(7, 8), start_at: at(4), end_at: at(7) };
    const [block] = positionDay([early], new Map());
    expect(block!.top).toBe(0);
    // Four in the morning to seven, of which only six to seven is on the grid.
    expect(block!.height).toBe(60 / SLOT_MINUTES);
  });

  it('clamps a booking that runs past the end of the grid', () => {
    const late = { ...booking(22, 23), end_at: at(23, 59) };
    const [block] = positionDay([late], new Map());
    expect(block!.top + block!.height).toBeLessThanOrEqual(TOTAL_MINUTES / SLOT_MINUTES);
  });

  it('turns slots into rem at the edge, and nowhere else', () => {
    expect(slotsToRem(2)).toBe('3.5rem');
  });
});
