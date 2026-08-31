import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import { getSession } from '../utils/session';
import AddMedicineModal    from '../components/AddMedicineModal';
import { CartRow, emptyBatchRow, validateBatchRow } from '../components/AddBatchModal';
import BillSubmitModal     from '../components/BillSubmitModal';
import CreateTransferModal from '../components/CreateTransferModal';
import MedicineSearchInput from '../components/MedicineSearchInput';
import { TransferIssuePanel } from '../components/AdminTransferReview';
import '../styles/products.css';
import '../styles/stores.css';

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  Tablet:     { bg:'#EFF6FF', color:'#1D4ED8' },
  Capsule:    { bg:'#F0FDF4', color:'#15803D' },
  Syrup:      { bg:'#FEF3C7', color:'#92400E' },
  Injection:  { bg:'#FEE2E2', color:'#B91C1C' },
  Drops:      { bg:'#E0F2FE', color:'#0369A1' },
  Cream:      { bg:'#FAF0FF', color:'#6B21A8' },
  Ointment:   { bg:'#FFF7ED', color:'#9A3412' },
  Powder:     { bg:'#F8FAFC', color:'#475569' },
  Inhaler:    { bg:'#ECFDF5', color:'#065F46' },
  Patch:      { bg:'#FFF1F0', color:'#991B1B' },
  Suppository:{ bg:'#FEF3C7', color:'#78350F' },
  Lozenges:   { bg:'#FDF2F8', color:'#831843' },
  Other:      { bg:'#F1F5F9', color:'#334155' },
};
const TYPE_ICONS = {
  Tablet:'💊', Capsule:'💊', Syrup:'🧴', Injection:'💉', Drops:'💧',
  Cream:'🧴',  Ointment:'🧴', Powder:'🧂', Inhaler:'🌬️', Patch:'🩹',
  Suppository:'💊', Lozenges:'🍬', Other:'📦',
};
const STATUS_META = {
  pending:  { label:'Pending',  bg:'#FEF3C7', color:'#92400E', border:'#FDE68A', icon:'⏳' },
  approved: { label:'Approved', bg:'#DCFCE7', color:'#15803D', border:'#BBF7D0', icon:'✓'  },
  rejected: { label:'Rejected', bg:'#FEE2E2', color:'#B91C1C', border:'#FECACA', icon:'✕'  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysLeft(d) { return Math.ceil((new Date(d) - new Date()) / 86400000); }

function ExpiryChip({ date }) {
  const d   = daysLeft(date);
  const fmt = new Date(date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' });
  if (d < 0)   return <span style={chip('#FEE2E2','#B91C1C','#FECACA')}>Expired · {fmt}</span>;
  if (d < 30)  return <span style={chip('#FEE2E2','#B91C1C','#FECACA')}>⚠️ {d}d · {fmt}</span>;
  if (d < 90)  return <span style={chip('#FEF3C7','#92400E','#FDE68A')}>⏳ {d}d · {fmt}</span>;
  if (d < 180) return <span style={chip('#E0F2FE','#0369A1','#BAE6FD')}>ℹ️ {d}d · {fmt}</span>;
  return <span style={chip('#DCFCE7','#15803D','#BBF7D0')}>✓ {fmt}</span>;
}
function chip(bg, color, border) {
  return { fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20,
    background:bg, color, border:`1px solid ${border}`, whiteSpace:'nowrap' };
}
function StockBadge({ units }) {
  if (!units)      return <span style={chip('#FEE2E2','#B91C1C','#FECACA')}>Out of Stock</span>;
  if (units <= 50) return <span style={chip('#FEF3C7','#92400E','#FDE68A')}>Low: {units}</span>;
  return <span style={chip('#DCFCE7','#15803D','#BBF7D0')}>In Stock: {units}</span>;
}

function TransferIssueInline({ transfer, onResolved }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    supabase.from('stock_transfer_items')
      .select('*, medicines(name, strength, type, pack_size, pack_unit)')
      .eq('transfer_id', transfer.id)
      .then(({ data }) => setItems(data || []));
  }, [transfer.id]);
  if (!items) return <div style={{ padding:'10px 16px', color:'var(--label-4)', fontSize:12 }}>Loading…</div>;
  return <TransferIssuePanel transfer={transfer} transferItems={items} onResolved={onResolved} />;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Products() {
  const session = getSession();

  // ── Admin record ──────────────────────────────────────────────────────────
  const [adminRecord, setAdminRecord] = useState(null);

  // ── Inventory state ───────────────────────────────────────────────────────
  const [inventory,    setInventory]    = useState([]);
  const [invLoading,   setInvLoading]   = useState(true);
  const [invFilter,    setInvFilter]    = useState('all');
  const [invSearch,    setInvSearch]    = useState('');
  const [statusFilter, setStatusFilter] = useState('approved');
  const [expanded,     setExpanded]     = useState({});

  // ── Bulk cart state ───────────────────────────────────────────────────────
  // cart = [{ medicine, row, errors }]
  const [cart,           setCart]           = useState([]);
  const [cartErrors,     setCartErrors]     = useState({}); // { cartIndex: errorObj }
  const [showBillSubmit, setShowBillSubmit] = useState(false);

  // ── Other modals ──────────────────────────────────────────────────────────
  const [showAddMed,      setShowAddMed]      = useState(false);
  const [showTransfer,    setShowTransfer]    = useState(false);
  const [transfers,       setTransfers]       = useState([]);
  const [showTransferLog, setShowTransferLog] = useState(false);
  const [successBanner,   setSuccessBanner]   = useState(null);

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (session?.email) {
      supabase.from('admins').select('id, full_name').eq('email', session.email).single()
        .then(({ data }) => setAdminRecord(data || null));
    }
    fetchInventory();
    fetchTransfers();
  }, []);

  const fetchInventory = useCallback(async () => {
    setInvLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const { data: batches } = await supabase
      .from('medicine_batches')
      .select('*, medicines(*)')
      .order('expiry_date', { ascending: true });

    const map = {};
    (batches || []).forEach(b => {
      const mid = b.medicine_id;
      if (!map[mid]) map[mid] = { medicine: b.medicines, batches: [], totalUnits: 0 };
      map[mid].batches.push(b);
      if (b.status === 'approved' && b.expiry_date >= today) {
        map[mid].totalUnits += (b.units_remaining || 0);
      }
    });
    Object.values(map).forEach(e =>
      e.batches.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))
    );
    setInventory(Object.values(map));
    setInvLoading(false);
  }, []);

  const fetchTransfers = async () => {
    const { data } = await supabase
      .from('stock_transfers')
      .select('*, stores(store_name, city)')
      .order('dispatched_at', { ascending: false })
      .limit(20);
    setTransfers(data || []);
  };

  // ── Cart handlers ─────────────────────────────────────────────────────────
  const handleMedicineSelect = (med) => {
    // Don't add duplicates
    if (cart.some(c => c.medicine.id === med.id)) {
      showBanner(`⚠️ ${med.name} is already in the cart.`);
      return;
    }
    setCart(prev => [...prev, { medicine: med, row: emptyBatchRow() }]);
  };

  const updateCartRow = (idx, field, value) => {
    setCart(prev => prev.map((c, i) =>
      i === idx ? { ...c, row: { ...c.row, [field]: value } } : c
    ));
    // Clear that field's error on change
    setCartErrors(prev => {
      const errs = { ...prev };
      if (errs[idx]) { errs[idx] = { ...errs[idx], [field]: undefined }; }
      return errs;
    });
  };

  const removeFromCart = (idx) => {
    setCart(prev => prev.filter((_, i) => i !== idx));
    setCartErrors(prev => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  };

  // Validate all rows, return true if all valid
  const validateCart = () => {
    if (cart.length === 0) return false;
    const newErrors = {};
    let allValid = true;
    cart.forEach(({ medicine, row }, idx) => {
      const e = validateBatchRow(row, medicine);
      if (Object.keys(e).length > 0) {
        newErrors[idx] = e;
        allValid = false;
      }
    });
    setCartErrors(newErrors);
    return allValid;
  };

  const handleAddToStock = () => {
    if (cart.length === 0) {
      showBanner('⚠️ Add at least one medicine to the cart first.');
      return;
    }
    if (!validateCart()) {
      showBanner('⚠️ Please fill in all required fields in the cart before proceeding.');
      return;
    }
    setShowBillSubmit(true);
  };

  const handleSubmitSuccess = () => {
    setShowBillSubmit(false);
    setCart([]);
    setCartErrors({});
    fetchInventory();
    showBanner('📦 Stock request submitted! Batches are pending approval.');
  };

  const showBanner = (msg) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 6000);
  };

  // ── Derived inventory ─────────────────────────────────────────────────────
  const filteredInv = useMemo(() => {
    let list = inventory;
    if (invSearch.trim()) {
      const q = invSearch.toLowerCase();
      list = list.filter(e =>
        e.medicine?.name?.toLowerCase().includes(q) ||
        e.medicine?.manufacturer?.toLowerCase().includes(q) ||
        e.medicine?.generic_name?.toLowerCase().includes(q)
      );
    }
    if (invFilter === 'instock') list = list.filter(e => e.totalUnits > 50);
    if (invFilter === 'low')     list = list.filter(e => e.totalUnits > 0 && e.totalUnits <= 50);
    if (invFilter === 'out')     list = list.filter(e => e.totalUnits === 0);
    return list.map(entry => ({
      ...entry,
      visibleBatches: entry.batches.filter(b =>
        statusFilter === 'all' ? true : b.status === statusFilter
      ),
    })).filter(e => statusFilter !== 'approved' || e.visibleBatches.length > 0 || e.totalUnits >= 0);
  }, [inventory, invSearch, invFilter, statusFilter]);

  const invStats = useMemo(() => {
    const allBatches = inventory.flatMap(e => e.batches);
    return {
      total:   inventory.length,
      instock: inventory.filter(e => e.totalUnits > 50).length,
      low:     inventory.filter(e => e.totalUnits > 0 && e.totalUnits <= 50).length,
      out:     inventory.filter(e => e.totalUnits === 0).length,
      pending: allBatches.filter(b => b.status === 'pending').length,
    };
  }, [inventory]);

  const toggleExpand = id => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const cartTotalUnits = cart.reduce((sum, { medicine, row }) => {
    const ps = medicine.pack_size || 1;
    return sum + (parseInt(row.quantity_packs, 10) || 0) * ps + (parseInt(row.quantity_loose, 10) || 0);
  }, 0);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="products-page" style={{ fontFamily:"'Inter',-apple-system,sans-serif" }}>

      {/* ── Banner ── */}
      <AnimatePresence>
        {successBanner && (
          <motion.div key="banner"
            initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-16 }}
            style={{ background: successBanner.startsWith('⚠️') ? '#FEF3C7' : '#DCFCE7',
              border: `1px solid ${successBanner.startsWith('⚠️') ? '#FDE68A' : '#BBF7D0'}`,
              borderRadius:12, padding:'12px 18px', marginBottom:20,
              display:'flex', alignItems:'center', justifyContent:'space-between',
              fontSize:14, fontWeight:500,
              color: successBanner.startsWith('⚠️') ? '#92400E' : '#15803D',
              boxShadow:'0 2px 10px rgba(0,0,0,0.06)' }}>
            <span>{successBanner}</span>
            <button onClick={() => setSuccessBanner(null)}
              style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, padding:'0 4px',
                color: successBanner.startsWith('⚠️') ? '#92400E' : '#15803D' }}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════
          SECTION 1 — ADD STOCK (Cart)
          ══════════════════════════════════ */}
      <div style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)',
        borderRadius:'var(--radius-lg)', padding:'24px 26px', marginBottom:28,
        boxShadow:'var(--shadow-sm)' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
          gap:16, flexWrap:'wrap', marginBottom:20 }}>
          <div>
            <div style={{ fontSize:20, fontWeight:700, color:'var(--label)',
              letterSpacing:'-0.3px', marginBottom:3 }}>
              📦 Add Stock
            </div>
            <div style={{ fontSize:13, color:'var(--label-4)' }}>
              Search and add multiple medicines to the cart, then submit all at once with the stockist bill.
            </div>
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <button onClick={() => setShowTransfer(true)}
              style={{ background:'linear-gradient(145deg,#34C759,#28A745)', color:'#fff',
                border:'none', borderRadius:12, padding:'10px 20px', fontSize:13,
                fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                boxShadow:'0 3px 12px rgba(52,199,89,0.3)' }}>
              🚚 Transfer Stock
            </button>
            <button onClick={() => setShowTransferLog(v => !v)}
              style={{ background:'var(--bg-3)', color:'var(--label-2)',
                border:'1px solid var(--bg-4)', borderRadius:12, padding:'10px 18px',
                fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              📋 Transfers
              {transfers.filter(t => t.status === 'dispatched').length > 0 && (
                <span style={{ background:'var(--accent)', color:'#fff', borderRadius:20,
                  padding:'1px 7px', fontSize:11, fontWeight:700, marginLeft:6 }}>
                  {transfers.filter(t => t.status === 'dispatched').length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search */}
        <MedicineSearchInput
          onSelect={handleMedicineSelect}
          onAddNew={() => setShowAddMed(true)}
        />

        <div style={{ marginTop:10, padding:'9px 14px', background:'#EFF6FF',
          border:'1px solid #BFDBFE', borderRadius:10, fontSize:12, color:'#1D4ED8' }}>
          💡 Search and select as many medicines as you need. Fill in batch details for each,
          then click <strong>"Add to Stock"</strong> to upload the bill and submit all at once.
        </div>

        {/* ── Cart ── */}
        <AnimatePresence>
          {cart.length > 0 && (
            <motion.div
              initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
              exit={{ opacity:0, height:0 }} style={{ overflow:'hidden' }}>
              <div style={{ marginTop:24, paddingTop:20,
                borderTop:'1px solid var(--bg-4)' }}>

                {/* Cart header */}
                <div style={{ display:'flex', alignItems:'center',
                  justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--label)' }}>
                    🛒 Cart
                    <span style={{ marginLeft:8, fontSize:13, fontWeight:600,
                      background:'var(--accent)', color:'#fff', borderRadius:20,
                      padding:'2px 10px' }}>
                      {cart.length} item{cart.length !== 1 ? 's' : ''}
                    </span>
                    {cartTotalUnits > 0 && (
                      <span style={{ marginLeft:8, fontSize:12, color:'var(--label-4)',
                        fontWeight:500 }}>
                        · {cartTotalUnits} total units
                      </span>
                    )}
                  </div>
                  <button onClick={() => { setCart([]); setCartErrors({}); }}
                    style={{ background:'#FEE2E2', color:'#B91C1C', border:'none',
                      borderRadius:8, padding:'6px 14px', fontSize:12, fontWeight:600,
                      cursor:'pointer', fontFamily:'inherit' }}>
                    Clear Cart
                  </button>
                </div>

                {/* Cart rows */}
                <AnimatePresence>
                  {cart.map(({ medicine, row }, idx) => (
                    <CartRow
                      key={medicine.id}
                      index={idx}
                      medicine={medicine}
                      row={row}
                      errors={cartErrors[idx] || {}}
                      onChange={(field, value) => updateCartRow(idx, field, value)}
                      onRemove={() => removeFromCart(idx)}
                    />
                  ))}
                </AnimatePresence>

                {/* Add to Stock CTA */}
                <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
                  <button
                    onClick={handleAddToStock}
                    style={{ background:'linear-gradient(145deg,#FF3B30,#D93025)',
                      color:'#fff', border:'none', borderRadius:12,
                      padding:'12px 32px', fontSize:15, fontWeight:700,
                      cursor:'pointer', fontFamily:'inherit',
                      boxShadow:'0 4px 16px rgba(255,59,48,0.35)',
                      display:'flex', alignItems:'center', gap:8 }}>
                    📦 Add to Stock
                    <span style={{ background:'rgba(255,255,255,0.25)', borderRadius:20,
                      padding:'1px 10px', fontSize:13 }}>
                      {cart.length} item{cart.length !== 1 ? 's' : ''}
                    </span>
                  </button>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Transfer log */}
      <AnimatePresence>
        {showTransferLog && (
          <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
            exit={{ opacity:0, height:0 }} style={{ overflow:'hidden', marginBottom:20 }}>
            <div style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)',
              borderRadius:'var(--radius-lg)', padding:'16px 20px', boxShadow:'var(--shadow-sm)' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--label-4)',
                textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:12 }}>
                Recent Transfers
              </div>
              {transfers.length === 0 ? (
                <div style={{ color:'var(--label-4)', fontSize:13, textAlign:'center', padding:16 }}>
                  No transfers yet
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {transfers.map(t => {
                    const SC = {
                      dispatched:         { bg:'#EFF6FF', color:'#1D4ED8' },
                      received:           { bg:'#DCFCE7', color:'#15803D' },
                      issue_reported:     { bg:'#FEE2E2', color:'#B91C1C' },
                      partially_received: { bg:'#FEF3C7', color:'#92400E' },
                      cancelled:          { bg:'var(--bg-4)', color:'var(--label-4)' },
                    };
                    const sc = SC[t.status] || SC.dispatched;
                    const hasIssue = t.status === 'issue_reported';
                    return (
                      <div key={t.id} style={{ background:'var(--bg-3)',
                        borderRadius:'var(--radius-md)',
                        border:`1px solid ${hasIssue ? '#FECACA' : 'var(--bg-4)'}`,
                        overflow:'hidden' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px' }}>
                          <span style={{ fontSize:18 }}>🚚</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13, fontWeight:600, color:'var(--label)' }}>
                              {t.stores?.store_name}
                            </div>
                            <div style={{ fontSize:11, color:'var(--label-4)' }}>
                              {new Date(t.dispatched_at).toLocaleString('en-IN')}
                            </div>
                          </div>
                          <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px',
                            borderRadius:20, background:sc.bg, color:sc.color,
                            textTransform:'uppercase' }}>
                            {t.status.replace('_', ' ')}
                          </span>
                        </div>
                        {hasIssue && (
                          <TransferIssueInline transfer={t}
                            onResolved={() => { fetchInventory(); fetchTransfers(); }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════
          SECTION 2 — INVENTORY VIEW
          ══════════════════════════════════ */}
      <div>
        <div className="products-topbar">
          <div>
            <div className="products-title">🗄️ Inventory <span>Stock</span></div>
            <div className="products-sub">
              FEFO order · Pending batches await approval before counting toward stock
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',
          gap:12, marginBottom:20 }}>
          {[
            { label:'Total Medicines', value:invStats.total,   color:'#FF3B30', bg:'#FFF1F0', f:'all'          },
            { label:'In Stock',        value:invStats.instock, color:'#34C759', bg:'#F0FDF4', f:'instock'      },
            { label:'Low Stock',       value:invStats.low,     color:'#FF9500', bg:'#FFFBEB', f:'low'          },
            { label:'Out of Stock',    value:invStats.out,     color:'#B91C1C', bg:'#FEE2E2', f:'out'          },
            { label:'Pending Batches', value:invStats.pending, color:'#92400E', bg:'#FEF3C7', f:'pending_stat' },
          ].map((s, i) => (
            <motion.div key={i}
              initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:i * 0.05 }}
              onClick={() => {
                if (s.f === 'pending_stat') { setStatusFilter('pending'); setInvFilter('all'); }
                else { setInvFilter(f => f === s.f ? 'all' : s.f); setStatusFilter('approved'); }
              }}
              style={{ background:s.bg,
                border:`2px solid ${(s.f === 'pending_stat' ? statusFilter === 'pending' : invFilter === s.f) ? s.color : s.color + '22'}`,
                borderRadius:14, padding:'14px 16px', cursor:'pointer',
                transition:'all 0.18s', boxShadow:'var(--shadow-sm)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:s.color,
                textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>
                {s.label}
              </div>
              <div style={{ fontSize:28, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div>
            </motion.div>
          ))}
        </div>

        {/* Search + status pills */}
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
          <div className="search-wrap" style={{ maxWidth:320 }}>
            <span className="search-icon">🔍</span>
            <input className="search-input"
              placeholder="Search medicine or manufacturer…"
              value={invSearch} onChange={e => setInvSearch(e.target.value)} />
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {[
              { v:'approved', label:'✓ Approved' },
              { v:'pending',  label:'⏳ Pending'  },
              { v:'all',      label:'All'          },
            ].map(opt => (
              <button key={opt.v} onClick={() => setStatusFilter(opt.v)}
                style={{ padding:'7px 14px', borderRadius:20,
                  border:`1.5px solid ${statusFilter === opt.v ? 'var(--accent)' : 'var(--bg-4)'}`,
                  background: statusFilter === opt.v ? 'var(--accent-bg)' : 'var(--bg-2)',
                  color: statusFilter === opt.v ? 'var(--accent)' : 'var(--label-3)',
                  fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                  transition:'all 0.18s' }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {invLoading ? (
          <div style={{ textAlign:'center', padding:60, color:'var(--label-4)', fontSize:14 }}>
            Loading inventory…
          </div>
        ) : filteredInv.length === 0 ? (
          <div style={{ textAlign:'center', padding:'70px 20px', background:'var(--bg-2)',
            borderRadius:'var(--radius-lg)', border:'1px solid var(--bg-4)',
            boxShadow:'var(--shadow-sm)' }}>
            <div style={{ fontSize:48, opacity:0.2, marginBottom:14 }}>📦</div>
            <div style={{ fontSize:17, fontWeight:600, color:'var(--label-3)', marginBottom:6 }}>
              No stock added yet
            </div>
            <div style={{ fontSize:13, color:'var(--label-4)' }}>
              Use the search above to find a medicine and add it to the cart
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {filteredInv.map((entry, i) => {
              const med = entry.medicine;
              if (!med) return null;
              const tc  = TYPE_COLORS[med.type] || TYPE_COLORS.Other;
              const isEx = expanded[med.id];
              const pct = (() => {
                const tot = entry.batches.reduce((s, b) => s + (b.total_units || 0), 0);
                const rem = entry.batches.reduce((s, b) => s + (b.units_remaining || 0), 0);
                return tot > 0 ? Math.round((rem / tot) * 100) : 0;
              })();
              const barC = pct > 50 ? '#34C759' : pct > 20 ? '#FF9500' : '#FF3B30';
              const pendingCount = entry.batches.filter(b => b.status === 'pending').length;

              return (
                <motion.div key={med.id}
                  initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                  transition={{ delay:i * 0.03 }}
                  style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)',
                    borderRadius:'var(--radius-lg)', overflow:'hidden',
                    boxShadow:'var(--shadow-sm)' }}>

                  {/* Medicine row */}
                  <div style={{ padding:'16px 20px', display:'flex', alignItems:'center',
                    gap:14, cursor:'pointer' }} onClick={() => toggleExpand(med.id)}>
                    <div style={{ width:44, height:44, borderRadius:12, background:tc.bg,
                      border:`1px solid ${tc.color}22`, display:'flex', alignItems:'center',
                      justifyContent:'center', fontSize:20, flexShrink:0 }}>
                      {TYPE_ICONS[med.type] || '📦'}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8,
                        flexWrap:'wrap', marginBottom:3 }}>
                        <span style={{ fontSize:15, fontWeight:700, color:'var(--label)' }}>
                          {med.name}
                        </span>
                        {med.strength && (
                          <span style={{ fontSize:12, color:'var(--label-4)' }}>
                            · {med.strength}
                          </span>
                        )}
                        <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px',
                          borderRadius:20, background:tc.bg, color:tc.color }}>
                          {med.type}
                        </span>
                        {pendingCount > 0 && (
                          <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px',
                            borderRadius:20, background:'#FEF3C7', color:'#92400E',
                            border:'1px solid #FDE68A' }}>
                            ⏳ {pendingCount} pending
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize:12, color:'var(--label-4)' }}>
                        {med.manufacturer} · {med.pack_size} {med.pack_unit}/pack
                        · {entry.batches.length} batch{entry.batches.length !== 1 ? 'es' : ''}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
                      <StockBadge units={entry.totalUnits} />
                      <button
                        onClick={e => { e.stopPropagation(); handleMedicineSelect(med); }}
                        style={{ background:'var(--accent-bg)', color:'var(--accent)',
                          border:'1px solid rgba(255,59,48,0.2)', borderRadius:8,
                          padding:'6px 14px', fontSize:12, fontWeight:600,
                          cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                        + Add Batch
                      </button>
                      <span style={{ fontSize:16, color:'var(--label-4)', userSelect:'none' }}>
                        {isEx ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height:3, background:'var(--bg-4)' }}>
                    <div style={{ height:'100%', width:`${Math.min(pct, 100)}%`,
                      background:barC, transition:'width 0.5s' }} />
                  </div>

                  {/* Expanded batches */}
                  <AnimatePresence>
                    {isEx && (
                      <motion.div
                        initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }}
                        exit={{ height:0, opacity:0 }} style={{ overflow:'hidden' }}>
                        <div style={{ padding:'14px 20px', background:'var(--bg-3)',
                          borderTop:'1px solid var(--bg-4)' }}>
                          <div style={{ fontSize:11, fontWeight:700, color:'var(--label-4)',
                            textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:12 }}>
                            Batches — FEFO · showing: {
                              statusFilter === 'all' ? 'all' :
                              statusFilter === 'pending' ? 'pending only' : 'approved only'
                            }
                          </div>
                          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                            {(entry.visibleBatches?.length > 0 ? entry.visibleBatches : []).map((batch, bi) => {
                              const d    = daysLeft(batch.expiry_date);
                              const bpct = batch.total_units > 0
                                ? Math.round((batch.units_remaining / batch.total_units) * 100) : 0;
                              const bc   = bpct > 50 ? '#34C759' : bpct > 20 ? '#FF9500' : '#FF3B30';
                              const sm   = STATUS_META[batch.status] || STATUS_META.pending;
                              return (
                                <div key={batch.id} style={{ background:'var(--bg-2)',
                                  border:`1px solid ${d < 30 ? '#FECACA' : d < 90 ? '#FDE68A' : 'var(--bg-4)'}`,
                                  borderRadius:'var(--radius-md)', overflow:'hidden' }}>
                                  <div style={{ padding:'12px 16px', display:'flex',
                                    alignItems:'center', gap:12, flexWrap:'wrap' }}>
                                    <div style={{ flex:1, minWidth:0 }}>
                                      <div style={{ display:'flex', alignItems:'center',
                                        gap:8, flexWrap:'wrap', marginBottom:3 }}>
                                        <span style={{ fontSize:13, fontWeight:700,
                                          color:'var(--label)', fontFamily:'monospace' }}>
                                          {batch.batch_number}
                                        </span>
                                        <ExpiryChip date={batch.expiry_date} />
                                        <span style={{ fontSize:11, fontWeight:700,
                                          padding:'2px 9px', borderRadius:20,
                                          background:sm.bg, color:sm.color,
                                          border:`1px solid ${sm.border}` }}>
                                          {sm.icon} {sm.label}
                                        </span>
                                        {bi === 0 && batch.status === 'approved' && (
                                          <span style={{ fontSize:10, fontWeight:700,
                                            background:'#EFF6FF', color:'#1D4ED8',
                                            padding:'1px 7px', borderRadius:20,
                                            border:'1px solid #BFDBFE' }}>
                                            FEFO FIRST
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ display:'flex', gap:16, flexWrap:'wrap',
                                        fontSize:11, color:'var(--label-4)' }}>
                                        {batch.date_of_manufacture && <span>DOM: {new Date(batch.date_of_manufacture).toLocaleDateString('en-IN')}</span>}
                                        {batch.supplier_name && <span>Supplier: {batch.supplier_name}</span>}
                                        {batch.cost_price_per_pack && <span>Cost: ₹{Number(batch.cost_price_per_pack).toFixed(2)}/pack</span>}
                                        {batch.mrp_per_pack && <span>MRP: ₹{Number(batch.mrp_per_pack).toFixed(2)}/pack</span>}
                                        {batch.bill_amount && <span>Bill Total: ₹{Number(batch.bill_amount).toFixed(2)}</span>}
                                      </div>
                                      {batch.bill_image_url && (
                                        <div style={{ marginTop:5 }}>
                                          <a href={batch.bill_image_url} target="_blank" rel="noreferrer"
                                            style={{ fontSize:11, color:'#0369A1',
                                              textDecoration:'underline', fontWeight:600 }}>
                                            📄 View Stockist Bill
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ textAlign:'right', flexShrink:0 }}>
                                      <div style={{ fontSize:18, fontWeight:800, color:bc }}>
                                        {batch.units_remaining}
                                      </div>
                                      <div style={{ fontSize:10, color:'var(--label-4)' }}>
                                        of {batch.total_units} units
                                      </div>
                                    </div>
                                  </div>
                                  <div style={{ height:3, background:'var(--bg-4)' }}>
                                    <div style={{ height:'100%', width:`${bpct}%`,
                                      background:bc, transition:'width 0.5s' }} />
                                  </div>
                                </div>
                              );
                            })}
                            {(entry.visibleBatches?.length === 0) && (
                              <div style={{ fontSize:13, color:'var(--label-4)',
                                textAlign:'center', padding:'16px 0' }}>
                                No {statusFilter} batches for this medicine
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showAddMed && (
          <AddMedicineModal
            onClose={() => setShowAddMed(false)}
            onSuccess={() => {
              setShowAddMed(false);
              showBanner('💊 Medicine added! Now search for it and add to your cart.');
            }}
          />
        )}
        {showBillSubmit && (
          <BillSubmitModal
            cart={cart}
            adminRecord={adminRecord}
            onClose={() => setShowBillSubmit(false)}
            onSuccess={handleSubmitSuccess}
          />
        )}
        {showTransfer && (
          <CreateTransferModal
            onClose={() => setShowTransfer(false)}
            onSuccess={() => { setShowTransfer(false); fetchInventory(); fetchTransfers(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
