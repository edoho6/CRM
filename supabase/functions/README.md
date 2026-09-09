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
