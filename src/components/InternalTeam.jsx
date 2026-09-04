import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import { uploadFiles } from '../utils/storage';
import { runValidations, validateRequired, validatePhone, validateSalary } from '../utils/validators';

export default function InternalTeam() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    full_name: '',
    designation: '',
    salary: '',
    bank_holder_name: '',
    bank_name: '',
    bank_account_no: '',
    bank_ifsc: '',
    bank_branch: '',
    upi_id: '',
    address: '',
    phone: '',
    email: '',
  });
  
  const [documents, setDocuments] = useState({
    aadhar_photo: null,
    pan_photo: null,
    id_proof: null,
    other_doc: null,
  });

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('internal_team')
        .select('*')
        .order('created_at', { ascending: false });
      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching internal team:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const errs = runValidations({
      full_name:   () => validateRequired(form.full_name, 'Full name'),
      designation: () => validateRequired(form.designation, 'Designation'),
      phone:       () => validatePhone(form.phone),
      salary:      () => validateSalary(form.salary),
      aadhar_photo:() => !documents.aadhar_photo ? 'Aadhaar card photo is required' : null,
      pan_photo:   () => !documents.pan_photo    ? 'PAN card photo is required'     : null,
    });
    if (Object.keys(errs).length) {
      // Show first error as alert for internal team (simple inline form, no Field component)
      alert(Object.values(errs)[0]);
      return;
    }
    setSaving(true);
    try {
      const urls = await uploadFiles('internal-team-docs', documents, 'internal-team');
      
      const { error } = await supabase.from('internal_team').insert({
        full_name: form.full_name.trim(),
        designation: form.designation.trim(),
        salary: parseFloat(form.salary) || 0,
        bank_holder_name: form.bank_holder_name.trim() || null,
        bank_name: form.bank_name.trim() || null,
        bank_account_no: form.bank_account_no.trim() || null,
        bank_ifsc: form.bank_ifsc.trim() || null,
        bank_branch: form.bank_branch.trim() || null,
        upi_id: form.upi_id.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        aadhar_photo_url: urls.aadhar_photo || null,
        pan_photo_url: urls.pan_photo || null,
        id_proof_url: urls.id_proof || null,
        other_doc_url: urls.other_doc || null,
        is_active: true,
      });

      if (error) throw error;
      setShowAddForm(false);
      resetForm();
      fetchMembers();
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSalary = async (memberId, newSalary) => {
    try {
      const { error } = await supabase
        .from('internal_team')
        .update({ salary: parseFloat(newSalary) || 0 })
        .eq('id', memberId);
      
      if (error) throw error;
      fetchMembers();
      setEditingMember(null);
    } catch (error) {
      alert('Error updating salary: ' + error.message);
    }
  };

  const handleToggleActive = async (member) => {
    try {
      const { error } = await supabase
        .from('internal_team')
        .update({ is_active: !member.is_active })
        .eq('id', member.id);
      
      if (error) throw error;
      fetchMembers();
    } catch (error) {
      alert('Error updating status: ' + error.message);
    }
  };

  const resetForm = () => {
    setForm({
      full_name: '',
      designation: '',
      salary: '',
      bank_holder_name: '',
      bank_name: '',
      bank_account_no: '',
      bank_ifsc: '',
      bank_branch: '',
      upi_id: '',
      address: '',
      phone: '',
      email: '',
    });
    setDocuments({
      aadhar_photo: null,
      pan_photo: null,
      id_proof: null,
      other_doc: null,
    });
  };

  const formatSalary = (salary) => '₹' + Number(salary || 0).toLocaleString('en-IN');

  const totalMonthlySalary = members
    .filter(m => m.is_active)
    .reduce((sum, m) => sum + (m.salary || 0), 0);

  if (loading) {
    return (
      <div style={{ textAlign:'center', padding:60, color:'var(--label-4)', fontSize:14 }}>
        Loading internal team…
      </div>
    );
  }

  return (
    <div style={{ fontFamily:"'Inter',-apple-system,sans-serif" }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:24, fontWeight:800, color:'var(--label)', letterSpacing:'-0.3px', marginBottom:6 }}>
            🌟 Internal Team
          </div>
          <div style={{ fontSize:14, color:'var(--label-4)' }}>
            Core team members with complete financial details
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          style={{
            padding:'12px 24px',
            background:'linear-gradient(135deg,#FF6B6B,#FF8E53)',
            color:'#fff',
            border:'none',
            borderRadius:12,
            fontSize:14,
            fontWeight:700,
            cursor:'pointer',
            fontFamily:'inherit',
            boxShadow:'0 4px 16px rgba(255,107,107,0.3)'
          }}
        >
          + Add Member
        </button>
      </div>

      {/* Total Salary Card */}
      <motion.div
        initial={{ opacity:0, y:10 }}
        animate={{ opacity:1, y:0 }}
        style={{
          background:'linear-gradient(135deg,#667eea,#764ba2)',
          borderRadius:16,
          padding:'24px 28px',
          marginBottom:24,
          boxShadow:'0 8px 24px rgba(102,126,234,0.25)'
        }}
      >
        <div style={{ fontSize:13, fontWeight:600, color:'#E0E7FF', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:8 }}>
          Total Monthly Salary
        </div>
        <div style={{ fontSize:42, fontWeight:800, color:'#fff', lineHeight:1 }}>
          {formatSalary(totalMonthlySalary)}
        </div>
        <div style={{ fontSize:13, color:'#E0E7FF', marginTop:4 }}>
          {members.filter(m => m.is_active).length} active members
        </div>
      </motion.div>

      {/* Members Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:16 }}>
        {members.map((member, index) => (
          <motion.div
            key={member.id}
            initial={{ opacity:0, y:10 }}
            animate={{ opacity:1, y:0 }}
            transition={{ delay: index * 0.05 }}
            style={{
              background: member.is_active ? 'linear-gradient(135deg,#fff5f5,#fff0f0)' : '#F5F5F5',
              border: member.is_active ? '2px solid #FF6B6B' : '1px solid #E0E0E0',
              borderRadius:16,
              padding:20,
              boxShadow:'0 4px 16px rgba(0,0,0,0.08)',
              opacity: member.is_active ? 1 : 0.6
            }}
          >
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <div style={{
                width:56, height:56, borderRadius:'50%',
                background: member.is_active ? 'linear-gradient(135deg,#FF6B6B,#FF8E53)' : '#999',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:20, fontWeight:700, color:'#fff'
              }}>
                {member.full_name.slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:16, fontWeight:700, color:'var(--label)', marginBottom:2 }}>
                  {member.full_name}
                </div>
                <div style={{ fontSize:12, color:'var(--label-4)' }}>
                  {member.designation}
                </div>
              </div>
              <button
                onClick={() => handleToggleActive(member)}
                style={{
                  padding:'6px 12px',
                  borderRadius:20,
                  border:'none',
                  cursor:'pointer',
                  fontSize:11,
                  fontWeight:600,
                  background: member.is_active ? '#FEE2E2' : '#DCFCE7',
                  color: member.is_active ? '#B91C1C' : '#15803D'
                }}
              >
                {member.is_active ? 'Inactive' : 'Active'}
              </button>
            </div>

            {/* Salary */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--label-4)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:4 }}>
                Monthly Salary
              </div>
              {editingMember === member.id ? (
                <div style={{ display:'flex', gap:8 }}>
                  <input
                    type="number"
                    defaultValue={member.salary}
                    onBlur={(e) => handleUpdateSalary(member.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUpdateSalary(member.id, e.target.value);
                      }
                    }}
                    autoFocus
                    style={{
                      flex:1,
                      padding:'8px 12px',
                      border:'1.5px solid #FF6B6B',
                      borderRadius:8,
                      fontSize:14,
                      fontWeight:700,
                      color:'#FF6B6B'
                    }}
                  />
                  <button
                    onClick={() => setEditingMember(null)}
                    style={{ padding:'8px 12px', background:'#E0E0E0', border:'none', borderRadius:8, cursor:'pointer' }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => setEditingMember(member.id)}
                  style={{ 
                    fontSize:24, 
                    fontWeight:800, 
                    color:'#FF6B6B',
                    cursor:'pointer',
                    display:'flex',
                    alignItems:'center',
                    gap:8
                  }}
                >
                  {formatSalary(member.salary)}
                  <span style={{ fontSize:12, fontWeight:500, color:'#999' }}>✎</span>
                </div>
              )}
            </div>

            {/* Contact Info */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--label-4)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:6 }}>
                Contact
              </div>
              {member.phone && (
                <div style={{ fontSize:13, color:'var(--label-2)', marginBottom:3 }}>
                  📞 {member.phone}
                </div>
              )}
              {member.email && (
                <div style={{ fontSize:13, color:'var(--label-2)', marginBottom:3 }}>
                  ✉️ {member.email}
                </div>
              )}
              {member.address && (
                <div style={{ fontSize:12, color:'var(--label-3)', marginTop:4 }}>
                  📍 {member.address}
                </div>
              )}
            </div>

            {/* Bank Details */}
            {(member.bank_name || member.upi_id) && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--label-4)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:6 }}>
                  Bank Details
                </div>
                {member.bank_name && (
                  <div style={{ fontSize:12, color:'var(--label-2)', marginBottom:2 }}>
                    🏦 {member.bank_name}
                  </div>
                )}
                {member.bank_account_no && (
                  <div style={{ fontSize:12, color:'var(--label-2)', marginBottom:2 }}>
                    A/C: {member.bank_account_no}
                  </div>
                )}
                {member.bank_ifsc && (
                  <div style={{ fontSize:12, color:'var(--label-2)', marginBottom:2 }}>
                    IFSC: {member.bank_ifsc}
                  </div>
                )}
                {member.upi_id && (
                  <div style={{ fontSize:12, color:'var(--label-2)' }}>
                    💳 UPI: {member.upi_id}
                  </div>
                )}
              </div>
            )}

            {/* Documents */}
            {(member.aadhar_photo_url || member.pan_photo_url || member.id_proof_url) && (
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--label-4)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:6 }}>
                  Documents
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {member.aadhar_photo_url && (
                    <a href={member.aadhar_photo_url} target="_blank" rel="noreferrer"
                      style={{ padding:'4px 10px', background:'#FEE2E2', color:'#B91C1C', borderRadius:6, fontSize:11, fontWeight:600, textDecoration:'none' }}>
                      Aadhar
                    </a>
                  )}
                  {member.pan_photo_url && (
                    <a href={member.pan_photo_url} target="_blank" rel="noreferrer"
                      style={{ padding:'4px 10px', background:'#FEF3C7', color:'#92400E', borderRadius:6, fontSize:11, fontWeight:600, textDecoration:'none' }}>
                      PAN
                    </a>
                  )}
                  {member.id_proof_url && (
                    <a href={member.id_proof_url} target="_blank" rel="noreferrer"
                      style={{ padding:'4px 10px', background:'#DBEAFE', color:'#1D4ED8', borderRadius:6, fontSize:11, fontWeight:600, textDecoration:'none' }}>
                      ID Proof
                    </a>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {members.length === 0 && (
        <div style={{ textAlign:'center', padding:60, background:'var(--bg-2)', borderRadius:16, border:'1px solid var(--bg-4)' }}>
          <div style={{ fontSize:48, opacity:0.2, marginBottom:16 }}>🌟</div>
          <div style={{ fontSize:16, fontWeight:700, color:'var(--label-3)', marginBottom:6 }}>
            No internal team members
          </div>
          <div style={{ fontSize:13, color:'var(--label-4)' }}>
            Click "Add Member" to build your internal team
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      <AnimatePresence>
        {showAddForm && (
          <div style={{ position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.5)',
            backdropFilter:'blur(8px)',display:'flex',alignItems:'center',
            justifyContent:'center',padding:20 }}
            onClick={e => e.target===e.currentTarget && setShowAddForm(false)}>
            <motion.div initial={{ opacity:0,scale:0.95,y:20 }}
              animate={{ opacity:1,scale:1,y:0 }} exit={{ opacity:0,scale:0.95,y:20 }}
              style={{ background:'#fff',border:'1px solid #E0E0E0',
                borderRadius:20,width:'100%',maxWidth:600,
                boxShadow:'0 20px 60px rgba(0,0,0,0.2)',overflow:'hidden' }}>
              <div style={{ padding:'24px 28px',borderBottom:'1px solid #E0E0E0',
                background:'linear-gradient(135deg,#FF6B6B,#FF8E53)',
                display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:18,fontWeight:700,color:'#fff' }}>➕ Add Internal Team Member</div>
                  <div style={{ fontSize:13,color:'#FFE5E5',marginTop:2 }}>Complete financial & personal details</div>
                </div>
                <button onClick={() => setShowAddForm(false)}
                  style={{ width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,0.2)',
                    border:'none',cursor:'pointer',fontSize:16,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
              </div>
              <form onSubmit={handleAdd} style={{ padding:'28px',display:'flex',flexDirection:'column',gap:16,maxHeight:'70vh',overflowY:'auto' }}>
                
                {/* Personal Info */}
                <div>
                  <div style={{ fontSize:11,fontWeight:700,color:'#FF6B6B',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:10 }}>
                    Personal Information
                  </div>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
                    <div>
                      <label style={{ fontSize:12,fontWeight:600,color:'var(--label-3)',display:'block',marginBottom:4 }}>Full Name *</label>
                      <input value={form.full_name} onChange={e => setForm({...form, full_name:e.target.value})}
                        style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #E0E0E0',borderRadius:8,fontSize:13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize:12,fontWeight:600,color:'var(--label-3)',display:'block',marginBottom:4 }}>Designation *</label>
                      <input value={form.designation} onChange={e => setForm({...form, designation:e.target.value})}
                        style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #E0E0E0',borderRadius:8,fontSize:13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize:12,fontWeight:600,color:'var(--label-3)',display:'block',marginBottom:4 }}>Phone *</label>
                      <input value={form.phone} onChange={e => setForm({...form, phone:e.target.value})}
                        style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #E0E0E0',borderRadius:8,fontSize:13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize:12,fontWeight:600,color:'var(--label-3)',display:'block',marginBottom:4 }}>Email</label>
                      <input type="email" value={form.email} onChange={e => setForm({...form, email:e.target.value})}
                        style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #E0E0E0',borderRadius:8,fontSize:13 }} />
                    </div>
                  </div>
                  <div style={{ marginTop:12 }}>
                    <label style={{ fontSize:12,fontWeight:600,color:'var(--label-3)',display:'block',marginBottom:4 }}>Address</label>
                    <textarea value={form.address} onChange={e => setForm({...form, address:e.target.value})}
                      style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #E0E0E0',borderRadius:8,fontSize:13,minHeight:60 }} />
                  </div>
                </div>

                {/* Salary */}
                <div>
                  <div style={{ fontSize:11,fontWeight:700,color:'#FF6B6B',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:10 }}>
                    Salary Information
                  </div>
                  <div>
                    <label style={{ fontSize:12,fontWeight:600,color:'var(--label-3)',display:'block',marginBottom:4 }}>Monthly Salary (₹) *</label>
                    <input required type="number" value={form.salary} onChange={e => setForm({...form, salary:e.target.value})}
                      style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #E0E0E0',borderRadius:8,fontSize:13 }} />
                  </div>
                </div>

                {/* Bank Details */}
                <div>
                  <div style={{ fontSize:11,fontWeight:700,color:'#FF6B6B',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:10 }}>
                    Bank Details
                  </div>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
                    <div>
                      <label style={{ fontSize:12,fontWeight:600,color:'var(--label-3)',display:'block',marginBottom:4 }}>Account Holder Name</label>
                      <input value={form.bank_holder_name} onChange={e => setForm({...form, bank_holder_name:e.target.value})}
                        style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #E0E0E0',borderRadius:8,fontSize:13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize:12,fontWeight:600,color:'var(--label-3)',display:'block',marginBottom:4 }}>Bank Name</label>
                      <input value={form.bank_name} onChange={e => setForm({...form, bank_name:e.target.value})}
                        style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #E0E0E0',borderRadius:8,fontSize:13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize:12,fontWeight:600,color:'var(--label-3)',display:'block',marginBottom:4 }}>Account Number</label>
                      <input value={form.bank_account_no} onChange={e => setForm({...form, bank_account_no:e.target.value})}
                        style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #E0E0E0',borderRadius:8,fontSize:13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize:12,fontWeight:600,color:'var(--label-3)',display:'block',marginBottom:4 }}>IFSC Code</label>
                      <input value={form.bank_ifsc} onChange={e => setForm({...form, bank_ifsc:e.target.value})}
                        style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #E0E0E0',borderRadius:8,fontSize:13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize:12,fontWeight:600,color:'var(--label-3)',display:'block',marginBottom:4 }}>Branch</label>
                      <input value={form.bank_branch} onChange={e => setForm({...form, bank_branch:e.target.value})}
                        style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #E0E0E0',borderRadius:8,fontSize:13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize:12,fontWeight:600,color:'var(--label-3)',display:'block',marginBottom:4 }}>UPI ID</label>
                      <input value={form.upi_id} onChange={e => setForm({...form, upi_id:e.target.value})}
                        style={{ width:'100%',padding:'10px 12px',border:'1.5px solid #E0E0E0',borderRadius:8,fontSize:13 }} />
                    </div>
                  </div>
                </div>

                {/* Documents */}
                <div>
                  <div style={{ fontSize:11,fontWeight:700,color:'#FF6B6B',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:10 }}>
                    Documents
                  </div>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
                    {[
                      { key:'aadhar_photo', label:'Aadhaar Card *' },
                      { key:'pan_photo', label:'PAN Card *' },
                      { key:'id_proof', label:'ID Proof' },
                      { key:'other_doc', label:'Other Document' },
                    ].map(doc => (
                      <div key={doc.key}>
                        <label style={{ fontSize:12,fontWeight:600,color:'var(--label-3)',display:'block',marginBottom:4 }}>{doc.label}</label>
                        {!documents[doc.key] ? (
                          <label style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'10px',
                            border:'2px dashed #E0E0E0',borderRadius:8,cursor:'pointer',background:'#FAFAFA',fontSize:12,color:'#666' }}>
                            📎 Choose file
                            <input type="file" accept="image/*,application/pdf" style={{ display:'none' }}
                              onChange={e => {
                                const file = e.target.files[0];
                                if (file) setDocuments({...documents, [doc.key]: file});
                              }} />
                          </label>
                        ) : (
                          <div style={{ display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'#DCFCE7',
                            borderRadius:8,border:'1px solid #BBF7D0',fontSize:11 }}>
                            <span>✓</span>
                            <span style={{ flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{documents[doc.key].name}</span>
                            <button type="button" onClick={() => setDocuments({...documents, [doc.key]:null})}
                              style={{ background:'none',border:'none',cursor:'pointer',color:'#B91C1C' }}>✕</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display:'flex',gap:10,justifyContent:'flex-end',marginTop:8 }}>
                  <button type="button" onClick={() => setShowAddForm(false)}
                    style={{ padding:'10px 20px',background:'#F5F5F5',border:'1px solid #E0E0E0',
                      color:'#666',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={saving}
                    style={{ padding:'10px 24px',background:'linear-gradient(135deg,#FF6B6B,#FF8E53)',
                      color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer',
                      boxShadow:'0 4px 12px rgba(255,107,107,0.3)' }}>
                    {saving ? '⏳ Adding…' : '+ Add Member'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
