'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import type { z } from 'zod';
import { supplierFormSchema } from '@clinic/domain';
import { useRouter } from '@clinic/i18n/navigation';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTrigger,
  Field,
  FieldGrid,
  Input,
  LtrInput,
  Spinner,
} from '@clinic/ui';
import { Plus } from 'lucide-react';
import { createSupplier } from './actions';

type SupplierInput = z.input<typeof supplierFormSchema>;
type SupplierOutput = z.output<typeof supplierFormSchema>;

export function NewSupplierDialog() {
  const t = useTranslations('inventory.suppliers');
  const tc = useTranslations('common');
  const tPatients = useTranslations('patients.fields');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupplierInput, unknown, SupplierOutput>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      name: '',
      contact_name: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
      is_active: true,
    },
  });

  function onSubmit(values: SupplierOutput) {
    setError(false);
    startTransition(async () => {
      const result = await createSupplier(values);
      if (!result.ok) {
        setError(true);
        return;
      }
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          {t('new')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('new')} closeLabel={tc('close')}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error ? <Alert tone="danger">{tc('errorGeneric')}</Alert> : null}

          <Field
            label={tc('name')}
            htmlFor="supplier_name"
            required
            error={errors.name ? tc('requiredField') : null}
          >
            <Input id="supplier_name" {...register('name')} />
          </Field>

          <FieldGrid>
            <Field label={t('contactName')} htmlFor="contact_name">
              <Input id="contact_name" {...register('contact_name')} />
            </Field>
            <Field label={tPatients('phone')} htmlFor="supplier_phone">
              <LtrInput id="supplier_phone" type="tel" {...register('phone')} />
            </Field>
            <Field label={tPatients('email')} htmlFor="supplier_email">
              <LtrInput id="supplier_email" type="email" {...register('email')} />
            </Field>
            <Field label={tPatients('address')} htmlFor="supplier_address">
              <Input id="supplier_address" {...register('address')} />
            </Field>
          </FieldGrid>

          <Field label={tc('notes')} htmlFor="supplier_notes">
            <Input id="supplier_notes" {...register('notes')} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner /> : null}
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
