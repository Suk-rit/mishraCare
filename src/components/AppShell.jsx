/**
 * AppShell
 * Reusable collapsible hamburger sidebar layout for all dashboards.
 * Roles: admin (earthy red), store_manager (earthy green), devta (sky blue), vishnu (purple)
 *
 * Props:
 *   role        — 'admin' | 'store_manager' | 'devta' | 'vishnu'
 *   navItems    — [{ id, icon, label, badge?, alert? }]
 *   active      — current active nav id
 *   onNav       — (id) => void
 *   title       — brand title string
 *   userName    — display name
 *   onLogout    — () => void
 *   children    — page content
 *   headerRight — optional extra JSX in header (e.g. Add Admin button)
 *   notifications — optional number badge on top bar
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { exitFullscreen, stopFullscreenGuard } from '../utils/fullscreen';

// ── Role theme tokens ─────────────────────────────────────────────────────────
const THEMES = {
  admin: {
    accent:      '#8B5E3C',
    accentLight: '#F5EDE3',
    accentBorder:'rgba(139,94,60,0.25)',
    accentRing:  'rgba(139,94,60,0.15)',
    avatarBg:    'linear-gradient(135deg,#8B5E3C,#5C3D2E)',
    navBg:       'rgba(251,244,232,0.95)',
    sidebarBg:   '#FBF4E8',
    icon:        '🌿',
    roleLabel:   'Admin',
    rolePill:    { bg:'rgba(139,94,60,0.12)', color:'#5C3D2E', border:'rgba(139,94,60,0.2)' },
  },
  store_manager: {
    accent:      '#2E6B3E',
    accentLight: '#E8F5ED',
    accentBorder:'rgba(46,107,62,0.25)',
    accentRing:  'rgba(46,107,62,0.15)',
    avatarBg:    'linear-gradient(135deg,#2E6B3E,#1A4A28)',
    navBg:       'rgba(232,245,237,0.95)',
    sidebarBg:   '#F0FAF3',
    icon:        '🌱',
    roleLabel:   'Store Manager',
    rolePill:    { bg:'rgba(46,107,62,0.12)', color:'#1A4A28', border:'rgba(46,107,62,0.2)' },
  },
  devta: {
    accent:      '#0288D1',
    accentLight: '#E1F5FE',
    accentBorder:'rgba(2,136,209,0.25)',
    accentRing:  'rgba(2,136,209,0.15)',
    avatarBg:    'linear-gradient(135deg,#0288D1,#01579B)',
    navBg:       'rgba(225,245,254,0.95)',
    sidebarBg:   '#F0FAFF',
    icon:        '🌤️',
    roleLabel:   'Devta',
    rolePill:    { bg:'rgba(2,136,209,0.12)', color:'#01579B', border:'rgba(2,136,209,0.2)' },
  },
  vishnu: {
    accent:      '#7c3aed',
    accentLight: '#F5F3FF',
    accentBorder:'rgba(124,58,237,0.25)',
    accentRing:  'rgba(124,58,237,0.15)',
    avatarBg:    'linear-gradient(135deg,#7c3aed,#4f46e5)',
    navBg:       'rgba(245,243,255,0.95)',
    sidebarBg:   '#FAF8FF',
    icon:        '🕉️',
    roleLabel:   'Vishnu',
    rolePill:    { bg:'rgba(124,58,237,0.12)', color:'#4f46e5', border:'rgba(124,58,237,0.2)' },
  },
};

const SIDEBAR_W_OPEN   = 220;
const SIDEBAR_W_CLOSED = 0;

export default function AppShell({
  role = 'admin',
  navItems = [],
  active,
  onNav,
  title = 'MishraCare',
  userName = '',
  onLogout,
  children,
  headerRight,
}) {
  const theme = THEMES[role] || THEMES.admin;
  const [open, setOpen] = useState(false); // sidebar open/closed
  const initials = (userName || 'U').slice(0, 2).toUpperCase();

  // Close sidebar on outside click (mobile)
  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (!e.target.closest('[data-sidebar]') && !e.target.closest('[data-hamburger]')) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)',
      fontFamily:"'Inter',-apple-system,sans-serif", color:'var(--label)',
      display:'flex', flexDirection:'column' }}>

      {/* ── Top nav bar ── */}
      <header style={{ height:56, background: theme.navBg,
        backdropFilter:'blur(20px) saturate(180%)',
        WebkitBackdropFilter:'blur(20px) saturate(180%)',
        borderBottom:`1px solid ${theme.accentBorder}`,
        position:'sticky', top:0, zIndex:50,
        display:'flex', alignItems:'center',
        padding:'0 20px', gap:12,
        boxShadow:`0 1px 0 ${theme.accentBorder}` }}>

        {/* Hamburger */}
        <button data-hamburger
          onClick={() => setOpen(o => !o)}
          style={{ width:38, height:38, borderRadius:10, border:'none',
            background: open ? theme.accentLight : 'transparent',
            cursor:'pointer', display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center', gap:5,
            flexShrink:0, transition:'background 0.15s' }}
          aria-label="Toggle menu">
          {[0,1,2].map(i => (
            <motion.span key={i}
              animate={open ? {
                rotate:  i === 0 ? 45  : i === 2 ? -45 : 0,
                y:       i === 0 ? 9   : i === 2 ? -9  : 0,
                opacity: i === 1 ? 0   : 1,
                width:   i === 1 ? 0   : '22px',
              } : { rotate:0, y:0, opacity:1, width:'22px' }}
              transition={{ duration:0.22 }}
              style={{ display:'block', height:2.5, borderRadius:2,
                background: theme.accent, transformOrigin:'center' }}
            />
          ))}
        </button>

        {/* Brand */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
          <span style={{ fontSize:20 }}>{theme.icon}</span>
          <span style={{ fontWeight:800, fontSize:15, color:'var(--label)',
            letterSpacing:'-0.3px' }}>
            Mishra<span style={{ color:theme.accent }}>Care</span>
          </span>
          <span style={{ fontSize:10, fontWeight:700, padding:'2px 9px',
            borderRadius:20, textTransform:'uppercase', letterSpacing:'0.5px',
            background: theme.rolePill.bg, color: theme.rolePill.color,
            border:`1px solid ${theme.rolePill.border}` }}>
            {theme.roleLabel}
          </span>
        </div>

        {/* Header right */}
        {headerRight && <div style={{ display:'flex', gap:8, alignItems:'center' }}>{headerRight}</div>}

        {/* User + Logout */}
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <div style={{ width:32, height:32, borderRadius:'50%',
            background: theme.avatarBg,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:12, fontWeight:700, color:'#fff',
            boxShadow:`0 2px 8px ${theme.accentBorder}` }}>
            {initials}
          </div>
          <span style={{ fontSize:13, color:'var(--label-2)', fontWeight:500,
            display:'none' }} className="username-text">
            {userName}
          </span>
          <button onClick={() => { stopFullscreenGuard(); exitFullscreen().catch(()=>{}); onLogout(); }}
            style={{ background:'rgba(185,28,28,0.08)', border:'1px solid rgba(185,28,28,0.2)',
              color:'#B91C1C', padding:'6px 14px', borderRadius:8, fontSize:12,
              fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}
            onMouseEnter={e => { e.target.style.background='#FEE2E2'; }}
            onMouseLeave={e => { e.target.style.background='rgba(185,28,28,0.08)'; }}>
            Logout
          </button>
        </div>
      </header>

      {/* ── Body: sidebar + content ── */}
      <div style={{ flex:1, display:'flex', position:'relative', overflow:'hidden' }}>

        {/* Backdrop (mobile) */}
        <AnimatePresence>
          {open && (
            <motion.div
              key="backdrop"
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => setOpen(false)}
              style={{ position:'fixed', inset:0, zIndex:40,
                background:'rgba(0,0,0,0.3)', backdropFilter:'blur(2px)',
                top:56 }}
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <AnimatePresence>
          {open && (
            <motion.nav
              key="sidebar"
              data-sidebar
              initial={{ x: -SIDEBAR_W_OPEN, opacity:0 }}
              animate={{ x: 0, opacity:1 }}
              exit={{ x: -SIDEBAR_W_OPEN, opacity:0 }}
              transition={{ type:'spring', stiffness:320, damping:32 }}
              style={{ position:'fixed', top:56, left:0, bottom:0,
                width:SIDEBAR_W_OPEN, zIndex:45,
                background: theme.sidebarBg,
                borderRight:`1px solid ${theme.accentBorder}`,
                display:'flex', flexDirection:'column',
                padding:'12px 8px', overflowY:'auto',
                boxShadow:`4px 0 24px rgba(0,0,0,0.08)` }}>

              {/* Nav items */}
              <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                {navItems.map(item => {
                  const isActive = active === item.id;
                  return (
                    <button key={item.id}
                      onClick={() => { onNav(item.id); setOpen(false); }}
                      style={{ display:'flex', alignItems:'center', gap:11,
                        padding:'10px 13px', borderRadius:11, border:'none',
                        cursor:'pointer', fontFamily:'inherit',
                        background: isActive ? theme.accentLight : 'transparent',
                        color: isActive ? theme.accent : 'var(--label-3)',
                        fontSize:13.5, fontWeight: isActive ? 700 : 500,
                        transition:'all 0.15s', textAlign:'left',
                        borderLeft: isActive ? `3px solid ${theme.accent}` : '3px solid transparent' }}>
                      <span style={{ fontSize:18, flexShrink:0 }}>{item.icon}</span>
                      <span style={{ flex:1 }}>{item.label}</span>
                      {(item.badge > 0) && (
                        <span style={{ background:'#FF3B30', color:'#fff', borderRadius:20,
                          padding:'1px 7px', fontSize:10, fontWeight:700, flexShrink:0 }}>
                          {item.badge}
                        </span>
                      )}
                      {item.alert && !item.badge && (
                        <span style={{ width:7, height:7, borderRadius:'50%',
                          background:'#FF9500', flexShrink:0 }} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* User info at bottom */}
              <div style={{ marginTop:'auto', paddingTop:16,
                borderTop:`1px solid ${theme.accentBorder}`,
                padding:'12px 10px', marginTop:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                  <div style={{ width:34, height:34, borderRadius:'50%',
                    background: theme.avatarBg,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:12, fontWeight:700, color:'#fff', flexShrink:0 }}>
                    {initials}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--label)',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {userName}
                    </div>
                    <div style={{ fontSize:10, color:theme.accent, fontWeight:600,
                      textTransform:'uppercase', letterSpacing:'0.5px' }}>
                      {theme.roleLabel}
                    </div>
                  </div>
                </div>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>

        {/* Main content */}
        <main style={{ flex:1, overflowY:'auto', overflowX:'hidden' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
