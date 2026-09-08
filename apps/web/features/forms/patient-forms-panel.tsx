'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ClipboardList, LineChart, Plus } from 'lucide-react';
import { Alert, Badge, Card, CardBody, CardHeader, CardTitle, Select } from '@clinic/ui';
import type { FormSubmission, FormTemplate } from '@clinic/db/types';
import { FormRenderer } from './form-renderer';
import { OutcomeChart } from './outcome-chart';
import { buildOutcomeSeries } from './outcome-series';
import { formatDate } from '@clinic/i18n';

/**
 * The questionnaires tab of a patient file.
 *
 * Three things in one place, in the order they are wanted: how the measure has
 * moved, what was answered before, and a way to ask again.
 *
 * The chart comes first because it is the only part that cannot be reconstructed
 * by reading — a list of submissions contains the same numbers and shows nothing.
 *
 * Past submissions are collapsed. A patient a year into treatment has twenty of
 * them, and twenty open forms is a page nobody scrolls; the date and the
 * questionnaire's name are enough to find the one being looked for.
 */
export function PatientFormsPanel({
  patientId,
  templates,
  submissions,
}: {
  patientId: string;
  /** Active questionnaires, for the "fill one in" picker. */
  templates: Pick<FormTemplate, 'id' | 'title' | 'description' | 'fields' | 'version'>[];
  submissions: FormSubmission[];
}) {
  const t = useTranslations('forms');

  const [fillingId, setFillingId] = useState('');
  const [openSubmission, setOpenSubmission] = useState<string | null>(null);
  // Which questionnaire's chart is shown. Series are per template — a field id
  // is unique inside a form and nowhere else.
  const [chartTemplateId, setChartTemplateId] = useState('');

  const titleOf = useMemo(() => {
    const map = new Map(templates.map((template) => [template.id, template.title]));
    return (id: string) => map.get(id) ?? t('unknownForm');
  }, [templates, t]);

  /** The questionnaires this patient has actually answered, newest first. */
  const answeredTemplates = useMemo(() => {
    const ids = new Set(submissions.map((submission) => submission.template_id));
    return [...ids];
  }, [submissions]);

  const chartId = chartTemplateId || answeredTemplates[0] || '';

  const series = useMemo(
    () =>
      buildOutcomeSeries(
        submissions.filter((submission) => submission.template_id === chartId),
      ),
    [submissions, chartId],
  );

  const filling = templates.find((template) => template.id === fillingId) ?? null;

  const ordered = useMemo(
    () =>
      [...submissions].sort(
        (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
      ),
    [submissions],
  );

  return (
    <div className="space-y-5">
      {templates.length === 0 && submissions.length === 0 ? (
        <Alert tone="info">{t('noTemplatesYet')}</Alert>
      ) : null}

      {series.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <LineChart className="h-4 w-4 text-ink-600" aria-hidden />
                {t('outcomeTitle')}
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {answeredTemplates.length > 1 ? (
              <Select
                aria-label={t('chooseForm')}
                value={chartId}
                onChange={(event) => setChartTemplateId(event.target.value)}
                className="max-w-md"
              >
                {answeredTemplates.map((id) => (
                  <option key={id} value={id}>
                    {titleOf(id)}
                  </option>
                ))}
              </Select>
            ) : null}
            <OutcomeChart series={series} />
          </CardBody>
        </Card>
      ) : null}

      {templates.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4 text-ink-600" aria-hidden />
                {t('fillIn')}
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <Select
              aria-label={t('chooseForm')}
              value={fillingId}
              onChange={(event) => setFillingId(event.target.value)}
              className="max-w-md"
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
                {filling.description ? (
                  <p className="mb-3 text-sm text-ink-700" dir="auto">
                    {filling.description}
                  </p>
                ) : null}
                {/* Keyed by template so switching questionnaires starts a new
                    form rather than carrying the previous one's answers into it. */}
                <FormRenderer
                  key={filling.id}
                  templateId={filling.id}
                  patientId={patientId}
                  fields={filling.fields}
                />
              </div>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-ink-600" aria-hidden />
              {t('previousSubmissions')}
            </span>
          </CardTitle>
        </CardHeader>
        <CardBody>
          {ordered.length === 0 ? (
            <p className="text-sm text-ink-600">{t('noSubmissions')}</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {ordered.map((submission) => {
                const open = openSubmission === submission.id;
                return (
                  <li key={submission.id}>
                    <button
                      type="button"
                      onClick={() => setOpenSubmission(open ? null : submission.id)}
                      aria-expanded={open}
                      className="flex w-full items-center gap-2 py-2 text-start text-sm hover:bg-ink-50"
                    >
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-ink-500 transition-transform ${
                          open ? 'rotate-180' : ''
                        }`}
                        aria-hidden
                      />
                      <span dir="ltr" className="shrink-0 tabular-nums text-ink-600">
                        {formatDate(new Date(submission.submitted_at))}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-ink-900" dir="auto">
                        {titleOf(submission.template_id)}
                      </span>
                      {submission.encounter_id ? (
                        <Badge tone="neutral">{t('duringTreatment')}</Badge>
                      ) : null}
                    </button>

                    {open ? (
                      <div className="pb-3">
                        {/* The questions as they were asked, from the submission
                            itself rather than from the template — that is the
                            whole reason a submission carries its own copy. */}
                        <FormRenderer
                          templateId={submission.template_id}
                          patientId={patientId}
                          fields={submission.fields}
                          initialAnswers={submission.answers}
                          readOnly
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
