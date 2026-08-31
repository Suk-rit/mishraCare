import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';

// Defined outside — prevents focus loss
function Field({ name, label, required, placeholder, type='text', form, errors, onChange }) {
  return (
    <div className="field">
      <label>{label}{required && <span className="req"> *</span>}</label>
      <input type={type} placeholder={placeholder} value={form[name]}
        onChange={e => onChange(name, e.target.value)} className={errors[name] ? 'err' : ''} />
      {errors[name] && <span style={{ fontSize:11, color:'var(--error-text)' }}>{errors[name]}</span>}
    </div>
  );
}

function daysLeft(d) { return Math.ceil((new Date(d) - new Date()) / 86400000); }
function expiryStyle(d) {
  const days = daysLeft(d);
  if (days < 0)   return { bg:'#FEE2E2', color:'#B91C1C' };
  if (days < 90)  return { bg:'#FEF3C7', color:'#92400E' };
  if (days < 180) return { bg:'#E0F2FE', color:'#0369A1' };
  return { bg:'#DCFCE7', color:'#15803D' };
}

const TYPE_ICONS = { Tablet:'💊',Capsule:'💊',Syrup:'🧴',Injection:'💉',Drops:'💧',Cream:'🧴',Ointment:'🧴',Powder:'🧂',Inhaler:'🌬️',Patch:'🩹',Suppository:'💊',Lozenges:'🍬',Other:'📦' };

