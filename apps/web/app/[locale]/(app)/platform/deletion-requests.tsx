'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, EmptyNote, Spinner, Table, TableWrapper, Td, Th, Tr, useConfirm, useToast } from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import { formatDateTime } from '@clinic/i18n';
import { resolveDeletionRequest } from './actions';

export interface DeletionRequestRow {
  id: string;
  requested_at: string;
  kind: 'staff' | 'patient';
  blocker: 'clinic_has_records' | 'clinic_needs_owner' | null;
  email: string | null;
  clinic_name: string | null;
  reason: string | null;
}

/**
 * The deletion requests the database refused and kept: a clinic's only
 * owner asking to go. Handled by hand — a call, a handover, a closure —
 * and then marked done here, which also drops the address from the row.
 */
export function DeletionRequests({ rows }: { rows: DeletionRequestRow[] }) {
  const t = useTranslations('platform.deletions');
  const tc = useTranslations('common');
  const confirm = useConfirm();
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function resolve(row: DeletionRequestRow) {
    const ok = await confirm({ title: t('resolveTitle'), body: t('resolveBody'), confirmLabel: t('resolve') });
    if (!ok) return;
    setPendingId(row.id);
    startTransition(async () => {
      const result = await resolveDeletionRequest(row.id, '');
      setPendingId(null);
      if (!result.ok) {
        toast({ tone: 'danger', title: tc('errorGeneric') });
        return;
      }
      toast({ tone: 'success', title: t('resolved') });
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardBody>
        <p className="mb-3 text-sm text-ink-600">{t('subtitle')}</p>
        {rows.length === 0 ? (
          <EmptyNote>{t('empty')}</EmptyNote>
        ) : (
          <TableWrapper responsive inset>
            <Table>
              <thead>
                <tr>
                  <Th>{t('requested')}</Th>
                  <Th>{t('who')}</Th>
                  <Th>{t('clinic')}</Th>
                  <Th>{t('why')}</Th>
                  <Th>
                    <span className="sr-only">{tc('actions')}</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Tr key={row.id}>
                    <Td data-card-title>
                      <span dir="ltr">{formatDateTime(row.requested_at)}</span>
                    </Td>
                    <Td>
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">{t(`kind.${row.kind}`)}</Badge>
                        {row.email ? <span dir="ltr">{row.email}</span> : null}
                      </span>
                    </Td>
                    <Td>
                      <span dir="auto">{row.clinic_name ?? '—'}</span>
                    </Td>
                    <Td>
                      <span className="block">{row.blocker ? t(`blocker.${row.blocker}`) : '—'}</span>
                      {row.reason ? <span className="block text-xs text-ink-600">{row.reason}</span> : null}
                    </Td>
                    <Td>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={isPending && pendingId === row.id}
                        onClick={() => resolve(row)}
                        aria-label={`${t('resolve')}: ${row.email ?? row.clinic_name ?? ''}`}
                      >
                        {isPending && pendingId === row.id ? <Spinner /> : <Check className="h-4 w-4" aria-hidden />}
                        {t('resolve')}
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrapper>
        )}
      </CardBody>
    </Card>
  );
}
