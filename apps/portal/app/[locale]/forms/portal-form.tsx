'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, Send } from 'lucide-react';
import {
  Alert,
  Button,
  FormActionBar,
  FormFields,
  SignaturePad,
  Spinner,
  cn,
  type SignatureValue,
} from '@clinic/ui';
import { validateAnswers, type FormField } from '@clinic/domain';
import { firstStepWith, splitIntoSteps } from '@clinic/domain/forms/steps';
import { Link, usePathname } from '@clinic/i18n/navigation';
import { submitPortalForm } from './actions';

/**
 * A questionnaire, filled in by the patient at home — a section at a time.
 *
 * The fields are `FormFields` from `@clinic/ui`, the same component the clinic
 * uses — nine field types with their accessibility and their right-to-left
 * handling are the same work whoever is answering. Only the words and the action
 * differ, and both are here.
 *
 * The sections the clinic wrote into the questionnaire are its screens: a
 * step is checked before the next one opens, the whole is checked again on
 * sending, and a problem found then goes back to the step it is on. The
 * buttons live in the sticky bar at the foot, so "next" is never a page of
 * questions away.
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
  const pathname = usePathname();
  const isRtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';

  const steps = useMemo(() => splitIntoSteps(fields), [fields]);
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex] ?? steps[0]!;
  const last = stepIndex === steps.length - 1;
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [invalid, setInvalid] = useState<string[]>([]);
  const [signature, setSignature] = useState<SignatureValue | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // A new step starts at its heading, for the eye and for a screen reader.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView({ block: 'start' });
  }, [stepIndex]);

  function set(id: string, value: unknown) {
    setAnswers((current) => ({ ...current, [id]: value }));
    setInvalid((current) => current.filter((entry) => entry !== id));
  }

  /** The step's own problems; true when it is clean. */
  function checkStep(): boolean {
    setError(null);
    const problems = validateAnswers(step.fields, answers);
    setInvalid(problems);
    if (problems.length > 0) {
      setError(t('fixErrors'));
      document.getElementById(`field-${problems[0]}`)?.scrollIntoView({ block: 'center' });
      return false;
    }
    return true;
  }

  function next() {
    if (checkStep()) setStepIndex((index) => Math.min(index + 1, steps.length - 1));
  }

  function previous() {
    setError(null);
    setStepIndex((index) => Math.max(index - 1, 0));
  }

  function submit() {
    if (!checkStep()) return;
    // The whole thing once more: an earlier step's answer may have been
    // cleared since it was checked.
    const problems = validateAnswers(fields, answers);
    if (problems.length > 0) {
      setInvalid(problems);
      setError(t('fixErrors'));
      setStepIndex(firstStepWith(steps, problems));
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
    return (
      <div className="space-y-4">
        <Alert tone="success">{t('thanks')}</Alert>
        {pathname !== '/forms' ? (
          <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
            <Link href="/forms">{t('backToList')}</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  const Back = isRtl ? ArrowRight : ArrowLeft;
  const Forward = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div className="space-y-4">
      {steps.length > 1 ? (
        <div className="space-y-1.5">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-sm font-semibold text-ink-900 focus:outline-none"
          >
            {t('stepOf', { step: stepIndex + 1, total: steps.length })}
          </h2>
          <div
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={stepIndex + 1}
            aria-label={t('stepOf', { step: stepIndex + 1, total: steps.length })}
            aria-valuetext={t('stepOf', { step: stepIndex + 1, total: steps.length })}
            className="flex gap-1"
          >
            {steps.map((entry, index) => (
              <span
                key={index}
                className={cn(
                  'h-1.5 flex-1 rounded-full',
                  index <= stepIndex ? 'bg-jade-600' : 'bg-ink-200',
                )}
              />
            ))}
          </div>
        </div>
      ) : null}

      <FormFields
        fields={step.fields}
        answers={answers}
        invalid={invalid}
        onChange={set}
        labels={{ yes: tc('yes'), no: tc('no'), required: t('answerRequired') }}
      />

      {last ? (
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
      ) : null}

      <FormActionBar
        className="-mx-4 sm:-mx-6"
        status={
          error ? (
            <span role="alert" className="font-medium text-red-700">
              {error}
            </span>
          ) : undefined
        }
      >
        {stepIndex > 0 ? (
          <Button type="button" variant="secondary" size="lg" onClick={previous} disabled={isPending}>
            <Back className="h-4 w-4" aria-hidden />
            {t('previous')}
          </Button>
        ) : null}
        {last ? (
          <Button type="button" size="lg" onClick={submit} disabled={isPending}>
            {isPending ? <Spinner /> : <Send className="h-4 w-4" aria-hidden />}
            {t('submit')}
          </Button>
        ) : (
          <Button type="button" size="lg" onClick={next}>
            {t('next')}
            <Forward className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </FormActionBar>
    </div>
  );
}