export default function CreateTransferModal({ onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1=select store, 2=add items, 3=review+dispatch

  // Step 1
  const [stores,       setStores]      = useState([]);
  const [selectedStore,setSelectedStore]=useState(null);
  const [adminNotes,   setAdminNotes]  = useState('');

  // Step 2
  const [batches,      setBatches]     = useState([]); // all admin batches with medicine info
  const [items,        setItems]       = useState([]); // [{ batch, medicine, units, key }]
  const [medSearch,    setMedSearch]   = useState('');
  const [pickingBatch, setPickingBatch]= useState(false);

  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);

  // Fetch stores
  useEffect(() => {
    supabase.from('stores').select('id, store_name, city, state').eq('is_active', true)
      .then(({ data }) => setStores(data || []));
  }, []);

  // Fetch active batches with medicine info (when entering step 2)
  const fetchBatches = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('medicine_batches')
      .select('*, medicines(id, name, strength, type, manufacturer, pack_size, pack_unit, mrp_per_pack)')
      .eq('status', 'approved')        // only approved batches
      .gt('expiry_date', today)         // not expired
      .gt('units_remaining', 0)         // has stock — is_active is unreliable, skip it
      .order('expiry_date', { ascending: true });
    setBatches(data || []);
  };

  useEffect(() => { if (step === 2) fetchBatches(); }, [step]);

  // Group batches by medicine for display
  const batchesByMed = useMemo(() => {
    const q = medSearch.trim().toLowerCase();
    const filtered = q
      ? batches.filter(b => b.medicines?.name?.toLowerCase().includes(q) || b.medicines?.manufacturer?.toLowerCase().includes(q))
      : batches;
    const map = {};
    filtered.forEach(b => {
      const mid = b.medicine_id;
      if (!map[mid]) map[mid] = { medicine: b.medicines, batches: [] };
      map[mid].batches.push(b);
    });
    return Object.values(map);
  }, [batches, medSearch]);

  // Add a batch line item
  const addItem = (batch) => {
    const exists = items.find(i => i.batchId === batch.id);
    if (exists) return; // already added
    setItems(prev => [...prev, {
      key:        batch.id,
      batchId:    batch.id,
      medicineId: batch.medicine_id,
      medicine:   batch.medicines,
      batch:      batch,
      units:      batch.medicines?.pack_size || 1, // default 1 pack
    }]);
  };

  const removeItem  = (key) => setItems(p => p.filter(i => i.key !== key));
  const updateUnits = (key, val) => {
    const n = parseInt(val, 10);
    setItems(p => p.map(i => i.key === key ? { ...i, units: isNaN(n) ? '' : n } : i));
  };

  // Get how many units already allocated to this batch across items
  const allocatedUnits = (batchId) => items.filter(i => i.batchId === batchId).reduce((s,i) => s + (parseInt(i.units)||0), 0);

  const totalItems = items.length;
  const totalUnits = items.reduce((s,i) => s + (parseInt(i.units)||0), 0);

  const validateStep2 = () => {
    if (items.length === 0) { setErrors({ items: 'Add at least one item' }); return false; }
    for (const item of items) {
      const n = parseInt(item.units);
      if (!n || n <= 0) { setErrors({ items: `Enter valid quantity for ${item.medicine?.name}` }); return false; }
      if (n > item.batch.units_remaining) { setErrors({ items: `${item.medicine?.name} (Batch ${item.batch.batch_number}): only ${item.batch.units_remaining} units available` }); return false; }
    }
    setErrors({});
    return true;
  };

  const handleDispatch = async () => {
    if (!validateStep2()) return;
    setLoading(true);
    try {
      // 1. Create transfer header
      const { data: transfer, error: te } = await supabase
        .from('stock_transfers')
        .insert({ store_id: selectedStore.id, status: 'dispatched', admin_notes: adminNotes || null, dispatched_at: new Date().toISOString() })
        .select().single();
      if (te) throw new Error(te.message);

      // 2. Create line items — NO deduction yet. Deduction happens when store manager accepts.
      for (const item of items) {
        const units = parseInt(item.units);
        const { error: itErr } = await supabase.from('stock_transfer_items').insert({
          transfer_id:         transfer.id,
          medicine_id:         item.medicineId,
          batch_id:            item.batchId,
          quantity_units_sent: units,
          item_status:         'pending',
          batch_number:        item.batch.batch_number,
          expiry_date:         item.batch.expiry_date,
          date_of_manufacture: item.batch.date_of_manufacture,
          mrp_per_pack:        item.batch.mrp_per_pack || item.medicine?.mrp_per_pack,
          cost_price_per_pack: item.batch.cost_price_per_pack,
          pack_size:           item.medicine?.pack_size || 1,
        });
        if (itErr) throw new Error(itErr.message);

        // Mark these units as "in transit" so they can't be double-allocated
        // We store reserved_units separately — use a soft lock via is_active flag logic:
        // Deduct from available by updating units_remaining (reversed on rejection)
        const newRemaining = item.batch.units_remaining - units;
        const { error: bErr } = await supabase
          .from('medicine_batches')
          .update({ units_remaining: newRemaining, is_active: newRemaining > 0 })
          .eq('id', item.batchId);
        if (bErr) throw new Error(bErr.message);
      }

      onSuccess(transfer);
    } catch (err) {
      window.alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const cardStyle = (selected) => ({
    background: selected ? 'var(--accent-bg)' : 'var(--bg-2)',
    border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--bg-4)'}`,
    borderRadius: 'var(--radius-md)', padding: '14px 16px', cursor: 'pointer',
    transition: 'all 0.18s', boxShadow: 'var(--shadow-sm)',
  });

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div className="modal modal-lg"
        initial={{ opacity:0, scale:0.95, y:20 }} animate={{ opacity:1, scale:1, y:0 }}
        exit={{ opacity:0, scale:0.95, y:20 }} transition={{ duration:0.22 }}
        style={{ maxWidth: 860 }}>

        <div className="modal-header">
          <div>
            <div className="modal-title">🚚 Transfer Stock to Store</div>
            <div className="modal-sub">
              {step===1 ? 'Step 1: Select destination store' : step===2 ? `Step 2: Add medicines — sending to ${selectedStore?.store_name}` : 'Step 3: Review & Dispatch'}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Step indicator */}
        <div style={{ padding:'0 26px 0', borderBottom:'1px solid var(--bg-4)' }}>
          <div className="modal-steps" style={{ margin:'12px 0' }}>
            {['Select Store','Add Medicines','Review & Dispatch'].map((s,i) => (
              <button key={i} className={`modal-step-btn${step===i+1?' active':''}${step>i+1?' done':''}`}
                onClick={() => step > i+1 && setStep(i+1)}>
                {step > i+1 ? '✓' : i+1} {s}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-body" style={{ maxHeight:'60vh' }}>
          <AnimatePresence mode="wait">

            {/* ── Step 1: Select Store ── */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }}>
                <div className="form-section">
                  <div className="form-section-title">Destination Store</div>
                  {stores.length === 0 ? (
                    <div style={{ color:'var(--label-4)',fontSize:14,padding:20,textAlign:'center' }}>No active stores found. Add stores first.</div>
                  ) : (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12 }}>
                      {stores.map(s => (
                        <div key={s.id} style={cardStyle(selectedStore?.id===s.id)} onClick={() => setSelectedStore(s)}>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <span style={{ fontSize:22 }}>🏪</span>
                            <div>
                              <div style={{ fontSize:14,fontWeight:700,color:'var(--label)' }}>{s.store_name}</div>
                              <div style={{ fontSize:12,color:'var(--label-4)' }}>{s.city}, {s.state}</div>
                            </div>
                            {selectedStore?.id===s.id && <span style={{ marginLeft:'auto',color:'var(--accent)',fontSize:18 }}>✓</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="form-section" style={{ marginBottom:0 }}>
                  <div className="form-section-title">Admin Notes (optional)</div>
                  <div className="field">
                    <textarea placeholder="Any notes for the store manager…" value={adminNotes}
                      onChange={e => setAdminNotes(e.target.value)} style={{ minHeight:70 }} />
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Add Medicines ── */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, height:'52vh' }}>

                  {/* Left: medicine/batch picker */}
                  <div style={{ display:'flex', flexDirection:'column', gap:10, overflow:'hidden' }}>
                    <div style={{ fontSize:12,fontWeight:700,color:'var(--label-4)',textTransform:'uppercase',letterSpacing:'0.8px' }}>Available Stock (click to add)</div>
                    <input value={medSearch} onChange={e => setMedSearch(e.target.value)}
                      placeholder="🔍 Search medicine…"
                      style={{ padding:'9px 13px',border:'1.5px solid var(--bg-4)',borderRadius:10,fontSize:13,fontFamily:'inherit',color:'var(--label)',background:'var(--bg-3)',outline:'none' }}
                      onFocus={e => e.target.style.borderColor='var(--accent)'}
                      onBlur={e  => e.target.style.borderColor='var(--bg-4)'} />
                    <div style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:8 }}>
                      {batchesByMed.length === 0 ? (
                        <div style={{ textAlign:'center',padding:30,color:'var(--label-4)',fontSize:13 }}>No stock available</div>
                      ) : batchesByMed.map(({ medicine, batches: mBatches }) => (
                        <div key={medicine?.id} style={{ background:'var(--bg-2)',border:'1px solid var(--bg-4)',borderRadius:'var(--radius-md)',overflow:'hidden' }}>
                          <div style={{ padding:'10px 12px',borderBottom:'1px solid var(--bg-4)',display:'flex',alignItems:'center',gap:8 }}>
                            <span style={{ fontSize:16 }}>{TYPE_ICONS[medicine?.type]||'📦'}</span>
                            <div style={{ flex:1,minWidth:0 }}>
                              <div style={{ fontSize:13,fontWeight:700,color:'var(--label)' }}>{medicine?.name}{medicine?.strength ? ` · ${medicine.strength}` : ''}</div>
                              <div style={{ fontSize:11,color:'var(--label-4)' }}>{medicine?.manufacturer}</div>
                            </div>
                          </div>
                          {mBatches.map(b => {
                            const alr  = allocatedUnits(b.id);
                            const avail = b.units_remaining - alr;
                            const es   = expiryStyle(b.expiry_date);
                            const added = items.some(i => i.batchId === b.id);
                            return (
                              <button key={b.id}
                                onClick={() => !added && avail > 0 && addItem(b)}
                                disabled={added || avail <= 0}
                                style={{ width:'100%',display:'flex',alignItems:'center',gap:10,padding:'8px 12px',border:'none',background: added ? '#F0FDF4' : 'transparent',cursor: added||avail<=0 ? 'default' : 'pointer',fontFamily:'inherit',transition:'background 0.15s',borderTop:'1px solid var(--bg-4)' }}
                                onMouseEnter={e => { if (!added && avail>0) e.currentTarget.style.background='var(--bg-3)'; }}
                                onMouseLeave={e => { if (!added) e.currentTarget.style.background='transparent'; }}>
                                <div style={{ flex:1,textAlign:'left' }}>
                                  <div style={{ display:'flex',gap:6,alignItems:'center',flexWrap:'wrap' }}>
                                    <span style={{ fontSize:11,fontWeight:700,color:'var(--label)',fontFamily:'monospace' }}>{b.batch_number}</span>
                                    <span style={{ fontSize:10,fontWeight:600,padding:'1px 7px',borderRadius:20,background:es.bg,color:es.color }}>Exp: {new Date(b.expiry_date).toLocaleDateString('en-IN')}</span>
                                  </div>
                                  <div style={{ fontSize:11,color:'var(--label-4)',marginTop:2 }}>Available: <strong>{avail}</strong> units · {Math.floor(avail/(medicine?.pack_size||1))} packs</div>
                                </div>
                                {added ? <span style={{ fontSize:11,fontWeight:700,color:'#15803D' }}>✓ Added</span>
                                  : avail <= 0 ? <span style={{ fontSize:11,color:'var(--label-4)' }}>All allocated</span>
                                  : <span style={{ fontSize:11,fontWeight:600,color:'var(--accent)' }}>+ Add</span>}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: items cart */}
                  <div style={{ display:'flex', flexDirection:'column', gap:10, overflow:'hidden' }}>
                    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                      <div style={{ fontSize:12,fontWeight:700,color:'var(--label-4)',textTransform:'uppercase',letterSpacing:'0.8px' }}>Transfer Cart ({totalItems} items · {totalUnits} units)</div>
                      {items.length > 0 && <button onClick={() => setItems([])} style={{ background:'none',border:'none',color:'var(--accent)',fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:600 }}>Clear all</button>}
                    </div>
                    {errors.items && <div style={{ background:'#FEE2E2',border:'1px solid #FECACA',borderRadius:8,padding:'8px 12px',fontSize:12,color:'#B91C1C',fontWeight:500 }}>⚠ {errors.items}</div>}
                    <div style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:8 }}>
                      {items.length === 0 ? (
                        <div style={{ textAlign:'center',padding:'40px 20px',background:'var(--bg-2)',border:'2px dashed var(--bg-4)',borderRadius:'var(--radius-md)',color:'var(--label-4)',fontSize:13 }}>
                          ← Select medicines from the left panel
                        </div>
                      ) : items.map(item => {
                        const es = expiryStyle(item.batch.expiry_date);
                        const ps = item.medicine?.pack_size || 1;
                        const units = parseInt(item.units)||0;
                        const packs = Math.floor(units/ps);
                        const loose = units % ps;
                        return (
                          <div key={item.key} style={{ background:'var(--bg-2)',border:'1px solid var(--bg-4)',borderRadius:'var(--radius-md)',padding:'12px 14px' }}>
                            <div style={{ display:'flex',alignItems:'flex-start',gap:10,marginBottom:8 }}>
                              <div style={{ flex:1,minWidth:0 }}>
                                <div style={{ fontSize:13,fontWeight:700,color:'var(--label)',marginBottom:2 }}>{item.medicine?.name}{item.medicine?.strength ? ` · ${item.medicine.strength}` : ''}</div>
                                <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
                                  <span style={{ fontSize:10,fontFamily:'monospace',fontWeight:600,color:'var(--label-3)' }}>{item.batch.batch_number}</span>
                                  <span style={{ fontSize:10,fontWeight:600,padding:'1px 7px',borderRadius:20,background:es.bg,color:es.color }}>Exp: {new Date(item.batch.expiry_date).toLocaleDateString('en-IN')}</span>
                                </div>
                              </div>
                              <button onClick={() => removeItem(item.key)} style={{ background:'none',border:'none',color:'var(--label-4)',cursor:'pointer',fontSize:16,padding:0,flexShrink:0 }}>✕</button>
                            </div>
                            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                              <div className="field" style={{ flex:1,gap:4 }}>
                                <label style={{ fontSize:11 }}>Units to send (max {item.batch.units_remaining})</label>
                                <input type="number" value={item.units} min={1} max={item.batch.units_remaining}
                                  onChange={e => updateUnits(item.key, e.target.value)}
                                  style={{ padding:'7px 10px',border:'1.5px solid var(--bg-4)',borderRadius:8,fontSize:13,fontFamily:'inherit',color:'var(--label)',background:'var(--bg-3)',outline:'none',width:'100%' }}
                                  onFocus={e => e.target.style.borderColor='var(--accent)'}
                                  onBlur={e  => e.target.style.borderColor='var(--bg-4)'} />
                              </div>
                              {units > 0 && <div style={{ fontSize:11,color:'var(--label-4)',flexShrink:0,textAlign:'right' }}>
                                {packs > 0 && <div>{packs} pack{packs>1?'s':''}</div>}
                                {loose > 0 && <div>{loose} loose</div>}
                              </div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Review ── */}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }}>
                <div style={{ background:'var(--bg-3)',border:'1px solid var(--bg-4)',borderRadius:'var(--radius-md)',padding:'16px 18px',marginBottom:18 }}>
                  <div style={{ fontSize:12,fontWeight:700,color:'var(--label-4)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:10 }}>Transfer Summary</div>
                  <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12 }}>
                    {[
                      { label:'Destination',   value: selectedStore?.store_name },
                      { label:'Location',       value: `${selectedStore?.city}, ${selectedStore?.state}` },
                      { label:'Total Items',    value: `${totalItems} medicines` },
                      { label:'Total Units',    value: `${totalUnits} units` },
                    ].map((r,i) => (
                      <div key={i}>
                        <div style={{ fontSize:11,fontWeight:700,color:'var(--label-4)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:3 }}>{r.label}</div>
                        <div style={{ fontSize:14,fontWeight:600,color:'var(--label)' }}>{r.value}</div>
                      </div>
                    ))}
                  </div>
                  {adminNotes && <div style={{ marginTop:12,fontSize:13,color:'var(--label-3)',fontStyle:'italic' }}>📝 {adminNotes}</div>}
                </div>
                <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                  {items.map(item => {
                    const es = expiryStyle(item.batch.expiry_date);
                    const ps = item.medicine?.pack_size || 1;
                    const units = parseInt(item.units)||0;
                    return (
                      <div key={item.key} style={{ background:'var(--bg-2)',border:'1px solid var(--bg-4)',borderRadius:'var(--radius-md)',padding:'12px 16px',display:'flex',alignItems:'center',gap:12 }}>
                        <span style={{ fontSize:18 }}>{TYPE_ICONS[item.medicine?.type]||'📦'}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:14,fontWeight:600,color:'var(--label)' }}>{item.medicine?.name}{item.medicine?.strength ? ` · ${item.medicine.strength}` : ''}</div>
                          <div style={{ display:'flex',gap:8,marginTop:3,flexWrap:'wrap' }}>
                            <span style={{ fontSize:11,fontFamily:'monospace',color:'var(--label-3)' }}>{item.batch.batch_number}</span>
                            <span style={{ fontSize:11,fontWeight:600,padding:'1px 7px',borderRadius:20,background:es.bg,color:es.color }}>Exp: {new Date(item.batch.expiry_date).toLocaleDateString('en-IN')}</span>
                          </div>
                        </div>
                        <div style={{ textAlign:'right',flexShrink:0 }}>
                          <div style={{ fontSize:16,fontWeight:800,color:'var(--accent)' }}>{units} units</div>
                          <div style={{ fontSize:11,color:'var(--label-4)' }}>{Math.floor(units/ps)} packs + {units%ps} loose</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="modal-footer">
          {step > 1 && <button className="btn-sm btn-sm-ghost" onClick={() => setStep(s=>s-1)}>← Back</button>}
          <button className="btn-sm btn-sm-ghost" onClick={onClose}>Cancel</button>
          {step === 1 && (
            <button className="btn-primary btn-sm" style={{ padding:'9px 22px' }}
              disabled={!selectedStore}
              onClick={() => setStep(2)}>
              Next →
            </button>
          )}
          {step === 2 && (
            <button className="btn-primary btn-sm" style={{ padding:'9px 22px' }}
              disabled={items.length === 0}
              onClick={() => { if (validateStep2()) setStep(3); }}>
              Review →
            </button>
          )}
          {step === 3 && (
            <button className="btn-primary btn-sm" style={{ padding:'9px 22px', background:'linear-gradient(145deg,#34C759,#28A745)', boxShadow:'0 2px 8px rgba(52,199,89,0.3)' }}
              onClick={handleDispatch} disabled={loading}>
              {loading ? '⏳ Dispatching…' : '🚚 Dispatch Transfer'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
