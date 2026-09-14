-- Migration 51 — the same once-per-query check for the other shared tables.
--
-- Migration 50 wrapped the library's membership check in a sub-select so
-- Postgres pays it once per query rather than once per row. The medicine
-- reference (thousands of entries, tens of thousands of links) and the
-- shop prices carry the same plain check; here they get the same wrapping.
-- What each policy allows is unchanged.
drop policy if exists med_entries_members_read on public.med_entries;
create policy med_entries_members_read on public.med_entries
  for select using ((select public.current_clinic_id()) is not null);

drop policy if exists med_links_members_read on public.med_links;
create policy med_links_members_read on public.med_links
  for select using ((select public.current_clinic_id()) is not null);

drop policy if exists shop_stores_members_read on public.shop_stores;
create policy shop_stores_members_read on public.shop_stores
  for select using ((select public.current_clinic_id()) is not null);

drop policy if exists shop_products_members_read on public.shop_products;
create policy shop_products_members_read on public.shop_products
  for select using ((select public.current_clinic_id()) is not null);

drop policy if exists shop_offers_members_read on public.shop_offers;
create policy shop_offers_members_read on public.shop_offers
  for select using ((select public.current_clinic_id()) is not null);

drop policy if exists shop_fetch_runs_members_read on public.shop_fetch_runs;
create policy shop_fetch_runs_members_read on public.shop_fetch_runs
  for select using ((select public.current_clinic_id()) is not null);
