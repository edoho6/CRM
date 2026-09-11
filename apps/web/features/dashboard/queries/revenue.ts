import type { SupabaseClient } from '@supabase/supabase-js';

export interface RevenueStats {
  collectedThisMonth: number;
  outstanding: number;
  invoicesThisMonth: number;
}

export async function fetchRevenueStats(
  supabase: SupabaseClient,
  monthStartIso: string,
): Promise<RevenueStats> {
  const [paidResult, openResult, invoicesResult] = await Promise.all([
    supabase.from('payments').select('amount').eq('status', 'paid').gte('paid_at', monthStartIso),
    supabase
      .from('invoices')
      .select('total, amount_paid')
      .in('status', ['sent', 'partially_paid']),
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStartIso)
      .neq('status', 'cancelled'),
  ]);

  if (paidResult.error) throw new Error(paidResult.error.message);
  if (openResult.error) throw new Error(openResult.error.message);

  const collected = (paidResult.data ?? []).reduce(
    (sum, row) => sum + Number((row as { amount: number }).amount),
    0,
  );
  const outstanding = (openResult.data ?? []).reduce((sum, row) => {
    const invoice = row as { total: number; amount_paid: number };
    return sum + Math.max(0, Number(invoice.total) - Number(invoice.amount_paid));
  }, 0);

  return {
    collectedThisMonth: collected,
    outstanding,
    invoicesThisMonth: invoicesResult.count ?? 0,
  };
}
