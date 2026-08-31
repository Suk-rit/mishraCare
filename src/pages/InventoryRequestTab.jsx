/**
 * InventoryRequestTab
 * Store manager can:
 *   1. Browse admin's approved medicine batches and request specific ones
 *   2. Request a new medicine not available anywhere
 * Admin sees these requests and can approve / reject / mark fulfilled.
 */
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import RefreshButton from '../components/RefreshButton';

const TYPE_ICONS = {
  Tablet:'💊', Capsule:'💊', Syrup:'🧴', Injection:'💉', Drops:'💧',
  Cream:'🧴', Ointment:'🧴', Powder:'🧂', Inhaler:'🌬️', Patch:'🩹',
  Other:'📦',
};
const STATUS_META = {
  pending:   { bg:'#FEF3C7', color:'#92400E', border:'#FDE68A', label:'Pending ⏳'   },
  approved:  { bg:'#DCFCE7', color:'#15803D', border:'#BBF7D0', label:'Approved ✓'   },
  rejected:  { bg:'#FEE2E2', color:'#B91C1C', border:'#FECACA', label:'Rejected ✕'   },
  fulfilled: { bg:'#EFF6FF', color:'#1D4ED8', border:'#BFDBFE', label:'Fulfilled 📦' },
};

function fmt(n) { return '₹' + Number(n||0).toFixed(2); }
function dLeft(d) { return Math.ceil((new Date(d) - new Date()) / 86400000); }

