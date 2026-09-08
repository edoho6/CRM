/**
 * What is currently ticked for comparison, in the reference library.
 *
 * An external store rather than a React context, because the rows that tick and
 * the tray that counts are on opposite sides of a server-rendered table. A
 * provider would have to wrap the whole page, and every server component inside
 * it would keep being a server component with a client parent — which works, but
 * means the selection state has to be threaded through props that the table rows
 * do not otherwise need.
 *
 * Nothing here is patient data — a herb is a herb — so it lives in
 * `sessionStorage` purely so the selection survives paging through the
 * catalogue, and dies with the browser tab because a stale selection from
 * yesterday is only ever a surprise.
 */

export type CompareKind = 'herb' | 'formula' | 'point';

export interface CompareItem {
  kind: CompareKind;
  id: string;
  label: string;
}

/**
 * How many can be compared at once.
 *
 * Four columns is what fits side by side on a laptop without the table becoming
 * a horizontal scroll of its own, and comparing more than four things at once is
 * not a comparison, it is a list — which the catalogue already is.
 */
export const MAX_COMPARE = 4;

const STORAGE_KEY = 'herbalist-compare';

let items: CompareItem[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function isCompareItem(value: unknown): value is CompareItem {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    (entry.kind === 'herb' || entry.kind === 'formula' || entry.kind === 'point') &&
    typeof entry.id === 'string' &&
    typeof entry.label === 'string'
  );
}

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) items = parsed.filter(isCompareItem).slice(0, MAX_COMPARE);
  } catch {
    // Site data blocked, or storage holding something else. Start empty.
  }
}

function commit(next: CompareItem[]) {
  items = next;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // The selection simply does not survive a page load.
  }
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): CompareItem[] {
  load();
  return items;
}

/** The server has no selection, and rendering one would be a hydration mismatch. */
export function getServerSnapshot(): CompareItem[] {
  return EMPTY;
}

const EMPTY: CompareItem[] = [];

export function isSelected(kind: CompareKind, id: string): boolean {
  return getSnapshot().some((entry) => entry.kind === kind && entry.id === id);
}

/**
 * Ticks or unticks one item.
 *
 * Switching kind clears the rest: a herb and an acupuncture point have no
 * attributes in common, so a mixed selection has nothing to put in the table.
 * Silently dropping the others is better than refusing the tick — the person
 * has plainly moved on to comparing something else.
 */
export function toggle(item: CompareItem): void {
  const current = getSnapshot();

  if (current.some((entry) => entry.kind === item.kind && entry.id === item.id)) {
    commit(current.filter((entry) => !(entry.kind === item.kind && entry.id === item.id)));
    return;
  }

  const sameKind = current.filter((entry) => entry.kind === item.kind);
  // At the limit, the oldest tick makes way. Refusing the click would leave the
  // person hunting for which of four to untick first.
  const kept = sameKind.length >= MAX_COMPARE ? sameKind.slice(1) : sameKind;
  commit([...kept, item]);
}

export function clear(): void {
  commit([]);
}
