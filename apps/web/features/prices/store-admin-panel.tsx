'use client';

import { useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Pause, Play, RefreshCw } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Dash,
  Dialog,
  DialogContent,
  DialogFooter,
  Field,
  Table,
  TableWrapper,
  Td,
  Textarea,
  Th,
  Tr,
  useToast,
} from '@clinic/ui';
import { SHOP_STORE_STATUS_TONES } from '@clinic/domain';
import type { ShopFetchRun, ShopStore } from '@clinic/db/types';
import { useRouter } from '@clinic/i18n/navigation';
import { ExternalLink } from '@/components/external-link';
import { describeActionError } from '@/lib/action-error';
import { refreshStoreNow, setStoreStatus } from './actions';

export interface StoreStats {
  store_id: string;
  offers: number;
  available: number;
  products: number;
}

const KNOWN_CODES = ['timeout', 'network', 'robots_disallow', 'robots_unavailable', 'bad_json', 'no_adapter', 'no_category_urls'];

/**
 * The shops, for whoever runs the service: what state each is in, when it
 * was last read, what went wrong, and the three things an admin may do —
 * read a shop now, pause it, activate it. Activating a shop that is waiting
 * for its own permission asks for a note saying who agreed and when, and
 * keeps it beside the status.
 */
export function StoreAdminPanel({
  stores,
  stats,
  runs,
  canKnock,
}: {
  stores: ShopStore[];
  stats: StoreStats[];
  runs: ShopFetchRun[];
  /** Whether "read now" can start the reader at once, or only records a request. */
  canKnock: boolean;
}) {
  const t = useTranslations('prices.stores');
  const tc = useTranslations('common');
  const tAll = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ store: ShopStore; target: 'active' | 'paused' } | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const statsByStore = new Map(stats.map((row) => [row.store_id, row]));
  const nameOf = (id: string) => stores.find((store) => store.id === id)?.name ?? '—';
  const when = (iso: string | null) => (iso ? format.relativeTime(new Date(iso)) : null);
  const describeCode = (code: string) =>
    code.startsWith('http_')
      ? t('errorCodes.http', { code: code.slice(5) })
      : KNOWN_CODES.includes(code)
        ? t(`errorCodes.${code}` as never)
        : t('errorCodes.error');

  function refresh(store: ShopStore) {
    setBusyId(store.id);
    startTransition(async () => {
      const result = await refreshStoreNow({ storeId: store.id });
      setBusyId(null);
      if (!result.ok) {
        toast({ tone: 'danger', title: describeActionError(tAll, result.error.key) });
        return;
      }
      toast({ tone: 'success', title: result.data.started ? t('refreshStarted') : t('refreshRequested') });
      router.refresh();
    });
  }

  function openStatus(store: ShopStore, target: 'active' | 'paused') {
    setNote(store.status_note ?? '');
    setError(null);
    setDialog({ store, target });
  }

  function saveStatus() {
    if (!dialog) return;
    const needsNote = dialog.target === 'active' && dialog.store.status === 'awaiting_permission';
    if (needsNote && !note.trim()) {
      setError(t('noteRequired'));
      return;
    }
    setBusyId(dialog.store.id);
    startTransition(async () => {
      const result = await setStoreStatus({ storeId: dialog.store.id, status: dialog.target, note });
      setBusyId(null);
      if (!result.ok) {
        setError(describeActionError(tAll, result.error.key));
        return;
      }
      toast({ tone: 'success', title: t('statusSaved') });
      setDialog(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Alert tone="info">{t('permissionReminder')}</Alert>
      {!canKnock ? <Alert tone="warning">{t('noKnock')}</Alert> : null}

      <TableWrapper responsive>
        <Table>
          <thead>
            <tr>
              <Th>{t('columns.store')}</Th>
              <Th>{t('columns.status')}</Th>
              <Th>{t('columns.catalogue')}</Th>
              <Th>{t('columns.lastRead')}</Th>
              <Th>{t('columns.lastError')}</Th>
              <Th>{t('columns.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => {
              const stat = statsByStore.get(store.id);
              const running =
                store.last_started_at !== null &&
                (store.last_completed_at === null || Date.parse(store.last_completed_at) < Date.parse(store.last_started_at)) &&
                Date.now() - Date.parse(store.last_started_at) < 3 * 60_000;
              const busy = isPending && busyId === store.id;
              return (
                <Tr key={store.id}>
                  <Td data-card-title>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-ink-900">{store.name}</span>
                      <ExternalLink
                        href={store.base_url}
                        newTabLabel={tc('opensInNewTab')}
                        className="text-xs text-ink-600 underline-offset-2 hover:underline"
                        dir="ltr"
                      >
                        {store.base_url.replace(/^https?:\/\//, '')}
                      </ExternalLink>
                      <span className="text-xs text-ink-500">{t(`platform.${store.platform}`)}</span>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-1">
                      <span>
                        <Badge tone={SHOP_STORE_STATUS_TONES[store.status]}>{t(`status.${store.status}`)}</Badge>
                      </span>
                      {store.status_note ? <span className="text-xs text-ink-600">{store.status_note}</span> : null}
                    </div>
                  </Td>
                  <Td>{t('catalogue', { products: stat?.products ?? 0, available: stat?.available ?? 0 })}</Td>
                  <Td>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm">{when(store.last_success_at) ?? t('never')}</span>
                      {running ? (
                        <span>
                          <Badge tone="info">{t('inProgress')}</Badge>
                        </span>
                      ) : null}
                    </div>
                  </Td>
                  <Td>
                    {store.last_error ? (
                      <div className="flex flex-col gap-0.5 text-sm">
                        <span className="text-red-700">{describeCode(store.last_error)}</span>
                        <span className="text-xs text-ink-600">
                          {when(store.last_error_at)}
                          {store.consecutive_failures > 0 ? ` · ${t('failures', { count: store.consecutive_failures })}` : ''}
                        </span>
                      </div>
                    ) : (
                      <Dash label={tc('none')} />
                    )}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      {store.status === 'active' ? (
                        <>
                          <Button size="sm" variant="secondary" disabled={busy || running} onClick={() => refresh(store)}>
                            <RefreshCw className="h-4 w-4" aria-hidden />
                            {t('refresh')}
                          </Button>
                          <Button size="sm" variant="secondary" disabled={busy} onClick={() => openStatus(store, 'paused')}>
                            <Pause className="h-4 w-4" aria-hidden />
                            {t('pause')}
                          </Button>
                        </>
                      ) : null}
                      {store.status === 'paused' || store.status === 'awaiting_permission' ? (
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => openStatus(store, 'active')}>
                          <Play className="h-4 w-4" aria-hidden />
                          {t('activate')}
                        </Button>
                      ) : null}
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </TableWrapper>

      <section aria-labelledby="price-runs-title" className="space-y-3">
        <h2 id="price-runs-title" className="text-base font-semibold text-ink-900">
          {t('runs.title')}
        </h2>
        {runs.length === 0 ? (
          <p className="text-sm text-ink-600">{t('runs.empty')}</p>
        ) : (
          <TableWrapper responsive>
            <Table>
              <thead>
                <tr>
                  <Th>{t('runs.columns.when')}</Th>
                  <Th>{t('runs.columns.store')}</Th>
                  <Th>{t('runs.columns.trigger')}</Th>
                  <Th>{t('runs.columns.result')}</Th>
                  <Th>{t('runs.columns.pages')}</Th>
                  <Th>{t('runs.columns.fetched')}</Th>
                  <Th>{t('runs.columns.inScope')}</Th>
                  <Th>{t('runs.columns.newProducts')}</Th>
                  <Th>{t('runs.columns.newOffers')}</Th>
                  <Th>{t('runs.columns.changes')}</Th>
                  <Th>{t('runs.columns.gone')}</Th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <Tr key={run.id}>
                    <Td data-card-title>
                      {format.dateTime(new Date(run.started_at), { dateStyle: 'short', timeStyle: 'short' })}
                    </Td>
                    <Td>{nameOf(run.store_id)}</Td>
                    <Td>{t(`runs.trigger.${run.triggered_by}`)}</Td>
                    <Td>
                      {run.ok ? (
                        <Badge tone={run.partial ? 'info' : 'success'}>{t(run.partial ? 'runs.result.partial' : 'runs.result.complete')}</Badge>
                      ) : (
                        <span className="flex flex-col gap-0.5">
                          <Badge tone="danger">{t('runs.result.failed')}</Badge>
                          {run.error ? <span className="text-xs text-ink-600">{describeCode(run.error)}</span> : null}
                        </span>
                      )}
                    </Td>
                    <Td>{run.pages ?? <Dash />}</Td>
                    <Td>{run.fetched ?? <Dash />}</Td>
                    <Td>{run.in_scope ?? <Dash />}</Td>
                    <Td>{run.new_products ?? <Dash />}</Td>
                    <Td>{run.new_offers ?? <Dash />}</Td>
                    <Td>{run.price_changes ?? <Dash />}</Td>
                    <Td>{run.marked_unavailable ?? <Dash />}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrapper>
        )}
      </section>

      <Dialog open={dialog !== null} onOpenChange={(open) => (!open ? setDialog(null) : undefined)}>
        {dialog ? (
          <DialogContent title={t('noteTitle', { store: dialog.store.name })} closeLabel={tc('close')}>
            <div data-dialog-body className="space-y-3">
              {error ? <Alert tone="danger">{error}</Alert> : null}
              <Field
                label={t('noteLabel')}
                htmlFor="store-status-note"
                hint={t('noteHint')}
                required={dialog.target === 'active' && dialog.store.status === 'awaiting_permission'}
              >
                <Textarea
                  id="store-status-note"
                  rows={3}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  disabled={isPending}
                  data-autofocus
                />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setDialog(null)} disabled={isPending}>
                {tc('cancel')}
              </Button>
              <Button type="button" onClick={saveStatus} disabled={isPending}>
                {t(dialog.target === 'active' ? 'confirmActivate' : 'confirmPause')}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
