import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../utils/supabase';

export default function StoreSelector({ onSelect }) {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('id, store_name, city, state, admin_id')
        .eq('is_active', true)
        .order('store_name');
      
      if (error) throw error;
      setStores(data || []);
    } catch (err) {
      console.error('Error fetching stores:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign:'center', padding:20, color:'#666', fontSize:13 }}>Loading stores…</div>;
  }

  if (error) {
    return (
      <div style={{ textAlign:'center', padding:30, background:'#FEE2E2',
        borderRadius:12, border:'1px solid #FECACA', color:'#B91C1C', fontSize:13 }}>
        Error loading stores: {error}
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div style={{ textAlign:'center', padding:30, background:'#F5F5F5',
        borderRadius:12, border:'1px solid #E0E0E0', color:'#666', fontSize:13 }}>
        No stores available. Please add a store first.
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {stores.map(store => (
        <motion.button
          key={store.id}
          onClick={() => onSelect(store)}
          whileHover={{ scale:1.02 }}
          whileTap={{ scale:0.98 }}
          style={{
            padding:'14px 16px',
            background:'#fff',
            border:'1px solid #E0E0E0',
            borderRadius:10,
            cursor:'pointer',
            textAlign:'left',
            transition:'all 0.2s',
            boxShadow:'0 2px 4px rgba(0,0,0,0.05)'
          }}
          onMouseEnter={e => e.target.style.borderColor='#0288D1'}
          onMouseLeave={e => e.target.style.borderColor='#E0E0E0'}
        >
          <div style={{ fontSize:14, fontWeight:700, color:'#333', marginBottom:4 }}>
            {store.store_name}
          </div>
          <div style={{ fontSize:12, color:'#666', display:'flex', gap:8, flexWrap:'wrap' }}>
            <span>📍 {store.city}, {store.state}</span>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
