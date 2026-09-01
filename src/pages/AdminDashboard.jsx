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
import AppShell from '../components/AppShell';
import '../styles/login.css';
import '../styles/stores.css';

const NAV = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard'  },
  { id: 'stores',    icon: '🏪', label: 'Stores'     },
  { id: 'inventory', icon: '🗄️',  label: 'Inventory'  },
  { id: 'add-stock', icon: '📥', label: 'Add Stock'  },
  { id: 'analytics', icon: '📈', label: 'Analytics'  },
  { id: 'issues',    icon: '⚠️',  label: 'Issues'     },
  { id: 'requests',  icon: '📋', label: 'Store Requests' },
  { id: 'staff',     icon: '👥', label: 'Staff'      },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const session  = getSession();

  const [active,       setActive]       = useState('dashboard');
  const [selectedStore,setSelectedStore]= useState(null);
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
    <AppShell
      role="admin"
      navItems={NAV}
      active={active}
      onNav={(id) => { setActive(id); setSelectedStore(null); }}
      title="MishraCare"
      userName={session.name || session.email}
      onLogout={handleLogout}
      headerRight={
        active === 'store-detail' ? (
          <button onClick={() => { setActive('stores'); setSelectedStore(null); }}
            style={{ background:'none', border:'none', color:'var(--accent)',
              cursor:'pointer', fontSize:14, fontWeight:600, fontFamily:'inherit',
              display:'flex', alignItems:'center', gap:4, padding:0 }}>
            ← Stores / {selectedStore?.store_name}
          </button>
        ) : null
      }
    >
      <div style={{ overflowY:'auto' }}>
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
                      { label: '📋  Requests',    action: () => setActive('requests')   },
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

            {/* Store Requests */}
            {active === 'requests' && (
              <motion.div key="requests" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <AdminInventoryRequests adminEmail={session?.email} />
              </motion.div>
            )}

            {/* Staff tab — admin warehouse team */}
            {active === 'staff' && (
              <motion.div key="staff" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <AdminStaffTab adminId={session?.adminId} adminEmail={session?.email} />
              </motion.div>
            )}

            {/* Coming soon */}
            {!['dashboard', 'stores', 'store-detail', 'inventory', 'add-stock', 'analytics', 'issues', 'requests', 'staff'].includes(active) && (
              <motion.div key={active} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ padding: '80px 28px', textAlign: 'center' }}>
                <div style={{ fontSize: 52, marginBottom: 14, opacity: 0.3 }}>{NAV.find(n => n.id === active)?.icon}</div>
                <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--label-3)', marginBottom: 6 }}>{NAV.find(n => n.id === active)?.label} — Coming Soon</div>
                <div style={{ fontSize: 14, color: 'var(--label-4)' }}>This module is being built.</div>
              </motion.div>
            )}

          </AnimatePresence>
      </div>
    </AppShell>
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

// ── AdminInventoryRequests — admin sees stock requests from store managers ────
const STATUS_META = {
  pending:   { bg:'#FEF3C7', color:'#92400E', border:'#FDE68A', label:'Pending ⏳'   },
  approved:  { bg:'#DCFCE7', color:'#15803D', border:'#BBF7D0', label:'Approved ✓'   },
  rejected:  { bg:'#FEE2E2', color:'#B91C1C', border:'#FECACA', label:'Rejected ✕'   },
  fulfilled: { bg:'#EFF6FF', color:'#1D4ED8', border:'#BFDBFE', label:'Fulfilled 📦' },
};

