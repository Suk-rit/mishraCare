import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import RefreshButton from '../components/RefreshButton';

function daysLeft(d) { return Math.ceil((new Date(d) - new Date()) / 86400000); }

function ExpiryChip({ date }) {
  const d   = daysLeft(date);
  const fmt = new Date(date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' });
  const s   = d < 0   ? { bg:'#FEE2E2', color:'#B91C1C' }
            : d < 90  ? { bg:'#FEF3C7', color:'#92400E' }
            : d < 180 ? { bg:'#E0F2FE', color:'#0369A1' }
            :            { bg:'#DCFCE7', color:'#15803D' };
  return (
    <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20,
      ...s, border:`1px solid ${s.color}44` }}>
      {fmt}
    </span>
  );
}

const STATUS_CONFIG = {
  dispatched:         { bg:'#EFF6FF', color:'#1D4ED8', border:'#BFDBFE', label:'In Transit 🚚'   },
  received:           { bg:'#DCFCE7', color:'#15803D', border:'#BBF7D0', label:'Received ✓'       },
  partially_received: { bg:'#FEF3C7', color:'#92400E', border:'#FDE68A', label:'Partially Received'},
  issue_reported:     { bg:'#FEE2E2', color:'#B91C1C', border:'#FECACA', label:'Has Rejections ⚠️' },
  cancelled:          { bg:'#F1F5F9', color:'#64748B', border:'#CBD5E1', label:'Cancelled'         },
};

const TYPE_ICONS = {
  Tablet:'💊', Capsule:'💊', Syrup:'🧴', Injection:'💉', Drops:'💧',
  Cream:'🧴', Ointment:'🧴', Powder:'🧂', Inhaler:'🌬️', Patch:'🩹',
  Suppository:'💊', Lozenges:'🍬', Other:'📦',
};

