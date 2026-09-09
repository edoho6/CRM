'use client';

import { useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { CreditCard, Minus, Plus, Trash2, Undo2 } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  FieldGrid,
  Input,
  LtrInput,
  Spinner,
  TIME_INPUT_LANG,
  useConfirm,
  useToast,
} from '@clinic/ui';
import { cn } from '@clinic/ui/cn';
import { useRouter } from '@clinic/i18n/navigation';
import type { PackageBalance, PackageRedemption } from '@clinic/db/types';
import {
  createPackage,
  deletePackage,
  redeemSession,
  undoRedemption,
} from './package-actions';
import { formatDate } from '@clinic/i18n';

/**
 * Punch cards, on the patient's file.
 *
 * "Ten treatments for ₪3,000" is how a large share of Israeli practices sell,
 * and there was nowhere to record it: every visit was billed as if it were the
 * first, and how many were left lived on a paper card in a drawer.
 *
 * The balance comes from the `package_balances` view rather than being counted
 * here, so this screen and the database can never disagree about how many are
 * left — and the database is what refuses the eleventh.
 */
export function PackagesPanel({
  patientId,
  balances,
  redemptions,
}: {
  patientId: string;
  balances: PackageBalance[];
  /** All redemptions across this patient's cards, newest first. */
  redemptions: PackageRedemption[];
}) {
  const t = useTranslations('packages');
  const tc = useTranslations('common');
  const format = useFormatter();
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [isPending, startTransition] = useTransition();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState('');
  const [sessions, setSessions] = useState('10');
  const [price, setPrice] = useState('');
  const [purchased, setPurchased] = useState(today);
  const [expires, setExpires] = useState('');

  function renderError() {
    if (!errorKey) return null;
    if (errorKey.endsWith('package_exhausted')) return t('exhausted');
    if (errorKey.endsWith('already_redeemed')) return t('alreadyRedeemed');
    return tc('errorGeneric');
  }

  function add() {
    if (!name.trim()) return;
    setErrorKey(null);
    startTransition(async () => {
      const result = await createPackage({
        patient_id: patientId,
        name,
        total_sessions: sessions,
        price: price === '' ? null : price,
        purchased_on: purchased,
        expires_on: expires,
        notes: '',
        is_active: true,
      });
      if (!result.ok) {
        setErrorKey(result.error.key);
        return;
      }
      setAdding(false);
      setName('');
      setPrice('');
      setExpires('');
      router.refresh();
    });
  }

  function redeem(packageId: string) {
    setErrorKey(null);
    startTransition(async () => {
      const result = await redeemSession({
        package_id: packageId,
        encounter_id: null,
        redeemed_on: today,
        notes: '',
      });
      if (!result.ok) {
        setErrorKey(result.error.key);
        return;
      }
      toast({ tone: 'success', title: t('redeemed') });
      router.refresh();
    });
  }

  const money = (value: number) => format.number(value, 'currency');

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-ink-600" aria-hidden />
            {t('title')}
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {errorKey ? <Alert tone="danger">{renderError()}</Alert> : null}

        {balances.length === 0 ? (
          <p className="text-sm text-ink-600">{t('none')}</p>
        ) : (
          <ul className="space-y-3">
            {balances.map((balance) => {
              const empty = balance.remaining_sessions <= 0;
              const cardRedemptions = redemptions.filter(
                (entry) => entry.package_id === balance.package_id,
              );
              return (
                <li
                  key={balance.package_id}
                  className={cn(
                    'rounded-lg border p-3',
                    empty || balance.is_expired
                      ? 'border-ink-200 bg-ink-50'
                      : 'border-ink-200 bg-white',
                  )}
                >
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-ink-900" dir="auto">
                          {balance.name}
                        </h3>
                        {/* Both states say so in words. A grey card and a white
                            card are the same card to anyone not comparing. */}
                        {empty ? <Badge tone="neutral">{t('usedUp')}</Badge> : null}
                        {balance.is_expired ? <Badge tone="warning">{t('expired')}</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-sm text-ink-700">
                        {t('remaining', {
                          remaining: balance.remaining_sessions,
                          total: balance.total_sessions,
                        })}
                        {balance.price !== null ? ` · ${money(Number(balance.price))}` : ''}
                      </p>
                      <p className="text-xs text-ink-600" dir="ltr">
                        {formatDate(new Date(balance.purchased_on))}
                        {balance.expires_on
                          ? ` – ${formatDate(new Date(balance.expires_on))}`
                          : ''}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={isPending || empty}
                        onClick={() => redeem(balance.package_id)}
                      >
                        {isPending ? <Spinner className="h-3.5 w-3.5" /> : <Minus className="h-4 w-4" />}
                        {t('redeem')}
                      </Button>
                      <button
                        type="button"
                        aria-label={tc('delete')}
                        disabled={isPending}
                        onClick={async () => {
                          const confirmed = await confirm({
                            title: tc('deleteConfirmTitle'),
                            body: tc('deleteConfirmBody'),
                            confirmLabel: tc('delete'),
                            destructive: true,
                          });
                          if (!confirmed) return;
                          setErrorKey(null);
                          startTransition(async () => {
                            const result = await deletePackage(balance.package_id);
                            if (!result.ok) {
                              setErrorKey(result.error.key);
                              return;
                            }
                            toast({ tone: 'success', title: t('deleted') });
                            router.refresh();
                          });
                        }}
                        className="rounded-md p-2 text-ink-500 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* The dates, which are the thing a health fund asks for. */}
                  {cardRedemptions.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-1.5 border-t border-ink-100 pt-2">
                      {cardRedemptions.map((entry) => (
                        <li key={entry.id}>
                          <span className="inline-flex items-center gap-1 rounded-md border border-ink-200 bg-ink-50 py-0.5 ps-2 pe-0.5 text-xs">
                            <span dir="ltr" className="tabular-nums">
                              {formatDate(new Date(entry.redeemed_on))}
                            </span>
                            <button
                              type="button"
                              aria-label={t('undo')}
                              title={t('undo')}
                              disabled={isPending}
                              onClick={() =>
                                startTransition(async () => {
                                  const result = await undoRedemption(entry.id);
                                  if (!result.ok) {
                                    setErrorKey(result.error.key);
                                    return;
                                  }
                                  toast({ tone: 'success', title: t('undone') });
                                  router.refresh();
                                })
                              }
                              className="rounded p-0.5 text-ink-500 hover:bg-ink-200 hover:text-ink-900"
                            >
                              <Undo2 className="h-3 w-3" />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {adding ? (
          <div className="space-y-3 border-t border-ink-100 pt-3">
            <FieldGrid>
              <Field label={t('name')} htmlFor="package_name" required>
                <Input
                  id="package_name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t('namePlaceholder')}
                />
              </Field>
              <Field label={t('sessions')} htmlFor="package_sessions" required>
                <LtrInput
                  id="package_sessions"
                  type="number"
                  min={1}
                  max={200}
                  value={sessions}
                  onChange={(event) => setSessions(event.target.value)}
                />
              </Field>
              <Field label={t('price')} htmlFor="package_price">
                <LtrInput
                  id="package_price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                />
              </Field>
              <Field label={t('purchasedOn')} htmlFor="package_purchased">
                <LtrInput
                  id="package_purchased"
                  type="date"
                  lang={TIME_INPUT_LANG}
                  value={purchased}
                  onChange={(event) => setPurchased(event.target.value)}
                />
              </Field>
              <Field label={t('expiresOn')} htmlFor="package_expires" hint={t('expiresHint')}>
                <LtrInput
                  id="package_expires"
                  type="date"
                  lang={TIME_INPUT_LANG}
                  value={expires}
                  onChange={(event) => setExpires(event.target.value)}
                />
              </Field>
            </FieldGrid>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setAdding(false)}
                disabled={isPending}
              >
                {tc('cancel')}
              </Button>
              <Button type="button" onClick={add} disabled={isPending || !name.trim()}>
                {isPending ? <Spinner /> : null}
                {tc('save')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-t border-ink-100 pt-3">
            <Button type="button" variant="secondary" size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" />
              {t('add')}
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
