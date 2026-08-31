import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';

const ISSUE_STATUS = {
  open:             { bg:'#FEE2E2',color:'#B91C1C',border:'#FECACA',label:'Open'              },
  acknowledged:     { bg:'#EFF6FF',color:'#1D4ED8',border:'#BFDBFE',label:'Acknowledged'      },
  resolved:         { bg:'#DCFCE7',color:'#15803D',border:'#BBF7D0',label:'Resolved ✅'        },
  replacement_sent: { bg:'#F0FDF4',color:'#15803D',border:'#BBF7D0',label:'Replacement Sent'  },
  refund_issued:    { bg:'#FFFBEB',color:'#92400E',border:'#FDE68A',label:'Refund Issued'      },
  no_action:        { bg:'#F1F5F9',color:'#64748B',border:'#CBD5E1',label:'No Action'          },
};

const ITEM_ICON = { defect:'⚠️', missing:'❌', short:'📉' };
const TYPE_ICONS = { Tablet:'💊',Capsule:'💊',Syrup:'🧴',Injection:'💉',Drops:'💧',Cream:'🧴',Ointment:'🧴',Powder:'🧂',Inhaler:'🌬️',Patch:'🩹',Suppository:'💊',Lozenges:'🍬',Other:'📦' };

// ── Helper: NO LONGER creates records — StoreTransfers.jsx creates them on rejection ──
// Just fetches existing records for a transfer
async function fetchIssueRecords(transferId) {
  const { data } = await supabase
    .from('transfer_issue_resolutions')
    .select('*')
    .eq('transfer_id', transferId)
    .order('created_at');
  return data || [];
}

