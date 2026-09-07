'use client';

import { useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { CreditCard, ExternalLink, Plus, Trash2, Wallet } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  LtrInput,
  Select,
  Spinner,
  Table,
  TableWrapper,
  Td,
  Th,
  Tr,
} from '@clinic/ui';
import { useRouter } from '@clinic/i18n/navigation';
import type { InvoiceWithDetails, PaymentMethod } from '@clinic/db/types';
import {
  cancelInvoice,
  createGrowPaymentLink,
  deleteInvoiceItem,
  recordManualPayment,
  upsertInvoiceItem,
} from './actions';

const MANUAL_METHODS: Exclude<PaymentMethod, 'card'>[] = ['cash', 'bank_transfer', 'bit', 'other'];

/**
 * Invoice editor.
 *
 * Lines are edited in place and each save recalculates the invoice total in the
 * database, not here — so the figure the patient is charged always comes from
 * one source rather than from whatever this screen last rendered.
 */
export function InvoiceEditor({ invoice }: { invoice: InvoiceWithDetails }) {
  const t = useTranslations('billing');
  const tc = useTranslations('common');
  const format = useFormatter();
  const router = useRouter();

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [newDescription, setNewDescription] = useState('');
  const [newQuantity, setNewQuantity] = useState('1');
  const [newPrice, setNewPrice] = useState('');

  const [manualAmount, setManualAmount] = useState('');
  const [manualMethod, setManualMethod] = useState<Exclude<PaymentMethod, 'card'>>('cash');

  const locked = invoice.status === 'cancelled';
  const outstanding = Number(invoice.total) - Number(invoice.amount_paid);

  function run(action: () => Promise<{ ok: boolean; error?: { key: string } }>) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(tc('errorGeneric'));
        return;
      }
      router.refresh();
    });
  }

  function handleAddLine() {
    const quantity = Number(newQuantity) || 1;
    const price = Number(newPrice) || 0;
    if (!newDescription.trim()) return;

    run(async () => {
      const result = await upsertInvoiceItem({
        invoiceId: invoice.id,
        description: newDescription,
        quantity,
        unitPrice: price,
        sequence: invoice.items.length,
      });
      if (result.ok) {
        setNewDescription('');
        setNewQuantity('1');
        setNewPrice('');
      }
      return result;
    });
  }

  function handleUpdatePrice(itemId: string, description: string, quantity: number, value: string) {
    run(() =>
      upsertInvoiceItem({
        id: itemId,
        invoiceId: invoice.id,
        description,
        quantity,
        unitPrice: Number(value) || 0,
      }),
    );
  }

  function handlePaymentLink() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await createGrowPaymentLink(invoice.id);
      if (!result.ok) {
        // Provider problems get their own message: "try again" is useless advice
        // when the real issue is a missing phone number or unfinished setup.
        const raw = result.error?.key ?? '';
        setError(
          raw.includes('serverError') ? t('errors.providerFailed') : t('errors.providerFailed'),
        );
        return;
      }
      router.refresh();
    });
  }

  function handleManualPayment() {
    const amount = Number(manualAmount);
    if (!(amount > 0)) return;
    run(async () => {
      const result = await recordManualPayment(invoice.id, amount, manualMethod);
      if (result.ok) setManualAmount('');
      return result;
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}

        <Card>
          <CardHeader>
            <CardTitle>{t('items')}</CardTitle>
            <Badge tone={invoice.status === 'paid' ? 'success' : 'neutral'}>
              {t(`status.${invoice.status}`)}
            </Badge>
          </CardHeader>
          <CardBody className="p-0">
            <TableWrapper className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>{t('description')}</Th>
                    <Th>{t('quantity')}</Th>
                    <Th>{t('unitPrice')}</Th>
                    <Th>{t('lineTotal')}</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <Tr key={item.id}>
                      <Td>{item.description}</Td>
                      <Td>
                        <span dir="ltr" className="tabular-nums">
                          {format.number(Number(item.quantity))}
                        </span>
                      </Td>
                      <Td>
                        <LtrInput
                          type="number"
                          min={0}
                          step="0.01"
                          defaultValue={Number(item.unit_price)}
                          disabled={locked || isPending}
                          onBlur={(event) =>
                            handleUpdatePrice(
                              item.id,
                              item.description,
                              Number(item.quantity),
                              event.target.value,
                            )
                          }
                          className="h-8 w-24"
                        />
                      </Td>
                      <Td>
                        <span dir="ltr" className="tabular-nums">
                          {format.number(Number(item.line_total), 'currency')}
                        </span>
                      </Td>
                      <Td className="text-end">
                        {!locked ? (
                          <button
                            type="button"
                            aria-label={tc('delete')}
                            disabled={isPending}
                            onClick={() => run(() => deleteInvoiceItem(item.id))}
                            className="rounded-md p-1.5 text-ink-500 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>

            {!locked ? (
              <div className="flex flex-wrap items-end gap-2 border-t border-ink-100 p-3">
                <Field label={t('description')} className="min-w-48 flex-1">
                  <Input
                    value={newDescription}
                    onChange={(event) => setNewDescription(event.target.value)}
                    disabled={isPending}
                  />
                </Field>
                <Field label={t('quantity')}>
                  <LtrInput
                    type="number"
                    min={0}
                    step="0.5"
                    className="w-20"
                    value={newQuantity}
                    onChange={(event) => setNewQuantity(event.target.value)}
                    disabled={isPending}
                  />
                </Field>
                <Field label={t('unitPrice')}>
                  <LtrInput
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-28"
                    value={newPrice}
                    onChange={(event) => setNewPrice(event.target.value)}
                    disabled={isPending}
                  />
                </Field>
                <Button variant="secondary" onClick={handleAddLine} disabled={isPending}>
                  <Plus className="h-4 w-4" />
                  {t('addItem')}
                </Button>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardBody>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">{t('subtotal')}</dt>
                <dd dir="ltr" className="tabular-nums">
                  {format.number(Number(invoice.subtotal), 'currency')}
                </dd>
              </div>
              <div className="flex justify-between border-t border-ink-100 pt-2 text-base font-semibold">
                <dt>{t('total')}</dt>
                <dd dir="ltr" className="tabular-nums">
                  {format.number(Number(invoice.total), 'currency')}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">{t('paid')}</dt>
                <dd dir="ltr" className="tabular-nums text-jade-700">
                  {format.number(Number(invoice.amount_paid), 'currency')}
                </dd>
              </div>
              <div className="flex justify-between font-medium">
                <dt>{t('outstanding')}</dt>
                <dd dir="ltr" className="tabular-nums">
                  {format.number(outstanding, 'currency')}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        {!locked ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('payment.title')}</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {invoice.payment_url ? (
                <Button asChild variant="secondary" className="w-full">
                  <a href={invoice.payment_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    {t('payment.openLink')}
                  </a>
                </Button>
              ) : null}

              <Button
                className="w-full"
                onClick={handlePaymentLink}
                disabled={isPending || !(outstanding > 0)}
              >
                {isPending ? <Spinner /> : <CreditCard className="h-4 w-4" />}
                {isPending ? t('payment.creatingLink') : t('payment.createLink')}
              </Button>

              <div className="space-y-2 border-t border-ink-100 pt-3">
                <p className="text-xs font-medium text-ink-600">{t('payment.recordManual')}</p>
                <div className="flex items-end gap-2">
                  <Field label={t('payment.amount')} className="flex-1">
                    <LtrInput
                      type="number"
                      min={0}
                      step="0.01"
                      value={manualAmount}
                      onChange={(event) => setManualAmount(event.target.value)}
                      disabled={isPending}
                    />
                  </Field>
                  <Field label={t('payment.method')}>
                    <Select
                      value={manualMethod}
                      onChange={(event) =>
                        setManualMethod(event.target.value as Exclude<PaymentMethod, 'card'>)
                      }
                      disabled={isPending}
                      className="w-32"
                    >
                      {MANUAL_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {t(`payment.methods.${method}`)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={handleManualPayment}
                  disabled={isPending}
                >
                  <Wallet className="h-4 w-4" />
                  {tc('save')}
                </Button>
              </div>
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t('payment.title')}</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {invoice.payments.length === 0 ? (
              <p className="px-4 py-5 text-center text-sm text-ink-500">{t('payment.empty')}</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {invoice.payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex items-center justify-between gap-2 px-4 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm text-ink-900" dir="ltr">
                        {format.number(Number(payment.amount), 'currency')}
                      </span>
                      <span className="block text-xs text-ink-500">
                        {t(`payment.methods.${payment.method}`)}
                      </span>
                    </span>
                    <Badge tone={payment.status === 'paid' ? 'success' : 'neutral'}>
                      {t(`payment.statuses.${payment.status}`)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {!locked ? (
          <Button
            variant="ghost"
            className="w-full text-red-600 hover:bg-red-50"
            disabled={isPending}
            onClick={() => {
              if (!window.confirm(t('cancelConfirm'))) return;
              run(() => cancelInvoice(invoice.id));
            }}
          >
            {t('cancel')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
