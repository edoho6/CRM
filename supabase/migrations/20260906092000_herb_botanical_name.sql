-- ============================================================================
-- 11 · Botanical names for herbs
-- ============================================================================
-- Pinyin is what a practitioner says, Chinese characters are what the supplier's
-- label shows, and the botanical binomial is what identifies the plant
-- unambiguously across languages and suppliers. They are three different things,
-- so the botanical name gets its own column rather than being folded into the
-- English common name.
-- ============================================================================

alter table public.herbs
  add column if not exists botanical_name text;

comment on column public.herbs.botanical_name is
  'Latin binomial and plant part, e.g. "Astragalus membranaceus (Radix)". The unambiguous identifier across suppliers and languages.';

create index if not exists herbs_botanical_trgm_idx
  on public.herbs using gin (botanical_name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Backfill the starter catalogue
-- ---------------------------------------------------------------------------
-- Matched on pinyin, and only where the column is still empty, so a name the
-- practitioner has already corrected by hand is never overwritten.

-- ---------------------------------------------------------------------------
-- The stock view has to carry the new column too
-- ---------------------------------------------------------------------------
-- Recreated rather than altered: a view's column list is fixed at creation, and
-- every screen that reads stock levels expects the botanical name alongside.

-- The dependent view is dropped first. It does not exist yet the first time
-- this migration runs, which is what `if exists` is for; on a database that has
-- already reached migration 094000 it does, and Postgres will refuse to drop
-- what it stands on. Migration 094000 rebuilds it.
drop view if exists public.formula_stock_levels;
drop view if exists public.herb_stock_levels;

create view public.herb_stock_levels
with (security_invoker = on)
as
select
  h.id as herb_id,
  h.clinic_id,
  h.pinyin_name,
  h.chinese_name,
  h.english_name,
  h.hebrew_name,
  h.botanical_name,
  h.category,
  h.default_unit,
  h.reorder_threshold,
  h.reorder_quantity,
  h.is_active,
  coalesce(sum(b.quantity_remaining), 0)::numeric(12, 3) as total_remaining,
  count(b.id) filter (where b.quantity_remaining > 0) as batch_count,
  min(b.expiry_date) filter (where b.quantity_remaining > 0) as nearest_expiry,
  (
    h.reorder_threshold is not null
    and coalesce(sum(b.quantity_remaining), 0) <= h.reorder_threshold
  ) as is_below_threshold
from public.herbs h
left join public.herb_batches b
  on b.herb_id = h.id
 and b.quantity_remaining > 0
group by h.id;

-- ---------------------------------------------------------------------------
-- Backfill the starter catalogue
-- ---------------------------------------------------------------------------

update public.herbs h
   set botanical_name = v.botanical
  from (values
    ('Huang Qi',       'Astragalus membranaceus (Radix)'),
    ('Dang Gui',       'Angelica sinensis (Radix)'),
    ('Bai Shao',       'Paeonia lactiflora (Radix, prepared)'),
    ('Chuan Xiong',    'Ligusticum chuanxiong (Rhizoma)'),
    ('Shu Di Huang',   'Rehmannia glutinosa (Radix preparata)'),
    ('Sheng Di Huang', 'Rehmannia glutinosa (Radix)'),
    ('Ren Shen',       'Panax ginseng (Radix)'),
    ('Dang Shen',      'Codonopsis pilosula (Radix)'),
    ('Bai Zhu',        'Atractylodes macrocephala (Rhizoma)'),
    ('Fu Ling',        'Poria cocos (Sclerotium)'),
    ('Gan Cao',        'Glycyrrhiza uralensis (Radix)'),
    ('Chen Pi',        'Citrus reticulata (Pericarpium)'),
    ('Ban Xia',        'Pinellia ternata (Rhizoma preparatum)'),
    ('Chai Hu',        'Bupleurum chinense (Radix)'),
    ('Huang Qin',      'Scutellaria baicalensis (Radix)'),
    ('Huang Lian',     'Coptis chinensis (Rhizoma)'),
    ('Jin Yin Hua',    'Lonicera japonica (Flos)'),
    ('Lian Qiao',      'Forsythia suspensa (Fructus)'),
    ('Gui Zhi',        'Cinnamomum cassia (Ramulus)'),
    ('Sheng Jiang',    'Zingiber officinale (Rhizoma recens)'),
    ('Da Zao',         'Ziziphus jujuba (Fructus)'),
    ('Suan Zao Ren',   'Ziziphus jujuba var. spinosa (Semen)'),
    ('Mu Dan Pi',      'Paeonia suffruticosa (Cortex)'),
    ('Zhi Zi',         'Gardenia jasminoides (Fructus)'),
    ('Bo He',          'Mentha haplocalyx (Herba)'),
    ('Fang Feng',      'Saposhnikovia divaricata (Radix)'),
    ('Gou Qi Zi',      'Lycium barbarum (Fructus)'),
    ('Shan Yao',       'Dioscorea opposita (Rhizoma)')
  ) as v(pinyin, botanical)
 where h.pinyin_name = v.pinyin
   and h.botanical_name is null;
