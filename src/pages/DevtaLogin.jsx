import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { saveSession } from '../utils/session';
import { enterFullscreen, startFullscreenGuard } from '../utils/fullscreen';

// ─────────────────────────────────────────────────────────────
// Sky canvas — clouds drifting, birds flying
// ─────────────────────────────────────────────────────────────
function SkyCanvas() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // ── Clouds ──────────────────────────────────────────────
    const makeClouds = () => Array.from({ length: 14 }, (_, i) => ({
      x:     Math.random() * canvas.width,
      y:     30 + Math.random() * canvas.height * 0.55,
      w:     80 + Math.random() * 160,
      h:     30 + Math.random() * 50,
      speed: 0.15 + Math.random() * 0.25,
      alpha: 0.55 + Math.random() * 0.35,
      layer: i < 5 ? 0 : i < 10 ? 1 : 2, // 0=far,1=mid,2=near
    }));
    let clouds = makeClouds();

    function drawCloud(c) {
      ctx.save();
      ctx.globalAlpha = c.alpha;
      const g = ctx.createRadialGradient(
        c.x, c.y, 0,
        c.x, c.y, c.w * 0.7
      );
      g.addColorStop(0,   'rgba(255,255,255,0.95)');
      g.addColorStop(0.4, 'rgba(240,248,255,0.85)');
      g.addColorStop(1,   'rgba(200,230,255,0)');
      ctx.fillStyle = g;

      ctx.beginPath();
      ctx.ellipse(c.x,            c.y,       c.w * 0.5, c.h * 0.5,  0, 0, Math.PI * 2);
      ctx.ellipse(c.x - c.w*0.25, c.y + c.h*0.1, c.w*0.35, c.h*0.42, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + c.w*0.28, c.y + c.h*0.08,c.w*0.3,  c.h*0.4,  0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Birds (simple V-wing silhouettes) ──────────────────
    const makeBird = () => {
      const y = 60 + Math.random() * canvas.height * 0.4;
      return {
        x:      -60,
        y,
        speed:  1.2 + Math.random() * 1.8,
        scale:  0.5 + Math.random() * 0.8,
        flap:   Math.random() * Math.PI * 2,
        flapSpd:0.06 + Math.random() * 0.05,
        dy:     (Math.random() - 0.5) * 0.18, // gentle vertical drift
      };
    };

    let birds = Array.from({ length: 18 }, () => {
      const b = makeBird();
      b.x = Math.random() * canvas.width; // spread initial positions
      return b;
    });

    function drawBird(b) {
      const wing = Math.sin(b.flap) * 10 * b.scale;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(b.scale, b.scale);
      ctx.strokeStyle = 'rgba(30,50,80,0.75)';
      ctx.lineWidth   = 1.6;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      // left wing
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-14, -wing, -26, -wing * 0.4);
      // right wing
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo( 14, -wing,  26, -wing * 0.4);
      ctx.stroke();
      ctx.restore();
    }

    // ── Sun ────────────────────────────────────────────────
    function drawSun() {
      const sx = canvas.width * 0.82, sy = canvas.height * 0.12;
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 110);
      sg.addColorStop(0,   'rgba(255,240,120,0.95)');
      sg.addColorStop(0.3, 'rgba(255,200,60,0.55)');
      sg.addColorStop(1,   'rgba(255,160,0,0)');
      ctx.beginPath();
      ctx.arc(sx, sy, 110, 0, Math.PI * 2);
      ctx.fillStyle = sg;
      ctx.fill();
      // core
      ctx.beginPath();
      ctx.arc(sx, sy, 34, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,245,150,0.97)';
      ctx.fill();
    }

    // ── Sky gradient ───────────────────────────────────────
    function drawSky() {
      const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
      sky.addColorStop(0,    '#4FC3F7'); // deep sky blue
      sky.addColorStop(0.35, '#81D4FA');
      sky.addColorStop(0.65, '#B3E5FC');
      sky.addColorStop(1,    '#E1F5FE'); // horizon haze
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    let animId;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawSky();
      drawSun();

      // Far clouds (layer 0) — dimmer, slower
      clouds.filter(c => c.layer === 0).forEach(drawCloud);
      // Mid clouds (layer 1)
      clouds.filter(c => c.layer === 1).forEach(drawCloud);

      // Birds between mid + near clouds
      birds.forEach(b => {
        drawBird(b);
        b.x    += b.speed;
        b.y    += b.dy;
        b.flap += b.flapSpd;
        // gentle sine vertical wave
        b.y += Math.sin(b.flap * 0.5) * 0.12;
        if (b.x > canvas.width + 80) {
          Object.assign(b, makeBird());
        }
      });

      // Near clouds (layer 2) — in front of birds
      clouds.filter(c => c.layer === 2).forEach(drawCloud);

      // Drift clouds
      clouds.forEach(c => {
        c.x += c.speed * (c.layer === 0 ? 0.4 : c.layer === 1 ? 0.7 : 1);
        if (c.x - c.w > canvas.width) {
          c.x = -c.w * 1.5;
          c.y = 30 + Math.random() * canvas.height * 0.55;
        }
      });

      animId = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} style={{ position:'fixed', inset:0, zIndex:0 }} />;
}

