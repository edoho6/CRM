'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Receipt } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Combobox,
  Spinner,
  type ComboboxOption,
  type ComboboxValue,
} from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import { describeActionError } from '@/lib/action-error';
import { createBlankInvoice } from './actions';

/**
 * A new invoice, before it knows whose.
 *
 * Most invoices start from a treatment and never come here. This is for the
 * rest — a package sold on the phone, a product over the counter — where the
 * only thing known up front is the patient. Pick them, and the empty invoice
 * opens ready to be filled.
 */
export function NewInvoicePicker({
  patients,
}: {
  patients: { id: string; full_name: string; phone: string | null }[];
}) {
  const t = useTranslations('billing.newPicker');
  const tAll = useTranslations();
  const router = useRouter();
  const [choice, setChoice] = useState<ComboboxValue | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const options: ComboboxOption[] = useMemo(
    () =>
      patients.map((patient) => ({
        id: patient.id,
        label: patient.full_name,
        // Searchable by number, not shown: two people can share a name.
        keywords: patient.phone ?? undefined,
      })),
    [patients],
  );

  const patientId = choice?.id ?? null;

  function create() {
    if (!patientId) return;
    setErrorKey(null);
    startTransition(async () => {
      const result = await createBlankInvoice(patientId);
      if (!result.ok) {
        setErrorKey(result.error.key);
        return;
      }
      router.push(`/billing/${result.data.id}`);
    });
  }

  return (
    <Card>
      {/* A form, so Enter after choosing a patient opens the invoice. */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          create();
        }}
      >
        <CardBody className="space-y-4">
          <Combobox
            label={t('patient')}
            placeholder={t('searchPlaceholder')}
            options={options}
            value={choice}
            onChange={setChoice}
            autoFocus
          />
          {errorKey ? <Alert tone="danger">{describeActionError(tAll, errorKey)}</Alert> : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={!patientId || isPending}>
              {isPending ? <Spinner /> : <Receipt className="h-4 w-4" />}
              {t('create')}
            </Button>
          </div>
        </CardBody>
      </form>
    </Card>
  );
}
