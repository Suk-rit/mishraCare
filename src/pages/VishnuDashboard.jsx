import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { clearSession } from '../utils/session';
import { getDateRange } from '../utils/analytics';
import RefreshButton from '../components/RefreshButton';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n) { return '₹' + Number(n||0).toLocaleString('en-IN', { maximumFractionDigits:0 }); }

const PERIODS = [
  { id:'week',    label:'7D'       },
  { id:'month',   label:'1M'       },
  { id:'3month',  label:'3M'       },
  { id:'6month',  label:'6M'       },
  { id:'1year',   label:'1Y'       },
  { id:'lifetime',label:'All Time' },
];

// ══════════════════════════════════════════════════════════════════
// ANALYTICS TAB
// ══════════════════════════════════════════════════════════════════
function VishnuAnalytics({ admins, storesMap, managersMap }) {
  const [period,       setPeriod]      = useState('month');
  const [loading,      setLoading]     = useState(true);
  const [chainSales,   setChainSales]  = useState(0);
  const [chainBills,   setChainBills]  = useState(0);
  const [chainExpenses,setChainExpenses]=useState(0);
  const [adminData,    setAdminData]   = useState([]); // per-admin rollup
  const [expandAdmin,  setExpandAdmin] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const { start, end } = getDateRange(period);
    const dateStr = start.split('T')[0];
    const endStr  = end.split('T')[0];

    // Fetch everything in parallel
    const [
      { data: bills },
      { data: storeExp },
      { data: adminExp },
      { data: devtaExp },
    ] = await Promise.all([
      supabase.from('bills')
        .select('id, store_id, total_amount, cash_amount, card_amount, upi_amount, created_at')
        .eq('status', 'paid')
        .gte('created_at', start)
        .lte('created_at', end),
      supabase.from('expenses')
        .select('store_id, amount, category, description, expense_date, proof_url')
        .gte('expense_date', dateStr)
        .lte('expense_date', endStr),
      supabase.from('admin_expenses')
        .select('admin_id, amount, category, description, expense_date, proof_url')
        .gte('expense_date', dateStr)
        .lte('expense_date', endStr),
      supabase.from('devta_expenses')
        .select('amount, description, expense_date')
        .gte('expense_date', dateStr)
        .lte('expense_date', endStr),
    ]);

    const allBills    = bills    || [];
    const allStoreExp = storeExp || [];
    const allAdminExp = adminExp || [];
    const allDevtaExp = devtaExp || [];

    // Chain totals
    const totalSales = allBills.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);
    const totalExp   = [...allStoreExp, ...allAdminExp, ...allDevtaExp].reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    setChainSales(totalSales);
    setChainBills(allBills.length);
    setChainExpenses(totalExp);

    // Build per-admin rollup
    // storesMap: { adminId: [store, ...] }
    const rollup = admins.map(admin => {
      const stores = storesMap[admin.id] || [];
      const storeIds = stores.map(s => s.id);

      // Bills for this admin's stores
      const adminBills = allBills.filter(b => storeIds.includes(b.store_id));
      const adminRevenue = adminBills.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);
      const adminCash    = adminBills.reduce((s, b) => s + parseFloat(b.cash_amount  || 0), 0);
      const adminUPI     = adminBills.reduce((s, b) => s + parseFloat(b.upi_amount   || 0), 0);
      const adminCard    = adminBills.reduce((s, b) => s + parseFloat(b.card_amount  || 0), 0);

      // Store expenses (from stores under this admin)
      const thisStoreExp = allStoreExp.filter(e => storeIds.includes(e.store_id));
      const storeExpTotal = thisStoreExp.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

      // Admin's own expenses
      const thisAdminExp = allAdminExp.filter(e => e.admin_id === admin.id);
      const adminExpTotal = thisAdminExp.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

      const totalAdminExp = storeExpTotal + adminExpTotal;

      // Per store breakdown
      const storeSummary = stores.map(store => {
        const sb = allBills.filter(b => b.store_id === store.id);
        const se = allStoreExp.filter(e => e.store_id === store.id);
        const storeRevenue = sb.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);
        const storeCash    = sb.reduce((s, b) => s + parseFloat(b.cash_amount  || 0), 0);
        const storeExpSum  = se.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
        const managers     = managersMap[store.id] || [];
        return {
          ...store,
          revenue:  storeRevenue,
          cash:     storeCash,
          expenses: storeExpSum,
          expList:  se,
          bills:    sb.length,
          managers,
        };
      });

      return {
        ...admin,
        revenue:       adminRevenue,
        cash:          adminCash,
        upi:           adminUPI,
        card:          adminCard,
        totalExpenses: totalAdminExp,
        storeExpenses: storeExpTotal,
        adminExpenses: adminExpTotal,
        adminExpList:  thisAdminExp,
        stores:        storeSummary,
        bills:         adminBills.length,
      };
    });

    setAdminData(rollup);
    setLoading(false);
  }, [period, admins, storesMap, managersMap]);

  useEffect(() => { load(); }, [load]);

  const chainNet = chainSales - chainExpenses;

  return (
    <div style={{ fontFamily:"'Inter',-apple-system,sans-serif" }}>

      {/* Period selector + refresh */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:3, background:'var(--bg-2)',
          border:'1px solid var(--bg-4)', borderRadius:12, padding:3,
          boxShadow:'var(--shadow-sm)' }}>
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              style={{ padding:'7px 14px', borderRadius:9, border:'none', cursor:'pointer',
                fontFamily:'inherit', fontSize:12, fontWeight:700, transition:'all 0.15s',
                background: period===p.id ? 'var(--bg-2)' : 'transparent',
                color: period===p.id ? '#7c3aed' : 'var(--label-4)',
                boxShadow: period===p.id ? 'var(--shadow-sm)' : 'none' }}>
              {p.label}
            </button>
          ))}
        </div>
        <RefreshButton onRefresh={load} />
      </div>

      {/* Chain KPI cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(175px,1fr))',
        gap:12, marginBottom:24 }}>
        {[
          { label:'Total Chain Sales',  value:fmt(chainSales),    color:'#7c3aed', bg:'#F5F3FF', sub:`${chainBills} bills` },
          { label:'Total Expenses',     value:fmt(chainExpenses), color:'#FF3B30', bg:'#FFF1F0', sub:'All admins + stores' },
          { label:'Net (Sales−Expense)',value:fmt(chainNet),      color:chainNet>=0?'#15803D':'#B91C1C', bg:chainNet>=0?'#F0FDF4':'#FEE2E2', sub:'Estimated balance' },
          { label:'Admins Active',      value:admins.length,      color:'#007AFF', bg:'#EFF6FF', sub:'Across chain' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            transition={{ delay:i*0.05 }}
            style={{ background:s.bg, border:`1px solid ${s.color}22`,
              borderRadius:'var(--radius-md)', padding:'16px 18px', boxShadow:'var(--shadow-sm)' }}>
            <div style={{ fontSize:10, fontWeight:700, color:s.color,
              textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:typeof s.value==='string'?22:28, fontWeight:800,
              color:s.color, lineHeight:1, marginBottom:3 }}>{loading ? '…' : s.value}</div>
            <div style={{ fontSize:11, color:'var(--label-4)' }}>{s.sub}</div>
          </motion.div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--label-4)', fontSize:14 }}>
          Loading financial data…
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {adminData.map(admin => {
            const isEx = expandAdmin[admin.id];
            return (
              <div key={admin.id} style={{ background:'var(--bg-2)',
                border:'1px solid var(--bg-4)', borderRadius:'var(--radius-lg)',
                overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>

                {/* Admin row */}
                <div style={{ padding:'16px 20px', display:'flex', alignItems:'center',
                  gap:14, cursor:'pointer', background: isEx ? '#FAF5FF' : 'var(--bg-2)' }}
                  onClick={() => setExpandAdmin(p => ({ ...p, [admin.id]: !p[admin.id] }))}>
                  <div style={{ width:44, height:44, borderRadius:'50%',
                    background:'linear-gradient(135deg,#7c3aed,#4f46e5)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:16, fontWeight:700, color:'#fff', flexShrink:0 }}>
                    {admin.full_name.slice(0,2).toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:'var(--label)', marginBottom:2 }}>
                      {admin.full_name}
                    </div>
                    <div style={{ fontSize:12, color:'var(--label-4)' }}>
                      {admin.email}{admin.city ? ` · ${admin.city}` : ''}
                      {admin.phone && (
                        <a href={`tel:${admin.phone}`} onClick={e => e.stopPropagation()}
                          style={{ marginLeft:8, color:'#7c3aed', fontWeight:700, textDecoration:'none' }}>
                          📞 {admin.phone}
                        </a>
                      )}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end' }}>
                    <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20,
                      background:'#F5F3FF', color:'#7c3aed', border:'1px solid #DDD6FE' }}>
                      📈 {fmt(admin.revenue)}
                    </span>
                    <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20,
                      background:'#FFF1F0', color:'#FF3B30', border:'1px solid #FECACA' }}>
                      💸 {fmt(admin.totalExpenses)}
                    </span>
                    <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20,
                      background:'#EFF6FF', color:'#1D4ED8', border:'1px solid #BFDBFE' }}>
                      {admin.bills} bills
                    </span>
                  </div>
                  <span style={{ fontSize:14, color:'var(--label-4)', flexShrink:0 }}>
                    {isEx ? '▲' : '▼'}
                  </span>
                </div>

                {/* Expanded: stores + expenses */}
                <AnimatePresence>
                  {isEx && (
                    <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }}
                      exit={{ height:0, opacity:0 }} style={{ overflow:'hidden' }}>
                      <div style={{ padding:'16px 20px', background:'var(--bg-3)',
                        borderTop:'1px solid var(--bg-4)' }}>

                        {/* Admin's own expenses */}
                        {admin.adminExpList.length > 0 && (
                          <div style={{ marginBottom:16 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'#7c3aed',
                              textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:8 }}>
                              💼 Warehouse / Admin Expenses — {fmt(admin.adminExpenses)}
                            </div>
                            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                              {admin.adminExpList.map((e, i) => (
                                <div key={i} style={{ display:'flex', alignItems:'center', gap:10,
                                  padding:'8px 12px', background:'var(--bg-2)', borderRadius:9,
                                  border:'1px solid var(--bg-4)' }}>
                                  <div style={{ flex:1, fontSize:12, color:'var(--label-2)',
                                    fontWeight:500 }}>
                                    {e.description}
                                    <span style={{ marginLeft:8, fontSize:10, color:'var(--label-4)',
                                      textTransform:'capitalize' }}>
                                      · {e.category?.replace(/_/g,' ')}
                                    </span>
                                  </div>
                                  <span style={{ fontSize:12, fontWeight:700, color:'#B91C1C',
                                    flexShrink:0 }}>{fmt(e.amount)}</span>
                                  {e.proof_url && (
                                    <a href={e.proof_url} target="_blank" rel="noreferrer"
                                      style={{ fontSize:11, color:'#007AFF', fontWeight:600,
                                        textDecoration:'underline', flexShrink:0 }}>
                                      Proof
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Stores */}
                        <div style={{ fontSize:11, fontWeight:700, color:'var(--label-4)',
                          textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:10 }}>
                          Stores ({admin.stores.length})
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                          {admin.stores.map(store => (
                            <div key={store.id} style={{ background:'var(--bg-2)',
                              border:'1px solid var(--bg-4)', borderRadius:12, overflow:'hidden' }}>
                              {/* Store header */}
                              <div style={{ padding:'12px 16px', display:'flex',
                                alignItems:'center', gap:12 }}>
                                <span style={{ fontSize:20 }}>🏪</span>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontSize:13, fontWeight:700, color:'var(--label)', marginBottom:1 }}>
                                    {store.store_name}
                                  </div>
                                  <div style={{ fontSize:11, color:'var(--label-4)' }}>
                                    {store.city}, {store.state} · {store.bills} bills
                                  </div>
                                </div>
                                <div style={{ display:'flex', gap:6, flexShrink:0, flexWrap:'wrap' }}>
                                  <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px',
                                    borderRadius:20, background:'#F5F3FF', color:'#7c3aed' }}>
                                    Sales: {fmt(store.revenue)}
                                  </span>
                                  <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px',
                                    borderRadius:20, background:'#FFF1F0', color:'#FF3B30' }}>
                                    Exp: {fmt(store.expenses)}
                                  </span>
                                  <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px',
                                    borderRadius:20, background:'#DCFCE7', color:'#15803D' }}>
                                    💵 Cash: {fmt(store.cash)}
                                  </span>
                                </div>
                              </div>

                              {/* Store expenses list */}
                              {store.expList.length > 0 && (
                                <div style={{ padding:'0 16px 12px', borderTop:'1px solid var(--bg-4)' }}>
                                  <div style={{ fontSize:10, fontWeight:700, color:'var(--label-4)',
                                    textTransform:'uppercase', letterSpacing:'0.5px',
                                    margin:'10px 0 7px' }}>
                                    Store Expenses
                                  </div>
                                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                                    {store.expList.map((e, i) => (
                                      <div key={i} style={{ display:'flex', alignItems:'center',
                                        gap:8, fontSize:11, color:'var(--label-3)' }}>
                                        <span style={{ flex:1 }}>
                                          {e.description}
                                          <span style={{ marginLeft:6, color:'var(--label-4)',
                                            textTransform:'capitalize' }}>
                                            · {e.category?.replace(/_/g,' ')}
                                          </span>
                                        </span>
                                        <span style={{ fontWeight:700, color:'#B91C1C',
                                          flexShrink:0 }}>{fmt(e.amount)}</span>
                                        {e.proof_url && (
                                          <a href={e.proof_url} target="_blank" rel="noreferrer"
                                            style={{ color:'#007AFF', fontWeight:600,
                                              textDecoration:'underline', flexShrink:0 }}>
                                            Proof
                                          </a>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Store manager contact */}
                              {store.managers.length > 0 && (
                                <div style={{ padding:'8px 16px 12px',
                                  borderTop:'1px solid var(--bg-4)',
                                  background:'rgba(0,0,0,0.02)' }}>
                                  {store.managers.map(m => (
                                    <div key={m.id} style={{ display:'flex', alignItems:'center',
                                      gap:8, fontSize:11, color:'var(--label-3)' }}>
                                      <div style={{ width:24, height:24, borderRadius:'50%',
                                        background:'#EFF6FF', display:'flex', alignItems:'center',
                                        justifyContent:'center', fontSize:9, fontWeight:700,
                                        color:'#1D4ED8', flexShrink:0 }}>
                                        {m.full_name.slice(0,2).toUpperCase()}
                                      </div>
                                      <span style={{ flex:1 }}>{m.full_name}</span>
                                      {m.phone && (
                                        <a href={`tel:${m.phone}`}
                                          style={{ color:'#007AFF', fontWeight:700,
                                            textDecoration:'none', flexShrink:0 }}>
                                          📞 {m.phone}
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// CASH REGISTER TAB
// ══════════════════════════════════════════════════════════════════
function CashRegister({ storesMap, managersMap, admins }) {
  const [loading,   setLoading]   = useState(true);
  const [cashData,  setCashData]  = useState([]); // per store summary
  const [period,    setPeriod]    = useState('month');

  const load = useCallback(async () => {
    setLoading(true);
    const { start, end } = getDateRange(period);

    // Fetch bills with payment splits
    const { data: bills } = await supabase
      .from('bills')
      .select('store_id, cash_amount, upi_amount, card_amount, total_amount')
      .eq('status', 'paid')
      .gte('created_at', start)
      .lte('created_at', end);

    const allBills = bills || [];

    // Build per-store cash summary
    const allStores = Object.values(storesMap).flat();
    const summary = allStores.map(store => {
      const sb = allBills.filter(b => b.store_id === store.id);
      const cash   = sb.reduce((s, b) => s + parseFloat(b.cash_amount  || 0), 0);
      const upi    = sb.reduce((s, b) => s + parseFloat(b.upi_amount   || 0), 0);
      const card   = sb.reduce((s, b) => s + parseFloat(b.card_amount  || 0), 0);
      const total  = sb.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);
      const mgrs   = managersMap[store.id] || [];
      // Find admin for this store
      const admin  = admins.find(a => (storesMap[a.id]||[]).some(s => s.id === store.id));
      return { ...store, cash, upi, card, total, managers: mgrs, adminName: admin?.full_name };
    }).filter(s => s.total > 0).sort((a, b) => b.cash - a.cash);

    setCashData(summary);
    setLoading(false);
  }, [period, storesMap, managersMap, admins]);

  useEffect(() => { load(); }, [load]);

  const totalCash = cashData.reduce((s, x) => s + x.cash, 0);
  const totalUPI  = cashData.reduce((s, x) => s + x.upi, 0);
  const totalCard = cashData.reduce((s, x) => s + x.card, 0);

  return (
    <div style={{ fontFamily:"'Inter',-apple-system,sans-serif" }}>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:16, fontWeight:700, color:'var(--label)', marginBottom:2 }}>
            💰 Cash & Payment Tracking
          </div>
          <div style={{ fontSize:13, color:'var(--label-4)' }}>
            How much cash is sitting in each store · click manager number to demand deposit
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ display:'flex', gap:3, background:'var(--bg-2)',
            border:'1px solid var(--bg-4)', borderRadius:12, padding:3 }}>
            {PERIODS.map(p => (
              <button key={p.id} onClick={() => setPeriod(p.id)}
                style={{ padding:'6px 12px', borderRadius:9, border:'none', cursor:'pointer',
                  fontFamily:'inherit', fontSize:11, fontWeight:700,
                  background: period===p.id ? 'var(--bg-2)' : 'transparent',
                  color: period===p.id ? '#7c3aed' : 'var(--label-4)',
                  boxShadow: period===p.id ? 'var(--shadow-sm)' : 'none' }}>
                {p.label}
              </button>
            ))}
          </div>
          <RefreshButton onRefresh={load} />
        </div>
      </div>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',
        gap:12, marginBottom:24 }}>
        {[
          { label:'Cash in Stores',   value:fmt(totalCash), color:'#15803D', bg:'#DCFCE7', icon:'💵' },
          { label:'UPI Collected',    value:fmt(totalUPI),  color:'#007AFF', bg:'#EFF6FF', icon:'📱' },
          { label:'Card Collected',   value:fmt(totalCard), color:'#5856D6', bg:'#F0EFFE', icon:'💳' },
          { label:'Stores with Cash', value:cashData.filter(s=>s.cash>0).length, color:'#FF9500', bg:'#FFFBEB', icon:'🏪' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            transition={{ delay:i*0.05 }}
            style={{ background:s.bg, border:`1px solid ${s.color}22`,
              borderRadius:14, padding:'14px 16px', boxShadow:'var(--shadow-sm)' }}>
            <div style={{ fontSize:22, marginBottom:6 }}>{s.icon}</div>
            <div style={{ fontSize:10, fontWeight:700, color:s.color,
              textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>
              {s.label}
            </div>
            <div style={{ fontSize:typeof s.value==='string'?20:26, fontWeight:800,
              color:s.color, lineHeight:1 }}>
              {loading ? '…' : s.value}
            </div>
          </motion.div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--label-4)', fontSize:14 }}>
          Loading…
        </div>
      ) : cashData.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px', background:'var(--bg-2)',
          borderRadius:16, border:'1px solid var(--bg-4)', color:'var(--label-4)', fontSize:14 }}>
          No billing data for this period
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {cashData.map((store, i) => (
            <motion.div key={store.id} initial={{ opacity:0, y:6 }}
              animate={{ opacity:1, y:0 }} transition={{ delay:i*0.04 }}
              style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)',
                borderRadius:14, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>

              {/* Store row */}
              <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:22 }}>🏪</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--label)', marginBottom:2 }}>
                    {store.store_name}
                    {store.adminName && (
                      <span style={{ marginLeft:8, fontSize:11, color:'var(--label-4)',
                        fontWeight:400 }}>under {store.adminName}</span>
                    )}
                  </div>
                  <div style={{ fontSize:11, color:'var(--label-4)' }}>
                    {store.city}, {store.state}
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, flexShrink:0, flexWrap:'wrap' }}>
                  {store.cash > 0 && (
                    <span style={{ fontSize:12, fontWeight:800, padding:'4px 12px',
                      borderRadius:20, background:'#DCFCE7', color:'#15803D',
                      border:'1px solid #BBF7D0' }}>
                      💵 Cash: {fmt(store.cash)}
                    </span>
                  )}
                  {store.upi > 0 && (
                    <span style={{ fontSize:12, fontWeight:700, padding:'4px 12px',
                      borderRadius:20, background:'#EFF6FF', color:'#1D4ED8',
                      border:'1px solid #BFDBFE' }}>
                      📱 UPI: {fmt(store.upi)}
                    </span>
                  )}
                  {store.card > 0 && (
                    <span style={{ fontSize:12, fontWeight:700, padding:'4px 12px',
                      borderRadius:20, background:'#F0EFFE', color:'#5856D6',
                      border:'1px solid #DDD6FE' }}>
                      💳 Card: {fmt(store.card)}
                    </span>
                  )}
                </div>
              </div>

              {/* Manager contacts */}
              {store.managers.length > 0 && (
                <div style={{ padding:'8px 18px 12px', borderTop:'1px solid var(--bg-4)',
                  background:'rgba(0,0,0,0.02)',
                  display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
                  <span style={{ fontSize:11, color:'var(--label-4)', fontWeight:600 }}>
                    Contact to deposit:
                  </span>
                  {store.managers.map(m => (
                    <div key={m.id} style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:'var(--label-2)' }}>
                        {m.full_name}
                      </span>
                      {m.phone && (
                        <a href={`tel:${m.phone}`}
                          style={{ fontSize:12, color:'#007AFF', fontWeight:700,
                            textDecoration:'none', background:'#EFF6FF',
                            padding:'3px 10px', borderRadius:20,
                            border:'1px solid #BFDBFE' }}>
                          📞 {m.phone}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN VISHNU DASHBOARD
// ══════════════════════════════════════════════════════════════════
export default function VishnuDashboard() {
  const navigate = useNavigate();
  const [tab,          setTab]          = useState('overview');
  const [admins,       setAdmins]       = useState([]);
  const [storesMap,    setStoresMap]    = useState({});
  const [managersMap,  setManagersMap]  = useState({});
  const [loading,      setLoading]      = useState(true);
  const [selectedAdmin,setSelectedAdmin]= useState(null);
  const [expandStore,  setExpandStore]  = useState({});
  const [stats,        setStats]        = useState({ admins:0, stores:0, managers:0, employees:0 });
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdmin,     setNewAdmin]     = useState({ email:'', password:'', full_name:'', phone:'', city:'', state:'', region:'', designation:'Area Admin' });
  const [addErr,       setAddErr]       = useState({});
  const [addLoading,   setAddLoading]   = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [
      { data: adminsData },
      { data: storesData },
      { data: managersData },
      { count: empCount },
    ] = await Promise.all([
      supabase.from('admins').select('*').eq('is_active', true).order('full_name'),
      supabase.from('stores').select('*').order('store_name'),
      supabase.from('store_managers').select('id,store_id,full_name,email,phone,designation,is_active').order('full_name'),
      supabase.from('employees').select('*', { count:'exact', head:true }).eq('status','approved'),
    ]);
    const sm = {};
    (storesData||[]).forEach(s => { if (!sm[s.admin_id]) sm[s.admin_id]=[]; sm[s.admin_id].push(s); });
    const mm = {};
    (managersData||[]).forEach(m => { if (!mm[m.store_id]) mm[m.store_id]=[]; mm[m.store_id].push(m); });
    setAdmins(adminsData||[]);
    setStoresMap(sm);
    setManagersMap(mm);
    setStats({ admins:(adminsData||[]).length, stores:(storesData||[]).length, managers:(managersData||[]).length, employees:empCount||0 });
    setLoading(false);
  };

  const handleLogout = () => { clearSession(); navigate('/login', { replace:true }); };
  const setAdminField = (k, v) => setNewAdmin(p => ({ ...p, [k]:v }));

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!newAdmin.email.trim())     errs.email    = 'Required';
    if (!newAdmin.password.trim())  errs.password = 'Required';
    if (!newAdmin.full_name.trim()) errs.full_name= 'Required';
    if (Object.keys(errs).length) { setAddErr(errs); return; }
    setAddLoading(true);
    try {
      const { error } = await supabase.from('admins').insert({
        email:        newAdmin.email.trim().toLowerCase(),
        password_hash:newAdmin.password,
        full_name:    newAdmin.full_name.trim(),
        phone:        newAdmin.phone.trim()   || null,
        city:         newAdmin.city.trim()    || null,
        state:        newAdmin.state.trim()   || null,
        region:       newAdmin.region.trim()  || null,
        designation:  newAdmin.designation    || 'Area Admin',
        is_active:    true,
      });
      if (error) throw new Error(error.message);
      setShowAddAdmin(false);
      setNewAdmin({ email:'', password:'', full_name:'', phone:'', city:'', state:'', region:'', designation:'Area Admin' });
      setAddErr({});
      fetchAll();
    } catch (err) {
      setAddErr({ submit: err.message });
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)',
      fontFamily:"'Inter',-apple-system,sans-serif", color:'var(--label)' }}>

      {/* Nav */}
      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 28px', height:56, background:'rgba(255,255,255,0.9)',
        backdropFilter:'blur(20px)', borderBottom:'1px solid var(--bg-4)',
        position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:22 }}>🕉️</span>
          <span style={{ fontWeight:800, fontSize:16, color:'var(--label)', letterSpacing:'-0.3px' }}>
            Vishnu <span style={{ color:'#7c3aed' }}>Control</span>
          </span>
          <span style={{ fontSize:10, fontWeight:700,
            background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff',
            padding:'2px 10px', borderRadius:20, textTransform:'uppercase',
            letterSpacing:'0.4px' }}>Super Admin</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <RefreshButton onRefresh={fetchAll} label="" />
          <button onClick={() => setShowAddAdmin(true)}
            style={{ background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'#fff',
              border:'none', borderRadius:10, padding:'8px 18px', fontSize:13, fontWeight:700,
              cursor:'pointer', fontFamily:'inherit',
              boxShadow:'0 3px 12px rgba(124,58,237,0.35)' }}>
            + Add Admin
          </button>
          <button onClick={handleLogout}
            style={{ background:'var(--bg-3)', border:'1px solid var(--bg-4)',
              color:'var(--label-3)', padding:'6px 14px', borderRadius:8, fontSize:13,
              cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>
            Logout
          </button>
        </div>
      </nav>

      <div style={{ padding:'28px', maxWidth:1300, margin:'0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:26, fontWeight:700, color:'var(--label)',
            letterSpacing:'-0.4px', marginBottom:4 }}>
            Welcome, <span style={{ color:'#7c3aed' }}>Vishnu</span> 🕉️
          </div>
          <div style={{ fontSize:14, color:'var(--label-4)' }}>
            Full system overview — all admins, stores and financial data
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',
          gap:12, marginBottom:20 }}>
          {[
            { label:'Admins',    value:stats.admins,    color:'#7c3aed', bg:'#F5F3FF' },
            { label:'Stores',    value:stats.stores,    color:'#FF3B30', bg:'#FFF1F0' },
            { label:'Managers',  value:stats.managers,  color:'#007AFF', bg:'#EFF6FF' },
            { label:'Employees', value:stats.employees, color:'#34C759', bg:'#F0FDF4' },
          ].map((s,i) => (
            <motion.div key={i} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }}
              transition={{ delay:i*0.06 }}
              style={{ background:s.bg, border:`1px solid ${s.color}22`,
                borderRadius:14, padding:'14px 16px', boxShadow:'var(--shadow-sm)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:s.color,
                textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>
                {s.label}
              </div>
              <div style={{ fontSize:28, fontWeight:800, color:s.color, lineHeight:1 }}>
                {loading ? '…' : s.value}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, background:'var(--bg-2)',
          border:'1px solid var(--bg-4)', borderRadius:12, padding:4,
          marginBottom:24, width:'fit-content', boxShadow:'var(--shadow-sm)' }}>
          {[
            { id:'overview',  label:'🏢 Org Chart'     },
            { id:'analytics', label:'📊 Analytics'     },
            { id:'cash',      label:'💰 Cash Register' },
            { id:'reports',   label:'📝 Reports'       },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding:'9px 20px', borderRadius:10, border:'none',
                cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600,
                transition:'all 0.18s',
                background: tab===t.id ? 'var(--bg-2)' : 'transparent',
                color: tab===t.id ? '#7c3aed' : 'var(--label-4)',
                boxShadow: tab===t.id ? 'var(--shadow-md)' : 'none' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {tab === 'analytics' && (
            <motion.div key="analytics"
              initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
              <VishnuAnalytics admins={admins} storesMap={storesMap} managersMap={managersMap} />
            </motion.div>
          )}
          {tab === 'cash' && (
            <motion.div key="cash"
              initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
              <CashRegister storesMap={storesMap} managersMap={managersMap} admins={admins} />
            </motion.div>
          )}
          {tab === 'overview' && (
            <motion.div key="overview"
              initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
              {loading ? (
                <div style={{ textAlign:'center', padding:60, color:'var(--label-4)', fontSize:14 }}>
                  Loading…
                </div>
              ) : (
                <div style={{ display:'flex', gap:20 }}>
                  {/* Admin list */}
                  <div style={{ width:280, flexShrink:0 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--label-4)',
                      textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:12 }}>
                      Admins ({admins.length})
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {admins.length === 0 ? (
                        <div style={{ padding:20, textAlign:'center', color:'var(--label-4)',
                          fontSize:13, background:'var(--bg-2)', borderRadius:'var(--radius-md)',
                          border:'1px solid var(--bg-4)' }}>No admins yet</div>
                      ) : admins.map(admin => {
                        const adminStores = storesMap[admin.id] || [];
                        const sel = selectedAdmin?.id === admin.id;
                        return (
                          <motion.button key={admin.id}
                            onClick={() => setSelectedAdmin(sel ? null : admin)}
                            whileTap={{ scale:0.97 }}
                            style={{ textAlign:'left', padding:'14px 16px',
                              background: sel ? '#F5F3FF' : 'var(--bg-2)',
                              border:`1.5px solid ${sel ? '#7c3aed' : 'var(--bg-4)'}`,
                              borderRadius:'var(--radius-md)', cursor:'pointer',
                              fontFamily:'inherit', transition:'all 0.18s',
                              boxShadow: sel ? '0 0 0 3px rgba(124,58,237,0.15)' : 'var(--shadow-sm)' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              <div style={{ width:36, height:36, borderRadius:'50%',
                                background:'linear-gradient(135deg,#7c3aed,#4f46e5)',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:13, fontWeight:700, color:'#fff', flexShrink:0 }}>
                                {admin.full_name.slice(0,2).toUpperCase()}
                              </div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:13, fontWeight:700,
                                  color: sel ? '#7c3aed' : 'var(--label)',
                                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                  {admin.full_name}
                                </div>
                                <div style={{ fontSize:11, color:'var(--label-4)', marginTop:1 }}>
                                  {admin.city || admin.region || 'No region'}
                                </div>
                              </div>
                              <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px',
                                borderRadius:20, background:'var(--accent-bg)',
                                color:'var(--accent)', flexShrink:0 }}>
                                {adminStores.length} stores
                              </span>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Admin detail */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <AnimatePresence mode="wait">
                      {!selectedAdmin ? (
                        <motion.div key="empty" initial={{ opacity:0 }} animate={{ opacity:1 }}
                          exit={{ opacity:0 }}
                          style={{ display:'flex', flexDirection:'column', alignItems:'center',
                            justifyContent:'center', padding:'80px 20px', background:'var(--bg-2)',
                            borderRadius:'var(--radius-lg)', border:'1px solid var(--bg-4)',
                            height:'100%', minHeight:300 }}>
                          <div style={{ fontSize:48, opacity:0.15, marginBottom:16 }}>🕉️</div>
                          <div style={{ fontSize:16, fontWeight:600, color:'var(--label-3)',
                            marginBottom:6 }}>Select an admin to view details</div>
                          <div style={{ fontSize:13, color:'var(--label-4)' }}>
                            Click any admin from the left panel
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div key={selectedAdmin.id}
                          initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }}
                          exit={{ opacity:0 }}>
                          {/* Admin info */}
                          <div style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)',
                            borderRadius:'var(--radius-lg)', padding:'20px 24px',
                            marginBottom:16, boxShadow:'var(--shadow-sm)' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
                              <div style={{ width:52, height:52, borderRadius:'50%',
                                background:'linear-gradient(135deg,#7c3aed,#4f46e5)',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:18, fontWeight:700, color:'#fff' }}>
                                {selectedAdmin.full_name.slice(0,2).toUpperCase()}
                              </div>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:18, fontWeight:700, color:'var(--label)',
                                  marginBottom:3 }}>{selectedAdmin.full_name}</div>
                                <div style={{ fontSize:13, color:'var(--label-4)' }}>
                                  {selectedAdmin.email}
                                  {selectedAdmin.phone && (
                                    <a href={`tel:${selectedAdmin.phone}`}
                                      style={{ marginLeft:10, color:'#7c3aed', fontWeight:700,
                                        textDecoration:'none' }}>
                                      📞 {selectedAdmin.phone}
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div style={{ display:'grid',
                              gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',
                              gap:12, padding:14, background:'var(--bg-3)',
                              borderRadius:'var(--radius-md)', border:'1px solid var(--bg-4)' }}>
                              {[
                                { label:'Designation', value:selectedAdmin.designation },
                                { label:'City',        value:selectedAdmin.city   },
                                { label:'State',       value:selectedAdmin.state  },
                                { label:'Region',      value:selectedAdmin.region },
                              ].map((r,i) => (
                                <div key={i}>
                                  <div style={{ fontSize:10, fontWeight:700, color:'var(--label-4)',
                                    textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:3 }}>
                                    {r.label}
                                  </div>
                                  <div style={{ fontSize:13, color: r.value ? 'var(--label-2)' : 'var(--label-4)',
                                    fontWeight:500 }}>{r.value || '—'}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Stores */}
                          <div style={{ fontSize:13, fontWeight:700, color:'var(--label)', marginBottom:12 }}>
                            Stores ({(storesMap[selectedAdmin.id]||[]).length})
                          </div>
                          {(storesMap[selectedAdmin.id]||[]).length === 0 ? (
                            <div style={{ textAlign:'center', padding:'40px 20px',
                              background:'var(--bg-2)', borderRadius:'var(--radius-lg)',
                              border:'1px solid var(--bg-4)', color:'var(--label-4)', fontSize:13 }}>
                              No stores assigned
                            </div>
                          ) : (storesMap[selectedAdmin.id]||[]).map(store => {
                            const mgrs = managersMap[store.id] || [];
                            const isEx = expandStore[store.id];
                            return (
                              <div key={store.id} style={{ background:'var(--bg-2)',
                                border:'1px solid var(--bg-4)', borderRadius:'var(--radius-lg)',
                                overflow:'hidden', boxShadow:'var(--shadow-sm)', marginBottom:10 }}>
                                <div style={{ padding:'14px 18px', display:'flex',
                                  alignItems:'center', gap:12, cursor:'pointer' }}
                                  onClick={() => setExpandStore(p => ({...p,[store.id]:!p[store.id]}))}>
                                  <span style={{ fontSize:20 }}>🏪</span>
                                  <div style={{ flex:1 }}>
                                    <div style={{ fontSize:14, fontWeight:700, color:'var(--label)',
                                      marginBottom:2 }}>{store.store_name}</div>
                                    <div style={{ fontSize:12, color:'var(--label-4)' }}>
                                      {store.city}, {store.state}
                                    </div>
                                  </div>
                                  <span style={{ fontSize:14, color:'var(--label-4)' }}>
                                    {isEx ? '▲' : '▼'}
                                  </span>
                                </div>
                                <AnimatePresence>
                                  {isEx && (
                                    <motion.div initial={{ height:0,opacity:0 }}
                                      animate={{ height:'auto',opacity:1 }}
                                      exit={{ height:0,opacity:0 }} style={{ overflow:'hidden' }}>
                                      <div style={{ padding:'14px 18px', background:'var(--bg-3)',
                                        borderTop:'1px solid var(--bg-4)' }}>
                                        {mgrs.map(m => (
                                          <div key={m.id} style={{ display:'flex',
                                            alignItems:'center', gap:10, padding:'8px 12px',
                                            background:'var(--bg-2)', borderRadius:10,
                                            border:'1px solid var(--bg-4)', marginBottom:6 }}>
                                            <div style={{ flex:1 }}>
                                              <div style={{ fontSize:13, fontWeight:600,
                                                color:'var(--label)' }}>{m.full_name}</div>
                                              <div style={{ fontSize:11, color:'var(--label-4)' }}>
                                                {m.email}
                                              </div>
                                            </div>
                                            {m.phone && (
                                              <a href={`tel:${m.phone}`}
                                                style={{ fontSize:12, color:'#007AFF',
                                                  fontWeight:700, textDecoration:'none',
                                                  background:'#EFF6FF', padding:'4px 10px',
                                                  borderRadius:20, border:'1px solid #BFDBFE' }}>
                                                📞 {m.phone}
                                              </a>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Reports tab ── */}
          {tab === 'reports' && (
            <motion.div key="reports"
              initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
              <VishnuReports />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Add Admin Modal — unchanged */}
      <AnimatePresence>
        {showAddAdmin && (
          <div style={{ position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.35)',
            backdropFilter:'blur(6px)',display:'flex',alignItems:'center',
            justifyContent:'center',padding:20 }}
            onClick={e => e.target===e.currentTarget && setShowAddAdmin(false)}>
            <motion.div initial={{ opacity:0,scale:0.95,y:20 }}
              animate={{ opacity:1,scale:1,y:0 }} exit={{ opacity:0,scale:0.95,y:20 }}
              style={{ background:'var(--bg-2)',border:'1px solid var(--bg-4)',
                borderRadius:'var(--radius-xl)',width:'100%',maxWidth:480,
                boxShadow:'var(--shadow-float)',overflow:'hidden' }}>
              <div style={{ padding:'22px 26px 18px',borderBottom:'1px solid var(--bg-4)',
                display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:17,fontWeight:700,color:'var(--label)' }}>➕ Add New Admin</div>
                  <div style={{ fontSize:13,color:'var(--label-4)',marginTop:2 }}>Email and password required</div>
                </div>
                <button onClick={() => setShowAddAdmin(false)}
                  style={{ width:30,height:30,borderRadius:'50%',background:'var(--bg-3)',
                    border:'1px solid var(--bg-4)',cursor:'pointer',fontSize:14,
                    color:'var(--label-3)',display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
              </div>
              <form onSubmit={handleAddAdmin}
                style={{ padding:'22px 26px',display:'flex',flexDirection:'column',gap:14 }}>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
                  {[
                    { k:'email',       label:'Email Address *', ph:'admin@mishracare.com', type:'email'    },
                    { k:'password',    label:'Password *',      ph:'Strong password',      type:'password' },
                    { k:'full_name',   label:'Full Name *',     ph:'Ramesh Kumar'                          },
                    { k:'phone',       label:'Phone',           ph:'+91 98765 43210'                       },
                    { k:'city',        label:'City',            ph:'Greater Noida'                         },
                    { k:'state',       label:'State',           ph:'Uttar Pradesh'                         },
                    { k:'region',      label:'Region',          ph:'NCR'                                   },
                    { k:'designation', label:'Designation',     ph:'Area Admin'                            },
                  ].map(f => (
                    <div key={f.k} style={{ display:'flex',flexDirection:'column',gap:5 }}>
                      <label style={{ fontSize:12,fontWeight:600,color:'var(--label-3)' }}>{f.label}</label>
                      <input type={f.type||'text'} value={newAdmin[f.k]}
                        onChange={e => setAdminField(f.k, e.target.value)} placeholder={f.ph}
                        style={{ padding:'9px 12px',border:`1.5px solid ${addErr[f.k]?'var(--accent)':'var(--bg-4)'}`,
                          borderRadius:10,fontSize:13,fontFamily:'inherit',color:'var(--label)',
                          background:'var(--bg-3)',outline:'none' }}
                        onFocus={e=>e.target.style.borderColor='#7c3aed'}
                        onBlur={e=>e.target.style.borderColor=addErr[f.k]?'var(--accent)':'var(--bg-4)'} />
                      {addErr[f.k] && <span style={{ fontSize:11,color:'var(--error-text)' }}>{addErr[f.k]}</span>}
                    </div>
                  ))}
                </div>
                {addErr.submit && (
                  <div style={{ padding:'10px 14px',background:'#FEE2E2',border:'1px solid #FECACA',
                    borderRadius:8,fontSize:13,color:'#B91C1C' }}>⚠️ {addErr.submit}</div>
                )}
                <div style={{ display:'flex',gap:10,justifyContent:'flex-end',marginTop:4 }}>
                  <button type="button" onClick={() => setShowAddAdmin(false)}
                    style={{ background:'var(--bg-3)',border:'1px solid var(--bg-4)',
                      color:'var(--label-3)',padding:'9px 20px',borderRadius:10,fontSize:13,
                      fontWeight:600,cursor:'pointer',fontFamily:'inherit' }}>Cancel</button>
                  <button type="submit" disabled={addLoading}
                    style={{ background:'linear-gradient(135deg,#7c3aed,#4f46e5)',color:'#fff',
                      border:'none',padding:'9px 24px',borderRadius:10,fontSize:13,fontWeight:700,
                      cursor:'pointer',fontFamily:'inherit',
                      boxShadow:'0 3px 12px rgba(124,58,237,0.35)' }}>
                    {addLoading ? '⏳ Adding…' : '+ Add Admin'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── VishnuReports ────────────────────────────────────────────────────────────
function VishnuReports() {
  const [reports,    setReports]   = useState([]);
  const [loading,    setLoading]   = useState(true);
  const [showForm,   setShowForm]  = useState(false);
  const [saving,     setSaving]    = useState(false);
  const [form, setForm] = useState({
    title:       '',
    period_from: '',
    period_to:   new Date().toISOString().split('T')[0],
    notes:       '',
  });

  useEffect(() => { fetchReports(); }, []);

  const fetchReports = async () => {
    setLoading(true);
    const { data } = await supabase.from('vishnu_reports')
      .select('*').order('created_at', { ascending: false });
    setReports(data || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.title.trim())   { alert('Title required'); return; }
    if (!form.period_from)    { alert('Select start date'); return; }
    if (!form.period_to)      { alert('Select end date'); return; }
    setSaving(true);
    try {
      // Fetch financial snapshot for the period
      const start = form.period_from + 'T00:00:00';
      const end   = form.period_to   + 'T23:59:59';
      const [{ data: bills }, { data: storeExp }, { data: adminExp }, { data: devtaExp }] =
        await Promise.all([
          supabase.from('bills').select('total_amount').eq('status','paid').gte('created_at',start).lte('created_at',end),
          supabase.from('expenses').select('amount').gte('expense_date',form.period_from).lte('expense_date',form.period_to),
          supabase.from('admin_expenses').select('amount').gte('expense_date',form.period_from).lte('expense_date',form.period_to),
          supabase.from('devta_expenses').select('amount').gte('expense_date',form.period_from).lte('expense_date',form.period_to),
        ]);

      const totalSales = (bills||[]).reduce((s,b) => s + parseFloat(b.total_amount||0), 0);
      const totalExp   = [...(storeExp||[]), ...(adminExp||[]), ...(devtaExp||[])]
        .reduce((s, e) => s + parseFloat(e.amount||0), 0);

      const { error } = await supabase.from('vishnu_reports').insert({
        title:        form.title.trim(),
        period_from:  form.period_from,
        period_to:    form.period_to,
        notes:        form.notes.trim() || null,
        total_sales:  totalSales,
        total_expenses: totalExp,
      });
      if (error) throw new Error(error.message);
      setShowForm(false);
      setForm({ title:'', period_from:'', period_to: new Date().toISOString().split('T')[0], notes:'' });
      fetchReports();
    } catch (ex) { alert('Error: ' + ex.message); }
    finally { setSaving(false); }
  };

  const fmtMoney = n => '₹' + Number(n||0).toLocaleString('en-IN', { maximumFractionDigits:0 });
  const fmtDate  = d => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';

  return (
    <div style={{ fontFamily:"'Inter',-apple-system,sans-serif" }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
        marginBottom:22, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:'var(--label)', letterSpacing:'-0.3px', marginBottom:3 }}>
            📝 Reports
          </div>
          <div style={{ fontSize:13, color:'var(--label-4)' }}>
            Create financial reports for any period. Snapshot saved permanently.
          </div>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          style={{ padding:'10px 22px', background:'linear-gradient(135deg,#7c3aed,#4f46e5)',
            color:'#fff', border:'none', borderRadius:12, fontSize:13, fontWeight:700,
            cursor:'pointer', fontFamily:'inherit', boxShadow:'0 3px 12px rgba(124,58,237,0.3)' }}>
          + Create Report
        </button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
            exit={{ opacity:0, y:-8 }}
            style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)', borderRadius:16,
              padding:'22px 24px', marginBottom:24, boxShadow:'var(--shadow-sm)' }}>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--label)', marginBottom:16 }}>
              New Report
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:12, marginBottom:12 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--label-3)', display:'block', marginBottom:4 }}>
                  Report Title *
                </label>
                <input value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Q3 2026 Financial Summary"
                  style={{ width:'100%', padding:'9px 12px', fontSize:13, border:'1.5px solid var(--bg-4)',
                    borderRadius:9, background:'var(--bg-3)', color:'var(--label)',
                    fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
              </div>
              {[
                { k:'period_from', label:'From Date *' },
                { k:'period_to',   label:'To Date *'   },
              ].map(f => (
                <div key={f.k}>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--label-3)',
                    display:'block', marginBottom:4 }}>{f.label}</label>
                  <input type="date" value={form[f.k]}
                    onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))}
                    style={{ width:'100%', padding:'9px 12px', fontSize:13,
                      border:'1.5px solid var(--bg-4)', borderRadius:9,
                      background:'var(--bg-3)', color:'var(--label)',
                      fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'var(--label-3)',
                display:'block', marginBottom:4 }}>Notes / Observations</label>
              <textarea value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Write your notes, observations, or anything important about this period…"
                style={{ width:'100%', minHeight:90, padding:'9px 12px', fontSize:13,
                  border:'1.5px solid var(--bg-4)', borderRadius:9, background:'var(--bg-3)',
                  color:'var(--label)', fontFamily:'inherit', outline:'none',
                  resize:'vertical', boxSizing:'border-box' }} />
            </div>
            <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:9,
              padding:'9px 14px', fontSize:12, color:'#1D4ED8', marginBottom:14 }}>
              💡 Financial snapshot (total sales & expenses) will be automatically calculated for this period and saved with the report.
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setShowForm(false)}
                style={{ padding:'9px 20px', background:'var(--bg-3)', border:'1px solid var(--bg-4)',
                  color:'var(--label-3)', borderRadius:10, fontSize:13, fontWeight:600,
                  cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving}
                style={{ padding:'9px 24px', background:'linear-gradient(135deg,#7c3aed,#4f46e5)',
                  color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:700,
                  cursor:'pointer', fontFamily:'inherit',
                  boxShadow:'0 3px 12px rgba(124,58,237,0.3)' }}>
                {saving ? '⏳ Saving…' : '💾 Save Report'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reports list */}
      {loading ? (
        <div style={{ textAlign:'center', padding:50, color:'var(--label-4)', fontSize:14 }}>Loading…</div>
      ) : reports.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px', background:'var(--bg-2)',
          borderRadius:16, border:'1px solid var(--bg-4)' }}>
          <div style={{ fontSize:48, opacity:0.15, marginBottom:14 }}>📝</div>
          <div style={{ fontSize:16, fontWeight:600, color:'var(--label-3)', marginBottom:6 }}>No reports yet</div>
          <div style={{ fontSize:13, color:'var(--label-4)' }}>Create your first report above</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {reports.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
              transition={{ delay:i*0.04 }}
              style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)', borderRadius:16,
                overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
              {/* Header */}
              <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--bg-4)',
                display:'flex', alignItems:'flex-start', gap:14 }}>
                <div style={{ width:42, height:42, borderRadius:12,
                  background:'linear-gradient(135deg,#7c3aed,#4f46e5)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:20, color:'#fff', flexShrink:0 }}>📝</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--label)', marginBottom:3 }}>
                    {r.title}
                  </div>
                  <div style={{ fontSize:12, color:'var(--label-4)', display:'flex', gap:10, flexWrap:'wrap' }}>
                    <span>📅 {fmtDate(r.period_from)} → {fmtDate(r.period_to)}</span>
                    <span>Created: {fmtDate(r.created_at)}</span>
                  </div>
                </div>
                {/* Financial snapshot */}
                <div style={{ display:'flex', gap:8, flexShrink:0, flexWrap:'wrap' }}>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#007AFF', textTransform:'uppercase', letterSpacing:'0.4px' }}>Sales</div>
                    <div style={{ fontSize:15, fontWeight:800, color:'#007AFF' }}>{fmtMoney(r.total_sales)}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#FF3B30', textTransform:'uppercase', letterSpacing:'0.4px' }}>Expenses</div>
                    <div style={{ fontSize:15, fontWeight:800, color:'#FF3B30' }}>{fmtMoney(r.total_expenses)}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:r.net_amount>=0?'#15803D':'#B91C1C', textTransform:'uppercase', letterSpacing:'0.4px' }}>Net</div>
                    <div style={{ fontSize:15, fontWeight:800, color:r.net_amount>=0?'#15803D':'#B91C1C' }}>{fmtMoney(r.net_amount)}</div>
                  </div>
                </div>
              </div>
              {/* Notes */}
              {r.notes && (
                <div style={{ padding:'12px 20px', fontSize:13, color:'var(--label-3)',
                  background:'var(--bg-3)', fontStyle:'italic', lineHeight:1.6 }}>
                  "{r.notes}"
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
