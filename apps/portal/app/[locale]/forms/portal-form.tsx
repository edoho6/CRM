'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Send } from 'lucide-react';
import {
  Alert,
  Button,
  FormFields,
  SignaturePad,
  Spinner,
  type SignatureValue,
} from '@clinic/ui';
import { validateAnswers, type FormField } from '@clinic/domain';
import { submitPortalForm } from './actions';

/**
 * A questionnaire, filled in by the patient at home.
 *
 * The fields are `FormFields` from `@clinic/ui`, the same component the clinic
 * uses — nine field types with their accessibility and their right-to-left
 * handling are the same work whoever is answering. Only the words and the action
 * differ, and both are here.
 *
 * Signing is offered and not required. A health questionnaire is not a consent
 * form, and demanding a signature before someone can tell you about their
 * headaches turns a five-minute favour into a hurdle.
 */
export function PortalForm({
  templateId,
  fields,
  onDone,
}: {
  templateId: string;
  fields: FormField[];
  onDone?: () => void;
}) {
  const t = useTranslations('portal.forms');
  const tc = useTranslations('common');

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [invalid, setInvalid] = useState<string[]>([]);
  const [signature, setSignature] = useState<SignatureValue | null>(null);
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
      document.getElementById(`field-${problems[0]}`)?.scrollIntoView({ block: 'center' });
      return;
    }

    startTransition(async () => {
      const result = await submitPortalForm({ template_id: templateId, answers, signature });
      if (!result.ok) {
        setError(t('failed'));
        return;
      }
      setSaved(true);
      onDone?.();
    });
  }

  if (saved) {
    return <Alert tone="success">{t('thanks')}</Alert>;
  }

  return (
    <div className="space-y-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <FormFields
        fields={fields}
        answers={answers}
        invalid={invalid}
        onChange={set}
        labels={{ yes: tc('yes'), no: tc('no'), required: t('answerRequired') }}
      />

      <div className="rounded-lg border border-ink-200 bg-ink-50 p-3">
        <SignaturePad
          value={signature}
          onChange={setSignature}
          labels={{
            legend: t('signature.legend'),
            draw: t('signature.draw'),
            type: t('signature.type'),
            drawHint: t('signature.drawHint'),
            typeHint: t('signature.typeHint'),
            typedLabel: t('signature.typedLabel'),
            clear: t('signature.clear'),
          }}
        />
        <p className="mt-2 text-xs text-ink-600">{t('signature.optional')}</p>
      </div>

      <div className="flex justify-end">
        <Button size="lg" onClick={submit} disabled={isPending}>
          {isPending ? <Spinner /> : <Send className="h-4 w-4" />}
          {t('submit')}
        </Button>
      </div>
    </div>
  );
}
