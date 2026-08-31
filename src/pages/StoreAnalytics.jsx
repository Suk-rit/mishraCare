/**
 * StoreAnalytics — RESTRICTED view for store manager
 * Shows: total sales amount + store expenses only
 * Does NOT show profit, margins, cost of goods — those are Vishnu-only.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchStoreSales, fetchTopMedicines, fetchStoreExpenses, groupBillsByPeriod } from '../utils/analytics';
import { BarChart } from '../components/MiniChart';
import ExpenseForm from '../components/ExpenseForm';
import RefreshButton from '../components/RefreshButton';

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
};

function fmt(n) { return '₹' + Number(n||0).toLocaleString('en-IN', { maximumFractionDigits:0 }); }

export default function StoreAnalytics({ storeId, storeName, managerId }) {
  const [period,      setPeriod]     = useState('month');
  const [bills,       setBills]      = useState([]);
  const [topMeds,     setTopMeds]    = useState([]);
  const [expenses,    setExpenses]   = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [showExpForm, setShowExpForm]= useState(false);

  useEffect(() => { if (storeId) load(); }, [storeId, period]);

  const load = async () => {
    setLoading(true);
    const [b, t, e] = await Promise.all([
      fetchStoreSales(storeId, period),
      fetchTopMedicines(storeId, period, 6),
      fetchStoreExpenses(storeId, period),
    ]);
    setBills(b); setTopMeds(t); setExpenses(e);
    setLoading(false);
  };

  // Only revenue exposed to manager — no profit/margin
  const revenue    = bills.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);
  const totalExp   = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const totalBills = bills.length;
  const avgBill    = totalBills > 0 ? revenue / totalBills : 0;
  const chartData  = groupBillsByPeriod(bills, period);

  // Expense breakdown by category
  const expByCategory = Object.entries(
    expenses.reduce((m, e) => {
      m[e.category] = (m[e.category] || 0) + parseFloat(e.amount || 0);
      return m;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ padding:'24px 28px', maxWidth:1000, margin:'0 auto',
      fontFamily:"'Inter',-apple-system,sans-serif" }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
        marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:700, color:'var(--label)', letterSpacing:'-0.3px' }}>
            📊 {storeName ? `${storeName} — Analytics` : 'Store Analytics'}
          </div>
          <div style={{ fontSize:13, color:'var(--label-4)', marginTop:2 }}>
            Sales summary &amp; store expenses
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <RefreshButton onRefresh={load} />
          <button onClick={() => setShowExpForm(true)}
            style={{ padding:'8px 18px', background:'var(--bg-2)', border:'1px solid var(--bg-4)',
              color:'var(--label-2)', borderRadius:10, fontSize:13, fontWeight:600,
              cursor:'pointer', fontFamily:'inherit' }}>
            💸 Add Expense
          </button>
        </div>
      </div>

      {/* Period selector */}
      <div style={{ display:'flex', gap:4, background:'var(--bg-2)', border:'1px solid var(--bg-4)',
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
        <div style={{ textAlign:'center', padding:60, color:'var(--label-4)', fontSize:14 }}>
          Loading…
        </div>
      ) : (
        <>
          {/* KPI Cards — sales + expenses only, NO profit */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',
            gap:12, marginBottom:24 }}>
            {[
              { label:'Total Sales',    value:fmt(revenue),   color:'#007AFF', bg:'#EFF6FF', sub:`${totalBills} bills` },
              { label:'Avg Bill Value', value:fmt(avgBill),   color:'#5856D6', bg:'#F0EFFE', sub:'Per transaction'    },
              { label:'Total Expenses', value:fmt(totalExp),  color:'#FF9500', bg:'#FFFBEB', sub:`${expenses.length} records` },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                transition={{ delay:i*0.05 }}
                style={{ background:s.bg, border:`1px solid ${s.color}22`,
                  borderRadius:'var(--radius-md)', padding:'16px 18px', boxShadow:'var(--shadow-sm)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:s.color,
                  textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>
                  {s.label}
                </div>
                <div style={{ fontSize:24, fontWeight:800, color:s.color, lineHeight:1, marginBottom:3 }}>
                  {s.value}
                </div>
                <div style={{ fontSize:11, color:'var(--label-4)' }}>{s.sub}</div>
              </motion.div>
            ))}
          </div>

          {/* Sales bar chart */}
          {chartData.length > 1 && (
            <div style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)',
              borderRadius:'var(--radius-lg)', padding:'18px 20px',
              boxShadow:'var(--shadow-sm)', marginBottom:20 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--label)', marginBottom:14 }}>
                Sales Trend
              </div>
              <BarChart data={chartData} valueKey="revenue" labelKey="label"
                color="#007AFF" height={130} />
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
            {/* Top medicines */}
            <div style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)',
              borderRadius:'var(--radius-lg)', padding:'18px 20px', boxShadow:'var(--shadow-sm)' }}>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--label)', marginBottom:14 }}>
                💊 Top Medicines by Volume
              </div>
              {topMeds.length === 0 ? (
                <div style={{ textAlign:'center', padding:'20px 0', color:'var(--label-4)', fontSize:13 }}>
                  No sales data
                </div>
              ) : topMeds.map((m, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:9 }}>
                  <div style={{ width:22, height:22, borderRadius:'50%',
                    background:i<3?'#F0FDF4':'var(--bg-3)',
                    border:`1px solid ${i<3?'#BBF7D0':'var(--bg-4)'}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:10, fontWeight:800, color:i<3?'#15803D':'var(--label-4)',
                    flexShrink:0 }}>
                    {i+1}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--label)',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {m.name}
                    </div>
                    <div style={{ fontSize:11, color:'var(--label-4)' }}>
                      {m.qty?.toLocaleString()} units sold
                    </div>
                  </div>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', flexShrink:0 }}>
                    {fmt(m.revenue)}
                  </div>
                </div>
              ))}
            </div>

            {/* Expense breakdown */}
            <div style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)',
              borderRadius:'var(--radius-lg)', padding:'18px 20px', boxShadow:'var(--shadow-sm)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--label)' }}>
                  💸 Expenses — {fmt(totalExp)}
                </div>
                <button onClick={() => setShowExpForm(true)}
                  style={{ padding:'5px 12px', background:'var(--accent-bg)', color:'var(--accent)',
                    border:'1px solid rgba(255,59,48,0.2)', borderRadius:8, fontSize:11,
                    fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>+ Add</button>
              </div>
              {expByCategory.length === 0 ? (
                <div style={{ textAlign:'center', padding:'20px 0', color:'var(--label-4)', fontSize:13 }}>
                  No expenses yet
                </div>
              ) : expByCategory.map(([cat, amt]) => (
                <div key={cat} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                  <span style={{ fontSize:16, flexShrink:0 }}>{CAT_ICONS[cat] || '💰'}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12,
                      fontWeight:600, marginBottom:3 }}>
                      <span style={{ color:'var(--label-2)', textTransform:'capitalize' }}>
                        {cat.replace(/_/g,' ')}
                      </span>
                      <span style={{ color:'#B91C1C' }}>{fmt(amt)}</span>
                    </div>
                    <div style={{ height:4, background:'var(--bg-4)', borderRadius:2 }}>
                      <div style={{ height:'100%', borderRadius:2, background:'#FF9500',
                        width:`${totalExp > 0 ? (amt/totalExp)*100 : 0}%`,
                        transition:'width 0.5s' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Expenses list */}
          {expenses.length > 0 && (
            <div style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)',
              borderRadius:'var(--radius-lg)', padding:'18px 20px', boxShadow:'var(--shadow-sm)' }}>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--label)', marginBottom:14 }}>
                Recent Expenses
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {expenses.slice(0, 10).map(e => (
                  <div key={e.id} style={{ display:'flex', alignItems:'center', gap:12,
                    padding:'9px 12px', background:'var(--bg-3)', borderRadius:9,
                    border:'1px solid var(--bg-4)' }}>
                    <span style={{ fontSize:16 }}>{CAT_ICONS[e.category] || '💰'}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--label)',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {e.description}
                      </div>
                      <div style={{ fontSize:10, color:'var(--label-4)' }}>
                        {new Date(e.expense_date).toLocaleDateString('en-IN')}
                        {' · '}{e.category?.replace(/_/g,' ')}
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:'#B91C1C' }}>
                        {fmt(e.amount)}
                      </div>
                      {e.proof_url && (
                        <a href={e.proof_url} target="_blank" rel="noreferrer"
                          style={{ fontSize:10, color:'#007AFF', textDecoration:'underline' }}>
                          Proof
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {showExpForm && (
          <ExpenseForm
            storeId={storeId}
            managerId={managerId}
            onClose={() => setShowExpForm(false)}
            onSuccess={() => { setShowExpForm(false); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
