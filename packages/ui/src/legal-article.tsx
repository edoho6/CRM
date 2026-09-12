import * as React from 'react';
import { Card, CardBody, CardHeader, CardTitle } from './card';

/** The shape of one document's `sections` block in the messages: an object keyed by section id. */
export type LegalSectionsMessage = Record<string, { title: string; body: Array<string | { items: string[] }> }>;

/** From the raw messages block to the list the article renders, in the order the messages give. */
export function legalSectionsFrom(raw: unknown): LegalSection[] {
  const sections = (raw ?? {}) as LegalSectionsMessage;
  return Object.entries(sections).map(([id, section]) => ({ id, title: section.title, paragraphs: section.body }));
}

export interface LegalSection {
  id: string;
  title: string;
  /** Paragraphs, in order; a bulleted list is a paragraph whose items are given. */
  paragraphs: Array<string | { items: string[] }>;
}

/**
 * A legal text — the privacy policy, the terms — as numbered sections on
 * cards, with the operator's details at the foot. Both apps render the same
 * documents from the same messages; only the frame around them differs.
 *
 * The operator's details are marked as placeholders until they are filled
 * in: a policy that names nobody is not a policy, and it should look
 * unfinished until it is one.
 */
export function LegalArticle({
  title,
  subtitle,
  sections,
  operator,
  updated,
}: {
  title: string;
  subtitle: string;
  sections: LegalSection[];
  operator: { title: string; name: string; email: string; placeholder: boolean; warning: string };
  updated: string;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-5 py-6 sm:py-10">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900 sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-ink-600">{subtitle}</p>
      </div>

      {sections.map((section, index) => (
        <Card key={section.id} id={section.id}>
          <CardHeader>
            <CardTitle>
              <span className="me-2 tabular-nums text-ink-500">{index + 1}.</span>
              {section.title}
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {section.paragraphs.map((paragraph, i) =>
              typeof paragraph === 'string' ? (
                <p key={i} className="text-sm leading-relaxed text-ink-800">
                  {paragraph}
                </p>
              ) : (
                <ul key={i} className="list-disc space-y-1.5 ps-5 text-sm leading-relaxed text-ink-800">
                  {paragraph.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              ),
            )}
          </CardBody>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>{operator.title}</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="space-y-1.5 text-sm">
            <div className="flex gap-2">
              <dt className="text-ink-600">{operator.name.split(':')[0]}</dt>
              <dd className={operator.placeholder ? 'font-medium text-amber-800' : 'font-medium text-ink-900'}>
                {operator.name.split(':').slice(1).join(':').trim()}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-600">{operator.email.split(':')[0]}</dt>
              <dd className={operator.placeholder ? 'font-medium text-amber-800' : 'font-medium text-ink-900'} dir="ltr">
                {operator.email.split(':').slice(1).join(':').trim()}
              </dd>
            </div>
          </dl>
          {operator.placeholder ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
              {operator.warning}
            </p>
          ) : null}
        </CardBody>
      </Card>

      <p className="text-xs text-ink-600">{updated}</p>
    </div>
  );
}
