import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import { getSession } from '../utils/session';

function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }

export default function ReturnBills({ storeId, storeName }) {
  const session = getSession();
  const [bills, setBills] = useState([]);
  const [selectedBill, setSelectedBill] = useState(null);
  const [billItems, setBillItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [refundAmount, setRefundAmount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (storeId) fetchBills();
  }, [storeId]);

  const fetchBills = async () => {
    setLoading(true);
    const { data: bills, error: billsError } = await supabase
      .from('bills')
      .select('*')
      .order('created_at', { ascending: false });

    // Fetch returned bill data to prevent duplicate returns and show refund amounts
    const { data: returns, error: returnsError } = await supabase
      .from('bill_returns')
      .select('bill_id, refund_amount')
      .eq('store_id', storeId);

    // Create refund map
    const refundMap = {};
    (returns || []).forEach(r => {
      refundMap[r.bill_id] = r.refund_amount;
    });

    console.log('Bills data:', bills);
    console.log('Bills error:', billsError);
    console.log('Refund map:', refundMap);

    if (billsError) {
      console.error('Error fetching bills:', billsError);
    } else {
      // Filter by store_id in JavaScript and mark returned bills with refund amount
      const filteredBills = (bills || [])
        .filter(b => b.store_id === storeId)
        .map(b => ({
          ...b,
          isReturned: refundMap[b.id] !== undefined,
          refundAmount: refundMap[b.id] || 0
        }));
      setBills(filteredBills);
    }
    setLoading(false);
  };

  const fetchBillItems = async (billId) => {
    const { data, error } = await supabase
      .from('bill_items')
      .select('*, medicines(name, strength, type, pack_size, pack_unit), store_inventory(batch_number, expiry_date)')
      .eq('bill_id', billId);

    if (error) {
      console.error('Error fetching bill items:', error);
    } else {
      setBillItems(data || []);
    }
  };

  const getDaysLeft = (bill) => {
    if (!bill || !bill.created_at) return 0;
    const now = new Date();
    let billDate;
    try {
      billDate = new Date(bill.created_at);
      if (isNaN(billDate.getTime())) {
        console.log('Invalid date for bill:', bill.bill_number, 'created_at:', bill.created_at);
        return 0;
      }
    } catch (e) {
      console.log('Error parsing date for bill:', bill.bill_number, 'created_at:', bill.created_at);
      return 0;
    }
    const diffTime = now - billDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const daysLeft = 7 - diffDays;
    console.log('Bill:', bill.bill_number, 'Date:', billDate, 'Now:', now, 'Diff days:', diffDays, 'Days left:', daysLeft);
    return daysLeft > 0 ? daysLeft : 0;
  };

  const isEligibleForReturn = (bill) => {
    return getDaysLeft(bill) > 0;
  };

  const handleBillClick = (bill) => {
    if (bill.isReturned) {
      alert('This bill has already been returned.');
      return;
    }
    setSelectedBill(bill);
    setSelectedItems({});
    setRefundAmount(0);
    fetchBillItems(bill.id);
  };

  const handleItemSelection = (itemId, quantity, maxQuantity, pricePerUnit) => {
    setSelectedItems(prev => {
      const newItems = { ...prev };
      if (quantity > 0 && quantity <= maxQuantity) {
        newItems[itemId] = { quantity, pricePerUnit };
      } else {
        delete newItems[itemId];
      }

      // Check if complete bill is being returned (all items with full quantities)
      const isFullBillReturn = billItems.every(item => {
        const returnedItem = newItems[item.id];
        return returnedItem && returnedItem.quantity === item.quantity_units;
      });

      let total;
      if (isFullBillReturn && Object.keys(newItems).length === billItems.length) {
        // Full bill return - refund total amount including GST
        total = selectedBill.total_amount;
      } else {
        // Partial return - refund only per-unit cost (without GST)
        total = Object.values(newItems).reduce((sum, item) => sum + (item.quantity * item.pricePerUnit), 0);
      }

      setRefundAmount(total);

      return newItems;
    });
  };

  const handleReturn = async () => {
    if (Object.keys(selectedItems).length === 0) return;

    setProcessing(true);
    try {
      // Check if bill is already returned
      const { data: existingReturn } = await supabase
        .from('bill_returns')
        .select('id')
        .eq('bill_id', selectedBill.id)
        .single();

      if (existingReturn) {
        alert('This bill has already been returned.');
        setProcessing(false);
        return;
      }

      // Check if complete bill is being returned (all items with full quantities)
      const isFullBillReturn = billItems.every(item => {
        const returnedItem = selectedItems[item.id];
        return returnedItem && returnedItem.quantity === item.quantity_units;
      });

      // Create bill return record
      const { data: billReturn, error: returnError } = await supabase
        .from('bill_returns')
        .insert({
          bill_id: selectedBill.id,
          store_id: storeId,
          returned_by: session?.id,
          refund_amount: refundAmount,
          refund_includes_gst: isFullBillReturn && Object.keys(selectedItems).length === billItems.length,
          status: 'completed',
        })
        .select()
        .single();

      if (returnError) throw returnError;

      // Process each item return
      for (const [itemId, itemData] of Object.entries(selectedItems)) {
        const billItem = billItems.find(i => i.id === itemId);
        if (!billItem) continue;

        // Create bill return item record
        await supabase
          .from('bill_return_items')
          .insert({
            bill_return_id: billReturn.id,
            bill_item_id: itemId,
            medicine_id: billItem.medicine_id,
            quantity_returned: itemData.quantity,
            refund_amount: itemData.quantity * itemData.pricePerUnit,
          });

        // Update store inventory
        const { data: storeInv } = await supabase
          .from('store_inventory')
          .select('*')
          .eq('store_id', storeId)
          .eq('medicine_id', billItem.medicine_id)
          .eq('batch_number', billItem.store_inventory?.batch_number)
          .single();

        if (storeInv) {
          await supabase
            .from('store_inventory')
            .update({ units_remaining: storeInv.units_remaining + itemData.quantity })
            .eq('id', storeInv.id);
        } else {
          // Create new inventory entry if doesn't exist
          await supabase
            .from('store_inventory')
            .insert({
              store_id: storeId,
              medicine_id: billItem.medicine_id,
              batch_number: billItem.store_inventory?.batch_number || 'UNKNOWN',
              units_remaining: itemData.quantity,
              units_received: itemData.quantity,
              cost_price_per_unit: billItem.cost_price_per_unit || 0,
              expiry_date: billItem.store_inventory?.expiry_date || new Date().toISOString().split('T')[0],
            });
        }
      }

      // Update bill status to refunded if full return
      if (isFullBillReturn && Object.keys(selectedItems).length === billItems.length) {
        await supabase
          .from('bills')
          .update({ status: 'refunded' })
          .eq('id', selectedBill.id);
      }

      alert(`Return processed successfully! Refund amount: ${fmt(refundAmount)}`);
      setSelectedBill(null);
      setBillItems([]);
      setSelectedItems({});
      setRefundAmount(0);
      fetchBills();
    } catch (error) {
      console.error('Error processing return:', error);
      alert('Error processing return. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--label)', marginBottom: 4 }}>
          🔄 Return Bills
        </div>
        <div style={{ fontSize: 13, color: 'var(--label-4)' }}>
          {storeName} — Process customer returns (within 7 days of purchase)
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search by bill number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            maxWidth: 400,
            padding: '10px 16px',
            border: '1px solid var(--bg-4)',
            borderRadius: 8,
            fontSize: 13,
            fontFamily: 'inherit',
          }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--label-4)', fontSize: 14 }}>
          Loading bills...
        </div>
      ) : (
        <>
          {!selectedBill ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {bills.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--label-4)', fontSize: 14 }}>
                  No bills found
                </div>
              ) : (
                bills
                  .filter(bill => !searchQuery || bill.bill_number.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((bill) => {
                  const daysLeft = getDaysLeft(bill);
                  const eligible = isEligibleForReturn(bill);

                  return (
                    <motion.div
                      key={bill.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={!bill.isReturned ? { scale: 1.01, boxShadow: 'var(--shadow-md)' } : {}}
                      whileTap={!bill.isReturned ? { scale: 0.99 } : {}}
                      style={{
                        background: bill.isReturned ? 'var(--bg-3)' : 'var(--bg-2)',
                        border: `1px solid ${bill.isReturned ? '#B91C1C' : eligible ? 'var(--bg-4)' : 'var(--bg-3)'}`,
                        borderRadius: 12,
                        padding: '16px 20px',
                        cursor: bill.isReturned ? 'not-allowed' : 'pointer',
                        opacity: bill.isReturned ? 0.5 : (eligible ? 1 : 0.7),
                        transition: 'all 0.2s ease',
                      }}
                      onClick={() => handleBillClick(bill)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)', marginBottom: 4 }}>
                            Bill #{bill.bill_number}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--label-4)' }}>
                            {bill.customer_name || 'Walk-in'} · {new Date(bill.created_at).toLocaleDateString('en-IN')}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
                              {fmt(bill.total_amount)}
                            </div>
                            {bill.isReturned && (
                              <div style={{ fontSize: 11, color: '#B91C1C', fontWeight: 600 }}>
                                Refunded: {fmt(bill.refundAmount)}
                              </div>
                            )}
                            <div style={{ fontSize: 11, color: bill.isReturned ? '#B91C1C' : (eligible ? '#15803D' : '#B91C1C'), fontWeight: 600 }}>
                              {bill.isReturned ? 'Returned' : (eligible ? `${daysLeft} days left` : 'Expired')}
                            </div>
                          </div>
                          <div style={{ fontSize: 18, color: 'var(--label-4)' }}>
                            ▼
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <button
                onClick={() => setSelectedBill(null)}
                style={{
                  padding: '8px 16px',
                  background: 'var(--bg-3)',
                  border: '1px solid var(--bg-4)',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginBottom: 16,
                  fontFamily: 'inherit',
                }}
              >
                ← Back to Bills
              </button>

              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--bg-4)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--label)' }}>
                    Bill #{selectedBill.bill_number}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, fontSize: 13, color: 'var(--label-4)' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--label)' }}>Customer:</span> {selectedBill.customer_name || 'Walk-in'}
                  </div>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--label)' }}>Date:</span> {selectedBill.created_at ? new Date(selectedBill.created_at).toLocaleDateString('en-IN') : 'N/A'}
                  </div>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--label)' }}>Total:</span> {fmt(selectedBill.total_amount)}
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--bg-4)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)', marginBottom: 16 }}>
                  Bill Items
                </div>
                {billItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 20, color: 'var(--label-4)', fontSize: 13 }}>
                    No items found
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {billItems.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          padding: '12px 16px',
                          background: 'var(--bg-3)',
                          borderRadius: 8,
                          border: '1px solid var(--bg-4)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--label)', marginBottom: 4 }}>
                              {item.medicines?.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--label-4)' }}>
                              {item.medicines?.strength} · {item.medicines?.type} · Qty: {item.quantity_units}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--label-4)' }}>
                              Batch: {item.store_inventory?.batch_number || 'N/A'} · Exp: {item.store_inventory?.expiry_date ? new Date(item.store_inventory.expiry_date).toLocaleDateString('en-IN') : 'N/A'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                              {fmt(item.selling_price_per_unit * item.quantity_units)}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--label-4)' }}>
                              {fmt(item.selling_price_per_unit)}/unit
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, borderTop: '1px solid var(--bg-4)' }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label)' }}>
                            Return Qty:
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={item.quantity_units}
                            value={selectedItems[item.id]?.quantity || 0}
                            onChange={(e) => handleItemSelection(
                              item.id,
                              parseInt(e.target.value) || 0,
                              item.quantity_units,
                              item.selling_price_per_unit
                            )}
                            style={{
                              width: 100,
                              padding: '6px 10px',
                              border: '1px solid var(--bg-4)',
                              borderRadius: 6,
                              fontSize: 12,
                              fontFamily: 'inherit',
                            }}
                          />
                          <span style={{ fontSize: 11, color: 'var(--label-4)' }}>
                            / {item.quantity_units}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {Object.keys(selectedItems).length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    position: 'sticky',
                    bottom: 20,
                    background: 'var(--bg-1)',
                    border: '1px solid var(--accent)',
                    borderRadius: 12,
                    padding: '16px 24px',
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--label-4)', marginBottom: 4 }}>
                        Refund Amount
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>
                        {fmt(refundAmount)}
                      </div>
                    </div>
                    <button
                      onClick={handleReturn}
                      disabled={processing}
                      style={{
                        padding: '12px 24px',
                        background: 'var(--accent)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: processing ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {processing ? 'Processing...' : 'Process Return'}
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