function AdminInventoryRequests({ adminEmail }) {
  const [requests,   setRequests]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [adminId,    setAdminId]    = useState(null);
  const [filter,     setFilter]     = useState('pending');
  const [responding, setResponding] = useState(null); // request id
  const [note,       setNote]       = useState('');
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    if (!adminEmail) return;
    supabase.from('admins').select('id').eq('email', adminEmail).single()
      .then(({ data }) => { if (data?.id) { setAdminId(data.id); fetchRequests(data.id); } });
  }, [adminEmail]);

  const fetchRequests = async (id) => {
    setLoading(true);
    const { data } = await supabase
      .from('inventory_requests')
      .select('*, stores(store_name, city)')
      .eq('admin_id', id)
      .order('created_at', { ascending: false });
    setRequests(data || []);
    setLoading(false);
  };

  const handleRespond = async (req, status) => {
    setSaving(true);
    try {
      await supabase.from('inventory_requests').update({
        status,
        admin_note:   note.trim() || null,
        responded_at: new Date().toISOString(),
      }).eq('id', req.id);
      setResponding(null); setNote('');
      fetchRequests(adminId);
    } catch (ex) { alert('Error: ' + ex.message); }
    finally { setSaving(false); }
  };

  const filtered = requests.filter(r => filter === 'all' ? true : r.status === filter);
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div style={{ padding:'24px 28px', maxWidth:900, margin:'0 auto',
      fontFamily:"'Inter',-apple-system,sans-serif", marginTop:8 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:700, color:'var(--label)', marginBottom:3 }}>
            📋 Stock Requests from Stores
            {pendingCount > 0 && (
              <span style={{ marginLeft:8, fontSize:12, fontWeight:700, background:'#FF3B30',
                color:'#fff', padding:'2px 9px', borderRadius:20 }}>{pendingCount}</span>
            )}
          </div>
          <div style={{ fontSize:12, color:'var(--label-4)' }}>
            Requests from store managers for medicine from your inventory or new medicines
          </div>
        </div>
        <button onClick={() => fetchRequests(adminId)}
          style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)', color:'var(--label-3)',
            borderRadius:9, padding:'7px 14px', fontSize:12, fontWeight:600,
            cursor:'pointer', fontFamily:'inherit' }}>↺ Refresh</button>
      </div>

      <div style={{ display:'flex', gap:5, marginBottom:14, flexWrap:'wrap' }}>
        {['pending','approved','rejected','fulfilled','all'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding:'6px 14px', borderRadius:20, border:'1.5px solid',
              borderColor: filter===f ? 'var(--accent)' : 'var(--bg-4)',
              background:  filter===f ? 'var(--accent-bg)' : 'var(--bg-2)',
              color:       filter===f ? 'var(--accent)' : 'var(--label-4)',
              fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
              textTransform:'capitalize' }}>
            {f} ({filter===f ? filtered.length : requests.filter(r => f==='all' ? true : r.status===f).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:30, color:'var(--label-4)', fontSize:13 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'28px 20px', background:'var(--bg-2)',
          borderRadius:12, border:'1px solid var(--bg-4)', color:'var(--label-4)', fontSize:13 }}>
          No {filter !== 'all' ? filter : ''} requests
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          {filtered.map(req => {
            const sm = STATUS_META[req.status] || STATUS_META.pending;
            const isResp = responding === req.id;
            return (
              <div key={req.id} style={{ background:'var(--bg-2)', border:`1px solid ${sm.border}`,
                borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
                <div style={{ padding:'12px 16px', display:'flex', alignItems:'flex-start', gap:12 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:3 }}>
                      <span style={{ fontSize:14, fontWeight:700, color:'var(--label)' }}>
                        {req.medicine_name || '—'}
                      </span>
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20,
                        background: req.request_type==='new' ? '#FAF0FF' : '#EFF6FF',
                        color: req.request_type==='new' ? '#6B21A8' : '#1D4ED8' }}>
                        {req.request_type==='new' ? '🆕 New' : '📦 Stock'}
                      </span>
                    </div>
                    <div style={{ fontSize:11, color:'var(--label-4)', display:'flex', gap:8, flexWrap:'wrap' }}>
                      <span>Store: <strong>{req.stores?.store_name}</strong> · {req.stores?.city}</span>
                      <span>{req.quantity_units} units</span>
                      {req.batch_number && <span>Batch: {req.batch_number}</span>}
                      <span>{new Date(req.created_at).toLocaleDateString('en-IN')}</span>
                    </div>
                    {req.notes && (
                      <div style={{ marginTop:4, fontSize:12, color:'var(--label-3)', fontStyle:'italic' }}>
                        "{req.notes}"
                      </div>
                    )}
                    {req.admin_note && (
                      <div style={{ marginTop:5, fontSize:11, padding:'4px 8px', background:'#F0FDF4',
                        border:'1px solid #BBF7D0', borderRadius:6, color:'#15803D' }}>
                        Your response: {req.admin_note}
                      </div>
                    )}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:5, flexShrink:0, alignItems:'flex-end' }}>
                    <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20,
                      background:sm.bg, color:sm.color, border:`1px solid ${sm.border}` }}>
                      {sm.label}
                    </span>
                    {req.status === 'pending' && !isResp && (
                      <button onClick={() => { setResponding(req.id); setNote(''); }}
                        style={{ padding:'5px 12px', background:'var(--accent-bg)',
                          color:'var(--accent)', border:'1px solid rgba(255,59,48,0.2)',
                          borderRadius:7, fontSize:11, fontWeight:600,
                          cursor:'pointer', fontFamily:'inherit' }}>
                        Respond
                      </button>
                    )}
                  </div>
                </div>
                {isResp && (
                  <div style={{ padding:'12px 16px', background:'var(--bg-3)',
                    borderTop:'1px solid var(--bg-4)' }}>
                    <input value={note} onChange={e => setNote(e.target.value)}
                      placeholder="Add a note for the manager (optional)…"
                      style={{ width:'100%', padding:'8px 12px', fontSize:12,
                        border:'1.5px solid var(--bg-4)', borderRadius:8, background:'var(--bg-2)',
                        color:'var(--label)', fontFamily:'inherit', outline:'none',
                        boxSizing:'border-box', marginBottom:8 }} />
                    <div style={{ display:'flex', gap:7 }}>
                      <button onClick={() => setResponding(null)}
                        style={{ padding:'6px 14px', background:'var(--bg-3)', border:'1px solid var(--bg-4)',
                          color:'var(--label-3)', borderRadius:7, fontSize:11, fontWeight:600,
                          cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                      <button onClick={() => handleRespond(req, 'approved')} disabled={saving}
                        style={{ padding:'6px 16px', background:'#34C759', color:'#fff',
                          border:'none', borderRadius:7, fontSize:11, fontWeight:700,
                          cursor:'pointer', fontFamily:'inherit' }}>✓ Approve</button>
                      <button onClick={() => handleRespond(req, 'rejected')} disabled={saving}
                        style={{ padding:'6px 16px', background:'#FF3B30', color:'#fff',
                          border:'none', borderRadius:7, fontSize:11, fontWeight:700,
                          cursor:'pointer', fontFamily:'inherit' }}>✕ Reject</button>
                      <button onClick={() => handleRespond(req, 'fulfilled')} disabled={saving}
                        style={{ padding:'6px 16px', background:'#007AFF', color:'#fff',
                          border:'none', borderRadius:7, fontSize:11, fontWeight:700,
                          cursor:'pointer', fontFamily:'inherit' }}>📦 Fulfilled</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
