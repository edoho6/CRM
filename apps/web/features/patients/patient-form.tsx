'use client';

import { useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
import { usePathname, useRouter } from '@clinic/i18n/navigation';
import { describeActionError } from '@/lib/action-error';
import { parentPath } from '@/lib/parent-path';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Field,
  FieldGrid,
  FormActionBar,
  Input,
  LtrInput,
  Section,
  Select,
  Spinner,
  Textarea,
  useToast,
} from '@clinic/ui';
import type { Patient } from '@clinic/db/types';
import { createPatient, findDuplicatePatient, updatePatient } from './actions';
import type { DuplicateMatch } from './duplicate';
import { DateInput } from '@/components/date-input';

/**
 * Create/edit form for a patient.
 *
 * Validation runs against the same schema the Server Action uses, so what the form
 * accepts and what the database accepts cannot drift apart.
 */
export function PatientForm({
  patient,
  today,
}: {
  patient?: Patient;
  /**
   * The clinic's date, worked out on the server — the latest a date of birth
   * may be.
   *
   * Not `new Date()` here: this renders on the server and again in the browser,
   * and the two must agree or React discards the markup. It was also
   * `toISOString().slice(0, 10)`, which is the UTC day — so until three in the
   * morning Israel time a baby born today could not be entered.
   */
  today: string;
}) {
  const t = useTranslations('patients');
  const tc = useTranslations('common');
  const tAll = useTranslations();
  const tSex = useTranslations('patients.sex');
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  /*
   * A file that already exists for the same person.
   *
   * Held in state rather than refused outright: two people do share a phone —
   * a mother and a child, a couple — and only the person at the desk knows
   * which this is. The first save reports it and stops; a second press goes
   * ahead. Cleared whenever the identifiers change, so correcting the number
   * does not leave a warning about a patient who is no longer implicated.
   */
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);
  /**
   * The identifiers the warning was raised against.
   *
   * What makes the second press mean "yes, I know" without it meaning "save
   * whatever is in the form now": change the phone after the warning and it is
   * a different question, so it is asked again.
   */
  const [acknowledged, setAcknowledged] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
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
  // The fields the form draws from, read through useWatch: the library's `watch`
  // is a function the compiler cannot see into, and every component calling it
  // lost its memoisation (react-hooks/incompatible-library).
  const watched = useWatch({ control });

  function onSubmit(values: PatientFormData) {
    setServerError(null);
    startTransition(async () => {
      const identifiers = `${values.phone ?? ''}|${values.national_id ?? ''}`;
      if (acknowledged !== identifiers) {
        const found = await findDuplicatePatient({
          phone: values.phone,
          national_id: values.national_id,
          excludeId: patient?.id ?? null,
        });
        if (found.ok && found.data) {
          setDuplicate(found.data);
          setAcknowledged(identifiers);
          return;
        }
        setDuplicate(null);
      }

      const result = patient
        ? await updatePatient(patient.id, values)
        : await createPatient(values);

      if (!result.ok) {
        setServerError(describeActionError(tAll, result.error?.key));
        return;
      }

      // A new file opens itself; an edited one stays put. Being thrown out to
      // the read view after correcting one phone number meant Edit, fix, Save,
      // notice the typo, Edit again.
      if (patient) {
        toast({ tone: 'success', title: tc('saved') });
        router.refresh();
        return;
      }
      router.push(`/patients/${(result.data as { id: string }).id}`);
      router.refresh();
    });
  }

  /*
   * The message says what is actually wrong. Every failure used to read
   * "please fill this field", against a field that visibly had text in it:
   * a name over the length limit, a malformed date, a bad email address. The
   * validator's own message is English; its `type` is the reason, and that
   * maps to a sentence in the reader's language.
   */
  const fieldError = (name: keyof PatientFormValues) => {
    const failure = errors[name];
    if (!failure) return null;
    // The schema's own refinements name their reason in the message.
    if (failure.message === 'invalid_email') return tc('validation.invalidEmail');
    if (failure.message === 'invalid_date') return tc('validation.invalidDate');
    switch (failure.type) {
      case 'too_big':
        return tc('validation.tooLong');
      case 'invalid_format':
        return tc('validation.invalidFormat');
      default:
        return tc('validation.required');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {serverError ? <Alert tone="danger">{serverError}</Alert> : null}

      {/* Not an error: it is a question, and the button underneath is the
          answer. The existing file opens in a new tab so the half-typed form
          is still here when the practitioner has looked. */}
      {duplicate ? (
        <Alert tone="warning">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              {t(duplicate.on === 'national_id' ? 'duplicate.byId' : 'duplicate.byPhone', {
                name: duplicate.name ?? '—',
              })}
            </span>
            <a
              href={`/patients/${duplicate.id}`}
              target="_blank"
              rel="noopener"
              className="font-medium text-jade-800 underline underline-offset-2"
            >
              {t('duplicate.open')}
            </a>
          </span>
        </Alert>
      ) : null}

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
                <Input
                  id="first_name"
                  autoComplete="given-name"
                  autoFocus
                  {...register('first_name')}
                />
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
                <DateInput
                  id="date_of_birth"
                  value={watched.date_of_birth ?? ''}
                  max={today}
                  onChange={(event) =>
                    setValue('date_of_birth', event.target.value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
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

      <FormActionBar>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push(parentPath(pathname) ?? '/')}
          disabled={isPending}
        >
          {tc('cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Spinner /> : null}
          {isPending ? tc('saving') : duplicate ? t('duplicate.saveAnyway') : tc('save')}
        </Button>
      </FormActionBar>
    </form>
  );
}
