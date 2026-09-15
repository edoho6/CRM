import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Leaf } from 'lucide-react';
import { Alert, Card, CardBody } from '@clinic/ui';
import { tryCreateServerSupabase } from '@clinic/db/server';
import { ConfirmForm } from './confirm-form';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A page reached only by its own link: never in a search index, whatever robots.txt says. */
export const metadata = { robots: { index: false, follow: false } };

interface TokenRow {
  clinic_name: string;
  first_name: string;
  locale: string;
  already_withdrawn: boolean;
}

/**
 * The page behind the removal link at the foot of a marketing message.
 *
 * Reads through a token-checked function rather than a table, so there is
 * no session to have and nothing to see but the clinic's name and the
 * patient's first name, so they know it is theirs. Opening the page changes
 * nothing; the button does — link previews open pages, people press buttons.
 */
export default async function UnsubscribePage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('unsubscribe');
  const tc = await getTranslations('common');

  const supabase = UUID.test(token) ? await tryCreateServerSupabase() : null;
  const { data } = supabase ? await supabase.rpc('unsubscribe_info', { p_token: token }) : { data: null };
  const row = (Array.isArray(data) ? data[0] : null) as TokenRow | undefined;

  const brand = (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-fg">
        <Leaf className="h-5 w-5" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold text-ink-900">{row?.clinic_name ?? tc('appName')}</h1>
    </div>
  );

  if (!row) {
    return (
      <div className="space-y-5">
        {brand}
        <Card>
          <CardBody className="text-center text-sm text-ink-700">{t('expired')}</CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {brand}
      <Card>
        <CardBody className="space-y-4">
          <p className="text-base text-ink-800">{t('greeting', { name: row.first_name })}</p>
          <p className="text-sm text-ink-700">{t('intro', { clinic: row.clinic_name })}</p>
          {row.already_withdrawn ? (
            <Alert tone="info">{t('already')}</Alert>
          ) : (
            <ConfirmForm token={token} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
