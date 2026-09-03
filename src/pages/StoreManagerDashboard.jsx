import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import { getSession, clearSession } from '../utils/session';
import AddEmployeeModal from '../components/AddEmployeeModal';
import StoreTransfers   from './StoreTransfers';
import BillingPage      from './BillingPage';
import StoreAnalytics   from './StoreAnalytics';
import InventoryRequestTab from './InventoryRequestTab';
import RefreshButton    from '../components/RefreshButton';
import AppShell         from '../components/AppShell';
import '../styles/login.css';
import '../styles/stores.css';

const MODULES = [
  { icon: '📦', title: 'Inventory',  sub: 'View stock levels',  color: '#34C759', bg: '#F0FDF4' },
  { icon: '🧾', title: 'Billing',    sub: 'Process orders',     color: '#007AFF', bg: '#EFF6FF' },
  { icon: '📊', title: 'Sales',      sub: "Today's summary",    color: '#FF9500', bg: '#FFFBEB' },
  { icon: '📋', title: 'Reports',    sub: 'Daily reports',      color: '#AF52DE', bg: '#FAF0FF' },
];

const EMP_STATUS = {
  pending:  { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A', label: 'Pending' },
  approved: { bg: '#DCFCE7', color: '#15803D', border: '#BBF7D0', label: 'Active'  },
  rejected: { bg: '#FEE2E2', color: '#B91C1C', border: '#FECACA', label: 'Rejected'},
};

export default function StoreManagerDashboard() {
  const navigate = useNavigate();
  const session  = getSession();

  const [managerData,  setManagerData]  = useState(null);
  const [storeData,    setStoreData]    = useState(null);
  const [employees,    setEmployees]    = useState([]);
  const [storeInv,     setStoreInv]     = useState([]);
  const [pendingTransfers, setPendingTransfers] = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [showAddEmp,   setShowAddEmp]   = useState(false);
  const [tab,          setTab]          = useState('overview');

  useEffect(() => {
    if (!session || session.role !== 'store_manager') {
      navigate('/login', { replace: true });
      return;
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: mgr } = await supabase
        .from('store_managers')
        .select('*, stores(*)')
        .eq('email', session.email)
        .single();

      if (mgr) {
        setManagerData(mgr);
        setStoreData(mgr.stores);

        const [{ data: emps }, { data: inv }, { count: pendingCount }] = await Promise.all([
          supabase.from('employees').select('*').eq('store_id', mgr.store_id).order('created_at', { ascending: false }),
          supabase.from('store_inventory').select('*, medicines(name, strength, type, pack_size, pack_unit)').eq('store_id', mgr.store_id).eq('is_active', true).order('expiry_date', { ascending: true }),
          supabase.from('stock_transfers').select('*', { count:'exact', head:true }).eq('store_id', mgr.store_id).eq('status', 'dispatched'),
        ]);
        setEmployees(emps || []);
        setStoreInv(inv || []);
        setPendingTransfers(pendingCount || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => { clearSession(); navigate('/login', { replace: true }); };

  if (!session) return null;

  const initials  = (session.name || session.email).slice(0, 2).toUpperCase();
  const pending   = employees.filter(e => e.status === 'pending').length;
  const approved  = employees.filter(e => e.status === 'approved').length;

  const S = { padding: '0 28px', maxWidth: 1100, margin: '0 auto' };

  const NAV_ITEMS = [
    { id: 'overview',  icon: '📊', label: 'Overview'                                                            },
    { id: 'billing',   icon: '🧾', label: 'Billing'                                                             },
    { id: 'analytics', icon: '📈', label: 'Analytics'                                                           },
    { id: 'transfers', icon: '📦', label: 'Transfers',   badge: pendingTransfers, alert: pendingTransfers > 0   },
    { id: 'request',   icon: '📋', label: 'Request Stock'                                                       },
    { id: 'stock',     icon: '🏪', label: 'My Stock'                                                            },
    { id: 'employees', icon: '👥', label: `My Team (${employees.filter(e=>e.status==='approved').length})`      },
    { id: 'pending',   icon: '⏳', label: `Pending (${employees.filter(e=>e.status==='pending').length})`,
      alert: employees.filter(e=>e.status==='pending').length > 0                                               },
  ];

  return (
    <AppShell
      role="store_manager"
      navItems={NAV_ITEMS}
      active={tab}
      onNav={setTab}
      userName={session.name || session.email}
      onLogout={handleLogout}
    >
      <div style={{ padding:'0 28px', paddingTop:28, paddingBottom:40, maxWidth:1100, margin:'0 auto' }}>
        {loading ? (
          <div style={{ color: 'var(--label-4)', padding: 40, textAlign: 'center', fontSize: 14 }}>Loading...</div>
        ) : (
          <>
            {/* Welcome */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24, display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--label)', letterSpacing: '-0.4px', marginBottom: 4 }}>
                  Welcome, <span style={{ color: 'var(--accent)' }}>{session.name || 'Manager'}</span> 🌱
                </div>
                <div style={{ fontSize: 14, color: 'var(--label-4)' }}>
                  {storeData ? `Managing: ${storeData.store_name}` : 'Your store manager dashboard'}
                </div>
              </div>
              <RefreshButton onRefresh={fetchData} />
            </motion.div>

            <AnimatePresence mode="wait">
              {tab === 'overview' && (
                <motion.div key="ov" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  {/* Store card */}
                  {storeData && (
                    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--bg-4)', borderRadius: 'var(--radius-lg)', padding: '22px 24px', marginBottom: 18, boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--accent-bg)', border: '1px solid rgba(255,59,48,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🏪</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--label)' }}>{storeData.store_name}</div>
                          <div style={{ fontSize: 12, color: 'var(--label-4)', marginTop: 2 }}>RDL: {storeData.rdl_number}</div>
                        </div>
                        <span className={`badge ${storeData.is_active ? 'badge-active' : 'badge-inactive'}`}>{storeData.is_active ? 'Active' : 'Inactive'}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 14, padding: 16, background: 'var(--bg-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-4)' }}>
                        {[
                          { icon: '📍', label: 'Location',   value: `${storeData.city}, ${storeData.state} — ${storeData.pincode}` },
                          { icon: '💊', label: 'Pharmacist', value: storeData.pharmacist_name },
                          { icon: '🕐', label: 'Hours',      value: storeData.is_24_hours ? '24 Hours' : `${storeData.opening_time || '09:00'} – ${storeData.closing_time || '21:00'}` },
                          { icon: '🏢', label: 'Address',    value: `${storeData.address_line1}${storeData.address_line2 ? ', ' + storeData.address_line2 : ''}` },
                        ].map((r, i) => (
                          <div key={i}>
                            <div style={{ fontSize: 11, color: 'var(--label-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{r.icon} {r.label}</div>
                            <div style={{ fontSize: 13, color: 'var(--label-2)', fontWeight: 500 }}>{r.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manager profile */}
                  {managerData && (
                    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--bg-4)', borderRadius: 'var(--radius-lg)', padding: '22px 24px', marginBottom: 24, boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#007AFF,#0056CC)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, color: '#fff', boxShadow: '0 3px 10px rgba(0,122,255,0.25)' }}>{initials}</div>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--label)' }}>{managerData.full_name}</div>
                          <div style={{ fontSize: 13, color: 'var(--label-4)', marginTop: 1 }}>{managerData.designation || 'Store Manager'}</div>
                        </div>
                        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, background: managerData.is_active ? '#DCFCE7' : '#FEE2E2', color: managerData.is_active ? '#15803D' : '#B91C1C', border: `1px solid ${managerData.is_active ? '#BBF7D0' : '#FECACA'}`, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase' }}>
                          {managerData.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(175px,1fr))', gap: 14, padding: 16, background: 'var(--bg-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-4)' }}>
                        {[
                          { label: 'Phone',      value: managerData.phone },
                          { label: 'Employment', value: managerData.employment_type?.replace('_',' ') },
                          { label: 'Joining',    value: managerData.joining_date ? new Date(managerData.joining_date).toLocaleDateString('en-IN') : null },
                          { label: 'Salary',     value: managerData.salary ? `₹${Number(managerData.salary).toLocaleString()}/${managerData.salary_type === 'monthly' ? 'mo' : 'wk'}` : null },
                          { label: 'Gender',     value: managerData.gender },
                          { label: 'Aadhar',     value: managerData.aadhar_number ? `•••• ${managerData.aadhar_number.slice(-4)}` : null },
                        ].map((r, i) => (
                          <div key={i}>
                            <div style={{ fontSize: 11, color: 'var(--label-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{r.label}</div>
                            <div style={{ fontSize: 13, color: r.value ? 'var(--label-2)' : 'var(--label-4)', fontWeight: 500, textTransform: 'capitalize' }}>{r.value || '—'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick access modules */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 14 }}>Quick Access</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 14 }}>
                    {MODULES.map((m, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                        style={{ background: m.bg, border: `1px solid ${m.color}22`, borderRadius: 'var(--radius-md)', padding: '20px 18px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}
                        whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }} whileTap={{ scale: 0.98 }}>
                        <div style={{ fontSize: 28, marginBottom: 10 }}>{m.icon}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)', marginBottom: 3 }}>{m.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--label-4)' }}>{m.sub}</div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* EMPLOYEES */}
              {tab === 'employees' && (
                <motion.div key="em" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)' }}>Active Team Members</div>
                    <button onClick={() => setShowAddEmp(true)}
                      style={{ background: 'linear-gradient(145deg,#FF3B30,#D93025)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(255,59,48,0.28)' }}>
                      + Add Helper / Employee
                    </button>
                  </div>
                  {employees.filter(e => e.status === 'approved').length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--bg-4)' }}>
                      <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>👥</div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--label-3)', marginBottom: 6 }}>No active employees yet</div>
                      <div style={{ fontSize: 13, color: 'var(--label-4)', marginBottom: 20 }}>Add a helper or employee — admin approval required</div>
                      <button onClick={() => setShowAddEmp(true)}
                        style={{ background: 'linear-gradient(145deg,#FF3B30,#D93025)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        + Add First Employee
                      </button>
                    </div>
                  ) : (
                    <EmployeeList
                      employees={employees.filter(e => e.status === 'approved')}
                      onInactive={async (emp) => {
                        const newActive = emp.is_active === false;
                        await supabase.from('employees').update({ is_active: newActive }).eq('id', emp.id);
                        fetchData();
                      }}
                    />
                  )}
                </motion.div>
              )}

              {/* PENDING */}
              {tab === 'pending' && (
                <motion.div key="pn" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)' }}>Submitted Requests</div>
                    <button onClick={() => setShowAddEmp(true)}
                      style={{ background: 'linear-gradient(145deg,#FF3B30,#D93025)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(255,59,48,0.28)' }}>
                      + New Request
                    </button>
                  </div>
                  {employees.filter(e => e.status !== 'approved').length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--label-4)', fontSize: 14 }}>No pending or rejected requests</div>
                  ) : (
                    <EmployeeList employees={employees.filter(e => e.status !== 'approved')} showStatus />
                  )}
                </motion.div>
              )}

              {/* BILLING TAB */}
              {tab === 'billing' && (
                <motion.div key="bil" initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}>
                  {storeData && <BillingPage storeId={storeData.id} managerId={managerData?.id} />}
                </motion.div>
              )}

              {/* ANALYTICS TAB */}
              {tab === 'analytics' && (
                <motion.div key="an" initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}>
                  {storeData && <StoreAnalytics storeId={storeData.id} storeName={storeData.store_name} managerId={managerData?.id} />}
                </motion.div>
              )}

              {/* TRANSFERS TAB */}
              {tab === 'transfers' && (                <motion.div key="tr" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  {managerData && storeData && (
                    <StoreTransfers storeId={storeData.id} managerId={managerData.id} />
                  )}
                  {/* Show issue resolutions for this store */}
                  {storeData && <StoreIssueStatus storeId={storeData.id} />}
                </motion.div>
              )}

              {/* STOCK TAB */}
              {tab === 'request' && (
                <motion.div key="req" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  {managerData && storeData && (
                    <InventoryRequestTab
                      storeId={storeData.id}
                      managerId={managerData.id}
                      adminId={storeData.admin_id}
                    />
                  )}
                </motion.div>
              )}

              {/* STOCK TAB */}
              {tab === 'stock' && (
                <motion.div key="sk" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16 }}>
                    <div style={{ fontSize:15,fontWeight:700,color:'var(--label)' }}>My Store Inventory</div>
                    <div style={{ fontSize:12,color:'var(--label-4)' }}>Sorted by earliest expiry first (FEFO)</div>
                  </div>
                  {storeInv.length === 0 ? (
                    <div style={{ textAlign:'center',padding:'60px 20px',background:'var(--bg-2)',borderRadius:'var(--radius-lg)',border:'1px solid var(--bg-4)' }}>
                      <div style={{ fontSize:40,opacity:0.2,marginBottom:12 }}>🏪</div>
                      <div style={{ fontSize:15,fontWeight:600,color:'var(--label-3)',marginBottom:6 }}>No stock yet</div>
                      <div style={{ fontSize:13,color:'var(--label-4)' }}>Stock will appear here after admin transfers are confirmed</div>
                    </div>
                  ) : (
                    <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                      {storeInv.map(inv => {
                        const med  = inv.medicines;
                        const d    = Math.ceil((new Date(inv.expiry_date) - new Date()) / 86400000);
                        const pct  = inv.units_received > 0 ? Math.round((inv.units_remaining/inv.units_received)*100) : 0;
                        const barC = pct > 50 ? '#34C759' : pct > 20 ? '#FF9500' : '#FF3B30';
                        const expS = d < 0 ? { bg:'#FEE2E2',color:'#B91C1C' } : d < 90 ? { bg:'#FEF3C7',color:'#92400E' } : d < 180 ? { bg:'#E0F2FE',color:'#0369A1' } : { bg:'#DCFCE7',color:'#15803D' };
                        return (
                          <div key={inv.id} style={{ background:'var(--bg-2)',border:'1px solid var(--bg-4)',borderRadius:'var(--radius-md)',overflow:'hidden',boxShadow:'var(--shadow-sm)' }}>
                            <div style={{ padding:'13px 16px',display:'flex',alignItems:'center',gap:12 }}>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:14,fontWeight:700,color:'var(--label)',marginBottom:3 }}>
                                  {med?.name}{med?.strength ? ` · ${med.strength}` : ''}
                                </div>
                                <div style={{ display:'flex',gap:8,flexWrap:'wrap',alignItems:'center' }}>
                                  <span style={{ fontSize:11,fontFamily:'monospace',color:'var(--label-3)',fontWeight:600 }}>{inv.batch_number}</span>
                                  <span style={{ fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,background:expS.bg,color:expS.color }}>
                                    Exp: {new Date(inv.expiry_date).toLocaleDateString('en-IN')}
                                    {d >= 0 ? ` · ${d}d left` : ' · EXPIRED'}
                                  </span>
                                  {inv.date_of_manufacture && <span style={{ fontSize:11,color:'var(--label-4)' }}>DOM: {new Date(inv.date_of_manufacture).toLocaleDateString('en-IN')}</span>}
                                </div>
                                <div style={{ fontSize:11,color:'var(--label-4)',marginTop:2 }}>
                                  {med?.pack_size} {med?.pack_unit}/pack · MRP ₹{Number(inv.mrp_per_pack||0).toFixed(2)}/pack
                                </div>
                              </div>
                              <div style={{ textAlign:'right',flexShrink:0 }}>
                                <div style={{ fontSize:18,fontWeight:800,color:barC }}>{inv.units_remaining}</div>
                                <div style={{ fontSize:10,color:'var(--label-4)' }}>of {inv.units_received} units</div>
                                <div style={{ fontSize:11,color:'var(--label-4)',marginTop:1 }}>
                                  {Math.floor(inv.units_remaining/(med?.pack_size||1))} packs + {inv.units_remaining%(med?.pack_size||1)} loose
                                </div>
                              </div>
                            </div>
                            <div style={{ height:3,background:'var(--bg-4)' }}>
                              <div style={{ height:'100%',width:`${pct}%`,background:barC,transition:'width 0.5s' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </>
        )}
      </div>

      {/* Add Employee Modal */}
      <AnimatePresence>
        {showAddEmp && managerData && storeData && (
          <AddEmployeeModal
            store={storeData}
            manager={managerData}
            onClose={() => setShowAddEmp(false)}
            onSuccess={() => { setShowAddEmp(false); fetchData(); }}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

// ── Store Issue Status — shows admin responses to reported issues ─────────────
function StoreIssueStatus({ storeId }) {
  const [issues, setIssues] = useState([]);
  useEffect(() => {
    supabase.from('transfer_issue_resolutions')
      .select('*')
      .eq('raised_by_store', storeId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setIssues(data || []));
  }, [storeId]);

  const withResponse = issues.filter(i => i.admin_response);
  if (withResponse.length === 0) return null;

  const STATUS_LABEL = { open:'Open', acknowledged:'Acknowledged', resolved:'Resolved ✅', replacement_sent:'Replacement Sent 📦', refund_issued:'Refund Issued 💰', no_action:'No Action' };

  return (
    <div style={{ marginTop: 24, padding: '20px 24px', background: 'var(--bg-2)', border: '1px solid var(--bg-4)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--label)', marginBottom: 14 }}>📋 Admin Responses to Your Issues</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {withResponse.map(issue => (
          <div key={issue.id} style={{ background: 'var(--bg-3)', border: '1px solid var(--bg-4)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--label)' }}>{issue.item_name} {issue.batch_number ? `· ${issue.batch_number}` : ''}</div>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0' }}>{STATUS_LABEL[issue.status] || issue.status}</span>
            </div>
            {issue.manager_note && <div style={{ fontSize: 12, color: '#92400E', background: '#FEF3C7', padding: '6px 10px', borderRadius: 6, marginBottom: 6 }}>Your report: {issue.manager_note}</div>}
            <div style={{ fontSize: 12, color: '#15803D', background: '#F0FDF4', padding: '6px 10px', borderRadius: 6 }}>Admin: {issue.admin_response}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
function EmployeeList({ employees, showStatus, onInactive }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {employees.map(e => {
        const s = EMP_STATUS[e.status] || EMP_STATUS.pending;
        return (
          <div key={e.id} style={{ background: 'var(--bg-2)', border: '1px solid var(--bg-4)', borderRadius: 'var(--radius-md)', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: 'var(--shadow-sm)',
            opacity: e.is_active === false ? 0.55 : 1 }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#5856D6,#3A38A0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {e.full_name.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)', display:'flex', alignItems:'center', gap:8 }}>
                {e.full_name}
                {e.is_active === false && (
                  <span style={{ fontSize:10, fontWeight:700, background:'#FEE2E2', color:'#B91C1C', padding:'2px 7px', borderRadius:20, border:'1px solid #FECACA' }}>Inactive</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--label-4)', marginTop: 1 }}>
                {e.designation} · {e.phone}
                {e.salary ? ` · ₹${Number(e.salary).toLocaleString()}/${e.salary_type === 'monthly' ? 'mo' : 'wk'}` : ''}
              </div>
              {e.admin_note && (
                <div style={{ fontSize: 12, color: '#92400E', marginTop: 4, background: '#FEF3C7', padding: '4px 8px', borderRadius: 6, display: 'inline-block' }}>
                  Note: {e.admin_note}
                </div>
              )}
            </div>
            {showStatus && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                {s.label}
              </span>
            )}
            {!showStatus && onInactive && e.status === 'approved' && (
              <button
                onClick={() => onInactive(e)}
                style={{ padding:'5px 12px', background: e.is_active === false ? '#DCFCE7' : '#FEE2E2',
                  color: e.is_active === false ? '#15803D' : '#B91C1C',
                  border:'none', borderRadius:8, fontSize:11, fontWeight:700,
                  cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
                {e.is_active === false ? '✓ Activate' : 'Mark Inactive'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
