import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';

const SALARY_MODE_LABEL = {
  cash: '💵 Cash',
  bank_transfer: '🏦 Bank Transfer',
  upi: '📲 UPI',
  cheque: '📋 Cheque',
};

function PaymentBadge({ mode, bankName, bankAccount, bankIfsc, upiId }) {
  const label = SALARY_MODE_LABEL[mode] || (mode ? mode : '💵 Cash');
  return (
    <div style={{ marginTop: 6 }}>
      <span style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 700,
        background: mode === 'bank_transfer' ? '#DBEAFE' : mode === 'upi' ? '#F0FDF4' : mode === 'cheque' ? '#FEF9C3' : '#FEF3C7',
        color: mode === 'bank_transfer' ? '#1D4ED8' : mode === 'upi' ? '#15803D' : mode === 'cheque' ? '#92400E' : '#92400E',
        letterSpacing: '0.4px',
      }}>
        {label}
      </span>
      {(mode === 'bank_transfer' || mode === 'upi') && (
        <div style={{ fontSize: 10, color: 'var(--label-4)', marginTop: 3, paddingLeft: 2 }}>
          {mode === 'bank_transfer' && bankName && <span>{bankName}{bankAccount ? ` · ****${String(bankAccount).slice(-4)}` : ''}{bankIfsc ? ` · ${bankIfsc}` : ''}</span>}
          {mode === 'upi' && upiId && <span>{upiId}</span>}
        </div>
      )}
    </div>
  );
}

