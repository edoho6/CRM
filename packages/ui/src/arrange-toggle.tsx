'use client';

import * as React from 'react';
import { Check, GripVertical } from 'lucide-react';
import { Button } from './button';
import { cn } from './cn';

/**
 * The switch that lets a list be rearranged by dragging.
 *
 * The sidebar, the dashboard and the treatment page's side column all had
 * their own version — two different icons, three sizes, and a bare icon on
 * the treatment page that read as a sort control. One switch, one icon, and a
 * visible word whenever there is room for it: "arrange" is not something an
 * icon alone says.
 */
export function ArrangeToggle({
  editing,
  onToggle,
  arrangeLabel,
  doneLabel,
  iconOnly = false,
  className,
}: {
  editing: boolean;
  onToggle: () => void;
  arrangeLabel: string;
  doneLabel: string;
  /** For a rail or a narrow column; the label stays for the screen reader. */
  iconOnly?: boolean;
  className?: string;
}) {
  const label = editing ? doneLabel : arrangeLabel;
  const Icon = editing ? Check : GripVertical;
  return (
    <Button
      type="button"
      variant={editing ? 'primary' : 'secondary'}
      size={iconOnly ? 'icon-sm' : 'sm'}
      aria-pressed={editing}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      onClick={onToggle}
      className={className}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {iconOnly ? null : label}
    </Button>
  );
}