export default function InventoryRequestTab({ storeId, managerId, adminId }) {
  const [view,        setView]        = useState('browse'); // browse | my_requests | new_request
  const [adminBatches,setAdminBatches]= useState([]);
  const [batLoading,  setBatLoading]  = useState(true);
  const [myRequests,  setMyRequests]  = useState([]);
  const [reqLoading,  setReqLoading]  = useState(true);
  const [search,      setSearch]      = useState('');

  // New request form
  const [selBatch,    setSelBatch]    = useState(null); // selected batch object
  const [reqQty,      setReqQty]      = useState('');
  const [reqNotes,    setReqNotes]    = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [banner,      setBanner]      = useState(null);

  // New medicine request form
  const [newMedName,  setNewMedName]  = useState('');
  const [newMedQty,   setNewMedQty]   = useState('');
  const [newMedNotes, setNewMedNotes] = useState('');

  useEffect(() => {
    if (adminId) fetchAdminBatches();
    if (storeId) fetchMyRequests();
  }, [adminId, storeId]);

  const fetchAdminBatches = async () => {
    setBatLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('medicine_batches')
      .select('*, medicines(id, name, strength, type, manufacturer, pack_size, pack_unit)')
      .eq('status', 'approved')
      .eq('admin_id', adminId)
      .gt('units_remaining', 0)
      .gt('expiry_date', today)
      .order('expiry_date', { ascending: true });
    setAdminBatches(data || []);
    setBatLoading(false);
  };

  const fetchMyRequests = async () => {
    setReqLoading(true);
    const { data } = await supabase
      .from('inventory_requests')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    setMyRequests(data || []);
    setReqLoading(false);
  };

  const showBanner = (msg) => {
    setBanner(msg);
    setTimeout(() => setBanner(null), 5000);
  };

  // Group admin batches by medicine
  const byMedicine = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? adminBatches.filter(b =>
          b.medicines?.name?.toLowerCase().includes(q) ||
          b.medicines?.manufacturer?.toLowerCase().includes(q) ||
          b.batch_number?.toLowerCase().includes(q))
      : adminBatches;
    const map = {};
    filtered.forEach(b => {
      const mid = b.medicine_id;
      if (!map[mid]) map[mid] = { medicine: b.medicines, batches: [] };
      map[mid].batches.push(b);
    });
    return Object.values(map);
  }, [adminBatches, search]);

  // Submit request for existing batch
  const handleRequestBatch = async () => {
    if (!selBatch) return;
    const qty = parseInt(reqQty);
    if (!qty || qty <= 0) { showBanner('⚠️ Enter a valid quantity'); return; }
    if (qty > selBatch.units_remaining) {
      showBanner(`⚠️ Only ${selBatch.units_remaining} units available`); return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('inventory_requests').insert({
        store_id:      storeId,
        manager_id:    managerId,
        admin_id:      adminId,
        medicine_id:   selBatch.medicine_id,
        batch_id:      selBatch.id,
        medicine_name: selBatch.medicines?.name,
        batch_number:  selBatch.batch_number,
        quantity_units:qty,
        request_type:  'existing',
        notes:         reqNotes.trim() || null,
        status:        'pending',
      });
      if (error) throw new Error(error.message);
      showBanner('✓ Request sent to admin!');
      setSelBatch(null); setReqQty(''); setReqNotes('');
      fetchMyRequests();
    } catch (ex) {
      showBanner('⛔ ' + ex.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit request for new medicine
  const handleRequestNew = async () => {
    if (!newMedName.trim()) { showBanner('⚠️ Enter medicine name'); return; }
    const qty = parseInt(newMedQty);
    if (!qty || qty <= 0) { showBanner('⚠️ Enter a valid quantity'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('inventory_requests').insert({
        store_id:      storeId,
        manager_id:    managerId,
        admin_id:      adminId,
        medicine_name: newMedName.trim(),
        quantity_units:qty,
        request_type:  'new',
        notes:         newMedNotes.trim() || null,
        status:        'pending',
      });
      if (error) throw new Error(error.message);
      showBanner('✓ New medicine request sent!');
      setNewMedName(''); setNewMedQty(''); setNewMedNotes('');
      setView('my_requests');
      fetchMyRequests();
    } catch (ex) {
      showBanner('⛔ ' + ex.message);
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = myRequests.filter(r => r.status === 'pending').length;

  return (
    <div style={{ padding:'24px 28px', maxWidth:960, margin:'0 auto',
      fontFamily:"'Inter',-apple-system,sans-serif" }}>

      {/* Banner */}
      <AnimatePresence>
        {banner && (
          <motion.div key="banner"
            initial={{ opacity:0, y:-12 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            style={{ background: banner.startsWith('⛔') ? '#FEE2E2' : banner.startsWith('⚠️') ? '#FEF3C7' : '#DCFCE7',
              border:`1px solid ${banner.startsWith('⛔') ? '#FECACA' : banner.startsWith('⚠️') ? '#FDE68A' : '#BBF7D0'}`,
              color: banner.startsWith('⛔') ? '#B91C1C' : banner.startsWith('⚠️') ? '#92400E' : '#15803D',
              borderRadius:12, padding:'11px 18px', marginBottom:16,
              display:'flex', justifyContent:'space-between', fontSize:13, fontWeight:500 }}>
            <span>{banner}</span>
            <button onClick={() => setBanner(null)}
              style={{ background:'none', border:'none', cursor:'pointer', fontSize:15, color:'inherit' }}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
        marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:700, color:'var(--label)',
            letterSpacing:'-0.3px', marginBottom:3 }}>
            📋 Request Inventory
          </div>
          <div style={{ fontSize:13, color:'var(--label-4)' }}>
            Browse admin stock and send requests · or request a medicine that's not available
          </div>
        </div>
        <RefreshButton onRefresh={() => { fetchAdminBatches(); fetchMyRequests(); }} />
      </div>

      {/* Tab pills */}
      <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
        {[
          { id:'browse',      label:'🏪 Browse Admin Stock' },
          { id:'new_request', label:'➕ Request New Medicine' },
          { id:'my_requests', label:`📋 My Requests${pendingCount > 0 ? ` (${pendingCount} pending)` : ''}` },
        ].map(v => (
          <button key={v.id} onClick={() => setView(v.id)}
            style={{ padding:'8px 18px', borderRadius:20, border:'1.5px solid',
              borderColor: view===v.id ? 'var(--accent)' : 'var(--bg-4)',
              background:  view===v.id ? 'var(--accent-bg)' : 'var(--bg-2)',
              color:       view===v.id ? 'var(--accent)' : 'var(--label-3)',
              fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
              transition:'all 0.15s' }}>
            {v.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ── Browse admin stock ── */}
        {view === 'browse' && (
          <motion.div key="browse"
            initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Search by medicine name, manufacturer, batch…"
              style={{ width:'100%', padding:'11px 16px', border:'1.5px solid var(--bg-4)',
                borderRadius:12, fontSize:14, fontFamily:'inherit', color:'var(--label)',
                background:'var(--bg-2)', outline:'none', marginBottom:16,
                boxSizing:'border-box' }}
              onFocus={e => e.target.style.borderColor='var(--accent)'}
              onBlur={e => e.target.style.borderColor='var(--bg-4)'} />

            {batLoading ? (
              <div style={{ textAlign:'center', padding:40, color:'var(--label-4)', fontSize:14 }}>
                Loading admin inventory…
              </div>
            ) : byMedicine.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 20px', background:'var(--bg-2)',
                borderRadius:16, border:'1px solid var(--bg-4)' }}>
                <div style={{ fontSize:40, opacity:0.2, marginBottom:12 }}>📦</div>
                <div style={{ fontSize:15, fontWeight:600, color:'var(--label-3)', marginBottom:6 }}>
                  {search ? 'No matches' : 'No stock available in admin inventory'}
                </div>
                <div style={{ fontSize:13, color:'var(--label-4)', marginBottom:16 }}>
                  Can't find what you need?
                </div>
                <button onClick={() => setView('new_request')}
                  style={{ padding:'9px 22px', background:'linear-gradient(145deg,#FF3B30,#D93025)',
                    color:'#fff', border:'none', borderRadius:10, fontSize:13,
                    fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  Request New Medicine
                </button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {byMedicine.map(({ medicine, batches }) => (
                  <div key={medicine?.id} style={{ background:'var(--bg-2)',
                    border:'1px solid var(--bg-4)', borderRadius:14,
                    overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
                    {/* Medicine header */}
                    <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--bg-4)',
                      background:'var(--bg-3)', display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:20 }}>{TYPE_ICONS[medicine?.type] || '📦'}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:'var(--label)' }}>
                          {medicine?.name}
                          {medicine?.strength && <span style={{ fontSize:12, color:'var(--label-4)', fontWeight:400 }}> · {medicine.strength}</span>}
                        </div>
                        <div style={{ fontSize:11, color:'var(--label-4)' }}>
                          {medicine?.manufacturer} · {medicine?.pack_size} {medicine?.pack_unit}/pack
                        </div>
                      </div>
                      <span style={{ fontSize:11, fontWeight:600, padding:'2px 9px',
                        borderRadius:20, background:'#EFF6FF', color:'#1D4ED8' }}>
                        {batches.reduce((s,b) => s + b.units_remaining, 0)} units available
                      </span>
                    </div>
                    {/* Batches */}
                    {batches.map((batch, bi) => {
                      const d = dLeft(batch.expiry_date);
                      const expC = d < 90 ? '#92400E' : '#15803D';
                      const expBg = d < 90 ? '#FEF3C7' : '#DCFCE7';
                      const isSelected = selBatch?.id === batch.id;
                      return (
                        <div key={batch.id}
                          style={{ padding:'11px 16px', borderBottom: bi < batches.length-1 ? '1px solid var(--bg-4)' : 'none',
                            background: isSelected ? 'var(--accent-bg)' : 'transparent',
                            transition:'background 0.15s' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                            {bi === 0 && (
                              <span style={{ fontSize:9, fontWeight:800, background:'#EFF6FF',
                                color:'#1D4ED8', padding:'1px 5px', borderRadius:4 }}>FEFO</span>
                            )}
                            <span style={{ fontSize:12, fontFamily:'monospace',
                              fontWeight:700, color:'var(--label-3)' }}>
                              {batch.batch_number}
                            </span>
                            <span style={{ fontSize:10, fontWeight:600, padding:'1px 7px',
                              borderRadius:20, background:expBg, color:expC }}>
                              Exp: {new Date(batch.expiry_date).toLocaleDateString('en-IN')}
                            </span>
                            <span style={{ fontSize:11, color:'var(--label-4)', flex:1 }}>
                              {batch.units_remaining} units · MRP ₹{Number(batch.mrp_per_pack||0).toFixed(2)}/pack
                              {batch.discount_percent > 0 && (
                                <span style={{ marginLeft:6, color:'#FF3B30', fontWeight:700 }}>
                                  🏷️ {batch.discount_percent}% off
                                </span>
                              )}
                            </span>
                            <button
                              onClick={() => { setSelBatch(isSelected ? null : batch); setReqQty(''); }}
                              style={{ padding:'5px 14px', borderRadius:8, border:'none',
                                background: isSelected ? 'var(--accent)' : 'linear-gradient(145deg,#FF3B30,#D93025)',
                                color:'#fff', fontSize:11, fontWeight:700,
                                cursor:'pointer', fontFamily:'inherit' }}>
                              {isSelected ? '✓ Selected' : '+ Request'}
                            </button>
                          </div>

                          {/* Inline request form */}
                          <AnimatePresence>
                            {isSelected && (
                              <motion.div
                                initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }}
                                exit={{ height:0, opacity:0 }} style={{ overflow:'hidden' }}>
                                <div style={{ marginTop:10, padding:'12px 14px',
                                  background:'var(--bg-2)', border:'1px solid var(--bg-4)',
                                  borderRadius:10, display:'flex', flexDirection:'column', gap:8 }}>
                                  <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:8 }}>
                                    <div>
                                      <label style={{ fontSize:11, fontWeight:600, color:'var(--label-3)',
                                        display:'block', marginBottom:3 }}>
                                        Quantity (units) *
                                      </label>
                                      <input type="number" min="1" max={batch.units_remaining}
                                        value={reqQty} onChange={e => setReqQty(e.target.value)}
                                        placeholder={`Max ${batch.units_remaining}`}
                                        style={{ width:'100%', padding:'7px 10px', fontSize:13,
                                          border:'1.5px solid var(--bg-4)', borderRadius:8,
                                          background:'var(--bg-3)', color:'var(--label)',
                                          fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
                                    </div>
                                    <div>
                                      <label style={{ fontSize:11, fontWeight:600, color:'var(--label-3)',
                                        display:'block', marginBottom:3 }}>
                                        Reason / Urgency (optional)
                                      </label>
                                      <input value={reqNotes} onChange={e => setReqNotes(e.target.value)}
                                        placeholder="e.g. Running low, urgent demand…"
                                        style={{ width:'100%', padding:'7px 10px', fontSize:13,
                                          border:'1.5px solid var(--bg-4)', borderRadius:8,
                                          background:'var(--bg-3)', color:'var(--label)',
                                          fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
                                    </div>
                                  </div>
                                  <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                                    <button onClick={() => { setSelBatch(null); setReqQty(''); }}
                                      style={{ padding:'7px 16px', background:'var(--bg-3)',
                                        border:'1px solid var(--bg-4)', color:'var(--label-3)',
                                        borderRadius:8, fontSize:12, fontWeight:600,
                                        cursor:'pointer', fontFamily:'inherit' }}>
                                      Cancel
                                    </button>
                                    <button onClick={handleRequestBatch} disabled={submitting}
                                      style={{ padding:'7px 20px',
                                        background:'linear-gradient(145deg,#FF3B30,#D93025)',
                                        color:'#fff', border:'none', borderRadius:8, fontSize:12,
                                        fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                                      {submitting ? '⏳ Sending…' : '📤 Send Request'}
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                ))}
                {/* Bottom CTA for new medicine */}
                <div style={{ textAlign:'center', padding:'14px', background:'var(--bg-2)',
                  borderRadius:14, border:'1px dashed var(--bg-4)' }}>
                  <span style={{ fontSize:13, color:'var(--label-4)' }}>
                    Can't find the medicine you need?{' '}
                  </span>
                  <button onClick={() => setView('new_request')}
                    style={{ background:'none', border:'none', color:'var(--accent)',
                      fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
                      textDecoration:'underline' }}>
                    Request a new medicine →
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Request new medicine ── */}
        {view === 'new_request' && (
          <motion.div key="new_request"
            initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
            <div style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)',
              borderRadius:16, padding:'24px 26px', boxShadow:'var(--shadow-sm)' }}>
              <div style={{ fontSize:16, fontWeight:700, color:'var(--label)', marginBottom:4 }}>
                ➕ Request a New Medicine
              </div>
              <div style={{ fontSize:13, color:'var(--label-4)', marginBottom:20 }}>
                If the medicine you need isn't available in admin's stock, fill this form.
                Admin will see your request and arrange it.
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div className="field">
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--label-3)',
                    display:'block', marginBottom:5 }}>Medicine Name *</label>
                  <input value={newMedName} onChange={e => setNewMedName(e.target.value)}
                    placeholder="e.g. Paracetamol 500mg, Azithromycin 250mg…"
                    style={{ width:'100%', padding:'10px 14px', fontSize:14,
                      border:'1.5px solid var(--bg-4)', borderRadius:10, background:'var(--bg-3)',
                      color:'var(--label)', fontFamily:'inherit', outline:'none',
                      boxSizing:'border-box' }}
                    onFocus={e => e.target.style.borderColor='var(--accent)'}
                    onBlur={e => e.target.style.borderColor='var(--bg-4)'} />
                </div>
                <div className="field">
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--label-3)',
                    display:'block', marginBottom:5 }}>Quantity Required (units) *</label>
                  <input type="number" min="1" value={newMedQty}
                    onChange={e => setNewMedQty(e.target.value)} placeholder="e.g. 100"
                    style={{ width:'100%', padding:'10px 14px', fontSize:14,
                      border:'1.5px solid var(--bg-4)', borderRadius:10, background:'var(--bg-3)',
                      color:'var(--label)', fontFamily:'inherit', outline:'none',
                      boxSizing:'border-box' }}
                    onFocus={e => e.target.style.borderColor='var(--accent)'}
                    onBlur={e => e.target.style.borderColor='var(--bg-4)'} />
                </div>
                <div className="field">
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--label-3)',
                    display:'block', marginBottom:5 }}>Reason / Notes (optional)</label>
                  <textarea value={newMedNotes} onChange={e => setNewMedNotes(e.target.value)}
                    placeholder="Why do you need this? Any urgency or special requirements?"
                    style={{ width:'100%', minHeight:72, padding:'10px 14px', fontSize:13,
                      border:'1.5px solid var(--bg-4)', borderRadius:10, background:'var(--bg-3)',
                      color:'var(--label)', fontFamily:'inherit', outline:'none',
                      resize:'vertical', boxSizing:'border-box' }} />
                </div>
                <div style={{ display:'flex', justifyContent:'flex-end' }}>
                  <button onClick={handleRequestNew} disabled={submitting}
                    style={{ padding:'11px 28px',
                      background:'linear-gradient(145deg,#FF3B30,#D93025)',
                      color:'#fff', border:'none', borderRadius:12, fontSize:14,
                      fontWeight:700, cursor:'pointer', fontFamily:'inherit',
                      boxShadow:'0 3px 12px rgba(255,59,48,0.3)' }}>
                    {submitting ? '⏳ Sending…' : '📤 Send Request to Admin'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── My requests ── */}
        {view === 'my_requests' && (
          <motion.div key="my_requests"
            initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
            {reqLoading ? (
              <div style={{ textAlign:'center', padding:40, color:'var(--label-4)', fontSize:14 }}>
                Loading…
              </div>
            ) : myRequests.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 20px', background:'var(--bg-2)',
                borderRadius:16, border:'1px solid var(--bg-4)' }}>
                <div style={{ fontSize:40, opacity:0.2, marginBottom:12 }}>📋</div>
                <div style={{ fontSize:15, fontWeight:600, color:'var(--label-3)' }}>
                  No requests yet
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {myRequests.map((req, i) => {
                  const sm = STATUS_META[req.status] || STATUS_META.pending;
                  return (
                    <motion.div key={req.id}
                      initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                      transition={{ delay:i * 0.03 }}
                      style={{ background:'var(--bg-2)', border:`1px solid ${sm.border}`,
                        borderRadius:14, padding:'14px 18px', boxShadow:'var(--shadow-sm)' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8,
                            marginBottom:4, flexWrap:'wrap' }}>
                            <span style={{ fontSize:14, fontWeight:700, color:'var(--label)' }}>
                              {req.medicine_name || '—'}
                            </span>
                            <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px',
                              borderRadius:20, background: req.request_type === 'new' ? '#FAF0FF' : '#EFF6FF',
                              color: req.request_type === 'new' ? '#6B21A8' : '#1D4ED8' }}>
                              {req.request_type === 'new' ? '🆕 New Medicine' : '📦 From Stock'}
                            </span>
                          </div>
                          <div style={{ fontSize:12, color:'var(--label-4)', display:'flex',
                            gap:10, flexWrap:'wrap' }}>
                            <span>{req.quantity_units} units requested</span>
                            {req.batch_number && <span>Batch: {req.batch_number}</span>}
                            <span>{new Date(req.created_at).toLocaleDateString('en-IN')}</span>
                          </div>
                          {req.notes && (
                            <div style={{ marginTop:5, fontSize:12, color:'var(--label-3)',
                              fontStyle:'italic' }}>
                              "{req.notes}"
                            </div>
                          )}
                          {req.admin_note && (
                            <div style={{ marginTop:6, padding:'6px 10px',
                              background: req.status === 'rejected' ? '#FEF3C7' : '#F0FDF4',
                              border:`1px solid ${req.status === 'rejected' ? '#FDE68A' : '#BBF7D0'}`,
                              borderRadius:7, fontSize:12,
                              color: req.status === 'rejected' ? '#92400E' : '#15803D' }}>
                              <strong>Admin:</strong> {req.admin_note}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px',
                          borderRadius:20, background:sm.bg, color:sm.color,
                          border:`1px solid ${sm.border}`, flexShrink:0 }}>
                          {sm.label}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
