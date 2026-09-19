'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Field,
  FormActionBar,
  Input,
  LtrInput,
  Spinner,
  Textarea,
  cn,
} from '@clinic/ui';
import type { Locale } from '@clinic/domain';
import { useRouter } from '@clinic/i18n/navigation';
import { formatTime } from '@clinic/i18n';
import { addDaysIn, dateKeyIn } from '@clinic/domain';
import { fetchSlots, sendBookingCode, submitBooking, type BookingError } from '../actions';

export interface BookingClinic {
  id: string;
  name: string;
  intro: string | null;
  address: string | null;
  phone: string | null;
  locale: Locale;
  timezone: string;
  lead_hours: number;
  horizon_days: number;
  verify_sms: boolean;
}

export interface BookingType {
  id: string;
  name_he: string;
  name_en: string;
  minutes: number;
  price: number | null;
}

export interface BookingPractitioner {
  id: string;
  name: string | null;
}

export interface BookingLocation {
  id: string;
  name: string;
  address: string | null;
}

/**
 * Three screens on a phone: what, when, who.
 *
 * Each choice is a big tap target and the next screen follows at once; there
 * is no "next" button between what and when because choosing the treatment
 * *is* the next. The days are a row of chips, the hours a grid; a day with
 * nothing free says so rather than showing an empty grid. The details form
 * is the last thing, because a person will give their number once they can
 * see the hour is theirs.
 */
