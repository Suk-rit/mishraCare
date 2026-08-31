/**
 * AddBatchModal — Inline cart row editor (used in bulk stock cart)
 * Exports: emptyBatchRow, validateBatchRow, CartRow
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Field helper ──────────────────────────────────────────────────────────────
function Field({ name, label, required, placeholder, type = 'text', value, error, onChange, hint }) {
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-3)', marginBottom: 4, display: 'block' }}>
        {label}{required && <span style={{ color: '#B91C1C' }}> *</span>}
      </label>
      <input
        type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(name, e.target.value)}
        style={{ width: '100%', padding: '8px 10px', fontSize: 13,
          border: `1.5px solid ${error ? '#B91C1C' : 'var(--bg-4)'}`,
          borderRadius: 8, background: 'var(--bg-2)', color: 'var(--label)',
          fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.15s' }}
        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        onBlur={e => e.target.style.borderColor = error ? '#B91C1C' : 'var(--bg-4)'}
      />
      {hint && <div style={{ fontSize: 11, color: 'var(--label-4)', marginTop: 3 }}>{hint}</div>}
      {error && <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 3 }}>{error}</div>}
    </div>
  );
}

function expiryAlert(dateStr) {
  if (!dateStr) return null;
  const diff = (new Date(dateStr) - new Date()) / 86400000;
  if (diff < 0)   return { color: '#B91C1C', bg: '#FEE2E2', text: '⛔ Already expired!' };
  if (diff < 90)  return { color: '#92400E', bg: '#FEF3C7', text: `⚠️ Expires in ${Math.ceil(diff)} days` };
  if (diff < 180) return { color: '#0369A1', bg: '#E0F2FE', text: `ℹ️ Expires in ${Math.ceil(diff)} days` };
  return null;
}

// ── Exports ───────────────────────────────────────────────────────────────────
export function emptyBatchRow() {
  return {
    batch_number:        '',
    date_of_manufacture: '',
    expiry_date:         '',
    supplier_name:       '',
    supplier_invoice:    '',
    purchase_date:       new Date().toISOString().split('T')[0],
    cost_price_per_pack: '',
    mrp_per_pack:        '',
    quantity_packs:      '',
    quantity_loose:      '0',
    discount_percent:    '0',
    notes:               '',
  };
}

export function validateBatchRow(row, medicine) {
  const e = {};
  if (!row.batch_number.trim())  e.batch_number  = 'Required';
  if (!row.expiry_date)          e.expiry_date   = 'Required';
  else if (new Date(row.expiry_date) < new Date()) e.expiry_date = 'Expired';
  if (!row.quantity_packs || parseInt(row.quantity_packs) < 1) e.quantity_packs = 'Min 1';
  if (!row.mrp_per_pack  || parseFloat(row.mrp_per_pack) <= 0) e.mrp_per_pack   = 'Required';
  if (!row.cost_price_per_pack || parseFloat(row.cost_price_per_pack) <= 0) e.cost_price_per_pack = 'Required';
  const disc = parseFloat(row.discount_percent);
  if (isNaN(disc) || disc < 0 || disc > 20) e.discount_percent = '0–20% only';
  return e;
}

// ── Discount slider ───────────────────────────────────────────────────────────
function DiscountField({ value, onChange }) {
  const pct = parseFloat(value) || 0;

  // Compute MRP info if possible (shown as hint but we don't have mrp here at this level)
  const color = pct === 0 ? '#8E8E93' : pct <= 5 ? '#34C759' : pct <= 10 ? '#FF9500' : '#FF3B30';
  const bg    = pct === 0 ? 'var(--bg-4)' : pct <= 5 ? '#F0FDF4' : pct <= 10 ? '#FFFBEB' : '#FFF1F0';

  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-3)',
        marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Discount % <span style={{ color: '#B91C1C' }}>*</span></span>
        <span style={{ fontSize: 13, fontWeight: 800, color, background: bg,
          padding: '2px 10px', borderRadius: 20, border: `1px solid ${color}33` }}>
          {pct.toFixed(1)}%
        </span>
      </label>
      {/* Slider */}
      <input
        type="range" min="0" max="20" step="0.5"
        value={value}
        onChange={e => onChange('discount_percent', e.target.value)}
        style={{ width: '100%', accentColor: color, height: 4, cursor: 'pointer', marginBottom: 6 }}
      />
      {/* Quick preset buttons */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
        {[0, 5, 10, 15, 20].map(p => (
          <button
            key={p}
            onClick={() => onChange('discount_percent', String(p))}
            style={{ padding: '3px 10px', borderRadius: 20, border: '1.5px solid',
              borderColor: pct === p ? color : 'var(--bg-4)',
              background: pct === p ? bg : 'var(--bg-3)',
              color: pct === p ? color : 'var(--label-4)',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {p}%
          </button>
        ))}
        {/* Manual number input */}
        <input
          type="number" min="0" max="20" step="0.5"
          value={value}
          onChange={e => {
            const v = Math.min(20, Math.max(0, parseFloat(e.target.value) || 0));
            onChange('discount_percent', String(v));
          }}
          style={{ width: 64, padding: '3px 8px', border: '1.5px solid var(--bg-4)',
            borderRadius: 8, fontSize: 12, fontFamily: 'inherit', color: 'var(--label)',
            background: 'var(--bg-2)', outline: 'none', textAlign: 'center' }}
        />
      </div>
      <div style={{ fontSize: 11, color: 'var(--label-4)' }}>
        Max 20% · This discount will be applied during billing at the store
      </div>
    </div>
  );
}

// ── CartRow ───────────────────────────────────────────────────────────────────
export function CartRow({ medicine, row, errors, onChange, onRemove }) {
  const [expanded, setExpanded] = useState(true);

  const packSize   = medicine.pack_size || 1;
  const packs      = parseInt(row.quantity_packs, 10) || 0;
  const loose      = parseInt(row.quantity_loose,  10) || 0;
  const totalUnits = packs * packSize + loose;
  const mrp        = parseFloat(row.mrp_per_pack) || 0;
  const cost       = parseFloat(row.cost_price_per_pack) || 0;
  const disc       = parseFloat(row.discount_percent) || 0;
  const mrpPerUnit = packSize > 0 ? mrp / packSize : 0;
  const discPerUnit = mrpPerUnit * disc / 100;
  const finalPerUnit = mrpPerUnit - discPerUnit;
  const totalCost  = cost > 0 && packs > 0 ? (cost * packs).toFixed(2) : null;
  const totalMRP   = mrp > 0 && packs > 0 ? (mrp * packs).toFixed(2) : null;
  const totalAfterDisc = finalPerUnit > 0 && totalUnits > 0 ? (finalPerUnit * totalUnits).toFixed(2) : null;
  const ea = expiryAlert(row.expiry_date);
  const hasErrors = Object.keys(errors || {}).length > 0;

  const TYPE_ICONS = {
    Tablet: '💊', Capsule: '💊', Syrup: '🧴', Injection: '💉',
    Drops: '💧', Cream: '🧴', Ointment: '🧴', Powder: '🧂',
    Inhaler: '🌬️', Patch: '🩹', Other: '📦',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      style={{ background: 'var(--bg-2)',
        border: `1.5px solid ${hasErrors ? '#FECACA' : 'var(--bg-4)'}`,
        borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        cursor: 'pointer', background: expanded ? 'var(--bg-3)' : 'var(--bg-2)',
        borderBottom: expanded ? '1px solid var(--bg-4)' : 'none' }}
        onClick={() => setExpanded(e => !e)}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{TYPE_ICONS[medicine.type] || '📦'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)', marginBottom: 1 }}>
            {medicine.name}
            {medicine.strength && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--label-4)' }}> · {medicine.strength}</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--label-4)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span>{medicine.manufacturer} · {medicine.pack_size} {medicine.pack_unit}/pack</span>
            {totalUnits > 0 && <span style={{ fontWeight: 600, color: '#007AFF' }}>→ {totalUnits} units</span>}
            {disc > 0 && <span style={{ fontWeight: 700, color: '#FF3B30' }}>🏷️ {disc}% off</span>}
            {totalAfterDisc && <span style={{ fontWeight: 600, color: '#15803D' }}>₹{totalAfterDisc} final</span>}
          </div>
        </div>
        {hasErrors && (
          <span style={{ fontSize: 11, background: '#FEE2E2', color: '#B91C1C',
            padding: '2px 8px', borderRadius: 20, fontWeight: 600, flexShrink: 0 }}>⚠️ Incomplete</span>
        )}
        <button onClick={e => { e.stopPropagation(); onRemove(); }}
          style={{ background: '#FEE2E2', color: '#B91C1C', border: 'none',
            borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', flexShrink: 0 }}>Remove</button>
        <span style={{ color: 'var(--label-4)', fontSize: 14, flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Body */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: 10 }}>
                <Field name="batch_number" label="Batch Number" required placeholder="BCH-2024-001"
                  value={row.batch_number} error={errors?.batch_number} onChange={onChange} />
                <Field name="purchase_date" label="Purchase Date" type="date"
                  value={row.purchase_date} onChange={onChange} />
                <Field name="date_of_manufacture" label="Mfg Date (DOM)" type="date"
                  value={row.date_of_manufacture} onChange={onChange} />
                <div>
                  <Field name="expiry_date" label="Expiry Date" required type="date"
                    value={row.expiry_date} error={errors?.expiry_date} onChange={onChange} />
                  {ea && <div style={{ marginTop: 4, padding: '4px 8px', background: ea.bg,
                    color: ea.color, borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{ea.text}</div>}
                </div>
              </div>

              {/* Supplier */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field name="supplier_name" label="Supplier" placeholder="ABC Pharma"
                  value={row.supplier_name} onChange={onChange} />
                <Field name="supplier_invoice" label="Invoice No." placeholder="INV-5678"
                  value={row.supplier_invoice} onChange={onChange} />
              </div>

              {/* Quantity */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field name="quantity_packs" label={`Packs (${medicine.pack_size} ${medicine.pack_unit}s each)`}
                  required type="number" placeholder="50"
                  value={row.quantity_packs} error={errors?.quantity_packs} onChange={onChange}
                  hint={packs > 0 ? `= ${packs * packSize} ${medicine.pack_unit}s` : ''} />
                <Field name="quantity_loose" label={`Loose ${medicine.pack_unit}s`}
                  type="number" placeholder="0" value={row.quantity_loose} onChange={onChange}
                  hint="Extra units outside full packs" />
              </div>

              {/* Pricing */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field name="cost_price_per_pack" label="Cost per Pack (₹)" required type="number"
                  placeholder="18.50" value={row.cost_price_per_pack}
                  error={errors?.cost_price_per_pack} onChange={onChange}
                  hint={totalCost ? `Total: ₹${totalCost}` : 'From stockist bill'} />
                <Field name="mrp_per_pack" label="MRP per Pack (₹)" required type="number"
                  placeholder="25.00" value={row.mrp_per_pack}
                  error={errors?.mrp_per_pack} onChange={onChange}
                  hint="Printed on the pack" />
              </div>

              {/* ── DISCOUNT ── */}
              <div style={{ background: disc > 0 ? '#FFF1F0' : 'var(--bg-3)',
                border: `1.5px solid ${disc > 0 ? '#FFBDBD' : 'var(--bg-4)'}`,
                borderRadius: 10, padding: '12px 14px' }}>
                <DiscountField value={row.discount_percent} onChange={onChange} />
                {errors?.discount_percent && (
                  <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 4 }}>{errors.discount_percent}</div>
                )}
              </div>

              {/* Pricing summary */}
              {mrp > 0 && packSize > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                  {[
                    { label: 'MRP/unit',     value: `₹${mrpPerUnit.toFixed(2)}`,   color: '#64748B', bg: 'var(--bg-3)' },
                    disc > 0 && { label: 'Discount/unit', value: `-₹${discPerUnit.toFixed(2)}`, color: '#FF3B30', bg: '#FFF1F0' },
                    { label: 'Final/unit',   value: `₹${finalPerUnit.toFixed(2)}`, color: '#15803D', bg: '#F0FDF4' },
                    totalUnits > 0 && totalAfterDisc && { label: 'Total (final)', value: `₹${totalAfterDisc}`, color: '#0369A1', bg: '#EFF6FF' },
                  ].filter(Boolean).map((s, i) => (
                    <div key={i} style={{ background: s.bg, border: `1px solid ${s.color}22`,
                      borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: s.color,
                        textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>{s.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Notes */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-3)',
                  marginBottom: 4, display: 'block' }}>Notes (optional)</label>
                <textarea placeholder="Storage notes, handling…" value={row.notes}
                  onChange={e => onChange('notes', e.target.value)}
                  style={{ width: '100%', minHeight: 52, padding: '8px 10px',
                    fontSize: 12, border: '1.5px solid var(--bg-4)', borderRadius: 8,
                    background: 'var(--bg-2)', color: 'var(--label)', fontFamily: 'inherit',
                    outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
