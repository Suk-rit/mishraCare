import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: '#34C759', bg: '#F0FDF4' },
  { value: 'medium', label: 'Medium', color: '#FF9500', bg: '#FFFBEB' },
  { value: 'high', label: 'High', color: '#FF3B30', bg: '#FFF1F0' },
  { value: 'critical', label: 'Critical', color: '#7c3aed', bg: '#F5F3FF' },
];

const CATEGORY_OPTIONS = [
  { value: 'login', label: '🔐 Login / Access' },
  { value: 'performance', label: '⚡ Performance' },
  { value: 'bug', label: '🐛 Bug / Error' },
  { value: 'feature', label: '✨ Feature Request' },
  { value: 'data', label: '📊 Data Issue' },
  { value: 'other', label: '📋 Other' },
];

const STATUS_META = {
  open: { label: 'Open', color: '#FF9500', bg: '#FFFBEB', border: '#FDE68A' },
  in_progress: { label: 'In Progress', color: '#007AFF', bg: '#EFF6FF', border: '#BFDBFE' },
  resolved: { label: 'Resolved', color: '#34C759', bg: '#F0FDF4', border: '#BBF7D0' },
  closed: { label: 'Closed', color: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB' },
};

export default function VishnuITSupport() {
  const [view, setView] = useState('open'); // 'open' or 'previous'
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTicket, setExpandedTicket] = useState(null);
  const [comments, setComments] = useState({}); // { ticketId: [comments] }
  const [newComment, setNewComment] = useState(''); // For adding new comment
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, [view]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('it_support_requests')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (view === 'open') {
        setTickets((data || []).filter(t => t.status === 'open' || t.status === 'in_progress'));
      } else {
        setTickets((data || []).filter(t => t.status === 'resolved' || t.status === 'closed'));
      }
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (ticketId) => {
    if (comments[ticketId]) return; // Already fetched
    
    try {
      const { data } = await supabase
        .from('it_support_comments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      setComments(prev => ({ ...prev, [ticketId]: data || [] }));
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
  };

  const addComment = async (ticketId) => {
    if (!newComment.trim()) return;
    
    setSubmittingComment(true);
    try {
      const { error } = await supabase.from('it_support_comments').insert({
        ticket_id: ticketId,
        author_id: '00000000-0000-0000-0000-000000000000', // Placeholder UUID for Vishnu
        author_name: 'Vishnu',
        author_role: 'vishnu',
        comment: newComment.trim(),
      });

      if (error) throw error;

      setNewComment('');
      // Refetch comments
      const { data } = await supabase
        .from('it_support_comments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      setComments(prev => ({ ...prev, [ticketId]: data || [] }));
      
      // Update ticket status if it was closed
      await supabase
        .from('it_support_requests')
        .update({ status: 'open' })
        .eq('id', ticketId);
      
      fetchTickets();
    } catch (err) {
      console.error('Error adding comment:', err);
      alert('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCloseTicket = async (ticketId) => {
    if (!confirm('Are you sure you want to close this ticket?')) return;
    
    try {
      const { error } = await supabase
        .from('it_support_requests')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: null, // Vishnu's user ID would go here
        })
        .eq('id', ticketId);

      if (error) throw error;

      fetchTickets();
    } catch (err) {
      console.error('Error closing ticket:', err);
      alert('Failed to close ticket. Please try again.');
    }
  };

  const handleMarkResolved = async (ticketId) => {
    try {
      const { error } = await supabase
        .from('it_support_requests')
        .update({
          status: 'resolved',
          vishnu_responded_at: new Date().toISOString(),
        })
        .eq('id', ticketId);

      if (error) throw error;

      fetchTickets();
    } catch (err) {
      console.error('Error marking ticket as resolved:', err);
      alert('Failed to update ticket. Please try again.');
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const openCount = tickets.filter(t => t.status === 'open').length;
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length;

  return (
    <div style={{ fontFamily: "'Inter',-apple-system,sans-serif" }}>
      {/* View Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ fontSize: 14, color: 'var(--label-4)' }}>
          Manage and respond to technical support requests from the team
        </div>

        <div style={{ display: 'flex', gap: 8, background: 'var(--bg-2)', padding: 4, borderRadius: 12, border: '1px solid var(--bg-4)' }}>
          <button
            onClick={() => setView('open')}
            style={{
              padding: '10px 24px',
              background: view === 'open' ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'transparent',
              color: view === 'open' ? '#fff' : 'var(--label-3)',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
          >
            Open Requests
            {openCount > 0 && (
              <span style={{ marginLeft: 8, background: '#FF3B30', color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>
                {openCount + inProgressCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setView('previous')}
            style={{
              padding: '10px 24px',
              background: view === 'previous' ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'transparent',
              color: view === 'previous' ? '#fff' : 'var(--label-3)',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
          >
            Previous
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <div style={{ background: '#FFF1F0', border: '1px solid #FFCDD2', borderRadius: 16, padding: '20px 24px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#FF3B30', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            Open
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#FF3B30', lineHeight: 1 }}>
            {openCount}
          </div>
        </div>
        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 16, padding: '20px 24px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#007AFF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            In Progress
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#007AFF', lineHeight: 1 }}>
            {inProgressCount}
          </div>
        </div>
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 16, padding: '20px 24px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#34C759', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            Resolved
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#34C759', lineHeight: 1 }}>
            {tickets.filter(t => t.status === 'resolved').length}
          </div>
        </div>
        <div style={{ background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: 16, padding: '20px 24px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            Closed
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#6B7280', lineHeight: 1 }}>
            {tickets.filter(t => t.status === 'closed').length}
          </div>
        </div>
      </div>

      {/* Tickets List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--label-4)', fontSize: 14 }}>
          Loading tickets…
        </div>
      ) : tickets.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 100,
            background: 'var(--bg-2)',
            borderRadius: 24,
            border: '1px solid var(--bg-4)',
          }}
        >
          <div style={{ fontSize: 80, opacity: 0.1, marginBottom: 20 }}>💻</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--label-3)', marginBottom: 10 }}>
            {view === 'open' ? 'No open requests' : 'No previous tickets'}
          </div>
          <div style={{ fontSize: 14, color: 'var(--label-4)' }}>
            {view === 'open' 
              ? 'All support requests have been addressed' 
              : 'No resolved or closed tickets yet'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {tickets.map((ticket) => {
            const status = STATUS_META[ticket.status];
            const priority = PRIORITY_OPTIONS.find((p) => p.value === ticket.priority);
            const category = CATEGORY_OPTIONS.find((c) => c.value === ticket.category);

            return (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--bg-4)',
                  borderRadius: 20,
                  overflow: 'hidden',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                }}
              >
                {/* Ticket Header */}
                <div
                  style={{
                    padding: '24px 28px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 20,
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onClick={async () => {
                    if (expandedTicket !== ticket.id) {
                      await fetchComments(ticket.id);
                    }
                    setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id);
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      background: priority.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                      border: `2px solid ${priority.color}33`,
                    }}
                  >
                    {category?.label.split(' ')[0]}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--label)', marginBottom: 6 }}>
                      {ticket.subject}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--label-4)', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600 }}>{ticket.requester_name}</span>
                      <span>·</span>
                      <span>{ticket.requester_role}</span>
                      <span>·</span>
                      <span>{formatDate(ticket.created_at)}</span>
                      <span>·</span>
                      <span>{category?.label}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '6px 14px',
                        borderRadius: 24,
                        background: priority.bg,
                        color: priority.color,
                        border: `1px solid ${priority.color}33`,
                      }}
                    >
                      {priority.label}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '6px 14px',
                        borderRadius: 24,
                        background: status.bg,
                        color: status.color,
                        border: `1px solid ${status.border}`,
                      }}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div style={{ fontSize: 20, color: 'var(--label-3)', transition: 'transform 0.2s' }}>
                    {expandedTicket === ticket.id ? '▼' : '▶'}
                  </div>
                </div>

                {/* Ticket Details */}
                <AnimatePresence>
                  {expandedTicket === ticket.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      style={{ borderTop: '1px solid var(--bg-4)' }}
                    >
                      <div style={{ padding: '28px' }}>
                        {/* Requester Info */}
                        <div style={{ display: 'flex', gap: 20, marginBottom: 24, padding: '16px 20px', background: 'var(--bg-3)', borderRadius: 12 }}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--label-4)', marginBottom: 4 }}>Requester</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--label)' }}>{ticket.requester_name}</div>
                            <div style={{ fontSize: 12, color: 'var(--label-4)' }}>{ticket.requester_email}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--label-4)', marginBottom: 4 }}>Role</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--label-2)' }}>
                              {ticket.requester_role.replace('_', ' ').toUpperCase()}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--label-4)', marginBottom: 4 }}>Ticket ID</div>
                            <div style={{ fontSize: 13, color: 'var(--label-3)', fontFamily: 'monospace' }}>
                              {ticket.id.slice(0, 8)}
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        <div style={{ marginBottom: 24 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--label-2)', marginBottom: 8 }}>
                            Issue Description
                          </div>
                          <div style={{ fontSize: 14, color: 'var(--label)', lineHeight: 1.7, padding: '16px 20px', background: 'var(--bg-3)', borderRadius: 12 }}>
                            {ticket.description}
                          </div>
                        </div>

                        {/* Attachment */}
                        {ticket.attachment_url && (
                          <div style={{ marginBottom: 24 }}>
                            <a
                              href={ticket.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '12px 20px',
                                background: 'var(--bg-3)',
                                border: '1px solid var(--bg-4)',
                                borderRadius: 12,
                                fontSize: 14,
                                color: '#007AFF',
                                textDecoration: 'none',
                                fontWeight: 600,
                              }}
                            >
                              📎 View Attachment
                            </a>
                          </div>
                        )}

                        {/* Comments Section */}
                        <div style={{ marginTop: 20 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--label-4)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                            Conversation
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16, maxHeight: 300, overflowY: 'auto' }}>
                            {comments[ticket.id]?.length > 0 ? (
                              comments[ticket.id].map((comment) => (
                                <div
                                  key={comment.id}
                                  style={{
                                    display: 'flex',
                                    gap: 12,
                                    alignItems: 'flex-start',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 36,
                                      height: 36,
                                      borderRadius: 10,
                                      background: comment.author_role === 'vishnu' || comment.author_role === 'admin_team' 
                                        ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' 
                                        : 'linear-gradient(135deg,#34C759,#28A745)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: 16,
                                      flexShrink: 0,
                                    }}
                                  >
                                    {comment.author_role === 'vishnu' || comment.author_role === 'admin_team' ? '🛠️' : '👤'}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--label)' }}>
                                        {comment.author_name}
                                      </span>
                                      <span style={{ fontSize: 11, color: 'var(--label-4)' }}>
                                        {formatDate(comment.created_at)}
                                      </span>
                                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: 'var(--bg-3)', color: 'var(--label-4)' }}>
                                        {comment.author_role}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--label-2)', lineHeight: 1.5, background: 'var(--bg-3)', padding: '10px 14px', borderRadius: 12 }}>
                                      {comment.comment}
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div style={{ fontSize: 13, color: 'var(--label-4)', textAlign: 'center', padding: 20 }}>
                                No comments yet. Start the conversation!
                              </div>
                            )}
                          </div>

                          {/* Add Comment Input */}
                          {(ticket.status === 'open' || ticket.status === 'in_progress') ? (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 16,
                                flexShrink: 0,
                              }}
                            >
                              🛠️
                            </div>
                            <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                              <input
                                type="text"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Type your response..."
                                onKeyPress={(e) => e.key === 'Enter' && addComment(ticket.id)}
                                style={{
                                  flex: 1,
                                  padding: '10px 14px',
                                  fontSize: 13,
                                  border: '1.5px solid var(--bg-4)',
                                  borderRadius: 12,
                                  background: 'var(--bg-3)',
                                  color: 'var(--label)',
                                  fontFamily: 'inherit',
                                  outline: 'none',
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                                onBlur={(e) => e.target.style.borderColor = 'var(--bg-4)'}
                              />
                              <button
                                onClick={() => addComment(ticket.id)}
                                disabled={submittingComment || !newComment.trim()}
                                style={{
                                  padding: '10px 16px',
                                  background: submittingComment || !newComment.trim() ? '#ccc' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 12,
                                  fontSize: 13,
                                  fontWeight: 700,
                                  cursor: submittingComment || !newComment.trim() ? 'not-allowed' : 'pointer',
                                  fontFamily: 'inherit',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {submittingComment ? '⏳' : 'Send'}
                              </button>
                            </div>
                          </div>
                          ) : (
                            <div style={{ fontSize: 13, color: 'var(--label-4)', textAlign: 'center', padding: 16, background: 'var(--bg-3)', borderRadius: 12 }}>
                              This ticket is {ticket.status === 'resolved' ? 'resolved' : 'closed'}. No new comments can be added.
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 20, borderTop: '1px solid var(--bg-4)' }}>
                          {ticket.status === 'open' || ticket.status === 'in_progress' ? (
                            <>
                              <button
                                onClick={() => handleMarkResolved(ticket.id)}
                                style={{
                                  padding: '10px 20px',
                                  background: '#F0FDF4',
                                  color: '#15803D',
                                  border: '1px solid #BBF7D0',
                                  borderRadius: 10,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  fontFamily: 'inherit',
                                }}
                              >
                                ✓ Mark as Resolved
                              </button>
                              <button
                                onClick={() => handleCloseTicket(ticket.id)}
                                style={{
                                  padding: '10px 20px',
                                  background: '#F3F4F6',
                                  color: '#6B7280',
                                  border: '1px solid #D1D5DB',
                                  borderRadius: 10,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  fontFamily: 'inherit',
                                }}
                              >
                                ✕ Close Ticket
                              </button>
                            </>
                          ) : (
                            <div style={{ fontSize: 13, color: 'var(--label-4)' }}>
                              {ticket.status === 'resolved' && `Resolved on ${formatDate(ticket.vishnu_responded_at)}`}
                              {ticket.status === 'closed' && `Closed on ${formatDate(ticket.closed_at)}`}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
