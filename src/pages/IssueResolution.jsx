/**
 * IssueResolution — Admin view of rejected transfer items
 *
 * Shows all items that the store manager rejected, with the rejection reason.
 * Admin can:
 *   1. View the reason
 *   2. Respond / acknowledge
 *   3. Mark as "Replacement Sent" (which will count as re-transfer outside this page)
 *   4. See the store manager's contact to call if needed
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import RefreshButton from '../components/RefreshButton';

const STATUS_CONFIG = {
  open:             { bg:'#FEE2E2', color:'#B91C1C', border:'#FECACA', label:'Rejected 🔴'       },
  acknowledged:     { bg:'#EFF6FF', color:'#1D4ED8', border:'#BFDBFE', label:'Acknowledged 🔵'   },
  resolved:         { bg:'#DCFCE7', color:'#15803D', border:'#BBF7D0', label:'Resolved ✅'        },
  replacement_sent: { bg:'#F0FDF4', color:'#15803D', border:'#BBF7D0', label:'Replacement Sent 📦'},
  no_action:        { bg:'#F1F5F9', color:'#64748B', border:'#CBD5E1', label:'No Action'          },
};

export default function IssueResolution({ adminId }) {
  const [issues,     setIssues]    = useState([]);
  const [loading,    setLoading]   = useState(true);
  const [filter,     setFilter]    = useState('open');
  const [responding, setResponding]= useState(null);
  const [response,   setResponse]  = useState('');
  const [newStatus,  setNewStatus] = useState('acknowledged');
  const [saving,     setSaving]    = useState(false);

  // Store manager contact map: { store_id: { phone, name } }
  const [managerContacts, setManagerContacts] = useState({});

  useEffect(() => { fetchIssues(); }, []);

  const fetchIssues = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('transfer_issue_resolutions')
      .select('*, stores(store_name, city), stock_transfers(id, dispatched_at)')
      .order('created_at', { ascending: false });
    setIssues(data || []);

    // Fetch manager contacts for unique store ids
    const storeIds = [...new Set((data || []).map(i => i.raised_by_store).filter(Boolean))];
    if (storeIds.length) {
      const { data: managers } = await supabase
        .from('store_managers')
        .select('store_id, full_name, phone')
        .in('store_id', storeIds)
        .eq('is_active', true);
      const map = {};
      (managers || []).forEach(m => { if (!map[m.store_id]) map[m.store_id] = m; });
      setManagerContacts(map);
    }

    setLoading(false);
  };

  const handleRespond = async (issue) => {
    if (!response.trim()) { window.alert('Please enter a response.'); return; }
    setSaving(true);
    try {
      const isFinal = ['resolved','replacement_sent','no_action'].includes(newStatus);
      await supabase.from('transfer_issue_resolutions').update({
        status:            newStatus,
        admin_response:    response.trim(),
        resolved_by_admin: adminId || null,
        resolved_at:       isFinal ? new Date().toISOString() : null,
      }).eq('id', issue.id);
      setResponding(null);
      setResponse('');
      await fetchIssues();
    } catch (err) {
      window.alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = issues.filter(i =>
    filter === 'all'      ? true
    : filter === 'open'   ? i.status === 'open'
    : filter === 'in_progress' ? i.status === 'acknowledged'
    : ['resolved','replacement_sent','no_action'].includes(i.status)
  );

  const openCount = issues.filter(i => i.status === 'open').length;

  return (
    <div style={{ padding:'24px 28px', maxWidth:900, margin:'0 auto',
      fontFamily:"'Inter',-apple-system,sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom:22 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ fontSize:22, fontWeight:700, color:'var(--label)',
              letterSpacing:'-0.3px', marginBottom:4 }}>
              ⚠️ Rejected Items
              {openCount > 0 && (
                <span style={{ marginLeft:10, fontSize:13, fontWeight:700,
                  background:'#FF3B30', color:'#fff', padding:'3px 10px', borderRadius:20 }}>
                  {openCount} open
                </span>
              )}
            </div>
            <div style={{ fontSize:13, color:'var(--label-4)' }}>
              Items rejected by store managers during receipt. Contact the manager or
              re-transfer the medicine from the Inventory page.
            </div>
          </div>
          <RefreshButton onRefresh={fetchIssues} />
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:4, background:'var(--bg-2)',
        border:'1px solid var(--bg-4)', borderRadius:12, padding:4,
        marginBottom:20, width:'fit-content', boxShadow:'var(--shadow-sm)',
        flexWrap:'wrap' }}>
        {[
          { id:'open',        label:`Open (${issues.filter(i=>i.status==='open').length})`                                                        },
          { id:'in_progress', label:`Acknowledged (${issues.filter(i=>i.status==='acknowledged').length})`                                        },
          { id:'resolved',    label:`Resolved (${issues.filter(i=>['resolved','replacement_sent','no_action'].includes(i.status)).length})`        },
          { id:'all',         label:`All (${issues.length})`                                                                                        },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            style={{ padding:'7px 14px', borderRadius:9, border:'none', cursor:'pointer',
              fontFamily:'inherit', fontSize:12, fontWeight:600, transition:'all 0.18s',
              background: filter===f.id ? 'var(--bg-2)' : 'transparent',
              color: filter===f.id ? 'var(--accent)' : 'var(--label-4)',
              boxShadow: filter===f.id ? 'var(--shadow-sm)' : 'none' }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--label-4)', fontSize:14 }}>
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px', background:'var(--bg-2)',
          borderRadius:'var(--radius-lg)', border:'1px solid var(--bg-4)' }}>
          <div style={{ fontSize:40, opacity:0.2, marginBottom:12 }}>✅</div>
          <div style={{ fontSize:15, fontWeight:600, color:'var(--label-3)' }}>
            {filter==='open' ? 'No open rejections' : 'Nothing here'}
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {filtered.map((issue, i) => {
            const sc         = STATUS_CONFIG[issue.status] || STATUS_CONFIG.open;
            const isResp     = responding === issue.id;
            const isFinalSt  = ['resolved','replacement_sent','no_action'].includes(issue.status);
            const mgr        = managerContacts[issue.raised_by_store];

            return (
              <motion.div key={issue.id}
                initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                transition={{ delay:i * 0.04 }}
                style={{ background:'var(--bg-2)', border:`1px solid ${sc.border}`,
                  borderRadius:'var(--radius-lg)', overflow:'hidden',
                  boxShadow:'var(--shadow-sm)' }}>

                {/* Header */}
                <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--bg-4)',
                  display:'flex', alignItems:'flex-start', gap:14 }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:sc.bg,
                    border:`1px solid ${sc.border}`, display:'flex', alignItems:'center',
                    justifyContent:'center', fontSize:22, flexShrink:0 }}>
                    ⚠️
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8,
                      marginBottom:3, flexWrap:'wrap' }}>
                      <span style={{ fontSize:15, fontWeight:700, color:'var(--label)' }}>
                        {issue.item_name || 'Unknown Item'}
                      </span>
                      <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px',
                        borderRadius:20, background:sc.bg, color:sc.color,
                        border:`1px solid ${sc.border}` }}>
                        {sc.label}
                      </span>
                    </div>
                    <div style={{ fontSize:12, color:'var(--label-4)', marginBottom:2 }}>
                      Store: <strong>{issue.stores?.store_name}</strong> · {issue.stores?.city}
                    </div>
                    <div style={{ display:'flex', gap:12, flexWrap:'wrap',
                      fontSize:12, color:'var(--label-3)' }}>
                      {issue.batch_number && <span>Batch: <strong>{issue.batch_number}</strong></span>}
                      {issue.units_affected > 0 && <span>Units: <strong>{issue.units_affected}</strong></span>}
                      <span>Reported: {new Date(issue.created_at).toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Manager contact */}
                  {mgr && (
                    <div style={{ flexShrink:0, textAlign:'right' }}>
                      <div style={{ fontSize:11, color:'var(--label-4)', marginBottom:2 }}>
                        Manager Contact
                      </div>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--label-2)' }}>
                        {mgr.full_name}
                      </div>
                      {mgr.phone && (
                        <a href={`tel:${mgr.phone}`}
                          style={{ fontSize:12, color:'#007AFF', fontWeight:700,
                            textDecoration:'none', display:'flex', alignItems:'center',
                            gap:4, justifyContent:'flex-end', marginTop:2 }}>
                          📞 {mgr.phone}
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div style={{ padding:'14px 20px' }}>
                  {/* Rejection reason */}
                  {issue.manager_note && (
                    <div style={{ background:'#FEF3C7', border:'1px solid #FDE68A',
                      borderRadius:8, padding:'10px 14px', marginBottom:12,
                      fontSize:13, color:'#92400E' }}>
                      <strong>Manager's reason for rejection:</strong> {issue.manager_note}
                    </div>
                  )}

                  {/* Admin response */}
                  {issue.admin_response && (
                    <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0',
                      borderRadius:8, padding:'10px 14px', marginBottom:12,
                      fontSize:13, color:'#15803D' }}>
                      <strong>Your response:</strong> {issue.admin_response}
                      {issue.resolved_at && (
                        <div style={{ fontSize:11, color:'var(--label-4)', marginTop:3 }}>
                          {new Date(issue.resolved_at).toLocaleDateString('en-IN')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Re-transfer hint */}
                  {!isFinalSt && (
                    <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE',
                      borderRadius:8, padding:'9px 14px', marginBottom:12,
                      fontSize:12, color:'#1D4ED8', display:'flex', gap:8 }}>
                      <span>💡</span>
                      <span>
                        To re-send this medicine, go to <strong>Add Stock → Transfer Stock</strong>
                        and create a new transfer for this item to the store.
                        Then mark this issue as <em>Replacement Sent</em>.
                      </span>
                    </div>
                  )}

                  {/* Respond section */}
                  {!isFinalSt && (
                    <>
                      {!isResp ? (
                        <button
                          onClick={() => {
                            setResponding(issue.id);
                            setResponse(issue.admin_response || '');
                            setNewStatus('acknowledged');
                          }}
                          style={{ background:'var(--accent-bg)', color:'var(--accent)',
                            border:'1px solid rgba(255,59,48,0.2)', borderRadius:8,
                            padding:'7px 16px', fontSize:12, fontWeight:600,
                            cursor:'pointer', fontFamily:'inherit' }}>
                          {issue.admin_response ? '✏️ Update Response' : '💬 Respond'}
                        </button>
                      ) : (
                        <AnimatePresence>
                          <motion.div
                            initial={{ opacity:0, height:0 }}
                            animate={{ opacity:1, height:'auto' }}
                            style={{ overflow:'hidden' }}>
                            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                              <div className="field" style={{ gap:5 }}>
                                <label style={{ fontSize:12, fontWeight:600, color:'var(--label-3)' }}>
                                  Your Response
                                </label>
                                <textarea value={response}
                                  onChange={e => setResponse(e.target.value)}
                                  placeholder="Describe what action you are taking…"
                                  style={{ padding:'10px 13px', border:'1.5px solid var(--bg-4)',
                                    borderRadius:10, fontSize:13, fontFamily:'inherit',
                                    color:'var(--label)', background:'var(--bg-3)',
                                    outline:'none', resize:'vertical', minHeight:70,
                                    width:'100%' }}
                                  onFocus={e => e.target.style.borderColor='var(--accent)'}
                                  onBlur={e => e.target.style.borderColor='var(--bg-4)'} />
                              </div>
                              <div style={{ display:'flex', gap:8, alignItems:'center',
                                flexWrap:'wrap' }}>
                                <span style={{ fontSize:12, fontWeight:600, color:'var(--label-3)' }}>
                                  Mark as:
                                </span>
                                {Object.entries(STATUS_CONFIG).map(([s, sc2]) => (
                                  <button key={s} onClick={() => setNewStatus(s)}
                                    style={{ padding:'5px 12px', borderRadius:20,
                                      border:`1.5px solid ${newStatus===s ? sc2.color : sc2.color+'44'}`,
                                      background: newStatus===s ? sc2.bg : 'var(--bg-3)',
                                      color:sc2.color, fontSize:11, fontWeight:600,
                                      cursor:'pointer', fontFamily:'inherit' }}>
                                    {sc2.label}
                                  </button>
                                ))}
                              </div>
                              <div style={{ display:'flex', gap:8 }}>
                                <button onClick={() => setResponding(null)}
                                  style={{ background:'var(--bg-3)', border:'1px solid var(--bg-4)',
                                    color:'var(--label-3)', padding:'7px 16px', borderRadius:8,
                                    fontSize:12, fontWeight:600, cursor:'pointer',
                                    fontFamily:'inherit' }}>
                                  Cancel
                                </button>
                                <button onClick={() => handleRespond(issue)} disabled={saving}
                                  style={{ background:'linear-gradient(145deg,#FF3B30,#D93025)',
                                    color:'#fff', border:'none', padding:'7px 20px',
                                    borderRadius:8, fontSize:12, fontWeight:600,
                                    cursor:'pointer', fontFamily:'inherit',
                                    boxShadow:'0 2px 8px rgba(255,59,48,0.25)' }}>
                                  {saving ? '⏳ Saving…' : '✓ Submit Response'}
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
