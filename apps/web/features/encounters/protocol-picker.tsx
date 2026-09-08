'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ClipboardList } from 'lucide-react';
import { Button, Combobox, type ComboboxOption, type ComboboxValue } from '@clinic/ui';
import type { TreatmentProtocol } from '@clinic/db/types';

/**
 * Choose a saved protocol and fill the form from it.
 *
 * Deliberately two steps rather than one. Picking from a list and having the
 * form change underneath is how you overwrite twenty minutes of typing by
 * mistake; choosing, then pressing apply, is a decision made twice.
 *
 * The host decides what to take. The points editor takes the points, the
 * dispensing panel takes the prescription — the same protocol serves both, and
 * neither is forced to accept the other's half.
 */
export function ProtocolPicker({
  protocols,
  disabled,
  onApply,
  label,
}: {
  protocols: TreatmentProtocol[];
  disabled?: boolean;
  onApply: (protocol: TreatmentProtocol) => void;
  /** What applying does here, since it differs between the two hosts. */
  label?: string;
}) {
  const t = useTranslations('protocols');
  const [choice, setChoice] = useState<ComboboxValue | null>(null);

  const options: ComboboxOption[] = useMemo(
    () =>
      protocols.map((protocol) => ({
        id: protocol.id,
        label: protocol.name,
        secondary: protocol.indications ?? undefined,
        // Findable by what it treats, not only by what it was named.
        keywords: [protocol.indications, protocol.treatment_principle, protocol.description]
          .filter(Boolean)
          .join(' '),
      })),
    [protocols],
  );

  const selected = protocols.find((protocol) => protocol.id === choice?.id) ?? null;

  // Nothing to offer and nothing to explain: an empty picker on every treatment
  // page is furniture. The management screen is where protocols are created.
  if (protocols.length === 0) return null;

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-ink-200 bg-ink-50 p-2.5">
      <div className="min-w-0 flex-1">
        <label
          htmlFor="protocol_picker"
          className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-700"
        >
          <ClipboardList className="h-3.5 w-3.5 text-ink-600" aria-hidden />
          {label ?? t('apply')}
        </label>
        <Combobox
          id="protocol_picker"
          label={label ?? t('apply')}
          placeholder={t('search')}
          options={options}
          value={choice}
          onChange={setChoice}
          disabled={disabled}
        />
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled || !selected}
        onClick={() => {
          if (!selected) return;
          onApply(selected);
          setChoice(null);
        }}
      >
        {t('applyAction')}
      </Button>
    </div>
  );
}
