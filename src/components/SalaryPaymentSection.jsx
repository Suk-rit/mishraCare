/**
 * SalaryPaymentSection
 * Reusable salary payment mode selector + bank/UPI details.
 * Used in: AddEmployeeModal, AddManagerModal, AdminStaffTab, Vishnu AddAdmin.
 *
 * Props:
 *   form     — object with salary_mode, bank_holder_name, bank_name,
 *              bank_account_no, bank_ifsc, bank_branch, upi_id
 *   onChange — (key, value) => void
 */

const MODES = [
  { id: 'cash',          icon: '💵', label: 'Cash'          },
  { id: 'bank_transfer', icon: '🏦', label: 'Bank Transfer' },
  { id: 'upi',           icon: '📱', label: 'UPI'           },
  { id: 'cheque',        icon: '📄', label: 'Cheque'        },
];

function Inp({ label, value, onChange, placeholder, required, hint, mono }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-3)' }}>
        {label}{required && <span style={{ color: '#B91C1C' }}> *</span>}
      </label>
      <input
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: '8px 10px', fontSize: 13, borderRadius: 8,
          border: '1.5px solid var(--bg-4)', background: 'var(--bg-3)',
          color: 'var(--label)', fontFamily: mono ? 'monospace' : 'inherit',
          outline: 'none', boxSizing: 'border-box', width: '100%',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        onBlur={e => e.target.style.borderColor = 'var(--bg-4)'}
      />
      {hint && <div style={{ fontSize: 11, color: 'var(--label-4)' }}>{hint}</div>}
    </div>
  );
}

export default function SalaryPaymentSection({ form, onChange }) {
  const mode = form.salary_mode || 'cash';

  return (
    <div>
      {/* Mode selector */}
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-4)',
        textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8 }}>
        Salary Payment Mode
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
        {MODES.map(m => (
          <button key={m.id} type="button"
            onClick={() => onChange('salary_mode', m.id)}
            style={{
              padding: '8px 14px', borderRadius: 10, border: '1.5px solid',
              borderColor: mode === m.id ? 'var(--accent)' : 'var(--bg-4)',
              background:  mode === m.id ? 'var(--accent-bg)' : 'var(--bg-3)',
              color:       mode === m.id ? 'var(--accent)' : 'var(--label-3)',
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
              fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
              transition: 'all 0.15s',
            }}>
            <span>{m.icon}</span> {m.label}
          </button>
        ))}
      </div>

      {/* Bank details — shown for bank_transfer or cheque */}
      {(mode === 'bank_transfer' || mode === 'cheque') && (
        <div style={{ background: 'var(--bg-3)', border: '1px solid var(--bg-4)',
          borderRadius: 12, padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-4)',
            textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            🏦 Bank Account Details
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Inp label="Account Holder Name" required
              value={form.bank_holder_name}
              onChange={v => onChange('bank_holder_name', v)}
              placeholder="Ramesh Kumar" />
            <Inp label="Bank Name" required
              value={form.bank_name}
              onChange={v => onChange('bank_name', v)}
              placeholder="State Bank of India" />
            <Inp label="Account Number" required mono
              value={form.bank_account_no}
              onChange={v => onChange('bank_account_no', v)}
              placeholder="0012345678901" />
            <Inp label="IFSC Code" required mono
              value={form.bank_ifsc}
              onChange={v => onChange('bank_ifsc', v.toUpperCase())}
              placeholder="SBIN0001234"
              hint="11-character code printed on cheque book" />
            <div style={{ gridColumn: '1/-1' }}>
              <Inp label="Branch Name (optional)"
                value={form.bank_branch}
                onChange={v => onChange('bank_branch', v)}
                placeholder="Lucknow Main Branch" />
            </div>
          </div>
        </div>
      )}

      {/* UPI details */}
      {mode === 'upi' && (
        <div style={{ background: 'var(--bg-3)', border: '1px solid var(--bg-4)',
          borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--label-4)',
            textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>
            📱 UPI Details
          </div>
          <Inp label="UPI ID" required mono
            value={form.upi_id}
            onChange={v => onChange('upi_id', v)}
            placeholder="name@upi or 9876543210@paytm"
            hint="e.g. ramesh@oksbi, 9876543210@paytm" />
        </div>
      )}

      {/* Cash note */}
      {mode === 'cash' && (
        <div style={{ padding: '9px 14px', background: '#FFFBEB',
          border: '1px solid #FDE68A', borderRadius: 9, fontSize: 12, color: '#92400E' }}>
          💵 Salary will be paid in cash. No bank details needed.
        </div>
      )}
    </div>
  );
}

/** Returns the salary payment fields to include in a DB insert/update */
export function salaryPaymentFields(form) {
  return {
    salary_mode:      form.salary_mode      || 'cash',
    bank_holder_name: form.bank_holder_name?.trim() || null,
    bank_name:        form.bank_name?.trim()        || null,
    bank_account_no:  form.bank_account_no?.trim()  || null,
    bank_ifsc:        form.bank_ifsc?.trim().toUpperCase() || null,
    bank_branch:      form.bank_branch?.trim()      || null,
    upi_id:           form.upi_id?.trim()           || null,
  };
}

/** Empty defaults to spread into any form state */
export const SALARY_PAYMENT_DEFAULTS = {
  salary_mode:      'cash',
  bank_holder_name: '',
  bank_name:        '',
  bank_account_no:  '',
  bank_ifsc:        '',
  bank_branch:      '',
  upi_id:           '',
};
