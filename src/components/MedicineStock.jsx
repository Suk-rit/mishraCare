import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';

function daysUntilExpiry(dateStr) {
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

function ExpiryBadge({ date }) {
  const d = daysUntilExpiry(date);
  if (d < 0)   return <span style={{ fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20,background:'#FEE2E2',color:'#B91C1C',border:'1px solid #FECACA' }}>EXPIRED</span>;
  if (d < 30)  return <span style={{ fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20,background:'#FEE2E2',color:'#B91C1C',border:'1px solid #FECACA' }}>⚠️ {d}d left</span>;
  if (d < 90)  return <span style={{ fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20,background:'#FEF3C7',color:'#92400E',border:'1px solid #FDE68A' }}>⏳ {d}d left</span>;
  if (d < 180) return <span style={{ fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20,background:'#E0F2FE',color:'#0369A1',border:'1px solid #BAE6FD' }}>ℹ️ {d}d left</span>;
  return <span style={{ fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,background:'#DCFCE7',color:'#15803D',border:'1px solid #BBF7D0' }}>✓ Good</span>;
}

function InfoCell({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize:10,fontWeight:700,color:'var(--label-4)',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:13,color:value?'var(--label-2)':'var(--label-4)',fontWeight:500,fontFamily:mono?'monospace':'inherit' }}>{value||'—'}</div>
    </div>
  );
}

const TYPE_ICONS = { Tablet:'💊',Capsule:'💊',Syrup:'🧴',Injection:'💉',Drops:'💧',Cream:'🧴',Ointment:'🧴',Powder:'🧂',Inhaler:'🌬️',Patch:'🩹',Suppository:'💊',Lozenges:'🍬',Other:'📦' };

