'use client';

import { useMemo, useState, useTransition } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';
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
import {
  FORMULA_TCM_CATEGORIES,
  HERB_UNITS,
  type FormulaTcmCategory,
  type HerbUnit,
  type Locale,
} from '@clinic/domain';
import { useRouter } from '@clinic/i18n/navigation';
import type { Herb, HerbFormulaWithItems } from '@clinic/db/types';
import { herbPrimaryName, herbSecondaryName } from '@/lib/display';
import { saveFormula } from './actions';

interface ItemRow {
  herb_id: string;
  dosage: string;
  unit: HerbUnit;
  notes: string;
}

/**
 * Formula builder.
 *
 * A formula is a template, not a prescription: it stores one dose of each herb, and
 * the multiplier applied at dispensing time decides how many days are handed over.
 */
export function FormulaForm({ formula, herbs }: { formula?: HerbFormulaWithItems; herbs: Herb[] }) {
  const t = useTranslations('inventory.formulas');
  const tf = useTranslations('inventory.formulas.fields');
  const tFormulaTcm = useTranslations('inventory.formulaTcmCategory');
  const tUnit = useTranslations('inventory.unit');
  const tc = useTranslations('common');
  const locale = useLocale() as Locale;
  const format = useFormatter();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [namePinyin, setNamePinyin] = useState(formula?.name_pinyin ?? '');
  const [nameChinese, setNameChinese] = useState(formula?.name_chinese ?? '');
  const [nameEnglish, setNameEnglish] = useState(formula?.name_english ?? '');
  const [nameHebrew, setNameHebrew] = useState(formula?.name_hebrew ?? '');
  const [tcmCategory, setTcmCategory] = useState<FormulaTcmCategory | ''>(
    formula?.tcm_category ?? '',
  );
  const [sourceText, setSourceText] = useState(formula?.source_text ?? '');
  const [actions, setActions] = useState(formula?.actions ?? '');
  const [description, setDescription] = useState(formula?.description ?? '');
  const [indications, setIndications] = useState(formula?.indications ?? '');
  const [contraindications, setContraindications] = useState(formula?.contraindications ?? '');
  const [modifications, setModifications] = useState(formula?.modifications ?? '');
  const [dosageNotes, setDosageNotes] = useState(formula?.dosage_notes ?? '');
  const [isActive, setIsActive] = useState(formula?.is_active ?? true);
  const [items, setItems] = useState<ItemRow[]>(
    formula?.items?.length
      ? formula.items.map((item) => ({
          herb_id: item.herb_id,
          dosage: String(item.dosage),
          unit: item.unit,
          notes: item.notes ?? '',
        }))
      : [{ herb_id: '', dosage: '', unit: 'gram', notes: '' }],
  );

  const totalWeight = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.dosage) || 0), 0),
    [items],
  );

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems(items.map((item, position) => (position === index ? { ...item, ...patch } : item)));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const validItems = items.filter((item) => item.herb_id && Number(item.dosage) > 0);
    if (validItems.length === 0) {
      setError(t('needsHerb'));
      return;
    }
    if (!namePinyin && !nameChinese && !nameEnglish && !nameHebrew) {
      setError(tc('somethingMissing'));
      return;
    }

    const payload = {
      name_pinyin: namePinyin,
      name_chinese: nameChinese,
      name_english: nameEnglish,
      name_hebrew: nameHebrew,
      // Classical / modified / custom was a question nobody answered; the
      // column stays, unshown, at what it was.
      category: formula?.category ?? 'custom',
      tcm_category: tcmCategory,
      source_text: sourceText,
      actions,
      description,
      indications,
      contraindications,
      modifications,
      dosage_notes: dosageNotes,
      is_active: isActive,
      items: validItems.map((item) => ({
        herb_id: item.herb_id,
        dosage: Number(item.dosage),
        unit: item.unit,
        notes: item.notes,
      })),
    };

    startTransition(async () => {
      const result = await saveFormula(formula?.id ?? null, payload);
      if (!result.ok) {
        setError(tc('errorGeneric'));
        return;
      }
      const id = result.data?.id ?? formula?.id;
      router.push(id ? `/reference/formulas/${id}` : '/reference/formulas');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Card>
        <CardBody className="space-y-5">
          <Section title={tc('name')}>
            <FieldGrid>
              <Field label={tf('namePinyin')} htmlFor="name_pinyin">
                <LtrInput
                  id="name_pinyin"
                  value={namePinyin}
                  onChange={(event) => setNamePinyin(event.target.value)}
                />
              </Field>
              <Field label={tf('nameChinese')} htmlFor="name_chinese">
                <LtrInput
                  id="name_chinese"
                  value={nameChinese}
                  onChange={(event) => setNameChinese(event.target.value)}
                />
              </Field>
              <Field label={tf('nameEnglish')} htmlFor="name_english">
                <LtrInput
                  id="name_english"
                  value={nameEnglish}
                  onChange={(event) => setNameEnglish(event.target.value)}
                />
              </Field>
              <Field label={tf('nameHebrew')} htmlFor="name_hebrew">
                <Input
                  id="name_hebrew"
                  value={nameHebrew}
                  onChange={(event) => setNameHebrew(event.target.value)}
                />
              </Field>
              <Field label={tf('tcmCategory')} htmlFor="tcm_category">
                <Select
                  id="tcm_category"
                  value={tcmCategory}
                  onChange={(event) =>
                    setTcmCategory(event.target.value as FormulaTcmCategory | '')
                  }
                >
                  <option value="">—</option>
                  {FORMULA_TCM_CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {tFormulaTcm(value)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={tf('sourceText')} htmlFor="source_text" hint="Shang Han Lun">
                <LtrInput
                  id="source_text"
                  value={sourceText}
                  onChange={(event) => setSourceText(event.target.value)}
                />
              </Field>
            </FieldGrid>
            <label className="mt-4 flex items-center gap-2 text-sm text-ink-700">
              <Checkbox
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              {tc('active')}
            </label>
          </Section>

          <Section title={t('clinical')}>
            <div className="space-y-4">
              <Field label={tf('actions')} htmlFor="actions">
                <Textarea
                  id="actions"
                  rows={3}
                  value={actions}
                  onChange={(event) => setActions(event.target.value)}
                />
              </Field>
              <Field label={tf('indications')} htmlFor="indications">
                <Textarea
                  id="indications"
                  rows={3}
                  value={indications}
                  onChange={(event) => setIndications(event.target.value)}
                />
              </Field>
              <Field label={tf('contraindications')} htmlFor="contraindications">
                <Textarea
                  id="contraindications"
                  rows={3}
                  value={contraindications}
                  onChange={(event) => setContraindications(event.target.value)}
                />
              </Field>
              <Field label={tf('modifications')} htmlFor="modifications">
                <Textarea
                  id="modifications"
                  rows={2}
                  value={modifications}
                  onChange={(event) => setModifications(event.target.value)}
                />
              </Field>
              <FieldGrid>
                <Field label={tf('dosageNotes')} htmlFor="dosage_notes">
                  <Input
                    id="dosage_notes"
                    value={dosageNotes}
                    onChange={(event) => setDosageNotes(event.target.value)}
                  />
                </Field>
                <Field label={tf('description')} htmlFor="description">
                  <Input
                    id="description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </Field>
              </FieldGrid>
            </div>
          </Section>

          <Section
            title={t('items')}
            description={`${t('totalWeight')}: ${format.number(totalWeight)}`}
          >
            <ul className="space-y-2">
              {items.map((item, index) => (
                <li key={index} className="flex flex-wrap items-end gap-2">
                  <div className="min-w-48 flex-1">
                    <Select
                      aria-label={t('selectHerb')}
                      value={item.herb_id}
                      onChange={(event) => updateItem(index, { herb_id: event.target.value })}
                    >
                      <option value="">{t('selectHerb')}</option>
                      {herbs.map((herb) => {
                        const secondary = herbSecondaryName(herb, locale);
                        return (
                          <option key={herb.id} value={herb.id}>
                            {herbPrimaryName(herb, locale)}
                            {secondary ? ` · ${secondary}` : ''}
                          </option>
                        );
                      })}
                    </Select>
                  </div>
                  <LtrInput
                    aria-label={t('dosage')}
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-24"
                    value={item.dosage}
                    onChange={(event) => updateItem(index, { dosage: event.target.value })}
                  />
                  <Select
                    aria-label={tc('unit')}
                    className="w-28"
                    value={item.unit}
                    onChange={(event) =>
                      updateItem(index, { unit: event.target.value as HerbUnit })
                    }
                  >
                    {HERB_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {tUnit(unit)}
                      </option>
                    ))}
                  </Select>
                  {/* Preparation notes belong on the line, not in a general
                      comment: "decoct first" applies to this herb only. */}
                  <Input
                    aria-label={t('itemNotes')}
                    placeholder={t('itemNotes')}
                    className="w-44"
                    value={item.notes}
                    onChange={(event) => updateItem(index, { notes: event.target.value })}
                  />
                  <button
                    type="button"
                    aria-label={t('removeItem')}
                    onClick={() => setItems(items.filter((_, position) => position !== index))}
                    className="rounded-md p-2 text-ink-500 transition-colors hover:bg-red-50 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() =>
                setItems([...items, { herb_id: '', dosage: '', unit: 'gram', notes: '' }])
              }
            >
              <Plus className="h-4 w-4" />
              {t('addItem')}
            </Button>
          </Section>
        </CardBody>
      </Card>

      <FormActionBar>
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
      </FormActionBar>
    </form>
  );
}
