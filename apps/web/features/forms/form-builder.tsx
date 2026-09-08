'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Field,
  Input,
  LtrInput,
  Select,
  Spinner,
  Textarea,
} from '@clinic/ui';
import { cn } from '@clinic/ui/cn';
import {
  FORM_FIELD_TYPES,
  isChoiceField,
  type FormField,
  type FormFieldType,
} from '@clinic/domain';
import { useRouter } from '@clinic/i18n/navigation';
import { saveFormTemplate } from './actions';

/**
 * The questionnaire builder.
 *
 * Each question is a card carrying only the settings its own type has — a
 * dropdown shows an option list, a scale shows its two ends, a text box shows
 * neither. Showing every setting for every type is how a builder ends up looking
 * like a database admin screen, and the author then has to work out which half
 * of it applies to them.
 *
 * Reordering is by two arrows rather than by dragging. Dragging is nicer with a
 * mouse and unusable without one, and a form is built once and then filled a
 * hundred times — the ten seconds saved in the building are not worth the people
 * locked out of it.
 */

function newField(type: FormFieldType = 'short_text'): FormField {
  return {
    // Stable for the life of the question: answers are stored against it, so it
    // must survive reordering, renaming and editing.
    id: `f_${Math.random().toString(36).slice(2, 10)}`,
    type,
    label: '',
    help: '',
    required: false,
    options: isChoiceField(type) ? ['', ''] : [],
    scale_min: 0,
    scale_max: 10,
    scale_min_label: '',
    scale_max_label: '',
  };
}