// onAddBatch — called when user clicks "+ Add Batch", parent renders the modal
// onFetchRef — parent can store a reference to fetchBatches to call after adding
export default function MedicineStock({ medicine, onClose, onAddBatch, onFetchRef }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('active');

  const fetchBatches = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('medicine_batches')
      .select('*')
      .eq('medicine_id', medicine.id)
      .order('expiry_date', { ascending: true });
    setBatches(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchBatches();
    if (onFetchRef) onFetchRef(fetchBatches);
  }, [medicine.id]);

  const activeBatches   = batches.filter(b => b.is_active && daysUntilExpiry(b.expiry_date) > 0);
  const expiredBatches  = batches.filter(b => daysUntilExpiry(b.expiry_date) <= 0);
  const expiringBatches = batches.filter(b => { const d = daysUntilExpiry(b.expiry_date); return d > 0 && d <= 90; });
  const totalUnits      = activeBatches.reduce((s, b) => s + (b.units_remaining || 0), 0);
  const totalPacks      = Math.floor(totalUnits / (medicine.pack_size || 1));
  const looseUnits      = totalUnits % (medicine.pack_size || 1);

  const displayBatches =
    filter === 'active'   ? activeBatches   :
    filter === 'expiring' ? expiringBatches :
    filter === 'expired'  ? expiredBatches  : batches;

  return (
    <div style={{ position:'fixed',inset:0,zIndex:200,display:'flex',justifyContent:'flex-end' }}>
      {/* Backdrop */}
      <div style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.3)',backdropFilter:'blur(4px)' }} onClick={onClose} />

      {/* Drawer */}
      <motion.div
        initial={{ x:'100%' }} animate={{ x:0 }} exit={{ x:'100%' }}
        transition={{ type:'spring',damping:28,stiffness:260 }}
        style={{ position:'relative',width:'100%',maxWidth:680,background:'var(--bg)',borderLeft:'1px solid var(--bg-4)',display:'flex',flexDirection:'column',height:'100vh',overflowY:'auto',zIndex:1 }}
      >
        {/* Sticky header */}
        <div style={{ padding:'20px 24px 16px',borderBottom:'1px solid var(--bg-4)',background:'rgba(255,255,255,0.95)',backdropFilter:'blur(12px)',position:'sticky',top:0,zIndex:10 }}>
          <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:4 }}>
                <span style={{ fontSize:20 }}>{TYPE_ICONS[medicine.type]||'📦'}</span>
                <span style={{ fontSize:17,fontWeight:700,color:'var(--label)',letterSpacing:'-0.2px' }}>{medicine.name}</span>
                {medicine.strength && <span style={{ fontSize:12,color:'var(--label-4)',fontWeight:500 }}>· {medicine.strength}</span>}
              </div>
              <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
                <span style={{ fontSize:11,background:'var(--bg-4)',color:'var(--label-3)',padding:'2px 9px',borderRadius:20,fontWeight:600 }}>{medicine.manufacturer}</span>
                <span style={{ fontSize:11,background:'#EFF6FF',color:'#1D4ED8',padding:'2px 9px',borderRadius:20,fontWeight:600 }}>{medicine.pack_size} {medicine.pack_unit}/pack</span>
                <span style={{ fontSize:11,background:'var(--bg-3)',color:'var(--label-3)',padding:'2px 9px',borderRadius:20,fontWeight:600 }}>{medicine.category}</span>
              </div>
            </div>
            <div style={{ display:'flex',gap:8,flexShrink:0 }}>
              <button onClick={onAddBatch}
                style={{ background:'linear-gradient(145deg,#FF3B30,#D93025)',color:'#fff',border:'none',borderRadius:10,padding:'8px 18px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',boxShadow:'0 2px 8px rgba(255,59,48,0.28)' }}>
                + Add Batch
              </button>
              <button onClick={onClose}
                style={{ width:34,height:34,background:'var(--bg-3)',border:'1px solid var(--bg-4)',borderRadius:'50%',cursor:'pointer',fontSize:15,color:'var(--label-3)',display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
            </div>
          </div>
        </div>

        <div style={{ padding:'20px 24px',flex:1 }}>
          {/* Summary cards */}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:10,marginBottom:20 }}>
            {[
              { label:'Total Units',    value:totalUnits,             unit:medicine.pack_unit+'s', color:'#007AFF',bg:'#EFF6FF' },
              { label:'Full Packs',     value:totalPacks,             unit:'packs',                color:'#34C759',bg:'#F0FDF4' },
              { label:'Loose Units',    value:looseUnits,             unit:medicine.pack_unit+'s', color:'#FF9500',bg:'#FFFBEB' },
              { label:'Active Batches', value:activeBatches.length,   unit:'batches',              color:'#5856D6',bg:'#F0EFFE' },
              { label:'Expiring ≤90d',  value:expiringBatches.length, unit:'batches',              color:'#FF9500',bg:'#FFFBEB' },
              { label:'Expired',        value:expiredBatches.length,  unit:'batches',              color:'#B91C1C',bg:'#FEE2E2' },
            ].map((s,i) => (
              <motion.div key={i} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*0.04 }}
                style={{ background:s.bg,border:`1px solid ${s.color}22`,borderRadius:12,padding:'12px 14px' }}>
                <div style={{ fontSize:10,fontWeight:700,color:s.color,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4 }}>{s.label}</div>
                <div style={{ fontSize:22,fontWeight:800,color:s.color,lineHeight:1,marginBottom:2 }}>{s.value}</div>
                <div style={{ fontSize:10,color:s.color,opacity:0.7 }}>{s.unit}</div>
              </motion.div>
            ))}
          </div>

          {/* Expiry alerts */}
          {expiringBatches.length > 0 && (
            <div style={{ background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:12,padding:'12px 16px',marginBottom:16 }}>
              <div style={{ fontSize:13,fontWeight:700,color:'#92400E',marginBottom:6 }}>⚠️ Expiry Alerts</div>
              {expiringBatches.map(b => (
                <div key={b.id} style={{ display:'flex',justifyContent:'space-between',fontSize:12,color:'#92400E',padding:'3px 0',borderTop:'1px solid #FDE68A' }}>
                  <span>Batch <strong>{b.batch_number}</strong></span>
                  <span>{new Date(b.expiry_date).toLocaleDateString('en-IN')} · {daysUntilExpiry(b.expiry_date)}d · {b.units_remaining} units</span>
                </div>
              ))}
            </div>
          )}

          {/* Filter tabs */}
          <div style={{ display:'flex',gap:4,background:'var(--bg-2)',border:'1px solid var(--bg-4)',borderRadius:10,padding:3,marginBottom:16,width:'fit-content',boxShadow:'var(--shadow-sm)' }}>
            {[
              { id:'active',   label:`Active (${activeBatches.length})`    },
              { id:'expiring', label:`Expiring (${expiringBatches.length})` },
              { id:'expired',  label:`Expired (${expiredBatches.length})`   },
              { id:'all',      label:`All (${batches.length})`             },
            ].map(t => (
              <button key={t.id} onClick={() => setFilter(t.id)}
                style={{ padding:'6px 14px',borderRadius:8,border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:600,transition:'all 0.18s',background:filter===t.id?'var(--bg-2)':'transparent',color:filter===t.id?'var(--accent)':'var(--label-4)',boxShadow:filter===t.id?'var(--shadow-sm)':'none' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Batch list */}
          {loading ? (
            <div style={{ textAlign:'center',padding:40,color:'var(--label-4)',fontSize:14 }}>Loading batches…</div>
          ) : displayBatches.length === 0 ? (
            <div style={{ textAlign:'center',padding:'50px 20px',background:'var(--bg-2)',borderRadius:'var(--radius-lg)',border:'1px solid var(--bg-4)' }}>
              <div style={{ fontSize:36,opacity:0.2,marginBottom:12 }}>📦</div>
              <div style={{ fontSize:15,fontWeight:600,color:'var(--label-3)',marginBottom:6 }}>
                {filter==='active' ? 'No stock yet' : `No ${filter} batches`}
              </div>
              {filter==='active' && (
                <button onClick={onAddBatch}
                  style={{ background:'linear-gradient(145deg,#FF3B30,#D93025)',color:'#fff',border:'none',borderRadius:10,padding:'9px 22px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',marginTop:10 }}>
                  + Add First Batch
                </button>
              )}
            </div>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
              {displayBatches.map((batch, i) => {
                const pct   = batch.total_units > 0 ? Math.round((batch.units_remaining / batch.total_units) * 100) : 0;
                const barC  = pct > 50 ? '#34C759' : pct > 20 ? '#FF9500' : '#FF3B30';
                return (
                  <motion.div key={batch.id} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*0.04 }}
                    style={{ background:'var(--bg-2)',border:'1px solid var(--bg-4)',borderRadius:'var(--radius-md)',overflow:'hidden',boxShadow:'var(--shadow-sm)' }}>
                    <div style={{ padding:'14px 16px',display:'flex',alignItems:'center',gap:12,borderBottom:'1px solid var(--bg-4)' }}>
                      <div style={{ width:40,height:40,borderRadius:10,background:'#EFF6FF',border:'1px solid #BFDBFE',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0 }}>📦</div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                          <span style={{ fontSize:14,fontWeight:700,color:'var(--label)',fontFamily:'monospace' }}>{batch.batch_number}</span>
                          <ExpiryBadge date={batch.expiry_date} />
                        </div>
                        {batch.supplier_name && <div style={{ fontSize:12,color:'var(--label-4)',marginTop:1 }}>Supplier: {batch.supplier_name}</div>}
                      </div>
                      <div style={{ textAlign:'right',flexShrink:0 }}>
                        <div style={{ fontSize:16,fontWeight:800,color:barC }}>{batch.units_remaining}</div>
                        <div style={{ fontSize:10,color:'var(--label-4)' }}>of {batch.total_units} units</div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{ height:4,background:'var(--bg-4)' }}>
                      <div style={{ height:'100%',width:`${pct}%`,background:barC,transition:'width 0.5s ease' }} />
                    </div>
                    <div style={{ padding:'12px 16px',display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:12 }}>
                      <InfoCell label="DOM"           value={batch.date_of_manufacture ? new Date(batch.date_of_manufacture).toLocaleDateString('en-IN') : null} />
                      <InfoCell label="Expiry"        value={new Date(batch.expiry_date).toLocaleDateString('en-IN')} />
                      <InfoCell label="Purchase Date" value={batch.purchase_date ? new Date(batch.purchase_date).toLocaleDateString('en-IN') : null} />
                      <InfoCell label="Packs Rcvd"    value={batch.quantity_packs ? `${batch.quantity_packs} packs` : null} />
                      <InfoCell label="Loose Rcvd"    value={`${batch.quantity_loose || 0} units`} />
                      <InfoCell label="Cost/Pack"     value={batch.cost_price_per_pack ? `₹${Number(batch.cost_price_per_pack).toFixed(2)}` : null} />
                      <InfoCell label="MRP/Pack"      value={batch.mrp_per_pack ? `₹${Number(batch.mrp_per_pack).toFixed(2)}` : `₹${Number(medicine.mrp_per_pack||0).toFixed(2)} (cat.)`} />
                      <InfoCell label="Invoice"       value={batch.supplier_invoice} mono />
                    </div>
                    {batch.notes && <div style={{ padding:'0 16px 12px',fontSize:12,color:'var(--label-3)',fontStyle:'italic' }}>📝 {batch.notes}</div>}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