// ── Issue panel for one transfer ──────────────────────────────────────────────
export function TransferIssuePanel({ transfer, transferItems, onResolved }) {
  const [issues,     setIssues]    = useState([]);
  const [loading,    setLoading]   = useState(true);
  const [responding, setResponding]= useState(null);
  const [response,   setResponse]  = useState('');
  const [newStatus,  setNewStatus] = useState('resolved');
  const [saving,     setSaving]    = useState(false);

  useEffect(() => {
    loadIssues();
  }, [transfer.id]);

  const loadIssues = async () => {
    setLoading(true);
    const data = await fetchIssueRecords(transfer.id);
    setIssues(data);
    setLoading(false);
  };

  const openCount = issues.filter(i => !['resolved','replacement_sent','refund_issued','no_action'].includes(i.status)).length;

  const handleRespond = async (issue) => {
    if (!response.trim()) { window.alert('Please enter a response'); return; }
    setSaving(true);
    try {
      const isFinal = ['resolved','replacement_sent','refund_issued','no_action'].includes(newStatus);
      await supabase.from('transfer_issue_resolutions').update({
        status:         newStatus,
        admin_response: response.trim(),
        resolved_at:    isFinal ? new Date().toISOString() : null,
      }).eq('id', issue.id);

      // Reload issues
      const updated = await fetchIssueRecords(transfer.id);
      setIssues(updated);

      // If all issues are now resolved, add missing items to store_inventory and close transfer
      const stillOpen = updated.filter(i => !['resolved','replacement_sent','refund_issued','no_action'].includes(i.status));
      if (stillOpen.length === 0 && isFinal) {
        // Add issue-affected items to store inventory (what was actually received)
        for (const item of transferItems.filter(i => ['defect','missing','short'].includes(i.item_status))) {
          const qtyR = item.quantity_units_received || 0;
          if (qtyR > 0) {
            // Check if already added
            const { count } = await supabase.from('store_inventory')
              .select('*', { count:'exact', head:true })
              .eq('transfer_item_id', item.id);
            if (count === 0) {
              await supabase.from('store_inventory').insert({
                store_id:            transfer.store_id,
                medicine_id:         item.medicine_id,
                batch_number:        item.batch_number,
                date_of_manufacture: item.date_of_manufacture,
                expiry_date:         item.expiry_date,
                mrp_per_pack:        item.mrp_per_pack,
                cost_price_per_pack: item.cost_price_per_pack,
                units_received:      qtyR,
                units_remaining:     qtyR,
                transfer_item_id:    item.id,
              });
            }
          }
        }
        // Mark transfer as received
        await supabase.from('stock_transfers').update({
          status: 'received',
          received_at: new Date().toISOString(),
          manager_notes: 'Issues resolved by admin',
        }).eq('id', transfer.id);

        onResolved?.();
      }

      setResponding(null);
      setResponse('');
    } catch (err) {
      window.alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding:'16px 20px', color:'var(--label-4)', fontSize:13 }}>Loading issues…</div>;
  if (issues.length === 0) return null;

  return (
    <div style={{ padding:'0 20px 20px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, margin:'14px 0 12px' }}>
        <span style={{ fontSize:13, fontWeight:700, color:'#B91C1C' }}>⚠️ Issues Reported ({issues.length})</span>
        {openCount > 0 && <span style={{ fontSize:11, fontWeight:700, background:'#FF3B30', color:'#fff', padding:'2px 8px', borderRadius:20 }}>{openCount} pending</span>}
        {openCount === 0 && <span style={{ fontSize:11, fontWeight:700, background:'#DCFCE7', color:'#15803D', padding:'2px 8px', borderRadius:20 }}>All resolved</span>}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {issues.map(issue => {
          const sc = ISSUE_STATUS[issue.status] || ISSUE_STATUS.open;
          const isOpen = !['resolved','replacement_sent','refund_issued','no_action'].includes(issue.status);
          const isResp = responding === issue.id;
          // Get matching transfer item
          const tItem = transferItems.find(i => i.id === issue.transfer_item_id);
          return (
            <div key={issue.id} style={{ background:'var(--bg-2)', border:`1px solid ${sc.border}`, borderRadius:'var(--radius-md)', overflow:'hidden' }}>
              {/* Issue header */}
              <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12, borderBottom: isResp||issue.manager_note||issue.admin_response ? '1px solid var(--bg-4)' : 'none' }}>
                <span style={{ fontSize:18, flexShrink:0 }}>{ITEM_ICON[issue.issue_type]||'⚠️'}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <span style={{ fontSize:13, fontWeight:700, color:'var(--label)' }}>
                      {tItem?.medicines?.name || issue.item_name}
                      {tItem?.medicines?.strength ? ` · ${tItem.medicines.strength}` : ''}
                    </span>
                    <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:sc.bg, color:sc.color, border:`1px solid ${sc.border}` }}>{sc.label}</span>
                  </div>
                  <div style={{ fontSize:11, color:'var(--label-4)', marginTop:2 }}>
                    Batch: {issue.batch_number}
                    {issue.units_affected > 0 && ` · ${issue.units_affected} units affected`}
                    {tItem && ` · Sent: ${tItem.quantity_units_sent}, Received: ${tItem.quantity_units_received ?? '?'}`}
                  </div>
                </div>
                {isOpen && !isResp && (
                  <button onClick={() => { setResponding(issue.id); setResponse(issue.admin_response||''); setNewStatus('resolved'); }}
                    style={{ background:'var(--accent-bg)', color:'var(--accent)', border:'1px solid rgba(255,59,48,0.2)', borderRadius:8, padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
                    Respond
                  </button>
                )}
              </div>
              {/* Notes */}
              {(issue.manager_note || issue.admin_response || isResp) && (
                <div style={{ padding:'12px 16px', background:'var(--bg-3)', display:'flex', flexDirection:'column', gap:8 }}>
                  {issue.manager_note && (
                    <div style={{ padding:'8px 12px', background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:8, fontSize:12, color:'#92400E' }}>
                      <strong>Manager:</strong> {issue.manager_note}
                    </div>
                  )}
                  {issue.admin_response && !isResp && (
                    <div style={{ padding:'8px 12px', background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:8, fontSize:12, color:'#15803D' }}>
                      <strong>Admin:</strong> {issue.admin_response}
                      {issue.resolved_at && <span style={{ color:'var(--label-4)', marginLeft:8 }}>· {new Date(issue.resolved_at).toLocaleDateString('en-IN')}</span>}
                    </div>
                  )}
                  {/* Respond form */}
                  {isResp && (
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      <textarea value={response} onChange={e => setResponse(e.target.value)}
                        placeholder="Describe the action you are taking…"
                        style={{ padding:'9px 12px', border:'1.5px solid var(--bg-4)', borderRadius:10, fontSize:13, fontFamily:'inherit', color:'var(--label)', background:'var(--bg-2)', outline:'none', resize:'vertical', minHeight:70, width:'100%', boxSizing:'border-box' }}
                        onFocus={e => e.target.style.borderColor='var(--accent)'}
                        onBlur={e => e.target.style.borderColor='var(--bg-4)'} />
                      {/* Status options */}
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                        <span style={{ fontSize:11, fontWeight:600, color:'var(--label-4)' }}>Mark as:</span>
                        {['resolved','replacement_sent','refund_issued','no_action','acknowledged'].map(s => {
                          const sc2 = ISSUE_STATUS[s];
                          return (
                            <button key={s} onClick={() => setNewStatus(s)}
                              style={{ padding:'4px 11px', borderRadius:20, border:`1.5px solid ${newStatus===s?sc2.color:sc2.color+'44'}`, background:newStatus===s?sc2.bg:'var(--bg-2)', color:sc2.color, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                              {sc2.label}
                            </button>
                          );
                        })}
                      </div>
                      {openCount === 1 && ['resolved','replacement_sent','refund_issued','no_action'].includes(newStatus) && (
                        <div style={{ padding:'8px 12px', background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:8, fontSize:12, color:'#1D4ED8', fontWeight:500 }}>
                          ℹ️ This is the last open issue. Resolving it will mark the transfer as <strong>Received</strong> and add remaining items to store inventory.
                        </div>
                      )}
                      <div style={{ display:'flex', gap:8 }}>
                        <button onClick={() => setResponding(null)}
                          style={{ background:'var(--bg-2)', border:'1px solid var(--bg-4)', color:'var(--label-3)', padding:'7px 14px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                          Cancel
                        </button>
                        <button onClick={() => handleRespond(issue)} disabled={saving}
                          style={{ background:'linear-gradient(145deg,#FF3B30,#D93025)', color:'#fff', border:'none', padding:'7px 20px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', boxShadow:'0 2px 8px rgba(255,59,48,0.22)' }}>
                          {saving ? '⏳' : '✓ Submit'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
