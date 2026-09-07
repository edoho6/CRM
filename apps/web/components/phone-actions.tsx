'use client';

import { useTranslations } from 'next-intl';
import { MessageCircle, Phone } from 'lucide-react';
import { Popover } from '@clinic/ui';

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
  const wa = whatsappNumber(phone);

  return (
    <span className={className}>
      <Popover
        width={200}
        align="start"
        panelLabel={t('contactActions', { phone })}
        triggerLabel={t('contactActions', { phone })}
        triggerClassName="rounded-md px-1 py-0.5 tabular-nums text-jade-800 underline-offset-2 hover:underline"
        triggerContent={<span dir="ltr">{phone}</span>}
      >
        {({ close }) => (
          <div className="-m-3 flex flex-col py-1">
            {wa ? (
              <a
                // wa.me picks the installed app on a phone and WhatsApp Web on a
                // desktop, so one link covers both without sniffing the agent.
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={close}
                className="flex items-center gap-2 px-3 py-2 text-sm text-ink-800 hover:bg-ink-50"
              >
                <MessageCircle className="h-4 w-4 shrink-0 text-jade-700" aria-hidden />
                {t('sendWhatsApp')}
              </a>
            ) : null}
            <a
              href={`tel:${phone}`}
              onClick={close}
              className="flex items-center gap-2 px-3 py-2 text-sm text-ink-800 hover:bg-ink-50"
            >
              <Phone className="h-4 w-4 shrink-0 text-ink-600" aria-hidden />
              {t('callPhone')}
            </a>
          </div>
        )}
      </Popover>
    </span>
  );
}
