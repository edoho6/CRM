'use client';

import { useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { MedicineMentions } from '@/features/medicine/medicine-mentions';
import {
  patientMedicalHistorySchema,
  type PatientMedicalHistoryData,
  type PatientMedicalHistoryValues,
} from '@clinic/domain';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Field,
  FieldGrid,
  Spinner,
  Textarea,
  useToast,
} from '@clinic/ui';
import type { PatientMedicalHistory } from '@clinic/db/types';
import { saveMedicalHistory } from './actions';

export function MedicalHistoryForm({
  patientId,
  history,
}: {
  patientId: string;
  history: PatientMedicalHistory | null;
}) {
  const t = useTranslations('patients.fields');
  const tc = useTranslations('common');
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'error'>('idle');
  const { toast } = useToast();

  const { register, handleSubmit, control } = useForm<
    PatientMedicalHistoryValues,
    unknown,
    PatientMedicalHistoryData
  >({
    resolver: zodResolver(patientMedicalHistorySchema),
    defaultValues: {
      allergies: history?.allergies ?? '',
      medications: history?.medications ?? '',
      chronic_conditions: history?.chronic_conditions ?? '',
      surgeries: history?.surgeries ?? '',
      family_history: history?.family_history ?? '',
      lifestyle_notes: history?.lifestyle_notes ?? '',
      pregnancy_status: history?.pregnancy_status ?? '',
    },
  });
  // The fields the form draws from, read through useWatch: the library's `watch`
  // is a function the compiler cannot see into, and every component calling it
  // lost its memoisation (react-hooks/incompatible-library).
  const watched = useWatch({ control });

  function onSubmit(values: PatientMedicalHistoryData) {
    setStatus('idle');
    startTransition(async () => {
      const result = await saveMedicalHistory(patientId, values);
      if (result.ok) toast({ tone: 'success', title: tc('saved') });
      else setStatus('error');
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {status === 'error' ? <Alert tone="danger">{tc('errorGeneric')}</Alert> : null}

      <Card>
        <CardBody>
          <FieldGrid>
            <Field label={t('allergies')} htmlFor="allergies">
              <Textarea id="allergies" rows={2} {...register('allergies')} />
            </Field>
            {/* The names the reference knows, as chips under the text: the
                practitioner writes freely and the entry is one click away. */}
            <div className="space-y-1.5">
              <Field label={t('medications')} htmlFor="medications">
                <Textarea id="medications" rows={2} {...register('medications')} />
              </Field>
              <MedicineMentions text={watched.medications ?? ''} />
            </div>
            <div className="space-y-1.5">
              <Field label={t('chronicConditions')} htmlFor="chronic_conditions">
                <Textarea id="chronic_conditions" rows={2} {...register('chronic_conditions')} />
              </Field>
              <MedicineMentions text={watched.chronic_conditions ?? ''} />
            </div>
            <Field label={t('surgeries')} htmlFor="surgeries">
              <Textarea id="surgeries" rows={2} {...register('surgeries')} />
            </Field>
            <Field label={t('familyHistory')} htmlFor="family_history">
              <Textarea id="family_history" rows={2} {...register('family_history')} />
            </Field>
            <Field label={t('lifestyleNotes')} htmlFor="lifestyle_notes">
              <Textarea id="lifestyle_notes" rows={2} {...register('lifestyle_notes')} />
            </Field>
            <Field label={t('pregnancyStatus')} htmlFor="pregnancy_status">
              <Textarea id="pregnancy_status" rows={2} {...register('pregnancy_status')} />
            </Field>
          </FieldGrid>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Spinner /> : null}
          {isPending ? tc('saving') : tc('save')}
        </Button>
      </div>
    </form>
  );
}
