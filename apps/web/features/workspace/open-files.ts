/**
 * The files currently open in this browser tab.
 *
 * A practitioner mid-clinic has three patients in play: the one on the couch,
 * the one who just rang, and the one whose notes they are checking something
 * against. Navigating between them today means going back to the list and
 * finding the name again, each time.
 *
 * Stored in `sessionStorage` rather than `localStorage`, and this is the whole
 * of the privacy design: an open-files bar holds patient names, and a shared
 * clinic computer must not still be showing yesterday's list of who was seen.
 * Session storage dies with the browser tab; signing out clears it outright.
 *
 * Kept as a plain module so both the bar and the register-on-mount component can
 * use it, and so the storage rules are written once.
 */

export type OpenFileKind = 'patient' | 'encounter';

export interface OpenFile {
  kind: OpenFileKind;
  id: string;
  /** What to show on the tab. A name for a patient, a date for a treatment. */
  label: string;
  /** Locale-less path, as `@clinic/i18n/navigation` expects. */
  href: string;
}

const STORAGE_KEY = 'herbalist-open-files';

/**
 * How many stay open.
 *
 * Not a technical limit — a bar of thirty tabs is a bar nobody reads, and the
 * oldest is the one least likely to be wanted. Closing happens by the X; this
 * only stops the bar growing without bound when it never does.
 */
const MAX_OPEN = 8;

export const OPEN_FILES_EVENT = 'herbalist:open-files';

function isOpenFile(value: unknown): value is OpenFile {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    (entry.kind === 'patient' || entry.kind === 'encounter') &&
    typeof entry.id === 'string' &&
    typeof entry.label === 'string' &&
    typeof entry.href === 'string'
  );
}

export function readOpenFiles(): OpenFile[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // Anything unrecognised is dropped rather than trusted: this is parsed
    // straight out of storage, which a previous version of the app also wrote.
    return Array.isArray(parsed) ? parsed.filter(isOpenFile) : [];
  } catch {
    // Site data blocked, or storage holding something that is not JSON. An empty
    // bar is the whole of the failure.
    return [];
  }
}

function write(files: OpenFile[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  } catch {
    // As above. The tabs simply do not survive a reload.
  }
  // Storage fires no event in the tab that wrote it, so the bar is told directly.
  window.dispatchEvent(new CustomEvent(OPEN_FILES_EVENT));
}

/**
 * Records a file as open, or refreshes the label of one already open.
 *
 * Re-opening moves nothing. A bar whose tabs reorder as you visit them is a bar
 * you cannot build muscle memory for, and the order files were opened in is the
 * order they make sense in.
 */
export function openFile(file: OpenFile) {
  const current = readOpenFiles();
  const index = current.findIndex((entry) => entry.kind === file.kind && entry.id === file.id);

  if (index >= 0) {
    // A renamed patient should not keep the old name on the tab.
    if (current[index]!.label === file.label && current[index]!.href === file.href) return;
    const next = [...current];
    next[index] = file;
    write(next);
    return;
  }

  write([...current, file].slice(-MAX_OPEN));
}

export function closeFile(kind: OpenFileKind, id: string) {
  write(readOpenFiles().filter((entry) => !(entry.kind === kind && entry.id === id)));
}

export function closeAllFiles() {
  write([]);
}

/** Called on sign-out: the next person at this machine starts with nothing. */
export function clearOpenFiles() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear if nothing could be stored.
  }
}
