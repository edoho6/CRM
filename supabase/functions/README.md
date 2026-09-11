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

SMS and WhatsApp have no provider yet. When one is chosen, `smsProvider()` /
`whatsappProvider()` in `index.ts` are the only places that change.

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
