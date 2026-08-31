import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import DoctorSearchInput from '../components/DoctorSearchInput';
import RefreshButton from '../components/RefreshButton';

const TYPE_ICONS = {
  Tablet:'💊',Capsule:'💊',Syrup:'🧴',Injection:'💉',Drops:'💧',
  Cream:'🧴',Ointment:'🧴',Powder:'🧂',Inhaler:'🌬️',Patch:'🩹',
  Suppository:'💊',Lozenges:'🍬',Other:'📦',
};

function fmt(n) { return '₹' + Number(n || 0).toFixed(2); }
function dLeft(d) { return Math.ceil((new Date(d) - new Date()) / 86400000); }
function packLabel(type) {
  if (['Syrup','Drops'].includes(type)) return 'Bottle';
  if (type === 'Injection') return 'Vial';
  if (type === 'Cream' || type === 'Ointment') return 'Tube';
  return 'Strip';
}
function totalUnits(item) { return item.packs * item.packSize + item.loose; }

// ── Generate A4 bill HTML and open print dialog ────────────────────────────────
function printBill({ bill, items, customer, doctor, store, payments }) {
  const fmtD = d => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
  const now = new Date();
  const printedOn = now.toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' }) +
    ' ' + now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });

  const itemRows = items.map((item, i) => {
    const mrpUnit  = item.mrpPack / (item.packSize || 1);
    const discAmt  = mrpUnit * (item.discountPct || 0) / 100;
    const finalP   = item.sellPrice;
    const lineTotal = finalP * totalUnits(item);
    return `
      <tr>
        <td>${i + 1}</td>
        <td>
          <div style="font-weight:600">${item.name}</div>
          <div style="font-size:10px;color:#666">Batch: ${item.batch} &nbsp;|&nbsp; Exp: ${fmtD(item.expiry)}</div>
        </td>
        <td style="text-align:center">${item.packSize} ${item.packUnit}</td>
        <td style="text-align:center">${totalUnits(item)}</td>
        <td style="text-align:right">₹${mrpUnit.toFixed(2)}</td>
        <td style="text-align:center">${item.discountPct ? item.discountPct + '%' : '—'}</td>
        <td style="text-align:right">₹${finalP.toFixed(2)}</td>
        <td style="text-align:right">₹${lineTotal.toFixed(2)}</td>
      </tr>`;
  }).join('');

  const paymentLines = payments
    .filter(p => parseFloat(p.amount) > 0)
    .map(p => `<div style="display:flex;justify-content:space-between;padding:3px 0">
      <span>${p.label}</span><span style="font-weight:700">₹${parseFloat(p.amount).toFixed(2)}</span>
    </div>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Bill ${bill.bill_number}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  @page{size:A4 portrait;margin:14mm 12mm;}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#111;background:#fff;line-height:1.5;}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:12px;}
  .company-name{font-size:20px;font-weight:900;letter-spacing:-0.5px;}
  .bill-title{font-size:15px;font-weight:800;text-align:right;text-transform:uppercase;letter-spacing:1px;}
  .bill-no{font-size:11px;color:#555;margin-top:3px;text-align:right;}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;font-size:11px;}
  .meta-box{padding:8px 10px;border:1px solid #ddd;border-radius:4px;}
  .meta-label{font-size:9.5px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;}
  .meta-value{font-weight:600;color:#111;}
  table{width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:14px;}
  thead tr{background:#111;color:#fff;}
  thead th{padding:6px 7px;text-align:left;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;}
  tbody tr:nth-child(even){background:#f9f9f9;}
  tbody td{padding:6px 7px;border-bottom:1px solid #eee;vertical-align:middle;}
  .totals{display:flex;justify-content:flex-end;margin-bottom:14px;}
  .totals-box{width:220px;border:1.5px solid #111;border-radius:4px;overflow:hidden;}
  .totals-row{display:flex;justify-content:space-between;padding:5px 10px;border-bottom:1px solid #eee;font-size:11px;}
  .totals-row:last-child{border-bottom:none;background:#111;color:#fff;font-weight:800;font-size:13px;}
  .payment-section{border:1px solid #ddd;border-radius:4px;padding:10px 12px;margin-bottom:14px;font-size:11px;}
  .footer{text-align:center;font-size:9.5px;color:#aaa;border-top:1px solid #eee;padding-top:10px;margin-top:12px;}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="company-name">MishraCare Pharmacy</div>
    <div style="font-size:10px;color:#555;margin-top:3px">${store?.store_name || ''}</div>
    <div style="font-size:10px;color:#555">${[store?.address_line1, store?.city, store?.state].filter(Boolean).join(', ')}</div>
    ${store?.gstin ? `<div style="font-size:10px;color:#555">GSTIN: ${store.gstin}</div>` : ''}
  </div>
  <div>
    <div class="bill-title">Tax Invoice</div>
    <div class="bill-no">Bill No: <strong>${bill.bill_number}</strong></div>
    <div class="bill-no">Printed On: ${printedOn}</div>
  </div>
</div>

<div class="meta-grid">
  <div class="meta-box">
    <div class="meta-label">Patient / Customer</div>
    <div class="meta-value">${customer.name || 'Walk-in Customer'}</div>
    ${customer.phone ? `<div style="font-size:10px;color:#555">📞 ${customer.phone}</div>` : ''}
  </div>
  <div class="meta-box">
    <div class="meta-label">Referred By</div>
    <div class="meta-value">${doctor ? doctor.name : '—'}</div>
    ${doctor?.speciality ? `<div style="font-size:10px;color:#555">${doctor.speciality}</div>` : ''}
    ${doctor?.clinic_name ? `<div style="font-size:10px;color:#555">${doctor.clinic_name}</div>` : ''}
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Medicine</th>
      <th style="text-align:center">Pack</th>
      <th style="text-align:center">Qty</th>
      <th style="text-align:right">MRP/Unit</th>
      <th style="text-align:center">Disc%</th>
      <th style="text-align:right">Rate</th>
      <th style="text-align:right">Amount</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>

<div class="totals">
  <div class="totals-box">
    <div class="totals-row"><span>MRP Subtotal</span><span>${fmt(bill.subtotal + bill.discount_amount)}</span></div>
    ${bill.discount_amount > 0 ? `<div class="totals-row"><span>Discount</span><span>− ${fmt(bill.discount_amount)}</span></div>` : ''}
    ${bill.discount_amount > 0 ? `<div class="totals-row"><span>After Discount</span><span>${fmt(bill.subtotal)}</span></div>` : ''}
    <div class="totals-row"><span>GST (5%)</span><span>+ ${fmt(bill.tax_amount)}</span></div>
    <div class="totals-row"><span>Grand Total</span><span>${fmt(bill.total_amount)}</span></div>
  </div>
</div>

<div class="payment-section">
  <div style="font-size:9.5px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Payment Details</div>
  ${paymentLines}
</div>

<div class="footer">
  Thank you for choosing MishraCare Pharmacy · This is a computer-generated bill · ${bill.bill_number}
</div>

<script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.open();
  win.document.write(html);
  win.document.close();
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function BillingPage({ storeId, managerId }) {
  const [inventory,    setInventory]   = useState([]);
  const [storeInfo,    setStoreInfo]   = useState(null);
  const [cartItems,    setCartItems]   = useState([]);
  const [search,       setSearch]      = useState('');
  const [customer,     setCustomer]    = useState({ name: '', phone: '' });
  const [doctor,       setDoctor]      = useState(null);  // referred by
  const [payments,     setPayments]    = useState({ cash: '', card: '', upi: '' });
  const [saving,       setSaving]      = useState(false);
  const [savedBill,    setSavedBill]   = useState(null);
  const [recentBills,  setRecentBills] = useState([]);
  const [view,         setView]        = useState('new');
  const [setPriceFor,  setSetPriceFor] = useState(null);
  const [priceInput,   setPriceInput]  = useState('');

  useEffect(() => {
    if (!storeId) return;
    fetchInventory();
    fetchRecentBills();
    supabase.from('stores').select('store_name, address_line1, city, state, gstin').eq('id', storeId).single()
      .then(({ data }) => setStoreInfo(data));
  }, [storeId]);

  const fetchInventory = async () => {
    const { data } = await supabase
      .from('store_inventory')
      .select('*, medicines(id, name, strength, type, pack_size, pack_unit), discount_percent')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .gt('units_remaining', 0)
      .order('expiry_date');
    setInventory(data || []);
  };

  const fetchRecentBills = async () => {
    const { data } = await supabase
      .from('bills')
      .select('*, bill_items(id, medicine_name, quantity_units, line_total), doctors(name, speciality)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(30);
    setRecentBills(data || []);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return inventory;
    const q = search.toLowerCase();
    return inventory.filter(i =>
      i.medicines?.name?.toLowerCase().includes(q) ||
      i.batch_number?.toLowerCase().includes(q)
    );
  }, [inventory, search]);

  const byMedicine = useMemo(() => {
    const map = {};
    filtered.forEach(i => {
      const mid = i.medicine_id;
      if (!map[mid]) map[mid] = { medicine: i.medicines, batches: [] };
      map[mid].batches.push(i);
    });
    Object.values(map).forEach(m =>
      m.batches.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))
    );
    return Object.values(map);
  }, [filtered]);

  const addToCart = (invItem) => {
    if (cartItems.some(c => c.invId === invItem.id)) return;
    const ps       = invItem.medicines?.pack_size || 1;
    const mrpPack  = invItem.mrp_per_pack || 0;
    const discPct  = invItem.discount_percent || 0;
    const mrpUnit  = mrpPack / ps;
    const discUnit = mrpUnit * discPct / 100;
    const sellP    = invItem.selling_price_per_unit || (mrpUnit - discUnit);
    const costP    = invItem.cost_price_per_pack ? invItem.cost_price_per_pack / ps : 0;
    setCartItems(p => [...p, {
      invId:       invItem.id,
      medId:       invItem.medicine_id,
      name:        invItem.medicines?.name + (invItem.medicines?.strength ? ` ${invItem.medicines.strength}` : ''),
      medType:     invItem.medicines?.type || 'Other',
      batch:       invItem.batch_number,
      expiry:      invItem.expiry_date,
      packSize:    ps,
      packUnit:    invItem.medicines?.pack_unit || 'unit',
      maxUnits:    invItem.units_remaining,
      packs:       1,
      loose:       0,
      sellPrice:   parseFloat(sellP || 0),
      costPrice:   parseFloat(costP || 0),
      mrpPack:     mrpPack,
      discountPct: parseFloat(discPct || 0),
    }]);
  };

  const updateCart = (invId, field, val) =>
    setCartItems(p => p.map(c => c.invId === invId ? { ...c, [field]: val } : c));
  const removeFromCart = (invId) =>
    setCartItems(p => p.filter(c => c.invId !== invId));

  // ── Financials ─────────────────────────────────────────────────────────────
  // mrpSubtotal = sum of (mrp_per_unit × qty) for each item — before any discount
  const mrpSubtotal   = cartItems.reduce((s, c) => {
    const mrpUnit = c.mrpPack / (c.packSize || 1);
    return s + mrpUnit * totalUnits(c);
  }, 0);
  // discountTotal = total savings from per-medicine discounts
  const discountTotal = cartItems.reduce((s, c) => {
    const mrpUnit  = c.mrpPack / (c.packSize || 1);
    const discAmt  = mrpUnit * (c.discountPct || 0) / 100;
    return s + discAmt * totalUnits(c);
  }, 0);
  // afterDiscount = mrpSubtotal − discountTotal (this is what sellPrice already reflects)
  const afterDiscount = mrpSubtotal - discountTotal;
  // GST 5% on afterDiscount
  const GST_RATE      = 5;
  const gstAmount     = afterDiscount * GST_RATE / 100;
  // Grand total = afterDiscount + GST
  const grandTotal    = afterDiscount + gstAmount;
  const totalCost     = cartItems.reduce((s, c) => s + c.costPrice * totalUnits(c), 0);
  // subtotal kept for DB compat (= afterDiscount, pre-GST)
  const subtotal      = afterDiscount;
  const cashAmt   = parseFloat(payments.cash) || 0;
  const cardAmt   = parseFloat(payments.card) || 0;
  const upiAmt    = parseFloat(payments.upi)  || 0;
  const paidTotal = cashAmt + cardAmt + upiAmt;
  const balance   = grandTotal - paidTotal;

  const dominantMethod = () => {
    if (cardAmt > 0 && upiAmt > 0 && cashAmt > 0) return 'split';
    if (cardAmt > 0 && upiAmt > 0) return 'split';
    if (cardAmt > 0 && cashAmt > 0) return 'split';
    if (upiAmt > 0 && cashAmt > 0) return 'split';
    if (cardAmt > 0) return 'card';
    if (upiAmt > 0) return 'upi';
    return 'cash';
  };

  // ── Set sell price ─────────────────────────────────────────────────────────
  const handleSaveSellPrice = async () => {
    if (!setPriceFor || !priceInput) return;
    const price = parseFloat(priceInput);
    if (isNaN(price) || price <= 0) { window.alert('Enter a valid price'); return; }
    await supabase.from('store_inventory').update({ selling_price_per_unit: price }).eq('id', setPriceFor.id);
    setSetPriceFor(null); setPriceInput('');
    fetchInventory();
    setCartItems(p => p.map(c => c.invId === setPriceFor.id ? { ...c, sellPrice: price } : c));
  };

  // ── Generate bill number ───────────────────────────────────────────────────
  const generateBillNumber = async () => {
    const { count } = await supabase.from('bills').select('*', { count: 'exact', head: true }).eq('store_id', storeId);
    const d = new Date();
    const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    return `MC-${date}-${String((count || 0) + 1).padStart(4, '0')}`;
  };

  // ── Submit bill ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!cartItems.length) { window.alert('Add medicines to the bill first'); return; }
    for (const item of cartItems) {
      const units = totalUnits(item);
      if (units <= 0) { window.alert(`${item.name}: quantity must be > 0`); return; }
      if (units > item.maxUnits) { window.alert(`${item.name}: only ${item.maxUnits} units available`); return; }
    }
    if (paidTotal <= 0) { window.alert('Enter payment amount'); return; }
    if (Math.abs(balance) > 0.01) {
      const ok = window.confirm(`Payment total ₹${paidTotal.toFixed(2)} ≠ Bill total ₹${grandTotal.toFixed(2)}. Proceed anyway?`);
      if (!ok) return;
    }
    setSaving(true);
    try {
      const billNo = await generateBillNumber();
      const { data: bill, error: bErr } = await supabase.from('bills').insert({
        store_id:        storeId,
        bill_number:     billNo,
        customer_name:   customer.name.trim() || null,
        customer_phone:  customer.phone.trim() || null,
        referred_by:     doctor?.id || null,
        subtotal:        subtotal.toFixed(2),
        discount_amount: discountTotal.toFixed(2),
        tax_amount:      gstAmount.toFixed(2),
        total_amount:    grandTotal.toFixed(2),
        total_cost:      totalCost.toFixed(2),
        payment_method:  dominantMethod(),
        cash_amount:     cashAmt.toFixed(2),
        card_amount:     cardAmt.toFixed(2),
        upi_amount:      upiAmt.toFixed(2),
        status:          'paid',
        billed_by:       managerId || null,
      }).select().single();
      if (bErr) throw new Error(bErr.message);

      for (const item of cartItems) {
        const units = totalUnits(item);
        await supabase.from('bill_items').insert({
          bill_id:                bill.id,
          store_inventory_id:     item.invId,
          medicine_id:            item.medId,
          medicine_name:          item.name,
          batch_number:           item.batch,
          expiry_date:            item.expiry,
          quantity_units:         units,
          pack_size:              item.packSize,
          selling_price_per_unit: item.sellPrice,
          cost_price_per_unit:    item.costPrice,
          discount_percent:       item.discountPct,
        });
        // Always fetch fresh stock before deducting (prevent race conditions)
        const { data: fresh } = await supabase
          .from('store_inventory').select('units_remaining').eq('id', item.invId).single();
        const newRem = (fresh?.units_remaining || 0) - units;
        await supabase.from('store_inventory').update({
          units_remaining: Math.max(0, newRem),
          is_active: newRem > 0,
        }).eq('id', item.invId);
      }

      // Print
      printBill({
        bill:     { ...bill, subtotal, discount_amount: discountTotal, tax_amount: gstAmount, total_amount: grandTotal },
        items:    cartItems,
        customer,
        doctor,
        store:    storeInfo,
        payments: [
          { label: 'Cash', amount: cashAmt },
          { label: 'Card', amount: cardAmt },
          { label: 'UPI',  amount: upiAmt  },
        ],
      });

      setSavedBill({ ...bill, cartItems, subtotal, discountTotal, gstAmount, grandTotal, totalCost });
      setCartItems([]); setCustomer({ name: '', phone: '' });
      setDoctor(null); setPayments({ cash: '', card: '', upi: '' });
      fetchInventory(); fetchRecentBills();
    } catch (err) {
      window.alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Saved bill screen ──────────────────────────────────────────────────────
  if (savedBill) return (
    <div style={{ fontFamily:"'Inter',-apple-system,sans-serif", padding: 28, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ background:'var(--bg-2)', border:'2px solid #BBF7D0', borderRadius:16, padding: 28 }}>
        <div style={{ textAlign:'center', marginBottom: 20 }}>
          <div style={{ fontSize:44, marginBottom:8 }}>✅</div>
          <div style={{ fontSize:20, fontWeight:800, color:'#15803D' }}>Bill Saved!</div>
          <div style={{ fontSize:13, color:'var(--label-4)', marginTop:3 }}>#{savedBill.bill_number}</div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:18 }}>
          {[
            { label:'Grand Total', value: fmt(savedBill.grandTotal),                              color:'#007AFF' },
            { label:'Profit',      value: fmt(savedBill.grandTotal - savedBill.totalCost),        color:'#34C759' },
            { label:'Discount',    value: fmt(savedBill.discountTotal),                           color:'#FF3B30' },
            { label:'GST (5%)',    value: fmt(savedBill.gstAmount),                               color:'#FF9500' },
          ].map((s, i) => (
            <div key={i} style={{ textAlign:'center', padding:'12px 8px', background:'var(--bg-3)', borderRadius:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--label-4)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>{s.label}</div>
              <div style={{ fontSize:18, fontWeight:800, color:s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
        <button onClick={() => setSavedBill(null)}
          style={{ width:'100%', padding:13, background:'linear-gradient(145deg,#FF3B30,#D93025)', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 3px 12px rgba(255,59,48,0.3)' }}>
          + New Bill
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily:"'Inter',-apple-system,sans-serif", padding:'20px 24px', maxWidth:1200, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:700, color:'var(--label)', letterSpacing:'-0.3px' }}>🧾 Billing</div>
          <div style={{ fontSize:13, color:'var(--label-4)' }}>FEFO stock · discounts applied · professional A4 bill printed on save</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <RefreshButton onRefresh={fetchInventory} label="Refresh Stock" />
          {['new','history'].map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding:'8px 18px', borderRadius:10, border:'1px solid var(--bg-4)',
                fontFamily:'inherit', fontSize:13, fontWeight:600, cursor:'pointer',
                background: view===v ? 'var(--accent-bg)' : 'var(--bg-2)',
                color:      view===v ? 'var(--accent)' : 'var(--label-3)' }}>
              {v === 'new' ? '+ New Bill' : '📋 History'}
            </button>
          ))}
        </div>
      </div>

      {/* Set Price modal */}
      <AnimatePresence>
        {setPriceFor && (
          <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.3)',
            backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center' }}
            onClick={e => e.target === e.currentTarget && setSetPriceFor(null)}>
            <motion.div initial={{ opacity:0, scale:0.95, y:20 }} animate={{ opacity:1, scale:1, y:0 }}
              exit={{ opacity:0, scale:0.95, y:20 }}
              style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)', borderRadius:16,
                padding:'24px 28px', width:360, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
              <div style={{ fontSize:16, fontWeight:700, color:'var(--label)', marginBottom:4 }}>Set Selling Price</div>
              <div style={{ fontSize:13, color:'var(--label-4)', marginBottom:12 }}>
                {setPriceFor.medicines?.name} · Batch {setPriceFor.batch_number}
              </div>
              <div style={{ padding:'10px 14px', background:'var(--bg-3)', borderRadius:10, marginBottom:14, fontSize:12, color:'var(--label-3)' }}>
                <div>MRP: {fmt(setPriceFor.mrp_per_pack)} / pack</div>
                {(setPriceFor.discount_percent > 0) && (
                  <div style={{ color:'#FF3B30', fontWeight:600 }}>
                    Discount: {setPriceFor.discount_percent}% → Suggested: {fmt((setPriceFor.mrp_per_pack / (setPriceFor.medicines?.pack_size||1)) * (1 - setPriceFor.discount_percent/100))}/{setPriceFor.medicines?.pack_unit}
                  </div>
                )}
              </div>
              <input type="number" value={priceInput} onChange={e => setPriceInput(e.target.value)}
                placeholder={`Selling price per ${setPriceFor.medicines?.pack_unit} (₹)`}
                style={{ width:'100%', padding:'10px 13px', border:'1.5px solid var(--bg-4)',
                  borderRadius:10, fontSize:14, fontFamily:'inherit', color:'var(--label)',
                  background:'var(--bg-3)', outline:'none', boxSizing:'border-box', marginBottom:14 }}
                onFocus={e => e.target.style.borderColor='var(--accent)'}
                onBlur={e  => e.target.style.borderColor='var(--bg-4)'} />
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => setSetPriceFor(null)}
                  style={{ flex:1, padding:9, background:'var(--bg-3)', border:'1px solid var(--bg-4)',
                    color:'var(--label-3)', borderRadius:10, fontSize:13, fontWeight:600,
                    cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button onClick={handleSaveSellPrice}
                  style={{ flex:2, padding:9, background:'linear-gradient(145deg,#FF3B30,#D93025)',
                    color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:700,
                    cursor:'pointer', fontFamily:'inherit' }}>Save Price</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History */}
      {view === 'history' ? (
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
            <RefreshButton onRefresh={fetchRecentBills} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {recentBills.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px 20px', background:'var(--bg-2)',
                borderRadius:14, border:'1px solid var(--bg-4)', color:'var(--label-4)', fontSize:14 }}>
                No bills yet
              </div>
            ) : recentBills.map(bill => (
              <div key={bill.id} style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)',
                borderRadius:12, padding:'14px 18px', display:'flex', alignItems:'center',
                gap:14, boxShadow:'var(--shadow-sm)' }}>
                <div style={{ width:38, height:38, borderRadius:10, background:'#EFF6FF',
                  border:'1px solid #BFDBFE', display:'flex', alignItems:'center',
                  justifyContent:'center', fontSize:17, flexShrink:0 }}>🧾</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--label)', marginBottom:2 }}>
                    #{bill.bill_number}
                    {bill.doctors && (
                      <span style={{ marginLeft:8, fontSize:11, color:'#0288D1', fontWeight:500 }}>
                        🩺 {bill.doctors.name}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize:11, color:'var(--label-4)' }}>
                    {new Date(bill.created_at).toLocaleString('en-IN')}
                    · {bill.bill_items?.length || 0} items
                    · {bill.payment_method?.toUpperCase()}
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:16, fontWeight:800, color:'var(--accent)' }}>{fmt(bill.total_amount)}</div>
                  <div style={{ fontSize:11, color:'#15803D', fontWeight:600 }}>Profit: {fmt(bill.gross_profit)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 400px', gap:20, alignItems:'start' }}>

          {/* ── LEFT: Medicine picker ── */}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--label-4)',
              textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:10 }}>
              Available Stock (FEFO)
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Search by name or batch…"
              style={{ width:'100%', padding:'10px 14px', border:'1.5px solid var(--bg-4)',
                borderRadius:12, fontSize:14, fontFamily:'inherit', color:'var(--label)',
                background:'var(--bg-2)', outline:'none', boxSizing:'border-box', marginBottom:14 }}
              onFocus={e => e.target.style.borderColor='var(--accent)'}
              onBlur={e  => e.target.style.borderColor='var(--bg-4)'} />

            <div style={{ display:'flex', flexDirection:'column', gap:10,
              maxHeight:'calc(100vh - 300px)', overflowY:'auto', paddingRight:4 }}>
              {byMedicine.length === 0 ? (
                <div style={{ textAlign:'center', padding:40, color:'var(--label-4)',
                  fontSize:13, background:'var(--bg-2)', borderRadius:14,
                  border:'1px solid var(--bg-4)' }}>No stock available</div>
              ) : byMedicine.map(({ medicine, batches }) => (
                <div key={medicine?.id} style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)',
                  borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
                  {/* Medicine header */}
                  <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--bg-4)',
                    display:'flex', alignItems:'center', gap:8, background:'var(--bg-3)' }}>
                    <span style={{ fontSize:18 }}>{TYPE_ICONS[medicine?.type]||'📦'}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'var(--label)' }}>
                        {medicine?.name}{medicine?.strength ? ` · ${medicine.strength}` : ''}
                      </div>
                      <div style={{ fontSize:11, color:'var(--label-4)' }}>
                        {medicine?.pack_size} {medicine?.pack_unit}s per {packLabel(medicine?.type)}
                      </div>
                    </div>
                  </div>
                  {/* Batch rows */}
                  {batches.map((inv, bi) => {
                    const d       = dLeft(inv.expiry_date);
                    const expC    = d < 0 ? '#B91C1C' : d < 90 ? '#92400E' : '#15803D';
                    const expBg   = d < 0 ? '#FEE2E2' : d < 90 ? '#FEF3C7' : '#DCFCE7';
                    const ps      = medicine?.pack_size || 1;
                    const mrpUnit = (inv.mrp_per_pack || 0) / ps;
                    const discPct = inv.discount_percent || 0;
                    const finalP  = inv.selling_price_per_unit || (mrpUnit * (1 - discPct / 100));
                    const inCart  = cartItems.some(c => c.invId === inv.id);
                    return (
                      <div key={inv.id}
                        style={{ padding:'10px 14px', display:'flex', alignItems:'center',
                          gap:10, borderBottom: bi < batches.length-1 ? '1px solid var(--bg-4)' : 'none',
                          background: inCart ? '#F0FDF4' : bi === 0 ? 'rgba(0,122,255,0.03)' : 'transparent' }}>
                        {bi === 0 && (
                          <span style={{ fontSize:9, fontWeight:800, background:'#EFF6FF',
                            color:'#1D4ED8', padding:'1px 5px', borderRadius:4, flexShrink:0 }}>FEFO</span>
                        )}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:3 }}>
                            <span style={{ fontSize:11, fontFamily:'monospace', fontWeight:700, color:'var(--label-3)' }}>
                              {inv.batch_number}
                            </span>
                            <span style={{ fontSize:10, fontWeight:600, padding:'1px 7px',
                              borderRadius:20, background:expBg, color:expC }}>
                              Exp: {new Date(inv.expiry_date).toLocaleDateString('en-IN')}
                            </span>
                            {discPct > 0 && (
                              <span style={{ fontSize:10, fontWeight:700, background:'#FFF1F0',
                                color:'#FF3B30', padding:'1px 6px', borderRadius:20 }}>
                                🏷️ {discPct}% off
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize:11, color:'var(--label-4)', display:'flex', gap:10, flexWrap:'wrap' }}>
                            <span style={{ fontWeight:600, color:'var(--label-2)' }}>
                              {inv.units_remaining} units
                            </span>
                            {discPct > 0 ? (
                              <>
                                <span style={{ textDecoration:'line-through', color:'var(--label-4)' }}>
                                  ₹{mrpUnit.toFixed(2)}
                                </span>
                                <span style={{ fontWeight:700, color:'#15803D' }}>
                                  ₹{finalP.toFixed(2)}/{medicine?.pack_unit}
                                </span>
                              </>
                            ) : (
                              <span style={{ fontWeight:600, color: finalP ? '#15803D' : '#FF9500' }}>
                                {finalP ? `₹${Number(finalP).toFixed(2)}/${medicine?.pack_unit}` : '⚠️ Set price'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                          <button onClick={() => { setSetPriceFor(inv); setPriceInput(finalP ? String(Number(finalP).toFixed(2)) : ''); }}
                            style={{ padding:'5px 10px', border:'1px solid var(--bg-4)', background:'var(--bg-3)',
                              color:'var(--label-3)', borderRadius:7, fontSize:11, fontWeight:600,
                              cursor:'pointer', fontFamily:'inherit' }}>₹ Price</button>
                          <button onClick={() => addToCart(inv)} disabled={inCart}
                            style={{ padding:'5px 14px', border:'none', borderRadius:7, fontSize:11,
                              fontWeight:700, cursor: inCart ? 'default' : 'pointer', fontFamily:'inherit',
                              background: inCart ? '#F0FDF4' : 'linear-gradient(145deg,#FF3B30,#D93025)',
                              color: inCart ? '#15803D' : '#fff',
                              ...(inCart ? { border:'1px solid #BBF7D0' } : {}) }}>
                            {inCart ? '✓ Added' : '+ Add'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Bill form ── */}
          <div style={{ position:'sticky', top:80, display:'flex', flexDirection:'column', gap:12 }}>

            {/* Customer */}
            <div style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)',
              borderRadius:14, padding:'14px 16px' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--label-4)',
                textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:10 }}>
                Customer Details
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <input value={customer.name} onChange={e => setCustomer(p => ({ ...p, name: e.target.value }))}
                  placeholder="Patient / Customer Name"
                  style={{ padding:'8px 12px', border:'1.5px solid var(--bg-4)', borderRadius:9,
                    fontSize:13, fontFamily:'inherit', color:'var(--label)', background:'var(--bg-3)',
                    outline:'none', width:'100%', boxSizing:'border-box' }} />
                <input value={customer.phone} onChange={e => setCustomer(p => ({ ...p, phone: e.target.value }))}
                  placeholder="Phone Number"
                  style={{ padding:'8px 12px', border:'1.5px solid var(--bg-4)', borderRadius:9,
                    fontSize:13, fontFamily:'inherit', color:'var(--label)', background:'var(--bg-3)',
                    outline:'none', width:'100%', boxSizing:'border-box' }} />
              </div>
            </div>

            {/* Referred by */}
            <div style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)',
              borderRadius:14, padding:'14px 16px' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--label-4)',
                textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:10 }}>
                Referred By (Optional)
              </div>
              <DoctorSearchInput value={doctor} onChange={setDoctor} />
            </div>

            {/* Cart items */}
            <div style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)',
              borderRadius:14, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--bg-4)',
                fontSize:11, fontWeight:700, color:'var(--label-4)',
                textTransform:'uppercase', letterSpacing:'0.8px' }}>
                Cart ({cartItems.length} items)
              </div>
              <div style={{ maxHeight:320, overflowY:'auto' }}>
                {cartItems.length === 0 ? (
                  <div style={{ padding:'28px 16px', textAlign:'center',
                    color:'var(--label-4)', fontSize:13 }}>
                    ← Select medicines from the left
                  </div>
                ) : cartItems.map(item => {
                  const units    = totalUnits(item);
                  const pl       = packLabel(item.medType);
                  const maxPacks = Math.floor(item.maxUnits / item.packSize);
                  const maxLoose = item.maxUnits - item.packs * item.packSize;
                  const lineTotal = item.sellPrice * units;
                  return (
                    <div key={item.invId} style={{ padding:'12px 16px',
                      borderBottom:'1px solid var(--bg-4)' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:8 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'var(--label)',
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {item.name}
                          </div>
                          <div style={{ fontSize:10, color:'var(--label-4)', marginTop:1, display:'flex', gap:6, flexWrap:'wrap' }}>
                            <span>Batch: {item.batch}</span>
                            {item.discountPct > 0 && (
                              <span style={{ color:'#FF3B30', fontWeight:600 }}>🏷️ {item.discountPct}% off</span>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          <div style={{ fontSize:13, fontWeight:800, color:'var(--accent)' }}>{fmt(lineTotal)}</div>
                          <div style={{ fontSize:10, color:'var(--label-4)' }}>{fmt(item.sellPrice)}/{item.packUnit}</div>
                        </div>
                        <button onClick={() => removeFromCart(item.invId)}
                          style={{ width:22, height:22, borderRadius:6, border:'none',
                            background:'#FEE2E2', cursor:'pointer', fontSize:10, color:'#B91C1C',
                            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
                      </div>
                      {/* Packs + Loose */}
                      <div style={{ display:'grid', gridTemplateColumns: item.packSize > 1 ? '1fr 1fr' : '1fr', gap:8 }}>
                        {/* Packs */}
                        <div>
                          <div style={{ fontSize:9, fontWeight:700, color:'var(--label-4)',
                            textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:3 }}>
                            {pl}s
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                            <button onClick={() => updateCart(item.invId, 'packs', Math.max(0, item.packs - 1))}
                              style={{ width:24, height:24, borderRadius:6, border:'1px solid var(--bg-4)',
                                background:'var(--bg-3)', cursor:'pointer', fontSize:13, color:'var(--label)',
                                display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                            <input type="number" value={item.packs} min={0} max={maxPacks}
                              onChange={e => updateCart(item.invId, 'packs',
                                Math.min(maxPacks, Math.max(0, parseInt(e.target.value)||0)))}
                              style={{ flex:1, textAlign:'center', padding:'3px', border:'1.5px solid var(--bg-4)',
                                borderRadius:6, fontSize:12, fontFamily:'inherit', color:'var(--label)',
                                background:'var(--bg-3)', outline:'none', minWidth:0 }} />
                            <button onClick={() => updateCart(item.invId, 'packs', Math.min(maxPacks, item.packs + 1))}
                              style={{ width:24, height:24, borderRadius:6, border:'1px solid var(--bg-4)',
                                background:'var(--bg-3)', cursor:'pointer', fontSize:13, color:'var(--label)',
                                display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                          </div>
                        </div>
                        {/* Loose */}
                        {item.packSize > 1 && (
                          <div>
                            <div style={{ fontSize:9, fontWeight:700, color:'var(--label-4)',
                              textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:3 }}>
                              Loose {item.packUnit}s
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                              <button onClick={() => updateCart(item.invId, 'loose', Math.max(0, item.loose - 1))}
                                style={{ width:24, height:24, borderRadius:6, border:'1px solid var(--bg-4)',
                                  background:'var(--bg-3)', cursor:'pointer', fontSize:13, color:'var(--label)',
                                  display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                              <input type="number" value={item.loose} min={0} max={maxLoose}
                                onChange={e => updateCart(item.invId, 'loose',
                                  Math.min(maxLoose, Math.max(0, parseInt(e.target.value)||0)))}
                                style={{ flex:1, textAlign:'center', padding:'3px', border:'1.5px solid var(--bg-4)',
                                  borderRadius:6, fontSize:12, fontFamily:'inherit', color:'var(--label)',
                                  background:'var(--bg-3)', outline:'none', minWidth:0 }} />
                              <button onClick={() => updateCart(item.invId, 'loose', Math.min(maxLoose, item.loose + 1))}
                                style={{ width:24, height:24, borderRadius:6, border:'1px solid var(--bg-4)',
                                  background:'var(--bg-3)', cursor:'pointer', fontSize:13, color:'var(--label)',
                                  display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Totals + Payment */}
            {cartItems.length > 0 && (
              <div style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)',
                borderRadius:14, padding:'14px 16px' }}>

                {/* ── Price breakdown ── */}
                <div style={{ display:'flex', flexDirection:'column', gap:0, marginBottom:12 }}>
                  {/* MRP subtotal */}
                  <div style={{ display:'flex', justifyContent:'space-between',
                    padding:'6px 0', borderBottom:'1px solid var(--bg-4)',
                    fontSize:13, color:'var(--label-3)' }}>
                    <span>MRP Subtotal</span>
                    <span style={{ fontWeight:600 }}>{fmt(mrpSubtotal)}</span>
                  </div>
                  {/* Discount */}
                  {discountTotal > 0 && (
                    <div style={{ display:'flex', justifyContent:'space-between',
                      padding:'6px 0', borderBottom:'1px solid var(--bg-4)',
                      fontSize:13, color:'#FF3B30', fontWeight:600 }}>
                      <span>🏷️ Discount</span>
                      <span>− {fmt(discountTotal)}</span>
                    </div>
                  )}
                  {/* After discount */}
                  {discountTotal > 0 && (
                    <div style={{ display:'flex', justifyContent:'space-between',
                      padding:'6px 0', borderBottom:'1px solid var(--bg-4)',
                      fontSize:13, color:'var(--label-2)' }}>
                      <span>After Discount</span>
                      <span style={{ fontWeight:600 }}>{fmt(afterDiscount)}</span>
                    </div>
                  )}
                  {/* GST 5% */}
                  <div style={{ display:'flex', justifyContent:'space-between',
                    padding:'6px 0', borderBottom:'2px solid var(--label)',
                    fontSize:13, color:'#FF9500', fontWeight:600 }}>
                    <span>+ GST (5%)</span>
                    <span>{fmt(gstAmount)}</span>
                  </div>
                  {/* Grand Total */}
                  <div style={{ display:'flex', justifyContent:'space-between',
                    padding:'8px 0', fontSize:17, fontWeight:900 }}>
                    <span style={{ color:'var(--label)' }}>Grand Total</span>
                    <span style={{ color:'var(--accent)' }}>{fmt(grandTotal)}</span>
                  </div>
                </div>

                {/* ── Payment split ── */}
                <div style={{ fontSize:11, fontWeight:700, color:'var(--label-4)',
                  textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:8 }}>
                  Payment
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:10 }}>
                  {[
                    { key:'cash', icon:'💵', label:'Cash'  },
                    { key:'card', icon:'💳', label:'Card'  },
                    { key:'upi',  icon:'📱', label:'UPI'   },
                  ].map(p => (
                    <div key={p.key} style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:15, flexShrink:0 }}>{p.icon}</span>
                      <span style={{ fontSize:12, fontWeight:600, color:'var(--label-3)', minWidth:34 }}>{p.label}</span>
                      <div style={{ position:'relative', flex:1 }}>
                        <span style={{ position:'absolute', left:9, top:'50%',
                          transform:'translateY(-50%)', fontSize:12,
                          color:'var(--label-4)', pointerEvents:'none' }}>₹</span>
                        <input type="number" min="0"
                          value={payments[p.key]}
                          onChange={e => setPayments(prev => ({ ...prev, [p.key]: e.target.value }))}
                          placeholder="0"
                          style={{ width:'100%', padding:'7px 8px 7px 22px',
                            border:'1.5px solid var(--bg-4)', borderRadius:8,
                            fontSize:13, fontFamily:'inherit', color:'var(--label)',
                            background:'var(--bg-3)', outline:'none', boxSizing:'border-box' }}
                          onFocus={e => e.target.style.borderColor='var(--accent)'}
                          onBlur={e => e.target.style.borderColor='var(--bg-4)'} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Balance indicator */}
                <div style={{ display:'flex', justifyContent:'space-between',
                  fontSize:12, marginBottom:12,
                  color: Math.abs(balance) < 0.01 ? '#15803D' : balance > 0 ? '#B91C1C' : '#92400E',
                  fontWeight:600 }}>
                  <span>{Math.abs(balance) < 0.01 ? '✓ Fully paid' : balance > 0 ? '⚠️ Short by' : 'Change to return'}</span>
                  {Math.abs(balance) >= 0.01 && <span>{fmt(Math.abs(balance))}</span>}
                </div>

                <button onClick={handleSubmit} disabled={saving || cartItems.length === 0}
                  style={{ width:'100%', padding:13,
                    background: cartItems.length ? 'linear-gradient(145deg,#FF3B30,#D93025)' : '#ccc',
                    color:'#fff', border:'none', borderRadius:12, fontSize:14, fontWeight:700,
                    cursor: cartItems.length ? 'pointer' : 'default', fontFamily:'inherit',
                    boxShadow: cartItems.length ? '0 3px 12px rgba(255,59,48,0.3)' : 'none' }}>
                  {saving ? '⏳ Saving…' : `🧾 Save Bill & Print  ${fmt(grandTotal)}`}
                </button>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
