import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../utils/supabase';
import { uploadFiles } from '../utils/storage';
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
  full_name: '', email: '', password: '', phone: '', alternate_phone: '',
  date_of_birth: '', gender: '', aadhar_number: '', pan_number: '',
  address: '', city: '', state: '', pincode: '',
  designation: 'Store Manager',
  joining_date: new Date().toISOString().split('T')[0],
  salary: '', salary_type: 'monthly', employment_type: 'full_time',
};

export default function AddManagerModal({ store, onClose, onSuccess }) {
  const [form,    setForm]    = useState(INITIAL);
  const [files,   setFiles]   = useState({ photo: null, aadhar_photo: null, id_proof: null });
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setFile  = (k, v) => setFiles(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = 'Required';
    if (!form.email.trim())     e.email     = 'Required';
    if (!form.password.trim())  e.password  = 'Required';
    if (!form.phone.trim())     e.phone     = 'Required';
    // Document requirements
    if (!files.photo)        e.photo        = 'Profile photo is required';
    if (!files.aadhar_photo) e.aadhar_photo = 'Aadhar card photo is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const urls = await uploadFiles('manager-documents', {
        photo:        files.photo,
        aadhar_photo: files.aadhar_photo,
        id_proof:     files.id_proof,
      }, `stores/${store.id}`);

      const { error } = await supabase.from('store_managers').insert({
        store_id:         store.id,
        full_name:        form.full_name.trim(),
        email:            form.email.trim().toLowerCase(),
        password:         form.password,
        phone:            form.phone.trim(),
        alternate_phone:  form.alternate_phone.trim() || null,
        date_of_birth:    form.date_of_birth || null,
        gender:           form.gender || null,
        aadhar_number:    form.aadhar_number.trim() || null,
        pan_number:       form.pan_number.trim().toUpperCase() || null,
        address:          form.address.trim() || null,
        city:             form.city.trim() || null,
        state:            form.state.trim() || null,
        pincode:          form.pincode.trim() || null,
        designation:      form.designation.trim() || 'Store Manager',
        joining_date:     form.joining_date || null,
        salary:           form.salary ? parseFloat(form.salary) : null,
        salary_type:      form.salary_type,
        employment_type:  form.employment_type,
        photo_url:        urls.photo,
        aadhar_photo_url: urls.aadhar_photo,
        id_proof_url:     urls.id_proof,
      });

      if (error) throw new Error(error.message);
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
        <div className="modal-header">
          <div>
            <div className="modal-title">👤 Add Store Manager</div>
            <div className="modal-sub">
              Adding manager to: <strong style={{ color: '#ef9a9a' }}>{store.store_name}</strong>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">

          {/* Login credentials */}
          <div className="form-section">
            <div className="form-section-title">Login Credentials</div>
            <div className="form-grid">
              <Field {...fp} name="email"    label="Email Address" required placeholder="manager@mishracare.com" type="email" />
              <Field {...fp} name="password" label="Password"      required placeholder="Set a strong password"  type="password" />
            </div>
          </div>

          {/* Personal info */}
          <div className="form-section">
            <div className="form-section-title">Personal Information</div>
            <div className="form-grid">
              <Field {...fp} name="full_name"       label="Full Name"       required placeholder="Rahul Sharma" />
              <Field {...fp} name="phone"           label="Phone"           required placeholder="+91 98765 43210" />
              <Field {...fp} name="alternate_phone" label="Alternate Phone"          placeholder="+91 98765 00000" />
              <Field {...fp} name="date_of_birth"   label="Date of Birth"   type="date" />
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

          {/* Identity */}
          <div className="form-section">
            <div className="form-section-title">Identity Documents</div>
            <div className="form-grid">
              <Field {...fp} name="aadhar_number" label="Aadhar Number" placeholder="XXXX XXXX XXXX" />
              <Field {...fp} name="pan_number"    label="PAN Number"    placeholder="ABCDE1234F" />
            </div>
          </div>

          {/* Address */}
          <div className="form-section">
            <div className="form-section-title">Residential Address</div>
            <div className="form-grid">
              <div className="field form-full">
                <label>Address</label>
                <textarea
                  placeholder="Full residential address"
                  value={form.address}
                  onChange={e => setField('address', e.target.value)}
                />
              </div>
              <Field {...fp} name="city"    label="City"    placeholder="Mumbai" />
              <Field {...fp} name="state"   label="State"   placeholder="Maharashtra" />
              <Field {...fp} name="pincode" label="Pincode" placeholder="400001" />
            </div>
          </div>

          {/* Employment */}
          <div className="form-section">
            <div className="form-section-title">Employment Details</div>
            <div className="form-grid">
              <Field {...fp} name="designation"  label="Designation"  placeholder="Store Manager" />
              <Field {...fp} name="joining_date" label="Joining Date" type="date" />
              <Field {...fp} name="salary"       label="Salary (₹)"   type="number" placeholder="25000" />
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
            </div>
          </div>

          {/* Documents */}
          <div className="form-section">
            <div className="form-section-title">Documents & Photos</div>
            <div className="form-grid">
              <div>
                <FileUpload label="Profile Photo" required value={files.photo} onChange={v => setFile('photo', v)} accept="image/*" />
                {errors.photo && <span style={{ fontSize: 11, color: 'var(--error-text)' }}>{errors.photo}</span>}
              </div>
              <div>
                <FileUpload label="Aadhar Card Photo" required value={files.aadhar_photo} onChange={v => setFile('aadhar_photo', v)} />
                {errors.aadhar_photo && <span style={{ fontSize: 11, color: 'var(--error-text)' }}>{errors.aadhar_photo}</span>}
              </div>
              <FileUpload label="Other ID Proof (optional)" value={files.id_proof} onChange={v => setFile('id_proof', v)} />
            </div>
          </div>

        </div>

        <div className="modal-footer">
          <button className="btn-sm btn-sm-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary btn-sm"
            style={{ padding: '9px 20px' }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? '⏳ Saving...' : '✓ Add Manager'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
