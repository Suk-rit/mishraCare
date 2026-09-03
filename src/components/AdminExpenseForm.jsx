/**
 * AdminExpenseForm
 * Records an admin-level expense (warehouse staff salary, travel, utilities, etc.)
 * Uploads proof to 'admin-expense-proofs' bucket.
 */
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import { uploadFile } from '../utils/storage';

const CATEGORIES = [
  { id: 'inventory_transport',   icon: '🚚', label: 'Inventory Transport'   },
  { id: 'office_rent',           icon: '🏢', label: 'Office / Warehouse Rent'},
  { id: 'utilities',             icon: '💡', label: 'Utilities (Electric/Water)'},
  { id: 'travel',                icon: '✈️', label: 'Travel'                },
  { id: 'marketing',             icon: '📢', label: 'Marketing'             },
  { id: 'bank_charges',          icon: '🏦', label: 'Bank Charges'          },
  { id: 'miscellaneous',         icon: '📦', label: 'Miscellaneous'         },
];

const PAYMENT_METHODS = [
  { id: 'cash',          icon: '💵', label: 'Cash'          },
  { id: 'upi',           icon: '📱', label: 'UPI'           },
  { id: 'bank_transfer', icon: '🏦', label: 'Bank Transfer' },
  { id: 'cheque',        icon: '📄', label: 'Cheque'        },
];

function ProofUpload({ file, onChange }) {
  const ref = useRef();
  const [drag, setDrag] = useState(false);
  const handle = (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/') && f.type !== 'application/pdf') {
      alert('Image or PDF only'); return;
    }
    if (f.size > 10 * 1024 * 1024) { alert('Max 10 MB'); return; }
    onChange(f);
  };
  return (
    <div>
      <label style={{ fontSize:12, fontWeight:600, color:'var(--label-3)',
        display:'block', marginBottom:6 }}>
        Proof / Receipt (optional)
      </label>
      {!file ? (
        <div onClick={() => ref.current.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
          style={{ border:`2px dashed ${drag ? 'var(--accent)' : 'var(--bg-4)'}`,
            borderRadius:10, padding:'18px 16px', textAlign:'center', cursor:'pointer',
            background: drag ? 'var(--accent-bg)' : 'var(--bg-3)', transition:'all 0.15s' }}>
          <div style={{ fontSize:22, marginBottom:4 }}>📎</div>
          <div style={{ fontSize:12, color:'var(--label-4)' }}>
            Drag & drop or click · JPG, PNG, PDF · max 10 MB
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
          background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:10 }}>
          <span style={{ fontSize:20 }}>{file.type === 'application/pdf' ? '📄' : '🖼️'}</span>
          <div style={{ flex:1, fontSize:12, fontWeight:600, color:'#15803D',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {file.name}
          </div>
          <button onClick={() => onChange(null)}
            style={{ background:'#FEE2E2', color:'#B91C1C', border:'none',
              borderRadius:6, padding:'4px 8px', fontSize:11, fontWeight:600,
              cursor:'pointer' }}>Remove</button>
        </div>
      )}
      <input ref={ref} type="file" accept="image/*,application/pdf"
        style={{ display:'none' }} onChange={e => handle(e.target.files[0])} />
    </div>
  );
}