export function FormBuilder({
  templateId,
  initialTitle,
  initialDescription,
  initialFields,
  initialActive,
}: {
  templateId: string | null;
  initialTitle: string;
  initialDescription: string;
  initialFields: FormField[];
  initialActive: boolean;
}) {
  const t = useTranslations('forms');
  const tc = useTranslations('common');
  const router = useRouter();

  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [isActive, setIsActive] = useState(initialActive);
  const [fields, setFields] = useState<FormField[]>(initialFields);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update(index: number, patch: Partial<FormField>) {
    setFields((current) =>
      current.map((field, position) => (position === index ? { ...field, ...patch } : field)),
    );
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= fields.length) return;
    setFields((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function duplicate(index: number) {
    setFields((current) => {
      const copy = { ...current[index]!, id: newField().id };
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
  }

  function changeType(index: number, type: FormFieldType) {
    const field = fields[index]!;
    update(index, {
      type,
      // A type that needs options and has none would be unanswerable, so it
      // starts with two empty ones rather than an empty list.
      options: isChoiceField(type) ? (field.options.length >= 2 ? field.options : ['', '']) : [],
    });
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveFormTemplate(templateId, {
        title,
        description,
        is_active: isActive,
        // Empty options are the author part-way through typing; they are dropped
        // on save rather than blocking it.
        fields: fields.map((field) => ({
          ...field,
          options: field.options.map((option) => option.trim()).filter(Boolean),
        })),
      });

      if (!result.ok) {
        setError(t('saveFailed'));
        return;
      }
      router.push(`/forms/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <div className="max-w-3xl space-y-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Card>
        <CardBody className="space-y-3">
          <Field label={t('formTitle')} htmlFor="form_title" required>
            <Input id="form_title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={t('formDescription')} htmlFor="form_description">
            <Textarea
              id="form_description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-ink-300"
            />
            {t('formActive')}
          </label>
        </CardBody>
      </Card>

      {fields.map((field, index) => (
        <Card key={field.id}>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* No grip: reordering is by the arrow buttons (see the note at
                  the top), and a drag handle on a thing that cannot be dragged
                  is a promise the row does not keep. */}
              <span className="text-xs tabular-nums text-ink-500">{index + 1}</span>

              <Select
                aria-label={t('fieldType')}
                value={field.type}
                onChange={(e) => changeType(index, e.target.value as FormFieldType)}
                className="h-8 w-auto min-w-40 text-sm"
              >
                {FORM_FIELD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`types.${type}`)}
                  </option>
                ))}
              </Select>

              <span className="ms-auto flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={t('moveUp')}
                  className="rounded p-1.5 text-ink-600 hover:bg-ink-100 disabled:opacity-30"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === fields.length - 1}
                  aria-label={t('moveDown')}
                  className="rounded p-1.5 text-ink-600 hover:bg-ink-100 disabled:opacity-30"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => duplicate(index)}
                  aria-label={tc('duplicate')}
                  className="rounded p-1.5 text-ink-600 hover:bg-ink-100"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFields((current) => current.filter((_, position) => position !== index))
                  }
                  aria-label={tc('delete')}
                  className="rounded p-1.5 text-ink-500 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </div>

            <Field
              label={field.type === 'section' ? t('sectionHeading') : t('question')}
              htmlFor={`label-${field.id}`}
              required
            >
              <Input
                id={`label-${field.id}`}
                value={field.label}
                onChange={(e) => update(index, { label: e.target.value })}
              />
            </Field>

            <Field label={t('help')} htmlFor={`help-${field.id}`}>
              <Input
                id={`help-${field.id}`}
                value={field.help ?? ''}
                onChange={(e) => update(index, { help: e.target.value })}
              />
            </Field>

            {isChoiceField(field.type) ? (
              <div className="space-y-1.5">
                <span className="block text-sm font-medium text-ink-700">{t('options')}</span>
                {field.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <Input
                      aria-label={t('optionNumber', { number: optionIndex + 1 })}
                      value={option}
                      onChange={(e) =>
                        update(index, {
                          options: field.options.map((entry, position) =>
                            position === optionIndex ? e.target.value : entry,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        update(index, {
                          options: field.options.filter((_, position) => position !== optionIndex),
                        })
                      }
                      aria-label={tc('delete')}
                      className="rounded p-1.5 text-ink-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => update(index, { options: [...field.options, ''] })}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('addOption')}
                </Button>
              </div>
            ) : null}

            {field.type === 'scale' ? (
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label={t('scaleMin')} htmlFor={`min-${field.id}`} density="compact">
                  <LtrInput
                    id={`min-${field.id}`}
                    type="number"
                    value={field.scale_min}
                    onChange={(e) => update(index, { scale_min: Number(e.target.value) })}
                  />
                </Field>
                <Field label={t('scaleMax')} htmlFor={`max-${field.id}`} density="compact">
                  <LtrInput
                    id={`max-${field.id}`}
                    type="number"
                    value={field.scale_max}
                    onChange={(e) => update(index, { scale_max: Number(e.target.value) })}
                  />
                </Field>
                <Field label={t('scaleMinLabel')} htmlFor={`minl-${field.id}`} density="compact">
                  <Input
                    id={`minl-${field.id}`}
                    value={field.scale_min_label ?? ''}
                    onChange={(e) => update(index, { scale_min_label: e.target.value })}
                  />
                </Field>
                <Field label={t('scaleMaxLabel')} htmlFor={`maxl-${field.id}`} density="compact">
                  <Input
                    id={`maxl-${field.id}`}
                    value={field.scale_max_label ?? ''}
                    onChange={(e) => update(index, { scale_max_label: e.target.value })}
                  />
                </Field>
              </div>
            ) : null}

            {/* A section asks nothing, so it cannot be required. */}
            {field.type !== 'section' ? (
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => update(index, { required: e.target.checked })}
                  className="h-4 w-4 rounded border-ink-300"
                />
                {t('required')}
              </label>
            ) : null}
          </CardBody>
        </Card>
      ))}

      <div className={cn('flex flex-wrap items-center gap-2', fields.length === 0 && 'pt-2')}>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setFields((current) => [...current, newField()])}
        >
          <Plus className="h-4 w-4" />
          {t('addQuestion')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setFields((current) => [...current, newField('section')])}
        >
          <Plus className="h-4 w-4" />
          {t('addSection')}
        </Button>

        <Button
          type="button"
          className="ms-auto"
          onClick={save}
          disabled={isPending || !title.trim()}
        >
          {isPending ? <Spinner /> : null}
          {tc('save')}
        </Button>
      </div>
    </div>
  );
}
