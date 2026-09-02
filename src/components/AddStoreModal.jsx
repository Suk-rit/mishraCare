import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import { uploadFiles } from '../utils/storage';
import { getSession } from '../utils/session';
import FileUpload from './FileUpload';

// ── Field component defined OUTSIDE the modal so it never remounts on re-render ──
function Field({ name, label, required, placeholder, type = 'text', form, errors, onChange }) {
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
      {errors[name] && <span style={{ fontSize: 11, color: '#ff6b6b' }}>{errors[name]}</span>}
    </div>
  );
}

const INITIAL = {
  store_name: '', rdl_number: '', gstin: '',
  address_line1: '', address_line2: '', city: '', state: '', pincode: '',
  pharmacist_name: '', pharmacist_registration: '', pharmacist_phone: '',
  opening_time: '09:00', closing_time: '21:00', is_24_hours: false,
  established_date: '',
};

const STEPS = ['Store Info', 'Location', 'Pharmacist', 'Documents'];

export default function AddStoreModal({ onClose, onSuccess, adminsList = null, preselectedAdminId = null }) {
  const [step,    setStep]   = useState(0);
  const [form,    setForm]   = useState(INITIAL);
  const [assignedAdminId, setAssignedAdminId] = useState(preselectedAdminId || '');
  const [files,   setFiles]  = useState({
    pharmacist_degree: null,
    rent_agreement:    null,
    rdl_certificate:   null,
    gst_certificate:   null,
    noc:               null,
  });
  const [errors,  setErrors] = useState({});
  const [loading, setLoading]= useState(false);

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setFile  = (key, val) => setFiles(f => ({ ...f, [key]: val }));

  // ── Validate per step ────────────────────────────────────
  const validate = () => {
    const e = {};
    if (step === 0) {
      if (!form.store_name.trim()) e.store_name = 'Required';
      if (!form.rdl_number.trim()) e.rdl_number = 'Required';
    }
    if (step === 1) {
      if (!form.address_line1.trim()) e.address_line1 = 'Required';
      if (!form.city.trim())          e.city          = 'Required';
      if (!form.state.trim())         e.state         = 'Required';
      if (!form.pincode.trim())       e.pincode       = 'Required';
    }
    if (step === 2) {
      if (!form.pharmacist_name.trim())         e.pharmacist_name         = 'Required';
      if (!form.pharmacist_registration.trim()) e.pharmacist_registration = 'Required';
    }
    if (step === 3) {
      if (!files.pharmacist_degree) e.pharmacist_degree = 'Required';
      if (!files.rent_agreement)    e.rent_agreement    = 'Required';
      if (!files.rdl_certificate)   e.rdl_certificate   = 'Required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate()) setStep(s => s + 1); };
  const prev = () => setStep(s => s - 1);

  // ── Submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const urls = await uploadFiles('store-documents', {
        pharmacist_degree: files.pharmacist_degree,
        rent_agreement:    files.rent_agreement,
        rdl_certificate:   files.rdl_certificate,
        gst_certificate:   files.gst_certificate,
        noc:               files.noc,
      }, 'stores');

      // Resolve admin id: either passed explicitly (Devta) or from session (legacy)
      let adminId = assignedAdminId || null;
      if (!adminId) {
        const session = getSession();
        if (session?.role === 'admin') {
          const { data: adminRow } = await supabase
            .from('admins').select('id').eq('email', session.email).single();
          adminId = adminRow?.id || null;
        }
      }

      const { data: newStore, error } = await supabase.from('stores').insert({
        store_name:              form.store_name.trim(),
        rdl_number:              form.rdl_number.trim(),
        gstin:                   form.gstin.trim() || null,
        address_line1:           form.address_line1.trim(),
        address_line2:           form.address_line2.trim() || null,
        city:                    form.city.trim(),
        state:                   form.state.trim(),
        pincode:                 form.pincode.trim(),
        pharmacist_name:         form.pharmacist_name.trim(),
        pharmacist_registration: form.pharmacist_registration.trim(),
        pharmacist_phone:        form.pharmacist_phone.trim() || null,
        opening_time:            form.is_24_hours ? null : form.opening_time,
        closing_time:            form.is_24_hours ? null : form.closing_time,
        is_24_hours:             form.is_24_hours,
        established_date:        form.established_date || null,
        pharmacist_degree_url:   urls.pharmacist_degree,
        rent_agreement_url:      urls.rent_agreement,
        rdl_certificate_url:     urls.rdl_certificate,
        gst_certificate_url:     urls.gst_certificate,
        noc_url:                 urls.noc,
        admin_id:                adminId,
      }).select().single();

      if (error) throw new Error(error.message);

      // Notify the assigned admin about the new store
      if (adminId && newStore) {
        await supabase.from('notifications').insert({
          recipient_id:   adminId,
          recipient_role: 'admin',
          type:           'store_assigned',
          title:          `New store assigned to you: ${form.store_name.trim()}`,
          body:           `Devta has created and assigned ${form.store_name.trim()} (${form.city.trim()}, ${form.state.trim()}) to your region.`,
          reference_id:   newStore.id,
          is_read:        false,
        });
      }

      onSuccess();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Shared props passed down to Field
  const fp = { form, errors, onChange: setField };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="modal modal-lg"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25 }}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-title">🏪 Add New Store</div>
            <div className="modal-sub">Fill in the store details across all steps</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Step tabs */}
        <div style={{ padding: '0 28px', paddingTop: 20 }}>
          <div className="modal-steps">
            {STEPS.map((s, i) => (
              <button
                key={i}
                className={`modal-step-btn${step === i ? ' active' : ''}${step > i ? ' done' : ''}`}
                onClick={() => step > i && setStep(i)}
              >
                {step > i ? '✓' : i + 1} {s}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="modal-body">
          <AnimatePresence mode="wait">

            {/* Step 0 — Store Info */}
            {step === 0 && (
              <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {/* Admin assignment — only visible when Devta is adding */}
                {adminsList && adminsList.length > 0 && (
                  <div className="form-section">
                    <div className="form-section-title">Assign to Admin Region</div>
                    <div className="field">
                      <label>Admin <span className="req">*</span></label>
                      <select value={assignedAdminId} onChange={e => setAssignedAdminId(e.target.value)}
                        style={{ padding:'9px 12px', border:'1.5px solid var(--bg-4)', borderRadius:10,
                          fontSize:13, fontFamily:'inherit', color:'var(--label)',
                          background:'var(--bg-3)', outline:'none', width:'100%' }}>
                        <option value="">— Select an admin —</option>
                        {adminsList.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.full_name}{a.city ? ` · ${a.city}` : ''}{a.region ? ` (${a.region})` : ''}
                          </option>
                        ))}
                      </select>
                      {!assignedAdminId && <span style={{ fontSize:11, color:'#FF9500', marginTop:4, display:'block' }}>Store will be unassigned if no admin is selected</span>}
                    </div>
                  </div>
                )}
                <div className="form-section">
                  <div className="form-section-title">Basic Information</div>
                  <div className="form-grid">
                    <Field {...fp} name="store_name"      label="Store Name"       required placeholder="JanSwasthya Pharmacy" />
                    <Field {...fp} name="rdl_number"      label="RDL Number"       required placeholder="DL-XXX-XXXXXX" />
                    <Field {...fp} name="gstin"           label="GSTIN"                     placeholder="22AAAAA0000A1Z5" />
                    <Field {...fp} name="established_date" label="Established Date" type="date" />
                  </div>
                </div>
                <div className="form-section">
                  <div className="form-section-title">Operating Hours</div>
                  <div className="form-grid">
                    <div className="field">
                      <label>Opening Time</label>
                      <input type="time" value={form.opening_time} onChange={e => setField('opening_time', e.target.value)} disabled={form.is_24_hours} />
                    </div>
                    <div className="field">
                      <label>Closing Time</label>
                      <input type="time" value={form.closing_time} onChange={e => setField('closing_time', e.target.value)} disabled={form.is_24_hours} />
                    </div>
                    <div className="field form-full" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <input
                        type="checkbox" id="is24"
                        checked={form.is_24_hours}
                        onChange={e => setField('is_24_hours', e.target.checked)}
                        style={{ width: 18, height: 18 }}
                      />
                      <label htmlFor="is24" style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>24-hour store</label>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 1 — Location */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="form-section">
                  <div className="form-section-title">Store Location</div>
                  <div className="form-grid">
                    <div className="field form-full">
                      <label>Address Line 1 <span className="req">*</span></label>
                      <input
                        placeholder="Shop No. / Building Name / Street"
                        value={form.address_line1}
                        onChange={e => setField('address_line1', e.target.value)}
                        className={errors.address_line1 ? 'err' : ''}
                      />
                      {errors.address_line1 && <span style={{ fontSize: 11, color: '#ff6b6b' }}>{errors.address_line1}</span>}
                    </div>
                    <div className="field form-full">
                      <label>Address Line 2</label>
                      <input
                        placeholder="Area / Landmark (optional)"
                        value={form.address_line2}
                        onChange={e => setField('address_line2', e.target.value)}
                      />
                    </div>
                    <Field {...fp} name="city"    label="City"    required placeholder="Mumbai" />
                    <Field {...fp} name="state"   label="State"   required placeholder="Maharashtra" />
                    <Field {...fp} name="pincode" label="Pincode" required placeholder="400001" />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2 — Pharmacist */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="form-section">
                  <div className="form-section-title">Pharmacist Details</div>
                  <div className="form-grid">
                    <Field {...fp} name="pharmacist_name"         label="Pharmacist Name"           required placeholder="Dr. Ramesh Kumar" />
                    <Field {...fp} name="pharmacist_registration" label="Pharmacy Council Reg. No." required placeholder="PCI-XXXX-XXXX" />
                    <Field {...fp} name="pharmacist_phone"        label="Pharmacist Phone"                   placeholder="+91 98765 43210" />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3 — Documents */}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="form-section">
                  <div className="form-section-title">Store Documents</div>
                  <div className="form-grid">
                    <div>
                      <FileUpload
                        label="Pharmacist Degree / Certificate"
                        required
                        value={files.pharmacist_degree}
                        onChange={v => setFile('pharmacist_degree', v)}
                      />
                      {errors.pharmacist_degree && <span style={{ fontSize: 11, color: '#ff6b6b' }}>Required</span>}
                    </div>
                    <div>
                      <FileUpload
                        label="Rent Agreement"
                        required
                        value={files.rent_agreement}
                        onChange={v => setFile('rent_agreement', v)}
                      />
                      {errors.rent_agreement && <span style={{ fontSize: 11, color: '#ff6b6b' }}>Required</span>}
                    </div>
                    <div>
                      <FileUpload
                        label="RDL Certificate"
                        required
                        value={files.rdl_certificate}
                        onChange={v => setFile('rdl_certificate', v)}
                      />
                      {errors.rdl_certificate && <span style={{ fontSize: 11, color: '#ff6b6b' }}>Required</span>}
                    </div>
                    <FileUpload
                      label="GST Certificate (optional)"
                      value={files.gst_certificate}
                      onChange={v => setFile('gst_certificate', v)}
                    />
                    <FileUpload
                      label="NOC (optional)"
                      value={files.noc}
                      onChange={v => setFile('noc', v)}
                    />
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {step > 0 && (
            <button className="btn-sm btn-sm-ghost" onClick={prev}>← Back</button>
          )}
          <button className="btn-sm btn-sm-ghost" onClick={onClose}>Cancel</button>
          {step < STEPS.length - 1 ? (
            <button className="btn-primary btn-sm" style={{ padding: '9px 20px' }} onClick={next}>
              Next →
            </button>
          ) : (
            <button
              className="btn-primary btn-sm"
              style={{ padding: '9px 20px' }}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? '⏳ Saving...' : '✓ Add Store'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
