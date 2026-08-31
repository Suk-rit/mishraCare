/**
 * MedicineSearchInput
 *
 * Universal medicine search with Google-style live dropdown.
 *
 * Behaviour:
 *  - Fetches ALL medicines once on mount (universal catalog, not admin-scoped).
 *  - Debounced client-side filtering (150 ms) — instant feel, no extra DB round-trips.
 *  - Matches against name, generic_name, brand, manufacturer — any word prefix.
 *  - Top 8 results ranked by relevance (name prefix > any field prefix > substring).
 *  - "Not found" → prompts admin to add a new medicine.
 *  - Keyboard navigable (↑ ↓ Enter Escape).
 *  - Closes on outside click.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';

// ── Constants ──────────────────────────────────────────────────────────────────
const TYPE_ICONS = {
  Tablet:'💊', Capsule:'💊', Syrup:'🧴', Injection:'💉', Drops:'💧',
  Cream:'🧴',  Ointment:'🧴', Powder:'🧂', Inhaler:'🌬️', Patch:'🩹',
  Suppository:'💊', Lozenges:'🍬', Other:'📦',
};
const TYPE_COLORS = {
  Tablet:     { bg:'#EFF6FF', color:'#1D4ED8' },
  Capsule:    { bg:'#F0FDF4', color:'#15803D' },
  Syrup:      { bg:'#FEF3C7', color:'#92400E' },
  Injection:  { bg:'#FEE2E2', color:'#B91C1C' },
  Drops:      { bg:'#E0F2FE', color:'#0369A1' },
  Cream:      { bg:'#FAF0FF', color:'#6B21A8' },
  Ointment:   { bg:'#FFF7ED', color:'#9A3412' },
  Powder:     { bg:'#F8FAFC', color:'#475569' },
  Inhaler:    { bg:'#ECFDF5', color:'#065F46' },
  Patch:      { bg:'#FFF1F0', color:'#991B1B' },
  Suppository:{ bg:'#FEF3C7', color:'#78350F' },
  Lozenges:   { bg:'#FDF2F8', color:'#831843' },
  Other:      { bg:'#F1F5F9', color:'#334155' },
};

// ── Relevance scoring ──────────────────────────────────────────────────────────
// Higher score = shown first. Checks each word in the query individually.
function scoreMatch(medicine, query) {
  if (!query.trim()) return 0;
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const fields = [
    medicine.name?.toLowerCase()         || '',
    medicine.generic_name?.toLowerCase() || '',
    medicine.brand?.toLowerCase()        || '',
    medicine.manufacturer?.toLowerCase() || '',
  ];

  let score = 0;
  for (const word of words) {
    // name starts with word → highest value
    if (fields[0].startsWith(word))         score += 100;
    // name contains word                    → high
    else if (fields[0].includes(word))      score += 60;
    // generic / brand starts with word
    else if (fields[1].startsWith(word) || fields[2].startsWith(word)) score += 40;
    // any field contains word
    else if (fields.some(f => f.includes(word)))                        score += 20;
    // no match for this word at all         → disqualify
    else return -1;
  }
  return score;
}

// ── Highlight matched text ──────────────────────────────────────────────────
function Highlight({ text, query }) {
  if (!query.trim() || !text) return <span>{text}</span>;
  const words = query.split(/\s+/).filter(Boolean).sort((a, b) => b.length - a.length);
  // Build one big alternation regex
  const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(pattern);
  return (
    <span>
      {parts.map((part, i) =>
        pattern.test(part)
          ? <mark key={i} style={{ background:'#FEF08A', color:'#713F12',
              borderRadius:3, padding:'0 1px', fontWeight:700 }}>{part}</mark>
          : part
      )}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function MedicineSearchInput({ onSelect, onAddNew }) {
  const [allMedicines, setAllMedicines] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  const [query,     setQuery]     = useState('');
  const [open,      setOpen]      = useState(false);
  const [cursor,    setCursor]    = useState(-1);   // keyboard nav index
  const [debouncedQ, setDebouncedQ] = useState('');

  const inputRef    = useRef(null);
  const listRef     = useRef(null);
  const containerRef = useRef(null);
  const debounceRef  = useRef(null);

  // ── Load full universal catalog once ──────────────────────────────────────
  useEffect(() => {
    supabase
      .from('medicines')
      .select('id, name, generic_name, brand, manufacturer, type, strength, pack_size, pack_unit, is_active')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        setAllMedicines(data || []);
        setLoadingCatalog(false);
      });
  }, []);

  // ── Debounce query → debouncedQ ───────────────────────────────────────────
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQ(query), 150);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // ── Filtered + ranked results ─────────────────────────────────────────────
  const results = useMemo(() => {
    const q = debouncedQ.trim();
    if (!q) return [];
    return allMedicines
      .map(m => ({ m, score: scoreMatch(m, q) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(({ m }) => m);
  }, [allMedicines, debouncedQ]);

  const showDropdown = open && query.trim().length > 0;

  // ── Outside-click close ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setCursor(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Scroll active item into view ──────────────────────────────────────────
  useEffect(() => {
    if (cursor >= 0 && listRef.current) {
      const item = listRef.current.querySelectorAll('[data-result-item]')[cursor];
      item?.scrollIntoView({ block:'nearest' });
    }
  }, [cursor]);

  // ── Keyboard handler ───────────────────────────────────────────────────────
  const handleKey = useCallback((e) => {
    if (!showDropdown) return;
    const total = results.length + 1; // +1 for "Add new" row
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setCursor(c => Math.min(c + 1, total - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setCursor(c => Math.max(c - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (cursor >= 0 && cursor < results.length) {
        handleSelect(results[cursor]);
      } else if (cursor === results.length) {
        handleAddNew();
      }
    } else if (e.key === 'Escape') {
      setOpen(false); setCursor(-1);
    }
  }, [showDropdown, cursor, results]);

  // ── Select handlers ────────────────────────────────────────────────────────
  const handleSelect = (med) => {
    setQuery('');
    setOpen(false);
    setCursor(-1);
    onSelect(med);
  };

  const handleAddNew = () => {
    setOpen(false);
    setCursor(-1);
    onAddNew();
  };

  return (
    <div ref={containerRef} style={{ position:'relative', width:'100%' }}>
      {/* ── Input ── */}
      <div style={{ position:'relative' }}>
        <div style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)',
          fontSize:18, pointerEvents:'none', zIndex:1 }}>
          🔍
        </div>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setCursor(-1); }}
          onFocus={() => { if (query.trim()) setOpen(true); }}
          onKeyDown={handleKey}
          placeholder="Search medicine by name, salt, brand or company…"
          autoComplete="off"
          style={{ width:'100%', padding:'14px 48px 14px 48px',
            border:`2px solid ${open ? 'var(--accent)' : 'var(--bg-4)'}`,
            borderRadius: open && showDropdown ? '14px 14px 0 0' : 14,
            fontSize:15, fontFamily:"'Inter',-apple-system,sans-serif",
            color:'var(--label)', background:'var(--bg-2)',
            outline:'none', transition:'border-color 0.18s, border-radius 0.15s',
            boxShadow: open ? '0 0 0 3px var(--accent-ring)' : 'none',
            boxSizing:'border-box' }}
        />
        {/* Clear button */}
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false); inputRef.current?.focus(); }}
            style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)',
              background:'var(--bg-4)', border:'none', borderRadius:'50%',
              width:22, height:22, cursor:'pointer', color:'var(--label-3)',
              fontSize:12, display:'flex', alignItems:'center', justifyContent:'center',
              fontWeight:700 }}>
            ✕
          </button>
        )}
        {/* Loading spinner */}
        {loadingCatalog && (
          <div style={{ position:'absolute', right:42, top:'50%', transform:'translateY(-50%)',
            fontSize:13, color:'var(--label-4)' }}>
            ⏳
          </div>
        )}
      </div>

      {/* ── Dropdown ── */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            key="dropdown"
            ref={listRef}
            initial={{ opacity:0, y:-4 }}
            animate={{ opacity:1, y:0 }}
            exit={{ opacity:0, y:-4 }}
            transition={{ duration:0.12 }}
            style={{ position:'absolute', top:'100%', left:0, right:0,
              background:'var(--bg-2)', border:'2px solid var(--accent)',
              borderTop:'1px solid var(--bg-4)', borderRadius:'0 0 14px 14px',
              boxShadow:'0 12px 32px rgba(0,0,0,0.12)', zIndex:999,
              maxHeight:420, overflowY:'auto' }}>

            {/* Result count hint */}
            {results.length > 0 && (
              <div style={{ padding:'6px 16px', fontSize:11, color:'var(--label-4)',
                fontWeight:600, borderBottom:'1px solid var(--bg-4)',
                textTransform:'uppercase', letterSpacing:'0.6px',
                background:'var(--bg-3)' }}>
                {results.length} match{results.length !== 1 ? 'es' : ''}
              </div>
            )}

            {/* Medicine rows */}
            {results.map((med, idx) => {
              const tc       = TYPE_COLORS[med.type] || TYPE_COLORS.Other;
              const isActive = cursor === idx;
              return (
                <button
                  key={med.id}
                  data-result-item
                  onClick={() => handleSelect(med)}
                  onMouseEnter={() => setCursor(idx)}
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:12,
                    padding:'12px 16px', border:'none', borderBottom:'1px solid var(--bg-4)',
                    background: isActive ? 'var(--accent-bg)' : 'transparent',
                    cursor:'pointer', textAlign:'left', fontFamily:'inherit',
                    transition:'background 0.1s' }}>
                  {/* Icon */}
                  <div style={{ width:38, height:38, borderRadius:10, background:tc.bg,
                    border:`1px solid ${tc.color}22`, display:'flex', alignItems:'center',
                    justifyContent:'center', fontSize:18, flexShrink:0 }}>
                    {TYPE_ICONS[med.type] || '📦'}
                  </div>
                  {/* Text */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:600, color: isActive ? 'var(--accent)' : 'var(--label)',
                      marginBottom:2, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                      <Highlight text={med.name} query={debouncedQ} />
                      {med.strength && (
                        <span style={{ fontSize:12, fontWeight:400, color:'var(--label-4)' }}>
                          · <Highlight text={med.strength} query={debouncedQ} />
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize:12, color:'var(--label-4)', display:'flex', gap:10, flexWrap:'wrap' }}>
                      {med.generic_name && <Highlight text={med.generic_name} query={debouncedQ} />}
                      {med.generic_name && med.manufacturer && <span>·</span>}
                      {med.manufacturer && <Highlight text={med.manufacturer} query={debouncedQ} />}
                      <span>· {med.pack_size} {med.pack_unit}/pack</span>
                    </div>
                  </div>
                  {/* Type badge */}
                  <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20,
                    background:tc.bg, color:tc.color, flexShrink:0, whiteSpace:'nowrap' }}>
                    {med.type}
                  </span>
                  {/* Arrow hint */}
                  <span style={{ fontSize:14, color: isActive ? 'var(--accent)' : 'var(--label-4)',
                    flexShrink:0 }}>→</span>
                </button>
              );
            })}

            {/* "Add new medicine" row — always last */}
            <button
              data-result-item
              onClick={handleAddNew}
              onMouseEnter={() => setCursor(results.length)}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:12,
                padding:'13px 16px', border:'none',
                background: cursor === results.length ? '#FFF1F0' : 'var(--bg-3)',
                cursor:'pointer', textAlign:'left', fontFamily:'inherit',
                borderRadius:'0 0 12px 12px', transition:'background 0.1s' }}>
              <div style={{ width:38, height:38, borderRadius:10,
                background:'linear-gradient(145deg,#FF3B30,#D93025)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:18, flexShrink:0, boxShadow:'0 2px 8px rgba(255,59,48,0.25)' }}>
                +
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600,
                  color: cursor === results.length ? 'var(--accent)' : 'var(--label-2)',
                  marginBottom:2 }}>
                  {results.length === 0
                    ? `"${debouncedQ}" not found — Add as new medicine`
                    : '+ Add a new medicine to the catalog'}
                </div>
                <div style={{ fontSize:12, color:'var(--label-4)' }}>
                  You'll be asked to enter company name, type, pack size and other details
                </div>
              </div>
            </button>

          </motion.div>
        )}
      </AnimatePresence>

      {/* ── No-query hint ── */}
      {!query.trim() && (
        <div style={{ marginTop:8, fontSize:12, color:'var(--label-4)',
          display:'flex', alignItems:'center', gap:6 }}>
          <span>Start typing to search from the universal catalog</span>
          {!loadingCatalog && allMedicines.length > 0 && (
            <span style={{ background:'var(--bg-4)', color:'var(--label-3)',
              borderRadius:20, padding:'1px 8px', fontSize:11, fontWeight:600 }}>
              {allMedicines.length} medicines available
            </span>
          )}
        </div>
      )}
    </div>
  );
}