export default function StoreTransfers({ storeId, managerId }) {
  const [transfers,    setTransfers]   = useState([]);
  const [loading,      setLoading]     = useState(true);
  const [expanded,     setExpanded]    = useState({});
  const [items,        setItems]       = useState({}); // { transfer_id: [items] }
  const [decisions,    setDecisions]   = useState({}); // { item_id: { accept: bool, reason: '' } }
  const [submitting,   setSubmitting]  = useState(null);
  const [filterStatus, setFilterStatus]= useState('dispatched');

  // Admin contact info (fetched once)
  const [adminContact, setAdminContact] = useState(null);

  useEffect(() => {
    if (storeId) {
      fetchTransfers();
      fetchAdminContact();
    }
  }, [storeId]);

  // Fetch the admin linked to this store
  const fetchAdminContact = async () => {
    const { data: store } = await supabase
      .from('stores')
      .select('admin_id, admins(full_name, phone, email)')
      .eq('id', storeId)
      .single();
    if (store?.admins) setAdminContact(store.admins);
  };

  const fetchTransfers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('stock_transfers')
      .select('*')
      .eq('store_id', storeId)
      .order('dispatched_at', { ascending: false });
    setTransfers(data || []);
    setLoading(false);
  };

  const fetchItems = async (transferId) => {
    if (items[transferId]) return;
    const { data } = await supabase
      .from('stock_transfer_items')
      .select('*, medicines(name, strength, type, pack_size, pack_unit), medicine_batches(discount_percent)')
      .eq('transfer_id', transferId);

    setItems(p => ({ ...p, [transferId]: data || [] }));

    // Init decisions: all accepted by default
    const init = {};
    (data || []).filter(it => it.item_status === 'pending').forEach(it => {
      init[it.id] = { accept: true, reason: '' };
    });
    setDecisions(p => ({ ...p, ...init }));
  };

  const toggleExpand = async (id) => {
    setExpanded(p => ({ ...p, [id]: !p[id] }));
    await fetchItems(id);
  };

  const setDecision = (itemId, field, value) => {
    setDecisions(p => ({ ...p, [itemId]: { ...p[itemId], [field]: value } }));
  };

  // Confirm receipt — accept/reject per item
  const handleConfirmReceipt = async (transfer) => {
    const tItems  = items[transfer.id] || [];
    const pending = tItems.filter(it => it.item_status === 'pending');
    if (!pending.length) return;

    // Validate: rejected items need a reason
    for (const item of pending) {
      const d = decisions[item.id];
      if (!d?.accept && !d?.reason?.trim()) {
        window.alert(`Please give a reason for rejecting "${item.medicines?.name || 'item'}"`);
        return;
      }
    }

    setSubmitting(transfer.id);
    try {
      let hasRejection = false;

      for (const item of pending) {
        const d      = decisions[item.id] || { accept: true, reason: '' };
        const accept = d.accept;

        if (!accept) {
          hasRejection = true;
          // Mark item as rejected (maps to 'defect' for DB compatibility)
          await supabase.from('stock_transfer_items').update({
            item_status:             'defect',
            quantity_units_received: 0,
            defect_note:             d.reason?.trim() || 'Rejected by store manager',
          }).eq('id', item.id);

          // Return units back to admin batch
          const { data: batch } = await supabase
            .from('medicine_batches')
            .select('units_remaining, total_units')
            .eq('id', item.batch_id)
            .single();
          if (batch) {
            const restored = (batch.units_remaining || 0) + item.quantity_units_sent;
            await supabase.from('medicine_batches').update({
              units_remaining: restored,
              is_active: true,
            }).eq('id', item.batch_id);
          }

          // Create rejection record so admin can see it
          // Check first to avoid duplicates (upsert without DB unique constraint creates dupes)
          const { count: existingCount } = await supabase
            .from('transfer_issue_resolutions')
            .select('*', { count: 'exact', head: true })
            .eq('transfer_item_id', item.id);

          if ((existingCount || 0) === 0) {
            await supabase.from('transfer_issue_resolutions').insert({
              transfer_id:      transfer.id,
              transfer_item_id: item.id,
              raised_by_store:  storeId,
              issue_type:       'defect',
              item_name:        item.medicines?.name,
              batch_number:     item.batch_number,
              units_affected:   item.quantity_units_sent,
              manager_note:     d.reason?.trim(),
              status:           'open',
            });
          } else {
            // Update existing record with latest reason
            await supabase.from('transfer_issue_resolutions')
              .update({ manager_note: d.reason?.trim(), status: 'open' })
              .eq('transfer_item_id', item.id);
          }

        } else {
          // Accepted — add to store inventory
          const qtyR = item.quantity_units_sent;
          await supabase.from('stock_transfer_items').update({
            item_status:             'ok',
            quantity_units_received: qtyR,
          }).eq('id', item.id);

          await supabase.from('store_inventory').insert({
            store_id:            storeId,
            medicine_id:         item.medicine_id,
            batch_number:        item.batch_number,
            date_of_manufacture: item.date_of_manufacture,
            expiry_date:         item.expiry_date,
            mrp_per_pack:        item.mrp_per_pack,
            cost_price_per_pack: item.cost_price_per_pack,
            units_received:      qtyR,
            units_remaining:     qtyR,
            transfer_item_id:    item.id,
            // carry discount from the original medicine_batch
            discount_percent:    parseFloat(item.medicine_batches?.discount_percent || 0),
          });
        }
      }

      // Update transfer status
      const newStatus = hasRejection ? 'issue_reported' : 'received';
      await supabase.from('stock_transfers').update({
        status:      newStatus,
        received_at: new Date().toISOString(),
      }).eq('id', transfer.id);

      // Force refetch
      await fetchTransfers();
      setItems(p => ({ ...p, [transfer.id]: undefined }));
      await fetchItems(transfer.id);
    } catch (err) {
      window.alert('Error: ' + err.message);
    } finally {
      setSubmitting(null);
    }
  };

  const filtered = transfers.filter(t =>
    filterStatus === 'all' ? true : t.status === filterStatus
  );
  const pendingCount = transfers.filter(t => t.status === 'dispatched').length;

  return (
    <div style={{ padding:'24px 28px', maxWidth:900, margin:'0 auto',
      fontFamily:"'Inter',-apple-system,sans-serif" }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
        marginBottom:22, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:700, color:'var(--label)',
            letterSpacing:'-0.3px', marginBottom:4 }}>
            📦 Stock Transfers
            {pendingCount > 0 && (
              <span style={{ marginLeft:10, fontSize:13, fontWeight:700,
                background:'#FF3B30', color:'#fff', padding:'3px 10px', borderRadius:20 }}>
                {pendingCount} incoming
              </span>
            )}
          </div>
          <div style={{ fontSize:13, color:'var(--label-4)' }}>
            Accept or reject each item. Accepted items are added to your inventory.
          </div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'flex-start', flexWrap:'wrap' }}>
          <RefreshButton onRefresh={fetchTransfers} />
        </div>

        {/* Admin contact card */}
        {adminContact && (
          <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:12,
            padding:'10px 16px', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10,
              background:'linear-gradient(135deg,#007AFF,#0055D4)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:16, color:'#fff', flexShrink:0 }}>
              👤
            </div>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'#1D4ED8', marginBottom:1 }}>
                Admin Contact
              </div>
              <div style={{ fontSize:12, color:'#1D4ED8', fontWeight:600 }}>
                {adminContact.full_name}
              </div>
              {adminContact.phone && (
                <a href={`tel:${adminContact.phone}`}
                  style={{ fontSize:12, color:'#0055D4', fontWeight:700,
                    textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
                  📞 {adminContact.phone}
                </a>
              )}
              {adminContact.email && (
                <div style={{ fontSize:11, color:'#3B82F6' }}>{adminContact.email}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:4, background:'var(--bg-2)',
        border:'1px solid var(--bg-4)', borderRadius:12, padding:4,
        marginBottom:20, width:'fit-content', boxShadow:'var(--shadow-sm)',
        flexWrap:'wrap' }}>
        {[
          { id:'dispatched',    label:`In Transit (${transfers.filter(t=>t.status==='dispatched').length})`         },
          { id:'received',      label:`Received (${transfers.filter(t=>t.status==='received').length})`             },
          { id:'issue_reported',label:`Rejections (${transfers.filter(t=>t.status==='issue_reported').length})`     },
          { id:'all',           label:`All (${transfers.length})`                                                    },
        ].map(f => (
          <button key={f.id} onClick={() => setFilterStatus(f.id)}
            style={{ padding:'7px 16px', borderRadius:9, border:'none', cursor:'pointer',
              fontFamily:'inherit', fontSize:12, fontWeight:600, transition:'all 0.18s',
              background: filterStatus===f.id ? 'var(--bg-2)' : 'transparent',
              color: filterStatus===f.id ? 'var(--accent)' : 'var(--label-4)',
              boxShadow: filterStatus===f.id ? 'var(--shadow-sm)' : 'none' }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Transfer list */}
      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--label-4)', fontSize:14 }}>
          Loading transfers…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px', background:'var(--bg-2)',
          borderRadius:'var(--radius-lg)', border:'1px solid var(--bg-4)' }}>
          <div style={{ fontSize:40, opacity:0.2, marginBottom:12 }}>📦</div>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--label-3)', marginBottom:6 }}>
            {filterStatus==='dispatched' ? 'No incoming transfers' : `No ${filterStatus.replace('_',' ')} transfers`}
          </div>
          <div style={{ fontSize:13, color:'var(--label-4)' }}>
            The admin will send stock when available
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {filtered.map((transfer, ti) => {
            const sc      = STATUS_CONFIG[transfer.status] || STATUS_CONFIG.dispatched;
            const tItems  = items[transfer.id] || [];
            const isEx    = expanded[transfer.id];
            const pending = tItems.filter(it => it.item_status === 'pending');
            const canAct  = transfer.status === 'dispatched';

            return (
              <motion.div key={transfer.id}
                initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                transition={{ delay:ti * 0.05 }}
                style={{ background:'var(--bg-2)',
                  border:`1px solid ${transfer.status==='dispatched' ? '#BFDBFE' : sc.border}`,
                  borderRadius:'var(--radius-lg)', overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>

                {/* Transfer header */}
                <div style={{ padding:'16px 20px', display:'flex', alignItems:'center',
                  gap:14, cursor:'pointer' }} onClick={() => toggleExpand(transfer.id)}>
                  <div style={{ width:44, height:44, borderRadius:12, background:sc.bg,
                    border:`1px solid ${sc.border}`, display:'flex', alignItems:'center',
                    justifyContent:'center', fontSize:22, flexShrink:0 }}>
                    🚚
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8,
                      marginBottom:3, flexWrap:'wrap' }}>
                      <span style={{ fontSize:15, fontWeight:700, color:'var(--label)' }}>
                        Transfer #{transfer.id.slice(-8).toUpperCase()}
                      </span>
                      <span style={{ fontSize:11, fontWeight:700, padding:'2px 10px',
                        borderRadius:20, background:sc.bg, color:sc.color,
                        border:`1px solid ${sc.border}` }}>
                        {sc.label}
                      </span>
                    </div>
                    <div style={{ fontSize:12, color:'var(--label-4)' }}>
                      Dispatched: {new Date(transfer.dispatched_at).toLocaleString('en-IN')}
                      {transfer.received_at && ` · Received: ${new Date(transfer.received_at).toLocaleString('en-IN')}`}
                    </div>
                    {transfer.admin_notes && (
                      <div style={{ fontSize:12, color:'var(--label-3)', marginTop:2, fontStyle:'italic' }}>
                        📝 {transfer.admin_notes}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize:16, color:'var(--label-4)', flexShrink:0 }}>
                    {isEx ? '▲' : '▼'}
                  </span>
                </div>

                {/* Expanded items */}
                <AnimatePresence>
                  {isEx && (
                    <motion.div
                      initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }}
                      exit={{ height:0, opacity:0 }} style={{ overflow:'hidden' }}>
                      <div style={{ padding:'0 20px 20px', borderTop:'1px solid var(--bg-4)' }}>

                        {tItems.length === 0 ? (
                          <div style={{ textAlign:'center', padding:30, color:'var(--label-4)', fontSize:13 }}>
                            Loading items…
                          </div>
                        ) : (
                          <>
                            {/* Instruction banner for dispatched transfers */}
                            {canAct && (
                              <div style={{ margin:'14px 0 14px', padding:'10px 14px',
                                background:'#EFF6FF', border:'1px solid #BFDBFE',
                                borderRadius:10, fontSize:12, color:'#1D4ED8',
                                display:'flex', gap:8, alignItems:'flex-start' }}>
                                <span style={{ fontSize:15, flexShrink:0 }}>💡</span>
                                <span>
                                  Review each item. <strong>Accept</strong> to add to your stock,
                                  or <strong>Reject</strong> with a reason.
                                  Rejected items are returned to admin stock — contact admin if needed.
                                </span>
                              </div>
                            )}

                            <div style={{ fontSize:11, fontWeight:700, color:'var(--label-4)',
                              textTransform:'uppercase', letterSpacing:'0.8px',
                              margin:'14px 0 12px' }}>
                              Items ({tItems.length})
                            </div>

                            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                              {tItems.map(item => {
                                const med    = item.medicines;
                                const d      = decisions[item.id] || { accept: true, reason: '' };
                                const isPend = item.item_status === 'pending';
                                const isOk   = item.item_status === 'ok';
                                const isRej  = ['defect','missing','short'].includes(item.item_status);

                                return (
                                  <div key={item.id} style={{
                                    background: isPend ? 'var(--bg-3)'
                                      : isOk  ? '#F0FDF4'
                                      : '#FFF5F5',
                                    border:`1px solid ${
                                      isPend ? 'var(--bg-4)'
                                      : isOk  ? '#BBF7D0'
                                      : '#FECACA'}`,
                                    borderRadius:'var(--radius-md)', padding:'14px 16px',
                                  }}>
                                    {/* Item info row */}
                                    <div style={{ display:'flex', alignItems:'flex-start',
                                      gap:12, marginBottom: isPend && canAct ? 12 : 0 }}>
                                      <span style={{ fontSize:18, flexShrink:0 }}>
                                        {TYPE_ICONS[med?.type] || '📦'}
                                      </span>
                                      <div style={{ flex:1, minWidth:0 }}>
                                        <div style={{ fontSize:14, fontWeight:700,
                                          color:'var(--label)', marginBottom:3 }}>
                                          {med?.name}
                                          {med?.strength ? ` · ${med.strength}` : ''}
                                        </div>
                                        <div style={{ display:'flex', gap:8,
                                          flexWrap:'wrap', alignItems:'center' }}>
                                          <span style={{ fontSize:11, fontFamily:'monospace',
                                            color:'var(--label-3)', fontWeight:600 }}>
                                            {item.batch_number}
                                          </span>
                                          <ExpiryChip date={item.expiry_date} />
                                        </div>
                                      </div>
                                      <div style={{ textAlign:'right', flexShrink:0 }}>
                                        <div style={{ fontSize:16, fontWeight:800, color:'var(--accent)' }}>
                                          {item.quantity_units_sent} units
                                        </div>
                                        <div style={{ fontSize:11, color:'var(--label-4)' }}>
                                          {Math.floor(item.quantity_units_sent / (med?.pack_size||1))} packs
                                        </div>
                                        {/* Result badge */}
                                        {isOk && (
                                          <span style={{ fontSize:11, fontWeight:700,
                                            background:'#DCFCE7', color:'#15803D',
                                            padding:'2px 8px', borderRadius:20, marginTop:4,
                                            display:'inline-block' }}>
                                            ✓ Accepted
                                          </span>
                                        )}
                                        {isRej && (
                                          <span style={{ fontSize:11, fontWeight:700,
                                            background:'#FEE2E2', color:'#B91C1C',
                                            padding:'2px 8px', borderRadius:20, marginTop:4,
                                            display:'inline-block' }}>
                                            ✕ Rejected
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Already-inspected rejection reason */}
                                    {isRej && item.defect_note && (
                                      <div style={{ marginTop:8, padding:'7px 12px',
                                        background:'#FEF3C7', border:'1px solid #FDE68A',
                                        borderRadius:8, fontSize:12, color:'#92400E' }}>
                                        Reason: {item.defect_note}
                                      </div>
                                    )}

                                    {/* Accept / Reject controls — only for pending + dispatched */}
                                    {isPend && canAct && (
                                      <div style={{ background:'var(--bg-2)',
                                        border:'1px solid var(--bg-4)', borderRadius:10,
                                        padding:'12px 14px' }}>
                                        {/* Toggle buttons */}
                                        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                                          <button
                                            onClick={() => setDecision(item.id, 'accept', true)}
                                            style={{ flex:1, padding:'8px',
                                              borderRadius:9, border:'none', cursor:'pointer',
                                              fontFamily:'inherit', fontSize:13, fontWeight:700,
                                              transition:'all 0.15s',
                                              background: d.accept
                                                ? 'linear-gradient(135deg,#34C759,#28A745)'
                                                : 'var(--bg-3)',
                                              color: d.accept ? '#fff' : 'var(--label-4)',
                                              boxShadow: d.accept
                                                ? '0 3px 10px rgba(52,199,89,0.3)' : 'none' }}>
                                            ✓ Accept
                                          </button>
                                          <button
                                            onClick={() => setDecision(item.id, 'accept', false)}
                                            style={{ flex:1, padding:'8px',
                                              borderRadius:9, border:'none', cursor:'pointer',
                                              fontFamily:'inherit', fontSize:13, fontWeight:700,
                                              transition:'all 0.15s',
                                              background: !d.accept
                                                ? 'linear-gradient(135deg,#FF3B30,#D93025)'
                                                : 'var(--bg-3)',
                                              color: !d.accept ? '#fff' : 'var(--label-4)',
                                              boxShadow: !d.accept
                                                ? '0 3px 10px rgba(255,59,48,0.3)' : 'none' }}>
                                            ✕ Reject
                                          </button>
                                        </div>

                                        {/* Rejection reason — required when rejected */}
                                        {!d.accept && (
                                          <motion.div
                                            initial={{ opacity:0, height:0 }}
                                            animate={{ opacity:1, height:'auto' }}
                                            style={{ overflow:'hidden' }}>
                                            <input
                                              autoFocus
                                              placeholder="Reason for rejection (required)…"
                                              value={d.reason}
                                              onChange={e => setDecision(item.id, 'reason', e.target.value)}
                                              style={{ width:'100%', padding:'8px 12px',
                                                border:`1.5px solid ${d.reason.trim() ? '#FECACA' : '#F87171'}`,
                                                borderRadius:8, fontSize:12, fontFamily:'inherit',
                                                color:'var(--label)', background:'#FFF5F5',
                                                outline:'none', boxSizing:'border-box',
                                                marginTop:4 }}
                                              onFocus={e => e.target.style.borderColor='#F87171'}
                                              onBlur={e => e.target.style.borderColor='#FECACA'}
                                            />
                                          </motion.div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Confirm button */}
                            {canAct && pending.length > 0 && (
                              <div style={{ marginTop:16, display:'flex',
                                justifyContent:'space-between', alignItems:'center',
                                gap:12, flexWrap:'wrap' }}>
                                {/* Admin contact inline */}
                                {adminContact?.phone && (
                                  <a href={`tel:${adminContact.phone}`}
                                    style={{ fontSize:12, color:'#1D4ED8', fontWeight:600,
                                      textDecoration:'none', display:'flex',
                                      alignItems:'center', gap:5,
                                      background:'#EFF6FF', padding:'7px 14px',
                                      borderRadius:8, border:'1px solid #BFDBFE' }}>
                                    📞 Call Admin: {adminContact.phone}
                                  </a>
                                )}
                                <button
                                  onClick={() => handleConfirmReceipt(transfer)}
                                  disabled={submitting === transfer.id}
                                  style={{ background:'linear-gradient(145deg,#34C759,#28A745)',
                                    color:'#fff', border:'none', borderRadius:12,
                                    padding:'11px 28px', fontSize:14, fontWeight:700,
                                    cursor:'pointer', fontFamily:'inherit',
                                    boxShadow:'0 3px 12px rgba(52,199,89,0.3)',
                                    marginLeft:'auto' }}>
                                  {submitting === transfer.id
                                    ? '⏳ Processing…'
                                    : `✓ Confirm Receipt (${pending.filter(it => (decisions[it.id]?.accept ?? true)).length} accepted, ${pending.filter(it => !(decisions[it.id]?.accept ?? true)).length} rejected)`}
                                </button>
                              </div>
                            )}
                          </>
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
