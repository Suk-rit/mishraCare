/**
 * AdminAnalytics — EXPENSES ONLY view for admin
 * Shows: store expenses + admin region expenses (salary, travel, etc.)
 * Does NOT show revenue, profit or sales data — those are Vishnu-only.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import { getDateRange } from '../utils/analytics';
import RefreshButton from '../components/RefreshButton';
import ExpenseForm from '../components/ExpenseForm';
import AdminExpenseForm from '../components/AdminExpenseForm';
import { getSession } from '../utils/session';

const PERIODS = [
  { id:'week',    label:'7D'       },
  { id:'month',   label:'1M'       },
  { id:'3month',  label:'3M'       },
  { id:'6month',  label:'6M'       },
  { id:'1year',   label:'1Y'       },
  { id:'lifetime',label:'All Time' },
];

const CAT_ICONS = {
  inventory:'📦', salary:'👤', rent:'🏢', utilities:'💡',
  maintenance:'🔧', transport:'🚚', marketing:'📢', other:'💰',
  inventory_transport:'🚚', staff_salary:'👤', office_rent:'🏢',
  travel:'✈️', bank_charges:'🏦', miscellaneous:'📦',
};

function fmt(n) { return '₹' + Number(n||0).toLocaleString('en-IN', { maximumFractionDigits:0 }); }

export default function AdminAnalytics({ adminId }) {
  const session = getSession();

  const [period,         setPeriod]         = useState('month');
  const [stores,         setStores]         = useState([]);
  const [storeExpenses,  setStoreExpenses]  = useState([]); // expenses from stores
  const [adminExpenses,  setAdminExpenses]  = useState([]); // admin_expenses table
  const [loading,        setLoading]        = useState(true);
  const [showStoreExp,   setShowStoreExp]   = useState(false);
  const [showAdminExp,   setShowAdminExp]   = useState(false);
  const [selectedStore,  setSelectedStore]  = useState(null);

  useEffect(() => { loadStores(); }, []);
  useEffect(() => { loadData(); }, [period]);

  const loadStores = async () => {
    const { data } = await supabase.from('stores').select('id, store_name, city, state').eq('is_active', true);
    setStores(data || []);
  };

  const loadData = async () => {
    setLoading(true);
    const { start, end } = getDateRange(period);
    const dateStr = start.split('T')[0];
    const endStr  = end.split('T')[0];

    const [{ data: stExp }, { data: adExp }] = await Promise.all([
      // Store-level expenses (from existing expenses table)
      supabase.from('expenses')
        .select('*, stores(store_name, city)')
        .gte('expense_date', dateStr)
        .lte('expense_date', endStr)
        .order('expense_date', { ascending: false }),
      // Admin-level expenses (warehouse, salary, travel etc.)
      supabase.from('admin_expenses')
        .select('*')
        .eq('admin_id', adminId || 'none')
        .gte('expense_date', dateStr)
        .lte('expense_date', endStr)
        .order('expense_date', { ascending: false }),
    ]);

    setStoreExpenses(stExp || []);
    setAdminExpenses(adExp || []);
    setLoading(false);
  };

  const totalStoreExp  = storeExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const totalAdminExp  = adminExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const grandTotalExp  = totalStoreExp + totalAdminExp;

  // Breakdown by category (store expenses)
  const storeByCategory = storeExpenses.reduce((m, e) => {
    m[e.category] = (m[e.category] || 0) + parseFloat(e.amount || 0);
    return m;
  }, {});

  // Breakdown by category (admin expenses)
  const adminByCategory = adminExpenses.reduce((m, e) => {
    m[e.category] = (m[e.category] || 0) + parseFloat(e.amount || 0);
    return m;
  }, {});

  // Expense by store
  const byStore = stores.map(s => ({
    ...s,
    total: storeExpenses.filter(e => e.store_id === s.id).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0),
  })).filter(s => s.total > 0).sort((a, b) => b.total - a.total);

  return (
    <div style={{ padding:'24px 28px', maxWidth:1100, margin:'0 auto',
      fontFamily:"'Inter',-apple-system,sans-serif" }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
        marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:700, color:'var(--label)', letterSpacing:'-0.3px' }}>
            💸 Expenses
          </div>
          <div style={{ fontSize:13, color:'var(--label-4)', marginTop:2 }}>
            Store operating costs + your warehouse/admin expenses
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <RefreshButton onRefresh={loadData} />
          <button onClick={() => setShowAdminExp(true)}
            style={{ padding:'9px 16px', background:'var(--bg-2)', border:'1px solid var(--bg-4)',
              color:'var(--label-2)', borderRadius:10, fontSize:13, fontWeight:600,
              cursor:'pointer', fontFamily:'inherit' }}>
            💼 My Expense
          </button>
          <button onClick={() => setShowStoreExp(true)}
            style={{ padding:'9px 16px', background:'var(--accent-bg)', color:'var(--accent)',
              border:'1px solid rgba(255,59,48,0.2)', borderRadius:10, fontSize:13, fontWeight:600,
              cursor:'pointer', fontFamily:'inherit' }}>
            🏪 Store Expense
          </button>
        </div>
      </div>

      {/* Period filter */}
      <div style={{ display:'flex', gap:3, background:'var(--bg-2)', border:'1px solid var(--bg-4)',
        borderRadius:12, padding:3, marginBottom:22, width:'fit-content', boxShadow:'var(--shadow-sm)' }}>
        {PERIODS.map(p => (
          <button key={p.id} onClick={() => setPeriod(p.id)}
            style={{ padding:'7px 14px', borderRadius:9, border:'none', cursor:'pointer',
              fontFamily:'inherit', fontSize:12, fontWeight:700, transition:'all 0.15s',
              background: period===p.id ? 'var(--bg-2)' : 'transparent',
              color: period===p.id ? 'var(--accent)' : 'var(--label-4)',
              boxShadow: period===p.id ? 'var(--shadow-sm)' : 'none' }}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--label-4)', fontSize:14 }}>Loading…</div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',
            gap:12, marginBottom:24 }}>
            {[
              { label:'Total Expenses',      value:fmt(grandTotalExp),   color:'#FF3B30', bg:'#FFF1F0' },
              { label:'Store Expenses',       value:fmt(totalStoreExp),   color:'#FF9500', bg:'#FFFBEB' },
              { label:'Admin / Warehouse',    value:fmt(totalAdminExp),   color:'#007AFF', bg:'#EFF6FF' },
              { label:'Stores Tracked',       value:byStore.length,       color:'#34C759', bg:'#F0FDF4' },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                transition={{ delay:i*0.05 }}
                style={{ background:s.bg, border:`1px solid ${s.color}22`,
                  borderRadius:'var(--radius-md)', padding:'16px 18px',
                  boxShadow:'var(--shadow-sm)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:s.color,
                  textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>
                  {s.label}
                </div>
                <div style={{ fontSize:typeof s.value==='string' ? 22 : 28,
                  fontWeight:800, color:s.color, lineHeight:1 }}>
                  {s.value}
                </div>
              </motion.div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>

            {/* Admin expenses breakdown */}
            <div style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)',
              borderRadius:'var(--radius-lg)', padding:'18px 20px', boxShadow:'var(--shadow-sm)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--label)' }}>
                  💼 My Expenses — {fmt(totalAdminExp)}
                </div>
              </div>
              {adminExpenses.length === 0 ? (
                <div style={{ textAlign:'center', padding:'24px 0', color:'var(--label-4)', fontSize:13 }}>
                  No admin expenses yet
                  <div style={{ marginTop:8 }}>
                    <button onClick={() => setShowAdminExp(true)}
                      style={{ padding:'6px 14px', background:'var(--accent-bg)', color:'var(--accent)',
                        border:'1px solid rgba(255,59,48,0.2)', borderRadius:8, fontSize:12,
                        fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                      + Add Expense
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {Object.entries(adminByCategory).sort((a,b)=>b[1]-a[1]).map(([cat, amt]) => (
                    <div key={cat} style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:16, flexShrink:0 }}>{CAT_ICONS[cat]||'💰'}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', justifyContent:'space-between',
                          fontSize:12, fontWeight:600, marginBottom:3 }}>
                          <span style={{ color:'var(--label-2)', textTransform:'capitalize' }}>
                            {cat.replace(/_/g,' ')}
                          </span>
                          <span style={{ color:'#B91C1C', fontWeight:700 }}>{fmt(amt)}</span>
                        </div>
                        <div style={{ height:4, background:'var(--bg-4)', borderRadius:2 }}>
                          <div style={{ height:'100%', borderRadius:2, background:'#FF3B30',
                            width:`${totalAdminExp > 0 ? (amt/totalAdminExp)*100 : 0}%`,
                            transition:'width 0.5s' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Store expense breakdown */}
            <div style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)',
              borderRadius:'var(--radius-lg)', padding:'18px 20px', boxShadow:'var(--shadow-sm)' }}>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--label)', marginBottom:14 }}>
                🏪 Expense by Store — {fmt(totalStoreExp)}
              </div>
              {byStore.length === 0 ? (
                <div style={{ textAlign:'center', padding:'24px 0', color:'var(--label-4)', fontSize:13 }}>
                  No store expenses yet
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {byStore.map((s, i) => {
                    const pct = byStore[0].total > 0 ? (s.total / byStore[0].total) * 100 : 0;
                    return (
                      <div key={s.id}>
                        <div style={{ display:'flex', justifyContent:'space-between',
                          fontSize:13, marginBottom:4 }}>
                          <span style={{ fontWeight:600, color:'var(--label)' }}>
                            {s.store_name}
                          </span>
                          <span style={{ fontWeight:700, color:'#B91C1C' }}>{fmt(s.total)}</span>
                        </div>
                        <div style={{ height:4, background:'var(--bg-4)', borderRadius:2 }}>
                          <div style={{ height:'100%', borderRadius:2, background:'#FF9500',
                            width:`${pct}%`, transition:'width 0.5s' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* All expenses list */}
          {[
            { title:'💼 Admin / Warehouse Expenses', data: adminExpenses, isAdmin: true },
            { title:'🏪 Store Expenses', data: storeExpenses, isAdmin: false },
          ].map(({ title, data, isAdmin }) => (
            <div key={title} style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)',
              borderRadius:'var(--radius-lg)', padding:'18px 20px',
              boxShadow:'var(--shadow-sm)', marginBottom:16 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--label)', marginBottom:14 }}>
                {title} ({data.length}) — {fmt(data.reduce((s,e)=>s+parseFloat(e.amount||0),0))}
              </div>
              {data.length === 0 ? (
                <div style={{ textAlign:'center', padding:'20px 0',
                  color:'var(--label-4)', fontSize:13 }}>
                  No records for this period
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {data.map(e => (
                    <div key={e.id} style={{ display:'flex', alignItems:'center', gap:12,
                      padding:'10px 14px', background:'var(--bg-3)', borderRadius:10,
                      border:'1px solid var(--bg-4)' }}>
                      <span style={{ fontSize:18, flexShrink:0 }}>{CAT_ICONS[e.category]||'💰'}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--label)',
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {e.description}
                        </div>
                        <div style={{ fontSize:11, color:'var(--label-4)', display:'flex', gap:8 }}>
                          <span>{new Date(e.expense_date).toLocaleDateString('en-IN')}</span>
                          <span style={{ textTransform:'capitalize' }}>{e.category?.replace(/_/g,' ')}</span>
                          {!isAdmin && e.stores && <span>· {e.stores.store_name}</span>}
                          {e.payment_method && <span>· {e.payment_method}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:14, fontWeight:800, color:'#B91C1C' }}>
                          {fmt(e.amount)}
                        </div>
                        {e.proof_url && (
                          <a href={e.proof_url} target="_blank" rel="noreferrer"
                            style={{ fontSize:11, color:'#007AFF', fontWeight:600, textDecoration:'underline' }}>
                            Proof
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      <AnimatePresence>
        {showAdminExp && (
          <AdminExpenseForm
            adminId={adminId}
            onClose={() => setShowAdminExp(false)}
            onSuccess={() => { setShowAdminExp(false); loadData(); }}
          />
        )}
        {showStoreExp && (
          <ExpenseForm
            adminId={adminId}
            storeId={selectedStore?.id}
            onClose={() => setShowStoreExp(false)}
            onSuccess={() => { setShowStoreExp(false); loadData(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