export function BookingFlow({
  slug,
  clinic,
  types,
  practitioners,
  locations,
}: {
  slug: string;
  clinic: BookingClinic;
  types: BookingType[];
  practitioners: BookingPractitioner[];
  locations: BookingLocation[];
}) {
  const t = useTranslations('booking');
  const locale = useLocale() as Locale;
  const format = useFormatter();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [typeId, setTypeId] = useState<string | null>(types.length === 1 ? types[0]!.id : null);
  const [practitionerId, setPractitionerId] = useState<string | null>(
    practitioners.length === 1 ? practitioners[0]!.id : null,
  );
  const [locationId, setLocationId] = useState<string | null>(
    locations.length === 1 ? locations[0]!.id : null,
  );
  const [day, setDay] = useState<string>(() => dateKeyIn(new Date(), clinic.timezone));
  // The free hours, kept with the question they answer: a grid for another day
  // or treatment is not shown under this one's name, and reads as "loading".
  const slotsKey = `${typeId}|${practitionerId}|${day}`;
  const [fetchedSlots, setFetchedSlots] = useState<{ key: string; slots: string[] } | null>(null);
  const slots = fetchedSlots?.key === slotsKey ? fetchedSlots.slots : null;
  const [startAt, setStartAt] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  // Seconds until the code may be sent again: a second tap right after the
  // first sent two messages and, on some networks, two different codes.
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState<BookingError | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const typeName = (type: BookingType) =>
    (locale === 'he' ? type.name_he : type.name_en).trim() || type.name_en || type.name_he;

  const step: 'what' | 'when' | 'who' =
    !typeId || !practitionerId || (locations.length > 1 && !locationId)
      ? 'what'
      : !startAt
        ? 'when'
        : 'who';

  const days = useMemo(() => {
    const now = new Date();
    return Array.from({ length: Math.min(clinic.horizon_days, 21) }, (_, index) =>
      addDaysIn(now, index, clinic.timezone),
    );
  }, [clinic.horizon_days, clinic.timezone]);

  // The free hours of the chosen day, fetched when the day or the treatment
  // changes. Until they arrive the grid reads as loading (the key above).
  useEffect(() => {
    if (step === 'what' || !typeId || !practitionerId) return;
    let cancelled = false;
    const key = `${typeId}|${practitionerId}|${day}`;
    void fetchSlots(slug, typeId, practitionerId, day)
      .then((result) => {
        if (!cancelled) setFetchedSlots({ key, slots: result });
      })
      .catch(() => {
        // An empty grid with a message, not a spinner that never stops.
        if (cancelled) return;
        setFetchedSlots({ key, slots: [] });
        setError('generic');
      });
    return () => {
      cancelled = true;
    };
  }, [slug, typeId, practitionerId, day, step]);

  function requestCode() {
    setError(null);
    startTransition(async () => {
      const result = await sendBookingCode(slug, phone);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCodeSent(true);
      setResendIn(60);
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!typeId || !practitionerId || !startAt) return;
    setError(null);
    startTransition(async () => {
      const result = await submitBooking({
        slug,
        typeId,
        practitionerId,
        locationId,
        startAt,
        firstName,
        lastName,
        phone,
        email,
        note,
        code,
      });
      if (!result.ok) {
        setError(result.error);
        // The hour went to someone else: back to the grid, freshly loaded.
        if (result.error === 'slot_taken') {
          setStartAt(null);
          setFetchedSlots(null);
          void fetchSlots(slug, typeId, practitionerId, day)
            .then((fresh) => setFetchedSlots({ key: slotsKey, slots: fresh }))
            .catch(() => setFetchedSlots({ key: slotsKey, slots: [] }));
        }
        return;
      }
      router.push(`/confirm/${result.token}?booked=1`);
    });
  }

  const Back = locale === 'he' ? ArrowRight : ArrowLeft;
  const hadChoice = types.length > 1 || practitioners.length > 1 || locations.length > 1;
  const STEPS = ['what', 'when', 'who'] as const;
  // Where there was nothing to choose, "what" was never a screen.
  const visibleSteps = hadChoice ? STEPS : STEPS.slice(1);
  const stepIndex = visibleSteps.indexOf(step);

  return (
    <div className="space-y-4">
      {/* Where you are, said in words for a screen reader and drawn as a
          bar for everyone else. */}
      {visibleSteps.length > 1 ? (
        <div className="space-y-1.5">
          <p className="flex items-center justify-between text-xs text-ink-600">
            <span>{t('stepOf', { step: stepIndex + 1, total: visibleSteps.length })}</span>
            <span className="font-medium text-ink-800">{t(`steps.${step}`)}</span>
          </p>
          <div
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={visibleSteps.length}
            aria-valuenow={stepIndex + 1}
            aria-label={t('stepOf', { step: stepIndex + 1, total: visibleSteps.length })}
            aria-valuetext={t('stepOf', { step: stepIndex + 1, total: visibleSteps.length })}
            className="flex gap-1"
          >
            {visibleSteps.map((name, index) => (
              <span
                key={name}
                className={cn(
                  'h-1.5 flex-1 rounded-full',
                  index <= stepIndex ? 'bg-jade-600' : 'bg-ink-200',
                )}
              />
            ))}
          </div>
        </div>
      ) : null}
      {error && step !== 'who' ? <Alert tone="danger">{t(`errors.${error}`)}</Alert> : null}

      {step === 'what' ? (
        <div className="space-y-4">
          {!typeId ? (
            <section aria-labelledby="book-what">
              <h2 id="book-what" className="mb-2 text-sm font-semibold text-ink-900">
                {t('chooseTreatment')}
              </h2>
              {types.length === 0 ? (
                <p className="text-sm text-ink-600">{t('noTreatments')}</p>
              ) : (
                <ul className="space-y-2">
                  {types.map((type) => (
                    <li key={type.id}>
                      <button
                        type="button"
                        onClick={() => setTypeId(type.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg border border-ink-200 bg-white px-4 py-3 text-start hover:border-jade-500 hover:bg-jade-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                      >
                        <span className="text-base font-medium text-ink-900">{typeName(type)}</span>
                        <span className="shrink-0 text-sm text-ink-600">
                          {t('minutes', { count: type.minutes })}
                          {type.price !== null ? ` · ${format.number(type.price, 'currency')}` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {typeId && !practitionerId ? (
            <section aria-labelledby="book-who">
              <h2 id="book-who" className="mb-2 text-sm font-semibold text-ink-900">
                {t('choosePractitioner')}
              </h2>
              <ul className="space-y-2">
                {practitioners.map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      onClick={() => setPractitionerId(person.id)}
                      className="w-full rounded-lg border border-ink-200 bg-white px-4 py-3 text-start text-base font-medium text-ink-900 hover:border-jade-500 hover:bg-jade-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      {person.name ?? t('practitioner')}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {typeId && practitionerId && locations.length > 1 && !locationId ? (
            <section aria-labelledby="book-where">
              <h2 id="book-where" className="mb-2 text-sm font-semibold text-ink-900">
                {t('chooseLocation')}
              </h2>
              <ul className="space-y-2">
                {locations.map((place) => (
                  <li key={place.id}>
                    <button
                      type="button"
                      onClick={() => setLocationId(place.id)}
                      className="w-full rounded-lg border border-ink-200 bg-white px-4 py-3 text-start hover:border-jade-500 hover:bg-jade-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      <span className="block text-base font-medium text-ink-900">{place.name}</span>
                      {place.address ? (
                        <span className="block text-sm text-ink-600" dir="auto">
                          {place.address}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {step === 'when' ? (
        <section aria-labelledby="book-when" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id="book-when" className="text-sm font-semibold text-ink-900">
              {t('chooseTime')}
            </h2>
            {/* Only when the first screen was a screen: with one treatment
                and one practitioner there is nothing to go back to. */}
            {hadChoice ? (
              <button
                type="button"
                onClick={() => {
                  setTypeId(types.length === 1 ? typeId : null);
                  setPractitionerId(practitioners.length === 1 ? practitionerId : null);
                  setLocationId(locations.length === 1 ? locationId : null);
                }}
                className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm text-ink-600 hover:bg-ink-100 hover:text-ink-900"
              >
                <Back className="h-4 w-4" aria-hidden />
                {t('back')}
              </button>
            ) : null}
          </div>

          {/* A row of days, not a tablist: nothing switches panels, one is
              pressed. It scrolls sideways inside itself — with the browser's
              own swipe-back gesture kept out of it — and snaps to a day. */}
          <div
            className="flex snap-x gap-1.5 overflow-x-auto overscroll-x-contain pb-1"
            role="group"
            aria-label={t('day')}
          >
            {days.map((candidate) => {
              const key = dateKeyIn(candidate, clinic.timezone);
              const selected = key === day;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setDay(key)}
                  className={cn(
                    'flex min-h-11 shrink-0 snap-start flex-col items-center rounded-lg border px-3 py-1.5 text-sm transition-colors active:scale-[0.98]',
                    selected
                      ? 'border-accent bg-accent text-accent-fg'
                      : 'border-ink-200 bg-white text-ink-800 hover:bg-ink-50',
                  )}
                >
                  <span className="text-xs">
                    {format.dateTime(candidate, { weekday: 'short' })}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {format.dateTime(candidate, { day: 'numeric', month: 'numeric' })}
                  </span>
                </button>
              );
            })}
          </div>

          {slots === null ? (
            <p className="flex items-center gap-2 py-6 text-sm text-ink-600">
              <Spinner /> {t('loadingSlots')}
            </p>
          ) : slots.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-600">{t('noSlots')}</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((slot) => (
                <li key={slot}>
                  <button
                    type="button"
                    onClick={() => setStartAt(slot)}
                    className="w-full min-h-11 rounded-lg border border-ink-200 bg-white py-3 text-base font-medium tabular-nums text-ink-900 transition-colors hover:border-jade-500 hover:bg-jade-50 active:bg-jade-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    dir="ltr"
                  >
                    {formatTime(new Date(slot))}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {step === 'who' && startAt ? (
        <form onSubmit={submit} className="space-y-4">
          <Card>
            <CardBody className="flex items-center justify-between gap-3 text-sm">
              <span className="text-ink-800">
                <span className="block font-medium">
                  {typeName(types.find((type) => type.id === typeId)!)}
                </span>
                <span className="tabular-nums">
                  {format.dateTime(new Date(startAt), 'weekday')} · {formatTime(new Date(startAt))}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setStartAt(null)}
                className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-600 underline-offset-2 hover:underline"
              >
                <Back className="h-3.5 w-3.5" aria-hidden />
                {t('changeTime')}
              </button>
            </CardBody>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('firstName')} htmlFor="first_name" required>
              <Input
                id="first_name"
                value={firstName}
                autoComplete="given-name"
                required
                onChange={(event) => setFirstName(event.target.value)}
              />
            </Field>
            <Field label={t('lastName')} htmlFor="last_name">
              <Input
                id="last_name"
                value={lastName}
                autoComplete="family-name"
                onChange={(event) => setLastName(event.target.value)}
              />
            </Field>
          </div>
          <Field label={t('phone')} htmlFor="phone" required hint={t('phoneHint')}>
            <LtrInput
              id="phone"
              type="tel"
              value={phone}
              autoComplete="tel"
              required
              onChange={(event) => setPhone(event.target.value)}
            />
          </Field>
          <Field label={t('email')} htmlFor="email">
            <LtrInput
              id="email"
              type="email"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field label={t('note')} htmlFor="note">
            <Textarea
              id="note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>

          {clinic.verify_sms ? (
            <div className="space-y-2 rounded-lg border border-ink-200 p-3">
              <p className="text-sm text-ink-700">{t('verifyIntro')}</p>
              <div className="flex flex-wrap items-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isPending || resendIn > 0 || phone.replace(/\D/g, '').length < 8}
                  onClick={requestCode}
                >
                  {codeSent
                    ? resendIn > 0
                      ? t('resendIn', { seconds: resendIn })
                      : t('resendCode')
                    : t('sendCode')}
                </Button>
                {codeSent ? (
                  <Field label={t('code')} htmlFor="code" required density="compact">
                    <LtrInput
                      id="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      className="w-32 tracking-widest"
                      value={code}
                      required
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                    />
                  </Field>
                ) : null}
              </div>
            </div>
          ) : null}

          <p className="text-center text-xs text-ink-500">{t('privacy')}</p>
          {/* Stuck to the foot of the window, so the one button that matters
              is never a screen of fields away; a failure is said right
              beside it, where the eye is when it happens. */}
          <FormActionBar
            className="-mx-4 sm:-mx-6 xl:mx-0"
            status={
              error ? (
                <span role="alert" className="font-medium text-red-700">
                  {t(`errors.${error}`)}
                </span>
              ) : undefined
            }
          >
            <Button
              type="submit"
              size="lg"
              className="w-full sm:w-auto"
              disabled={isPending || (clinic.verify_sms && code.length < 6)}
            >
              {isPending ? <Spinner /> : <Check className="h-5 w-5" aria-hidden />}
              {t('book')}
            </Button>
          </FormActionBar>
        </form>
      ) : null}
    </div>
  );
}
