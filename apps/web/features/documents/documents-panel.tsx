'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Download, FileText, Trash2, Upload } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  EmptyState,
  Field,
  FieldGrid,
  Select,
  SortBody,
  SortTh,
  SortableTable,
  Spinner,
  TableWrapper,
  Td,
  Th,
  Tr,
} from '@clinic/ui';
import { DOCUMENT_CATEGORIES, type Locale } from '@clinic/domain';
import { useRouter } from '@clinic/i18n/navigation';
import type { PatientDocument } from '@clinic/db/types';
import { deleteDocument, setDocumentShared, uploadDocument } from './actions';
import { formatDate } from '@clinic/i18n';

/** Human-readable file size, e.g. "1.4 MB". Locale-formatted so digits read correctly in both languages. */
function useFormatSize() {
  const format = useFormatter();
  return (bytes: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${format.number(kb, { maximumFractionDigits: 0 })} KB`;
    return `${format.number(kb / 1024, { maximumFractionDigits: 1 })} MB`;
  };
}

function UploadForm({ patientId, onUploaded }: { patientId: string; onUploaded: () => void }) {
  const t = useTranslations('documents');
  const tc = useTranslations('common');
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      setError(t('fileRequired'));
      return;
    }

    startTransition(async () => {
      const result = await uploadDocument(patientId, formData);
      if (!result.ok) {
        setError(t('uploadError'));
        return;
      }
      formRef.current?.reset();
      onUploaded();
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <FieldGrid columns={3}>
        <Field label={tc('name')} htmlFor="doc_file" required className="sm:col-span-2">
          <input
            id="doc_file"
            name="file"
            type="file"
            required
            disabled={isPending}
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.heic,.txt"
            className="block w-full text-sm text-ink-700 file:me-3 file:rounded-lg file:border-0 file:bg-jade-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-jade-800 hover:file:bg-jade-100"
          />
        </Field>

        <Field label={t('fields.category')} htmlFor="doc_category">
          <Select id="doc_category" name="category" defaultValue="other" disabled={isPending}>
            {DOCUMENT_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {t(`categories.${value}`)}
              </option>
            ))}
          </Select>
        </Field>
      </FieldGrid>

      <label className="flex items-center gap-2 text-sm text-ink-700">
        <Checkbox name="shared_with_patient" disabled={isPending} />
        {t('fields.sharedWithPatient')}
      </label>
      <p className="text-xs text-ink-500">{t('sharedWithPatientHint')}</p>

      <Button type="submit" disabled={isPending}>
        {isPending ? <Spinner /> : <Upload className="h-4 w-4" />}
        {isPending ? t('uploading') : t('upload')}
      </Button>
    </form>
  );
}

export function DocumentsPanel({
  patientId,
  documents,
}: {
  patientId: string;
  documents: PatientDocument[];
}) {
  const t = useTranslations('documents');
  const tc = useTranslations('common');
  const locale = useLocale() as Locale;
  const format = useFormatter();
  const formatSize = useFormatSize();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [listError, setListError] = useState(false);

  function refresh() {
    router.refresh();
  }

  function handleToggleShared(document: PatientDocument) {
    setListError(false);
    setPendingId(document.id);
    startTransition(async () => {
      const result = await setDocumentShared(document.id, !document.shared_with_patient);
      setPendingId(null);
      if (!result.ok) {
        setListError(true);
        return;
      }
      refresh();
    });
  }

  function handleDelete(document: PatientDocument) {
    if (!window.confirm(t('deleteConfirm'))) return;
    setListError(false);
    setPendingId(document.id);
    startTransition(async () => {
      const result = await deleteDocument(document.id);
      setPendingId(null);
      if (!result.ok) {
        setListError(true);
        return;
      }
      refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <UploadForm patientId={patientId} onUploaded={refresh} />
        </CardBody>
      </Card>

      {listError ? <Alert tone="danger">{tc('errorGeneric')}</Alert> : null}

      {documents.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title={t('empty')}
          description={t('emptyBody')}
        />
      ) : (
        <TableWrapper>
          <SortableTable defaultSortKey="uploaded" defaultSortDirection="desc">
            <thead>
              <tr>
                <SortTh sortKey="name">{tc('name')}</SortTh>
                <SortTh sortKey="category">{t('fields.category')}</SortTh>
                <SortTh sortKey="uploaded">{t('uploadedAt')}</SortTh>
                <SortTh sortKey="shared">{tc('status')}</SortTh>
                <Th>{tc('actions')}</Th>
              </tr>
            </thead>
            <SortBody locale={locale}>
              {documents.map((document) => {
                const isRowPending = isPending && pendingId === document.id;
                return (
                  <Tr
                    key={document.id}
                    sort={{
                      name: document.file_name,
                      category: t(`categories.${document.category}`),
                      uploaded: new Date(document.created_at).getTime(),
                      shared: document.shared_with_patient,
                    }}
                  >
                    <Td>
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
                        <span className="min-w-0">
                          <span className="block max-w-56 truncate text-ink-900">
                            {document.file_name}
                          </span>
                          <span className="block text-xs text-ink-500">
                            {formatSize(document.size_bytes)}
                          </span>
                        </span>
                      </span>
                    </Td>
                    <Td>{t(`categories.${document.category}`)}</Td>
                    <Td>
                      <span dir="ltr" className="tabular-nums">
                        {formatDate(new Date(document.created_at))}
                      </span>
                    </Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => handleToggleShared(document)}
                        disabled={isRowPending}
                        className="disabled:opacity-50"
                        title={t('sharedWithPatientHint')}
                      >
                        <Badge tone={document.shared_with_patient ? 'success' : 'muted'}>
                          {document.shared_with_patient ? t('shared') : t('private')}
                        </Badge>
                      </button>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" asChild disabled={isRowPending}>
                          <a href={`/api/documents/${document.id}`} title={t('download')}>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(document)}
                          disabled={isRowPending}
                          className="text-red-600 hover:bg-red-50"
                          title={t('delete')}
                        >
                          {isRowPending ? <Spinner /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </SortBody>
          </SortableTable>
        </TableWrapper>
      )}
    </div>
  );
}
