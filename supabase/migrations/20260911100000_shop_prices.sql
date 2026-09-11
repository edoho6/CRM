-- ============================================================================
-- 35 · Price comparison — the shops' prices for clinic supplies, shared
-- ============================================================================
-- A practitioner buying needles, moxa or cupping sets wants to know who sells
-- the thing cheapest this week. The shops publish their catalogues on their
-- own pages; a job reads product names and prices from those pages — nothing
-- else: no descriptions, no photographs — and this schema holds what it read,
-- once, for every clinic that uses the service.
--
-- These are the first tables in the schema that belong to no clinic. A price
-- is the same fact whoever reads it, and fetching it once a day for the
-- service is a courtesy to the shops that fetching it once per clinic would
-- not be. So:
--
--   read   — any signed-in clinic member (current_clinic_id() is not null),
--            which leaves out portal patients and the public;
--   write  — nobody from the app. The fetch job runs inside Supabase with the
--            service role and goes through the three functions below; the
--            two things a platform admin may change (a store's status, a
--            refresh request) are functions that check is_platform_admin().
--
-- No audit trigger: these are neither clinical nor financial records, and the
-- audit function keys on a clinic_id these rows do not have.
--
--   shop_stores      — one row per shop: where it is, how it is read, whether
--                      it may be read (status), and the job's bookmark
--   shop_products    — the unified product: one row per "the same thing",
--                      keyed by a barcode when the shop gives one, else by a
--                      fingerprint of brand + item + size + pack computed the
--                      same way for every shop
--   shop_offers      — one shop's price for one product, with the link to buy
--   shop_fetch_runs  — what each pass of the job did, for the admin screen
-- ============================================================================

create table if not exists public.shop_stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  name_en text,
  base_url text not null,
  platform text not null
    check (platform in ('woocommerce', 'shopify', 'html_cashcow', 'html_kala', 'html_magento1', 'unsupported')),
  -- active: read on schedule. paused: an admin stopped it. awaiting_permission:
  -- built, but the shop has not yet agreed in writing. unsupported: cannot be
  -- read without a browser.
  status text not null default 'awaiting_permission'
    check (status in ('active', 'paused', 'awaiting_permission', 'unsupported')),
  status_note text,
  -- Adapter settings: which collections, which sitemap, which category pages;
  -- dims_order = length_first for a shop that writes needle sizes as 40*25.
  config jsonb not null default '{}'::jsonb,
  crawl_delay_ms integer not null default 2000 check (crawl_delay_ms between 500 and 60000),
  -- The job's bookmark inside one pass: null between passes.
  bookmark jsonb,
  refresh_requested_at timestamptz,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  consecutive_failures integer not null default 0,
  last_run_stats jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists shop_stores_set_updated_at on public.shop_stores;
create trigger shop_stores_set_updated_at
  before update on public.shop_stores
  for each row execute function public.set_updated_at();

create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  -- brand|item|size|pack, computed identically for every shop; the image
  -- manifest is keyed by it too.
  fingerprint text not null unique,
  -- 14-digit, checksum-verified; the strongest identity when a shop gives one.
  gtin text unique,
  brand text,
  display_item text not null,
  item_key text not null,
  size_kind text check (size_kind in ('dims', 'mass', 'vol', 'len', 'pct')),
  size_a numeric,
  size_b numeric,
  size_unit text,
  pack_count integer,
  -- "brand · item · size (pack)", the name the list shows and sorts by.
  canonical_name text not null,
  -- Every raw shop name seen for this product, for search.
  search_text text,
  category text not null check (category in (
    'needles', 'moxa', 'cupping', 'guasha', 'ear_seeds', 'tdp_lamps', 'electro',
    'granules', 'formulas', 'raw_herbs', 'consumables', 'accessories'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_products_category_idx on public.shop_products (category);

drop trigger if exists shop_products_set_updated_at on public.shop_products;
create trigger shop_products_set_updated_at
  before update on public.shop_products
  for each row execute function public.set_updated_at();

create table if not exists public.shop_offers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.shop_stores(id) on delete cascade,
  product_id uuid not null references public.shop_products(id) on delete cascade,
  -- The shop's own id for the item: a product id, "product:variant", or a path.
  external_id text not null,
  raw_name text not null,
  url text not null,
  sku text,
  gtin text,
  fingerprint text not null,
  price numeric(10,2) not null check (price >= 0),
  currency text not null default 'ILS',
  previous_price numeric(10,2),
  price_changed_at timestamptz,
  -- An offer that vanished from the shop is kept and marked, never deleted:
  -- "was 120 last month" is worth knowing.
  is_available boolean not null default true,
  unavailable_since timestamptz,
  etag text,
  last_modified text,
  run_id uuid,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (store_id, external_id)
);

create index if not exists shop_offers_product_idx on public.shop_offers (product_id) where is_available;
create index if not exists shop_offers_store_seen_idx on public.shop_offers (store_id, last_seen_at);

create table if not exists public.shop_fetch_runs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.shop_stores(id) on delete cascade,
  run_id uuid not null,
  triggered_by text not null check (triggered_by in ('cron', 'manual')),
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  ok boolean not null,
  partial boolean not null default false,
  pages integer,
  fetched integer,
  in_scope integer,
  new_products integer,
  new_offers integer,
  price_changes integer,
  marked_unavailable integer,
  error text
);

