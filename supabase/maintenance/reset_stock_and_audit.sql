-- ============================================================================
--  Maintenance · empty the stock room, and check the catalogue for duplicates
-- ============================================================================
--  Run the whole file in the Supabase SQL editor. It does three things, in
--  order, and prints a report after each one.
--
--    1. Reports duplicates in the catalogue (read-only).
--    2. Empties the stock room, so no herb or formula appears as stocked.
--    3. Reports the result.
--
--  Step 2 is destructive: it deletes every batch, every stock movement and
--  every order-list line, and clears the reorder thresholds. That is what
--  "reset the stock" has to mean — a herb counts as stocked precisely because
--  it has a batch history or a threshold, so leaving either behind would leave
--  it in the stock room.
--
--  It does NOT touch the reference library: all your herbs, formulas and points
--  stay exactly as they are. It also does not touch dispensing records, because
--  those are clinical history — what a patient was given — not stock.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1 · Duplicates in the catalogue
-- ---------------------------------------------------------------------------
-- The importers match case-insensitively on the pinyin name, so a true
-- duplicate can only arrive from hand entry or from an ingredient whose name
-- was spelled differently in a formula than in the materia medica.

select 'duplicate herbs' as check_name,
       lower(pinyin_name) as value,
       count(*) as copies,
       string_agg(id::text, ', ') as ids
from public.herbs
where pinyin_name is not null
group by lower(pinyin_name)
having count(*) > 1
order by copies desc, value;

select 'duplicate formulas' as check_name,
       lower(name_pinyin) as value,
       count(*) as copies,
       string_agg(id::text, ', ') as ids
from public.herb_formulas
where name_pinyin is not null
group by lower(name_pinyin)
having count(*) > 1
order by copies desc, value;

select 'duplicate points' as check_name,
       upper(code) as value,
       count(*) as copies,
       string_agg(id::text, ', ') as ids
from public.acupuncture_points
group by upper(code)
having count(*) > 1
order by copies desc, value;

-- Herbs invented by the formula importer for an ingredient it did not
-- recognise. These are the usual cause of a catalogue looking bigger than it
-- should: they carry a pinyin name and nothing else.
select 'stub herbs from formulas' as check_name,
       pinyin_name as value,
       1 as copies,
       id::text as ids
from public.herbs
where data_source = 'formula-stub'
order by pinyin_name;

-- ---------------------------------------------------------------------------
-- 2 · Empty the stock room
-- ---------------------------------------------------------------------------

begin;

-- The ledger is append-only in normal operation; a deliberate reset is the one
-- time it is cleared, and it goes first so the batch trigger has nothing left
-- to recalculate.
delete from public.stock_movements;
delete from public.herb_batches;
delete from public.order_list;

-- Thresholds are the other half of "is this stocked". Clearing them is what
-- makes the stock room genuinely empty rather than merely at zero.
update public.herbs
   set reorder_threshold = null,
       reorder_quantity = null
 where reorder_threshold is not null
    or reorder_quantity is not null;

update public.herb_formulas
   set reorder_threshold_doses = null
 where reorder_threshold_doses is not null;

commit;

-- ---------------------------------------------------------------------------
-- 3 · What is left
-- ---------------------------------------------------------------------------

select 'herbs in the library'   as what, count(*) as total from public.herbs
union all
select 'herbs in the stock room', count(*) from public.herb_stock_levels where is_stocked
union all
select 'formulas in the library', count(*) from public.herb_formulas
union all
select 'formulas in the stock room', count(*) from public.formula_stock_levels where is_stocked
union all
select 'acupuncture points', count(*) from public.acupuncture_points
union all
select 'batches', count(*) from public.herb_batches
union all
select 'stock movements', count(*) from public.stock_movements
union all
select 'order list lines', count(*) from public.order_list;
