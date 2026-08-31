import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../utils/supabase';
import { uploadFiles } from '../utils/storage';
import FileUpload from './FileUpload';

// ── Field — defined outside to prevent remount on re-render ──────────────────
function Field({ name, label, required, placeholder, type = 'text', form, errors, onChange }) {
  return (
    <div className="field">
      <label>{label}{required && <span className="req"> *</span>}</label>
      <input type={type} placeholder={placeholder} value={form[name]}
        onChange={e => onChange(name, e.target.value)} className={errors[name] ? 'err' : ''} />
      {errors[name] && <span style={{ fontSize: 11, color: 'var(--error-text)' }}>{errors[name]}</span>}
    </div>
  );
}

const INITIAL = {
  full_name: '', phone: '', alternate_phone: '', email: '',
  date_of_birth: '', gender: '', aadhar_number: '', pan_number: '',
  address: '', city: '', state: '', pincode: '',
  designation: 'Helper', employment_type: 'full_time',
  joining_date: new Date().toISOString().split('T')[0],
  salary: '', salary_type: 'monthly', shift: 'day',
};

export default function AddEmployeeModal({ store, manager, onClose, onSuccess }) {
  const [form,    setForm]    = useState(INITIAL);
  const [files,   setFiles]   = useState({ photo: null, aadhar_photo: null, id_proof: null, other_doc: null });
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setFile  = (k, v) => setFiles(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = 'Required';
    if (!form.phone.trim())     e.phone     = 'Required';
    if (!form.salary)           e.salary    = 'Required';
    if (!files.photo)           e.photo     = 'Profile photo is required';
    if (!files.aadhar_photo)    e.aadhar_photo = 'Aadhar photo is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const urls = await uploadFiles('employee-documents', {
        photo: files.photo, aadhar_photo: files.aadhar_photo,
        id_proof: files.id_proof, other_doc: files.other_doc,
      }, `stores/${store.id}`);

      const { error } = await supabase.from('employees').insert({
        store_id:        store.id,
        submitted_by:    manager.id,
        full_name:       form.full_name.trim(),
        phone:           form.phone.trim(),
        alternate_phone: form.alternate_phone.trim() || null,
        email:           form.email.trim().toLowerCase() || null,
        date_of_birth:   form.date_of_birth || null,
        gender:          form.gender || null,
        aadhar_number:   form.aadhar_number.trim() || null,
        pan_number:      form.pan_number.trim().toUpperCase() || null,
        address:         form.address.trim() || null,
        city:            form.city.trim() || null,
        state:           form.state.trim() || null,
        pincode:         form.pincode.trim() || null,
        designation:     form.designation.trim() || 'Helper',
        employment_type: form.employment_type,
        joining_date:    form.joining_date || null,
        salary:          form.salary ? parseFloat(form.salary) : null,
        salary_type:     form.salary_type,
        shift:           form.shift,
        photo_url:       urls.photo,
        aadhar_photo_url:urls.aadhar_photo,
        id_proof_url:    urls.id_proof,
        other_doc_url:   urls.other_doc,
        status:          'pending',
        is_active:       false,
      });

      if (error) throw new Error(error.message);
      onSuccess();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fp = { form, errors, onChange: setField };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div className="modal modal-lg"
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.22 }}>

        <div className="modal-header">
          <div>
            <div className="modal-title">👷 Add Helper / Employee</div>
            <div className="modal-sub">Request will be sent to <strong style={{ color: '#0288D1' }}>Devta</strong> for approval · <strong style={{ color: '#FF9500' }}>{store.store_name}</strong></div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Notice */}
          <div style={{ background: '#E1F5FE', border: '1px solid #B3E5FC', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: '#01579B' }}>
            <span>🌤️</span>
            <span>This request will be reviewed by <strong>Devta</strong> before the employee is added. Once approved, their monthly salary will automatically be recorded as an expense.</span>
          </div>

          <div className="form-section">
            <div className="form-section-title">Personal Information</div>
            <div className="form-grid">
              <Field {...fp} name="full_name"       label="Full Name"       required placeholder="Ravi Kumar" />
              <Field {...fp} name="phone"           label="Phone"           required placeholder="+91 98765 43210" />
              <Field {...fp} name="alternate_phone" label="Alternate Phone"          placeholder="+91 98765 00000" />
              <Field {...fp} name="email"           label="Email (optional)"         placeholder="ravi@example.com" type="email" />
              <Field {...fp} name="date_of_birth"   label="Date of Birth"            type="date" />
              <div className="field">
                <label>Gender</label>
                <select value={form.gender} onChange={e => setField('gender', e.target.value)}>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Identity</div>
            <div className="form-grid">
              <Field {...fp} name="aadhar_number" label="Aadhar Number" placeholder="XXXX XXXX XXXX" />
              <Field {...fp} name="pan_number"    label="PAN Number"    placeholder="ABCDE1234F" />
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Address</div>
            <div className="form-grid">
              <div className="field form-full">
                <label>Full Address</label>
                <textarea placeholder="Street, area, landmark" value={form.address} onChange={e => setField('address', e.target.value)} />
              </div>
              <Field {...fp} name="city"    label="City"    placeholder="Mumbai" />
              <Field {...fp} name="state"   label="State"   placeholder="Maharashtra" />
              <Field {...fp} name="pincode" label="Pincode" placeholder="400001" />
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Employment Details</div>
            <div className="form-grid">
              <Field {...fp} name="designation"  label="Designation"  placeholder="Helper / Cashier / Delivery Boy" />
              <Field {...fp} name="joining_date" label="Joining Date"  type="date" />
              <Field {...fp} name="salary"       label="Salary (₹)"   required type="number" placeholder="12000" />
              <div className="field">
                <label>Salary Type</label>
                <select value={form.salary_type} onChange={e => setField('salary_type', e.target.value)}>
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div className="field">
                <label>Employment Type</label>
                <select value={form.employment_type} onChange={e => setField('employment_type', e.target.value)}>
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="contract">Contract</option>
                </select>
              </div>
              <div className="field">
                <label>Shift</label>
                <select value={form.shift} onChange={e => setField('shift', e.target.value)}>
                  <option value="day">Day</option>
                  <option value="night">Night</option>
                  <option value="flexible">Flexible</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Documents (Required: Photo + Aadhar)</div>
            <div className="form-grid">
              <div>
                <FileUpload label="Profile Photo" required value={files.photo} onChange={v => setFile('photo', v)} accept="image/*" />
                {errors.photo && <span style={{ fontSize: 11, color: 'var(--error-text)' }}>{errors.photo}</span>}
              </div>
              <div>
                <FileUpload label="Aadhar Card Photo" required value={files.aadhar_photo} onChange={v => setFile('aadhar_photo', v)} />
                {errors.aadhar_photo && <span style={{ fontSize: 11, color: 'var(--error-text)' }}>{errors.aadhar_photo}</span>}
              </div>
              <FileUpload label="Other ID Proof (optional)" value={files.id_proof}  onChange={v => setFile('id_proof', v)} />
              <FileUpload label="Any Other Document"         value={files.other_doc} onChange={v => setFile('other_doc', v)} />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-sm btn-sm-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary btn-sm" style={{ padding: '9px 22px' }} onClick={handleSubmit} disabled={loading}>
            {loading ? '⏳ Submitting...' : '📤 Submit for Approval'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
