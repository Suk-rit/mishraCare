/**
 * AddStock — admin page for bulk stock entry
 * Search medicines → build cart → fill batch details → upload bill → submit for approval
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import { getSession } from '../utils/session';
import AddMedicineModal from '../components/AddMedicineModal';
import { CartRow, emptyBatchRow, validateBatchRow } from '../components/AddBatchModal';
import BillSubmitModal  from '../components/BillSubmitModal';
import CreateTransferModal from '../components/CreateTransferModal';
import MedicineSearchInput from '../components/MedicineSearchInput';
import { TransferIssuePanel } from '../components/AdminTransferReview';
import RefreshButton from '../components/RefreshButton';
import '../styles/products.css';
import '../styles/stores.css';

function TransferIssueInline({ transfer, onResolved }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    supabase.from('stock_transfer_items')
      .select('*, medicines(name, strength, type, pack_size, pack_unit)')
      .eq('transfer_id', transfer.id)
      .then(({ data }) => setItems(data || []));
  }, [transfer.id]);
  if (!items) return <div style={{ padding: '10px 16px', color: 'var(--label-4)', fontSize: 12 }}>Loading…</div>;
  return <TransferIssuePanel transfer={transfer} transferItems={items} onResolved={onResolved} />;
}

export default function AddStock() {
  const session = getSession();

  const [adminRecord,     setAdminRecord]     = useState(null);
  const [cart,            setCart]            = useState([]);
  const [cartErrors,      setCartErrors]      = useState({});
  const [showBillSubmit,  setShowBillSubmit]  = useState(false);
  const [showAddMed,      setShowAddMed]      = useState(false);
  const [showTransfer,    setShowTransfer]    = useState(false);
  const [transfers,       setTransfers]       = useState([]);
  const [showTransferLog, setShowTransferLog] = useState(false);
  const [banner,          setBanner]          = useState(null);

  // ── Approved bills for this admin ─────────────────────────────────────────
  const [approvedBills,     setApprovedBills]     = useState([]);
  const [showApprovedBills, setShowApprovedBills] = useState(false);
  const [billsLoading,      setBillsLoading]      = useState(false);

  useEffect(() => {
    if (session?.email) {
      supabase.from('admins').select('id, full_name').eq('email', session.email).single()
        .then(({ data }) => {
          setAdminRecord(data || null);
          if (data?.id) fetchApprovedBills(data.id);
        });
    }
    fetchTransfers();
  }, []);

  const fetchApprovedBills = async (adminId) => {
    setBillsLoading(true);
    const { data } = await supabase
      .from('purchase_order_bills')
      .select('*')
      .eq('admin_id', adminId)
      .order('approved_at', { ascending: false })
      .limit(30);
    setApprovedBills(data || []);
    setBillsLoading(false);
  };

  const fetchTransfers = async () => {
    const { data } = await supabase
      .from('stock_transfers')
      .select('*, stores(store_name, city)')
      .order('dispatched_at', { ascending: false })
      .limit(20);
    setTransfers(data || []);
  };

  // ── Banner helper ─────────────────────────────────────────────────────────
  const showBannerMsg = (msg) => {
    setBanner(msg);
    setTimeout(() => setBanner(null), 6000);
  };

  // ── Cart handlers ─────────────────────────────────────────────────────────
  const handleMedicineSelect = (med) => {
    if (cart.some(c => c.medicine.id === med.id)) {
      showBannerMsg(`⚠️ ${med.name} is already in the cart.`);
      return;
    }
    setCart(prev => [...prev, { medicine: med, row: emptyBatchRow() }]);
  };

  const updateCartRow = (idx, field, value) => {
    setCart(prev => prev.map((c, i) =>
      i === idx ? { ...c, row: { ...c.row, [field]: value } } : c
    ));
    setCartErrors(prev => {
      const copy = { ...prev };
      if (copy[idx]) copy[idx] = { ...copy[idx], [field]: undefined };
      return copy;
    });
  };

  const removeFromCart = (idx) => {
    setCart(prev => prev.filter((_, i) => i !== idx));
    setCartErrors(prev => { const n = { ...prev }; delete n[idx]; return n; });
  };

  const validateCart = () => {
    if (cart.length === 0) return false;
    const errs = {};
    let valid = true;
    cart.forEach(({ medicine, row }, idx) => {
      const e = validateBatchRow(row, medicine);
      if (Object.keys(e).length) { errs[idx] = e; valid = false; }
    });
    setCartErrors(errs);
    return valid;
  };

  const handleAddToStock = () => {
    if (!cart.length) { showBannerMsg('⚠️ Add at least one medicine to the cart first.'); return; }
    if (!validateCart()) { showBannerMsg('⚠️ Fill in all required fields before proceeding.'); return; }
    setShowBillSubmit(true);
  };

  const handleSubmitSuccess = () => {
    setShowBillSubmit(false);
    setCart([]);
    setCartErrors({});
    fetchTransfers();
    if (adminRecord?.id) fetchApprovedBills(adminRecord.id);
    showBannerMsg('📦 Stock request submitted! Batches are pending approval.');
  };

  const cartTotalUnits = cart.reduce((sum, { medicine, row }) => {
    const ps = medicine.pack_size || 1;
    return sum + (parseInt(row.quantity_packs, 10) || 0) * ps + (parseInt(row.quantity_loose, 10) || 0);
  }, 0);

  const dispatchedCount = transfers.filter(t => t.status === 'dispatched').length;

  const isWarning = banner?.startsWith('⚠️');

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="products-page" style={{ fontFamily: "'Inter',-apple-system,sans-serif" }}>

      {/* Banner */}
      <AnimatePresence>
        {banner && (
          <motion.div key="banner"
            initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
            style={{
              background: isWarning ? '#FEF3C7' : '#DCFCE7',
              border: `1px solid ${isWarning ? '#FDE68A' : '#BBF7D0'}`,
              color: isWarning ? '#92400E' : '#15803D',
              borderRadius: 12, padding: '12px 18px', marginBottom: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 14, fontWeight: 500, boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
            }}>
            <span>{banner}</span>
            <button onClick={() => setBanner(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 16, padding: '0 4px', color: 'inherit' }}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page header */}
      <div className="products-topbar">
        <div>
          <div className="products-title">📥 Add <span>Stock</span></div>
          <div className="products-sub">
            Search medicines, fill batch details for each, then upload the stockist bill and submit for approval.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <RefreshButton onRefresh={fetchTransfers} />
          <button onClick={() => setShowTransfer(true)}
            style={{ background: 'linear-gradient(145deg,#34C759,#28A745)', color: '#fff',
              border: 'none', borderRadius: 12, padding: '10px 20px', fontSize: 13,
              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 3px 12px rgba(52,199,89,0.3)' }}>
            🚚 Transfer Stock
          </button>
          <button onClick={() => setShowTransferLog(v => !v)}
            style={{ background: 'var(--bg-2)', color: 'var(--label-2)',
              border: '1px solid var(--bg-4)', borderRadius: 12, padding: '10px 18px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            📋 Transfers
            {dispatchedCount > 0 && (
              <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 20,
                padding: '1px 7px', fontSize: 11, fontWeight: 700, marginLeft: 6 }}>
                {dispatchedCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Transfer log */}
      <AnimatePresence>
        {showTransferLog && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--bg-4)',
              borderRadius: 'var(--radius-lg)', padding: '16px 20px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--label-4)',
                textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
                Recent Transfers
              </div>
              {transfers.length === 0 ? (
                <div style={{ color: 'var(--label-4)', fontSize: 13, textAlign: 'center', padding: 16 }}>
                  No transfers yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {transfers.map(t => {
                    const SC = {
                      dispatched:         { bg: '#EFF6FF', color: '#1D4ED8' },
                      received:           { bg: '#DCFCE7', color: '#15803D' },
                      issue_reported:     { bg: '#FEE2E2', color: '#B91C1C' },
                      partially_received: { bg: '#FEF3C7', color: '#92400E' },
                      cancelled:          { bg: 'var(--bg-4)', color: 'var(--label-4)' },
                    };
                    const sc = SC[t.status] || SC.dispatched;
                    const hasIssue = t.status === 'issue_reported';
                    return (
                      <div key={t.id} style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius-md)',
                        border: `1px solid ${hasIssue ? '#FECACA' : 'var(--bg-4)'}`, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
                          <span style={{ fontSize: 18 }}>🚚</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--label)' }}>
                              {t.stores?.store_name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--label-4)' }}>
                              {new Date(t.dispatched_at).toLocaleString('en-IN')}
                            </div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px',
                            borderRadius: 20, background: sc.bg, color: sc.color,
                            textTransform: 'uppercase' }}>
                            {t.status.replace('_', ' ')}
                          </span>
                        </div>
                        {hasIssue && (
                          <TransferIssueInline transfer={t} onResolved={fetchTransfers} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search card ── */}
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--bg-4)',
        borderRadius: 'var(--radius-lg)', padding: '24px 26px', marginBottom: 24,
        boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)', marginBottom: 4 }}>
          🔍 Search &amp; Add to Cart
        </div>
        <div style={{ fontSize: 13, color: 'var(--label-4)', marginBottom: 16 }}>
          Search a medicine name, salt, brand or company. Select it to add to the cart below.
        </div>
        <MedicineSearchInput
          onSelect={handleMedicineSelect}
          onAddNew={() => setShowAddMed(true)}
        />
        <div style={{ marginTop: 10, padding: '9px 14px', background: '#EFF6FF',
          border: '1px solid #BFDBFE', borderRadius: 10, fontSize: 12, color: '#1D4ED8' }}>
          💡 Add as many medicines as you need. Fill details for each, then click{' '}
          <strong>"Add to Stock"</strong> to upload the bill and submit all at once.
        </div>
      </div>

      {/* ── Cart ── */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div key="cart"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--bg-4)',
              borderRadius: 'var(--radius-lg)', padding: '24px 26px',
              boxShadow: 'var(--shadow-sm)' }}>

              {/* Cart header */}
              <div style={{ display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--label)' }}>
                    🛒 Cart
                  </span>
                  <span style={{ marginLeft: 10, background: 'var(--accent)', color: '#fff',
                    borderRadius: 20, padding: '3px 12px', fontSize: 13, fontWeight: 600 }}>
                    {cart.length} item{cart.length !== 1 ? 's' : ''}
                  </span>
                  {cartTotalUnits > 0 && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--label-4)', fontWeight: 500 }}>
                      · {cartTotalUnits} total units
                    </span>
                  )}
                </div>
                <button onClick={() => { setCart([]); setCartErrors({}); }}
                  style={{ background: '#FEE2E2', color: '#B91C1C', border: 'none',
                    borderRadius: 8, padding: '6px 16px', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit' }}>
                  Clear All
                </button>
              </div>

              {/* Cart rows */}
              <AnimatePresence>
                {cart.map(({ medicine, row }, idx) => (
                  <CartRow
                    key={medicine.id}
                    index={idx}
                    medicine={medicine}
                    row={row}
                    errors={cartErrors[idx] || {}}
                    onChange={(field, value) => updateCartRow(idx, field, value)}
                    onRemove={() => removeFromCart(idx)}
                  />
                ))}
              </AnimatePresence>

              {/* Divider + CTA */}
              <div style={{ borderTop: '1px solid var(--bg-4)', marginTop: 16, paddingTop: 16,
                display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, fontSize: 13, color: 'var(--label-4)' }}>
                  Once all details are filled, click{' '}
                  <strong style={{ color: 'var(--label)' }}>Add to Stock</strong>{' '}
                  to upload the stockist bill and submit for approval.
                </div>
                <button onClick={handleAddToStock}
                  style={{ background: 'linear-gradient(145deg,#FF3B30,#D93025)',
                    color: '#fff', border: 'none', borderRadius: 12,
                    padding: '13px 32px', fontSize: 15, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                    boxShadow: '0 4px 16px rgba(255,59,48,0.3)',
                    display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                  📦 Add to Stock
                  <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20,
                    padding: '2px 10px', fontSize: 13 }}>
                    {cart.length}
                  </span>
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty cart hint */}
      {cart.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', background: 'var(--bg-2)',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--bg-4)',
          boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 48, opacity: 0.15, marginBottom: 14 }}>🛒</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--label-3)', marginBottom: 6 }}>
            Cart is empty
          </div>
          <div style={{ fontSize: 13, color: 'var(--label-4)' }}>
            Search for a medicine above to get started
          </div>
        </div>
      )}

      {/* ── Approved Stocks (previous bills) ── */}
      <div style={{ marginTop: 32 }}>
        {/* Section header — always visible */}
        <button
          onClick={() => setShowApprovedBills(v => !v)}
          style={{ width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', padding: '14px 20px',
            background: 'var(--bg-2)', border: '1px solid var(--bg-4)',
            borderRadius: showApprovedBills ? '14px 14px 0 0' : 14,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: 'var(--shadow-sm)', transition: 'border-radius 0.15s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)' }}>
                Approved Stocks
              </div>
              <div style={{ fontSize: 12, color: 'var(--label-4)' }}>
                Previously submitted batches that were approved by Devta
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {approvedBills.length > 0 && (
              <span style={{ background: '#DCFCE7', color: '#15803D',
                borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700,
                border: '1px solid #BBF7D0' }}>
                {approvedBills.length} bill{approvedBills.length !== 1 ? 's' : ''}
              </span>
            )}
            <span style={{ fontSize: 14, color: 'var(--label-4)' }}>
              {showApprovedBills ? '▲' : '▼'}
            </span>
          </div>
        </button>

        <AnimatePresence>
          {showApprovedBills && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
              <div style={{ background: 'var(--bg-2)',
                border: '1px solid var(--bg-4)', borderTop: 'none',
                borderRadius: '0 0 14px 14px', padding: '16px 20px',
                boxShadow: 'var(--shadow-sm)' }}>

                {billsLoading ? (
                  <div style={{ textAlign: 'center', padding: '24px 0',
                    color: 'var(--label-4)', fontSize: 13 }}>
                    Loading…
                  </div>
                ) : approvedBills.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 0' }}>
                    <div style={{ fontSize: 36, opacity: 0.2, marginBottom: 10 }}>📋</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--label-3)',
                      marginBottom: 4 }}>
                      No approved bills yet
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--label-4)' }}>
                      Batches you submit will appear here once approved by Devta
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {approvedBills.map((bill, i) => (
                      <motion.div key={bill.id}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        style={{ background: 'var(--bg-3)',
                          border: '1px solid var(--bg-4)', borderRadius: 12,
                          overflow: 'hidden' }}>

                        {/* Row */}
                        <div style={{ display: 'flex', alignItems: 'center',
                          gap: 12, padding: '12px 16px', flexWrap: 'wrap' }}>
                          {/* Icon */}
                          <div style={{ width: 38, height: 38, borderRadius: 10,
                            background: '#DCFCE7', border: '1px solid #BBF7D0',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 18, flexShrink: 0 }}>
                            ✅
                          </div>
                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800,
                              color: '#15803D', fontFamily: 'monospace', marginBottom: 2 }}>
                              {bill.bill_number}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--label-4)',
                              display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                              <span>🗓️ {new Date(bill.approved_at).toLocaleDateString('en-IN',
                                { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                              {bill.supplier_name && <span>🏭 {bill.supplier_name}</span>}
                            </div>
                          </div>
                          {/* Stats */}
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap',
                            flexShrink: 0 }}>
                            <span style={{ fontSize: 11, fontWeight: 600,
                              padding: '2px 8px', borderRadius: 20,
                              background: '#EFF6FF', color: '#1D4ED8',
                              border: '1px solid #BFDBFE' }}>
                              {bill.total_batches} batch{bill.total_batches !== 1 ? 'es' : ''}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 600,
                              padding: '2px 8px', borderRadius: 20,
                              background: '#F0FDF4', color: '#15803D',
                              border: '1px solid #BBF7D0' }}>
                              ₹{Number(bill.bill_amount).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 8, padding: '8px 16px',
                          borderTop: '1px solid var(--bg-4)',
                          background: 'rgba(0,0,0,0.02)', flexWrap: 'wrap' }}>
                          {bill.stockist_bill_url && (
                            <a href={bill.stockist_bill_url} target="_blank" rel="noreferrer"
                              style={{ padding: '5px 12px', background: '#EFF6FF',
                                color: '#1D4ED8', borderRadius: 7, fontSize: 11,
                                fontWeight: 600, textDecoration: 'none' }}>
                              📄 Stockist Bill
                            </a>
                          )}
                          {bill.pdf_url && (
                            <button
                              onClick={async () => {
                                const res = await fetch(bill.pdf_url);
                                const html = await res.text();
                                const win = window.open('', '_blank');
                                win.document.open();
                                win.document.write(html);
                                win.document.close();
                              }}
                              style={{ padding: '5px 12px', background: '#DCFCE7',
                                color: '#15803D', border: 'none', borderRadius: 7,
                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                fontFamily: 'inherit' }}>
                              📋 View Bill
                            </button>
                          )}
                          {bill.pdf_url && (
                            <button
                              onClick={async () => {
                                const res = await fetch(bill.pdf_url);
                                const html = await res.text();
                                const printHtml = html.replace(
                                  '</body>',
                                  `<script>window.onload=function(){setTimeout(function(){window.print();},400);}<\/script></body>`
                                );
                                const win = window.open('', '_blank');
                                win.document.open();
                                win.document.write(printHtml);
                                win.document.close();
                              }}
                              style={{ padding: '5px 12px', background: '#FEF3C7',
                                color: '#92400E', border: 'none', borderRadius: 7,
                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                fontFamily: 'inherit' }}>
                              🖨️ Save as PDF
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showAddMed && (
          <AddMedicineModal
            onClose={() => setShowAddMed(false)}
            onSuccess={() => {
              setShowAddMed(false);
              showBannerMsg('💊 Medicine added to catalog! Now search for it and add to your cart.');
            }}
          />
        )}
        {showBillSubmit && (
          <BillSubmitModal
            cart={cart}
            adminRecord={adminRecord}
            onClose={() => setShowBillSubmit(false)}
            onSuccess={handleSubmitSuccess}
          />
        )}
        {showTransfer && (
          <CreateTransferModal
            onClose={() => setShowTransfer(false)}
            onSuccess={() => { setShowTransfer(false); fetchTransfers(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
