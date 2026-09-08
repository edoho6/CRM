'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { ClipboardList } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle, Select } from '@clinic/ui';
import type { FormSubmission, FormTemplate } from '@clinic/db/types';
import { FormRenderer } from './form-renderer';

/**
 * Filling a questionnaire during a treatment.
 *
 * The same renderer as the patient tab, with the encounter attached — that link
 * is what lets an answer be read against the visit it was given at rather than
 * against a date alone.
 *
 * Only this encounter's submissions are listed. The patient's whole history of
 * questionnaires is a tab in their file; repeating it here would bury the one
 * thing this panel is for, which is asking now.
 */
export function EncounterFormsPanel({
  patientId,
  encounterId,
  templates,
  submissions,
  disabled,
}: {
  patientId: string;
  encounterId: string;
  templates: Pick<FormTemplate, 'id' | 'title' | 'description' | 'fields'>[];
  submissions: FormSubmission[];
  /** True once the record is signed: the treatment is closed, so is this. */
  disabled: boolean;
}) {
  const t = useTranslations('forms');
  const format = useFormatter();
  const [fillingId, setFillingId] = useState('');

  const filling = templates.find((template) => template.id === fillingId) ?? null;

  // Nothing to offer and nothing filled in: an empty card on every treatment
  // page is furniture.
  if (templates.length === 0 && submissions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-ink-600" aria-hidden />
            {t('title')}
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        {submissions.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {submissions.map((submission) => (
              <li key={submission.id} className="flex items-baseline gap-2">
                <span dir="ltr" className="shrink-0 tabular-nums text-ink-600">
                  {format.dateTime(new Date(submission.submitted_at), 'time')}
                </span>
                <span className="min-w-0 truncate text-ink-800" dir="auto">
                  {templates.find((template) => template.id === submission.template_id)?.title ??
                    t('unknownForm')}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {!disabled && templates.length > 0 ? (
          <>
            <Select
              aria-label={t('chooseForm')}
              value={fillingId}
              onChange={(event) => setFillingId(event.target.value)}
            >
              <option value="">{t('chooseForm')}</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}
                </option>
              ))}
            </Select>

            {filling ? (
              <div className="border-t border-ink-100 pt-3">
                <FormRenderer
                  key={filling.id}
                  templateId={filling.id}
                  patientId={patientId}
                  encounterId={encounterId}
                  fields={filling.fields}
                />
              </div>
            ) : null}
          </>
        ) : null}
      </CardBody>
    </Card>
  );
}
