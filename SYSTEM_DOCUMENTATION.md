# JanSwasthya Pharmacy ERP — Complete System Documentation

**Version:** Current (September 2026)  
**Stack:** React 19 + Vite · Supabase (PostgreSQL + Storage + Edge Functions) · Framer Motion  
**Deployed at:** Render (Static Site)  
**Repository:** github.com/Suk-rit/mishraCare  

---

## TABLE OF CONTENTS

1. [System Overview](#1-system-overview)
2. [User Roles & Hierarchy](#2-user-roles--hierarchy)
3. [Authentication & Session](#3-authentication--session)
4. [Fullscreen Behaviour](#4-fullscreen-behaviour)
5. [Admin Dashboard](#5-admin-dashboard)
6. [Store Manager Dashboard](#6-store-manager-dashboard)
7. [Devta Portal](#7-devta-portal)
8. [Vishnu Dashboard](#8-vishnu-dashboard)
9. [Inventory & Stock Flow](#9-inventory--stock-flow)
10. [Billing System](#10-billing-system)
11. [Transfer System](#11-transfer-system)
12. [Employee & Team Management](#12-employee--team-management)
13. [Expense Tracking](#13-expense-tracking)
14. [Analytics & Reporting](#14-analytics--reporting)
15. [Notifications](#15-notifications)
16. [Database Tables](#16-database-tables)
17. [Storage Buckets](#17-storage-buckets)
18. [Migrations Index](#18-migrations-index)

---

## 1. SYSTEM OVERVIEW

JanSwasthya is a multi-store pharmacy chain ERP. It manages:
- Multiple pharmacy stores under regional admins
- Inventory (central warehouse → store transfer flow)
- Billing with GST, discounts, doctor referrals
- Staff management with KYC documents
- Financial transparency for the owner (Vishnu)
- Stock verification and approval by a designated verifier (Devta)

---

## 2. USER ROLES & HIERARCHY

```
Vishnu (Owner / Super Admin)
  └── creates and manages Admins
        └── manages Stores (created by Devta, assigned to Admin)
              └── has Store Managers (added by Devta)
                    └── has Employees (approved by Devta)

Devta (Verification Authority)
  └── approves stock batches (inventory requests)
  └── approves employees and admin team members
  └── creates stores and assigns to admins
  └── records own operational expenses
```

### Role Capabilities Summary

| Capability | Vishnu | Devta | Admin | Store Manager |
|---|---|---|---|---|
| View all chain financials | ✓ | — | — | — |
| Create reports | ✓ | — | — | — |
| Cash register tracking | ✓ | — | — | — |
| Add/manage admins | ✓ | — | — | — |
| Add stores | — | ✓ | — | — |
| Approve stock batches | — | ✓ | — | — |
| Approve employees/team | — | ✓ | — | — |
| View own expenses | — | ✓ | — | — |
| Manage inventory | — | — | ✓ | — |
| Transfer stock to stores | — | — | ✓ | — |
| View store expenses | — | — | ✓ | — |
| Add warehouse team | — | — | ✓ | — |
| Bill customers | — | — | — | ✓ |
| Request stock | — | — | — | ✓ |
| View own analytics | — | — | ✓ (expense only) | ✓ (sales + expense) |

---

## 3. AUTHENTICATION & SESSION

### Login Page
- Background: animated green nature scene with falling leaves (pure CSS)
- Role selector: Admin or Store Manager
- Admin login: Email + Password → 4-digit OTP sent via email (Resend API edge function)
- Store Manager login: Email + Password → direct dashboard (no OTP)

### Session Storage
- Stored in `localStorage` key `janswasthya_session`
- Contains: `{ role, email, name, id (for devta) }`
- No expiry mechanism — stays until logout

### Special Logins
- **Devta**: Accessed via keyboard shortcut on login page → email + password login against `devta` table
- **Vishnu**: Accessed via keyboard shortcut on login page → 6-digit secret code → email + password (hardcoded)

---

## 4. FULLSCREEN BEHAVIOUR

- On every successful login, the app enters fullscreen mode automatically
- If user presses Esc or exits fullscreen by any means, a dark overlay appears: **"Click to re-enter fullscreen"**
- User must click the overlay — this click is a browser user gesture that allows `requestFullscreen()` to succeed
- On logout, fullscreen is exited and the guard is removed
- On browser refresh while logged in: `main.jsx` checks session and restores the fullscreen guard, showing the overlay if not in fullscreen

---

## 5. ADMIN DASHBOARD

### Navigation Tabs
1. **Dashboard** — overview stats (stores, managers, products, pending approvals) + quick actions
2. **Stores** — view all stores assigned by Devta, add managers to stores, view store detail (employees, pending approvals)
3. **Inventory** — view all approved medicine batches FEFO sorted, filter by status (approved/pending/rejected)
4. **Add Stock** — bulk stock addition flow (see Section 9)
5. **Analytics** — expense-only view (store expenses + admin warehouse expenses). No sales/profit shown to admin.
6. **Issues** — rejected transfer items from store managers, with manager contact details
7. **Store Requests** — inventory requests submitted by store managers (approve/reject/fulfilled)
8. **Staff** — add warehouse/office team members (sent to Devta for approval)

### Store Detail
- Shows store info, pharmacist details, documents
- Tabs: Managers, Employees (approved), Pending employee approvals
- Admin can approve or reject pending employee requests with optional note

---

## 6. STORE MANAGER DASHBOARD

### Navigation Tabs
1. **Overview** — store info card, manager profile, quick-access modules
2. **Billing** — full POS billing system (see Section 10)
3. **Analytics** — total sales + store expenses only (no profit/margins shown)
4. **Transfers** — incoming stock transfers, accept/reject per item
5. **Request Stock** — browse admin inventory and request medicines, or request new medicines
6. **My Stock** — current store inventory sorted FEFO with expiry indicators
7. **My Team** — approved employees list
8. **Pending** — pending/rejected employee requests

### Stock Tab
- Shows all `store_inventory` rows sorted by expiry date (FEFO)
- Displays packs + loose, MRP, discount %, selling price, expiry status color-coded
- Progress bar per item showing stock level

---

## 7. DEVTA PORTAL

### Login
- Sky/clouds/birds animated canvas background
- Email + password against `devta` table

### Navigation Tabs

#### 1. Stock Approvals (Pending)
- Groups all pending `medicine_batches` by the admin who submitted them
- Shows admin name, email, phone (clickable), city, state
- Per admin: shows stockist bill image, bill amount vs calculated amount comparison
- Can select/deselect individual batches for approval
- On approve: creates `purchase_order_bills` record, generates A4 HTML bill, uploads to storage, updates batch status to `approved`
- On reject: marks batch as rejected with optional note per batch

#### 2. Approved Bills
- Lists all bills Devta personally approved
- Shows: bill number, admin name, date, batch count, bill amount
- Actions: View Bill (renders HTML properly), Save as PDF (opens print dialog), Re-print

#### 3. People Requests
- Shows pending employee requests from stores (submitted by store managers)
- Shows pending admin team requests (submitted by admins)
- For each person: full details, document links (photo, Aadhar)
- Admin phone shown as clickable link
- Approve → marks approved + auto-creates monthly salary expense entry
- Reject → marks rejected with reason

#### 4. Add Store
- Full 4-step wizard: Store Info → Location → Pharmacist → Documents
- **Admin assignment dropdown** — Devta selects which admin region the store belongs to
- On creation: admin receives in-app notification

#### 5. My Expenses
- Record Devta's own operational expenses
- Fields: category, description, amount, date, payment method, proof upload
- Shown in Vishnu's Analytics chain totals

### Purchase Order Bill (A4)
- Professional black & white layout
- Header: JanSwasthya Pharmacy branding + Bill Number + dates
- Parties: Admin/Region + Supplier + Approved By (Devta)
- Medicine table: Name, Type, Batch No, DOM, Expiry, Packs, Loose, Units, Cost/Pack, MRP/Pack, Total Cost
- Totals: Calculated cost vs Stockist bill amount comparison
- Approval stamp + footer

---

## 8. VISHNU DASHBOARD

### Login
- Space/stars/shooting stars animated canvas background
- 6-digit secret code → email + password

### Navigation Tabs

#### 1. Org Chart
- Left panel: list of all active admins
- Right panel: click an admin to see full details
  - Personal info: name, email, phone, city, state, region, designation, Aadhar No, PAN No, DOB, address
  - **KYC Documents** (Vishnu only): Profile Photo, Aadhar Card, PAN Card, Other ID, Other Doc — clickable links
  - Stores under this admin with expandable store cards
  - Each store shows managers with phone contact links

#### 2. Analytics
- Period selector: 7D / 1M / 3M / 6M / 1Y / All Time
- **Chain KPI cards**: Total Chain Sales, Total Expenses, Net (Sales−Expenses), Active Admins
- **Per-admin drilldown** (expandable):
  - Admin's own warehouse expenses with proof links
  - Per-store breakdown: Sales, Expenses, Cash collected
  - Store manager contact details with clickable phone
- **Devta Expenses section**: shows all Devta's own recorded expenses

#### 3. Cash Register
- Period selector
- Per-store cash breakdown: Cash collected, UPI collected, Card collected
- Manager name + clickable phone to demand cash deposit
- Summary cards: Total Cash in Stores, UPI Collected, Card Collected, Stores with Cash

#### 4. Reports
- Create financial reports for any date range
- Title + notes + period → saves to database
- Auto-calculates financial snapshot: Total Sales, Total Expenses, Net Amount for that period
- Reports are immutable once saved
- Lists all past reports with their snapshots

### Add Admin (Vishnu only)
- **Credentials**: Email, Password
- **Personal Info**: Full Name, Phone, DOB, City, State, Region, Designation, Permanent Address
- **Identity**: Aadhar Number, PAN Number
- **Documents**: Profile Photo, Aadhar Card, PAN Card, Other ID, Other Doc (uploaded to `admin-documents` bucket)
- **Salary Payment Details**: Cash / Bank Transfer / UPI / Cheque (with full bank account details if bank selected)

---

## 9. INVENTORY & STOCK FLOW

### Complete Flow

```
1. Admin adds medicine to universal catalog (medicines table)
   ↓
2. Admin adds stock batch (AddStock page → cart flow)
   - Search medicine (Google-style universal search)
   - Fill batch details: Batch No, DOM, DOE, Supplier, Packs, Loose, Cost/Pack, MRP/Pack
   - Set discount (0–20% slider)
   - Upload stockist bill image (required)
   - Enter total bill amount
   - Submit for approval
   ↓
3. Devta reviews batch request
   - Sees admin phone, bill image, calculated vs bill amount
   - Can approve/reject individual batches
   - On approve: generates Purchase Order Bill PDF
   ↓
4. Approved batches enter admin inventory (medicine_batches with status=approved)
   ↓
5. Admin creates transfer to a store (Transfer Stock button)
   - 3-step: Select Store → Add Medicines (FEFO batches) → Review & Dispatch
   - Units are reserved (deducted from medicine_batches.units_remaining) on dispatch
   ↓
6. Store manager receives transfer
   - Expands transfer, sees all items
   - Accept or Reject each item individually
   - Rejected items: reason required → units returned to admin batch
   - Accepted items: added to store_inventory with discount_percent carried over
   ↓
7. Store inventory is available for billing
```

### Inventory Management (Admin)
- **Inventory page**: all approved batches grouped by medicine, FEFO sorted
- Filter: Approved / Pending / All
- Stats cards: Total Medicines, In Stock (>50), Low Stock (≤50), Out of Stock, Pending Batches
- Each batch shows: status badge, expiry chip, bill image link, batch details

### Add Stock Page (Admin)
- Search bar with Google-style live dropdown (universal catalog)
- Matches on name, salt, generic name, brand, manufacturer
- Selected medicines added to cart
- Each cart item has inline form with all batch fields + discount slider
- Final step: BillSubmitModal — upload stockist bill + enter total amount → submitted as pending

### Medicine Catalog
- Universal (not admin-specific) — all admins share the same medicine list
- Fields: Name, Generic/Salt, Brand, Manufacturer, Category, Type, Schedule, Strength, Pack Size, Unit, HSN Code, Notes
- No MRP in catalog — MRP set per batch

---

## 10. BILLING SYSTEM

### Billing Page (Store Manager)
- **Required fields**: Customer Name, Phone Number, Doctor Referral (all mandatory)
- FEFO-sorted inventory display grouped by medicine
- Each batch shows: batch number, expiry, stock level, discount %, final price
- Batches with discount show: crossed-out MRP → discounted price

### Cart
- Add/remove medicines
- Packs + Loose units separately (respects pack size)
- Per-item: Medicine name, batch, discount badge, line total

### Price Breakdown (displayed before payment)
```
MRP Subtotal        ₹XXX
🏷️ Discount        − ₹XX   (only if any discount applied)
After Discount      ₹XXX
+ GST (5%)         ₹XX    (on after-discount amount)
──────────────────────────
Grand Total         ₹XXX
```

### Payment
- Cash, Card, UPI — can be split (e.g. ₹200 cash + ₹300 UPI)
- Balance indicator: shows if short or change to return
- Payment total MUST equal Grand Total — bill is blocked if there's a mismatch

### A4 Bill (printed on save)
- Professional black & white Tax Invoice layout
- Header: JanSwasthya Pharmacy + Store details + GSTIN
- Patient info: Customer Name, Phone
- Referred By: Doctor name, speciality, clinic
- Medicine table columns: #, Medicine, Pack, Batch No., Mfg., Expiry, Qty, MRP/Unit, Disc%, Rate, Amount
- Totals: MRP Subtotal → Discount → After Discount → GST 5% → Grand Total
- Payment details: Cash/Card/UPI breakdown
- Footer: computer-generated bill note

### Bill History
- Last 30 bills shown
- Shows: bill number, doctor referral, date, payment method, total, gross profit

### Doctor Referral (Billing)
- Google-style search across `doctors` table
- Matches on name, speciality, clinic name
- Can add new doctor inline (name, speciality, clinic, phone, city)
- Doctor shown on printed bill

---

## 11. TRANSFER SYSTEM

### Creating a Transfer (Admin → Store)
1. Select destination store
2. Pick medicines from approved batches (left panel, searchable, FEFO order)
3. Set quantity per batch
4. Review & Dispatch
- Units are deducted from `medicine_batches.units_remaining` on dispatch

### Receiving a Transfer (Store Manager)
- **Accept** → item added to `store_inventory` with discount_percent carried from original batch
- **Reject** → requires a reason → units returned to admin inventory → rejection record created for admin to see

### Rejection Visibility (Admin)
- "Issues" tab shows all rejected items
- Shows: medicine name, batch, store name, rejection reason, manager contact
- Admin can respond: Acknowledged / Replacement Sent / Resolved / No Action
- Re-transfer hint: go to Transfer Stock to re-send the medicine

### Admin Contact (Store Manager)
- Admin's name, phone, email shown on Transfers page
- Clickable phone link at bottom of each dispatched transfer

---

## 12. EMPLOYEE & TEAM MANAGEMENT

### Store Employees (submitted by Store Manager)
- Form: Personal info, identity (Aadhar, PAN), address, employment details, documents
- **Salary Payment Details**: Cash / Bank Transfer (full bank details) / UPI / Cheque
- Submitted → goes to Devta for approval
- On Devta approval: monthly salary auto-added as store expense

### Admin Warehouse Team (submitted by Admin)
- Same form as employees but for admin's warehouse/office staff
- Goes to Devta for approval
- On Devta approval: monthly salary auto-added as admin expense

### Store Managers (added by Devta when creating store)
- Full personal details + documents
- Salary payment details

### KYC Documents (all staff)
- Profile photo (required)
- Aadhar card photo (required)
- PAN card photo
- Other government ID
- Additional document

---

## 13. EXPENSE TRACKING

### Store-level Expenses (Store Manager)
- Categories: Inventory, Salary, Rent, Utilities, Maintenance, Transport, Marketing, Other
- Fields: Description, Amount, Date, Proof upload, Notes
- Visible to: Admin (in Analytics → Store Expenses) + Vishnu (in Analytics drilldown)

### Admin-level Expenses (Admin)
- Categories: Staff Salary, Inventory Transport, Office/Warehouse Rent, Utilities, Travel, Marketing, Bank Charges, Miscellaneous
- Fields: Description, Amount, Date, Payment Method, Proof upload, Notes
- Visible to: Admin (in Analytics) + Vishnu (in Analytics drilldown)

### Devta Expenses
- Categories + proof upload
- Visible to: Devta (My Expenses tab) + Vishnu (Analytics → Devta Expenses section)

### Auto-Salary Expenses
- When Devta approves any employee or admin team member
- A monthly salary expense is automatically created for that period
- Store employees → creates entry in `expenses` table (store_id)
- Admin team → creates entry in `admin_expenses` table (admin_id)

---

## 14. ANALYTICS & REPORTING

### Store Manager Analytics
- **Visible**: Total Sales, Average Bill Value, Total Expenses
- **Hidden**: Gross Profit, Net Profit, Cost of Goods, margins
- Charts: Sales trend bar chart
- Top 6 medicines by volume (units sold + revenue)
- Expense breakdown by category with progress bars
- Recent expenses list with proof links

### Admin Analytics
- **Visible**: Total Expenses, Store-wise expense breakdown, Admin/warehouse expense breakdown
- **Hidden**: Sales, Revenue, Profit — not shown to admin
- Two "Add Expense" buttons: My Expense (admin-level) + Store Expense

### Vishnu Analytics
- **Complete visibility**: Chain Sales, Chain Expenses, Net Balance
- Per-admin drilldown: their revenue, expenses, cash, UPI, card
- Per-store within admin: sales, expenses, cash, manager contacts
- Devta expenses shown at the bottom
- Cash Register tab: per-store cash vs UPI vs card breakdown

### Vishnu Reports
- Create named reports for any date range
- Auto-calculates and saves snapshot: Total Sales, Total Expenses, Net Amount
- Reports are permanent and immutable
- Accessible anytime from the Reports tab

---

## 15. NOTIFICATIONS

### Store Assignment Notification
- When Devta creates a store and assigns it to an admin
- Admin sees a blue notification banner on their Stores page
- Shows store name, city, state, "assigned by Devta"
- Can be dismissed (marks as read in database)

---

## 16. DATABASE TABLES

| Table | Purpose |
|---|---|
| `admins` | Admin users — includes KYC docs, bank details |
| `stores` | Pharmacy store records |
| `store_managers` | Store manager accounts + bank details |
| `employees` | Store staff — submitted by managers, approved by Devta |
| `admin_team` | Admin's warehouse/office staff — approved by Devta |
| `medicines` | Universal medicine catalog |
| `medicine_batches` | Admin inventory batches — status: pending/approved/rejected |
| `stock_transfers` | Transfer header records |
| `stock_transfer_items` | Line items per transfer |
| `store_inventory` | Per-store stock (created when transfer accepted) |
| `bills` | Customer bills |
| `bill_items` | Line items per bill |
| `expenses` | Store-level operating expenses |
| `admin_expenses` | Admin-level operating expenses |
| `devta_expenses` | Devta's own expenses |
| `devta` | Devta user accounts |
| `doctors` | Doctor referral database |
| `transfer_issue_resolutions` | Rejected transfer item records |
| `purchase_order_bills` | Devta-approved stock purchase order bills |
| `salary_payments` | Salary disbursement records |
| `inventory_purchase_orders` | Formal PO per stockist bill submission |
| `stock_adjustments` | Manual inventory corrections |
| `defect_reports` | In-store damage/loss reports |
| `store_daily_summary` | Pre-aggregated daily sales per store |
| `admin_region_monthly_summary` | Pre-aggregated monthly per admin |
| `inventory_requests` | Stock requests from store managers to admin |
| `notifications` | In-app notifications (e.g. new store assigned) |
| `vishnu_reports` | Permanent financial snapshots created by Vishnu |

---

## 17. STORAGE BUCKETS

| Bucket | Contents | Access |
|---|---|---|
| `store-documents` | Store registration docs (RDL, rent, pharmacist degree, GST, NOC) | Public |
| `manager-documents` | Manager photos, Aadhar, ID proofs | Public |
| `employee-documents` | Employee photos, Aadhar, ID proofs | Public |
| `admin-team-documents` | Admin warehouse staff documents | Public |
| `admin-documents` | Admin KYC docs (photo, Aadhar, PAN) — Vishnu only access | Public |
| `admin-expense-proofs` | Admin expense receipts/invoices | Public |
| `expense-proofs` | Store expense receipts | Public |
| `devta-expense-proofs` | Devta expense receipts | Public |
| `stockist-bills` | Stockist bill images uploaded during batch submission | Public |
| `purchase-order-pdfs` | Generated A4 purchase order bills (HTML files) | Public |

---

## 18. MIGRATIONS INDEX

| File | Description |
|---|---|
| `001_stores_and_managers.sql` | Stores, store_managers tables |
| `002_storage_buckets.sql` | Initial storage buckets |
| `003_employees.sql` | Employees table |
| `004_medicines.sql` | Universal medicine catalog |
| `005_medicine_batches.sql` | Admin inventory batches |
| `006_stock_transfer.sql` | Store inventory, stock transfers, transfer items |
| `007_hierarchy.sql` | Admins table, admin_id on stores, transfer issue resolutions |
| `008_sales_analytics.sql` | Bills, bill_items, expenses, selling_price on store_inventory |
| `009_inventory_batch_approval.sql` | admin_id, status, bill_image_url on medicine_batches |
| `010_financial_tracking_foundation.sql` | Salary payments, purchase orders, stock adjustments, defect reports, daily/monthly summaries |
| `011_devta_and_purchase_orders.sql` | Devta table, purchase_order_bills, storage bucket |
| `012_discount_and_doctors.sql` | Discount on batches/inventory, doctors table, referred_by on bills, payment splits |
| `013_admin_expenses_and_cash.sql` | Admin expenses table, store cash register |
| `014_devta_approvals.sql` | Admin team table, notifications table |
| `015_inventory_requests_devta_expenses_reports.sql` | Inventory requests, devta expenses, vishnu reports |
| `016_admin_kyc_documents.sql` | KYC doc columns on admins table |
| `017_salary_payment_details.sql` | Bank/UPI payment details on all staff tables |

---

## TECH NOTES

- **No Supabase Auth used** — custom session management via localStorage
- **No global state manager** — all state is local `useState` per component
- **No realtime subscriptions** — all data fetched on mount or manual refresh
- **Analytics computed client-side** — raw bill/expense data fetched and aggregated in browser
- **PDF generation** — HTML file written to storage bucket, opened in new tab with print dialog
- **Fullscreen** — browser Fullscreen API, guard re-enters on Esc via overlay click
- **OTP** — 4-digit, stored in module memory (does not survive page refresh), expires in 10 minutes, sent via Resend API

---

*This document describes the JanSwasthya Pharmacy ERP system as built. Last updated: September 2026.*
