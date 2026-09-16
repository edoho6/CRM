'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import {
  BODY_VIEWS,
  POINT_BODY_AREAS,
  POINT_CATEGORIES,
  POINT_CHANNELS,
  POINT_REGIONS,
  acupuncturePointFormSchema,
  type AcupuncturePointFormData,
  type AcupuncturePointFormValues,
} from '@clinic/domain';
import { usePathname, useRouter } from '@clinic/i18n/navigation';
import { parentPath } from '@/lib/parent-path';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Checkbox,
  Field,
  FieldGrid,
  FormActionBar,
  Input,
  LtrInput,
  Section,
  Select,
  Spinner,
  Textarea,
} from '@clinic/ui';
import type { AcupuncturePoint } from '@clinic/db/types';
import { updateAcupuncturePoint } from './point-actions';

/**
 * The point editor, in the order a point is looked up: who it is, where it
 * sits, what it does, and how it is needled. The chart coordinates are the
 * schematic drawing's, in its own units — they show where on the flat body a
 * dot is drawn, not an anatomical position — and are tucked at the end.
 */
export function PointForm({ point }: { point: AcupuncturePoint }) {
  const t = useTranslations('reference.points');
  const tf = useTranslations('reference.points.fields');
  const ts = useTranslations('reference.points.editSections');
  const tChannel = useTranslations('reference.pointChannel');
  const tArea = useTranslations('reference.bodyArea');
  const tCategory = useTranslations('reference.pointCategory');
  const tRegion = useTranslations('encounters.region');
  const tc = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcupuncturePointFormValues, unknown, AcupuncturePointFormData>({
    resolver: zodResolver(acupuncturePointFormSchema),
    defaultValues: {
      code: point.code,
      channel: point.channel,
      point_number: point.point_number ?? '',
      pinyin_name: point.pinyin_name ?? '',
      chinese_name: point.chinese_name ?? '',
      english_name: point.english_name ?? '',
      body_view: point.body_view,
      x: point.x ?? '',
      y: point.y ?? '',
      bilateral: point.bilateral,
      default_region: point.default_region,
      body_area: point.body_area ?? '',
      point_categories: point.point_categories ?? [],
      location: point.location ?? '',
      actions: point.actions ?? '',
      indications: point.indications ?? '',
      needling: point.needling ?? '',
      cautions: point.cautions ?? '',
      is_active: point.is_active,
    },
  });

  const onSubmit = (values: AcupuncturePointFormData) => {
    setError(null);
    startTransition(async () => {
      const result = await updateAcupuncturePoint(point.id, values);
      if (!result.ok) {
        setError(tc('errorGeneric'));
        return;
      }
      router.push(`/reference/points/${point.id}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      {error ? (
        <Alert tone="danger">
          {error}
        </Alert>
      ) : null}

      <Section title={ts('identity')}>
        <Card>
          <CardBody>
            <FieldGrid>
              <Field label={tf('code')} htmlFor="point_code" error={errors.code?.message ? tc('required') : undefined} required>
                <LtrInput id="point_code" {...register('code')} />
              </Field>
              <Field label={tf('channel')} htmlFor="point_channel">
                <Select id="point_channel" {...register('channel')}>
                  {POINT_CHANNELS.map((entry) => (
                    <option key={entry} value={entry}>
                      {tChannel(entry)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={tf('number')} htmlFor="point_number">
                <LtrInput id="point_number" type="number" inputMode="numeric" {...register('point_number')} />
              </Field>
              <Field label={tf('pinyin')} htmlFor="point_pinyin">
                <LtrInput id="point_pinyin" {...register('pinyin_name')} />
              </Field>
              <Field label={tf('chinese')} htmlFor="point_chinese">
                <Input id="point_chinese" {...register('chinese_name')} />
              </Field>
              <Field label={tf('english')} htmlFor="point_english">
                <LtrInput id="point_english" {...register('english_name')} />
              </Field>
            </FieldGrid>
          </CardBody>
        </Card>
      </Section>

      <Section title={ts('anatomy')}>
        <Card>
          <CardBody className="space-y-4">
            <FieldGrid>
              <Field label={tf('bodyArea')} htmlFor="point_area">
                <Select id="point_area" {...register('body_area')}>
                  <option value="">{tc('none')}</option>
                  {POINT_BODY_AREAS.map((entry) => (
                    <option key={entry} value={entry}>
                      {tArea(entry)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={tf('region')} htmlFor="point_region" hint={t('regionHint')}>
                <Select id="point_region" {...register('default_region')}>
                  {POINT_REGIONS.map((entry) => (
                    <option key={entry} value={entry}>
                      {tRegion(entry)}
                    </option>
                  ))}
                </Select>
              </Field>
            </FieldGrid>
            <label className="inline-flex items-center gap-2 text-sm text-ink-800">
              <Checkbox {...register('bilateral')} />
              {tf('bilateral')}
            </label>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-ink-800">{tf('categories')}</legend>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {POINT_CATEGORIES.map((entry) => (
                  <label key={entry} className="inline-flex items-center gap-2 text-sm text-ink-800">
                    <Checkbox value={entry} {...register('point_categories')} />
                    {tCategory(entry)}
                  </label>
                ))}
              </div>
            </fieldset>
          </CardBody>
        </Card>
      </Section>

      <Section title={ts('clinical')}>
        <Card>
          <CardBody>
            <FieldGrid columns={1}>
              <Field label={tf('location')} htmlFor="point_location">
                <Textarea id="point_location" rows={3} {...register('location')} />
              </Field>
              <Field label={tf('actions')} htmlFor="point_actions">
                <Textarea id="point_actions" rows={3} {...register('actions')} />
              </Field>
              <Field label={tf('indications')} htmlFor="point_indications">
                <Textarea id="point_indications" rows={3} {...register('indications')} />
              </Field>
              <Field label={tf('needling')} htmlFor="point_needling">
                <Textarea id="point_needling" rows={2} {...register('needling')} />
              </Field>
              <Field label={tf('cautions')} htmlFor="point_cautions">
                <Textarea id="point_cautions" rows={2} {...register('cautions')} />
              </Field>
            </FieldGrid>
            <p className="mt-3 text-xs leading-relaxed text-ink-600">{t('editReviewHint')}</p>
          </CardBody>
        </Card>
      </Section>

      <Section title={ts('chart')}>
        <Card>
          <CardBody className="space-y-4">
            <p className="text-xs leading-relaxed text-ink-600">{t('chartHint')}</p>
            <FieldGrid>
              <Field label={tf('bodyView')} htmlFor="point_view">
                <Select id="point_view" {...register('body_view')}>
                  {BODY_VIEWS.map((entry) => (
                    <option key={entry} value={entry}>
                      {t(`view.${entry}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={tf('x')} htmlFor="point_x">
                <LtrInput id="point_x" type="number" step="0.1" inputMode="decimal" {...register('x')} />
              </Field>
              <Field label={tf('y')} htmlFor="point_y">
                <LtrInput id="point_y" type="number" step="0.1" inputMode="decimal" {...register('y')} />
              </Field>
            </FieldGrid>
            <label className="inline-flex items-center gap-2 text-sm text-ink-800">
              <Checkbox {...register('is_active')} />
              {tf('active')}
            </label>
          </CardBody>
        </Card>
      </Section>

      <FormActionBar>
        <Button type="button" variant="secondary" onClick={() => router.push(parentPath(pathname) ?? '/')} disabled={isPending}>
          {tc('cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Spinner className="h-4 w-4" /> : null}
          {tc('save')}
        </Button>
      </FormActionBar>
    </form>
  );
}
