'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Input, SegmentedControl } from '@clinic/ui';
import type { Vec3 } from './frame';
import type { BodySide } from './points';
import type { PickEvent } from './body-model';

/**
 * Development-only point editor.
 *
 * Reached with `?pointEditor=1` on a treatment page while running locally;
 * the panel never mounts it in production. Click the body and the clicked
 * spot, in the stored frame, is shown and drawn; "copy" puts a ready-made
 * `BodyPointPosition` entry on the clipboard to paste into `points.ts`.
 *
 * A left-side click is stored mirrored, because bilateral points are kept
 * on the right. Nothing is written anywhere by this tool — a coordinate
 * enters the data layer only through a reviewed change to that file.
 */
export default function PointEditor({
  picked,
  onClear,
}: {
  picked: PickEvent | null;
  onClear: () => void;
}) {
  const t = useTranslations('encounters.body3d.editor');
  const [code, setCode] = useState('');
  const [side, setSide] = useState<BodySide>('right');
  const [copied, setCopied] = useState(false);

  const stored = picked ? toStored(picked, side) : null;
  const literal = stored ? toLiteral(code.trim().toUpperCase() || 'CODE', side, stored) : '';

  const copy = async () => {
    if (!literal) return;
    try {
      await navigator.clipboard.writeText(literal);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be refused; the literal is on screen to copy by hand.
    }
  };

  return (
    <div className="mt-2 space-y-2 rounded-md border border-dashed border-amber-700 bg-amber-50 p-2 text-xs text-ink-800">
      <p className="font-semibold">{t('title')}</p>
      <p className="text-ink-600">{t('hint')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label={t('code')}
          placeholder="ST36"
          dir="ltr"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="h-8 w-24 text-xs"
        />
        <SegmentedControl
          label={t('side')}
          value={side}
          onChange={setSide}
          options={[
            { value: 'right', label: t('sideRight') },
            { value: 'left', label: t('sideLeft') },
            { value: 'midline', label: t('sideMidline') },
          ]}
        />
      </div>
      {stored ? (
        <>
          <pre dir="ltr" className="overflow-x-auto rounded bg-white p-2 text-xs leading-snug">
            {literal}
          </pre>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={copy}>
              {copied ? t('copied') : t('copy')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onClear}>
              {t('clear')}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-ink-600">{t('pick')}</p>
      )}
    </div>
  );
}

function toStored(picked: PickEvent, side: BodySide): { position: Vec3; approach: Vec3 } {
  if (side === 'midline') {
    return {
      position: { x: 0, y: picked.position.y, z: picked.position.z },
      approach: { x: 0, y: picked.normal.y, z: picked.normal.z },
    };
  }
  const mirror = side === 'left' ? -1 : 1;
  return {
    position: { x: picked.position.x * mirror, y: picked.position.y, z: picked.position.z },
    approach: { x: picked.normal.x * mirror, y: picked.normal.y, z: picked.normal.z },
  };
}

function fixed(value: number): string {
  return (Math.round(value * 1000) / 1000).toFixed(3);
}

function toLiteral(code: string, side: BodySide, stored: { position: Vec3; approach: Vec3 }): string {
  const vec = (v: Vec3) => `{ x: ${fixed(v.x)}, y: ${fixed(v.y)}, z: ${fixed(v.z)} }`;
  return [
    '{',
    `  code: '${code}',`,
    `  sideType: '${side === 'midline' ? 'midline' : 'bilateral'}',`,
    `  position: ${vec(stored.position)},`,
    `  approach: ${vec(stored.approach)},`,
    '  validated: false,',
    "  note: 'Placed with the point editor; not checked against an anatomical reference.',",
    '},',
  ].join('\n');
}
