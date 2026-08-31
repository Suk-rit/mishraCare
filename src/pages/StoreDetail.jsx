import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import AddManagerModal from '../components/AddManagerModal';
import '../styles/stores.css';

// ── Doc viewer helper ─────────────────────────────────────────────────────────
function DocLink({ url, label }) {
  if (!url) return <span style={{ color: 'var(--label-4)', fontSize: 12 }}>Not uploaded</span>;
  const isPdf = url.toLowerCase().includes('.pdf');
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--blue)', fontWeight: 600, textDecoration: 'none', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, padding: '4px 10px' }}>
      {isPdf ? '📄' : '🖼️'} {label}
    </a>
  );
}

// ── Info row ──────────────────────────────────────────────────────────────────
function InfoCell({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--label-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: value ? 'var(--label-2)' : 'var(--label-4)', fontWeight: 500 }}>{value || '—'}</div>
    </div>
  );
}

// ── Status badge helper ───────────────────────────────────────────────────────
const STATUS_STYLE = {
  pending:  { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
  approved: { bg: '#DCFCE7', color: '#15803D', border: '#BBF7D0' },
  rejected: { bg: '#FEE2E2', color: '#B91C1C', border: '#FECACA' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.pending;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.3px', background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {status}
    </span>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title, count, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)' }}>{title}</span>
        {count !== undefined && (
          <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--bg-4)', color: 'var(--label-3)', padding: '2px 8px', borderRadius: 20 }}>{count}</span>
        )}
      </div>
      {action}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StoreDetail({ store, onBack, onStatsRefresh }) {
  const [tab,            setTab]           = useState('info');   // info | managers | employees
  const [managers,       setManagers]      = useState([]);
  const [employees,      setEmployees]     = useState([]);
  const [loading,        setLoading]       = useState(true);
  const [showAddMgr,     setShowAddMgr]    = useState(false);
  const [expandEmployee, setExpandEmployee]= useState(null);
  const [approving,      setApproving]     = useState(null);
  const [noteInput,      setNoteInput]     = useState('');
  const [showNoteFor,    setShowNoteFor]   = useState(null);

  useEffect(() => { fetchData(); }, [store.id]);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: mgrs }, { data: emps }] = await Promise.all([
      supabase.from('store_managers').select('*').eq('store_id', store.id).order('created_at'),
      supabase.from('employees').select('*, store_managers(full_name)').eq('store_id', store.id).order('created_at', { ascending: false }),
    ]);
    setManagers(mgrs || []);
    setEmployees(emps || []);
    setLoading(false);
  };

  const handleApprove = async (emp) => {
    setApproving(emp.id);
    await supabase.from('employees').update({ status: 'approved', is_active: true, reviewed_at: new Date().toISOString(), admin_note: null }).eq('id', emp.id);
    await fetchData();
    onStatsRefresh?.();
    setApproving(null);
  };

  const handleReject = async (emp) => {
    setApproving(emp.id);
    await supabase.from('employees').update({ status: 'rejected', is_active: false, reviewed_at: new Date().toISOString(), admin_note: noteInput || 'Rejected by admin' }).eq('id', emp.id);
    await fetchData();
    onStatsRefresh?.();
    setApproving(null);
    setShowNoteFor(null);
    setNoteInput('');
  };

  const pending  = employees.filter(e => e.status === 'pending');
  const approved = employees.filter(e => e.status === 'approved');
  const rejected = employees.filter(e => e.status === 'rejected');

  return (
    <div style={{ padding: '28px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Store header card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: 'var(--bg-2)', border: '1px solid var(--bg-4)', borderRadius: 'var(--radius-lg)', padding: '22px 24px', marginBottom: 24, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--accent-bg)', border: '1px solid rgba(255,59,48,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🏪</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--label)', letterSpacing: '-0.3px', marginBottom: 3 }}>{store.store_name}</div>
            <div style={{ fontSize: 13, color: 'var(--label-4)' }}>RDL: {store.rdl_number}{store.gstin ? ` · GST: ${store.gstin}` : ''}</div>
          </div>
          <span className={`badge ${store.is_active ? 'badge-active' : 'badge-inactive'}`}>{store.is_active ? 'Active' : 'Inactive'}</span>
        </div>
        {/* Info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14, marginTop: 20, padding: 16, background: 'var(--bg-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-4)' }}>
          <InfoCell label="Address" value={`${store.address_line1}${store.address_line2 ? ', ' + store.address_line2 : ''}`} />
          <InfoCell label="City / State" value={`${store.city}, ${store.state} — ${store.pincode}`} />
          <InfoCell label="Pharmacist" value={store.pharmacist_name} />
          <InfoCell label="Pharma Reg." value={store.pharmacist_registration} />
          <InfoCell label="Hours" value={store.is_24_hours ? '24 Hours' : `${store.opening_time || '09:00'} – ${store.closing_time || '21:00'}`} />
          <InfoCell label="Established" value={store.established_date ? new Date(store.established_date).toLocaleDateString('en-IN') : null} />
        </div>
        {/* Store documents */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>Store Documents</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <DocLink url={store.pharmacist_degree_url}  label="Pharmacist Degree" />
            <DocLink url={store.rent_agreement_url}     label="Rent Agreement" />
            <DocLink url={store.rdl_certificate_url}    label="RDL Certificate" />
            <DocLink url={store.gst_certificate_url}    label="GST Certificate" />
            <DocLink url={store.noc_url}                label="NOC" />
          </div>
        </div>
      </motion.div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg-2)', border: '1px solid var(--bg-4)', borderRadius: 12, padding: 4, marginBottom: 22, width: 'fit-content', boxShadow: 'var(--shadow-sm)' }}>
        {[
          { id: 'managers',  label: `👤 Managers (${managers.length})` },
          { id: 'employees', label: `👥 Employees (${approved.length})` },
          { id: 'pending',   label: `⏳ Pending (${pending.length})`, alert: pending.length > 0 },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, transition: 'all 0.18s', background: tab === t.id ? 'var(--bg-2)' : 'transparent', color: tab === t.id ? (t.alert ? '#FF9500' : 'var(--accent)') : 'var(--label-3)', boxShadow: tab === t.id ? 'var(--shadow-sm)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'var(--label-4)', padding: 40, textAlign: 'center' }}>Loading...</div>
      ) : (
        <AnimatePresence mode="wait">
          {/* MANAGERS TAB */}
          {tab === 'managers' && (
            <motion.div key="mgr" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <SectionHeader title="Store Managers" count={managers.length}
                action={<button onClick={() => setShowAddMgr(true)} style={{ background: 'linear-gradient(145deg,#FF3B30,#D93025)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add Manager</button>} />
              {managers.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 0' }}><div className="empty-state-icon">👤</div><div className="empty-state-title">No managers yet</div></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {managers.map(m => (
                    <div key={m.id} style={{ background: 'var(--bg-2)', border: '1px solid var(--bg-4)', borderRadius: 'var(--radius-md)', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#007AFF,#0056CC)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{m.full_name.slice(0,2).toUpperCase()}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)' }}>{m.full_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--label-4)', marginTop: 1 }}>{m.email} · {m.phone}</div>
                        <div style={{ fontSize: 12, color: 'var(--label-4)', marginTop: 1 }}>{m.designation} · {m.employment_type?.replace('_',' ')}{m.salary ? ` · ₹${Number(m.salary).toLocaleString()}/${m.salary_type === 'monthly' ? 'mo' : 'wk'}` : ''}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                        <span className={`badge ${m.is_active ? 'badge-active' : 'badge-inactive'}`}>{m.is_active ? 'Active' : 'Inactive'}</span>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <DocLink url={m.photo_url}       label="Photo" />
                          <DocLink url={m.aadhar_photo_url} label="Aadhar" />
                          <DocLink url={m.id_proof_url}    label="ID Proof" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* EMPLOYEES TAB */}
          {tab === 'employees' && (
            <motion.div key="emp" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <SectionHeader title="Active Employees" count={approved.length} />
              {approved.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 0' }}><div className="empty-state-icon">👥</div><div className="empty-state-title">No approved employees yet</div><div className="empty-state-sub">Employees approved by admin will appear here</div></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {approved.map(e => <EmployeeRow key={e.id} emp={e} expanded={expandEmployee === e.id} onToggle={() => setExpandEmployee(expandEmployee === e.id ? null : e.id)} />)}
                </div>
              )}
              {rejected.length > 0 && (
                <div style={{ marginTop: 28 }}>
                  <SectionHeader title="Rejected Requests" count={rejected.length} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {rejected.map(e => <EmployeeRow key={e.id} emp={e} expanded={expandEmployee === e.id} onToggle={() => setExpandEmployee(expandEmployee === e.id ? null : e.id)} />)}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* PENDING TAB */}
          {tab === 'pending' && (
            <motion.div key="pend" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <SectionHeader title="Pending Approval Requests" count={pending.length} />
              {pending.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 0' }}><div className="empty-state-icon">✅</div><div className="empty-state-title">All caught up!</div><div className="empty-state-sub">No pending employee requests</div></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {pending.map(e => (
                    <div key={e.id} style={{ background: 'var(--bg-2)', border: '1px solid #FDE68A', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                      {/* Header */}
                      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid var(--bg-4)' }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#FF9500,#CC7A00)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{e.full_name.slice(0,2).toUpperCase()}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)' }}>{e.full_name}</div>
                          <div style={{ fontSize: 12, color: 'var(--label-4)', marginTop: 2 }}>Submitted by: {e.store_managers?.full_name || 'Store Manager'} · {new Date(e.created_at).toLocaleDateString('en-IN')}</div>
                        </div>
                        <StatusBadge status={e.status} />
                      </div>
                      {/* Details grid */}
                      <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 14 }}>
                        <InfoCell label="Phone"       value={e.phone} />
                        <InfoCell label="Designation" value={e.designation} />
                        <InfoCell label="Employment"  value={e.employment_type?.replace('_',' ')} />
                        <InfoCell label="Salary"      value={e.salary ? `₹${Number(e.salary).toLocaleString()}/${e.salary_type === 'monthly' ? 'mo' : 'wk'}` : null} />
                        <InfoCell label="Shift"       value={e.shift} />
                        <InfoCell label="Joining"     value={e.joining_date ? new Date(e.joining_date).toLocaleDateString('en-IN') : null} />
                        {e.aadhar_number && <InfoCell label="Aadhar" value={`•••• ${e.aadhar_number.slice(-4)}`} />}
                        {e.address && <InfoCell label="Address" value={`${e.address}, ${e.city}`} />}
                      </div>
                      {/* Documents */}
                      <div style={{ padding: '0 20px 16px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Uploaded Documents</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          <DocLink url={e.photo_url}      label="Profile Photo" />
                          <DocLink url={e.aadhar_photo_url} label="Aadhar Card" />
                          <DocLink url={e.id_proof_url}   label="ID Proof" />
                          <DocLink url={e.other_doc_url}  label="Other Doc" />
                        </div>
                      </div>
                      {/* Rejection note input */}
                      {showNoteFor === e.id && (
                        <div style={{ padding: '0 20px 16px' }}>
                          <textarea placeholder="Reason for rejection (optional)" value={noteInput} onChange={ev => setNoteInput(ev.target.value)}
                            style={{ width: '100%', padding: '10px 13px', borderRadius: 10, border: '1.5px solid #FECACA', background: '#FFF1F0', color: 'var(--label)', fontFamily: 'inherit', fontSize: 13, outline: 'none', resize: 'vertical', minHeight: 70 }} />
                        </div>
                      )}
                      {/* Actions */}
                      <div style={{ padding: '14px 20px', background: 'var(--bg-3)', borderTop: '1px solid var(--bg-4)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        {showNoteFor === e.id ? (
                          <>
                            <button onClick={() => { setShowNoteFor(null); setNoteInput(''); }}
                              style={{ background: 'var(--bg-2)', border: '1px solid var(--bg-4)', color: 'var(--label-3)', padding: '8px 18px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Cancel</button>
                            <button onClick={() => handleReject(e)} disabled={approving === e.id}
                              style={{ background: '#B91C1C', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                              {approving === e.id ? 'Rejecting...' : 'Confirm Reject'}
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setShowNoteFor(e.id); setNoteInput(''); }}
                              style={{ background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FECACA', padding: '8px 18px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Reject</button>
                            <button onClick={() => handleApprove(e)} disabled={approving === e.id}
                              style={{ background: 'linear-gradient(145deg,#34C759,#28A745)', color: '#fff', border: 'none', padding: '8px 22px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, boxShadow: '0 2px 8px rgba(52,199,89,0.3)' }}>
                              {approving === e.id ? '⏳ Approving...' : '✓ Approve'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Add Manager modal */}
      <AnimatePresence>
        {showAddMgr && (
          <AddManagerModal store={store} onClose={() => setShowAddMgr(false)} onSuccess={() => { setShowAddMgr(false); fetchData(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Employee row (collapsed/expanded) ─────────────────────────────────────────
function EmployeeRow({ emp, expanded, onToggle }) {
  const s = STATUS_STYLE[emp.status] || STATUS_STYLE.pending;
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--bg-4)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <div onClick={onToggle} style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#5856D6,#3A38A0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{emp.full_name.slice(0,2).toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)' }}>{emp.full_name}</div>
          <div style={{ fontSize: 12, color: 'var(--label-4)', marginTop: 1 }}>{emp.designation} · {emp.phone}</div>
        </div>
        <StatusBadge status={emp.status} />
        <span style={{ fontSize: 16, color: 'var(--label-4)', marginLeft: 4 }}>{expanded ? '▲' : '▼'}</span>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '0 18px 16px', borderTop: '1px solid var(--bg-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginTop: 14, marginBottom: 14 }}>
                <InfoCell label="Email"       value={emp.email} />
                <InfoCell label="Alt Phone"   value={emp.alternate_phone} />
                <InfoCell label="Gender"      value={emp.gender} />
                <InfoCell label="Employment"  value={emp.employment_type?.replace('_',' ')} />
                <InfoCell label="Salary"      value={emp.salary ? `₹${Number(emp.salary).toLocaleString()}/${emp.salary_type === 'monthly' ? 'mo' : 'wk'}` : null} />
                <InfoCell label="Shift"       value={emp.shift} />
                <InfoCell label="Joining"     value={emp.joining_date ? new Date(emp.joining_date).toLocaleDateString('en-IN') : null} />
                <InfoCell label="Aadhar"      value={emp.aadhar_number ? `•••• ${emp.aadhar_number.slice(-4)}` : null} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Documents</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <DocLink url={emp.photo_url}       label="Photo" />
                <DocLink url={emp.aadhar_photo_url} label="Aadhar" />
                <DocLink url={emp.id_proof_url}    label="ID Proof" />
                <DocLink url={emp.other_doc_url}   label="Other" />
              </div>
              {emp.admin_note && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, fontSize: 13, color: '#92400E' }}>
                  <strong>Admin Note:</strong> {emp.admin_note}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
