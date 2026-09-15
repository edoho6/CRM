'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ClipboardList, FlaskConical, MapPin, Sprout, Stethoscope, User, X } from 'lucide-react';
import { cn } from '@clinic/ui';
import { Link, usePathname, useRouter } from '@clinic/i18n/navigation';
import {
  closeAllFiles,
  closeFile,
  OPEN_FILES_EVENT,
  readOpenFiles,
  type OpenFile,
  type OpenFileKind,
} from './open-files';

/**
 * The face of each kind, and where closing the one you are looking at leaves
 * you: the list it came from.
 */
const KIND_META: Record<OpenFileKind, { Icon: typeof User; list: string }> = {
  patient: { Icon: User, list: '/patients' },
  encounter: { Icon: ClipboardList, list: '/encounters' },
  herb: { Icon: Sprout, list: '/reference/herbs' },
  formula: { Icon: FlaskConical, list: '/reference/formulas' },
  point: { Icon: MapPin, list: '/reference/points' },
  medicine: { Icon: Stethoscope, list: '/reference/medicine' },
};

/**
 * The bar of open files, under the top bar.
 *
 * Behaves like the tab strip of an editor, because that is the thing it is: a
 * row of what you have open, one click to each, an X on each to be done with it.
 *
 * Everything opened from a record page lands here, not only patients: a herb's
 * monograph, a formula, a point, a drug. Mid-clinic those are looked up the
 * same way and returned to the same way, and a strip that held half of them
 * answered "where was I" half the time.
 *
 * Renders nothing at all when nothing is open. A permanently empty strip above
 * every page is a row of pixels that costs something and says nothing.
 *
 * It reads from session storage after mount rather than during render: the
 * server has no session storage, and rendering tabs the first client pass then
 * removes is a hydration mismatch.
 */
export function OpenFilesBar() {
  const t = useTranslations('workspace');
  const pathname = usePathname();
  const router = useRouter();
  const [files, setFiles] = useState<OpenFile[]>([]);

  useEffect(() => {
    const sync = () => {
      const next = readOpenFiles();
      setFiles(next);
      // The stylesheet reserves this bar's height from the attribute before
      // React runs (the pre-paint script sets it from the same storage), so
      // the page does not drop by a row once the bar appears. Kept in step
      // here so closing the last file lets the page back up.
      if (next.length > 0) document.documentElement.dataset.openFiles = '1';
      else delete document.documentElement.dataset.openFiles;
    };
    sync();

    window.addEventListener(OPEN_FILES_EVENT, sync);
    // `storage` fires in the *other* tabs of the same browser. Session storage
    // is per-tab, so this only matters when a second window shares one — rare,
    // and cheap to keep in step.
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(OPEN_FILES_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (files.length === 0) return null;

  function handleClose(file: OpenFile, isActive: boolean) {
    closeFile(file.kind, file.id);
    const remaining = readOpenFiles();
    setFiles(remaining);
    if (remaining.length === 0) delete document.documentElement.dataset.openFiles;

    // Closing the file you are looking at has to take you somewhere. The next
    // open one, if there is one; otherwise the list this file came from —
    // staying on a page you have just closed is the one wrong answer.
    if (!isActive) return;
    const next = remaining[remaining.length - 1];
    router.push(next ? next.href : KIND_META[file.kind].list);
  }

  return (
    <div className="flex items-center gap-1 border-b border-ink-200 bg-ink-50 px-2 py-1">
      <nav aria-label={t('openFiles')} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {files.map((file) => {
          const isActive = pathname === file.href;
          const { Icon } = KIND_META[file.kind];
          return (
            <span
              key={`${file.kind}:${file.id}`}
              className={cn(
                'flex shrink-0 items-center rounded-t-md border border-b-0 text-sm transition-colors',
                isActive
                  ? 'border-ink-200 bg-white text-ink-900'
                  : 'border-transparent bg-transparent text-ink-700 hover:bg-ink-100',
              )}
            >
              <Link
                href={file.href}
                aria-current={isActive ? 'page' : undefined}
                className="flex max-w-[14rem] items-center gap-1.5 ps-2.5 pe-1 py-1.5"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-ink-500" aria-hidden />
                <span className="truncate" dir="auto">
                  {file.label}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => handleClose(file, isActive)}
                aria-label={t('closeFile', { name: file.label })}
                title={t('closeFile', { name: file.label })}
                className="me-1 rounded p-1 text-ink-500 transition-colors hover:bg-ink-200 hover:text-ink-900"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          );
        })}
      </nav>

      {files.length > 1 ? (
        <button
          type="button"
          onClick={() => {
            closeAllFiles();
            setFiles([]);
            delete document.documentElement.dataset.openFiles;
          }}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
        >
          {t('closeAll')}
        </button>
      ) : null}
    </div>
  );
}