// ─────────────────────────────────────────────────────────────
// Main DevtaLogin
// ─────────────────────────────────────────────────────────────
export default function DevtaLogin({ onClose }) {
  const navigate = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      const { data, error: dbErr } = await supabase
        .from('devta')
        .select('id, name, email, password, is_active')
        .eq('email', email.trim().toLowerCase())
        .single();

      if (dbErr || !data) { setError('No Devta account found.'); return; }
      if (!data.is_active) { setError('Account is inactive.'); return; }
      if (password !== data.password) { setError('Incorrect password.'); return; }

      saveSession({ role: 'devta', email: data.email, name: data.name, id: data.id });
      enterFullscreen().catch(() => {}).then(() => startFullscreenGuard());
      navigate('/devta');
    } catch (ex) {
      setError(ex.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  // Input style helper
  const inputStyle = (focused) => ({
    width: '100%', padding: '13px 16px',
    background: 'rgba(255,255,255,0.88)',
    border: `2px solid ${focused ? '#0288D1' : 'rgba(255,255,255,0.6)'}`,
    borderRadius: 14, fontSize: 14, color: '#01579B',
    fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.18s',
    boxShadow: focused ? '0 0 0 3px rgba(2,136,209,0.18)' : 'none',
  });
  const [focusedField, setFocusedField] = useState('');

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center' }}>
      <SkyCanvas />

      {/* Close */}
      <button onClick={onClose}
        style={{ position:'fixed', top:20, right:24, zIndex:10,
          background:'rgba(255,255,255,0.55)', backdropFilter:'blur(8px)',
          border:'1px solid rgba(255,255,255,0.7)', borderRadius:'50%',
          width:38, height:38, cursor:'pointer', fontSize:17,
          display:'flex', alignItems:'center', justifyContent:'center',
          color:'#01579B', fontWeight:700, boxShadow:'0 2px 8px rgba(0,0,0,0.12)' }}>
        ✕
      </button>

      {/* Card */}
      <motion.div
        initial={{ opacity:0, y:30, scale:0.95 }}
        animate={{ opacity:1, y:0,  scale:1    }}
        exit={{    opacity:0, y:20, scale:0.95 }}
        transition={{ duration:0.35, ease:[0.22,1,0.36,1] }}
        style={{ position:'relative', zIndex:5, width:'100%',
          maxWidth:400, padding:'0 20px' }}>

        <div style={{
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(28px) saturate(160%)',
          WebkitBackdropFilter: 'blur(28px) saturate(160%)',
          border: '1.5px solid rgba(255,255,255,0.85)',
          borderRadius: 28,
          padding: '40px 36px',
          boxShadow: '0 24px 64px rgba(1,87,155,0.18), 0 4px 16px rgba(255,255,255,0.4)',
        }}>

          {/* Header */}
          <div style={{ textAlign:'center', marginBottom:32 }}>
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration:3, repeat:Infinity, ease:'easeInOut' }}
              style={{ fontSize:60, marginBottom:12, display:'block', lineHeight:1 }}>
              🌤️
            </motion.div>
            <div style={{ fontSize:22, fontWeight:800, color:'#01579B',
              letterSpacing:'-0.4px', marginBottom:5 }}>
              Devta Portal
            </div>
            <div style={{ fontSize:13, color:'#4FC3F7', fontWeight:600 }}>
              Stock Verification &amp; Approval
            </div>
            <div style={{ marginTop:10, fontSize:11, color:'#0288D1',
              background:'rgba(2,136,209,0.1)', borderRadius:20,
              padding:'3px 12px', display:'inline-block', fontWeight:600 }}>
              Press ⌘T / Ctrl+T to open
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:'#0288D1',
                display:'block', marginBottom:6, textTransform:'uppercase',
                letterSpacing:'0.5px' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="devta@mishracare.com"
                autoFocus
                style={inputStyle(focusedField === 'email')}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField('')}
              />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:'#0288D1',
                display:'block', marginBottom:6, textTransform:'uppercase',
                letterSpacing:'0.5px' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle(focusedField === 'password')}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField('')}
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }}
                  exit={{ opacity:0 }}
                  style={{ fontSize:12, color:'#B71C1C', fontWeight:600,
                    background:'rgba(183,28,28,0.08)', borderRadius:8,
                    padding:'8px 12px', textAlign:'center' }}>
                  ⛔ {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              whileTap={{ scale:0.97 }}
              disabled={loading}
              style={{ marginTop:4, padding:'14px',
                background: 'linear-gradient(135deg, #0288D1, #01579B)',
                color:'#fff', border:'none', borderRadius:14,
                fontSize:15, fontWeight:700, cursor:'pointer',
                fontFamily:'inherit',
                boxShadow:'0 6px 24px rgba(2,136,209,0.38)',
                transition:'opacity 0.15s' }}>
              {loading ? '⏳ Signing in…' : '🌤️ Enter Devta Portal'}
            </motion.button>
          </form>

        </div>
      </motion.div>
    </div>
  );
}
