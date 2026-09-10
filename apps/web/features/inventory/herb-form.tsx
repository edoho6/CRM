'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import {
  CHANNELS,
  HERB_CATEGORIES,
  HERB_UNITS,
  TASTES,
  TCM_CATEGORIES,
  TEMPERATURES,
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

/**
 * Herb editor, laid out the way a materia medica entry reads: who it is, what
 * it is like, what it does, how much to give, and finally how it is stocked.
 */
export function HerbForm({ herb }: { herb?: Herb }) {
  const t = useTranslations('inventory.herbs');
  const tf = useTranslations('inventory.herbs.fields');
  const ts = useTranslations('inventory.herbs.sections');
  const tCategory = useTranslations('inventory.category');
  const tUnit = useTranslations('inventory.unit');
  const tTcm = useTranslations('inventory.tcmCategory');
  const tTemp = useTranslations('inventory.temperature');
  const tTaste = useTranslations('inventory.taste');
  const tChannel = useTranslations('inventory.channel');
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
      botanical_name: herb?.botanical_name ?? '',
      pharmaceutical_name: herb?.pharmaceutical_name ?? '',
      category: herb?.category ?? 'granule',
      default_unit: herb?.default_unit ?? 'gram',
      tcm_category: herb?.tcm_category ?? '',
      temperature: herb?.temperature ?? '',
      tastes: herb?.tastes ?? [],
      channels: herb?.channels ?? [],
      properties: herb?.properties ?? '',
      functions: herb?.functions ?? '',
      indications: herb?.indications ?? '',
      cautions: herb?.cautions ?? '',
      dosage_min_g: herb?.dosage_min_g ?? '',
      dosage_max_g: herb?.dosage_max_g ?? '',
      dosage_notes: herb?.dosage_notes ?? '',
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
      router.push(`/reference/herbs/${id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {errors.pinyin_name ? <Alert tone="danger">{t('nameRequired')}</Alert> : null}

      <Card>
        <CardBody className="space-y-5">
          <Section title={ts('identity')}>
            <FieldGrid>
              {/* Pinyin, Chinese and Latin are left-to-right identifiers even in a
                  Hebrew form; only the Hebrew name reads with the page. */}
              <Field label={tf('pinyinName')} htmlFor="pinyin_name" required>
                <LtrInput id="pinyin_name" {...register('pinyin_name')} />
              </Field>
              <Field label={tf('chineseName')} htmlFor="chinese_name">
                <LtrInput id="chinese_name" {...register('chinese_name')} />
              </Field>
              <Field
                label={tf('botanicalName')}
                htmlFor="botanical_name"
                hint="Astragalus membranaceus (Radix)"
              >
                <LtrInput id="botanical_name" className="italic" {...register('botanical_name')} />
              </Field>
              <Field
                label={tf('pharmaceuticalName')}
                htmlFor="pharmaceutical_name"
                hint="Radix Astragali"
              >
                <LtrInput id="pharmaceutical_name" {...register('pharmaceutical_name')} />
              </Field>
              <Field label={tf('englishName')} htmlFor="english_name">
                <LtrInput id="english_name" {...register('english_name')} />
              </Field>
              <Field label={tf('hebrewName')} htmlFor="hebrew_name">
                <Input id="hebrew_name" {...register('hebrew_name')} />
              </Field>
            </FieldGrid>
          </Section>

          <Section title={ts('nature')}>
            <FieldGrid>
              <Field label={tf('tcmCategory')} htmlFor="tcm_category">
                <Select id="tcm_category" {...register('tcm_category')}>
                  <option value="">—</option>
                  {TCM_CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {tTcm(value)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={tf('temperature')} htmlFor="temperature">
                <Select id="temperature" {...register('temperature')}>
                  <option value="">—</option>
                  {TEMPERATURES.map((value) => (
                    <option key={value} value={value}>
                      {tTemp(value)}
                    </option>
                  ))}
                </Select>
              </Field>
            </FieldGrid>

            <Field label={tf('tastes')} className="mt-4">
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {TASTES.map((value) => (
                  <label key={value} className="flex items-center gap-2 text-sm text-ink-700">
                    <Checkbox value={value} {...register('tastes')} />
                    {tTaste(value)}
                  </label>
                ))}
              </div>
            </Field>

            <Field label={tf('channels')} className="mt-4">
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {CHANNELS.map((value) => (
                  <label key={value} className="flex items-center gap-2 text-sm text-ink-700">
                    <Checkbox value={value} {...register('channels')} />
                    {tChannel(value)}
                  </label>
                ))}
              </div>
            </Field>

            <div className="mt-4 space-y-4">
              <Field label={tf('properties')} htmlFor="properties">
                <Input id="properties" {...register('properties')} />
              </Field>
              <Field label={tf('functions')} htmlFor="functions">
                <Textarea id="functions" rows={3} {...register('functions')} />
              </Field>
              <Field label={tf('indications')} htmlFor="indications">
                <Textarea id="indications" rows={3} {...register('indications')} />
              </Field>
            </div>
          </Section>

          <Section title={ts('dosage')}>
            <FieldGrid columns={3}>
              <Field label={tf('dosageMin')} htmlFor="dosage_min_g">
                <LtrInput
                  id="dosage_min_g"
                  type="number"
                  min={0}
                  step="0.5"
                  {...register('dosage_min_g')}
                />
              </Field>
              <Field label={tf('dosageMax')} htmlFor="dosage_max_g">
                <LtrInput
                  id="dosage_max_g"
                  type="number"
                  min={0}
                  step="0.5"
                  {...register('dosage_max_g')}
                />
              </Field>
              <Field label={tf('dosageNotes')} htmlFor="dosage_notes">
                <Input id="dosage_notes" {...register('dosage_notes')} />
              </Field>
            </FieldGrid>
            <Field label={tf('cautions')} htmlFor="cautions" className="mt-4">
              <Textarea id="cautions" rows={3} {...register('cautions')} />
            </Field>
          </Section>

          <Section title={ts('stock')}>
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
            <label className="mt-4 flex items-center gap-2 text-sm text-ink-700">
              <Checkbox {...register('is_active')} />
              {tf('isActive')}
            </label>
          </Section>
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2">
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
