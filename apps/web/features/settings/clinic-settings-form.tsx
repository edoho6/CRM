'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Boxes, Check } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Section,
  Spinner,
  useToast,
} from '@clinic/ui';
import { cn } from '@clinic/ui/cn';
import { useRouter } from '@clinic/i18n/navigation';
import { saveClinicSettings } from '@/features/inventory/actions';

/**
 * Clinic-wide settings.
 *
 * The stock switch is presented as two labelled choices rather than a bare
 * toggle, because "do you keep herbs on a shelf" changes what half the app
 * looks like and the consequence of each answer deserves to be written down
 * where the choice is made.
 */
export function ClinicSettingsForm({
  name: initialName,
  tracksInventory: initialTracks,
}: {
  name: string;
  tracksInventory: boolean;
}) {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [tracksInventory, setTracksInventory] = useState(initialTracks);
  const [isPending, startTransition] = useTransition();
  // Only the failure lives on the page. Success is news, and news is a toast.
  const [status, setStatus] = useState<'idle' | 'error'>('idle');

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus('idle');
    startTransition(async () => {
      const result = await saveClinicSettings({ name, tracks_inventory: tracksInventory });
      if (!result.ok) {
        setStatus('error');
        return;
      }
      toast({ tone: 'success', title: tc('saved') });
      router.refresh();
    });
  }

  const options = [
    { value: true, key: 'tracksOn' as const },
    { value: false, key: 'tracksOff' as const },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {status === 'error' ? <Alert tone="danger">{tc('errorGeneric')}</Alert> : null}

      {/* The same card as every other settings form: a titled header, the
          fields, and the save button last inside the card. */}
      <Card>
        <CardHeader>
          <CardTitle>{t('sections.clinic')}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-6">
          <Field label={t('fields.name')} htmlFor="clinic_name">
            <Input
              id="clinic_name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <Section title={t('sections.inventory')} description={t('inventoryIntro')}>
            <div className="grid gap-3 sm:grid-cols-2">
              {options.map((option) => {
                const selected = tracksInventory === option.value;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setTracksInventory(option.value)}
                    aria-pressed={selected}
                    className={cn(
                      'rounded-card border p-3 text-start transition-all hover:-translate-y-px hover:shadow-xs',
                      selected
                        ? 'border-jade-500 bg-jade-50 ring-2 ring-jade-500'
                        : 'border-ink-200 bg-white hover:border-ink-300',
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                      <Boxes
                        className={cn('h-4 w-4', selected ? 'text-jade-700' : 'text-ink-500')}
                      />
                      {t(`${option.key}.title`)}
                      {selected ? <Check className="ms-auto h-4 w-4 text-jade-700" /> : null}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-ink-600">
                      {t(`${option.key}.body`)}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-ink-500">{t('inventoryReversible')}</p>
          </Section>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner /> : null}
              {isPending ? tc('saving') : tc('save')}
            </Button>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
