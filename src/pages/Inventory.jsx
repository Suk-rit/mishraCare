/**
 * Inventory — admin view of all stock batches
 * Read-only view: medicines grouped by type, FEFO batches, filter by status/stock level
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import RefreshButton from '../components/RefreshButton';
import '../styles/products.css';
import '../styles/stores.css';

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  Tablet:     { bg: '#EFF6FF', color: '#1D4ED8' },
  Capsule:    { bg: '#F0FDF4', color: '#15803D' },
  Syrup:      { bg: '#FEF3C7', color: '#92400E' },
  Injection:  { bg: '#FEE2E2', color: '#B91C1C' },
  Drops:      { bg: '#E0F2FE', color: '#0369A1' },
  Cream:      { bg: '#FAF0FF', color: '#6B21A8' },
  Ointment:   { bg: '#FFF7ED', color: '#9A3412' },
  Powder:     { bg: '#F8FAFC', color: '#475569' },
  Inhaler:    { bg: '#ECFDF5', color: '#065F46' },
  Patch:      { bg: '#FFF1F0', color: '#991B1B' },
  Suppository:{ bg: '#FEF3C7', color: '#78350F' },
  Lozenges:   { bg: '#FDF2F8', color: '#831843' },
  Other:      { bg: '#F1F5F9', color: '#334155' },
};
const TYPE_ICONS = {
  Tablet: '💊', Capsule: '💊', Syrup: '🧴', Injection: '💉', Drops: '💧',
  Cream: '🧴', Ointment: '🧴', Powder: '🧂', Inhaler: '🌬️', Patch: '🩹',
  Suppository: '💊', Lozenges: '🍬', Other: '📦',
};
const STATUS_META = {
  pending:  { label: 'Pending',  bg: '#FEF3C7', color: '#92400E', border: '#FDE68A', icon: '⏳' },
  approved: { label: 'Approved', bg: '#DCFCE7', color: '#15803D', border: '#BBF7D0', icon: '✓'  },
  rejected: { label: 'Rejected', bg: '#FEE2E2', color: '#B91C1C', border: '#FECACA', icon: '✕'  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysLeft(d) { return Math.ceil((new Date(d) - new Date()) / 86400000); }

function chip(bg, color, border) {
  return { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
    background: bg, color, border: `1px solid ${border}`, whiteSpace: 'nowrap' };
}

function ExpiryChip({ date }) {
  const d   = daysLeft(date);
  const fmt = new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
  if (d < 0)   return <span style={chip('#FEE2E2', '#B91C1C', '#FECACA')}>Expired · {fmt}</span>;
  if (d < 30)  return <span style={chip('#FEE2E2', '#B91C1C', '#FECACA')}>⚠️ {d}d · {fmt}</span>;
  if (d < 90)  return <span style={chip('#FEF3C7', '#92400E', '#FDE68A')}>⏳ {d}d · {fmt}</span>;
  if (d < 180) return <span style={chip('#E0F2FE', '#0369A1', '#BAE6FD')}>ℹ️ {d}d · {fmt}</span>;
  return <span style={chip('#DCFCE7', '#15803D', '#BBF7D0')}>✓ {fmt}</span>;
}

function StockBadge({ units }) {
  if (!units)      return <span style={chip('#FEE2E2', '#B91C1C', '#FECACA')}>Out of Stock</span>;
  if (units <= 50) return <span style={chip('#FEF3C7', '#92400E', '#FDE68A')}>Low: {units}</span>;
  return <span style={chip('#DCFCE7', '#15803D', '#BBF7D0')}>In Stock: {units}</span>;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Inventory() {
  const [inventory,    setInventory]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [invFilter,    setInvFilter]    = useState('all');
  const [statusFilter, setStatusFilter] = useState('approved');
  const [search,       setSearch]       = useState('');
  const [expanded,     setExpanded]     = useState({});

  const fetchInventory = useCallback(async () => {
    setLoading(true);
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
    setLoading(false);
  }, []);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const allBatches = inventory.flatMap(e => e.batches);
    return {
      total:   inventory.length,
      instock: inventory.filter(e => e.totalUnits > 50).length,
      low:     inventory.filter(e => e.totalUnits > 0 && e.totalUnits <= 50).length,
      out:     inventory.filter(e => e.totalUnits === 0).length,
      pending: allBatches.filter(b => b.status === 'pending').length,
    };
  }, [inventory]);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = inventory;
    if (search.trim()) {
      const q = search.toLowerCase();
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
    }));
  }, [inventory, search, invFilter, statusFilter]);

  const toggleExpand = id => setExpanded(p => ({ ...p, [id]: !p[id] }));

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="products-page" style={{ fontFamily: "'Inter',-apple-system,sans-serif" }}>

      {/* Page header */}
      <div className="products-topbar">
        <div>
          <div className="products-title">🗄️ Inventory <span>Stock</span></div>
          <div className="products-sub">
            All medicines with FEFO-sorted batches · Pending batches await approval before counting toward stock
          </div>
        </div>
        <RefreshButton onRefresh={fetchInventory} />
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))',
        gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Medicines', value: stats.total,   color: '#FF3B30', bg: '#FFF1F0', f: 'all'          },
          { label: 'In Stock',        value: stats.instock, color: '#34C759', bg: '#F0FDF4', f: 'instock'      },
          { label: 'Low Stock',       value: stats.low,     color: '#FF9500', bg: '#FFFBEB', f: 'low'          },
          { label: 'Out of Stock',    value: stats.out,     color: '#B91C1C', bg: '#FEE2E2', f: 'out'          },
          { label: 'Pending Batches', value: stats.pending, color: '#92400E', bg: '#FEF3C7', f: 'pending_stat' },
        ].map((s, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            onClick={() => {
              if (s.f === 'pending_stat') { setStatusFilter('pending'); setInvFilter('all'); }
              else { setInvFilter(f => f === s.f ? 'all' : s.f); setStatusFilter('approved'); }
            }}
            style={{
              background: s.bg,
              border: `2px solid ${(s.f === 'pending_stat' ? statusFilter === 'pending' : invFilter === s.f) ? s.color : s.color + '22'}`,
              borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
              transition: 'all 0.18s', boxShadow: 'var(--shadow-sm)',
            }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: s.color,
              textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Search + status filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-wrap" style={{ maxWidth: 340 }}>
          <span className="search-icon">🔍</span>
          <input className="search-input"
            placeholder="Search medicine, salt or manufacturer…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { v: 'approved', label: '✓ Approved' },
            { v: 'pending',  label: '⏳ Pending'  },
            { v: 'all',      label: 'All'          },
          ].map(opt => (
            <button key={opt.v} onClick={() => setStatusFilter(opt.v)}
              style={{
                padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.18s',
                border: `1.5px solid ${statusFilter === opt.v ? 'var(--accent)' : 'var(--bg-4)'}`,
                background: statusFilter === opt.v ? 'var(--accent-bg)' : 'var(--bg-2)',
                color: statusFilter === opt.v ? 'var(--accent)' : 'var(--label-3)',
              }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--label-4)', fontSize: 14 }}>
          Loading inventory…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-2)',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--bg-4)',
          boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 48, opacity: 0.18, marginBottom: 14 }}>📦</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--label-3)', marginBottom: 6 }}>
            {search || invFilter !== 'all' ? 'No matches' : 'No stock yet'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--label-4)' }}>
            Go to <strong>Add Stock</strong> in the sidebar to add inventory
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((entry, i) => {
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
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                style={{ background: 'var(--bg-2)', border: '1px solid var(--bg-4)',
                  borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>

                {/* Medicine row — click to expand */}
                <div style={{ padding: '15px 20px', display: 'flex', alignItems: 'center',
                  gap: 14, cursor: 'pointer' }} onClick={() => toggleExpand(med.id)}>
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: tc.bg,
                    border: `1px solid ${tc.color}22`, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>
                    {TYPE_ICONS[med.type] || '📦'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                      flexWrap: 'wrap', marginBottom: 3 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)' }}>
                        {med.name}
                      </span>
                      {med.strength && (
                        <span style={{ fontSize: 12, color: 'var(--label-4)' }}>· {med.strength}</span>
                      )}
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px',
                        borderRadius: 20, background: tc.bg, color: tc.color }}>
                        {med.type}
                      </span>
                      {pendingCount > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px',
                          borderRadius: 20, background: '#FEF3C7', color: '#92400E',
                          border: '1px solid #FDE68A' }}>
                          ⏳ {pendingCount} pending
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--label-4)' }}>
                      {med.manufacturer} · {med.pack_size} {med.pack_unit}/pack
                      · {entry.batches.length} batch{entry.batches.length !== 1 ? 'es' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <StockBadge units={entry.totalUnits} />
                    <span style={{ fontSize: 15, color: 'var(--label-4)', userSelect: 'none' }}>
                      {isEx ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: 3, background: 'var(--bg-4)' }}>
                  <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`,
                    background: barC, transition: 'width 0.5s' }} />
                </div>

                {/* Expanded batches */}
                <AnimatePresence>
                  {isEx && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                      <div style={{ padding: '14px 20px', background: 'var(--bg-3)',
                        borderTop: '1px solid var(--bg-4)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-4)',
                          textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
                          Batches — FEFO order ·{' '}
                          {statusFilter === 'all' ? 'all statuses' :
                           statusFilter === 'pending' ? 'pending only' : 'approved only'}
                        </div>

                        {entry.visibleBatches.length === 0 ? (
                          <div style={{ fontSize: 13, color: 'var(--label-4)',
                            textAlign: 'center', padding: '12px 0' }}>
                            No {statusFilter === 'all' ? '' : statusFilter} batches for this medicine
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {entry.visibleBatches.map((batch, bi) => {
                              const d    = daysLeft(batch.expiry_date);
                              const bpct = batch.total_units > 0
                                ? Math.round((batch.units_remaining / batch.total_units) * 100) : 0;
                              const bc   = bpct > 50 ? '#34C759' : bpct > 20 ? '#FF9500' : '#FF3B30';
                              const sm   = STATUS_META[batch.status] || STATUS_META.pending;

                              return (
                                <div key={batch.id} style={{ background: 'var(--bg-2)',
                                  border: `1px solid ${d < 30 ? '#FECACA' : d < 90 ? '#FDE68A' : 'var(--bg-4)'}`,
                                  borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                  <div style={{ padding: '12px 16px', display: 'flex',
                                    alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'center',
                                        gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                                        <span style={{ fontSize: 13, fontWeight: 700,
                                          color: 'var(--label)', fontFamily: 'monospace' }}>
                                          {batch.batch_number}
                                        </span>
                                        <ExpiryChip date={batch.expiry_date} />
                                        <span style={{ fontSize: 11, fontWeight: 700,
                                          padding: '2px 9px', borderRadius: 20,
                                          background: sm.bg, color: sm.color,
                                          border: `1px solid ${sm.border}` }}>
                                          {sm.icon} {sm.label}
                                        </span>
                                        {bi === 0 && batch.status === 'approved' && (
                                          <span style={{ fontSize: 10, fontWeight: 700,
                                            background: '#EFF6FF', color: '#1D4ED8',
                                            padding: '1px 7px', borderRadius: 20,
                                            border: '1px solid #BFDBFE' }}>
                                            FEFO FIRST
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap',
                                        fontSize: 11, color: 'var(--label-4)' }}>
                                        {batch.date_of_manufacture && (
                                          <span>DOM: {new Date(batch.date_of_manufacture).toLocaleDateString('en-IN')}</span>
                                        )}
                                        {batch.purchase_date && (
                                          <span>Purchased: {new Date(batch.purchase_date).toLocaleDateString('en-IN')}</span>
                                        )}
                                        {batch.supplier_name && <span>Supplier: {batch.supplier_name}</span>}
                                        {batch.cost_price_per_pack && (
                                          <span>Cost: ₹{Number(batch.cost_price_per_pack).toFixed(2)}/pack</span>
                                        )}
                                        {batch.mrp_per_pack && (
                                          <span>MRP: ₹{Number(batch.mrp_per_pack).toFixed(2)}/pack</span>
                                        )}
                                        {batch.bill_amount && (
                                          <span>Bill: ₹{Number(batch.bill_amount).toFixed(2)}</span>
                                        )}
                                      </div>
                                      {batch.bill_image_url && (
                                        <div style={{ marginTop: 5 }}>
                                          <a href={batch.bill_image_url} target="_blank" rel="noreferrer"
                                            style={{ fontSize: 11, color: '#0369A1',
                                              textDecoration: 'underline', fontWeight: 600 }}>
                                            📄 View Stockist Bill
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                      <div style={{ fontSize: 20, fontWeight: 800, color: bc }}>
                                        {batch.units_remaining}
                                      </div>
                                      <div style={{ fontSize: 10, color: 'var(--label-4)' }}>
                                        of {batch.total_units} units
                                      </div>
                                    </div>
                                  </div>
                                  <div style={{ height: 3, background: 'var(--bg-4)' }}>
                                    <div style={{ height: '100%', width: `${bpct}%`,
                                      background: bc, transition: 'width 0.5s' }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
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
  );
}
