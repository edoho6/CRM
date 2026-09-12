'use client';

import * as React from 'react';
import { Check, GripVertical } from 'lucide-react';
import { Button } from './button';
import { cn } from './cn';

/**
 * The switch that lets a list be rearranged by dragging.
 *
 * The sidebar, the dashboard, the patient tiles and the treatment page's
 * side column all had their own version — three icons, three sizes, and a
 * labelled button on the dashboard beside bare icons everywhere else. One
 * switch, the same everywhere: the grip the draggable rows themselves carry,
 * a tick while arranging, no visible word — the name is on hover and for the
 * screen reader — and always the last control in the far corner of the area
 * it arranges. Learning it once on any screen is learning it on all of them.
 */
export function ArrangeToggle({
  editing,
  onToggle,
  arrangeLabel,
  doneLabel,
  className,
}: {
  editing: boolean;
  onToggle: () => void;
  arrangeLabel: string;
  doneLabel: string;
  className?: string;
}) {
  const label = editing ? doneLabel : arrangeLabel;
  const Icon = editing ? Check : GripVertical;
  return (
    <Button
      type="button"
      variant={editing ? 'primary' : 'secondary'}
      size="icon-sm"
      aria-pressed={editing}
      aria-label={label}
      title={label}
      onClick={onToggle}
      className={className}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </Button>
  );
}
