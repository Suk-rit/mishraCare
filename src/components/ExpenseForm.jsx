import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../utils/supabase';
import { uploadFile } from '../utils/storage';

const CATEGORIES = [
  { id:'inventory',    label:'📦 Inventory',    desc:'Stock purchase, damaged goods' },
  { id:'rent',         label:'🏢 Rent',           desc:'Shop/warehouse rent'          },
  { id:'utilities',    label:'⚡ Utilities',      desc:'Electricity, water, internet' },
  { id:'maintenance',  label:'🔧 Maintenance',    desc:'Repairs, equipment'           },
  { id:'transport',    label:'🚚 Transport',      desc:'Delivery, logistics'          },
  { id:'marketing',    label:'📣 Marketing',      desc:'Ads, promotions'              },
  { id:'other',        label:'📋 Other',          desc:'Miscellaneous expense'        },
];

const INITIAL = { category:'', description:'', amount:'', expense_date: new Date().toISOString().split('T')[0], notes:'' };

export default function ExpenseForm({ storeId, adminId, onClose, onSuccess }) {
  const [form,    setForm]    = useState(INITIAL);
  const [proof,   setProof]   = useState(null);
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);

  const setF = (k,v) => setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.category)            e.category    = 'Select a category';
    if (!form.description.trim())  e.description = 'Required';
    if (!form.amount || parseFloat(form.amount) <= 0) e.amount = 'Enter valid amount';
    if (!form.expense_date)        e.expense_date = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      let proofUrl = null;
      if (proof) proofUrl = await uploadFile('expense-proofs', proof, storeId||adminId||'general');

      const { error } = await supabase.from('expenses').insert({
        store_id:     storeId  || null,
        admin_id:     adminId  || null,
        category:     form.category,
        description:  form.description.trim(),
        amount:       parseFloat(form.amount),
        expense_date: form.expense_date,
        notes:        form.notes.trim() || null,
        proof_url:    proofUrl,
      });
      if (error) throw new Error(error.message);
      onSuccess?.();
    } catch (err) {
      window.alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.3)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}
      onClick={e=>e.target===e.currentTarget&&onClose?.()}>
      <motion.div initial={{ opacity:0,scale:0.95,y:20 }} animate={{ opacity:1,scale:1,y:0 }} exit={{ opacity:0,scale:0.95,y:20 }}
        style={{ background:'var(--bg-2)',border:'1px solid var(--bg-4)',borderRadius:'var(--radius-xl)',width:'100%',maxWidth:560,boxShadow:'var(--shadow-float)',overflow:'hidden' }}>
        <div style={{ padding:'20px 24px 16px',borderBottom:'1px solid var(--bg-4)',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:17,fontWeight:700,color:'var(--label)' }}>💸 Add Expense</div>
            <div style={{ fontSize:13,color:'var(--label-4)',marginTop:2 }}>This will reduce net profit</div>
          </div>
          <button onClick={onClose} style={{ width:30,height:30,borderRadius:'50%',background:'var(--bg-3)',border:'1px solid var(--bg-4)',cursor:'pointer',fontSize:14,color:'var(--label-3)',display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
        </div>
        <div style={{ padding:'20px 24px',display:'flex',flexDirection:'column',gap:14 }}>
          {/* Category grid */}
          <div>
            <label style={{ fontSize:12,fontWeight:600,color:'var(--label-3)',display:'block',marginBottom:8 }}>Category <span style={{ color:'var(--accent)' }}>*</span></label>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8 }}>
              {CATEGORIES.map(c => (
                <button key={c.id} type="button" onClick={() => setF('category',c.id)}
                  style={{ padding:'10px 6px',borderRadius:10,border:`1.5px solid ${form.category===c.id?'var(--accent)':'var(--bg-4)'}`,
                    background:form.category===c.id?'var(--accent-bg)':'var(--bg-3)',cursor:'pointer',fontFamily:'inherit',transition:'all 0.15s',textAlign:'center' }}>
                  <div style={{ fontSize:16,marginBottom:3 }}>{c.label.split(' ')[0]}</div>
                  <div style={{ fontSize:10,fontWeight:600,color:form.category===c.id?'var(--accent)':'var(--label-4)' }}>{c.label.slice(3)}</div>
                </button>
              ))}
            </div>
            {errors.category && <div style={{ fontSize:11,color:'var(--error-text)',marginTop:4 }}>{errors.category}</div>}
          </div>

          {/* Fields */}
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ fontSize:12,fontWeight:600,color:'var(--label-3)',display:'block',marginBottom:5 }}>Description <span style={{ color:'var(--accent)' }}>*</span></label>
              <input value={form.description} onChange={e=>setF('description',e.target.value)} placeholder="e.g. Monthly salary for Ravi Kumar"
                style={{ width:'100%',padding:'10px 13px',border:`1.5px solid ${errors.description?'var(--accent)':'var(--bg-4)'}`,borderRadius:10,fontSize:13,fontFamily:'inherit',color:'var(--label)',background:'var(--bg-3)',outline:'none',boxSizing:'border-box' }}
                onFocus={e=>e.target.style.borderColor='var(--accent)'}
                onBlur={e=>e.target.style.borderColor=errors.description?'var(--accent)':'var(--bg-4)'} />
              {errors.description && <div style={{ fontSize:11,color:'var(--error-text)',marginTop:3 }}>{errors.description}</div>}
            </div>
            <div>
              <label style={{ fontSize:12,fontWeight:600,color:'var(--label-3)',display:'block',marginBottom:5 }}>Amount (₹) <span style={{ color:'var(--accent)' }}>*</span></label>
              <input type="number" value={form.amount} onChange={e=>setF('amount',e.target.value)} placeholder="5000"
                style={{ width:'100%',padding:'10px 13px',border:`1.5px solid ${errors.amount?'var(--accent)':'var(--bg-4)'}`,borderRadius:10,fontSize:14,fontWeight:700,fontFamily:'inherit',color:'var(--label)',background:'var(--bg-3)',outline:'none',boxSizing:'border-box' }}
                onFocus={e=>e.target.style.borderColor='var(--accent)'}
                onBlur={e=>e.target.style.borderColor='var(--bg-4)'} />
              {errors.amount && <div style={{ fontSize:11,color:'var(--error-text)',marginTop:3 }}>{errors.amount}</div>}
            </div>
            <div>
              <label style={{ fontSize:12,fontWeight:600,color:'var(--label-3)',display:'block',marginBottom:5 }}>Date <span style={{ color:'var(--accent)' }}>*</span></label>
              <input type="date" value={form.expense_date} onChange={e=>setF('expense_date',e.target.value)}
                style={{ width:'100%',padding:'10px 13px',border:'1.5px solid var(--bg-4)',borderRadius:10,fontSize:13,fontFamily:'inherit',color:'var(--label)',background:'var(--bg-3)',outline:'none',boxSizing:'border-box' }}
                onFocus={e=>e.target.style.borderColor='var(--accent)'}
                onBlur={e=>e.target.style.borderColor='var(--bg-4)'} />
            </div>
          </div>

          {/* Proof upload */}
          <div>
            <label style={{ fontSize:12,fontWeight:600,color:'var(--label-3)',display:'block',marginBottom:5 }}>Proof / Receipt (optional)</label>
            {proof ? (
              <div style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 13px',background:'#DCFCE7',border:'1px solid #BBF7D0',borderRadius:10,fontSize:13,color:'#15803D' }}>
                <span>{proof.name}</span>
                <button onClick={()=>setProof(null)} style={{ marginLeft:'auto',background:'none',border:'none',color:'#6B7280',cursor:'pointer',fontSize:15 }}>✕</button>
              </div>
            ) : (
              <label style={{ display:'flex',flexDirection:'column',alignItems:'center',padding:'16px',border:'2px dashed var(--bg-4)',borderRadius:10,cursor:'pointer',background:'var(--bg-3)',transition:'all 0.18s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='var(--accent)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='var(--bg-4)'}>
                <span style={{ fontSize:22,marginBottom:4 }}>📎</span>
                <span style={{ fontSize:13,color:'var(--label-3)',fontWeight:500 }}><strong style={{ color:'var(--accent)' }}>Click to upload</strong> or drag & drop</span>
                <span style={{ fontSize:11,color:'var(--label-4)',marginTop:3 }}>JPG, PNG, PDF — max 10MB</span>
                <input type="file" accept="image/*,application/pdf" onChange={e=>setProof(e.target.files[0]||null)} style={{ display:'none' }} />
              </label>
            )}
          </div>

          {/* Notes */}
          <div>
            <label style={{ fontSize:12,fontWeight:600,color:'var(--label-3)',display:'block',marginBottom:5 }}>Notes (optional)</label>
            <textarea value={form.notes} onChange={e=>setF('notes',e.target.value)} placeholder="Any additional details…"
              style={{ width:'100%',padding:'10px 13px',border:'1.5px solid var(--bg-4)',borderRadius:10,fontSize:13,fontFamily:'inherit',color:'var(--label)',background:'var(--bg-3)',outline:'none',resize:'vertical',minHeight:60,boxSizing:'border-box' }} />
          </div>

          <div style={{ display:'flex',gap:10,paddingTop:4 }}>
            <button type="button" onClick={onClose}
              style={{ flex:1,padding:'11px',background:'var(--bg-3)',border:'1px solid var(--bg-4)',color:'var(--label-3)',borderRadius:12,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit' }}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={loading}
              style={{ flex:2,padding:'11px',background:'linear-gradient(145deg,#FF3B30,#D93025)',color:'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',boxShadow:'0 3px 12px rgba(255,59,48,0.3)' }}>
              {loading ? '⏳ Saving…' : `💸 Record Expense${form.amount ? ' · ₹'+Number(form.amount).toLocaleString() : ''}`}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
