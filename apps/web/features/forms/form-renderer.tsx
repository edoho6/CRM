'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Send } from 'lucide-react';
import { Alert, Button, FormFields, Spinner } from '@clinic/ui';
import { validateAnswers, type FormField } from '@clinic/domain';
import { useRouter } from '@clinic/i18n/navigation';
import { submitForm } from './actions';

/**
 * Fills in a questionnaire, in the clinic.
 *
 * The questions themselves are drawn by `FormFields` in `@clinic/ui`, shared
 * with the patient portal — nine field types with their accessibility and their
 * right-to-left handling are the same work whoever is answering. What lives here
 * is the half that is specific to this app: the words, and the Server Action the
 * answers go to.
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

      <FormFields
        fields={fields}
        answers={answers}
        invalid={invalid}
        onChange={set}
        readOnly={readOnly}
        labels={{ yes: tc('yes'), no: tc('no'), required: t('answerRequired') }}
      />

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
