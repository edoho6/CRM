'use client';

import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@clinic/ui';

/**
 * Tab shell for the patient file.
 *
 * The panels are server-rendered and passed in as props, so the tabs are purely a
 * visibility control — no client-side fetching, and every tab is present in the
 * initial HTML.
 */
export function PatientTabs({
  overview,
  encounters,
  appointments,
  documents,
  medical,
  consent,
}: {
  overview: React.ReactNode;
  encounters: React.ReactNode;
  appointments: React.ReactNode;
  documents: React.ReactNode;
  medical: React.ReactNode;
  consent: React.ReactNode;
}) {
  const t = useTranslations('patients.tabs');

  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
        <TabsTrigger value="encounters">{t('encounters')}</TabsTrigger>
        <TabsTrigger value="appointments">{t('appointments')}</TabsTrigger>
        <TabsTrigger value="documents">{t('documents')}</TabsTrigger>
        <TabsTrigger value="medical">{t('medical')}</TabsTrigger>
        <TabsTrigger value="consent">{t('consent')}</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">{overview}</TabsContent>
      <TabsContent value="encounters">{encounters}</TabsContent>
      <TabsContent value="appointments">{appointments}</TabsContent>
      <TabsContent value="documents">{documents}</TabsContent>
      <TabsContent value="medical">{medical}</TabsContent>
      <TabsContent value="consent">{consent}</TabsContent>
    </Tabs>
  );
}
