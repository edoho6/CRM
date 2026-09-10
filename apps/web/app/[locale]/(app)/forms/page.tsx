import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ClipboardList, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  SortBody,
  SortTh,
  SortableTable,
  TableWrapper,
  Td,
  Tr,
} from '@clinic/ui';
import { Link } from '@clinic/i18n/navigation';
import type { FormTemplate } from '@clinic/db/types';
import { PageHeader } from '@/components/app-shell';
import { getClinicScope } from '@/lib/session';
import { formatDate } from '@clinic/i18n';

/**
 * The questionnaires this practice has built.
 *
 * Retired forms are listed alongside the active ones rather than hidden: a form
 * is retired the moment it has been filled in and is no longer wanted, and its
 * submissions are still read through it.
 */
export default async function FormsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('forms');
  const tc = await getTranslations('common');

  const scope = await getClinicScope();
  if (!scope) return null;

  const { data } = await scope.supabase
    .from('form_templates')
    .select('*')
    .order('is_active', { ascending: false })
    .order('title', { ascending: true })
    .returns<FormTemplate[]>();

  const templates = data ?? [];

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          <Button asChild>
            <Link href="/forms/new">
              <Plus className="h-4 w-4" />
              {t('newForm')}
            </Link>
          </Button>
        }
      />

      {templates.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title={t('empty')}
          description={t('emptyBody')}
          action={
            <Button asChild size="sm">
              <Link href="/forms/new">{t('newForm')}</Link>
            </Button>
          }
        />
      ) : (
        <TableWrapper responsive>
          <SortableTable defaultSortKey="title">
            <thead>
              <tr>
                <SortTh sortKey="title">{t('formTitle')}</SortTh>
                <SortTh sortKey="questions">{t('questionCount')}</SortTh>
                <SortTh sortKey="version">{t('version')}</SortTh>
                <SortTh sortKey="status">{tc('status')}</SortTh>
                <SortTh sortKey="updated">{tc('updatedAt')}</SortTh>
              </tr>
            </thead>
            <SortBody locale={locale}>
              {templates.map((template) => {
                // Sections are not questions; counting them would overstate how
                // long the form is to fill in.
                const questions = template.fields.filter(
                  (field) => field.type !== 'section',
                ).length;
                return (
                  <Tr
                    key={template.id}
                    sort={{
                      title: template.title,
                      questions,
                      version: template.version,
                      status: template.is_active ? 0 : 1,
                      updated: new Date(template.updated_at).getTime(),
                    }}
                  >
                    <Td data-card-title>
                      <Link
                        href={`/forms/${template.id}`}
                        className="font-medium text-jade-800 underline-offset-2 hover:underline"
                      >
                        {template.title}
                      </Link>
                      {template.description ? (
                        <span className="block text-xs text-ink-600">{template.description}</span>
                      ) : null}
                    </Td>
                    <Td>
                      <span dir="ltr" className="tabular-nums">
                        {questions}
                      </span>
                    </Td>
                    <Td>
                      <span dir="ltr" className="tabular-nums text-ink-600">
                        {template.version}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={template.is_active ? 'success' : 'muted'}>
                        {template.is_active ? tc('active') : tc('inactive')}
                      </Badge>
                    </Td>
                    <Td>
                      <span dir="ltr" className="tabular-nums text-ink-600">
                        {formatDate(new Date(template.updated_at))}
                      </span>
                    </Td>
                  </Tr>
                );
              })}
            </SortBody>
          </SortableTable>
        </TableWrapper>
      )}
    </>
  );
}
