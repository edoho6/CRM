import type { SupabaseClient } from '@supabase/supabase-js';
import type { HerbStockLevel } from '@clinic/db/types';

/** Active herbs under their threshold, the emptiest first, at most twenty. */
export async function fetchLowStock(supabase: SupabaseClient): Promise<HerbStockLevel[]> {
  const { data, error } = await supabase
    .from('herb_stock_levels')
    .select('*')
    .eq('is_active', true)
    .eq('is_below_threshold', true)
    .order('total_remaining', { ascending: true })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as HerbStockLevel[];
}
