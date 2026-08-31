import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getSession, clearSession } from '../utils/session';
import { supabase } from '../utils/supabase';
import { uploadFiles } from '../utils/storage';
import Stores from './Stores';
import StoreDetail from './StoreDetail';
import Inventory from './Inventory';
import AddStock from './AddStock';
import IssueResolution from './IssueResolution';
import AdminAnalytics from './AdminAnalytics';
import FileUpload from '../components/FileUpload';
import '../styles/login.css';
import '../styles/stores.css';

const NAV = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard'  },
  { id: 'stores',    icon: '🏪', label: 'Stores'     },
  { id: 'inventory', icon: '🗄️',  label: 'Inventory'  },
  { id: 'add-stock', icon: '📥', label: 'Add Stock'  },
  { id: 'billing',   icon: '🧾', label: 'Billing'    },
  { id: 'analytics', icon: '📈', label: 'Analytics'  },
  { id: 'issues',    icon: '⚠️',  label: 'Issues'     },
  { id: 'staff',     icon: '👥', label: 'Staff'      },
  { id: 'settings',  icon: '⚙️',  label: 'Settings'  },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const session  = getSession();

  const [active,       setActive]       = useState('dashboard');
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [selectedStore,setSelectedStore]= useState(null); // store object for detail view
  const [stats,        setStats]        = useState({ stores: '—', managers: '—', employees: '—', pending: '—' });

  useEffect(() => {
    if (!session || session.role !== 'admin') {
      navigate('/login', { replace: true });
      return;
    }
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const [
      { count: storeCount },
      { count: managerCount },
      { count: employeeCount },
      { count: pendingCount },
      { count: medicineCount },
    ] = await Promise.all([
      supabase.from('stores').select('*', { count: 'exact', head: true }),
      supabase.from('store_managers').select('*', { count: 'exact', head: true }),
      supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('medicines').select('*', { count: 'exact', head: true }).eq('is_active', true),
    ]);
    setStats({
      stores:    storeCount    ?? 0,
      managers:  managerCount  ?? 0,
      employees: employeeCount ?? 0,
      pending:   pendingCount  ?? 0,
      medicines: medicineCount ?? 0,
    });  };

  const handleLogout = () => { clearSession(); navigate('/login', { replace: true }); };

  if (!session) return null;

  const initials = (session.name || session.email).slice(0, 2).toUpperCase();

  // When a store card is clicked from the Stores list
  const handleStoreSelect = (store) => {
    setSelectedStore(store);
    setActive('store-detail');
  };

  const OVERVIEW_CARDS = [
    { icon: '🏪', title: 'Total Stores',      value: stats.stores,    sub: 'Pharmacy branches',    color: '#FF3B30', bg: '#FFF1F0', nav: 'stores'    },
    { icon: '👤', title: 'Store Managers',     value: stats.managers,  sub: 'Across all stores',    color: '#007AFF', bg: '#EFF6FF', nav: 'stores'    },
    { icon: '💊', title: 'Products',           value: stats.medicines, sub: 'Active in catalog',    color: '#34C759', bg: '#F0FDF4', nav: 'inventory' },    { icon: '⏳', title: 'Pending Approvals',  value: stats.pending,   sub: 'Awaiting your review', color: '#FF9500', bg: '#FFFBEB', nav: 'stores'    },
  ];

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: 'var(--bg)',
      fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      color: 'var(--label)',
    }}>
      {/* ── Sidebar ── */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 216 : 64 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderRight: '1px solid var(--bg-4)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', flexShrink: 0,
          position: 'sticky', top: 0, height: '100vh',
        }}
      >
        <div style={{ padding: '18px 14px 16px', borderBottom: '1px solid var(--bg-4)', display: 'flex', alignItems: 'center', gap: 10, minHeight: 56 }}>
          <div style={{ width: 34, height: 34, flexShrink: 0, background: 'linear-gradient(145deg,#FF3B30,#C0392B)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, boxShadow: '0 3px 10px rgba(255,59,48,0.28)' }}>💊</div>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap', color: 'var(--label)', letterSpacing: '-0.3px' }}>
                Mishra<span style={{ color: 'var(--accent)' }}>Care</span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {NAV.map(item => (
            <button key={item.id}
              onClick={() => { setActive(item.id); setSelectedStore(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: sidebarOpen ? '9px 12px' : '9px',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                borderRadius: 10, border: 'none', cursor: 'pointer',
                background: active === item.id ? 'var(--accent-bg)' : 'transparent',
                color: active === item.id ? 'var(--accent)' : 'var(--label-3)',
                fontSize: 13.5, fontWeight: active === item.id ? 600 : 500,
                transition: 'all 0.18s', fontFamily: 'inherit',
              }}>
              <span style={{ fontSize: 17, flexShrink: 0 }}>{item.icon}</span>
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ whiteSpace: 'nowrap' }}>
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          ))}
        </nav>

        <button onClick={() => setSidebarOpen(o => !o)}
          style={{ margin: '8px', padding: '9px', background: 'var(--bg-3)', border: '1px solid var(--bg-4)', borderRadius: 10, cursor: 'pointer', color: 'var(--label-4)', fontSize: 13, transition: 'all 0.18s', fontFamily: 'inherit' }}>
          {sidebarOpen ? '◀' : '▶'}
        </button>
      </motion.aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Top bar */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 56, background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', borderBottom: '1px solid var(--bg-4)', flexShrink: 0, position: 'sticky', top: 0, zIndex: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: 'var(--label)' }}>
            {active === 'store-detail' && (
              <button onClick={() => { setActive('stores'); setSelectedStore(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
                ← Stores
              </button>
            )}
            {active === 'store-detail' && <span style={{ color: 'var(--label-4)' }}>/</span>}
            <span>{active === 'store-detail' ? selectedStore?.store_name : NAV.find(n => n.id === active)?.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#FF3B30,#C0392B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', boxShadow: '0 2px 8px rgba(255,59,48,0.25)' }}>{initials}</div>
            <span style={{ fontSize: 13, color: 'var(--label-2)', fontWeight: 500 }}>{session.name || session.email}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid rgba(255,59,48,0.18)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Admin</span>
            <button onClick={handleLogout}
              style={{ background: 'var(--bg-3)', border: '1px solid var(--bg-4)', color: 'var(--label-3)', padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
              onMouseEnter={e => { e.target.style.background = '#FEE2E2'; e.target.style.color = '#B91C1C'; }}
              onMouseLeave={e => { e.target.style.background = 'var(--bg-3)'; e.target.style.color = 'var(--label-3)'; }}>
              Logout
            </button>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
          <AnimatePresence mode="wait">

            {/* Dashboard overview */}
            {active === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ padding: '32px 28px', maxWidth: 1100, margin: '0 auto' }}>
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--label)', letterSpacing: '-0.4px', marginBottom: 4 }}>
                    Good day, <span style={{ color: 'var(--accent)' }}>{session.name || 'Admin'}</span> 👋
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--label-4)' }}>Here's your MishraCare ERP overview.</div>
                </div>

                {/* Live stat cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 14, marginBottom: 32 }}>
                  {OVERVIEW_CARDS.map((card, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                      onClick={() => card.nav && setActive(card.nav)}
                      style={{ background: card.bg, border: `1px solid ${card.color}22`, borderRadius: 'var(--radius-md)', padding: '20px 22px', cursor: card.nav ? 'pointer' : 'default', boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s' }}>
                      <div style={{ fontSize: 26, marginBottom: 10 }}>{card.icon}</div>
                      <div style={{ fontSize: 12, color: 'var(--label-4)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{card.title}</div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
                      <div style={{ fontSize: 12, color: 'var(--label-4)', marginTop: 4 }}>{card.sub}</div>
                    </motion.div>
                  ))}
                </div>

                {/* Quick actions */}
                <div style={{ background: 'var(--bg-2)', border: '1px solid var(--bg-4)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ fontSize: 11, color: 'var(--label-4)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700, marginBottom: 14 }}>Quick Actions</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {[
                      { label: '🏪  Add Store',   action: () => setActive('stores')     },
                      { label: '📥  Add Stock',   action: () => setActive('add-stock')  },
                      { label: '🗄️  Inventory',   action: () => setActive('inventory')  },
                      { label: '⏳  Approvals',   action: () => setActive('stores')     },
                    ].map((a, i) => (
                      <button key={i} onClick={a.action}
                        style={{ background: 'var(--bg-3)', border: '1px solid var(--bg-4)', color: 'var(--label-2)', padding: '9px 18px', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, boxShadow: 'var(--shadow-sm)' }}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Stores list */}
            {active === 'stores' && (
              <motion.div key="stores" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Stores onStoreClick={handleStoreSelect} />
              </motion.div>
            )}

            {/* Store detail */}
            {active === 'store-detail' && selectedStore && (
              <motion.div key="store-detail" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <StoreDetail store={selectedStore} onBack={() => { setActive('stores'); setSelectedStore(null); }} onStatsRefresh={fetchStats} />
              </motion.div>
            )}

            {/* Products / Inventory */}
            {active === 'inventory' && (
              <motion.div key="inventory" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Inventory />
              </motion.div>
            )}

            {/* Add Stock */}
            {active === 'add-stock' && (
              <motion.div key="add-stock" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <AddStock />
              </motion.div>
            )}

            {/* Analytics */}
            {active === 'analytics' && (
              <motion.div key="analytics" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <AdminAnalytics />
              </motion.div>
            )}

            {/* Issues */}
            {active === 'issues' && (
              <motion.div key="issues" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <IssueResolution />
              </motion.div>
            )}

            {/* Staff tab — admin warehouse team */}
            {active === 'staff' && (
              <motion.div key="staff" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <AdminStaffTab adminId={session?.adminId} adminEmail={session?.email} />
              </motion.div>
            )}

            {/* Coming soon */}
            {!['dashboard', 'stores', 'store-detail', 'inventory', 'add-stock', 'analytics', 'issues', 'staff'].includes(active) && (
              <motion.div key={active} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ padding: '80px 28px', textAlign: 'center' }}>
                <div style={{ fontSize: 52, marginBottom: 14, opacity: 0.3 }}>{NAV.find(n => n.id === active)?.icon}</div>
                <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--label-3)', marginBottom: 6 }}>{NAV.find(n => n.id === active)?.label} — Coming Soon</div>
                <div style={{ fontSize: 14, color: 'var(--label-4)' }}>This module is being built.</div>
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// ── AdminStaffTab — admin adds warehouse/office team → sent to Devta ──────────
const STAFF_INITIAL = {
  full_name:'', phone:'', alternate_phone:'', email:'',
  date_of_birth:'', gender:'', aadhar_number:'', pan_number:'',
  address:'', city:'', state:'', pincode:'',
  designation:'Warehouse Staff', employment_type:'full_time',
  joining_date: new Date().toISOString().split('T')[0],
  salary:'', salary_type:'monthly', shift:'day',
};

function AdminStaffTab({ adminEmail }) {
  const [team,        setTeam]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState(STAFF_INITIAL);
  const [files,       setFiles]       = useState({ photo:null, aadhar_photo:null, id_proof:null });
  const [errors,      setErrors]      = useState({});
  const [saving,      setSaving]      = useState(false);
  const [adminId,     setAdminId]     = useState(null);

  useEffect(() => {
    if (!adminEmail) return;
    supabase.from('admins').select('id').eq('email', adminEmail).single()
      .then(({ data }) => {
        if (data?.id) { setAdminId(data.id); fetchTeam(data.id); }
      });
  }, [adminEmail]);

  const fetchTeam = async (id) => {
    setLoading(true);
    const { data } = await supabase.from('admin_team').select('*').eq('admin_id', id).order('created_at', { ascending: false });
    setTeam(data || []);
    setLoading(false);
  };

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setFile = (k, v) => setFiles(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = 'Required';
    if (!form.phone.trim())     e.phone     = 'Required';
    if (!form.salary)           e.salary    = 'Required';
    if (!files.photo)           e.photo     = 'Profile photo required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !adminId) return;
    setSaving(true);
    try {
      const urls = await uploadFiles('admin-team-documents', {
        photo: files.photo, aadhar_photo: files.aadhar_photo, id_proof: files.id_proof,
      }, `admin/${adminId}`);

      const { error } = await supabase.from('admin_team').insert({
        admin_id:        adminId,
        full_name:       form.full_name.trim(),
        phone:           form.phone.trim(),
        alternate_phone: form.alternate_phone.trim() || null,
        email:           form.email.trim() || null,
        date_of_birth:   form.date_of_birth || null,
        gender:          form.gender || null,
        aadhar_number:   form.aadhar_number.trim() || null,
        pan_number:      form.pan_number.trim().toUpperCase() || null,
        address:         form.address.trim() || null,
        city:            form.city.trim() || null,
        state:           form.state.trim() || null,
        pincode:         form.pincode.trim() || null,
        designation:     form.designation.trim() || 'Warehouse Staff',
        employment_type: form.employment_type,
        joining_date:    form.joining_date || null,
        salary:          form.salary ? parseFloat(form.salary) : null,
        salary_type:     form.salary_type,
        shift:           form.shift,
        photo_url:       urls.photo,
        aadhar_photo_url:urls.aadhar_photo,
        id_proof_url:    urls.id_proof,
        status:          'pending',
        is_active:       false,
      });
      if (error) throw new Error(error.message);
      setShowForm(false);
      setForm(STAFF_INITIAL);
      setFiles({ photo:null, aadhar_photo:null, id_proof:null });
      fetchTeam(adminId);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const STATUS_COLORS = {
    pending:  { bg:'#FEF3C7', color:'#92400E' },
    approved: { bg:'#DCFCE7', color:'#15803D' },
    rejected: { bg:'#FEE2E2', color:'#B91C1C' },
  };

  return (
    <div style={{ padding:'24px 28px', maxWidth:900, margin:'0 auto', fontFamily:"'Inter',-apple-system,sans-serif" }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:22, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:700, color:'var(--label)', letterSpacing:'-0.3px', marginBottom:4 }}>
            👥 My Team
          </div>
          <div style={{ fontSize:13, color:'var(--label-4)' }}>
            Add warehouse / office staff — requests go to Devta for approval.
            Once approved, monthly salary is auto-added as an expense.
          </div>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          style={{ background:'linear-gradient(145deg,#FF3B30,#D93025)', color:'#fff', border:'none',
            borderRadius:12, padding:'10px 22px', fontSize:13, fontWeight:700,
            cursor:'pointer', fontFamily:'inherit', boxShadow:'0 3px 12px rgba(255,59,48,0.3)' }}>
          + Add Team Member
        </button>
      </div>

      {/* Add form (inline) */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}
            exit={{ opacity:0, y:-10 }}
            style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)', borderRadius:16,
              padding:'22px 24px', marginBottom:24, boxShadow:'var(--shadow-sm)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--label)' }}>New Team Member Request</div>
              <button onClick={() => setShowForm(false)}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'var(--label-4)' }}>✕</button>
            </div>

            <div style={{ background:'#E1F5FE', border:'1px solid #B3E5FC', borderRadius:10, padding:'10px 14px', marginBottom:18, fontSize:12, color:'#01579B' }}>
              🌤️ This request will be reviewed by <strong>Devta</strong>. Once approved, ₹{form.salary||'—'} will be auto-added as a monthly salary expense.
            </div>

            <div className="form-grid">
              {[
                { k:'full_name', label:'Full Name *', ph:'Ravi Kumar' },
                { k:'phone', label:'Phone *', ph:'+91 98765 43210' },
                { k:'designation', label:'Designation', ph:'Warehouse Staff / Driver' },
                { k:'salary', label:'Monthly Salary (₹) *', ph:'12000', type:'number' },
                { k:'joining_date', label:'Joining Date', type:'date' },
                { k:'aadhar_number', label:'Aadhar Number', ph:'XXXX XXXX XXXX' },
              ].map(f => (
                <div key={f.k} className="field">
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--label-3)', display:'block', marginBottom:4 }}>{f.label}</label>
                  <input type={f.type||'text'} placeholder={f.ph} value={form[f.k]}
                    onChange={e => setF(f.k, e.target.value)}
                    style={{ width:'100%', padding:'8px 10px', border:`1.5px solid ${errors[f.k]?'#B91C1C':'var(--bg-4)'}`,
                      borderRadius:8, fontSize:13, fontFamily:'inherit', color:'var(--label)',
                      background:'var(--bg-3)', outline:'none', boxSizing:'border-box' }} />
                  {errors[f.k] && <span style={{ fontSize:11, color:'#B91C1C' }}>{errors[f.k]}</span>}
                </div>
              ))}
            </div>

            <div className="form-grid" style={{ marginTop:14 }}>
              <div>
                <FileUpload label="Profile Photo *" required value={files.photo} onChange={v => setFile('photo', v)} accept="image/*" />
                {errors.photo && <span style={{ fontSize:11, color:'#B91C1C' }}>{errors.photo}</span>}
              </div>
              <FileUpload label="Aadhar Photo" value={files.aadhar_photo} onChange={v => setFile('aadhar_photo', v)} />
              <FileUpload label="ID Proof (optional)" value={files.id_proof} onChange={v => setFile('id_proof', v)} />
            </div>

            <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:18 }}>
              <button onClick={() => setShowForm(false)}
                style={{ padding:'9px 20px', background:'var(--bg-3)', border:'1px solid var(--bg-4)',
                  color:'var(--label-3)', borderRadius:10, fontSize:13, fontWeight:600,
                  cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              <button onClick={handleSubmit} disabled={saving}
                style={{ padding:'9px 22px', background:'linear-gradient(145deg,#FF3B30,#D93025)',
                  color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:700,
                  cursor:'pointer', fontFamily:'inherit' }}>
                {saving ? '⏳ Submitting…' : '📤 Submit to Devta'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Team list */}
      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--label-4)', fontSize:14 }}>Loading…</div>
      ) : team.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px', background:'var(--bg-2)',
          borderRadius:16, border:'1px solid var(--bg-4)' }}>
          <div style={{ fontSize:40, opacity:0.2, marginBottom:12 }}>👥</div>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--label-3)' }}>No team members yet</div>
          <div style={{ fontSize:13, color:'var(--label-4)', marginTop:4 }}>Add warehouse, office or delivery staff above</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {team.map(m => {
            const sc = STATUS_COLORS[m.status] || STATUS_COLORS.pending;
            return (
              <div key={m.id} style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)',
                borderRadius:14, padding:'14px 18px', display:'flex', alignItems:'center',
                gap:14, boxShadow:'var(--shadow-sm)' }}>
                <div style={{ width:42, height:42, borderRadius:12,
                  background:'linear-gradient(135deg,#7C3AED,#4F46E5)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:14, fontWeight:700, color:'#fff', flexShrink:0 }}>
                  {m.full_name.slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--label)', marginBottom:2 }}>
                    {m.full_name}
                  </div>
                  <div style={{ fontSize:11, color:'var(--label-4)', display:'flex', gap:8, flexWrap:'wrap' }}>
                    <span>{m.designation}</span>
                    {m.phone && <span>· 📞 {m.phone}</span>}
                    {m.salary && <span>· ₹{Number(m.salary).toLocaleString('en-IN')}/{m.salary_type}</span>}
                  </div>
                  {m.devta_note && (
                    <div style={{ marginTop:4, fontSize:11, color:'#B91C1C', fontWeight:500 }}>
                      Devta note: {m.devta_note}
                    </div>
                  )}
                </div>
                <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20,
                  background:sc.bg, color:sc.color, flexShrink:0, textTransform:'capitalize' }}>
                  {m.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
