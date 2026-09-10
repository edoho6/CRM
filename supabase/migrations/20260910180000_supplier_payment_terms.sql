-- ============================================================================
-- 32 · Payment terms on a supplier
-- ============================================================================
-- Free text, because every supplier says it differently: "שוטף + 30",
-- "מזומן במסירה", "כרטיס אשראי בהזמנה". A structured field would have to be
-- wrong for someone.

alter table public.suppliers
  add column if not exists payment_terms text;