export default function VishnuTeam() {
  const [loading, setLoading] = useState(true);
  const [teamData, setTeamData] = useState([]);
  const [totalSalary, setTotalSalary] = useState(0);
  const [expanded, setExpanded] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => { fetchTeamData(); }, []);

  const fetchTeamData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch all admins (active + inactive, so nothing is hidden)
      // salary, salary_type added by migration 019; salary_mode, bank_* added by migration 017
      const { data: admins, error: adminsErr } = await supabase
        .from('admins')
        .select('id, full_name, email, city, state, region, designation, is_active, salary, salary_type, salary_mode, bank_name, bank_account_no, bank_ifsc, bank_branch, upi_id')
        .order('full_name');

      if (adminsErr) throw adminsErr;

      const adminPromises = (admins || []).map(async (admin) => {
        // 2. Get stores for this admin
        const { data: stores, error: storesErr } = await supabase
          .from('stores')
          .select('id, store_name, city, state')
          .eq('admin_id', admin.id)
          .eq('is_active', true);

        if (storesErr) console.error('stores error', storesErr);

        const storeIds = (stores || []).map(s => s.id);

        // 3. Only query if there are stores
        let managers = [];
        let employees = [];

        if (storeIds.length > 0) {
          const { data: mgrs, error: mgrsErr } = await supabase
            .from('store_managers')
            .select('id, full_name, email, phone, designation, salary, salary_mode, salary_type, bank_name, bank_account_no, bank_ifsc, upi_id, store_id, is_active')
            .in('store_id', storeIds);
          if (mgrsErr) console.error('managers error', mgrsErr);
          managers = mgrs || [];

          const { data: emps, error: empsErr } = await supabase
            .from('employees')
            .select('id, full_name, email, phone, designation, salary, salary_mode, salary_type, bank_name, bank_account_no, bank_ifsc, upi_id, store_id, status, is_active')
            .in('store_id', storeIds)
            .eq('status', 'approved');
          if (empsErr) console.error('employees error', empsErr);
          employees = emps || [];
        }

        // 4. Admin team (warehouse staff)
        const { data: adminTeam, error: atErr } = await supabase
          .from('admin_team')
          .select('id, full_name, email, phone, designation, salary, salary_mode, salary_type, bank_name, bank_account_no, bank_ifsc, upi_id, is_active')
          .eq('admin_id', admin.id);
        if (atErr) console.error('admin_team error', atErr);

        // 5. Group by store
        const storesWithStaff = (stores || []).map(store => {
          const storeManagers = managers.filter(m => m.store_id === store.id);
          const storeEmployees = employees.filter(e => e.store_id === store.id);
          const managersSalary = storeManagers.reduce((sum, m) => sum + (parseFloat(m.salary) || 0), 0);
          const employeesSalary = storeEmployees.reduce((sum, e) => sum + (parseFloat(e.salary) || 0), 0);
          return { ...store, managers: storeManagers, employees: storeEmployees, totalSalary: managersSalary + employeesSalary };
        });

        const adminTeamArr = adminTeam || [];
        const adminTeamSalary = adminTeamArr.reduce((sum, m) => sum + (parseFloat(m.salary) || 0), 0);
        const storesTotalSalary = storesWithStaff.reduce((sum, s) => sum + s.totalSalary, 0);
        const adminOwnSalary = parseFloat(admin.salary) || 0;

        return {
          ...admin,
          stores: storesWithStaff,
          adminTeam: adminTeamArr,
          adminTeamSalary,
          storesTotalSalary,
          totalSalary: adminOwnSalary + adminTeamSalary + storesTotalSalary,
        };
      });

      const result = await Promise.all(adminPromises);
      const grandTotal = result.reduce((sum, a) => sum + a.totalSalary, 0);
      setTeamData(result);
      setTotalSalary(grandTotal);
    } catch (err) {
      console.error('Error fetching team data:', err);
      setError(err.message || 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id, type) =>
    setExpanded(prev => ({ ...prev, [`${type}-${id}`]: !prev[`${type}-${id}`] }));

  const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--label-4)', fontSize: 14 }}>
      Loading team data…
    </div>
  );

  if (error) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#B91C1C', fontSize: 14 }}>
      ⚠️ {error}
    </div>
  );

  // Count all people
  const totalAdmins = teamData.length;
  const totalManagers = teamData.reduce((s, a) => s + a.stores.reduce((ss, st) => ss + st.managers.length, 0), 0);
  const totalEmployees = teamData.reduce((s, a) => s + a.stores.reduce((ss, st) => ss + st.employees.length, 0), 0);
  const totalWarehouse = teamData.reduce((s, a) => s + a.adminTeam.length, 0);

  return (
    <div style={{ fontFamily: "'Inter',-apple-system,sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--label)', letterSpacing: '-0.3px', marginBottom: 6 }}>
          👥 Our Team
        </div>
        <div style={{ fontSize: 14, color: 'var(--label-4)' }}>
          Full hierarchy — Admins → Stores → Managers → Employees, with salary & payment details
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Admins', count: totalAdmins, color: '#7c3aed', bg: '#F5F3FF' },
          { label: 'Warehouse Staff', count: totalWarehouse, color: '#6366f1', bg: '#EEF2FF' },
          { label: 'Store Managers', count: totalManagers, color: '#0288D1', bg: '#E0F2FE' },
          { label: 'Employees', count: totalEmployees, color: '#15803D', bg: '#F0FDF4' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '14px 16px', border: `1px solid ${s.color}22` }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: s.color, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Total Salary Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
          borderRadius: 16,
          padding: '24px 28px',
          marginBottom: 24,
          boxShadow: '0 8px 24px rgba(124,58,237,0.25)',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: '#E0E7FF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
          Total Monthly Salary Expense
        </div>
        <div style={{ fontSize: 42, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
          {fmt(totalSalary)}
        </div>
        <div style={{ fontSize: 13, color: '#E0E7FF', marginTop: 4 }}>
          {totalAdmins + totalWarehouse + totalManagers + totalEmployees} people across all regions
        </div>
      </motion.div>

      {/* Admins List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {teamData.map((admin, index) => {
          const isAdminExpanded = expanded[`admin-${admin.id}`];
          const totalStoreStaff = admin.stores.reduce((s, st) => s + st.managers.length + st.employees.length, 0);
          return (
            <motion.div
              key={admin.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              style={{
                background: 'var(--bg-2)',
                border: admin.is_active ? '1px solid #DDD6FE' : '1px solid var(--bg-4)',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)',
                opacity: admin.is_active ? 1 : 0.7,
              }}
            >
              {/* Admin Header Row */}
              <div
                style={{
                  padding: '18px 22px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  cursor: 'pointer',
                  background: isAdminExpanded ? '#F5F3FF' : 'var(--bg-2)',
                  transition: 'background 0.2s',
                }}
                onClick={() => toggleExpand(admin.id, 'admin')}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: admin.is_active ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : '#999',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {admin.full_name.slice(0, 2).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--label)' }}>
                      {admin.full_name}
                    </div>
                    {!admin.is_active && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: '#FEE2E2', color: '#B91C1C', padding: '2px 8px', borderRadius: 20 }}>
                        INACTIVE
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--label-4)', marginTop: 2 }}>
                    {admin.designation} · {admin.city || admin.region || 'No location'}
                    {admin.state ? `, ${admin.state}` : ''}
                  </div>
                  <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2 }}>
                    {admin.stores.length} store{admin.stores.length !== 1 ? 's' : ''} ·{' '}
                    {admin.adminTeam.length} warehouse staff ·{' '}
                    {totalStoreStaff} store staff
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--label-4)', marginBottom: 2 }}>
                    {isAdminExpanded ? 'Admin Own Salary' : 'Total Monthly Cost'}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#7c3aed' }}>
                    {fmt(isAdminExpanded ? admin.salary : admin.totalSalary)}
                  </div>
                  {!isAdminExpanded && admin.totalSalary > 0 && (
                    <div style={{ fontSize: 10, color: '#7c3aed', marginTop: 2, opacity: 0.7 }}>
                      incl. {admin.adminTeam.length + admin.stores.reduce((s,st) => s + st.managers.length + st.employees.length, 0)} staff
                    </div>
                  )}
                  {isAdminExpanded && (
                    <PaymentBadge
                      mode={admin.salary_mode || admin.salary_type}
                      bankName={admin.bank_name}
                      bankAccount={admin.bank_account_no}
                      bankIfsc={admin.bank_ifsc}
                      upiId={admin.upi_id}
                    />
                  )}
                </div>

                <div style={{ fontSize: 18, color: 'var(--label-4)', flexShrink: 0 }}>
                  {isAdminExpanded ? '▲' : '▼'}
                </div>
              </div>

              {/* Expanded Admin Content */}
              <AnimatePresence>
                {isAdminExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ padding: '0 22px 22px' }}>

                      {/* Warehouse Staff */}
                      {admin.adminTeam.length > 0 && (
                        <div style={{ marginTop: 16, marginBottom: 16 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>💼 Warehouse Staff ({admin.adminTeam.length})</span>
                            <span style={{ fontSize: 12, color: '#6366f1' }}>{fmt(admin.adminTeamSalary)}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {admin.adminTeam.map(member => (
                              <StaffRow key={member.id} person={member} color="#6366f1" bgColor="#EEF2FF" />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Stores */}
                      {admin.stores.length === 0 && admin.adminTeam.length === 0 && (
                        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--label-4)', fontSize: 13 }}>
                          No stores or warehouse staff assigned
                        </div>
                      )}

                      {admin.stores.map(store => {
                        const storeExpanded = expanded[`store-${store.id}`];
                        return (
                          <div key={store.id} style={{ marginTop: 12 }}>
                            {/* Store Header */}
                            <div
                              style={{
                                background: storeExpanded ? '#DCFCE7' : '#F0FDF4',
                                borderRadius: 12,
                                padding: '12px 16px',
                                border: '1px solid #BBF7D0',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                transition: 'background 0.2s',
                              }}
                              onClick={() => toggleExpand(store.id, 'store')}
                            >
                              <span style={{ fontSize: 20 }}>🏪</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#166534' }}>{store.store_name}</div>
                                <div style={{ fontSize: 11, color: '#166534', marginTop: 1 }}>
                                  {store.city}{store.state ? `, ${store.state}` : ''} ·{' '}
                                  {store.managers.length} manager{store.managers.length !== 1 ? 's' : ''} ·{' '}
                                  {store.employees.length} employee{store.employees.length !== 1 ? 's' : ''}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontSize: 11, color: '#166534' }}>Store Salary</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#15803D' }}>{fmt(store.totalSalary)}</div>
                              </div>
                              <div style={{ fontSize: 14, color: '#166534' }}>{storeExpanded ? '▲' : '▼'}</div>
                            </div>

                            {/* Store Staff */}
                            <AnimatePresence>
                              {storeExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  style={{ overflow: 'hidden' }}
                                >
                                  <div style={{ padding: '12px 8px', background: 'var(--bg-3)', borderRadius: '0 0 12px 12px', marginTop: -4 }}>
                                    {store.managers.length > 0 && (
                                      <div style={{ marginBottom: 12 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: '#0288D1', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                                          <span>👤 Store Managers ({store.managers.length})</span>
                                          <span>{fmt(store.managers.reduce((s, m) => s + (parseFloat(m.salary) || 0), 0))}</span>
                                        </div>
                                        {store.managers.map(m => (
                                          <StaffRow key={m.id} person={m} color="#0288D1" bgColor="#E0F2FE" />
                                        ))}
                                      </div>
                                    )}

                                    {store.employees.length > 0 && (
                                      <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                                          <span>🌱 Employees ({store.employees.length})</span>
                                          <span>{fmt(store.employees.reduce((s, e) => s + (parseFloat(e.salary) || 0), 0))}</span>
                                        </div>
                                        {store.employees.map(e => (
                                          <StaffRow key={e.id} person={e} color="#15803D" bgColor="#DCFCE7" />
                                        ))}
                                      </div>
                                    )}

                                    {store.managers.length === 0 && store.employees.length === 0 && (
                                      <div style={{ textAlign: 'center', padding: 20, color: 'var(--label-4)', fontSize: 12 }}>
                                        No staff assigned to this store yet
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}

                      {/* Admin Total Footer */}
                      <div style={{
                        marginTop: 16,
                        padding: '14px 18px',
                        background: 'linear-gradient(135deg,#F5F3FF,#EDE9FE)',
                        borderRadius: 10,
                        border: '1px solid #DDD6FE',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>
                            Total under {admin.full_name}
                          </div>
                          <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2 }}>
                            Own + {admin.adminTeam.length} warehouse + {admin.stores.length} stores
                          </div>
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#7c3aed' }}>
                          {fmt(admin.totalSalary)}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {teamData.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, background: 'var(--bg-2)', borderRadius: 16, border: '1px solid var(--bg-4)' }}>
          <div style={{ fontSize: 48, opacity: 0.2, marginBottom: 16 }}>👥</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--label-3)', marginBottom: 6 }}>
            No team data found
          </div>
          <div style={{ fontSize: 13, color: 'var(--label-4)' }}>
            Add admins and assign stores to see team hierarchy
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reusable staff row ────────────────────────────────────────────────────────
function StaffRow({ person, color, bgColor }) {
  const [showDetails, setShowDetails] = useState(false);
  const mode = person.salary_mode || person.salary_type;
  const hasBank = person.bank_name || person.bank_account_no || person.bank_ifsc;
  const hasUpi = person.upi_id;

  return (
    <div style={{
      background: 'var(--bg-2)',
      borderRadius: 10,
      marginBottom: 6,
      border: `1px solid ${color}22`,
      overflow: 'hidden',
    }}>
      <div
        style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: (hasBank || hasUpi) ? 'pointer' : 'default' }}
        onClick={() => (hasBank || hasUpi) && setShowDetails(d => !d)}
      >
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: bgColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: color, flexShrink: 0,
        }}>
          {person.full_name.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--label)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {person.full_name}
            {person.is_active === false && (
              <span style={{ fontSize: 9, fontWeight: 700, background: '#FEE2E2', color: '#B91C1C', padding: '1px 6px', borderRadius: 20 }}>
                INACTIVE
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--label-4)' }}>
            {person.designation}
            {person.phone ? ` · ${person.phone}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color }}>
            {Number(person.salary || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
          </div>
          {mode && (
            <div style={{
              fontSize: 10, fontWeight: 600, marginTop: 2,
              color: mode === 'bank_transfer' ? '#1D4ED8' : mode === 'upi' ? '#15803D' : '#92400E',
            }}>
              {SALARY_MODE_LABEL[mode] || mode}
            </div>
          )}
        </div>
        {(hasBank || hasUpi) && (
          <div style={{ fontSize: 12, color: 'var(--label-4)', flexShrink: 0 }}>
            {showDetails ? '▲' : '▼'}
          </div>
        )}
      </div>

      {/* Bank / UPI details drawer */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '10px 14px 14px', borderTop: `1px dashed ${color}33`, background: bgColor + '55' }}>
              {hasBank && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12 }}>
                  {person.bank_holder_name && <Detail label="Account Holder" value={person.bank_holder_name} />}
                  {person.bank_name && <Detail label="Bank" value={person.bank_name} />}
                  {person.bank_account_no && <Detail label="Account" value={person.bank_account_no} />}
                  {person.bank_ifsc && <Detail label="IFSC" value={person.bank_ifsc} />}
                  {person.bank_branch && <Detail label="Branch" value={person.bank_branch} />}
                </div>
              )}
              {hasUpi && (
                <div style={{ fontSize: 12, marginTop: hasBank ? 6 : 0 }}>
                  <Detail label="UPI ID" value={person.upi_id} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div style={{ marginBottom: 2 }}>
      <span style={{ color: 'var(--label-4)', fontWeight: 600 }}>{label}: </span>
      <span style={{ color: 'var(--label-2)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}
