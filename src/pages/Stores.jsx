import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import { getSession } from '../utils/session';
import AddManagerModal from '../components/AddManagerModal';
import RefreshButton   from '../components/RefreshButton';
import '../styles/stores.css';

export default function Stores({ onStoreClick }) {
  const [stores,          setStores]       = useState([]);
  const [managers,        setManagers]     = useState({});
  const [loading,         setLoading]      = useState(true);
  const [addManagerStore, setAddManagerStore] = useState(null);
  const [notifications,   setNotifications]= useState([]);
  const [dismissedNotifs, setDismissedNotifs] = useState(new Set());

  const session = getSession();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: storesData }, { data: managersData }] = await Promise.all([
        supabase.from('stores').select('*').order('created_at', { ascending: false }),
        supabase.from('store_managers').select('id, store_id, full_name, email, phone, designation, is_active, salary, salary_type, employment_type'),
      ]);
      const mgMap = {};
      (managersData || []).forEach(m => {
        if (!mgMap[m.store_id]) mgMap[m.store_id] = [];
        mgMap[m.store_id].push(m);
      });
      setStores(storesData || []);
      setManagers(mgMap);

      // Fetch unread store_assigned notifications for this admin
      if (session?.role === 'admin') {
        const { data: adminRow } = await supabase
          .from('admins').select('id').eq('email', session.email).single();
        if (adminRow?.id) {
          const { data: notifs } = await supabase
            .from('notifications')
            .select('*')
            .eq('recipient_id', adminRow.id)
            .eq('type', 'store_assigned')
            .eq('is_read', false)
            .order('created_at', { ascending: false });
          setNotifications(notifs || []);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const dismissNotif = async (notifId) => {
    setDismissedNotifs(prev => new Set([...prev, notifId]));
    await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
  };

  const activeStores  = stores.filter(s => s.is_active).length;
  const totalManagers = Object.values(managers).flat().length;

  return (
    <div className="stores-page">
      {/* New store notification banners */}
      <AnimatePresence>
        {notifications.filter(n => !dismissedNotifs.has(n.id)).map(n => (
          <motion.div key={n.id}
            initial={{ opacity:0, y:-12 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-12 }}
            style={{ background:'#E1F5FE', border:'1px solid #B3E5FC', borderRadius:12,
              padding:'12px 18px', marginBottom:12, display:'flex', alignItems:'center',
              gap:12, fontSize:13, color:'#01579B', boxShadow:'0 2px 8px rgba(2,136,209,0.1)' }}>
            <span style={{ fontSize:18 }}>🏪</span>
            <div style={{ flex:1 }}>
              <strong>{n.title}</strong>
              {n.body && <div style={{ fontSize:12, marginTop:2, color:'#0288D1' }}>{n.body}</div>}
            </div>
            <button onClick={() => dismissNotif(n.id)}
              style={{ background:'none', border:'none', color:'#0288D1', cursor:'pointer',
                fontSize:16, fontWeight:700, padding:'0 4px' }}>✕</button>
          </motion.div>
        ))}
      </AnimatePresence>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">🏪 Stores <span>Management</span></div>
          <div className="page-sub">Click any store to view full details, managers and employees · Stores are added by Devta</div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <RefreshButton onRefresh={fetchData} />
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Total Stores</div>
          <div className="stat-value red">{stores.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active</div>
          <div className="stat-value green">{activeStores}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Inactive</div>
          <div className="stat-value">{stores.length - activeStores}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Managers</div>
          <div className="stat-value blue">{totalManagers}</div>
        </div>
      </div>

      {/* Store cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--label-4)', fontSize: 14 }}>Loading stores...</div>
      ) : (
        <div className="stores-grid">
          {stores.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏪</div>
              <div className="empty-state-title">No stores yet</div>
              <div className="empty-state-sub">Devta will assign stores to your region</div>
            </div>
          ) : (
            stores.map((store, i) => {
              const storeMgrs = managers[store.id] || [];
              return (
                <motion.div
                  key={store.id}
                  className="store-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => onStoreClick?.(store)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Header */}
                  <div className="store-card-header">
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1 }}>
                      <div className="store-card-icon">🏪</div>
                      <div>
                        <div className="store-card-name">{store.store_name}</div>
                        <div className="store-card-rdl">RDL: {store.rdl_number}</div>
                      </div>
                    </div>
                    <span className={`badge ${store.is_active ? 'badge-active' : 'badge-inactive'}`}>
                      {store.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="store-card-body">
                    <div className="store-info-row"><span className="icon">📍</span><span>{store.city}, {store.state} — {store.pincode}</span></div>
                    <div className="store-info-row"><span className="icon">💊</span><span>Pharmacist: {store.pharmacist_name}</span></div>
                    {store.gstin && <div className="store-info-row"><span className="icon">🧾</span><span>GSTIN: {store.gstin}</span></div>}
                    <div className="store-info-row">
                      <span className="icon">🕐</span>
                      <span>{store.is_24_hours ? '24 Hours' : `${store.opening_time || '09:00'} – ${store.closing_time || '21:00'}`}</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="store-card-footer" onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
                      {storeMgrs.slice(0, 3).map(m => (
                        <div key={m.id} className="manager-avatar-sm" title={m.full_name}>
                          {m.full_name.slice(0, 2).toUpperCase()}
                        </div>
                      ))}
                      {storeMgrs.length > 3 && (
                        <div className="manager-avatar-sm" style={{ background: 'var(--bg-4)', color: 'var(--label-4)', fontSize: 9 }}>
                          +{storeMgrs.length - 3}
                        </div>
                      )}
                      <span className="managers-count">
                        {storeMgrs.length === 0 ? 'No managers' : `${storeMgrs.length} manager${storeMgrs.length > 1 ? 's' : ''}`}
                      </span>
                    </div>
                    <button className="btn-sm btn-sm-ghost"
                      onClick={e => { e.stopPropagation(); onStoreClick?.(store); }}>
                      View →
                    </button>
                    <button className="btn-sm btn-sm-primary"
                      onClick={e => { e.stopPropagation(); setAddManagerStore(store); }}>
                      + Manager
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {addManagerStore && (
          <AddManagerModal store={addManagerStore} onClose={() => setAddManagerStore(null)} onSuccess={() => { setAddManagerStore(null); fetchData(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}