export default function AdminExpenseForm({ adminId, onClose, onSuccess }) {
  const [form, setForm] = useState({
    category:       'inventory_transport',
    description:    '',
    amount:         '',
    expense_date:   new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    notes:          '',
  });
  const [proofFile, setProofFile] = useState(null);
  const [errors,    setErrors]    = useState({});
  const [saving,    setSaving]    = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.description.trim()) e.description = 'Required';
    if (!form.amount || parseFloat(form.amount) <= 0) e.amount = 'Enter a valid amount';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!adminId) { alert('Admin ID not found. Please refresh and try again.'); return; }
    setSaving(true);
    try {
      let proofUrl = null;
      if (proofFile) {
        proofUrl = await uploadFile('admin-expense-proofs', proofFile, 'admin');
      }
      const { error } = await supabase.from('admin_expenses').insert({
        admin_id:       adminId,
        category:       form.category,
        description:    form.description.trim(),
        amount:         parseFloat(form.amount),
        expense_date:   form.expense_date,
        payment_method: form.payment_method,
        proof_url:      proofUrl,
        notes:          form.notes.trim() || null,
      });
      if (error) throw new Error(error.message);
      onSuccess?.();
    } catch (ex) {
      alert('Error: ' + ex.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div className="modal"
        initial={{ opacity:0, scale:0.95, y:20 }}
        animate={{ opacity:1, scale:1, y:0 }}
        exit={{ opacity:0, scale:0.95, y:20 }}
        transition={{ duration:0.2 }}
        style={{ maxWidth:500, maxHeight:'90vh', display:'flex', flexDirection:'column' }}>

        <div className="modal-header">
          <div>
            <div className="modal-title">💼 Add Admin Expense</div>
            <div className="modal-sub">Record warehouse / regional operating cost</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ overflowY:'auto', flex:1 }}>

          {/* Category grid */}
          <div className="form-section">
            <div className="form-section-title">Category</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:8 }}>
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => set('category', c.id)}
                  style={{ padding:'9px 10px', borderRadius:10, border:'1.5px solid',
                    borderColor: form.category === c.id ? 'var(--accent)' : 'var(--bg-4)',
                    background:  form.category === c.id ? 'var(--accent-bg)' : 'var(--bg-3)',
                    color:       form.category === c.id ? 'var(--accent)' : 'var(--label-3)',
                    cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600,
                    textAlign:'left', display:'flex', alignItems:'center', gap:7 }}>
                  <span>{c.icon}</span>{c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description + amount */}
          <div className="form-section">
            <div className="form-section-title">Details</div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div className="field">
                <label>Description <span className="req">*</span></label>
                <input value={form.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="e.g. Warehouse electricity bill — July"
                  className={errors.description ? 'err' : ''} />
                {errors.description && <span style={{ fontSize:11, color:'var(--error-text)' }}>{errors.description}</span>}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div className="field">
                  <label>Amount (₹) <span className="req">*</span></label>
                  <input type="number" value={form.amount}
                    onChange={e => set('amount', e.target.value)}
                    placeholder="0.00" className={errors.amount ? 'err' : ''} />
                  {errors.amount && <span style={{ fontSize:11, color:'var(--error-text)' }}>{errors.amount}</span>}
                </div>
                <div className="field">
                  <label>Date</label>
                  <input type="date" value={form.expense_date}
                    onChange={e => set('expense_date', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Payment method */}
          <div className="form-section">
            <div className="form-section-title">Payment Method</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {PAYMENT_METHODS.map(p => (
                <button key={p.id} onClick={() => set('payment_method', p.id)}
                  style={{ padding:'7px 14px', borderRadius:20, border:'1.5px solid',
                    borderColor: form.payment_method === p.id ? 'var(--accent)' : 'var(--bg-4)',
                    background:  form.payment_method === p.id ? 'var(--accent-bg)' : 'var(--bg-3)',
                    color:       form.payment_method === p.id ? 'var(--accent)' : 'var(--label-3)',
                    cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600,
                    display:'flex', alignItems:'center', gap:5 }}>
                  <span>{p.icon}</span>{p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Proof + notes */}
          <div className="form-section" style={{ marginBottom:0 }}>
            <div className="form-section-title">Proof & Notes</div>
            <ProofUpload file={proofFile} onChange={setProofFile} />
            <div className="field" style={{ marginTop:12 }}>
              <label>Notes (optional)</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="Any additional details…" style={{ minHeight:56 }} />
            </div>
          </div>

        </div>

        <div className="modal-footer">
          <button className="btn-sm btn-sm-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary btn-sm" onClick={handleSubmit} disabled={saving}>
            {saving ? '⏳ Saving…' : '✓ Add Expense'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
