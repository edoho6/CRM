'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageCircle, Phone } from 'lucide-react';

/**
 * A phone number that offers to call or to open WhatsApp.
 *
 * Clicking the number opens a small popover rather than dialling straight away.
 * On a desktop, `tel:` usually does nothing useful, and the thing actually wanted
 * nine times out of ten is WhatsApp — so both are offered and neither is guessed.
 *
 * The number itself stays `dir="ltr"` inside a Hebrew page. Israeli numbers
 * written right-to-left read as a different number, which is the sort of bug
 * that is only found by someone ringing the wrong person.
 */

/**
 * Israeli numbers are stored as typed — "050-123-4567", "+972 50 123 4567",
 * "(050) 1234567". wa.me needs digits with a country code and nothing else.
 *
 * A leading 0 is the national trunk prefix and is replaced by 972, not kept:
 * 972050… is not a number. Anything that does not look like an Israeli mobile
 * or landline is passed through with its digits only, on the assumption that a
 * number entered with an explicit country code means it.
 */
export function whatsappNumber(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return null;

  if (digits.startsWith('+')) return digits.slice(1) || null;
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('00')) return digits.slice(2) || null;
  if (digits.startsWith('0')) return `972${digits.slice(1)}`;

  // No prefix at all: assume it is a local number missing its leading zero.
  return digits.length >= 8 ? `972${digits}` : digits;
}

export function PhoneActions({ phone, className }: { phone: string; className?: string }) {
  const t = useTranslations('patients');
  const [open, setOpen] = useState(false);
  const wa = whatsappNumber(phone);

  return (
    <span className={className}>
      <span className="relative inline-flex">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={t('contactActions', { phone })}
          dir="ltr"
          className="rounded-md px-1 py-0.5 tabular-nums text-jade-800 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade-700"
        >
          {phone}
        </button>

        {open ? (
          <>
            {/* Click-away. Keyboard users get out with Escape on the buttons. */}
            <span
              className="fixed inset-0 z-20"
              aria-hidden
              onClick={() => setOpen(false)}
            />
            <span
              className="absolute top-full z-30 mt-1 flex min-w-44 flex-col overflow-hidden rounded-lg border border-ink-200 bg-white py-1 shadow-lg"
              onKeyDown={(event) => {
                if (event.key === 'Escape') setOpen(false);
              }}
            >
              {wa ? (
                <a
                  // wa.me picks the installed app on a phone and WhatsApp Web on
                  // a desktop, so one link covers both without sniffing.
                  href={`https://wa.me/${wa}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-ink-800 hover:bg-ink-50"
                >
                  <MessageCircle className="h-4 w-4 shrink-0 text-jade-700" aria-hidden />
                  {t('sendWhatsApp')}
                </a>
              ) : null}
              <a
                href={`tel:${phone}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-ink-800 hover:bg-ink-50"
              >
                <Phone className="h-4 w-4 shrink-0 text-ink-600" aria-hidden />
                {t('callPhone')}
              </a>
            </span>
          </>
        ) : null}
      </span>
    </span>
  );
}
