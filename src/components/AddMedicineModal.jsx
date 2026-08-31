import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../utils/supabase';

// ── Field helper — defined outside to prevent re-mount on parent re-render ────
function Field({ name, label, required, placeholder, type = 'text', form, errors, onChange, hint }) {
  return (
    <div className="field">
      <label>{label}{required && <span className="req"> *</span>}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={form[name]}
        onChange={e => onChange(name, e.target.value)}
        className={errors[name] ? 'err' : ''}
      />
      {hint && <span style={{ fontSize:11, color:'var(--label-4)', marginTop:2, display:'block' }}>{hint}</span>}
      {errors[name] && <span style={{ fontSize:11, color:'var(--error-text)' }}>{errors[name]}</span>}
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPES = [
  'Tablet','Capsule','Syrup','Injection','Drops',
  'Cream','Ointment','Powder','Inhaler','Patch',
  'Suppository','Lozenges','Other',
];
const SCHEDULES  = ['OTC','Prescription','H','H1','X','G'];
const PACK_UNITS = ['tablet','capsule','ml','vial','tube','sachet','strip','unit','bottle','ampoule'];
const TYPE_ICONS  = {
  Tablet:'💊', Capsule:'💊', Syrup:'🧴', Injection:'💉', Drops:'💧',
  Cream:'🧴',  Ointment:'🧴', Powder:'🧂', Inhaler:'🌬️', Patch:'🩹',
  Suppository:'💊', Lozenges:'🍬', Other:'📦',
};

const INITIAL = {
  name:        '',
  generic_name:'',
  brand:       '',
  manufacturer:'',
  category:    '',
  type:        'Tablet',
  schedule:    'OTC',
  strength:    '',
  dosage_form: '',
  pack_size:   '10',
  pack_unit:   'tablet',
  pack_label:  '',
  hsn_code:    '',
  description: '',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function AddMedicineModal({ onClose, onSuccess, editData = null }) {
  const [form,    setForm]    = useState(
    editData
      ? { ...INITIAL, ...editData, pack_size: String(editData.pack_size || 10) }
      : INITIAL
  );
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-fill pack_label when type/pack_unit/pack_size changes
  useEffect(() => {
    const auto = buildAutoLabel(form);
    setForm(f => {
      // Only override if it's still the auto-generated value (don't stomp manual edits)
      if (!f.pack_label || f.pack_label === buildAutoLabel({ ...f, pack_label: '' })) {
        return { ...f, pack_label: auto };
      }
      return f;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type, form.pack_unit, form.pack_size]);

  function buildAutoLabel(f) {
    const size = f.pack_size || 1;
    const unit = f.pack_unit || 'unit';
    if (f.type === 'Syrup' || f.type === 'Drops') return `${size}${unit} bottle`;
    if (f.type === 'Injection') return `${size} ${unit}${size > 1 ? 's' : ''}`;
    return `Strip of ${size} ${unit}${size > 1 ? 's' : ''}`;
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.name.trim())         e.name         = 'Required';
    if (!form.manufacturer.trim()) e.manufacturer = 'Required';
    if (!form.category.trim())     e.category     = 'Required';
    if (!form.pack_size || parseInt(form.pack_size) < 1) e.pack_size = 'Must be ≥ 1';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = {
        name:         form.name.trim(),
        generic_name: form.generic_name.trim()  || null,
        brand:        form.brand.trim()          || null,
        manufacturer: form.manufacturer.trim(),
        category:     form.category.trim(),
        type:         form.type,
        schedule:     form.schedule,
        strength:     form.strength.trim()       || null,
        dosage_form:  form.dosage_form.trim()    || null,
        pack_size:    parseInt(form.pack_size, 10),
        pack_unit:    form.pack_unit,
        pack_label:   form.pack_label.trim()     || null,
        hsn_code:     form.hsn_code.trim()       || null,
        description:  form.description.trim()    || null,
        is_active:    true,
        // NOTE: mrp_per_pack is intentionally NOT set here.
        // MRP is entered per-batch when admin adds stock, not in the catalog.
      };

      let err;
      if (editData) {
        ({ error: err } = await supabase.from('medicines').update(payload).eq('id', editData.id));
      } else {
        ({ error: err } = await supabase.from('medicines').insert(payload));
      }
      if (err) throw new Error(err.message);
      onSuccess();
    } catch (ex) {
      alert('Error saving medicine: ' + ex.message);
    } finally {
      setLoading(false);
    }
  };

  const fp = { form, errors, onChange: setField };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div className="modal modal-lg"
        initial={{ opacity:0, scale:0.95, y:20 }}
        animate={{ opacity:1, scale:1,    y:0  }}
        exit={{    opacity:0, scale:0.95, y:20 }}
        transition={{ duration:0.22 }}
      >
        {/* ── Header ── */}
        <div className="modal-header">
          <div>
            <div className="modal-title">
              {editData ? '✏️ Edit Medicine' : '💊 Add New Medicine'}
            </div>
            <div className="modal-sub">
              {editData
                ? 'Update catalog details — no stock/batch fields here'
                : 'Register a new medicine in the universal catalog. No MRP or batch info needed yet.'}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* ── Notice banner (new only) ── */}
        {!editData && (
          <div style={{ margin:'0 24px 0', padding:'12px 16px',
            background:'#EFF6FF', border:'1px solid #BFDBFE',
            borderRadius:10, fontSize:13, color:'#1D4ED8',
            display:'flex', gap:10, alignItems:'flex-start' }}>
            <span style={{ fontSize:16, flexShrink:0 }}>ℹ️</span>
            <span>
              Only enter the medicine's <strong>identity and packaging details</strong> here.
              MRP, batch number, date of manufacture/expiry, and purchase cost are entered
              separately when you <strong>add stock batches</strong> after saving this medicine.
            </span>
          </div>
        )}

        <div className="modal-body">

          {/* ── Identity ── */}
          <div className="form-section">
            <div className="form-section-title">Medicine Identity</div>
            <div className="form-grid">
              <Field {...fp} name="name"         label="Medicine Name"       required placeholder="e.g. Paracetamol 500mg Tablet" />
              <Field {...fp} name="generic_name" label="Generic / Salt Name"          placeholder="e.g. Paracetamol" />
              <Field {...fp} name="brand"        label="Brand / Trade Name"           placeholder="e.g. Crocin, Dolo" />
              <Field {...fp} name="manufacturer" label="Manufacturer / Company" required placeholder="e.g. GSK Pharmaceuticals Ltd." />
            </div>
          </div>

          {/* ── Classification ── */}
          <div className="form-section">
            <div className="form-section-title">Classification</div>
            <div className="form-grid">
              <Field {...fp} name="category" label="Category" required placeholder="e.g. Analgesic, Antibiotic, Vitamin…" />

              <div className="field">
                <label>Type <span className="req">*</span></label>
                <select value={form.type} onChange={e => setField('type', e.target.value)}>
                  {TYPES.map(t => (
                    <option key={t} value={t}>{TYPE_ICONS[t]} {t}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Schedule</label>
                <select value={form.schedule} onChange={e => setField('schedule', e.target.value)}>
                  {SCHEDULES.map(s => (
                    <option key={s} value={s}>
                      {s === 'OTC'          ? 'OTC (Over the Counter)'
                       : s === 'Prescription' ? 'Prescription Only'
                       : `Schedule ${s}`}
                    </option>
                  ))}
                </select>
              </div>

              <Field {...fp} name="strength"    label="Strength / Concentration" placeholder="e.g. 500mg, 250mg/5ml" />
              <Field {...fp} name="dosage_form" label="Dosage Form (optional)"   placeholder="e.g. Film-coated tablet" />
            </div>
          </div>

          {/* ── Pack Info ── */}
          <div className="form-section">
            <div className="form-section-title">Packaging Information</div>
            <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10,
              padding:'10px 14px', marginBottom:14, fontSize:13, color:'#1D4ED8' }}>
              💡 Pack size = units per sellable pack (e.g. 10 tablets/strip, 100ml bottle).
              Used for loose-unit billing and stock calculations.
            </div>
            <div className="form-grid">
              <Field {...fp} name="pack_size" label="Pack Size" required type="number" placeholder="10" />

              <div className="field">
                <label>Unit Type</label>
                <select value={form.pack_unit} onChange={e => setField('pack_unit', e.target.value)}>
                  {PACK_UNITS.map(u => (
                    <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div className="field form-full">
                <label>Pack Label <span style={{ fontSize:11, color:'var(--label-4)', fontWeight:400 }}>(auto-filled, you can edit)</span></label>
                <input
                  value={form.pack_label}
                  onChange={e => setField('pack_label', e.target.value)}
                  placeholder="e.g. Strip of 10 tablets"
                />
              </div>
            </div>
          </div>

          {/* ── Tax / Regulatory ── */}
          <div className="form-section">
            <div className="form-section-title">Regulatory</div>
            <div className="form-grid">
              <Field {...fp} name="hsn_code" label="HSN Code (optional)" placeholder="e.g. 30049099" />
            </div>
          </div>

          {/* ── Notes ── */}
          <div className="form-section" style={{ marginBottom:0 }}>
            <div className="form-section-title">Additional Notes</div>
            <div className="field">
              <label>Description / Usage Notes</label>
              <textarea
                placeholder="Usage instructions, warnings, storage conditions…"
                value={form.description}
                onChange={e => setField('description', e.target.value)}
                style={{ minHeight:70 }}
              />
            </div>
          </div>

        </div>

        {/* ── Footer ── */}
        <div className="modal-footer">
          <button className="btn-sm btn-sm-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary btn-sm" style={{ padding:'9px 24px' }}
            onClick={handleSubmit} disabled={loading}>
            {loading ? '⏳ Saving…' : editData ? '✓ Save Changes' : '💊 Add Medicine'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
