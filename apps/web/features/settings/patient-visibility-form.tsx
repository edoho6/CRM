'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  SegmentedControl,
  useToast,
} from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import { savePatientVisibility } from './actions';

/**
 * How the clinic works: does a practitioner keep their own patients, or does
 * everyone see everyone (migration 78)?
 *
 * Both are real clinics. One practitioner per patient is the common case and
 * the default; a clinic where whoever is free takes the next person needs the
 * other, and without the choice they would be asked to work around the system.
 *
 * The setting is enforced in the database — the screen only chooses it — and
 * changing it takes effect on the next page, so the two options are described
 * in terms of what will happen rather than in terms of permissions.
 */
export function PatientVisibilityForm({ visibility }: { visibility: 'own' | 'clinic' }) {
  const t = useTranslations('settings.visibility');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState<'own' | 'clinic'>(visibility);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    setFailed(false);
    startTransition(async () => {
      const result = await savePatientVisibility({ patient_visibility: value });
      if (!result.ok) {
        setFailed(true);
        return;
      }
      toast({ tone: 'success', title: tc('saved') });
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <SegmentedControl<'own' | 'clinic'>
          label={t('title')}
          value={value}
          onChange={setValue}
          options={[
            { value: 'own', label: t('own') },
            { value: 'clinic', label: t('clinic') },
          ]}
        />
        <p className="text-sm text-ink-600">{value === 'own' ? t('ownHint') : t('clinicHint')}</p>
        <p className="text-xs text-ink-500">{t('ownerNote')}</p>
        {failed ? (
          <p role="alert" className="text-sm text-danger-700">
            {tc('errorGeneric')}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button type="button" onClick={save} disabled={isPending}>
            {tc('save')}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
