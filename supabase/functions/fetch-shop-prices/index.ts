// The price reader.
//
// Runs inside Supabase (Edge Functions) every ten minutes and reads one
// shop's catalogue — the one an admin asked for, the one whose last pass
// stopped partway, or the one that has gone longest without a full pass —
// for at most a minute, through the shop's public product feed. What it
// keeps is a product's name, price, link and identifiers; nothing else is
// read. All of the logic is in ../_shared/shop-prices, which the web app's
// tests exercise; this file only wires it to Deno and to the database.
//
// Why here and not in the web app: the prices are one shared list for every
// clinic, written by nobody in particular, and the web app has no identity
// that may write across clinics — by design, it holds no service key. This
// function does, because Supabase hands it one at runtime; it never appears
// in the repository.
//
// Secrets, all set in the Supabase dashboard under Edge Functions → Secrets:
//   SHOP_PRICES_SECRET   — the schedule must send it as `x-shop-prices-secret`
//   SHOP_PRICES_CONTACT  — an email address for the shops, shown in User-Agent
//   SHOP_PRICES_SITE     — the service's address, shown in User-Agent
//
// A request body may carry {"trigger":"manual","store":"<slug>"} to read one
// store now (the admin screen does this); the schedule sends {"trigger":"cron"}.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { ADAPTERS } from '../_shared/shop-prices/adapters/index.ts';
import { createDb } from '../_shared/shop-prices/db.ts';
import { createFetcher } from '../_shared/shop-prices/fetcher.ts';
import { runOnce } from '../_shared/shop-prices/run.ts';
import type { Logger, RunTrigger } from '../_shared/shop-prices/types.ts';

const AGENT_TOKEN = 'HerbalistPriceCheck';

const log: Logger = {
  info: (message, data) => console.log(message, data ? JSON.stringify(data) : ''),
  warn: (message, data) => console.warn(message, data ? JSON.stringify(data) : ''),
};

Deno.serve(async (request) => {
  const secret = Deno.env.get('SHOP_PRICES_SECRET');
  if (!secret || request.headers.get('x-shop-prices-secret') !== secret) {
    return new Response('Forbidden', { status: 403 });
  }

  let body: { trigger?: unknown; store?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const trigger: RunTrigger = body.trigger === 'manual' ? 'manual' : 'cron';
  const storeSlug = typeof body.store === 'string' && /^[a-z0-9-]{1,40}$/.test(body.store) ? body.store : undefined;

  const site = Deno.env.get('SHOP_PRICES_SITE') ?? '';
  const contact = Deno.env.get('SHOP_PRICES_CONTACT') ?? '';
  const fetcher = createFetcher({
    userAgent: `${AGENT_TOKEN}/1.0 (+${site}; ${contact}) price comparison for clinic supplies`,
    minDelayMs: 2_000,
  });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const outcome = await runOnce({
    db: createDb(supabase),
    fetcher,
    adapters: ADAPTERS,
    log,
    trigger,
    runId: crypto.randomUUID(),
    agentToken: AGENT_TOKEN,
    storeSlug,
    budgetMs: 55_000,
  });

  return Response.json({ ...outcome, requests: fetcher.requests });
});
