'use client';

import { useEffect } from 'react';
import { openFile, type OpenFileKind } from './open-files';

/**
 * Marks a file as open, from the page that shows it.
 *
 * Renders nothing. It exists because the tab bar lives in the shell, which knows
 * only the URL — it has no way to learn that `/patients/8f2c…` is Ronit Levi
 * without asking the server for a name it already has on screen.
 *
 * The effect is keyed on the values so a rename corrects the tab, and a
 * navigation to another patient does not leave the previous one's label behind.
 */
export function RegisterOpenFile({
  kind,
  id,
  label,
  href,
}: {
  kind: OpenFileKind;
  id: string;
  label: string;
  href: string;
}) {
  useEffect(() => {
    openFile({ kind, id, label, href });
  }, [kind, id, label, href]);

  return null;
}
