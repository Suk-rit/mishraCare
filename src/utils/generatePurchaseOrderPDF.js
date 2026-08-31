/**
 * generatePurchaseOrderPDF
 *
 * Builds an A4-sized HTML string for a purchase order approval bill,
 * opens a hidden iframe, triggers window.print() inside it, then
 * also returns the HTML blob so we can upload it to Supabase Storage.
 *
 * Why iframe + print?
 *   - No external PDF library needed (no jsPDF, no puppeteer).
 *   - Browser renders it pixel-perfect with real CSS.
 *   - User can Save-as-PDF from the print dialog.
 *   - We simultaneously upload the HTML to storage as a "soft PDF".
 *
 * @param {Object}   opts
 * @param {Object}   opts.bill          - purchase_order_bills record
 * @param {Object}   opts.admin         - { full_name, email, region, city, state }
 * @param {Object}   opts.devta         - { name }
 * @param {Array}    opts.batches        - medicine_batches rows with medicines joined
 * @param {boolean}  opts.printNow      - whether to open print dialog immediately
 * @returns {{ html: string, blob: Blob }}
 */
export function generatePurchaseOrderPDF({ bill, admin, devta, batches, printNow = true }) {
  const fmt = (n) => n != null ? `₹${Number(n).toFixed(2)}` : '—';
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  }) : '—';

  const totalCost   = batches.reduce((s, b) => s + (parseFloat(b.cost_price_per_pack || 0) * (b.quantity_packs || 0)), 0);
  const totalUnits  = batches.reduce((s, b) => s + (b.total_units || 0), 0);
  const totalPacks  = batches.reduce((s, b) => s + (b.quantity_packs || 0), 0);

  const batchRows = batches.map((b, i) => `
    <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
      <td>${i + 1}</td>
      <td>
        <strong>${b.medicines?.name || '—'}</strong>
        ${b.medicines?.strength ? `<br/><small>${b.medicines.strength}</small>` : ''}
        ${b.medicines?.manufacturer ? `<br/><small style="color:#888">${b.medicines.manufacturer}</small>` : ''}
      </td>
      <td>${b.medicines?.type || '—'}</td>
      <td style="font-family:monospace">${b.batch_number || '—'}</td>
      <td>${fmtDate(b.date_of_manufacture)}</td>
      <td>${fmtDate(b.expiry_date)}</td>
      <td style="text-align:center">${b.quantity_packs || 0}</td>
      <td style="text-align:center">${b.quantity_loose || 0}</td>
      <td style="text-align:center">${b.total_units || 0}</td>
      <td style="text-align:right">${fmt(b.cost_price_per_pack)}</td>
      <td style="text-align:right">${fmt(b.mrp_per_pack)}</td>
      <td style="text-align:right"><strong>${fmt(parseFloat(b.cost_price_per_pack || 0) * (b.quantity_packs || 0))}</strong></td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${bill.bill_number}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }

    @page {
      size: A4 portrait;
      margin: 16mm 14mm;
    }

    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      color: #1a1a2e;
      background: #fff;
      line-height: 1.5;
    }

    /* ── Header ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #0288D1;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-icon {
      width: 48px; height: 48px; border-radius: 12px;
      background: linear-gradient(135deg,#FF3B30,#C0392B);
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; color: #fff; flex-shrink: 0;
    }
    .brand-name { font-size: 22px; font-weight: 800; color: #1a1a2e; letter-spacing: -0.5px; }
    .brand-name span { color: #FF3B30; }
    .brand-sub { font-size: 11px; color: #666; margin-top: 2px; }

    .bill-meta { text-align: right; }
    .bill-number { font-size: 16px; font-weight: 800; color: #0288D1; letter-spacing: -0.3px; }
    .bill-label { font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 3px; }
    .bill-date { font-size: 11px; color: #444; margin-top: 3px; }

    /* ── Section title ── */
    .section-title {
      font-size: 10px; font-weight: 700; color: #0288D1;
      text-transform: uppercase; letter-spacing: 0.8px;
      margin: 14px 0 7px;
      padding-bottom: 4px;
      border-bottom: 1px solid #E0F2FE;
    }

    /* ── Info grid ── */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      margin-bottom: 14px;
    }
    .info-box {
      background: #F5FBFF;
      border: 1px solid #B3E5FC;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .info-box-label { font-size: 9.5px; font-weight: 700; color: #0288D1;
      text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
    .info-box-value { font-size: 12px; font-weight: 600; color: #1a1a2e; }
    .info-box-sub   { font-size: 10px; color: #666; margin-top: 1px; }

    /* ── Table ── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      margin-bottom: 16px;
    }
    thead tr {
      background: #0288D1;
      color: #fff;
    }
    thead th {
      padding: 7px 8px;
      text-align: left;
      font-weight: 700;
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      white-space: nowrap;
    }
    tbody tr.even { background: #fff; }
    tbody tr.odd  { background: #F5FBFF; }
    tbody td {
      padding: 6px 8px;
      border-bottom: 1px solid #E3F2FD;
      vertical-align: middle;
    }
    tbody tr:last-child td { border-bottom: none; }

    /* ── Totals ── */
    .totals-row {
      display: flex;
      justify-content: flex-end;
      gap: 0;
      margin-bottom: 16px;
    }
    .totals-box {
      border: 1.5px solid #0288D1;
      border-radius: 10px;
      overflow: hidden;
      min-width: 260px;
    }
    .totals-line {
      display: flex;
      justify-content: space-between;
      padding: 6px 14px;
      font-size: 11px;
      border-bottom: 1px solid #E0F2FE;
    }
    .totals-line:last-child { border-bottom: none; }
    .totals-line-label { color: #555; }
    .totals-line-value { font-weight: 600; color: #1a1a2e; }
    .totals-line.highlight { background: #0288D1; }
    .totals-line.highlight .totals-line-label,
    .totals-line.highlight .totals-line-value { color: #fff; font-weight: 800; font-size: 13px; }

    /* ── Bill amount comparison ── */
    .bill-comparison {
      background: ${Math.abs((bill.bill_amount || 0) - totalCost) < 0.5 ? '#F0FDF4' : '#FFF8E1'};
      border: 1.5px solid ${Math.abs((bill.bill_amount || 0) - totalCost) < 0.5 ? '#BBF7D0' : '#FDE68A'};
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .bc-label { font-size: 10px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
    .bc-val { font-size: 13px; font-weight: 800; }

    /* ── Approval stamp ── */
    .approval-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-top: 2px solid #0288D1;
      padding-top: 12px;
      margin-top: 4px;
    }
    .approved-by { font-size: 11px; color: #444; }
    .approved-by strong { color: #0288D1; }

    .stamp {
      border: 3px solid #2E7D32;
      border-radius: 12px;
      padding: 8px 18px;
      text-align: center;
      transform: rotate(-4deg);
    }
    .stamp-text { font-size: 14px; font-weight: 900; color: #2E7D32;
      text-transform: uppercase; letter-spacing: 1px; }
    .stamp-sub  { font-size: 9px;  color: #4CAF50; margin-top: 2px; }

    /* ── Footer ── */
    .footer {
      margin-top: 14px;
      text-align: center;
      font-size: 9.5px;
      color: #aaa;
      border-top: 1px solid #f0f0f0;
      padding-top: 10px;
    }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="brand">
      <div class="brand-icon">💊</div>
      <div>
        <div class="brand-name">Mishra<span>Care</span></div>
        <div class="brand-sub">Pharmacy ERP · Purchase Order Bill</div>
      </div>
    </div>
    <div class="bill-meta">
      <div class="bill-label">Bill Number</div>
      <div class="bill-number">${bill.bill_number}</div>
      <div class="bill-date">Approved: ${fmtDate(bill.approved_at)}</div>
      <div class="bill-date">Generated: ${fmtDate(new Date().toISOString())}</div>
    </div>
  </div>

  <!-- Admin & Supplier Info -->
  <div class="section-title">Parties Involved</div>
  <div class="info-grid">
    <div class="info-box">
      <div class="info-box-label">Admin / Region</div>
      <div class="info-box-value">${admin.full_name || '—'}</div>
      <div class="info-box-sub">${admin.email || ''}</div>
      <div class="info-box-sub">${[admin.city, admin.state].filter(Boolean).join(', ') || ''}</div>
    </div>
    <div class="info-box">
      <div class="info-box-label">Supplier / Stockist</div>
      <div class="info-box-value">${bill.supplier_name || 'Not specified'}</div>
      <div class="info-box-sub">Invoice: ${bill.supplier_invoice || '—'}</div>
      <div class="info-box-sub">Purchase Date: ${fmtDate(bill.purchase_date)}</div>
    </div>
    <div class="info-box">
      <div class="info-box-label">Approved By</div>
      <div class="info-box-value">${devta?.name || 'Devta'}</div>
      <div class="info-box-sub">Verification Authority</div>
      <div class="info-box-sub">${fmtDate(bill.approved_at)}</div>
    </div>
  </div>

  <!-- Batch / Medicine Table -->
  <div class="section-title">Stock Details (${batches.length} batch${batches.length !== 1 ? 'es' : ''})</div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Medicine</th>
        <th>Type</th>
        <th>Batch No.</th>
        <th>Mfg. Date</th>
        <th>Expiry</th>
        <th style="text-align:center">Packs</th>
        <th style="text-align:center">Loose</th>
        <th style="text-align:center">Units</th>
        <th style="text-align:right">Cost/Pack</th>
        <th style="text-align:right">MRP/Pack</th>
        <th style="text-align:right">Total Cost</th>
      </tr>
    </thead>
    <tbody>
      ${batchRows}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals-row">
    <div class="totals-box">
      <div class="totals-line">
        <span class="totals-line-label">Total Medicines</span>
        <span class="totals-line-value">${bill.total_medicines || batches.length}</span>
      </div>
      <div class="totals-line">
        <span class="totals-line-label">Total Packs</span>
        <span class="totals-line-value">${totalPacks}</span>
      </div>
      <div class="totals-line">
        <span class="totals-line-label">Total Units</span>
        <span class="totals-line-value">${totalUnits}</span>
      </div>
      <div class="totals-line">
        <span class="totals-line-label">Calculated Cost</span>
        <span class="totals-line-value">${fmt(totalCost)}</span>
      </div>
      <div class="totals-line highlight">
        <span class="totals-line-label">Bill Amount (Stockist)</span>
        <span class="totals-line-value">${fmt(bill.bill_amount)}</span>
      </div>
    </div>
  </div>

  <!-- Bill vs Calculated comparison -->
  <div class="bill-comparison">
    <div>
      <div class="bc-label">Stockist Bill Amount</div>
      <div class="bc-val" style="color:#0288D1">${fmt(bill.bill_amount)}</div>
    </div>
    <div style="color:#aaa; font-size:18px">⇄</div>
    <div>
      <div class="bc-label">Calculated from Batches</div>
      <div class="bc-val" style="color:#388E3C">${fmt(totalCost)}</div>
    </div>
    <div>
      <div class="bc-label">Difference</div>
      <div class="bc-val" style="color:${Math.abs((bill.bill_amount || 0) - totalCost) < 0.5 ? '#388E3C' : '#F57F17'}">
        ${fmt(Math.abs((bill.bill_amount || 0) - totalCost))}
        ${Math.abs((bill.bill_amount || 0) - totalCost) < 0.5 ? ' ✓' : ' ⚠'}
      </div>
    </div>
  </div>

  ${bill.devta_note ? `
  <!-- Devta Note -->
  <div style="background:#F5FBFF; border:1px solid #B3E5FC; border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:11px; color:#01579B;">
    <strong>Verification Note:</strong> ${bill.devta_note}
  </div>
  ` : ''}

  <!-- Approval Stamp -->
  <div class="approval-section">
    <div class="approved-by">
      <div style="margin-bottom:4px">Submitted by: <strong>${admin.full_name}</strong> (Admin)</div>
      <div>Verified &amp; Approved by: <strong>${devta?.name || 'Devta'}</strong> (Devta)</div>
      <div style="margin-top:4px; font-size:10px; color:#888">
        This is a computer-generated document. No signature required.
      </div>
    </div>
    <div class="stamp">
      <div class="stamp-text">✓ Approved</div>
      <div class="stamp-sub">${fmtDate(bill.approved_at)}</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    MishraCare Pharmacy ERP &nbsp;·&nbsp; ${bill.bill_number} &nbsp;·&nbsp;
    This document is for internal records only.
  </div>

</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });

  if (printNow) {
    // Open in hidden iframe and trigger print
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;';
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    iframe.onload = () => {
      try { iframe.contentWindow.print(); } catch (_) {}
      setTimeout(() => document.body.removeChild(iframe), 3000);
    };
  }

  return { html, blob };
}
