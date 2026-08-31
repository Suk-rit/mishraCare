import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import { getSession, clearSession, saveSession } from '../utils/session';
import { generatePurchaseOrderPDF } from '../utils/generatePurchaseOrderPDF';
import { uploadFile } from '../utils/storage';
import AddStoreModal from '../components/AddStoreModal';

// ── Constants ─────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'pending',   icon: '⏳', label: 'Stock Approvals'   },
  { id: 'approved',  icon: '✓',  label: 'Approved Bills'    },
  { id: 'employees', icon: '👥', label: 'People Requests'   },
  { id: 'stores',    icon: '🏪', label: 'Add Store'         },
  { id: 'expenses',  icon: '💸', label: 'My Expenses'       },
];

function chip(bg, color, border = bg) {
  return { fontSize:11, fontWeight:600, padding:'2px 9px', borderRadius:20,
    background:bg, color, border:`1px solid ${border}`, whiteSpace:'nowrap', display:'inline-block' };
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function daysLeft(d) { return Math.ceil((new Date(d) - new Date()) / 86400000); }

function ExpiryChip({ date }) {
  const d   = daysLeft(date);
  const fmt = new Date(date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' });
  if (d < 0)   return <span style={chip('#FEE2E2','#B91C1C')}>Expired · {fmt}</span>;
  if (d < 90)  return <span style={chip('#FEF3C7','#92400E')}>⏳ {d}d · {fmt}</span>;
  return <span style={chip('#DCFCE7','#15803D')}>✓ {fmt}</span>;
}

// ── PersonCard — for employee / admin team approval ──────────────────────────
function PersonCard({ person, subtitle, adminPhone, onApprove, onReject }) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason]         = useState('');

  return (
    <div style={{ background:'#fff', border:'1.5px solid #B3E5FC', borderRadius:14,
      overflow:'hidden', boxShadow:'0 2px 10px rgba(2,136,209,0.07)' }}>
      {/* Header */}
      <div style={{ padding:'14px 18px', display:'flex', alignItems:'flex-start', gap:12 }}>
        <div style={{ width:42, height:42, borderRadius:12,
          background:'linear-gradient(135deg,#7C3AED,#4F46E5)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:16, fontWeight:700, color:'#fff', flexShrink:0 }}>
          {(person.full_name||'?').slice(0,2).toUpperCase()}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#1a1a2e', marginBottom:2 }}>
            {person.full_name}
          </div>
          <div style={{ fontSize:11, color:'#888', display:'flex', gap:8, flexWrap:'wrap' }}>
            <span>{subtitle}</span>
            {person.designation && <span>· {person.designation}</span>}
            {person.phone && <span>· 📞 {person.phone}</span>}
          </div>
          {person.salary && (
            <div style={{ marginTop:4, fontSize:11, color:'#0288D1', fontWeight:600 }}>
              Salary: ₹{Number(person.salary).toLocaleString('en-IN')} / {person.salary_type}
              <span style={{ marginLeft:8, color:'#888', fontWeight:400 }}>
                (will auto-add to monthly expenses on approval)
              </span>
            </div>
          )}
          {adminPhone && (
            <a href={`tel:${adminPhone}`}
              style={{ display:'inline-flex', alignItems:'center', gap:4, marginTop:4,
                fontSize:11, color:'#007AFF', fontWeight:700, textDecoration:'none' }}>
              📞 Contact Admin: {adminPhone}
            </a>
          )}
        </div>
        {/* Doc links */}
        <div style={{ display:'flex', flexDirection:'column', gap:4, flexShrink:0 }}>
          {person.photo_url && <a href={person.photo_url} target="_blank" rel="noreferrer" style={{ fontSize:10, color:'#0288D1', fontWeight:600 }}>📷 Photo</a>}
          {person.aadhar_photo_url && <a href={person.aadhar_photo_url} target="_blank" rel="noreferrer" style={{ fontSize:10, color:'#0288D1', fontWeight:600 }}>🪪 Aadhar</a>}
        </div>
      </div>
      {/* Actions */}
      <div style={{ padding:'10px 18px', borderTop:'1px solid #E1F5FE',
        background:'#F5FBFF', display:'flex', flexDirection:'column', gap:8 }}>
        {!showReject ? (
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onApprove}
              style={{ flex:2, padding:'8px', background:'linear-gradient(135deg,#34C759,#28A745)',
                color:'#fff', border:'none', borderRadius:9, fontSize:12, fontWeight:700,
                cursor:'pointer', fontFamily:'inherit' }}>
              ✓ Approve + Add Salary Expense
            </button>
            <button onClick={() => setShowReject(true)}
              style={{ flex:1, padding:'8px', background:'#FEE2E2', color:'#B91C1C',
                border:'none', borderRadius:9, fontSize:12, fontWeight:700,
                cursor:'pointer', fontFamily:'inherit' }}>
              ✕ Reject
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <input placeholder="Reason for rejection (optional)"
              value={reason} onChange={e => setReason(e.target.value)}
              style={{ padding:'7px 10px', border:'1.5px solid #FECACA', borderRadius:8,
                fontSize:12, fontFamily:'inherit', color:'#B91C1C',
                background:'#FFF5F5', outline:'none' }} />
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={() => setShowReject(false)}
                style={{ flex:1, padding:'7px', background:'var(--bg-3)', border:'1px solid var(--bg-4)',
                  color:'var(--label-3)', borderRadius:8, fontSize:11, fontWeight:600,
                  cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              <button onClick={() => onReject(reason)}
                style={{ flex:2, padding:'7px', background:'#FF3B30', color:'#fff',
                  border:'none', borderRadius:8, fontSize:11, fontWeight:700,
                  cursor:'pointer', fontFamily:'inherit' }}>Confirm Reject</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Generate bill number: AdminFirstName_YYYYMMDD_XXXX
async function generateBillNumber(adminName) {
  const base  = (adminName || 'Admin').split(' ')[0].replace(/[^a-zA-Z]/g, '');
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const { count } = await supabase
    .from('purchase_order_bills')
    .select('*', { count:'exact', head:true });
  const seq = String((count || 0) + 1).padStart(4, '0');
  return `${base}_${today}_${seq}`;
}

// ── Batch group card — shows all pending batches for one admin ────────────────
function AdminBatchGroup({ admin, batches, onApprove, onReject }) {
  const [selected,    setSelected]    = useState(new Set(batches.map(b => b.id)));
  const [note,        setNote]        = useState('');
  const [rejNotes,    setRejNotes]    = useState({});    // { batchId: reason }
  const [expanded,    setExpanded]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);

  const toggleBatch = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const selectedBatches = batches.filter(b => selected.has(b.id));
  const totalCost = selectedBatches.reduce((s, b) =>
    s + (parseFloat(b.cost_price_per_pack || 0) * (b.quantity_packs || 0)), 0);
  const totalUnits = selectedBatches.reduce((s, b) => s + (b.total_units || 0), 0);

  // Get a representative bill image (from first batch)
  const billImageUrl = batches[0]?.bill_image_url;
  const billAmount   = batches[0]?.bill_amount;

  const handleApprove = async () => {
    if (!selectedBatches.length) return;
    setSubmitting(true);
    try {
      await onApprove({
        admin,
        batches: selectedBatches,
        note,
        billAmount,
        supplierName:    batches[0]?.supplier_name,
        supplierInvoice: batches[0]?.supplier_invoice,
        purchaseDate:    batches[0]?.purchase_date,
        stockistBillUrl: billImageUrl,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectAll = async () => {
    const batchesToReject = batches.filter(b => !selected.has(b.id));
    if (!batchesToReject.length) return;
    setSubmitting(true);
    try {
      await onReject({ batches: batchesToReject, rejNotes });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
      style={{ background:'#fff', border:'1.5px solid #B3E5FC',
        borderRadius:16, overflow:'hidden', marginBottom:16,
        boxShadow:'0 4px 20px rgba(2,136,209,0.08)' }}>

      {/* Admin header */}
      <div style={{ padding:'16px 20px', background:'linear-gradient(135deg,#E1F5FE,#F5FBFF)',
        borderBottom:'1px solid #B3E5FC', display:'flex', alignItems:'center',
        gap:14, cursor:'pointer' }} onClick={() => setExpanded(e => !e)}>
        <div style={{ width:44, height:44, borderRadius:12,
          background:'linear-gradient(135deg,#0288D1,#01579B)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:20, color:'#fff', flexShrink:0, fontWeight:700 }}>
          {(admin.full_name || 'A').charAt(0).toUpperCase()}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#01579B', marginBottom:2 }}>
            {admin.full_name}
          </div>
          <div style={{ fontSize:12, color:'#4FC3F7', display:'flex', gap:10, flexWrap:'wrap' }}>
            <span>📧 {admin.email}</span>
            {admin.phone && (
              <a href={`tel:${admin.phone}`}
                onClick={e => e.stopPropagation()}
                style={{ color:'#0288D1', fontWeight:700, textDecoration:'none' }}>
                📞 {admin.phone}
              </a>
            )}
            {admin.city && <span>📍 {admin.city}{admin.state ? `, ${admin.state}` : ''}</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end' }}>
          <span style={chip('#FEF3C7','#92400E','#FDE68A')}>
            ⏳ {batches.length} batch{batches.length !== 1 ? 'es' : ''}
          </span>
          <span style={chip('#EFF6FF','#1D4ED8','#BFDBFE')}>
            {totalUnits} units
          </span>
          <span style={chip('#F0FDF4','#15803D','#BBF7D0')}>
            ₹{totalCost.toFixed(2)}
          </span>
        </div>
        <span style={{ fontSize:16, color:'#0288D1' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }}
            exit={{ height:0, opacity:0 }} style={{ overflow:'hidden' }}>
            <div style={{ padding:'20px' }}>

              {/* Stockist bill preview */}
              {billImageUrl && (
                <div style={{ marginBottom:16, padding:'12px 16px',
                  background:'#F5FBFF', border:'1px solid #B3E5FC', borderRadius:10,
                  display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:20 }}>📄</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#0288D1' }}>
                      Stockist Bill Uploaded
                    </div>
                    {billAmount && (
                      <div style={{ fontSize:11, color:'#555' }}>
                        Bill amount: <strong>₹{Number(billAmount).toFixed(2)}</strong>
                        &nbsp;·&nbsp; Calculated: <strong>₹{totalCost.toFixed(2)}</strong>
                        {Math.abs(billAmount - totalCost) > 0.5 && (
                          <span style={{ color:'#F57F17', marginLeft:8 }}>
                            ⚠️ Diff: ₹{Math.abs(billAmount - totalCost).toFixed(2)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <a href={billImageUrl} target="_blank" rel="noreferrer"
                    style={{ fontSize:12, color:'#0288D1', fontWeight:600,
                      textDecoration:'underline' }}>
                    View Bill
                  </a>
                </div>
              )}

              {/* Batch rows */}
              <div style={{ fontSize:11, fontWeight:700, color:'#0288D1',
                textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:10 }}>
                Select batches to approve
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                {batches.map(batch => {
                  const isSelected  = selected.has(batch.id);
                  const batchCost   = parseFloat(batch.cost_price_per_pack || 0) * (batch.quantity_packs || 0);
                  return (
                    <div key={batch.id} style={{
                      border: `1.5px solid ${isSelected ? '#0288D1' : '#E3F2FD'}`,
                      borderRadius:10, padding:'12px 14px',
                      background: isSelected ? '#F5FBFF' : '#fafafa',
                      cursor:'pointer', transition:'all 0.15s',
                    }} onClick={() => toggleBatch(batch.id)}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        {/* Checkbox */}
                        <div style={{ width:20, height:20, borderRadius:6, flexShrink:0,
                          border:`2px solid ${isSelected ? '#0288D1' : '#ccc'}`,
                          background: isSelected ? '#0288D1' : '#fff',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          color:'#fff', fontSize:12, fontWeight:700 }}>
                          {isSelected && '✓'}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center',
                            gap:8, flexWrap:'wrap', marginBottom:2 }}>
                            <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>
                              {batch.medicines?.name || '—'}
                            </span>
                            {batch.medicines?.strength && (
                              <span style={{ fontSize:11, color:'#888' }}>
                                {batch.medicines.strength}
                              </span>
                            )}
                            <span style={{ fontFamily:'monospace', fontSize:11,
                              background:'#EFF6FF', color:'#1D4ED8',
                              padding:'1px 7px', borderRadius:20 }}>
                              {batch.batch_number}
                            </span>
                            <ExpiryChip date={batch.expiry_date} />
                          </div>
                          <div style={{ display:'flex', gap:14, fontSize:11, color:'#666', flexWrap:'wrap' }}>
                            <span>{batch.quantity_packs} packs · {batch.total_units} units</span>
                            <span>Cost: ₹{Number(batch.cost_price_per_pack || 0).toFixed(2)}/pack</span>
                            <span>MRP: ₹{Number(batch.mrp_per_pack || 0).toFixed(2)}/pack</span>
                            <span style={{ fontWeight:600, color:'#0288D1' }}>
                              Total: ₹{batchCost.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Per-batch rejection note (only when not selected) */}
                      {!isSelected && (
                        <div style={{ marginTop:8 }} onClick={e => e.stopPropagation()}>
                          <input
                            placeholder="Rejection reason for this batch (optional)"
                            value={rejNotes[batch.id] || ''}
                            onChange={e => setRejNotes(prev => ({ ...prev, [batch.id]: e.target.value }))}
                            style={{ width:'100%', padding:'6px 10px', fontSize:11,
                              border:'1px solid #FECACA', borderRadius:7, background:'#FFF5F5',
                              color:'#B91C1C', fontFamily:'inherit', outline:'none' }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Devta note */}
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'#0288D1',
                  display:'block', marginBottom:5, textTransform:'uppercase',
                  letterSpacing:'0.5px' }}>
                  Approval Note (optional)
                </label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Add a note to this approval…"
                  style={{ width:'100%', minHeight:56, padding:'9px 12px',
                    fontSize:12, border:'1.5px solid #B3E5FC', borderRadius:9,
                    background:'#F5FBFF', color:'#01579B', fontFamily:'inherit',
                    outline:'none', resize:'vertical' }}
                />
              </div>

              {/* Action buttons */}
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end', flexWrap:'wrap' }}>
                {batches.some(b => !selected.has(b.id)) && (
                  <button onClick={handleRejectAll} disabled={submitting}
                    style={{ padding:'9px 20px', background:'#FEE2E2', color:'#B91C1C',
                      border:'none', borderRadius:10, fontSize:13, fontWeight:600,
                      cursor:'pointer', fontFamily:'inherit' }}>
                    ✕ Reject Unselected ({batches.filter(b => !selected.has(b.id)).length})
                  </button>
                )}
                <button onClick={handleApprove} disabled={submitting || !selectedBatches.length}
                  style={{ padding:'9px 24px',
                    background: selectedBatches.length ? 'linear-gradient(135deg,#0288D1,#01579B)' : '#ccc',
                    color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:700,
                    cursor: selectedBatches.length ? 'pointer' : 'default',
                    fontFamily:'inherit',
                    boxShadow: selectedBatches.length ? '0 4px 16px rgba(2,136,209,0.3)' : 'none',
                    display:'flex', alignItems:'center', gap:8 }}>
                  {submitting ? '⏳ Processing…' : `✓ Approve ${selectedBatches.length} batch${selectedBatches.length !== 1 ? 'es' : ''} & Generate Bill`}
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main DevtaDashboard ────────────────────────────────────────────────────────
export default function DevtaDashboard() {
  const navigate = useNavigate();
  const session  = getSession();

  const [active,        setActive]        = useState('pending');
  const [pendingGroups, setPendingGroups] = useState([]);
  const [approvedBills, setApprovedBills] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [banner,        setBanner]        = useState(null);
  const [stats,         setStats]         = useState({ pending:0, approved:0, admins:0 });

  // People requests (employees from stores + admin team from admins)
  const [pendingEmployees,  setPendingEmployees]  = useState([]);
  const [pendingAdminTeam,  setPendingAdminTeam]  = useState([]);
  const [empLoading,        setEmpLoading]        = useState(false);

  // Stores tab
  const [adminsList,    setAdminsList]    = useState([]);
  const [showAddStore,  setShowAddStore]  = useState(false);

  // Always resolve devta id from DB using email — never trust session.id alone
  // (old sessions saved before id was added will have session.id = undefined)
  const [devtaId, setDevtaId] = useState(session?.id || null);

  useEffect(() => {
    if (!session || session.role !== 'devta') { navigate('/login'); return; }

    // Re-fetch devta id from DB by email to be safe
    supabase.from('devta')
      .select('id')
      .eq('email', session.email)
      .single()
      .then(({ data }) => {
        if (data?.id) {
          setDevtaId(data.id);
          // Patch the session so future loads don't need a DB hit
          if (!session.id || session.id !== data.id) {
            saveSession({ ...session, id: data.id });
          }
          // Re-fetch approved bills now that we have the correct devta id
          fetchApprovedWithId(data.id);
        }
      });

    fetchAll();
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchPending(), fetchApproved()]);
    setLoading(false);
    // Also load admins list for the Stores tab
    supabase.from('admins').select('id, full_name, email, city, state, region').eq('is_active', true).order('full_name')
      .then(({ data }) => setAdminsList(data || []));
  }, [devtaId]);

  // ── Fetch all pending batches grouped by admin ────────────────────────────
  const fetchPending = async () => {
    const { data: batches } = await supabase
      .from('medicine_batches')
      .select(`
        *,
        medicines(id, name, strength, type, manufacturer, pack_size, pack_unit),
        admins(id, full_name, email, phone, city, state, region)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (!batches?.length) {
      setPendingGroups([]);
      setStats(s => ({ ...s, pending: 0, admins: 0 }));
      return;
    }

    // Group by admin
    const map = {};
    batches.forEach(b => {
      const aid = b.admin_id || 'unknown';
      if (!map[aid]) map[aid] = { admin: b.admins || { id: aid, full_name: 'Unknown Admin' }, batches: [] };
      map[aid].batches.push(b);
    });

    const groups = Object.values(map);
    setPendingGroups(groups);
    setStats(s => ({ ...s, pending: batches.length, admins: groups.length }));
  };

  // ── Fetch approved bills ──────────────────────────────────────────────────
  const fetchApprovedWithId = async (id) => {
    if (!id) return;
    const { data: bills } = await supabase
      .from('purchase_order_bills')
      .select('*, admins(full_name, email, phone, city, state)')
      .eq('devta_id', id)
      .order('approved_at', { ascending: false })
      .limit(50);
    setApprovedBills(bills || []);
    setStats(s => ({ ...s, approved: bills?.length || 0 }));
  };

  const fetchApproved = async () => {
    await fetchApprovedWithId(devtaId);
  };

  // ── Approve action ────────────────────────────────────────────────────────
  const handleApprove = async ({ admin, batches, note, billAmount,
    supplierName, supplierInvoice, purchaseDate, stockistBillUrl }) => {
    try {
      const billNumber  = await generateBillNumber(admin.full_name);
      const batchIds    = batches.map(b => b.id);
      const totalCost   = batches.reduce((s, b) =>
        s + parseFloat(b.cost_price_per_pack || 0) * (b.quantity_packs || 0), 0);
      const totalUnits  = batches.reduce((s, b) => s + (b.total_units || 0), 0);

      // 1. Insert purchase_order_bills record
      const { data: bill, error: billErr } = await supabase
        .from('purchase_order_bills')
        .insert({
          bill_number:      billNumber,
          admin_id:         admin.id,
          devta_id:         devtaId || null,
          batch_ids:        batchIds,
          supplier_name:    supplierName || null,
          supplier_invoice: supplierInvoice || null,
          purchase_date:    purchaseDate || new Date().toISOString().split('T')[0],
          total_medicines:  [...new Set(batches.map(b => b.medicine_id))].length,
          total_batches:    batches.length,
          total_units:      totalUnits,
          total_cost:       totalCost,
          bill_amount:      billAmount || totalCost,
          stockist_bill_url:stockistBillUrl || null,
          devta_note:       note || null,
          pdf_generated:    false,
        })
        .select()
        .single();

      if (billErr) throw new Error(billErr.message);

      // 2. Update each batch → status=approved
      await supabase.from('medicine_batches')
        .update({
          status:          'approved',
          approved_bill_id: bill.id,
          approved_by:     devtaId || null,
          approved_at:     new Date().toISOString(),
        })
        .in('id', batchIds);

      // 3. Generate PDF HTML + upload to storage
      const { blob } = generatePurchaseOrderPDF({
        bill:    { ...bill, approved_at: new Date().toISOString() },
        admin,
        devta:   { name: session.name },
        batches: batches.map(b => ({ ...b, medicines: b.medicines })),
        printNow: true,  // opens print dialog
      });

      const pdfFile = new File([blob], `${billNumber}.html`, { type: 'text/html' });
      const pdfUrl  = await uploadFile('purchase-order-pdfs', pdfFile, 'bills');

      // 4. Save PDF url back to bill record
      await supabase.from('purchase_order_bills')
        .update({ pdf_url: pdfUrl, pdf_generated: true })
        .eq('id', bill.id);

      showBannerMsg(`✓ ${batches.length} batch${batches.length !== 1 ? 'es' : ''} approved. Bill ${billNumber} generated!`);
      fetchAll();
    } catch (ex) {
      showBannerMsg(`⛔ Error: ${ex.message}`);
    }
  };

  // ── Re-generate PDF for an existing bill ─────────────────────────────────
  const handleGenerateBill = async (bill) => {
    try {
      // Fetch batches for this bill
      const { data: batches } = await supabase
        .from('medicine_batches')
        .select('*, medicines(id, name, strength, type, manufacturer, pack_size, pack_unit)')
        .in('id', bill.batch_ids || []);

      if (!batches?.length) throw new Error('No batches found for this bill');

      // Fetch admin details
      const { data: admin } = await supabase
        .from('admins')
        .select('id, full_name, email, phone, city, state, region')
        .eq('id', bill.admin_id)
        .single();

      const { blob } = generatePurchaseOrderPDF({
        bill:     { ...bill, approved_at: bill.approved_at || new Date().toISOString() },
        admin:    admin || { full_name: 'Admin', email: '' },
        devta:    { name: session.name },
        batches,
        printNow: true,
      });

      const pdfFile = new File([blob], `${bill.bill_number}.html`, { type: 'text/html' });
      const pdfUrl  = await uploadFile('purchase-order-pdfs', pdfFile, 'bills');

      await supabase.from('purchase_order_bills')
        .update({ pdf_url: pdfUrl, pdf_generated: true })
        .eq('id', bill.id);

      showBannerMsg(`✓ Bill ${bill.bill_number} generated successfully!`);
      fetchApproved();
    } catch (ex) {
      showBannerMsg(`⛔ Could not generate bill: ${ex.message}`);
    }
  };
  const handleReject = async ({ batches, rejNotes }) => {
    try {
      for (const b of batches) {
        await supabase.from('medicine_batches')
          .update({
            status:         'rejected',
            rejection_note: rejNotes?.[b.id] || null,
          })
          .eq('id', b.id);
      }
      showBannerMsg(`✕ ${batches.length} batch${batches.length !== 1 ? 'es' : ''} rejected.`);
      fetchAll();
    } catch (ex) {
      showBannerMsg(`⛔ Error: ${ex.message}`);
    }
  };

  const showBannerMsg = (msg) => {
    setBanner(msg);
    setTimeout(() => setBanner(null), 7000);
  };

  // ── Devta own expenses ────────────────────────────────────────────────────
  const [devtaExpenses,    setDevtaExpenses]    = useState([]);
  const [expLoading2,      setExpLoading2]      = useState(false);
  const [showExpenseForm,  setShowExpenseForm]  = useState(false);
  const [expForm,          setExpForm]          = useState({
    category:'miscellaneous', description:'', amount:'',
    expense_date: new Date().toISOString().split('T')[0],
    payment_method:'cash', notes:'',
  });
  const [expProof, setExpProof]     = useState(null);
  const [expSaving, setExpSaving]   = useState(false);

  const fetchDevtaExpenses = useCallback(async () => {
    if (!devtaId) return;
    setExpLoading2(true);
    const { data } = await supabase.from('devta_expenses')
      .select('*').eq('devta_id', devtaId)
      .order('expense_date', { ascending: false }).limit(50);
    setDevtaExpenses(data || []);
    setExpLoading2(false);
  }, [devtaId]);

  useEffect(() => { if (active === 'expenses' && devtaId) fetchDevtaExpenses(); }, [active, devtaId]);

  const handleAddDevtaExpense = async () => {
    if (!expForm.description.trim()) { showBannerMsg('⚠️ Description required'); return; }
    if (!expForm.amount || parseFloat(expForm.amount) <= 0) { showBannerMsg('⚠️ Enter valid amount'); return; }
    setExpSaving(true);
    try {
      let proofUrl = null;
      if (expProof) {
        const { uploadFile } = await import('../utils/storage');
        proofUrl = await uploadFile('devta-expense-proofs', expProof, 'devta');
      }
      const { error } = await supabase.from('devta_expenses').insert({
        devta_id:       devtaId,
        category:       expForm.category,
        description:    expForm.description.trim(),
        amount:         parseFloat(expForm.amount),
        expense_date:   expForm.expense_date,
        payment_method: expForm.payment_method,
        proof_url:      proofUrl,
        notes:          expForm.notes.trim() || null,
      });
      if (error) throw new Error(error.message);
      setShowExpenseForm(false);
      setExpForm({ category:'miscellaneous', description:'', amount:'',
        expense_date: new Date().toISOString().split('T')[0],
        payment_method:'cash', notes:'' });
      setExpProof(null);
      fetchDevtaExpenses();
      showBannerMsg('✓ Expense recorded!');
    } catch (ex) { showBannerMsg('⛔ ' + ex.message); }
    finally { setExpSaving(false); }
  };

  // ── People Requests (employees + admin team) ──────────────────────────────
  const fetchPeopleRequests = useCallback(async () => {
    setEmpLoading(true);
    const [{ data: emps }, { data: team }] = await Promise.all([
      supabase.from('employees')
        .select('*, stores(store_name, city, admins(full_name, phone))')
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
      supabase.from('admin_team')
        .select('*, admins(full_name, email, phone, city)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
    ]);
    setPendingEmployees(emps || []);
    setPendingAdminTeam(team || []);
    setEmpLoading(false);
  }, []);

  useEffect(() => {
    if (active === 'employees') fetchPeopleRequests();
  }, [active]);

  // Approve a store employee
  const handleApproveEmployee = async (emp) => {
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('employees').update({
      status: 'approved', is_active: true,
      reviewed_at: new Date().toISOString(),
    }).eq('id', emp.id);

    // Auto-create monthly salary expense for this store
    if (emp.salary && emp.store_id) {
      await supabase.from('expenses').insert({
        store_id:     emp.store_id,
        category:     'salary',
        description:  `Monthly salary — ${emp.full_name} (${emp.designation || 'Employee'})`,
        amount:       parseFloat(emp.salary),
        expense_date: today,
        notes:        `Auto-generated on employee approval. Salary type: ${emp.salary_type}`,
      });
    }

    showBannerMsg(`✓ ${emp.full_name} approved. Monthly salary expense added.`);
    fetchPeopleRequests();
  };

  // Reject a store employee
  const handleRejectEmployee = async (emp, reason) => {
    await supabase.from('employees').update({
      status: 'rejected',
      admin_note: reason || null,
      reviewed_at: new Date().toISOString(),
    }).eq('id', emp.id);
    showBannerMsg(`✕ ${emp.full_name} rejected.`);
    fetchPeopleRequests();
  };

  // Approve an admin team member
  const handleApproveAdminTeam = async (member) => {
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('admin_team').update({
      status: 'approved', is_active: true,
      reviewed_at: new Date().toISOString(),
      reviewed_by: devtaId || null,
    }).eq('id', member.id);

    // Auto-create monthly salary expense for this admin
    if (member.salary && member.admin_id) {
      await supabase.from('admin_expenses').insert({
        admin_id:       member.admin_id,
        category:       'staff_salary',
        description:    `Monthly salary — ${member.full_name} (${member.designation || 'Warehouse Staff'})`,
        amount:         parseFloat(member.salary),
        expense_date:   today,
        payment_method: 'cash',
        notes:          `Auto-generated on team member approval. Salary type: ${member.salary_type}`,
      });
    }

    showBannerMsg(`✓ ${member.full_name} approved. Monthly salary expense added.`);
    fetchPeopleRequests();
  };

  // Reject an admin team member
  const handleRejectAdminTeam = async (member, reason) => {
    await supabase.from('admin_team').update({
      status: 'rejected',
      devta_note: reason || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: devtaId || null,
    }).eq('id', member.id);
    showBannerMsg(`✕ ${member.full_name} rejected.`);
    fetchPeopleRequests();
  };

  const handleLogout = () => { clearSession(); navigate('/login'); };

  const initials = (session?.name || 'D').slice(0, 2).toUpperCase();

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,#E1F5FE 0%,#F5FBFF 50%,#fff 100%)',
      fontFamily:"'Inter',-apple-system,sans-serif", color:'#1a1a2e' }}>

      {/* ── Top bar ── */}
      <header style={{ background:'rgba(255,255,255,0.85)', backdropFilter:'blur(20px)',
        borderBottom:'1px solid #B3E5FC', padding:'0 28px', height:58,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        position:'sticky', top:0, zIndex:40,
        boxShadow:'0 2px 16px rgba(2,136,209,0.08)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:10,
            background:'linear-gradient(135deg,#0288D1,#01579B)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:18 }}>🌤️</div>
          <span style={{ fontWeight:800, fontSize:16, color:'#01579B',
            letterSpacing:'-0.3px' }}>
            Devta <span style={{ color:'#0288D1' }}>Portal</span>
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:32, height:32, borderRadius:'50%',
            background:'linear-gradient(135deg,#0288D1,#01579B)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:12, fontWeight:700, color:'#fff' }}>
            {initials}
          </div>
          <span style={{ fontSize:13, color:'#0288D1', fontWeight:600 }}>
            {session?.name}
          </span>
          <button onClick={handleLogout}
            style={{ background:'#FEE2E2', color:'#B91C1C', border:'none',
              borderRadius:8, padding:'6px 14px', fontSize:12, fontWeight:600,
              cursor:'pointer', fontFamily:'inherit' }}>
            Logout
          </button>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div style={{ display:'flex', maxWidth:1200, margin:'0 auto',
        padding:'28px 24px', gap:24 }}>

        {/* Sidebar */}
        <aside style={{ width:200, flexShrink:0 }}>
          {/* Stat cards */}
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
            {[
              { label:'Pending Batches',   value:stats.pending,  color:'#F57F17', bg:'#FFF8E1' },
              { label:'Admins Waiting',    value:stats.admins,   color:'#0288D1', bg:'#E1F5FE' },
              { label:'Bills Issued',      value:stats.approved, color:'#2E7D32', bg:'#E8F5E9' },
              { label:'People Requests',   value: pendingEmployees.length + pendingAdminTeam.length, color:'#7C3AED', bg:'#F5F3FF' },
            ].map((s, i) => (
              <div key={i} style={{ background:s.bg, borderRadius:12,
                padding:'12px 14px', border:`1px solid ${s.color}22` }}>
                <div style={{ fontSize:10, fontWeight:700, color:s.color,
                  textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>
                  {s.label}
                </div>
                <div style={{ fontSize:26, fontWeight:800, color:s.color, lineHeight:1 }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Nav */}
          <nav style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {NAV.map(n => (
              <button key={n.id} onClick={() => setActive(n.id)}
                style={{ display:'flex', alignItems:'center', gap:10,
                  padding:'10px 14px', borderRadius:11, border:'none',
                  cursor:'pointer', fontFamily:'inherit', fontSize:13,
                  fontWeight: active === n.id ? 700 : 500,
                  background: active === n.id ? 'rgba(2,136,209,0.12)' : 'transparent',
                  color: active === n.id ? '#0288D1' : '#666',
                  transition:'all 0.15s' }}>
                <span style={{ fontSize:16 }}>{n.icon}</span>
                {n.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main style={{ flex:1, minWidth:0 }}>

          {/* Banner */}
          <AnimatePresence>
            {banner && (
              <motion.div key="banner"
                initial={{ opacity:0, y:-12 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                style={{ background: banner.startsWith('⛔') ? '#FEE2E2' : '#DCFCE7',
                  border:`1px solid ${banner.startsWith('⛔') ? '#FECACA' : '#BBF7D0'}`,
                  color: banner.startsWith('⛔') ? '#B91C1C' : '#15803D',
                  borderRadius:12, padding:'12px 18px', marginBottom:20,
                  display:'flex', justifyContent:'space-between',
                  fontSize:13, fontWeight:500 }}>
                <span>{banner}</span>
                <button onClick={() => setBanner(null)}
                  style={{ background:'none', border:'none', cursor:'pointer',
                    fontSize:15, color:'inherit' }}>✕</button>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div style={{ textAlign:'center', padding:60, color:'#0288D1', fontSize:14 }}>
              Loading…
            </div>
          ) : (
            <AnimatePresence mode="wait">

              {/* ── Pending tab ── */}
              {active === 'pending' && (
                <motion.div key="pending"
                  initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
                  <div style={{ display:'flex', alignItems:'center',
                    justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
                    <div>
                      <div style={{ fontSize:22, fontWeight:800, color:'#01579B',
                        letterSpacing:'-0.3px', marginBottom:2 }}>
                        ⏳ Pending Approvals
                      </div>
                      <div style={{ fontSize:13, color:'#4FC3F7' }}>
                        {pendingGroups.length > 0
                          ? `${pendingGroups.length} admin${pendingGroups.length !== 1 ? 's' : ''} awaiting verification`
                          : 'All clear — nothing pending'}
                      </div>
                    </div>
                    <button onClick={fetchAll}
                      style={{ background:'#E1F5FE', color:'#0288D1', border:'none',
                        borderRadius:9, padding:'8px 16px', fontSize:12, fontWeight:600,
                        cursor:'pointer', fontFamily:'inherit' }}>
                      ↺ Refresh
                    </button>
                  </div>

                  {pendingGroups.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'60px 20px',
                      background:'#fff', borderRadius:16,
                      border:'1.5px solid #B3E5FC',
                      boxShadow:'0 4px 20px rgba(2,136,209,0.06)' }}>
                      <div style={{ fontSize:52, marginBottom:14, opacity:0.3 }}>🌤️</div>
                      <div style={{ fontSize:17, fontWeight:700, color:'#0288D1', marginBottom:6 }}>
                        All clear!
                      </div>
                      <div style={{ fontSize:13, color:'#4FC3F7' }}>
                        No pending batch approvals right now.
                      </div>
                    </div>
                  ) : (
                    pendingGroups.map(({ admin, batches }) => (
                      <AdminBatchGroup
                        key={admin.id}
                        admin={admin}
                        batches={batches}
                        onApprove={handleApprove}
                        onReject={handleReject}
                      />
                    ))
                  )}
                </motion.div>
              )}

              {/* ── Approved Bills tab ── */}
              {active === 'approved' && (
                <motion.div key="approved"
                  initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:4 }}>
                    <div style={{ fontSize:22, fontWeight:800, color:'#01579B', letterSpacing:'-0.3px' }}>
                      ✓ Bills Approved by You
                    </div>
                    <button onClick={fetchAll}
                      style={{ background:'#E1F5FE', color:'#0288D1', border:'none',
                        borderRadius:9, padding:'8px 16px', fontSize:12, fontWeight:600,
                        cursor:'pointer', fontFamily:'inherit', display:'flex',
                        alignItems:'center', gap:6 }}>
                      ↺ Refresh
                    </button>
                  </div>
                  <div style={{ fontSize:13, color:'#4FC3F7', marginBottom:20 }}>
                    {approvedBills.length} bill{approvedBills.length !== 1 ? 's' : ''} you have personally verified and approved
                  </div>

                  {approvedBills.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'60px 20px',
                      background:'#fff', borderRadius:16, border:'1.5px solid #B3E5FC' }}>
                      <div style={{ fontSize:52, marginBottom:14, opacity:0.3 }}>📋</div>
                      <div style={{ fontSize:16, fontWeight:700, color:'#0288D1', marginBottom:6 }}>
                        No bills yet
                      </div>
                      <div style={{ fontSize:13, color:'#4FC3F7' }}>
                        Bills you approve will appear here
                      </div>
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {approvedBills.map((bill, i) => (
                        <motion.div key={bill.id}
                          initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                          transition={{ delay:i * 0.03 }}
                          style={{ background:'#fff', border:'1.5px solid #B3E5FC',
                            borderRadius:14, overflow:'hidden',
                            boxShadow:'0 2px 10px rgba(2,136,209,0.06)' }}>

                          {/* Top row */}
                          <div style={{ display:'flex', alignItems:'center', gap:14,
                            padding:'14px 18px', flexWrap:'wrap' }}>
                            {/* Bill number + meta */}
                            <div style={{ minWidth:0, flex:1 }}>
                              <div style={{ fontSize:15, fontWeight:800, color:'#0288D1',
                                fontFamily:'monospace', marginBottom:3 }}>
                                {bill.bill_number}
                              </div>
                              <div style={{ fontSize:11, color:'#888', display:'flex',
                                gap:10, flexWrap:'wrap' }}>
                                <span>👤 {bill.admins?.full_name}</span>
                                <span>🗓️ {new Date(bill.approved_at).toLocaleDateString('en-IN',
                                  { day:'2-digit', month:'short', year:'numeric' })}</span>
                              </div>
                            </div>
                            {/* Stats */}
                            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                              <span style={chip('#EFF6FF','#1D4ED8','#BFDBFE')}>
                                {bill.total_batches} batch{bill.total_batches !== 1 ? 'es' : ''}
                              </span>
                              <span style={chip('#F5F3FF','#6D28D9','#DDD6FE')}>
                                {bill.total_units} units
                              </span>
                              <span style={chip('#F0FDF4','#15803D','#BBF7D0')}>
                                ₹{Number(bill.bill_amount).toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {/* Action buttons row */}
                          <div style={{ display:'flex', gap:8, padding:'10px 18px',
                            borderTop:'1px solid #E1F5FE', background:'#F5FBFF',
                            flexWrap:'wrap' }}>
                            {bill.stockist_bill_url && (
                              <a href={bill.stockist_bill_url} target="_blank" rel="noreferrer"
                                style={{ padding:'7px 14px', background:'#E1F5FE',
                                  color:'#0288D1', borderRadius:8, fontSize:12,
                                  fontWeight:600, textDecoration:'none', display:'inline-flex',
                                  alignItems:'center', gap:5 }}>
                                📄 Stockist Bill
                              </a>
                            )}
                            {bill.pdf_url ? (
                              <>
                                {/* View — fetch HTML and render it in a new tab */}
                                {/* View — renders HTML properly in new tab */}
                                <button
                                  onClick={async () => {
                                    try {
                                      const res = await fetch(bill.pdf_url);
                                      const html = await res.text();
                                      const win = window.open('', '_blank');
                                      win.document.open();
                                      win.document.write(html);
                                      win.document.close();
                                    } catch(e) {
                                      alert('Could not open bill: ' + e.message);
                                    }
                                  }}
                                  style={{ padding:'7px 16px', background:'#E8F5E9',
                                    color:'#2E7D32', border:'none', borderRadius:8,
                                    fontSize:12, fontWeight:600, cursor:'pointer',
                                    fontFamily:'inherit', display:'inline-flex',
                                    alignItems:'center', gap:5 }}>
                                  📋 View Bill
                                </button>
                                {/* Save as PDF — opens rendered bill + auto print dialog, user selects Save as PDF */}
                                <button
                                  onClick={async () => {
                                    try {
                                      const res = await fetch(bill.pdf_url);
                                      const html = await res.text();
                                      const printHtml = html.replace(
                                        '</body>',
                                        `<script>window.onload=function(){setTimeout(function(){window.print();},400);}<\/script></body>`
                                      );
                                      const win = window.open('', '_blank');
                                      win.document.open();
                                      win.document.write(printHtml);
                                      win.document.close();
                                    } catch(e) {
                                      alert('Could not open print dialog: ' + e.message);
                                    }
                                  }}
                                  style={{ padding:'7px 16px', background:'#FEF3C7',
                                    color:'#92400E', border:'none', borderRadius:8,
                                    fontSize:12, fontWeight:600, cursor:'pointer',
                                    fontFamily:'inherit', display:'inline-flex',
                                    alignItems:'center', gap:5 }}>
                                  🖨️ Save as PDF
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleGenerateBill(bill)}
                                style={{ padding:'7px 16px',
                                  background:'linear-gradient(135deg,#0288D1,#01579B)',
                                  color:'#fff', border:'none', borderRadius:8,
                                  fontSize:12, fontWeight:700, cursor:'pointer',
                                  fontFamily:'inherit', display:'inline-flex',
                                  alignItems:'center', gap:6,
                                  boxShadow:'0 3px 10px rgba(2,136,209,0.3)' }}>
                                📋 Generate Bill
                              </button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── Employees / People Requests tab ── */}
              {active === 'employees' && (
                <motion.div key="employees"
                  initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    marginBottom:20, flexWrap:'wrap', gap:10 }}>
                    <div>
                      <div style={{ fontSize:22, fontWeight:800, color:'#01579B',
                        letterSpacing:'-0.3px', marginBottom:2 }}>
                        👥 People Requests
                      </div>
                      <div style={{ fontSize:13, color:'#4FC3F7' }}>
                        Pending employee requests from stores + admin warehouse staff
                      </div>
                    </div>
                    <button onClick={fetchPeopleRequests}
                      style={{ background:'#E1F5FE', color:'#0288D1', border:'none',
                        borderRadius:9, padding:'8px 16px', fontSize:12, fontWeight:600,
                        cursor:'pointer', fontFamily:'inherit' }}>
                      ↺ Refresh
                    </button>
                  </div>

                  {empLoading ? (
                    <div style={{ textAlign:'center', padding:40, color:'#4FC3F7', fontSize:14 }}>Loading…</div>
                  ) : (pendingEmployees.length === 0 && pendingAdminTeam.length === 0) ? (
                    <div style={{ textAlign:'center', padding:'60px 20px', background:'#fff',
                      borderRadius:16, border:'1.5px solid #B3E5FC' }}>
                      <div style={{ fontSize:48, opacity:0.2, marginBottom:14 }}>👥</div>
                      <div style={{ fontSize:16, fontWeight:700, color:'#0288D1' }}>No pending requests</div>
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                      {/* Store employees */}
                      {pendingEmployees.length > 0 && (
                        <>
                          <div style={{ fontSize:12, fontWeight:700, color:'#0288D1',
                            textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:4 }}>
                            🏪 Store Employees ({pendingEmployees.length})
                          </div>
                          {pendingEmployees.map(emp => (
                            <PersonCard key={emp.id} person={emp}
                              subtitle={`Store: ${emp.stores?.store_name || '—'} · ${emp.stores?.city || ''}`}
                              adminPhone={emp.stores?.admins?.phone}
                              onApprove={() => handleApproveEmployee(emp)}
                              onReject={(r) => handleRejectEmployee(emp, r)} />
                          ))}
                        </>
                      )}
                      {/* Admin team */}
                      {pendingAdminTeam.length > 0 && (
                        <>
                          <div style={{ fontSize:12, fontWeight:700, color:'#7C3AED',
                            textTransform:'uppercase', letterSpacing:'0.6px',
                            marginBottom:4, marginTop:8 }}>
                            💼 Admin Warehouse Staff ({pendingAdminTeam.length})
                          </div>
                          {pendingAdminTeam.map(m => (
                            <PersonCard key={m.id} person={m}
                              subtitle={`Admin: ${m.admins?.full_name || '—'} · ${m.admins?.city || ''}`}
                              adminPhone={m.admins?.phone}
                              onApprove={() => handleApproveAdminTeam(m)}
                              onReject={(r) => handleRejectAdminTeam(m, r)} />
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── Stores tab ── */}
              {active === 'stores' && (
                <motion.div key="stores"
                  initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    marginBottom:20, flexWrap:'wrap', gap:10 }}>
                    <div>
                      <div style={{ fontSize:22, fontWeight:800, color:'#01579B',
                        letterSpacing:'-0.3px', marginBottom:2 }}>
                        🏪 Add Store
                      </div>
                      <div style={{ fontSize:13, color:'#4FC3F7' }}>
                        Create a new store and assign it to an admin region
                      </div>
                    </div>
                    <button onClick={() => setShowAddStore(true)}
                      style={{ padding:'10px 22px',
                        background:'linear-gradient(135deg,#0288D1,#01579B)',
                        color:'#fff', border:'none', borderRadius:12,
                        fontSize:13, fontWeight:700, cursor:'pointer',
                        fontFamily:'inherit',
                        boxShadow:'0 4px 14px rgba(2,136,209,0.3)' }}>
                      🏪 Add New Store
                    </button>
                  </div>
                  <div style={{ textAlign:'center', padding:'60px 20px', background:'#fff',
                    borderRadius:16, border:'1.5px solid #B3E5FC' }}>
                    <div style={{ fontSize:48, opacity:0.2, marginBottom:14 }}>🏪</div>
                    <div style={{ fontSize:16, fontWeight:700, color:'#0288D1', marginBottom:6 }}>
                      Click "Add New Store" to create a store
                    </div>
                    <div style={{ fontSize:13, color:'#4FC3F7' }}>
                      You'll select which admin to assign it to.
                      The admin will be notified automatically.
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Devta Expenses tab ── */}
              {active === 'expenses' && (
                <motion.div key="expenses"
                  initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                    marginBottom:20, flexWrap:'wrap', gap:10 }}>
                    <div>
                      <div style={{ fontSize:22, fontWeight:800, color:'#01579B', letterSpacing:'-0.3px', marginBottom:2 }}>
                        💸 My Expenses
                      </div>
                      <div style={{ fontSize:13, color:'#4FC3F7' }}>
                        Record your operational expenses — visible to Vishnu
                      </div>
                    </div>
                    <button onClick={() => setShowExpenseForm(v => !v)}
                      style={{ padding:'9px 20px', background:'linear-gradient(135deg,#0288D1,#01579B)',
                        color:'#fff', border:'none', borderRadius:11, fontSize:13, fontWeight:700,
                        cursor:'pointer', fontFamily:'inherit', boxShadow:'0 3px 12px rgba(2,136,209,0.3)' }}>
                      + Add Expense
                    </button>
                  </div>

                  {/* Add expense form */}
                  <AnimatePresence>
                    {showExpenseForm && (
                      <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
                        exit={{ opacity:0, y:-8 }}
                        style={{ background:'#fff', border:'1.5px solid #B3E5FC', borderRadius:14,
                          padding:'20px 22px', marginBottom:18, boxShadow:'0 4px 16px rgba(2,136,209,0.1)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
                          <div style={{ fontSize:14, fontWeight:700, color:'#01579B' }}>New Expense</div>
                          <button onClick={() => setShowExpenseForm(false)}
                            style={{ background:'none', border:'none', cursor:'pointer', fontSize:17, color:'#888' }}>✕</button>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                          {[
                            { k:'description', label:'Description *', ph:'e.g. Office supplies, travel to admin meet' },
                            { k:'amount',      label:'Amount (₹) *',  ph:'0.00', type:'number' },
                            { k:'expense_date',label:'Date',           ph:'', type:'date' },
                          ].map(f => (
                            <div key={f.k}>
                              <label style={{ fontSize:11, fontWeight:600, color:'#0288D1',
                                display:'block', marginBottom:4 }}>{f.label}</label>
                              <input type={f.type||'text'} placeholder={f.ph}
                                value={expForm[f.k]}
                                onChange={e => setExpForm(p => ({ ...p, [f.k]: e.target.value }))}
                                style={{ width:'100%', padding:'8px 10px', fontSize:13,
                                  border:'1.5px solid #B3E5FC', borderRadius:8,
                                  background:'#F5FBFF', color:'#01579B',
                                  fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
                            </div>
                          ))}
                          <div>
                            <label style={{ fontSize:11, fontWeight:600, color:'#0288D1',
                              display:'block', marginBottom:4 }}>Payment Method</label>
                            <select value={expForm.payment_method}
                              onChange={e => setExpForm(p => ({ ...p, payment_method: e.target.value }))}
                              style={{ width:'100%', padding:'8px 10px', fontSize:13,
                                border:'1.5px solid #B3E5FC', borderRadius:8,
                                background:'#F5FBFF', color:'#01579B', fontFamily:'inherit', outline:'none' }}>
                              {['cash','upi','bank_transfer','cheque'].map(m => (
                                <option key={m} value={m}>{m.replace('_',' ')}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        {/* Proof upload */}
                        <div style={{ marginBottom:10 }}>
                          <label style={{ fontSize:11, fontWeight:600, color:'#0288D1',
                            display:'block', marginBottom:4 }}>Proof / Receipt (optional)</label>
                          {!expProof ? (
                            <div onClick={() => document.getElementById('devta-exp-proof').click()}
                              style={{ border:'2px dashed #B3E5FC', borderRadius:9, padding:'14px',
                                textAlign:'center', cursor:'pointer', background:'#F5FBFF',
                                fontSize:12, color:'#4FC3F7' }}>
                              📎 Click to upload (image or PDF, max 10MB)
                            </div>
                          ) : (
                            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
                              background:'#E1F5FE', borderRadius:9, border:'1px solid #B3E5FC' }}>
                              <span style={{ fontSize:16 }}>📄</span>
                              <span style={{ flex:1, fontSize:12, color:'#01579B', fontWeight:600,
                                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                {expProof.name}
                              </span>
                              <button onClick={() => setExpProof(null)}
                                style={{ background:'#FEE2E2', color:'#B91C1C', border:'none',
                                  borderRadius:6, padding:'3px 8px', fontSize:11, cursor:'pointer' }}>
                                Remove
                              </button>
                            </div>
                          )}
                          <input id="devta-exp-proof" type="file" accept="image/*,application/pdf"
                            style={{ display:'none' }}
                            onChange={e => {
                              const f = e.target.files[0];
                              if (f && f.size <= 10*1024*1024) setExpProof(f);
                              else if (f) alert('Max 10MB');
                            }} />
                        </div>
                        <textarea placeholder="Additional notes (optional)…"
                          value={expForm.notes}
                          onChange={e => setExpForm(p => ({ ...p, notes: e.target.value }))}
                          style={{ width:'100%', minHeight:50, padding:'8px 10px', fontSize:12,
                            border:'1.5px solid #B3E5FC', borderRadius:8, background:'#F5FBFF',
                            color:'#01579B', fontFamily:'inherit', outline:'none',
                            resize:'vertical', boxSizing:'border-box', marginBottom:12 }} />
                        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
                          <button onClick={() => setShowExpenseForm(false)}
                            style={{ padding:'8px 18px', background:'#E1F5FE', color:'#0288D1',
                              border:'none', borderRadius:9, fontSize:12, fontWeight:600,
                              cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                          <button onClick={handleAddDevtaExpense} disabled={expSaving}
                            style={{ padding:'8px 22px',
                              background:'linear-gradient(135deg,#0288D1,#01579B)',
                              color:'#fff', border:'none', borderRadius:9, fontSize:12,
                              fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                            {expSaving ? '⏳ Saving…' : '✓ Save Expense'}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Expenses list */}
                  {expLoading2 ? (
                    <div style={{ textAlign:'center', padding:40, color:'#4FC3F7', fontSize:14 }}>Loading…</div>
                  ) : devtaExpenses.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'50px 20px', background:'#fff',
                      borderRadius:14, border:'1.5px solid #B3E5FC' }}>
                      <div style={{ fontSize:40, opacity:0.2, marginBottom:12 }}>💸</div>
                      <div style={{ fontSize:15, fontWeight:700, color:'#0288D1' }}>No expenses yet</div>
                      <div style={{ fontSize:12, color:'#4FC3F7', marginTop:4 }}>Click "+ Add Expense" above</div>
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                      {devtaExpenses.map((e, i) => (
                        <motion.div key={e.id} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                          transition={{ delay:i*0.03 }}
                          style={{ background:'#fff', border:'1.5px solid #B3E5FC', borderRadius:12,
                            padding:'12px 16px', display:'flex', alignItems:'center', gap:12,
                            boxShadow:'0 2px 8px rgba(2,136,209,0.06)' }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:700, color:'#01579B', marginBottom:2 }}>
                              {e.description}
                            </div>
                            <div style={{ fontSize:11, color:'#4FC3F7', display:'flex', gap:8 }}>
                              <span>{new Date(e.expense_date).toLocaleDateString('en-IN')}</span>
                              <span style={{ textTransform:'capitalize' }}>· {e.category?.replace(/_/g,' ')}</span>
                              <span>· {e.payment_method?.replace('_',' ')}</span>
                            </div>
                            {e.notes && <div style={{ fontSize:11, color:'#888', marginTop:2, fontStyle:'italic' }}>{e.notes}</div>}
                          </div>
                          <div style={{ textAlign:'right', flexShrink:0 }}>
                            <div style={{ fontSize:15, fontWeight:800, color:'#B91C1C' }}>
                              ₹{Number(e.amount).toLocaleString('en-IN')}
                            </div>
                            {e.proof_url && (
                              <button onClick={async () => {
                                const res = await fetch(e.proof_url);
                                const html_or_blob = e.proof_url.endsWith('.html')
                                  ? await res.text() : null;
                                if (html_or_blob) {
                                  const w = window.open('', '_blank');
                                  w.document.write(html_or_blob); w.document.close();
                                } else { window.open(e.proof_url, '_blank'); }
                              }}
                                style={{ fontSize:10, color:'#0288D1', fontWeight:600,
                                  background:'none', border:'none', cursor:'pointer',
                                  textDecoration:'underline' }}>
                                📄 Proof
                              </button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

          </AnimatePresence>
          )}
        </main>
      </div>

      {/* Add Store Modal */}
      <AnimatePresence>
        {showAddStore && (
          <AddStoreModal
            adminsList={adminsList}
            onClose={() => setShowAddStore(false)}
            onSuccess={() => { setShowAddStore(false); showBannerMsg('✓ Store created and admin notified!'); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