create index if not exists shop_fetch_runs_store_idx on public.shop_fetch_runs (store_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Row level security: every clinic member reads; nobody writes from the app
-- ---------------------------------------------------------------------------

alter table public.shop_stores enable row level security;
alter table public.shop_products enable row level security;
alter table public.shop_offers enable row level security;
alter table public.shop_fetch_runs enable row level security;

drop policy if exists shop_stores_members_read on public.shop_stores;
create policy shop_stores_members_read on public.shop_stores
  for select using (public.current_clinic_id() is not null);

drop policy if exists shop_products_members_read on public.shop_products;
create policy shop_products_members_read on public.shop_products
  for select using (public.current_clinic_id() is not null);

drop policy if exists shop_offers_members_read on public.shop_offers;
create policy shop_offers_members_read on public.shop_offers
  for select using (public.current_clinic_id() is not null);

drop policy if exists shop_fetch_runs_members_read on public.shop_fetch_runs;
create policy shop_fetch_runs_members_read on public.shop_fetch_runs
  for select using (public.current_clinic_id() is not null);

-- ---------------------------------------------------------------------------
-- The list's view: each product with its cheapest active offer
-- ---------------------------------------------------------------------------
-- security_invoker, so the reader's own policies apply to the tables beneath.
-- Only active stores count: a paused shop's last price is history, not an
-- offer.

create or replace view public.shop_product_prices
with (security_invoker = true) as
select
  p.*,
  coalesce(s.store_count, 0) as store_count,
  s.min_price,
  s.min_price_store_id,
  s.max_price,
  s.last_seen_at
from public.shop_products p
left join lateral (
  select
    count(distinct o.store_id)::integer as store_count,
    min(o.price) as min_price,
    (array_agg(o.store_id order by o.price, o.last_seen_at desc))[1] as min_price_store_id,
    max(o.price) as max_price,
    max(o.last_seen_at) as last_seen_at
  from public.shop_offers o
  join public.shop_stores st on st.id = o.store_id
  where o.product_id = p.id and o.is_available and st.status = 'active'
) s on true;

-- ---------------------------------------------------------------------------
-- The job's three functions (service role only)
-- ---------------------------------------------------------------------------

-- Claims a store for one pass. Null when the store is not active or another
-- pass has it (started within three minutes and not finished): two passes
-- writing the same store would race on the bookmark.
create or replace function public.shop_claim_store(p_store uuid, p_run uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.shop_stores;
begin
  update public.shop_stores
     set last_started_at = now(),
         refresh_requested_at = null,
         bookmark = coalesce(bookmark, jsonb_build_object('run_id', p_run, 'started_at', now()))
   where id = p_store
     and status = 'active'
     and (last_started_at is null
          or last_completed_at >= last_started_at
          or last_started_at < now() - interval '3 minutes')
  returning * into v_row;
  if v_row.id is null then return null; end if;
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.shop_claim_store(uuid, uuid) from public;
grant execute on function public.shop_claim_store(uuid, uuid) to service_role;

-- Saves the bookmark between pages of one pass.
create or replace function public.shop_save_bookmark(p_store uuid, p_bookmark jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  update public.shop_stores set bookmark = p_bookmark where id = p_store;
$$;

revoke all on function public.shop_save_bookmark(uuid, jsonb) from public;
grant execute on function public.shop_save_bookmark(uuid, jsonb) to service_role;

-- One page of offers from one store. Each element:
--   { external_id, raw_name, url, sku, gtin, fingerprint, price, currency,
--     available, unchanged, etag, last_modified,
--     product: { brand, display_item, item_key, size_kind, size_a, size_b,
--                size_unit, pack_count, canonical_name, category } }
-- The product is found by barcode, then by fingerprint, else made. The first
-- offer to make a product names it; later ones only add to its search text.
-- An offer is updated in place; a changed price keeps the old one beside it.
create or replace function public.shop_upsert_offers(p_store uuid, p_run uuid, p_offers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_product jsonb;
  v_product_id uuid;
  v_gtin text;
  v_fingerprint text;
  v_price numeric(10,2);
  v_existing public.shop_offers;
  v_new_products integer := 0;
  v_new_offers integer := 0;
  v_updated integer := 0;
  v_price_changes integer := 0;
  v_raw_name text;
begin
  for v_item in select * from jsonb_array_elements(coalesce(p_offers, '[]'::jsonb)) loop
    -- A conditional request answered "not modified": only the sighting moves.
    if coalesce((v_item->>'unchanged')::boolean, false) then
      update public.shop_offers
         set last_seen_at = now(), run_id = p_run
       where store_id = p_store and external_id = v_item->>'external_id';
      continue;
    end if;

    v_product := v_item->'product';
    v_gtin := nullif(v_item->>'gtin', '');
    v_fingerprint := v_item->>'fingerprint';
    v_price := (v_item->>'price')::numeric;
    v_raw_name := left(v_item->>'raw_name', 300);
    if v_fingerprint is null or v_price is null or v_raw_name is null then continue; end if;

    v_product_id := null;
    if v_gtin is not null then
      select id into v_product_id from public.shop_products where gtin = v_gtin;
    end if;
    if v_product_id is null then
      select id into v_product_id from public.shop_products where fingerprint = v_fingerprint;
      -- The barcode this shop knows, remembered for the others.
      if v_product_id is not null and v_gtin is not null then
        update public.shop_products set gtin = v_gtin
         where id = v_product_id and gtin is null
           and not exists (select 1 from public.shop_products x where x.gtin = v_gtin);
      end if;
    end if;
    if v_product_id is null then
      insert into public.shop_products as sp (
        fingerprint, gtin, brand, display_item, item_key, size_kind, size_a, size_b,
        size_unit, pack_count, canonical_name, search_text, category
      ) values (
        v_fingerprint, v_gtin,
        nullif(v_product->>'brand', ''),
        coalesce(nullif(v_product->>'display_item', ''), v_raw_name),
        coalesce(nullif(v_product->>'item_key', ''), v_fingerprint),
        nullif(v_product->>'size_kind', ''),
        (v_product->>'size_a')::numeric,
        (v_product->>'size_b')::numeric,
        nullif(v_product->>'size_unit', ''),
        (v_product->>'pack_count')::integer,
        coalesce(nullif(v_product->>'canonical_name', ''), v_raw_name),
        v_raw_name,
        coalesce(nullif(v_product->>'category', ''), 'accessories')
      )
      on conflict (fingerprint) do update set search_text = sp.search_text
      returning id into v_product_id;
      v_new_products := v_new_products + 1;
    else
      update public.shop_products
         set search_text = left(coalesce(search_text, '') || ' | ' || v_raw_name, 2000)
       where id = v_product_id
         and position(v_raw_name in coalesce(search_text, '')) = 0;
    end if;

    select * into v_existing
      from public.shop_offers
     where store_id = p_store and external_id = v_item->>'external_id';

    if v_existing.id is null then
      insert into public.shop_offers (
        store_id, product_id, external_id, raw_name, url, sku, gtin, fingerprint,
        price, currency, is_available, unavailable_since, etag, last_modified, run_id
      ) values (
        p_store, v_product_id, v_item->>'external_id', v_raw_name, v_item->>'url',
        nullif(v_item->>'sku', ''), v_gtin, v_fingerprint,
        v_price, coalesce(nullif(v_item->>'currency', ''), 'ILS'),
        coalesce((v_item->>'available')::boolean, true),
        case when coalesce((v_item->>'available')::boolean, true) then null else now() end,
        nullif(v_item->>'etag', ''), nullif(v_item->>'last_modified', ''), p_run
      );
      v_new_offers := v_new_offers + 1;
    else
      if v_existing.price <> v_price then v_price_changes := v_price_changes + 1; end if;
      update public.shop_offers
         set product_id = v_product_id,
             raw_name = v_raw_name,
             url = v_item->>'url',
             sku = nullif(v_item->>'sku', ''),
             gtin = v_gtin,
             fingerprint = v_fingerprint,
             previous_price = case when v_existing.price <> v_price then v_existing.price else previous_price end,
             price_changed_at = case when v_existing.price <> v_price then now() else price_changed_at end,
             price = v_price,
             currency = coalesce(nullif(v_item->>'currency', ''), currency),
             is_available = coalesce((v_item->>'available')::boolean, true),
             unavailable_since = case
               when coalesce((v_item->>'available')::boolean, true) then null
               else coalesce(unavailable_since, now()) end,
             etag = nullif(v_item->>'etag', ''),
             last_modified = nullif(v_item->>'last_modified', ''),
             run_id = p_run,
             last_seen_at = now()
       where id = v_existing.id;
      v_updated := v_updated + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'new_products', v_new_products,
    'new_offers', v_new_offers,
    'updated', v_updated,
    'price_changes', v_price_changes
  );
end;
$$;

revoke all on function public.shop_upsert_offers(uuid, uuid, jsonb) from public;
grant execute on function public.shop_upsert_offers(uuid, uuid, jsonb) to service_role;

-- Closes a pass. A complete, successful pass marks every offer the pass did
-- not see as unavailable (the shop no longer lists it) and clears the
-- bookmark; a partial pass keeps the bookmark for the next tick; a failure
-- counts, and after three the bookmark is dropped so the next pass starts
-- clean. Returns how many offers were marked unavailable.
create or replace function public.shop_finish_run(
  p_store uuid, p_run uuid, p_trigger text, p_ok boolean, p_partial boolean,
  p_error text, p_stats jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store public.shop_stores;
  v_marked integer := 0;
  v_started timestamptz;
begin
  select * into v_store from public.shop_stores where id = p_store;
  if v_store.id is null then return 0; end if;
  v_started := coalesce((v_store.bookmark->>'started_at')::timestamptz, v_store.last_started_at, now());

  if p_ok and not p_partial then
    update public.shop_offers
       set is_available = false, unavailable_since = now()
     where store_id = p_store and is_available and last_seen_at < v_started;
    get diagnostics v_marked = row_count;
    update public.shop_stores
       set last_success_at = now(), bookmark = null, consecutive_failures = 0,
           last_error = null, last_error_at = null
     where id = p_store;
  elsif p_ok then
    update public.shop_stores set consecutive_failures = 0 where id = p_store;
  else
    update public.shop_stores
       set last_error = left(p_error, 200), last_error_at = now(),
           consecutive_failures = consecutive_failures + 1,
           bookmark = case when consecutive_failures + 1 >= 3 then null else bookmark end
     where id = p_store;
  end if;

  update public.shop_stores
     set last_completed_at = now(),
         last_run_stats = coalesce(p_stats, '{}'::jsonb) || jsonb_build_object('marked_unavailable', v_marked)
   where id = p_store;

  insert into public.shop_fetch_runs (
    store_id, run_id, triggered_by, started_at, ok, partial, pages, fetched, in_scope,
    new_products, new_offers, price_changes, marked_unavailable, error
  ) values (
    p_store, p_run, coalesce(p_trigger, 'cron'), v_started, p_ok, coalesce(p_partial, false),
    (p_stats->>'pages')::integer, (p_stats->>'fetched')::integer, (p_stats->>'in_scope')::integer,
    (p_stats->>'new_products')::integer, (p_stats->>'new_offers')::integer,
    (p_stats->>'price_changes')::integer, v_marked, left(p_error, 200)
  );

  delete from public.shop_fetch_runs where started_at < now() - interval '30 days';
  return v_marked;
end;
$$;

revoke all on function public.shop_finish_run(uuid, uuid, text, boolean, boolean, text, jsonb) from public;
grant execute on function public.shop_finish_run(uuid, uuid, text, boolean, boolean, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- What a platform admin may do from the app
-- ---------------------------------------------------------------------------

create or replace function public.shop_set_store_status(p_store uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status not in ('active', 'paused', 'awaiting_permission', 'unsupported') then
    raise exception 'bad_status' using errcode = '22023';
  end if;
  update public.shop_stores
     set status = p_status,
         status_note = left(p_note, 300),
         -- A store switched off mid-pass starts clean when switched on again.
         bookmark = case when p_status = 'active' then bookmark else null end
   where id = p_store;
end;
$$;

revoke all on function public.shop_set_store_status(uuid, text, text) from public;
grant execute on function public.shop_set_store_status(uuid, text, text) to authenticated;

-- Asks the next scheduled pass to take this store first. Refuses a second
-- request within two minutes, so a double click is not two passes.
create or replace function public.shop_request_refresh(p_store uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store public.shop_stores;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_store from public.shop_stores where id = p_store;
  if v_store.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_store.status <> 'active' then raise exception 'store_not_active' using errcode = '22023'; end if;
  if v_store.refresh_requested_at is not null and v_store.refresh_requested_at > now() - interval '2 minutes' then
    raise exception 'too_soon' using errcode = '55P03';
  end if;
  update public.shop_stores set refresh_requested_at = now() where id = p_store;
  return v_store.slug;
end;
$$;

revoke all on function public.shop_request_refresh(uuid) from public;
grant execute on function public.shop_request_refresh(uuid) to authenticated;

-- Counts for the admin screen. Runs as the caller, so the read policies apply.
create or replace function public.shop_store_stats()
returns table (store_id uuid, offers integer, available integer, products integer)
language sql
stable
security invoker
set search_path = public
as $$
  select
    s.id as store_id,
    count(o.id)::integer as offers,
    (count(o.id) filter (where o.is_available))::integer as available,
    count(distinct o.product_id)::integer as products
  from public.shop_stores s
  left join public.shop_offers o on o.store_id = s.id
  group by s.id;
$$;

revoke all on function public.shop_store_stats() from public;
grant execute on function public.shop_store_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- The shops, as checked on 2026-09-11
-- ---------------------------------------------------------------------------
-- Four publish their catalogue through a public, documented product feed and
-- their terms say nothing against reading it: active. Three show prices only
-- in their pages and their terms forbid copying "any part" in broad words:
-- built, but waiting for the shop's written agreement before a single page
-- is read. One serves nothing to anything but a browser: unsupported.

insert into public.shop_stores (slug, name, name_en, base_url, platform, status, status_note, config)
values
  ('medicinebom', 'מדיסין בום', 'Medicine Bom', 'https://medicinebom.co.il', 'woocommerce', 'active', null, '{}'::jsonb),
  ('tevadirect', 'המילניום', 'HaMillennium', 'https://www.tevadirect.com', 'woocommerce', 'active', null,
    '{"dims_order": "length_first"}'::jsonb),
  ('dryang', 'ד"ר יאנג', 'Dr Yang', 'https://dryang.co.il', 'woocommerce', 'active', null, '{}'::jsonb),
  ('rosamix', 'רוזמיקס', 'Rosamix', 'https://www.rosamix.co.il', 'shopify', 'active', null,
    '{"collections": ["ציוד-למטפלים"]}'::jsonb),
  ('bartipulshop', 'ברטיפול', 'Bar Tipul', 'https://www.bartipulshop.co.il', 'html_cashcow', 'awaiting_permission',
    'ממתין לאישור בכתב מהחנות', '{"sitemap": "/crowlers/sitemap"}'::jsonb),
  ('metaplim', 'מטפלים שופ', 'Metaplim Shop', 'https://www.metaplim-shop.co.il', 'html_kala', 'awaiting_permission',
    'ממתין לאישור בכתב מהחנות', '{"category_urls": []}'::jsonb),
  ('kalteva', 'קלטבע', 'Kal Teva', 'https://www.kalteva.co.il', 'html_magento1', 'awaiting_permission',
    'ממתין לאישור בכתב מהחנות', '{"sitemap": "/sitemap.xml"}'::jsonb),
  ('xiaoai', 'שייאו איי', 'Xiao Ai', 'https://www.xiaoai.co.il', 'unsupported', 'unsupported',
    'האתר מציג את המוצרים רק בדפדפן; לא ניתן לקרוא אותו כרגע', '{}'::jsonb)
on conflict (slug) do nothing;

comment on table public.shop_stores is
  'The shops whose prices are compared. Shared by every clinic; read on a schedule by the fetch-shop-prices function; a status of active is the only permission the job needs.';
comment on table public.shop_products is
  'One row per product across shops: keyed by barcode when a shop gives one, else by a fingerprint of brand, item, size and pack computed the same way everywhere.';
comment on table public.shop_offers is
  'One shop''s price for one product, with the link to buy it there. Kept and marked unavailable when the shop stops listing it; never deleted.';

-- ---------------------------------------------------------------------------
-- The schedule itself — run once, by hand, in the SQL editor
-- ---------------------------------------------------------------------------
-- Not run here because it needs the project's address and the function's
-- secret, which are not the migration's to know. With pg_cron and pg_net
-- enabled (Database → Extensions), and the function deployed
-- (supabase functions deploy fetch-shop-prices --no-verify-jwt), paste and run:
--
--   select cron.schedule(
--     'fetch-shop-prices', '*/10 * * * *',
--     $job$
--       select net.http_post(
--         url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/fetch-shop-prices',
--         headers := jsonb_build_object('Content-Type', 'application/json',
--                                       'x-shop-prices-secret', 'THE-SAME-SECRET'),
--         body := '{"trigger":"cron"}'::jsonb,
--         timeout_milliseconds := 90000
--       )
--     $job$
--   );
--
-- Each tick reads one store — the one asked for from the admin screen, else
-- the one longest unread — for at most a minute, and stops where it is; the
-- next tick carries on. Every active store is read at least once a day.
