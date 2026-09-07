'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import {
  patientFormSchema,
  LOCALES,
  SEXES,
  TREATMENT_STATUSES,
  type PatientFormData,
  type PatientFormValues,
} from '@clinic/domain';
import { LOCALE_LABELS } from '@clinic/i18n';
import { useRouter } from '@clinic/i18n/navigation';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Field,
  FieldGrid,
  Input,
  LtrInput,
  Section,
  Select,
  Spinner,
  Textarea,
} from '@clinic/ui';
import type { Patient } from '@clinic/db/types';
import { createPatient, updatePatient } from './actions';

/**
 * Create/edit form for a patient.
 *
 * Validation runs against the same schema the Server Action uses, so what the form
 * accepts and what the database accepts cannot drift apart.
 */
export function PatientForm({ patient }: { patient?: Patient }) {
  const t = useTranslations('patients');
  const tc = useTranslations('common');
  const tSex = useTranslations('patients.sex');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PatientFormValues, unknown, PatientFormData>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      first_name: patient?.first_name ?? '',
      last_name: patient?.last_name ?? '',
      date_of_birth: patient?.date_of_birth ?? '',
      sex: patient?.sex ?? 'unspecified',
      national_id: patient?.national_id ?? '',
      phone: patient?.phone ?? '',
      email: patient?.email ?? '',
      address: patient?.address ?? '',
      city: patient?.city ?? '',
      emergency_contact_name: patient?.emergency_contact_name ?? '',
      emergency_contact_phone: patient?.emergency_contact_phone ?? '',
      occupation: patient?.occupation ?? '',
      referral_source: patient?.referral_source ?? '',
      preferred_locale: patient?.preferred_locale ?? 'he',
      notes: patient?.notes ?? '',
      treatment_status: patient?.treatment_status ?? 'active',
    },
  });

  function onSubmit(values: PatientFormData) {
    setServerError(null);
    startTransition(async () => {
      const result = patient
        ? await updatePatient(patient.id, values)
        : await createPatient(values);

      if (!result.ok) {
        setServerError(tc('errorGeneric'));
        return;
      }

      const id = patient ? patient.id : (result.data as { id: string }).id;
      router.push(`/patients/${id}`);
      router.refresh();
    });
  }

  const fieldError = (name: keyof PatientFormValues) => (errors[name] ? tc('requiredField') : null);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {serverError ? <Alert tone="danger">{serverError}</Alert> : null}

      <Card>
        <CardBody className="space-y-5">
          <Section title={t('sections.personal')}>
            <FieldGrid>
              <Field
                label={t('fields.firstName')}
                htmlFor="first_name"
                required
                error={fieldError('first_name')}
              >
                <Input id="first_name" autoComplete="given-name" {...register('first_name')} />
              </Field>
              <Field
                label={t('fields.lastName')}
                htmlFor="last_name"
                required
                error={fieldError('last_name')}
              >
                <Input id="last_name" autoComplete="family-name" {...register('last_name')} />
              </Field>
              <Field
                label={t('fields.dateOfBirth')}
                htmlFor="date_of_birth"
                error={fieldError('date_of_birth')}
              >
                {/* Dates and IDs stay LTR so the digits don't visually reverse in Hebrew. */}
                <LtrInput id="date_of_birth" type="date" {...register('date_of_birth')} />
              </Field>
              <Field label={t('fields.sex')} htmlFor="sex">
                <Select id="sex" {...register('sex')}>
                  {SEXES.map((value) => (
                    <option key={value} value={value}>
                      {tSex(value)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('fields.nationalId')} htmlFor="national_id">
                <LtrInput id="national_id" inputMode="numeric" {...register('national_id')} />
              </Field>
              <Field label={t('fields.occupation')} htmlFor="occupation">
                <Input id="occupation" {...register('occupation')} />
              </Field>
            </FieldGrid>
          </Section>

          <Section title={t('sections.contact')}>
            <FieldGrid>
              <Field label={t('fields.phone')} htmlFor="phone">
                <LtrInput id="phone" type="tel" autoComplete="tel" {...register('phone')} />
              </Field>
              <Field
                label={t('fields.email')}
                htmlFor="email"
                error={errors.email ? tc('invalidEmail') : null}
              >
                <LtrInput id="email" type="email" autoComplete="email" {...register('email')} />
              </Field>
              <Field label={t('fields.address')} htmlFor="address">
                <Input id="address" {...register('address')} />
              </Field>
              <Field label={t('fields.city')} htmlFor="city">
                <Input id="city" {...register('city')} />
              </Field>
            </FieldGrid>
          </Section>

          <Section title={t('sections.emergency')}>
            <FieldGrid>
              <Field label={t('fields.emergencyContactName')} htmlFor="emergency_contact_name">
                <Input id="emergency_contact_name" {...register('emergency_contact_name')} />
              </Field>
              <Field label={t('fields.emergencyContactPhone')} htmlFor="emergency_contact_phone">
                <LtrInput
                  id="emergency_contact_phone"
                  type="tel"
                  {...register('emergency_contact_phone')}
                />
              </Field>
            </FieldGrid>
          </Section>

          <Section title={t('sections.admin')}>
            <FieldGrid>
              <Field label={t('fields.referralSource')} htmlFor="referral_source">
                <Input id="referral_source" {...register('referral_source')} />
              </Field>
              <Field label={t('fields.preferredLocale')} htmlFor="preferred_locale">
                <Select id="preferred_locale" {...register('preferred_locale')}>
                  {LOCALES.map((value) => (
                    <option key={value} value={value}>
                      {LOCALE_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </Field>
            </FieldGrid>
            <Field label={t('fields.notes')} htmlFor="notes" className="mt-4">
              <Textarea id="notes" rows={3} {...register('notes')} />
            </Field>
            {/* One status, not a status plus a checkbox. The two used to be
                separate fields asking the same question, which meant a file
                could be marked active and "stopped partway" at once. The
                database derives `is_active` from this now, so the working list
                still filters on a boolean without anyone maintaining it. */}
            <Field
              label={t('treatmentStatus')}
              htmlFor="treatment_status"
              hint={t('treatmentStatusHint')}
              className="mt-4 max-w-xs"
            >
              <Select id="treatment_status" {...register('treatment_status')}>
                {TREATMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`status.${status}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </Section>
        </CardBody>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
          disabled={isPending}
        >
          {tc('cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Spinner /> : null}
          {isPending ? tc('saving') : tc('save')}
        </Button>
      </div>
    </form>
  );
}
