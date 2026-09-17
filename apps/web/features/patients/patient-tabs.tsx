'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Stethoscope } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@clinic/ui';

const TABS = [
  'overview',
  'encounters',
  'appointments',
  'documents',
  'medical',
  'forms',
  'consent',
] as const;
type Tab = (typeof TABS)[number];

/** The tabs that show clinical content; hidden from anyone who may not read it. */
const CLINICAL_TABS: readonly Tab[] = ['encounters', 'documents', 'medical', 'forms'];

/**
 * Tab shell for the patient file.
 *
 * The panels are server-rendered and passed in as props, so the tabs are purely a
 * visibility control — no client-side fetching, and every tab is present in the
 * initial HTML.
 *
 * Which tab is open lives in the URL (`?tab=`). Opening a document, pressing
 * Back, or reloading used to drop you on the overview every time, and a tab
 * could not be linked to. `replace` rather than `push`, so the tabs do not
 * pile up in the history.
 */
export function PatientTabs({
  overview,
  encounters,
  encounterCount,
  appointments,
  documents,
  medical,
  forms,
  consent,
  clinical = true,
}: {
  overview: React.ReactNode;
  encounters: React.ReactNode;
  /** How many treatments this patient has had — shown on the tab itself. */
  encounterCount: number;
  appointments: React.ReactNode;
  documents: React.ReactNode;
  medical: React.ReactNode;
  forms: React.ReactNode;
  consent: React.ReactNode;
  /**
   * Whether this person may read the clinical side of the file (migration 78).
   * A secretary keeps the overview, the diary and the consents — where her work
   * is — and the treatments, documents, history and questionnaires are not
   * drawn at all. The database would refuse them anyway; an empty tab would
   * only invite the question of what is behind it.
   */
  clinical?: boolean;
}) {
  const t = useTranslations('patients.tabs');
  const searchParams = useSearchParams();
  const requested = searchParams.get('tab');
  const shown = clinical ? TABS : TABS.filter((tab) => !CLINICAL_TABS.includes(tab));
  // A link to a tab this person may not open lands on the overview rather than
  // on a tab strip with nothing selected.
  const [value, setValue] = useState<Tab>(
    (shown as readonly string[]).includes(requested ?? '') ? (requested as Tab) : 'overview',
  );

  /*
   * The URL is written with `history.replaceState`, not the router. A router
   * navigation re-renders the page on the server — eighteen queries — and
   * writes a "file opened" row to the access log, so seven tab clicks used to
   * count as seven reads of the record. The panels are already here; only the
   * address needs to change.
   */
  function choose(next: string) {
    setValue(next as Tab);
    const params = new URLSearchParams(window.location.search);
    if (next === 'overview') params.delete('tab');
    else params.set('tab', next);
    const query = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}`,
    );
  }

  return (
    <Tabs value={value} onValueChange={choose}>
      <TabsList>
        <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
        {/* The count on the tab, so "how many times have I seen this person"
            is answered without opening it. The number is inside the button's
            accessible name too — a bare digit beside a word is read as two
            unrelated things. */}
        {clinical ? (
          <TabsTrigger
            value="encounters"
            aria-label={t('encountersWithCount', { count: encounterCount })}
          >
            <span className="inline-flex items-center gap-1.5">
              <Stethoscope aria-hidden className="h-3.5 w-3.5 shrink-0" />
              <span aria-hidden>{t('encounters')}</span>
              {encounterCount > 0 ? (
                <span
                  aria-hidden
                  className="inline-flex min-w-5 items-center justify-center rounded-full bg-ink-100 px-1.5 text-xs font-semibold text-ink-700 tabular-nums group-data-[state=active]:bg-accent-fg/25 data-[state=active]:bg-accent-fg/25"
                >
                  {encounterCount}
                </span>
              ) : null}
            </span>
          </TabsTrigger>
        ) : null}
        <TabsTrigger value="appointments">{t('appointments')}</TabsTrigger>
        {clinical ? <TabsTrigger value="documents">{t('documents')}</TabsTrigger> : null}
        {clinical ? <TabsTrigger value="medical">{t('medical')}</TabsTrigger> : null}
        {clinical ? <TabsTrigger value="forms">{t('forms')}</TabsTrigger> : null}
        <TabsTrigger value="consent">{t('consent')}</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">{overview}</TabsContent>
      {/* The panels, not only their tabs: the server sends this markup, and a
          hidden panel is still in the page for anyone who opens the source. */}
      {clinical ? <TabsContent value="encounters">{encounters}</TabsContent> : null}
      <TabsContent value="appointments">{appointments}</TabsContent>
      {clinical ? <TabsContent value="documents">{documents}</TabsContent> : null}
      {clinical ? <TabsContent value="medical">{medical}</TabsContent> : null}
      {clinical ? <TabsContent value="forms">{forms}</TabsContent> : null}
      <TabsContent value="consent">{consent}</TabsContent>
    </Tabs>
  );
}
