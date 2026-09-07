'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Send } from 'lucide-react';
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
import { validateAnswers, type FormField } from '@clinic/domain';
import { useRouter } from '@clinic/i18n/navigation';
import { submitForm } from './actions';

/**
 * Fills in a questionnaire.
 *
 * The same component renders any form the builder can produce, which is the
 * point: a new questionnaire needs no new code.
 *
 * Validation runs here for the immediate red outline and again in the Server
 * Action, against the same function — a Server Action is a public endpoint, and
 * "the form would not let me" is not a constraint on anyone who does not use the
 * form. Errors mark the fields they belong to rather than piling up in one
 * message at the top, because on a form of thirty questions that message tells
 * you something is wrong and not where.
 */
export function FormRenderer({
  templateId,
  patientId,
  encounterId,
  fields,
  readOnly = false,
  initialAnswers = {},
}: {
  templateId: string;
  patientId: string;
  encounterId?: string | null;
  fields: FormField[];
  /** True when showing a submission that has already been made. */
  readOnly?: boolean;
  initialAnswers?: Record<string, unknown>;
}) {
  const t = useTranslations('forms');
  const tc = useTranslations('common');
  const router = useRouter();

  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function set(id: string, value: unknown) {
    setAnswers((current) => ({ ...current, [id]: value }));
    setInvalid((current) => current.filter((entry) => entry !== id));
  }

  function submit() {
    setError(null);
    const problems = validateAnswers(fields, answers);
    if (problems.length > 0) {
      setInvalid(problems);
      // Take the person to the first problem rather than making them hunt.
      document.getElementById(`field-${problems[0]}`)?.scrollIntoView({ block: 'center' });
      return;
    }

    startTransition(async () => {
      const result = await submitForm({
        template_id: templateId,
        patient_id: patientId,
        encounter_id: encounterId ?? null,
        answers,
        notes: '',
      });

      if (!result.ok) {
        setError(t('submitFailed'));
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="max-w-2xl space-y-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {saved ? <Alert tone="success">{t('submitted')}</Alert> : null}

      {fields.map((field) => {
        const bad = invalid.includes(field.id);
        const value = answers[field.id];

        if (field.type === 'section') {
          return (
            <div key={field.id} className="pt-3">
              <h3 className="text-base font-semibold text-ink-900">{field.label}</h3>
              {field.help ? <p className="mt-0.5 text-sm text-ink-600">{field.help}</p> : null}
            </div>
          );
        }

        return (
          <Card key={field.id} id={`field-${field.id}`} className={cn(bad && 'border-red-600')}>
            <CardBody>
              <Field
                label={field.label}
                htmlFor={`in-${field.id}`}
                hint={field.help || undefined}
                required={field.required}
                error={bad ? t('answerRequired') : null}
              >
                {field.type === 'short_text' ? (
                  <Input
                    id={`in-${field.id}`}
                    disabled={readOnly}
                    value={String(value ?? '')}
                    onChange={(e) => set(field.id, e.target.value)}
                  />
                ) : field.type === 'long_text' ? (
                  <Textarea
                    id={`in-${field.id}`}
                    rows={4}
                    disabled={readOnly}
                    value={String(value ?? '')}
                    onChange={(e) => set(field.id, e.target.value)}
                  />
                ) : field.type === 'number' ? (
                  <LtrInput
                    id={`in-${field.id}`}
                    type="number"
                    disabled={readOnly}
                    value={value === undefined || value === null ? '' : String(value)}
                    onChange={(e) =>
                      set(field.id, e.target.value === '' ? undefined : Number(e.target.value))
                    }
                  />
                ) : field.type === 'date' ? (
                  <LtrInput
                    id={`in-${field.id}`}
                    type="date"
                    disabled={readOnly}
                    value={String(value ?? '')}
                    onChange={(e) => set(field.id, e.target.value)}
                  />
                ) : field.type === 'dropdown' ? (
                  <Select
                    id={`in-${field.id}`}
                    disabled={readOnly}
                    value={String(value ?? '')}
                    onChange={(e) => set(field.id, e.target.value || undefined)}
                  >
                    <option value="">—</option>
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                ) : field.type === 'single_choice' || field.type === 'multi_choice' ? (
                  /* A real fieldset: the group needs one accessible name, not
                     one per button, or a screen reader reads thirty unrelated
                     options with no idea what they belong to. */
                  <fieldset id={`in-${field.id}`} className="space-y-1.5">
                    <legend className="sr-only">{field.label}</legend>
                    {field.options.map((option) => {
                      const multi = field.type === 'multi_choice';
                      const selected = multi
                        ? Array.isArray(value) && value.includes(option)
                        : value === option;
                      return (
                        <label
                          key={option}
                          className="flex items-center gap-2 text-sm text-ink-800"
                        >
                          <input
                            type={multi ? 'checkbox' : 'radio'}
                            name={field.id}
                            disabled={readOnly}
                            checked={selected}
                            onChange={(e) => {
                              if (!multi) {
                                set(field.id, option);
                                return;
                              }
                              const current = Array.isArray(value) ? [...value] : [];
                              set(
                                field.id,
                                e.target.checked
                                  ? [...current, option]
                                  : current.filter((entry) => entry !== option),
                              );
                            }}
                            className="h-4 w-4 border-ink-300"
                          />
                          {option}
                        </label>
                      );
                    })}
                  </fieldset>
                ) : field.type === 'yes_no' ? (
                  <fieldset id={`in-${field.id}`} className="flex gap-4">
                    <legend className="sr-only">{field.label}</legend>
                    {[true, false].map((option) => (
                      <label
                        key={String(option)}
                        className="flex items-center gap-2 text-sm text-ink-800"
                      >
                        <input
                          type="radio"
                          name={field.id}
                          disabled={readOnly}
                          checked={value === option}
                          onChange={() => set(field.id, option)}
                          className="h-4 w-4 border-ink-300"
                        />
                        {option ? tc('yes') : tc('no')}
                      </label>
                    ))}
                  </fieldset>
                ) : (
                  /* Scale. A range slider alone leaves the value invisible to
                     anyone not watching the handle, so the number is printed
                     beside it and the ends are labelled. */
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <input
                        id={`in-${field.id}`}
                        type="range"
                        min={field.scale_min}
                        max={field.scale_max}
                        step={1}
                        disabled={readOnly}
                        value={typeof value === 'number' ? value : field.scale_min}
                        onChange={(e) => set(field.id, Number(e.target.value))}
                        className="h-2 flex-1 cursor-pointer accent-jade-700"
                      />
                      <span
                        dir="ltr"
                        className="w-10 shrink-0 text-end text-sm font-semibold tabular-nums text-ink-900"
                      >
                        {typeof value === 'number' ? value : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-ink-600">
                      <span>{field.scale_min_label || field.scale_min}</span>
                      <span>{field.scale_max_label || field.scale_max}</span>
                    </div>
                  </div>
                )}
              </Field>
            </CardBody>
          </Card>
        );
      })}

      {!readOnly ? (
        <div className="flex justify-end">
          <Button onClick={submit} disabled={isPending || saved}>
            {isPending ? (
              <Spinner />
            ) : saved ? (
              <Check className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {saved ? t('submitted') : t('submit')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
