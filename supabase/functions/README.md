# Edge functions

Jobs that run inside Supabase rather than in the web app, because they work
across every clinic at once and the web app — by design — holds no identity
that may do that.

## dispatch-messages

Sends whatever is `queued` in `message_log` through a connected provider.
Until a provider is connected it does nothing, and the queue is worked through
by hand from the Messages screen. Nothing is lost either way.

### Deploy

```
supabase functions deploy dispatch-messages --no-verify-jwt
```

`--no-verify-jwt` because the caller is the database's own scheduler, not a
signed-in user; the function checks its own `x-dispatch-secret` header
instead.

### Secrets (Dashboard → Edge Functions → Secrets)

| Name | Purpose |
|---|---|
| `DISPATCH_SECRET` | Any long random string. The schedule sends it; the function refuses without it. |
| `RESEND_API_KEY` | Enables email through resend.com. |
| `EMAIL_FROM` | The sender, e.g. `Herbalist <reminders@your-domain>`. |
| `FCM_SERVICE_ACCOUNT_JSON` | Enables phone notifications through Firebase Cloud Messaging: the service-account JSON file Firebase hands out (Project settings → Service accounts → Generate new private key), pasted whole. |
| `SMS_019_USERNAME` | Enables SMS through 019 (019sms.co.il): the account's user name… |
| `SMS_019_TOKEN` | …an API token made in the account's settings (shown once)… |
| `SMS_SENDER` | …and the sender name patients see: up to eleven English letters and digits. All three, or no SMS. |
| `WHATSAPP_019_SOURCE` | Enables WhatsApp through the same 019 account: the clinic's WhatsApp number as verified there, international without a plus (`972…`). Needs `SMS_019_TOKEN` too. |

SMS and WhatsApp go through 019. The adapters are plain TypeScript in
`_shared/messaging/` (run here, tested from `apps/web` through the
`@messaging/*` alias): the phone number is folded into the form the service
wants, the service's status numbers become short codes (`no_credit`,
`bad_number`, `needs_template`), and nothing of its text is kept.

WhatsApp has a rule of Meta's: a message the clinic starts must be a
template Meta approved; free text is allowed only within a day of the patient
writing. A row whose kind has a template id on `clinic_automations` (pasted
in Settings → Messages) goes as that template with the row's `params` as its
variables; a row without one is tried as free text and, refused, is marked
`needs_template` for the manual path. A clinic marked as a sandbox
(`is_synthetic`) sends nothing to its patients — its rows are marked
`skipped` — except the practitioner's own `test_message`.

Nothing is retried on its own. A failed row keeps its code and stays on the
Messages screen, where a person sends it by hand or fixes what the code names.

Phone notifications (`push` rows, migration 41): the row's `recipient` is a
user id and the phones are looked up in `device_push_tokens` here. A token
the service no longer knows is deleted, so the next hourly queue run sees no
phone and queues the reminder on the clinic's channel instead — the fallback
needs no extra machinery. The notification carries the clinic's name, the
date and the hour, never the patient's name.

### Schedule (SQL editor, once, with `pg_cron` and `pg_net` enabled)

```sql
select cron.schedule(
  'dispatch-messages', '*/5 * * * *',
  $job$
    select net.http_post(
      url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/dispatch-messages',
      headers := jsonb_build_object('x-dispatch-secret', 'THE-SAME-SECRET'),
      body := '{}'::jsonb
    )
  $job$
);
```

The queue itself is filled by two SQL functions on their own schedule — see
the end of `supabase/migrations/20260909200000_schedule_blocks_messaging.sql`.

### What is never here

No patient detail is logged. A failed send keeps a short code
(`http_429`, `no_recipient`) on the row and nothing else. The service key is
injected by Supabase at runtime and appears in no file.

## fetch-shop-prices

Reads one shop's catalogue per run — name, price, link and identifiers of
each listing, nothing else — and writes it through the functions of
migration `20260911100000_shop_prices.sql`. Which shop, how far, and what
happens on failure is decided in `_shared/shop-prices/` (schedule.ts,
run.ts), which is plain TypeScript: the web app's tests run it
(`apps/web/features/prices/*.test.ts`) and so does the dry-run script.

Only a store whose `status` is `active` is ever read. The four shops with a
public product feed (WooCommerce Store API, Shopify `products.json`) start
active; the three that publish prices only in their pages start
`awaiting_permission` and stay unread until the shop agrees in writing and
an admin switches them on from `/prices/stores`.

### What "polite" means here, in code

- `robots.txt` is read first on every pass and every path is checked against
  it; a Crawl-delay is honoured. A 5xx on robots.txt ends the pass.
- One request at a time, at least two seconds apart per host
  (`shop_stores.crawl_delay_ms`), with a User-Agent that names the service,
  its address and a contact email (the two secrets below).
- 429 and 503 wait for Retry-After and try at most twice more; any other
  failure ends the pass with a short code (`http_503`, `timeout`,
  `robots_disallow`), and after three failed passes the shop is left alone
  for six hours.
- A pass is at most a minute; a catalogue that needs more is read across
  ticks from a bookmark. Each active shop is read about once a day.

### Deploy

```
supabase functions deploy fetch-shop-prices --no-verify-jwt
```

### Secrets (Dashboard → Edge Functions → Secrets)

| Name | Purpose |
|---|---|
| `SHOP_PRICES_SECRET` | Any long random string. The schedule sends it as `x-shop-prices-secret`; the function refuses without it. |
| `SHOP_PRICES_CONTACT` | An email address a shop can write to, shown in the User-Agent. |
| `SHOP_PRICES_SITE` | The service's address, shown in the User-Agent. |

### First run, by hand

Once per active shop, until the answer says `"partial": false`:

```
curl -X POST https://YOUR-PROJECT-REF.supabase.co/functions/v1/fetch-shop-prices \
  -H "x-shop-prices-secret: THE-SAME-SECRET" -H "content-type: application/json" \
  -d '{"trigger":"manual","store":"medicinebom"}'
```

### Schedule (SQL editor, once, with `pg_cron` and `pg_net` enabled)

The statement is at the end of the migration file; it needs the project's
address and the secret, which is why it is not run by the migration itself.

### Trying it without a database

`node scripts/shop-prices-dry-run.mjs --store=medicinebom` reads a shop the
way the job would and prints what the classifier kept, what it dropped and
the unified names it made (`--offline` replays the saved names without a
single request). It is how the taxonomy in `_shared/shop-prices/taxonomy.ts`
and the brand list in `brands.ts` were tuned, and how they are re-tuned.

### What is never here

No description and no picture of a product is read from a shop; the
comparison's pictures come from openly licensed sources
(`scripts/fetch-shop-images.mjs`). The stored error is a short code, never
a page's content. The service key is injected by Supabase at runtime and
appears in no file.
