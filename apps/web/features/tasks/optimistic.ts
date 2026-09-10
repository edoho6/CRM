/**
 * The board's own view of a task, ahead of the server.
 *
 * Ticking a task used to wait: the whole board went grey until the server
 * had written the row and the page had re-read every task. Now the board
 * remembers what it has been told — this one is done, that one is back,
 * this one is gone — and draws the lists that way at once. The server's
 * lists arrive a moment later and, once they agree, the memory is dropped
 * (`reconcile`); if the write fails, the memory is dropped straight away and
 * the row goes back to where the server has it.
 *
 * Pure functions, so the rule is testable without a board.
 */
export type Override = 'done' | 'open' | 'removed';

export type Overrides = ReadonlyMap<string, Override>;

interface Identified {
  id: string;
}

/** The two lists as the board shows them: the server's, moved about by what it has been told. */
export function applyOverrides<T extends Identified>(
  open: readonly T[],
  done: readonly T[],
  overrides: Overrides,
): { open: T[]; done: T[] } {
  const stayOpen: T[] = [];
  const stayDone: T[] = [];
  const nowDone: T[] = [];
  const nowOpen: T[] = [];
  for (const task of open) {
    const override = overrides.get(task.id);
    if (override === 'removed') continue;
    if (override === 'done') nowDone.push(task);
    else stayOpen.push(task);
  }
  for (const task of done) {
    const override = overrides.get(task.id);
    if (override === 'removed') continue;
    if (override === 'open') nowOpen.push(task);
    else stayDone.push(task);
  }
  // A task just finished goes to the top of the done list, where the eye is;
  // one just reopened to the top of the open list, for the same reason.
  return { open: [...nowOpen, ...stayOpen], done: [...nowDone, ...stayDone] };
}

/** Drops every override the server's lists already reflect. */
export function reconcile<T extends Identified>(
  open: readonly T[],
  done: readonly T[],
  overrides: Overrides,
): Map<string, Override> {
  const openIds = new Set(open.map((task) => task.id));
  const doneIds = new Set(done.map((task) => task.id));
  const kept = new Map<string, Override>();
  for (const [id, override] of overrides) {
    const settled =
      override === 'done'
        ? doneIds.has(id) && !openIds.has(id)
        : override === 'open'
          ? openIds.has(id) && !doneIds.has(id)
          : !openIds.has(id) && !doneIds.has(id);
    if (!settled) kept.set(id, override);
  }
  return kept;
}

export function withOverride(overrides: Overrides, id: string, override: Override | null): Map<string, Override> {
  const next = new Map(overrides);
  if (override === null) next.delete(id);
  else next.set(id, override);
  return next;
}

export function withPending(pending: ReadonlySet<string>, id: string, isPending: boolean): Set<string> {
  const next = new Set(pending);
  if (isPending) next.add(id);
  else next.delete(id);
  return next;
}
