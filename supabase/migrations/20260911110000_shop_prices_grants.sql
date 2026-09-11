-- ============================================================================
-- 36 · Price comparison — the job's functions are the job's alone
-- ============================================================================
-- Migration 35 revoked the price job's four functions "from public" and
-- granted them to service_role — and the isolation test then ran one of them
-- as a signed-in clinic member, successfully. Supabase grants EXECUTE on every
-- new function in public to anon, authenticated and service_role through
-- default privileges, and a revoke from PUBLIC does not touch those explicit
-- grants. The functions that write prices must be taken away from the two
-- app roles by name; the admin functions check is_platform_admin() themselves
-- and only lose the anonymous grant they never needed. Harmless to run twice.
-- ============================================================================

revoke execute on function public.shop_claim_store(uuid, uuid) from anon, authenticated;
revoke execute on function public.shop_save_bookmark(uuid, jsonb) from anon, authenticated;
revoke execute on function public.shop_upsert_offers(uuid, uuid, jsonb) from anon, authenticated;
revoke execute on function public.shop_finish_run(uuid, uuid, text, boolean, boolean, text, jsonb) from anon, authenticated;

revoke execute on function public.shop_set_store_status(uuid, text, text) from anon;
revoke execute on function public.shop_request_refresh(uuid) from anon;
revoke execute on function public.shop_store_stats() from anon;
