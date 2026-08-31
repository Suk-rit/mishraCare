/**
 * DoctorSearchInput
 * Google-style live search across the universal doctors table.
 * Matches name, speciality, clinic_name.
 * Allows adding a new doctor inline.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';

// ── Relevance scoring ─────────────────────────────────────────────────────────
function score(doc, query) {
  if (!query.trim()) return 0;
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const fields = [
    doc.name?.toLowerCase()         || '',
    doc.speciality?.toLowerCase()   || '',
    doc.clinic_name?.toLowerCase()  || '',
  ];
  let s = 0;
  for (const w of words) {
    if (fields[0].startsWith(w))       s += 100;
    else if (fields[0].includes(w))    s += 60;
    else if (fields.some(f => f.includes(w))) s += 30;
    else return -1;
  }
  return s;
}

function Highlight({ text, query }) {
  if (!query.trim() || !text) return <span>{text}</span>;
  const words = query.split(/\s+/).filter(Boolean).sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(pattern);
  return (
    <span>
      {parts.map((p, i) =>
        pattern.test(p)
          ? <mark key={i} style={{ background: '#FEF08A', color: '#713F12', borderRadius: 3, padding: '0 1px', fontWeight: 700 }}>{p}</mark>
          : p
      )}
    </span>
  );
}

// ── Add Doctor inline mini-form ───────────────────────────────────────────────
function AddDoctorForm({ query, onAdded, onCancel }) {
  const [form, setForm] = useState({
    name:        query || '',
    speciality:  '',
    clinic_name: '',
    phone:       '',
    city:        '',
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setErr('Name is required'); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from('doctors')
      .insert({ ...form, name: form.name.trim(), is_active: true })
      .select()
      .single();
    if (error) { setErr(error.message); setSaving(false); return; }
    onAdded(data);
  };

  const inp = (k, ph, type = 'text') => (
    <input type={type} placeholder={ph} value={form[k]}
      onChange={e => set(k, e.target.value)}
      style={{ width: '100%', padding: '8px 10px', fontSize: 12,
        border: '1.5px solid var(--bg-4)', borderRadius: 8,
        background: 'var(--bg-2)', color: 'var(--label)', fontFamily: 'inherit',
        outline: 'none', boxSizing: 'border-box' }}
      onFocus={e => e.target.style.borderColor = '#0288D1'}
      onBlur={e => e.target.style.borderColor = 'var(--bg-4)'} />
  );

  return (
    <div style={{ padding: '14px 16px', background: '#F5FBFF',
      borderTop: '1px solid #B3E5FC' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#0288D1',
        textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>
        + Add New Doctor
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--label-3)', marginBottom: 3 }}>Name *</div>
          {inp('name', 'Dr. Ramesh Kumar')}
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--label-3)', marginBottom: 3 }}>Speciality</div>
          {inp('speciality', 'General Physician')}
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--label-3)', marginBottom: 3 }}>Clinic Name</div>
          {inp('clinic_name', 'City Clinic')}
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--label-3)', marginBottom: 3 }}>Phone</div>
          {inp('phone', '+91 98765 43210')}
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ fontSize: 11, color: 'var(--label-3)', marginBottom: 3 }}>City</div>
          {inp('city', 'Lucknow')}
        </div>
      </div>
      {err && <div style={{ fontSize: 11, color: '#B91C1C', marginBottom: 6 }}>⚠️ {err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel}
          style={{ flex: 1, padding: '7px', background: 'var(--bg-3)',
            border: '1px solid var(--bg-4)', borderRadius: 8, fontSize: 12,
            fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            color: 'var(--label-3)' }}>
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          style={{ flex: 2, padding: '7px',
            background: 'linear-gradient(135deg,#0288D1,#01579B)',
            border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', color: '#fff' }}>
          {saving ? '⏳ Saving…' : '✓ Add Doctor'}
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DoctorSearchInput({ value, onChange, placeholder = 'Search referring doctor…' }) {
  // value = doctor object | null
  const [allDoctors,  setAllDoctors]  = useState([]);
  const [query,       setQuery]       = useState('');
  const [open,        setOpen]        = useState(false);
  const [cursor,      setCursor]      = useState(-1);
  const [debouncedQ,  setDebouncedQ]  = useState('');
  const [showAdd,     setShowAdd]     = useState(false);

  const inputRef     = useRef(null);
  const containerRef = useRef(null);
  const debounceRef  = useRef(null);

  // Load all doctors once
  useEffect(() => {
    supabase.from('doctors').select('*').eq('is_active', true).order('name')
      .then(({ data }) => setAllDoctors(data || []));
  }, []);

  // Debounce
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQ(query), 150);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Outside click
  useEffect(() => {
    const h = e => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false); setCursor(-1); setShowAdd(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const results = useMemo(() => {
    if (!debouncedQ.trim()) return [];
    return allDoctors
      .map(d => ({ d, s: score(d, debouncedQ) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 7)
      .map(x => x.d);
  }, [allDoctors, debouncedQ]);

  const showDropdown = open && (query.trim().length > 0 || showAdd);

  const handleSelect = (doc) => {
    onChange(doc);
    setQuery(doc.name);
    setOpen(false); setCursor(-1); setShowAdd(false);
  };

  const handleClear = () => {
    onChange(null); setQuery(''); inputRef.current?.focus();
  };

  const handleDoctorAdded = (doc) => {
    setAllDoctors(prev => [...prev, doc]);
    handleSelect(doc);
  };

  const handleKey = (e) => {
    if (!showDropdown) return;
    const total = results.length + 1; // +1 for add-new row
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, total - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, -1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (cursor >= 0 && cursor < results.length) handleSelect(results[cursor]);
      else if (cursor === results.length) setShowAdd(true);
    } else if (e.key === 'Escape') { setOpen(false); setCursor(-1); }
  };

  // If a doctor is already selected, show a chip
  if (value) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 14px', background: '#E1F5FE', border: '1.5px solid #0288D1',
          borderRadius: 12 }}>
          <span style={{ fontSize: 18 }}>🩺</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#01579B' }}>{value.name}</div>
            <div style={{ fontSize: 11, color: '#4FC3F7' }}>
              {[value.speciality, value.clinic_name, value.city].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button onClick={handleClear}
            style={{ background: 'rgba(2,136,209,0.15)', border: 'none', borderRadius: '50%',
              width: 22, height: 22, cursor: 'pointer', color: '#0288D1', fontSize: 13,
              fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%',
          transform: 'translateY(-50%)', fontSize: 15, pointerEvents: 'none' }}>🩺</span>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setCursor(-1); setShowAdd(false); }}
          onFocus={() => { if (query.trim()) setOpen(true); }}
          onKeyDown={handleKey}
          placeholder={placeholder}
          autoComplete="off"
          style={{ width: '100%', padding: '11px 40px 11px 38px', fontSize: 14,
            border: `2px solid ${open ? '#0288D1' : 'var(--bg-4)'}`,
            borderRadius: showDropdown ? '12px 12px 0 0' : 12,
            background: 'var(--bg-2)', color: 'var(--label)', fontFamily: 'inherit',
            outline: 'none', transition: 'border-color 0.15s, border-radius 0.1s',
            boxSizing: 'border-box',
            boxShadow: open ? '0 0 0 3px rgba(2,136,209,0.15)' : 'none' }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false); }}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'var(--bg-4)', border: 'none', borderRadius: '50%',
              width: 20, height: 20, cursor: 'pointer', color: 'var(--label-3)',
              fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center',
              justifyContent: 'center' }}>
            ✕
          </button>
        )}
      </div>

      <AnimatePresence>
        {showDropdown && (
          <motion.div key="dd"
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.1 }}
            style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
              background: 'var(--bg-2)', border: '2px solid #0288D1', borderTop: '1px solid #B3E5FC',
              borderRadius: '0 0 12px 12px', boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
              maxHeight: showAdd ? 'none' : 380, overflowY: showAdd ? 'visible' : 'auto' }}>

            {results.length > 0 && (
              <div style={{ padding: '5px 14px', fontSize: 10, fontWeight: 700,
                color: 'var(--label-4)', textTransform: 'uppercase', letterSpacing: '0.6px',
                background: 'var(--bg-3)', borderBottom: '1px solid var(--bg-4)' }}>
                {results.length} match{results.length !== 1 ? 'es' : ''}
              </div>
            )}

            {results.map((doc, idx) => (
              <button key={doc.id} data-result-item
                onClick={() => handleSelect(doc)}
                onMouseEnter={() => setCursor(idx)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 14px', border: 'none',
                  borderBottom: '1px solid var(--bg-4)',
                  background: cursor === idx ? '#E1F5FE' : 'transparent',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  transition: 'background 0.1s' }}>
                <div style={{ width: 34, height: 34, borderRadius: 9,
                  background: '#EFF6FF', border: '1px solid #BFDBFE',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 17, flexShrink: 0 }}>🩺</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700,
                    color: cursor === idx ? '#0288D1' : 'var(--label)', marginBottom: 2 }}>
                    <Highlight text={doc.name} query={debouncedQ} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--label-4)' }}>
                    {doc.speciality && <><Highlight text={doc.speciality} query={debouncedQ} /> · </>}
                    {doc.clinic_name && <><Highlight text={doc.clinic_name} query={debouncedQ} /></>}
                    {doc.city && <> · {doc.city}</>}
                  </div>
                </div>
                <span style={{ fontSize: 13, color: cursor === idx ? '#0288D1' : 'var(--label-4)' }}>→</span>
              </button>
            ))}

            {/* Add new row */}
            {!showAdd ? (
              <button data-result-item
                onClick={() => setShowAdd(true)}
                onMouseEnter={() => setCursor(results.length)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px', border: 'none',
                  background: cursor === results.length ? '#FFF8E1' : 'var(--bg-3)',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  borderRadius: '0 0 10px 10px', transition: 'background 0.1s' }}>
                <div style={{ width: 34, height: 34, borderRadius: 9,
                  background: 'linear-gradient(135deg,#FF9500,#FF6F00)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 17, color: '#fff', flexShrink: 0 }}>+</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700,
                    color: cursor === results.length ? '#E65100' : 'var(--label-2)', marginBottom: 2 }}>
                    {results.length === 0 && query.trim()
                      ? `"${query}" not found — Add as new doctor`
                      : '+ Add a new doctor'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--label-4)' }}>
                    Enter name, speciality, clinic and contact
                  </div>
                </div>
              </button>
            ) : (
              <AddDoctorForm
                query={query}
                onAdded={handleDoctorAdded}
                onCancel={() => setShowAdd(false)}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!query.trim() && (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--label-4)' }}>
          Optional · Search by doctor name, speciality, or clinic
          {allDoctors.length > 0 && (
            <span style={{ marginLeft: 6, background: 'var(--bg-4)', color: 'var(--label-3)',
              borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 600 }}>
              {allDoctors.length} doctors
            </span>
          )}
        </div>
      )}
    </div>
  );
}
