/**
 * BillSubmitModal
 *
 * Final step in bulk stock addition.
 * Admin uploads the stockist bill image/PDF and enters the total bill amount.
 * On confirm, submits all cart items as pending medicine_batches.
 */

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import { uploadFile } from '../utils/storage';

// ── Bill image upload widget ───────────────────────────────────────────────────
function BillUpload({ file, onChange, error }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handleFile = (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/') && f.type !== 'application/pdf') {
      alert('Please upload a JPG, PNG, WEBP image or PDF.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      alert('File must be under 10 MB.');
      return;
    }
    onChange(f);
  };

  const preview = file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null;

  return (
    <div>
      {!file ? (
        <div
          onClick={() => inputRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
          style={{
            border: `2px dashed ${dragging ? 'var(--accent)' : error ? '#B91C1C' : 'var(--bg-4)'}`,
            borderRadius: 14, padding: '32px 20px', textAlign: 'center', cursor: 'pointer',
            background: dragging ? 'var(--accent-bg)' : error ? '#FFF5F5' : 'var(--bg-3)',
            transition: 'all 0.18s',
          }}
        >
          <div style={{ fontSize: 38, marginBottom: 10 }}>📄</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--label-2)', marginBottom: 4 }}>
            Upload Stockist Bill
          </div>
          <div style={{ fontSize: 13, color: 'var(--label-4)', marginBottom: 4 }}>
            Drag & drop or click to browse
          </div>
          <div style={{ fontSize: 12, color: 'var(--label-4)' }}>
            JPG, PNG, WEBP or PDF · Max 10 MB
          </div>
        </div>
      ) : (
        <div style={{
          border: '1.5px solid #BBF7D0', borderRadius: 14,
          background: '#F0FDF4', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
            {preview ? (
              <img src={preview} alt="bill preview"
                style={{ width: 72, height: 72, objectFit: 'cover',
                  borderRadius: 10, border: '1px solid var(--bg-4)', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: 10, background: '#DBEAFE',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, flexShrink: 0 }}>📄</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#15803D',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </div>
              <div style={{ fontSize: 12, color: '#166534', marginTop: 3 }}>
                {(file.size / 1024).toFixed(0)} KB · {file.type.split('/')[1]?.toUpperCase()}
              </div>
              <div style={{ fontSize: 12, color: '#15803D', marginTop: 4, fontWeight: 600 }}>
                ✓ Ready to upload
              </div>
            </div>
            <button
              onClick={() => onChange(null)}
              style={{ background: '#FEE2E2', color: '#B91C1C', border: 'none',
                borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', flexShrink: 0 }}
            >
              Change
            </button>
          </div>
        </div>
      )}
      {error && (
        <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 6, fontWeight: 500 }}>
          ⚠️ {error}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*,application/pdf"
        style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function BillSubmitModal({ cart, adminRecord, onClose, onSuccess }) {
  // cart = [{ medicine, row }]
  const [billFile,    setBillFile]    = useState(null);
  const [billAmount,  setBillAmount]  = useState('');
  const [errors,      setErrors]      = useState({});
  const [loading,     setLoading]     = useState(false);
  const [progress,    setProgress]    = useState({ step: '', pct: 0 });

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalItems = cart.length;
  const totalUnitsAll = cart.reduce((sum, { medicine, row }) => {
    const ps    = medicine.pack_size || 1;
    const packs = parseInt(row.quantity_packs, 10) || 0;
    const loose = parseInt(row.quantity_loose,  10) || 0;
    return sum + packs * ps + loose;
  }, 0);
  const totalCostCalc = cart.reduce((sum, { row }) => {
    const c = parseFloat(row.cost_price_per_pack) || 0;
    const p = parseInt(row.quantity_packs, 10) || 0;
    return sum + c * p;
  }, 0);

  // ── Validate ──────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!billFile)   e.billFile   = 'Please upload the stockist bill image or PDF';
    if (!billAmount || parseFloat(billAmount) <= 0) e.billAmount = 'Enter the total amount as shown on the bill';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);

    try {
      // 1. Upload bill image once — shared across all batches in this submission
      setProgress({ step: 'Uploading bill image…', pct: 10 });
      const billUrl = await uploadFile('stockist-bills', billFile, 'batches');
      setProgress({ step: 'Saving batch records…', pct: 50 });

      // 2. Build all batch inserts
      const inserts = cart.map(({ medicine, row }) => {
        const ps         = medicine.pack_size || 1;
        const packs      = parseInt(row.quantity_packs, 10) || 0;
        const loose      = parseInt(row.quantity_loose,  10) || 0;
        const totalUnits = packs * ps + loose;
        return {
          medicine_id:         medicine.id,
          admin_id:            adminRecord?.id || null,
          batch_number:        row.batch_number.trim().toUpperCase(),
          date_of_manufacture: row.date_of_manufacture || null,
          expiry_date:         row.expiry_date,
          supplier_name:       row.supplier_name.trim()    || null,
          supplier_invoice:    row.supplier_invoice.trim() || null,
          purchase_date:       row.purchase_date           || null,
          cost_price_per_pack: parseFloat(row.cost_price_per_pack),
          mrp_per_pack:        parseFloat(row.mrp_per_pack),
          quantity_packs:      packs,
          quantity_loose:      loose,
          total_units:         totalUnits,
          units_remaining:     totalUnits,
          bill_image_url:      billUrl,
          bill_amount:         parseFloat(billAmount),
          discount_percent:    parseFloat(row.discount_percent) || 0,
          status:              'pending',
          notes:               row.notes?.trim() || null,
          is_active:           true,
        };
      });

      // 3. Insert all at once
      const { error } = await supabase.from('medicine_batches').insert(inserts);
      if (error) throw new Error(error.message);

      setProgress({ step: 'Done!', pct: 100 });
      await new Promise(r => setTimeout(r, 400)); // brief pause so user sees 100%
      onSuccess();
    } catch (ex) {
      alert('Submission failed: ' + ex.message);
    } finally {
      setLoading(false);
      setProgress({ step: '', pct: 0 });
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <motion.div
        className="modal modal-lg"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.22 }}
        style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div>
            <div className="modal-title">📋 Submit Stock Request</div>
            <div className="modal-sub">
              Upload the stockist bill and confirm total amount to submit {totalItems} item{totalItems !== 1 ? 's' : ''} for approval
            </div>
          </div>
          <button className="modal-close" onClick={onClose} disabled={loading}>✕</button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>

          {/* Pending notice */}
          <div style={{ padding: '11px 14px', background: '#FEF3C7',
            border: '1px solid #FDE68A', borderRadius: 10, marginBottom: 20,
            fontSize: 13, color: '#92400E', display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>⏳</span>
            <span>
              All batches will be saved as <strong>Pending</strong> and will not count toward
              active inventory until approved. Upload a clear, legible image of the bill.
            </span>
          </div>

          {/* Cart summary */}
          <div className="form-section">
            <div className="form-section-title">
              Items in this submission ({totalItems})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {cart.map(({ medicine, row }, i) => {
                const ps    = medicine.pack_size || 1;
                const packs = parseInt(row.quantity_packs, 10) || 0;
                const loose = parseInt(row.quantity_loose, 10)  || 0;
                const units = packs * ps + loose;
                const cost  = row.cost_price_per_pack && packs
                  ? (parseFloat(row.cost_price_per_pack) * packs).toFixed(2) : null;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', background: 'var(--bg-3)',
                    border: '1px solid var(--bg-4)', borderRadius: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--label)',
                        marginBottom: 1 }}>
                        {medicine.name}
                        {medicine.strength && (
                          <span style={{ fontWeight: 400, color: 'var(--label-4)', fontSize: 12 }}>
                            {' '}· {medicine.strength}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--label-4)' }}>
                        Batch: <strong>{row.batch_number || '—'}</strong>
                        · Exp: {row.expiry_date || '—'}
                        · {units} units
                        {cost && <> · ₹{cost}</>}
                        {parseFloat(row.discount_percent) > 0 && (
                          <span style={{ marginLeft: 6, fontWeight: 700, color: '#FF3B30' }}>
                            🏷️ {parseFloat(row.discount_percent)}% off
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px',
                      borderRadius: 20, background: '#EFF6FF', color: '#1D4ED8' }}>
                      {packs} pack{packs !== 1 ? 's' : ''}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Total summary strip */}
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Total Medicines', value: totalItems,                      color: '#FF3B30', bg: '#FFF1F0' },
                { label: 'Total Units',     value: `${totalUnitsAll} units`,         color: '#007AFF', bg: '#EFF6FF' },
                { label: 'Calc. Cost',      value: `₹${totalCostCalc.toFixed(2)}`,  color: '#15803D', bg: '#F0FDF4' },
              ].map((s, i) => (
                <div key={i} style={{ background: s.bg, border: `1px solid ${s.color}22`,
                  borderRadius: 10, padding: '10px 16px', flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: s.color,
                    textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Bill upload */}
          <div className="form-section">
            <div className="form-section-title">
              Stockist Bill / Invoice <span style={{ color: '#B91C1C' }}>*</span>
            </div>
            <BillUpload file={billFile} onChange={setBillFile} error={errors.billFile} />
          </div>

          {/* Bill amount */}
          <div className="form-section" style={{ marginBottom: 0 }}>
            <div className="form-section-title">
              Total Bill Amount (₹) <span style={{ color: '#B91C1C' }}>*</span>
            </div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%',
                transform: 'translateY(-50%)', fontSize: 16, color: 'var(--label-3)',
                fontWeight: 700, pointerEvents: 'none' }}>₹</span>
              <input
                type="number"
                placeholder="Enter the exact total as shown on the bill"
                value={billAmount}
                onChange={e => setBillAmount(e.target.value)}
                style={{
                  width: '100%', padding: '13px 14px 13px 32px',
                  fontSize: 16, fontWeight: 600,
                  border: `2px solid ${errors.billAmount ? '#B91C1C' : 'var(--bg-4)'}`,
                  borderRadius: 10, background: 'var(--bg-2)', color: 'var(--label)',
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = errors.billAmount ? '#B91C1C' : 'var(--bg-4)'}
              />
            </div>
            {errors.billAmount && (
              <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 5 }}>
                ⚠️ {errors.billAmount}
              </div>
            )}
            {billAmount && parseFloat(billAmount) > 0 && (
              <div style={{ fontSize: 12, color: 'var(--label-4)', marginTop: 5 }}>
                Calculated from batch entries: ₹{totalCostCalc.toFixed(2)}
                {Math.abs(parseFloat(billAmount) - totalCostCalc) > 0.01 && (
                  <span style={{ marginLeft: 8, color: '#FF9500', fontWeight: 600 }}>
                    ⚠️ Difference: ₹{(parseFloat(billAmount) - totalCostCalc).toFixed(2)}
                  </span>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Progress bar */}
        {loading && (
          <div style={{ padding: '0 24px 8px', flexShrink: 0 }}>
            <div style={{ height: 4, background: 'var(--bg-4)', borderRadius: 4, overflow: 'hidden' }}>
              <motion.div
                animate={{ width: `${progress.pct}%` }}
                transition={{ duration: 0.4 }}
                style={{ height: '100%',
                  background: 'linear-gradient(90deg,#FF3B30,#FF9500)',
                  borderRadius: 4 }}
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--label-4)', marginTop: 4, textAlign: 'center' }}>
              {progress.step}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="modal-footer" style={{ flexShrink: 0 }}>
          <button className="btn-sm btn-sm-ghost" onClick={onClose} disabled={loading}>
            Back to Cart
          </button>
          <button
            className="btn-primary btn-sm"
            style={{ padding: '10px 28px', fontSize: 14 }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? '⏳ Submitting…'
              : `📦 Submit ${totalItems} item${totalItems !== 1 ? 's' : ''} for Approval`}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
