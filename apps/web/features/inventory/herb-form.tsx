'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import {
  HERB_CATEGORIES,
  HERB_UNITS,
  herbFormSchema,
  type HerbFormData,
  type HerbFormValues,
} from '@clinic/domain';
import { useRouter } from '@clinic/i18n/navigation';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Checkbox,
  Field,
  FieldGrid,
  Input,
  LtrInput,
  Section,
  Select,
  Spinner,
  Textarea,
} from '@clinic/ui';
import type { Herb } from '@clinic/db/types';
import { createHerb, updateHerb } from './actions';

export function HerbForm({ herb }: { herb?: Herb }) {
  const t = useTranslations('inventory.herbs');
  const tf = useTranslations('inventory.herbs.fields');
  const tCategory = useTranslations('inventory.category');
  const tUnit = useTranslations('inventory.unit');
  const tc = useTranslations('common');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<HerbFormValues, unknown, HerbFormData>({
    resolver: zodResolver(herbFormSchema),
    defaultValues: {
      pinyin_name: herb?.pinyin_name ?? '',
      chinese_name: herb?.chinese_name ?? '',
      english_name: herb?.english_name ?? '',
      hebrew_name: herb?.hebrew_name ?? '',
      category: herb?.category ?? 'granule',
      default_unit: herb?.default_unit ?? 'gram',
      properties: herb?.properties ?? '',
      functions: herb?.functions ?? '',
      cautions: herb?.cautions ?? '',
      reorder_threshold: herb?.reorder_threshold ?? '',
      reorder_quantity: herb?.reorder_quantity ?? '',
      is_active: herb?.is_active ?? true,
    },
  });

  function onSubmit(values: HerbFormData) {
    setError(null);
    startTransition(async () => {
      const result = herb ? await updateHerb(herb.id, values) : await createHerb(values);
      if (!result.ok) {
        setError(tc('errorGeneric'));
        return;
      }
      const id = herb ? herb.id : (result.data as { id: string }).id;
      router.push(`/inventory/herbs/${id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {errors.pinyin_name ? <Alert tone="danger">{t('nameRequired')}</Alert> : null}

      <Card>
        <CardBody className="space-y-5">
          <Section title={tc('name')}>
            <FieldGrid>
              {/* Pinyin and Chinese are Latin/CJK identifiers, so they stay LTR
                  even when the rest of the form reads right to left. */}
              <Field label={tf('pinyinName')} htmlFor="pinyin_name">
                <LtrInput id="pinyin_name" {...register('pinyin_name')} />
              </Field>
              <Field label={tf('chineseName')} htmlFor="chinese_name">
                <LtrInput id="chinese_name" {...register('chinese_name')} />
              </Field>
              <Field label={tf('englishName')} htmlFor="english_name">
                <LtrInput id="english_name" {...register('english_name')} />
              </Field>
              <Field label={tf('hebrewName')} htmlFor="hebrew_name">
                <Input id="hebrew_name" {...register('hebrew_name')} />
              </Field>
            </FieldGrid>
          </Section>

          <Section title={tc('actions')}>
            <FieldGrid>
              <Field label={tf('category')} htmlFor="category">
                <Select id="category" {...register('category')}>
                  {HERB_CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {tCategory(value)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={tf('defaultUnit')} htmlFor="default_unit">
                <Select id="default_unit" {...register('default_unit')}>
                  {HERB_UNITS.map((value) => (
                    <option key={value} value={value}>
                      {tUnit(value)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={tf('reorderThreshold')} htmlFor="reorder_threshold">
                <LtrInput
                  id="reorder_threshold"
                  type="number"
                  min={0}
                  step="0.01"
                  {...register('reorder_threshold')}
                />
              </Field>
              <Field label={tf('reorderQuantity')} htmlFor="reorder_quantity">
                <LtrInput
                  id="reorder_quantity"
                  type="number"
                  min={0}
                  step="0.01"
                  {...register('reorder_quantity')}
                />
              </Field>
            </FieldGrid>
          </Section>

          <Section title={tf('functions')}>
            <div className="space-y-4">
              <Field label={tf('properties')} htmlFor="properties">
                <Input id="properties" {...register('properties')} />
              </Field>
              <Field label={tf('functions')} htmlFor="functions">
                <Textarea id="functions" rows={2} {...register('functions')} />
              </Field>
              <Field label={tf('cautions')} htmlFor="cautions">
                <Textarea id="cautions" rows={2} {...register('cautions')} />
              </Field>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm text-ink-700">
              <Checkbox {...register('is_active')} />
              {tf('isActive')}
            </label>
          </Section>
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.back()} disabled={isPending}>
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
