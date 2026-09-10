'use client';

import * as React from 'react';
import type { FormField } from '@clinic/domain';
import { cn } from './cn';
import { Card, CardBody } from './card';
import { Field, Input, LtrInput, Select, Textarea } from './field';
import { DateInput } from './date-input';

/**
 * The questions of a form, rendered.
 *
 * Presentational and nothing else: it holds no answers, submits nothing, and
 * knows no words. The clinic app and the patient portal are separate Next
 * applications that cannot import each other's components, and the part they
 * genuinely share is this — nine field types, their labels, their keyboard
 * behaviour and their right-to-left handling. What differs is where the answers
 * go and what language the buttons are in, and both of those stay outside.
 *
 * Labels arrive as props for the same reason `SignaturePad` takes them that
 * way: a UI package that imported next-intl would drag a routing and locale
 * setup into anything that used one button from it.
 */

export interface FormFieldsLabels {
  yes: string;
  no: string;
  /** Shown against a field that was left empty and should not have been. */
  required: string;
}

export function FormFields({
  fields,
  answers,
  invalid,
  onChange,
  readOnly = false,
  labels,
}: {
  fields: FormField[];
  answers: Record<string, unknown>;
  /** Field ids to mark. Comes from `validateAnswers` in @clinic/domain. */
  invalid: string[];
  onChange: (id: string, value: unknown) => void;
  readOnly?: boolean;
  labels: FormFieldsLabels;
}) {
  const set = onChange;

  return (
    <>
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
                error={bad ? labels.required : null}
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
                  /* Day/month/year typed, whatever language the browser is in;
                     the answer stored stays YYYY-MM-DD. */
                  <DateInput
                    id={`in-${field.id}`}
                    compact={false}
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
                            className="h-5 w-5 border-ink-300"
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
                          className="h-5 w-5 border-ink-300"
                        />
                        {option ? labels.yes : labels.no}
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
    </>
  );
}
