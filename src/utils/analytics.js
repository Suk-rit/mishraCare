import { supabase } from './supabase';

// ── Date range helpers ────────────────────────────────────────────────────────
export function getDateRange(period) {
  const now = new Date();
  const start = new Date();
  switch (period) {
    case 'week':    start.setDate(now.getDate() - 7);     break;
    case 'month':   start.setMonth(now.getMonth() - 1);   break;
    case '3month':  start.setMonth(now.getMonth() - 3);   break;
    case '6month':  start.setMonth(now.getMonth() - 6);   break;
    case '1year':   start.setFullYear(now.getFullYear()-1);break;
    case '5year':   start.setFullYear(now.getFullYear()-5);break;
    case 'lifetime':return { start: '2000-01-01', end: now.toISOString() };
    default:        start.setMonth(now.getMonth() - 1);
  }
  return { start: start.toISOString(), end: now.toISOString() };
}

// ── Fetch sales summary for a store ──────────────────────────────────────────
export async function fetchStoreSales(storeId, period) {
  const { start, end } = getDateRange(period);
  const { data: bills } = await supabase
    .from('bills')
    .select('id, total_amount, total_cost, gross_profit, discount_amount, tax_amount, created_at, status')
    .eq('store_id', storeId)
    .eq('status', 'paid')
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at');
  return bills || [];
}

// ── Fetch bill items for top medicines ────────────────────────────────────────
export async function fetchTopMedicines(storeId, period, limit = 10) {
  const { start, end } = getDateRange(period);
  // Get bills in range
  const { data: bills } = await supabase
    .from('bills')
    .select('id')
    .eq('store_id', storeId)
    .eq('status', 'paid')
    .gte('created_at', start)
    .lte('created_at', end);
  if (!bills || bills.length === 0) return [];
  const billIds = bills.map(b => b.id);

  const { data: items } = await supabase
    .from('bill_items')
    .select('medicine_id, medicine_name, quantity_units, line_total, line_profit')
    .in('bill_id', billIds);

  // Aggregate
  const map = {};
  (items || []).forEach(i => {
    if (!map[i.medicine_id]) map[i.medicine_id] = { name: i.medicine_name, qty: 0, revenue: 0, profit: 0 };
    map[i.medicine_id].qty     += i.quantity_units || 0;
    map[i.medicine_id].revenue += parseFloat(i.line_total || 0);
    map[i.medicine_id].profit  += parseFloat(i.line_profit || 0);
  });
  return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, limit);
}

// ── Fetch expenses for a store ────────────────────────────────────────────────
export async function fetchStoreExpenses(storeId, period) {
  const { start, end } = getDateRange(period);
  const { data } = await supabase
    .from('expenses')
    .select('*')
    .eq('store_id', storeId)
    .gte('expense_date', start.split('T')[0])
    .lte('expense_date', end.split('T')[0])
    .order('expense_date', { ascending: false });
  return data || [];
}

// ── Fetch all stores summary for admin ────────────────────────────────────────
export async function fetchAllStoresSummary(period) {
  const { start, end } = getDateRange(period);
  const { data: bills } = await supabase
    .from('bills')
    .select('store_id, total_amount, total_cost, gross_profit, discount_amount, created_at')
    .eq('status', 'paid')
    .gte('created_at', start)
    .lte('created_at', end);

  const { data: expenses } = await supabase
    .from('expenses')
    .select('store_id, amount, category')
    .gte('expense_date', start.split('T')[0])
    .lte('expense_date', end.split('T')[0]);

  // Aggregate by store
  const storeMap = {};
  (bills || []).forEach(b => {
    if (!storeMap[b.store_id]) storeMap[b.store_id] = { revenue: 0, cost: 0, profit: 0, bills: 0, expenses: 0 };
    storeMap[b.store_id].revenue += parseFloat(b.total_amount || 0);
    storeMap[b.store_id].cost    += parseFloat(b.total_cost   || 0);
    storeMap[b.store_id].profit  += parseFloat(b.gross_profit || 0);
    storeMap[b.store_id].bills   += 1;
  });
  (expenses || []).forEach(e => {
    if (e.store_id) {
      if (!storeMap[e.store_id]) storeMap[e.store_id] = { revenue: 0, cost: 0, profit: 0, bills: 0, expenses: 0 };
      storeMap[e.store_id].expenses += parseFloat(e.amount || 0);
    }
  });
  return storeMap;
}

// ── Group bills by day/week/month for charts ──────────────────────────────────
export function groupBillsByPeriod(bills, period) {
  const groups = {};
  bills.forEach(b => {
    const d = new Date(b.created_at);
    let key;
    if (['week', 'month'].includes(period)) {
      key = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    } else if (['3month', '6month'].includes(period)) {
      key = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    } else {
      key = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    }
    if (!groups[key]) groups[key] = { revenue: 0, profit: 0, bills: 0 };
    groups[key].revenue += parseFloat(b.total_amount || 0);
    groups[key].profit  += parseFloat(b.gross_profit || 0);
    groups[key].bills   += 1;
  });
  return Object.entries(groups).map(([label, v]) => ({ label, ...v }));
}
