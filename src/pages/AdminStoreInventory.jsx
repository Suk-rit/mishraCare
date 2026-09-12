import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import RefreshButton from '../components/RefreshButton';

export default function AdminStoreInventory({ adminId, adminEmail }) {
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [combinedInventory, setCombinedInventory] = useState([]);
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null);
  const [transferCart, setTransferCart] = useState([]); // { medicineId, medicineName, batches: [{batchId, quantity}] }
  const [showBatchSelector, setShowBatchSelector] = useState(null); // medicineId
  const [searchQuery, setSearchQuery] = useState('');
  const [tempQuantities, setTempQuantities] = useState({}); // { batchId: tempQuantity }
  const [viewMode, setViewMode] = useState('inventory'); // 'inventory' or 'transfers'
  const [transferHistory, setTransferHistory] = useState([]);
  const [transferItems, setTransferItems] = useState({}); // { transferId: [items] }

  useEffect(() => {
    fetchStores();
  }, [adminId]);

  useEffect(() => {
    if (selectedStore) {
      fetchCombinedInventory();
      fetchTransferHistory();
    }
  }, [selectedStore]);

  // Filter inventory based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredInventory(combinedInventory);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = combinedInventory.filter(item => {
        const med = item.medicine;
        return (
          med?.name?.toLowerCase().includes(query) ||
          med?.strength?.toLowerCase().includes(query) ||
          med?.type?.toLowerCase().includes(query) ||
          med?.manufacturer?.toLowerCase().includes(query)
        );
      });
      setFilteredInventory(filtered);
    }
  }, [searchQuery, combinedInventory]);

  const fetchStores = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('stores')
      .select('id, store_name, city, state, is_active')
      .eq('admin_id', adminId)
      .order('store_name');
    setStores(data || []);
    setLoading(false);
  };

  const fetchCombinedInventory = async () => {
    const [storeBatches, adminBatches] = await Promise.all([
      supabase
        .from('medicine_batches')
        .select('*, medicines(id, name, strength, type, manufacturer, pack_size, pack_unit)')
        .eq('store_id', selectedStore.id)
        .eq('status', 'approved')
        .gt('units_remaining', 0),
      supabase
        .from('medicine_batches')
        .select('*, medicines(id, name, strength, type, manufacturer, pack_size, pack_unit)')
        .eq('admin_id', adminId)
        .is('store_id', null)
        .eq('status', 'approved')
        .gt('units_remaining', 0),
    ]);

    // Group by medicine
    const medicineMap = new Map();
    
    // Process store batches
    storeBatches?.forEach(batch => {
      const medId = batch.medicine_id;
      if (!medicineMap.has(medId)) {
        medicineMap.set(medId, {
          medicineId: medId,
          medicine: batch.medicines,
          storeBatches: [],
          adminBatches: [],
          totalStoreStock: 0,
          totalAdminStock: 0,
        });
      }
      const entry = medicineMap.get(medId);
      entry.storeBatches.push(batch);
      entry.totalStoreStock += batch.units_remaining;
    });

    // Process admin batches
    adminBatches?.forEach(batch => {
      const medId = batch.medicine_id;
      if (!medicineMap.has(medId)) {
        medicineMap.set(medId, {
          medicineId: medId,
          medicine: batch.medicines,
          storeBatches: [],
          adminBatches: [],
          totalStoreStock: 0,
          totalAdminStock: 0,
        });
      }
      const entry = medicineMap.get(medId);
      entry.adminBatches.push(batch);
      entry.totalAdminStock += batch.units_remaining;
    });

    // Convert to array and sort by store stock (ascending)
    const combined = Array.from(medicineMap.values()).sort((a, b) => 
      a.totalStoreStock - b.totalStoreStock
    );

    setCombinedInventory(combined);
  };

  const fetchTransferHistory = async () => {
    const { data, error } = await supabase
      .from('stock_transfers')
      .select('*')
      .eq('store_id', selectedStore.id)
      .order('dispatched_at', { ascending: false });
    if (error) {
      console.error('Error fetching transfer history:', error);
    }
    // Filter to only show transfers from this admin (by checking the transfer items)
    const filteredData = (data || []).filter(transfer => {
      // We'll need to check if this transfer belongs to this admin by looking at the items
      // For now, return all since we can't filter without admin_id in the table
      return true;
    });
    setTransferHistory(filteredData);
  };

  const fetchTransferItems = async (transferId) => {
    if (transferItems[transferId]) return;
    const { data } = await supabase
      .from('stock_transfer_items')
      .select('*, medicines(name, strength, type)')
      .eq('transfer_id', transferId);
    setTransferItems(p => ({ ...p, [transferId]: data || [] }));
  };

  const showBannerMsg = (msg) => {
    setBanner(msg);
    setTimeout(() => setBanner(null), 5000);
  };

  const addToTransferCart = (medicineId, medicineName) => {
    setShowBatchSelector(medicineId);
  };

  const handleQuantityChange = (batchId, value) => {
    setTempQuantities(prev => ({ ...prev, [batchId]: value }));
  };

  const addBatchToCart = (batch) => {
    const quantity = tempQuantities[batch.id] || 0;
    if (quantity <= 0) return;
    
    setTransferCart(prev => {
      const existing = prev.find(item => item.medicineId === batch.medicine_id);
      if (existing) {
        const batchIndex = existing.batches.findIndex(b => b.batchId === batch.id);
        if (batchIndex >= 0) {
          existing.batches[batchIndex].quantity = quantity;
          existing.batches[batchIndex].batch = batch;
        } else {
          existing.batches.push({ batchId: batch.id, quantity, batch });
        }
      } else {
        return [...prev, {
          medicineId: batch.medicine_id,
          medicineName: batch.medicines?.name,
          batches: [{ batchId: batch.id, quantity, batch }]
        }];
      }
      return prev;
    });
    
    // Clear temp quantity for this batch after adding
    setTempQuantities(prev => {
      const next = { ...prev };
      delete next[batch.id];
      return next;
    });
  };

  const selectBatchForTransfer = (batch, quantity) => {
    setTransferCart(prev => {
      const existing = prev.find(item => item.medicineId === batch.medicine_id);
      if (existing) {
        const batchIndex = existing.batches.findIndex(b => b.batchId === batch.id);
        if (batchIndex >= 0) {
          existing.batches[batchIndex].quantity = quantity;
          if (quantity === 0) {
            existing.batches.splice(batchIndex, 1);
          }
        } else if (quantity > 0) {
          existing.batches.push({ batchId: batch.id, quantity, batch });
        }
        if (existing.batches.length === 0) {
          return prev.filter(item => item.medicineId !== batch.medicine_id);
        }
      } else if (quantity > 0) {
        return [...prev, {
          medicineId: batch.medicine_id,
          medicineName: batch.medicines?.name,
          batches: [{ batchId: batch.id, quantity, batch }]
        }];
      }
      return prev;
    });
  };

  const executeTransfer = async () => {
    if (transferCart.length === 0) return;
    
    try {
      // Create stock transfer record
      const { data: transfer, error: transferError } = await supabase
        .from('stock_transfers')
        .insert({
          store_id: selectedStore.id,
          status: 'dispatched',
          dispatched_at: new Date().toISOString(),
          admin_notes: `Transfer of ${transferCart.length} medicines`,
        })
        .select()
        .single();

      if (transferError) {
        console.error('Transfer creation error:', transferError);
        throw new Error(transferError.message);
      }

      if (!transfer) throw new Error('Failed to create transfer record');

      // Create transfer items
      for (const item of transferCart) {
        for (const batchItem of item.batches) {
          const batch = batchItem.batch;
          const quantity = batchItem.quantity;
          
          // Deduct from admin batch
          const { error: updateError } = await supabase.from('medicine_batches')
            .update({ units_remaining: batch.units_remaining - quantity })
            .eq('id', batch.id);
          
          if (updateError) {
            console.error('Batch update error:', updateError);
            throw new Error(updateError.message);
          }
          
          // Create transfer item
          const { error: itemError } = await supabase.from('stock_transfer_items').insert({
            transfer_id: transfer.id,
            medicine_id: batch.medicine_id,
            batch_id: batch.id,
            batch_number: batch.batch_number,
            quantity_units_sent: quantity,
            item_status: 'pending',
            cost_price_per_pack: batch.cost_price_per_pack,
            mrp_per_pack: batch.mrp_per_pack,
            expiry_date: batch.expiry_date,
            date_of_manufacture: batch.date_of_manufacture,
          });

          if (itemError) {
            console.error('Transfer item creation error:', itemError);
            throw new Error(itemError.message);
          }
        }
      }
      
      setTransferCart([]);
      fetchCombinedInventory();
      fetchTransferHistory();
      showBannerMsg('✅ Stock transferred successfully!');
    } catch (error) {
      console.error('Transfer execution error:', error);
      showBannerMsg(`⛔ Error: ${error.message}`);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--label-4)' }}>Loading stores...</div>;
  }

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Banner */}
      <AnimatePresence>
        {banner && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              marginBottom: 20,
              fontSize: 13,
              fontWeight: 600,
              background: banner.startsWith('⚠️') ? '#FEE2E2' : '#DCFCE7',
              color: banner.startsWith('⚠️') ? '#B91C1C' : '#15803D',
              border: `1px solid ${banner.startsWith('⚠️') ? '#FECACA' : '#BBF7D0'}`,
            }}
          >
            {banner}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--label)', letterSpacing: '-0.4px', marginBottom: 4 }}>
              {selectedStore ? selectedStore.store_name : 'Store Inventory'}
            </div>
            <div style={{ fontSize: 14, color: 'var(--label-4)' }}>
              {selectedStore ? 'View store inventory and transfer stock' : 'Select a store to manage inventory'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {selectedStore && (
              <>
                <RefreshButton onRefresh={fetchCombinedInventory} />
                <button
                  onClick={() => { setSelectedStore(null); setTransferCart([]); setSearchQuery(''); }}
                  style={{
                    background: 'var(--bg-2)',
                    color: 'var(--label-2)',
                    border: '1px solid var(--bg-4)',
                    borderRadius: 12,
                    padding: '10px 18px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  ← Back to Stores
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search Bar & Transfer Button */}
        {selectedStore && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                placeholder="Search medicines by name, strength, type, or manufacturer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: 14,
                  border: '1px solid var(--bg-4)',
                  borderRadius: 12,
                  background: 'var(--bg-2)',
                  color: 'var(--label)',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            </div>
            <button
              onClick={executeTransfer}
              disabled={transferCart.length === 0}
              style={{
                background: transferCart.length > 0 ? 'linear-gradient(145deg,#34C759,#28A745)' : '#ccc',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '12px 24px',
                fontSize: 14,
                fontWeight: 600,
                cursor: transferCart.length > 0 ? 'pointer' : 'default',
                fontFamily: 'inherit',
                boxShadow: transferCart.length > 0 ? '0 3px 12px rgba(52,199,89,0.3)' : 'none',
                whiteSpace: 'nowrap',
              }}
            >
              🚚 Transfer ({transferCart.length} items)
            </button>
          </div>
        )}

        {/* View Mode Toggle */}
        {selectedStore && (
          <div style={{ display: 'flex', gap: 8, background: 'var(--bg-2)', borderRadius: 12, padding: 6, border: '1px solid var(--bg-4)', width: 'fit-content' }}>
            <button
              onClick={() => setViewMode('inventory')}
              style={{
                padding: '8px 20px',
                borderRadius: 10,
                border: 'none',
                background: viewMode === 'inventory' ? 'var(--accent-bg)' : 'transparent',
                color: viewMode === 'inventory' ? 'var(--accent)' : 'var(--label-4)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              📦 Inventory
            </button>
            <button
              onClick={() => setViewMode('transfers')}
              style={{
                padding: '8px 20px',
                borderRadius: 10,
                border: 'none',
                background: viewMode === 'transfers' ? 'var(--accent-bg)' : 'transparent',
                color: viewMode === 'transfers' ? 'var(--accent)' : 'var(--label-4)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              🚚 Transfer History
            </button>
          </div>
        )}

        {/* Transfer Cart Summary */}
        {selectedStore && transferCart.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: '#DCFCE7',
              border: '1px solid #BBF7D0',
              borderRadius: 12,
              padding: '16px',
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: '#15803D', marginBottom: 12 }}>
              Transfer Cart ({transferCart.length} medicines, {transferCart.reduce((sum, item) => sum + item.batches.length, 0)} batches)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {transferCart.map((item) => (
                <div key={item.medicineId} style={{ background: '#F0FDF4', borderRadius: 8, padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>{item.medicineName}</span>
                    <button
                      onClick={() => {
                        setTransferCart(prev => prev.filter(c => c.medicineId !== item.medicineId));
                      }}
                      style={{
                        background: '#FEE2E2',
                        color: '#B91C1C',
                        border: '1px solid #FECACA',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#166534' }}>
                    {item.batches.map((b) => (
                      <div key={b.batchId} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 12 }}>
                        <span>Batch {b.batch?.batch_number}</span>
                        <span>{b.quantity} units</span>
                      </div>
                    ))}
                    <div style={{ borderTop: '1px solid #BBF7D0', marginTop: 4, paddingTop: 4, fontWeight: 600 }}>
                      Total: {item.batches.reduce((sum, b) => sum + b.quantity, 0)} units
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Store List */}
      {!selectedStore && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
          {stores.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, background: 'var(--bg-2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--bg-4)' }}>
              <div style={{ fontSize: 40, opacity: 0.2, marginBottom: 12 }}>🏪</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--label-3)', marginBottom: 6 }}>No stores found</div>
              <div style={{ fontSize: 13, color: 'var(--label-4)' }}>Add stores to manage their inventory</div>
            </div>
          ) : (
            stores.map((store) => (
              <motion.div
                key={store.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelectedStore(store)}
                style={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--bg-4)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px 24px',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.2s',
                }}
                whileHover={{ scale: 1.02, boxShadow: 'var(--shadow-md)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--accent-bg)', border: '1px solid rgba(255,59,48,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🏪</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--label)' }}>{store.store_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--label-4)', marginTop: 2 }}>{store.city}, {store.state}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: store.is_active ? '#DCFCE7' : '#FEE2E2', color: store.is_active ? '#15803D' : '#B91C1C', border: `1px solid ${store.is_active ? '#BBF7D0' : '#FECACA'}` }}>
                    {store.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>Click to view inventory →</div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Combined Inventory View */}
      {selectedStore && viewMode === 'inventory' && (
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedStore.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)', marginBottom: 16 }}>
              Inventory Overview (sorted by low stock first) {searchQuery && `(${filteredInventory.length} results)`}
            </div>
            {filteredInventory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, background: 'var(--bg-2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--bg-4)' }}>
                <div style={{ fontSize: 40, opacity: 0.2, marginBottom: 12 }}>📦</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--label-3)', marginBottom: 6 }}>
                  {searchQuery ? 'No medicines found' : 'No inventory yet'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--label-4)' }}>
                  {searchQuery ? 'Try a different search term' : 'Add stock from the Add Stock tab'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredInventory.map((item) => {
                  const med = item.medicine;
                  const inCart = transferCart.find(c => c.medicineId === item.medicineId);
                  
                  return (
                    <div key={item.medicineId} style={{ background: 'var(--bg-2)', border: '1px solid var(--bg-4)', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)', marginBottom: 4 }}>
                            {med?.name}{med?.strength ? ` · ${med.strength}` : ''}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--label-4)' }}>
                            {med?.type} · {med?.manufacturer || 'Unknown'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: 'var(--label-4)', marginBottom: 2 }}>Store Stock</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: item.totalStoreStock < 50 ? '#FF3B30' : 'var(--accent)' }}>
                              {item.totalStoreStock}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: 'var(--label-4)', marginBottom: 2 }}>Your Stock</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#007AFF' }}>
                              {item.totalAdminStock}
                            </div>
                          </div>
                          <button
                            onClick={() => addToTransferCart(item.medicineId, med?.name)}
                            disabled={item.totalAdminStock === 0}
                            style={{
                              padding: '8px 16px',
                              background: item.totalAdminStock > 0 ? 'linear-gradient(145deg,#34C759,#28A745)' : '#ccc',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 10,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: item.totalAdminStock > 0 ? 'pointer' : 'default',
                              fontFamily: 'inherit',
                            }}
                          >
                            {inCart ? '✓ Added' : '+ Add to Transfer'}
                          </button>
                        </div>
                      </div>

                      {/* Batch selector for this medicine */}
                      {showBatchSelector === item.medicineId && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          style={{ borderTop: '1px solid var(--bg-4)', paddingTop: 16, marginTop: 8 }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--label)', marginBottom: 12 }}>
                            Select batches to transfer:
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {item.adminBatches.map((batch) => {
                              const daysToExpiry = Math.ceil((new Date(batch.expiry_date) - new Date()) / 86400000);
                              const expiryColor = daysToExpiry < 90 ? '#FF9500' : daysToExpiry < 180 ? '#007AFF' : '#34C759';
                              const cartItem = transferCart.find(c => c.medicineId === item.medicineId);
                              const batchItem = cartItem?.batches.find(b => b.batchId === batch.id);
                              // Show temp quantity if user is typing, otherwise show cart quantity if batch is in cart, otherwise 0
                              const quantity = tempQuantities[batch.id] !== undefined ? tempQuantities[batch.id] : (batchItem?.quantity || 0);
                              const isInCart = !!batchItem;
                              
                              return (
                                <div key={batch.id} style={{ background: 'var(--bg-3)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--label)', marginBottom: 4 }}>
                                      Batch: {batch.batch_number} {isInCart && <span style={{ color: '#34C759', marginLeft: 8 }}>✓ In cart</span>}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--label-4)' }}>
                                      <span style={{ fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: `${expiryColor}22`, color: expiryColor }}>
                                        Exp: {new Date(batch.expiry_date).toLocaleDateString('en-IN')}
                                      </span>
                                      <span>Available: {batch.units_remaining} units</span>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input
                                      type="number"
                                      min="0"
                                      max={batch.units_remaining}
                                      step="1"
                                      value={quantity}
                                      onChange={(e) => handleQuantityChange(batch.id, parseInt(e.target.value) || 0)}
                                      style={{ width: '120px', padding: '6px 10px', fontSize: 12, border: '1px solid var(--bg-4)', borderRadius: 8, background: 'var(--bg-2)', color: 'var(--label)', fontFamily: 'inherit' }}
                                    />
                                    <span style={{ fontSize: 11, color: 'var(--label-4)' }}>units</span>
                                    <button
                                      onClick={() => addBatchToCart(batch)}
                                      disabled={quantity <= 0}
                                      style={{
                                        padding: '6px 12px',
                                        background: quantity > 0 ? 'linear-gradient(145deg,#34C759,#28A745)' : '#ccc',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 8,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        cursor: quantity > 0 ? 'pointer' : 'default',
                                        fontFamily: 'inherit',
                                      }}
                                    >
                                      {isInCart ? 'Update' : 'Add'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <button
                            onClick={() => setShowBatchSelector(null)}
                            style={{ marginTop: 12, padding: '6px 12px', background: 'var(--bg-3)', color: 'var(--label-2)', border: '1px solid var(--bg-4)', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            Close
                          </button>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Transfer History View */}
      {selectedStore && viewMode === 'transfers' && (
        <AnimatePresence mode="wait">
          <motion.div
            key="transfers"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)', marginBottom: 16 }}>
              Transfer History ({transferHistory.length} transfers)
            </div>
            {transferHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, background: 'var(--bg-2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--bg-4)' }}>
                <div style={{ fontSize: 40, opacity: 0.2, marginBottom: 12 }}>🚚</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--label-3)', marginBottom: 6 }}>
                  No transfers yet
                </div>
                <div style={{ fontSize: 13, color: 'var(--label-4)' }}>
                  Transfers will appear here after you send stock to this store
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {transferHistory.map((transfer) => {
                  const STATUS_CONFIG = {
                    dispatched: { bg: '#EFF6FF', color: '#1D4ED8', label: 'In Transit 🚚' },
                    received: { bg: '#DCFCE7', color: '#15803D', label: 'Received ✓' },
                    partially_received: { bg: '#FEF3C7', color: '#92400E', label: 'Partially Received' },
                    issue_reported: { bg: '#FEE2E2', color: '#B91C1C', label: 'Has Rejections ⚠️' },
                    cancelled: { bg: '#F1F5F9', color: '#64748B', label: 'Cancelled' },
                  };
                  const sc = STATUS_CONFIG[transfer.status] || STATUS_CONFIG.dispatched;
                  const items = transferItems[transfer.id] || [];
                  
                  return (
                    <div key={transfer.id} style={{ background: 'var(--bg-2)', border: '1px solid var(--bg-4)', borderRadius: 'var(--radius-lg)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)', marginBottom: 4 }}>
                            Transfer #{transfer.id.slice(-8).toUpperCase()}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--label-4)' }}>
                            {new Date(transfer.dispatched_at).toLocaleString('en-IN')}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: sc.bg, color: sc.color }}>
                          {sc.label}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <button
                          onClick={() => fetchTransferItems(transfer.id)}
                          style={{
                            padding: '6px 12px',
                            background: 'var(--bg-3)',
                            color: 'var(--label-2)',
                            border: '1px solid var(--bg-4)',
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          {items.length > 0 ? 'Hide Items' : 'View Items'}
                        </button>
                      </div>

                      {items.length > 0 && (
                        <div style={{ borderTop: '1px solid var(--bg-4)', paddingTop: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--label-4)', marginBottom: 8 }}>
                            Items ({items.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {items.map((item) => (
                              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-3)', borderRadius: 8 }}>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--label)' }}>
                                    {item.medicines?.name}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--label-4)' }}>
                                    Batch: {item.batch_number} · {item.quantity_units_sent} units
                                  </div>
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: item.item_status === 'ok' ? '#DCFCE7' : item.item_status === 'defect' ? '#FEE2E2' : '#EFF6FF', color: item.item_status === 'ok' ? '#15803D' : item.item_status === 'defect' ? '#B91C1C' : '#1D4ED8' }}>
                                  {item.item_status === 'ok' ? 'Accepted' : item.item_status === 'defect' ? 'Rejected' : 'Pending'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
