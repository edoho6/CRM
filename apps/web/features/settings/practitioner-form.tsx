'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Button, Field, FieldGrid, Input, LtrInput, Spinner, useToast } from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import type { Profile } from '@clinic/db/types';
import { savePractitionerProfile } from './actions';

/**
 * Who the practitioner is, on paper.
 *
 * Five fields, and they are exactly what the documents printed for a patient put
 * on the page — the treatment confirmation and the prescription label. The
 * professional title and certification number were here and are not any more:
 * they belong on a receipt, and a receipt is not what this system issues.
 *
 * The ID number is the practitioner's own. It is stored beside the clinical data
 * and carries the same protections, and it is entered here by the person it
 * belongs to and by nobody else. The address and email are theirs too, not the
 * clinic's — someone renting a room two days a week is not at the practice's
 * address.
 */
export function PractitionerForm({ profile }: { profile: Profile | null }) {
  const t = useTranslations('account.practitioner');
  const tc = useTranslations('common');
  const router = useRouter();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [nationalId, setNationalId] = useState(profile?.national_id ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');

  const [status, setStatus] = useState<'idle' | 'error'>('idle');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function save() {
    setStatus('idle');
    startTransition(async () => {
      const result = await savePractitionerProfile({
        full_name: fullName,
        national_id: nationalId,
        phone,
        email,
        address,
      });
      if (!result.ok) {
        setStatus('error');
        return;
      }
      toast({ tone: 'success', title: tc('saved') });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {status === 'error' ? <Alert tone="danger">{t('saveFailed')}</Alert> : null}

      <FieldGrid>
        <Field label={t('fullName')} htmlFor="practitioner_name" required>
          <Input
            id="practitioner_name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </Field>

        <Field label={t('nationalId')} htmlFor="practitioner_national_id">
          {/* Digits only, kept left-to-right: an ID number reads the same way
              in both languages and is unreadable if it does not. */}
          <LtrInput
            id="practitioner_national_id"
            inputMode="numeric"
            maxLength={9}
            value={nationalId}
            onChange={(event) => setNationalId(event.target.value.replace(/\D/g, ''))}
          />
        </Field>

        <Field label={t('phone')} htmlFor="practitioner_phone">
          <LtrInput
            id="practitioner_phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </Field>

        <Field label={t('email')} htmlFor="practitioner_email">
          <LtrInput
            id="practitioner_email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field label={t('address')} htmlFor="practitioner_address">
          <Input
            id="practitioner_address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
        </Field>
      </FieldGrid>

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={isPending || !fullName.trim()}>
          {isPending ? <Spinner /> : null}
          {tc('save')}
        </Button>
      </div>
    </div>
  );
}
