import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import { getSession } from '../utils/session';
import { uploadFile } from '../utils/storage';

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

export default function ITSupport({ userRole, userId, userName, userEmail }) {
  const [showForm, setShowForm] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedTicket, setExpandedTicket] = useState(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    subject: '',
    description: '',
    priority: 'medium',
    category: 'other',
    attachment: null,
  });

  useEffect(() => {
    if (userId) {
      fetchTickets();
    }
  }, [userId]);

  const fetchTickets = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { data } = await supabase
        .from('it_support_requests')
        .select('*')
        .eq('requester_id', userId)
        .order('created_at', { ascending: false });
      setTickets(data || []);
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      setForm({ ...form, attachment: file });
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.description.trim()) {
      setError('Subject and description are required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      let attachmentUrl = null;
      if (form.attachment) {
        // Skip attachment upload for now - storage bucket setup needed
        // attachmentUrl = await uploadFile('documents', form.attachment, 'it-support');
      }

      const { error } = await supabase.from('it_support_requests').insert({
        requester_id: userId,
        requester_role: userRole,
        requester_name: userName,
        requester_email: userEmail,
        subject: form.subject.trim(),
        description: form.description.trim(),
        priority: form.priority,
        category: form.category,
        attachment_url: attachmentUrl,
        status: 'open',
      });

      if (error) throw error;

      setShowForm(false);
      setForm({ subject: '', description: '', priority: 'medium', category: 'other', attachment: null });
      fetchTickets();
    } catch (err) {
      setError(err.message || 'Failed to submit ticket');
    } finally {
      setSubmitting(false);
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

  return (
    <div style={{ fontFamily: "'Inter',-apple-system,sans-serif", maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--label)', letterSpacing: '-0.4px', marginBottom: 4 }}>
            💻 IT Support
          </div>
          <div style={{ fontSize: 14, color: 'var(--label-4)' }}>
            Raise technical issues, track requests, and get help from the IT team
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
          }}
        >
          + New Ticket
        </button>
      </div>

      {/* New Ticket Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
            onClick={(e) => e.target === e.currentTarget && setShowForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              style={{
                background: 'var(--bg-2)',
                border: '1px solid var(--bg-4)',
                borderRadius: 20,
                width: '100%',
                maxWidth: 600,
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              }}
            >
              <div style={{ padding: '28px 32px', borderBottom: '1px solid var(--bg-4)' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--label)', marginBottom: 2 }}>
                  🎫 New Support Ticket
                </div>
                <div style={{ fontSize: 13, color: 'var(--label-4)' }}>
                  Describe your issue in detail for faster resolution
                </div>
              </div>

              <form onSubmit={handleSubmit} style={{ padding: '28px 32px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Subject */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', marginBottom: 6, display: 'block' }}>
                      Subject *
                    </label>
                    <input
                      type="text"
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      placeholder="Brief summary of the issue..."
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: 14,
                        border: '1.5px solid var(--bg-4)',
                        borderRadius: 10,
                        background: 'var(--bg-3)',
                        color: 'var(--label)',
                        fontFamily: 'inherit',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--bg-4)'}
                    />
                  </div>

                  {/* Category & Priority */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', marginBottom: 6, display: 'block' }}>
                        Category
                      </label>
                      <select
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          fontSize: 14,
                          border: '1.5px solid var(--bg-4)',
                          borderRadius: 10,
                          background: 'var(--bg-3)',
                          color: 'var(--label)',
                          fontFamily: 'inherit',
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {CATEGORY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', marginBottom: 6, display: 'block' }}>
                        Priority
                      </label>
                      <select
                        value={form.priority}
                        onChange={(e) => setForm({ ...form, priority: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          fontSize: 14,
                          border: '1.5px solid var(--bg-4)',
                          borderRadius: 10,
                          background: 'var(--bg-3)',
                          color: 'var(--label)',
                          fontFamily: 'inherit',
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {PRIORITY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', marginBottom: 6, display: 'block' }}>
                      Description *
                    </label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Describe the issue in detail. Include steps to reproduce, error messages, screenshots if applicable..."
                      rows={6}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: 14,
                        border: '1.5px solid var(--bg-4)',
                        borderRadius: 10,
                        background: 'var(--bg-3)',
                        color: 'var(--label)',
                        fontFamily: 'inherit',
                        outline: 'none',
                        resize: 'vertical',
                        transition: 'border-color 0.2s',
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--bg-4)'}
                    />
                  </div>

                  {/* Attachment */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--label-2)', marginBottom: 6, display: 'block' }}>
                      Attachment (optional)
                    </label>
                    <div
                      style={{
                        border: '2px dashed var(--bg-4)',
                        borderRadius: 10,
                        padding: '20px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: form.attachment ? 'var(--bg-3)' : 'transparent',
                        transition: 'all 0.2s',
                      }}
                      onClick={() => document.getElementById('file-input').click()}
                    >
                      <input
                        id="file-input"
                        type="file"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                        accept="image/*,.pdf,.doc,.docx"
                      />
                      {form.attachment ? (
                        <div>
                          <div style={{ fontSize: 24, marginBottom: 8 }}>📎</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--label)' }}>
                            {form.attachment.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--label-4)' }}>
                            {(form.attachment.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 24, marginBottom: 8 }}>📁</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--label-3)' }}>
                            Click to upload
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--label-4)' }}>
                            Images, PDF, DOC (max 5MB)
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {error && (
                    <div style={{ fontSize: 13, color: '#FF3B30', background: '#FFF1F0', padding: '10px 14px', borderRadius: 8 }}>
                      {error}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      style={{
                        padding: '10px 20px',
                        background: 'var(--bg-3)',
                        color: 'var(--label-2)',
                        border: '1px solid var(--bg-4)',
                        borderRadius: 10,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      style={{
                        padding: '10px 24px',
                        background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit',
                        opacity: submitting ? 0.7 : 1,
                      }}
                    >
                      {submitting ? '⏳ Submitting...' : '🚀 Submit Ticket'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tickets List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--label-4)', fontSize: 14 }}>
          Loading tickets…
        </div>
      ) : tickets.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 80,
            background: 'var(--bg-2)',
            borderRadius: 20,
            border: '1px solid var(--bg-4)',
          }}
        >
          <div style={{ fontSize: 64, opacity: 0.15, marginBottom: 16 }}>💻</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--label-3)', marginBottom: 8 }}>
            No support tickets yet
          </div>
          <div style={{ fontSize: 14, color: 'var(--label-4)', marginBottom: 24 }}>
            Create your first ticket to get help from the IT team
          </div>
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + Create First Ticket
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tickets.map((ticket) => {
            const status = STATUS_META[ticket.status];
            const priority = PRIORITY_OPTIONS.find((p) => p.value === ticket.priority);
            const category = CATEGORY_OPTIONS.find((c) => c.value === ticket.category);

            return (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--bg-4)',
                  borderRadius: 16,
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Ticket Header */}
                <div
                  style={{
                    padding: '18px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onClick={() => setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id)}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: priority.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                    }}
                  >
                    {category?.label.split(' ')[0]}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)', marginBottom: 4 }}>
                      {ticket.subject}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--label-4)', display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span>{formatDate(ticket.created_at)}</span>
                      <span>·</span>
                      <span>{category?.label}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 20,
                        background: priority.bg,
                        color: priority.color,
                        border: `1px solid ${priority.color}33`,
                      }}
                    >
                      {priority.label}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 20,
                        background: status.bg,
                        color: status.color,
                        border: `1px solid ${status.border}`,
                      }}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div style={{ fontSize: 16, color: 'var(--label-3)', transition: 'transform 0.2s' }}>
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
                      <div style={{ padding: '20px' }}>
                        <div style={{ fontSize: 13, color: 'var(--label-2)', lineHeight: 1.6, marginBottom: 16 }}>
                          {ticket.description}
                        </div>

                        {ticket.attachment_url && (
                          <div style={{ marginBottom: 16 }}>
                            <a
                              href={ticket.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '8px 16px',
                                background: 'var(--bg-3)',
                                border: '1px solid var(--bg-4)',
                                borderRadius: 8,
                                fontSize: 13,
                                color: '#007AFF',
                                textDecoration: 'none',
                                fontWeight: 600,
                              }}
                            >
                              📎 View Attachment
                            </a>
                          </div>
                        )}

                        {ticket.vishnu_response && (
                          <div
                            style={{
                              background: '#F0FDF4',
                              border: '1px solid #BBF7D0',
                              borderRadius: 12,
                              padding: '16px',
                              marginBottom: 16,
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#15803D', marginBottom: 8 }}>
                              🛠️ IT Team Response
                            </div>
                            <div style={{ fontSize: 13, color: '#166534', lineHeight: 1.6 }}>
                              {ticket.vishnu_response}
                            </div>
                            {ticket.vishnu_responded_at && (
                              <div style={{ fontSize: 11, color: '#15803D', marginTop: 8 }}>
                                Responded on {formatDate(ticket.vishnu_responded_at)}
                              </div>
                            )}
                          </div>
                        )}

                        <div style={{ fontSize: 11, color: 'var(--label-4)' }}>
                          Ticket ID: {ticket.id.slice(0, 8)}
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
