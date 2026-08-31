import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveSession } from '../utils/session';
import { useNavigate } from 'react-router-dom';

// ── Shooting stars canvas ─────────────────────────────────────────────────────
function SpaceCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    // Stars
    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      a: Math.random(),
    }));

    // Shooting stars
    const shooters = Array.from({ length: 12 }, () => createShooter(canvas));
    function createShooter(c) {
      return {
        x: Math.random() * c.width,
        y: Math.random() * c.height * 0.5,
        len: Math.random() * 120 + 60,
        speed: Math.random() * 8 + 4,
        angle: Math.PI / 4 + (Math.random() - 0.5) * 0.3,
        alpha: 1,
        trail: [],
      };
    }

    let animId;
    const draw = () => {
      ctx.fillStyle = 'rgba(2,4,20,0.25)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw stars
      stars.forEach(s => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.a})`;
        ctx.fill();
        s.a = 0.3 + 0.7 * Math.abs(Math.sin(Date.now() * 0.001 + s.x));
      });

      // Draw & update shooters
      shooters.forEach((s, i) => {
        s.trail.push({ x: s.x, y: s.y });
        if (s.trail.length > 18) s.trail.shift();

        s.trail.forEach((pt, ti) => {
          const alpha = (ti / s.trail.length) * s.alpha * 0.8;
          const width = (ti / s.trail.length) * 2.5;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, width, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(200,220,255,${alpha})`;
          ctx.fill();
        });

        // Head glow
        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 6);
        grad.addColorStop(0, `rgba(255,255,255,${s.alpha})`);
        grad.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed;
        s.alpha -= 0.008;

        if (s.alpha <= 0 || s.x > canvas.width + 50 || s.y > canvas.height + 50) {
          shooters[i] = createShooter(canvas);
        }
      });

      // Nebula glow
      const cx = canvas.width / 2, cy = canvas.height / 2;
      const nebula = ctx.createRadialGradient(cx, cy, 0, cx, cy, canvas.width * 0.6);
      nebula.addColorStop(0, 'rgba(60,0,120,0.08)');
      nebula.addColorStop(0.5, 'rgba(0,20,80,0.05)');
      nebula.addColorStop(1, 'transparent');
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      animId = requestAnimationFrame(draw);
    };

    // Paint solid dark bg first
    ctx.fillStyle = '#020414';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    draw();

    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0 }} />;
}

// ── OTP boxes for 6-digit code ────────────────────────────────────────────────
function CodeInput({ onComplete }) {
  const [vals, setVals] = useState(Array(6).fill(''));
  const refs = useRef([]);

  const handleChange = (e, i) => {
    const v = e.target.value.replace(/\D/g, '').slice(-1);
    const next = [...vals]; next[i] = v;
    setVals(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
    if (next.every(d => d !== '')) onComplete(next.join(''));
  };

  const handleKeyDown = (e, i) => {
    if (e.key === 'Backspace' && !vals[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!p) return;
    const next = Array(6).fill('');
    p.split('').forEach((c, i) => { next[i] = c; });
    setVals(next);
    refs.current[Math.min(p.length, 5)]?.focus();
    if (p.length === 6) onComplete(p);
  };

  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }} onPaste={handlePaste}>
      {vals.map((v, i) => (
        <motion.input key={i} ref={el => refs.current[i] = el}
          type="text" inputMode="numeric" maxLength={1} value={v}
          onChange={e => handleChange(e, i)}
          onKeyDown={e => handleKeyDown(e, i)}
          autoFocus={i === 0}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
          style={{ width: 52, height: 60, textAlign: 'center', fontSize: 26, fontWeight: 800,
            background: v ? 'rgba(150,100,255,0.25)' : 'rgba(255,255,255,0.06)',
            border: `2px solid ${v ? 'rgba(180,130,255,0.8)' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: 14, color: '#fff', outline: 'none', fontFamily: 'inherit',
            caretColor: '#bf94ff', transition: 'all 0.18s',
            boxShadow: v ? '0 0 16px rgba(150,80,255,0.35)' : 'none',
          }} />
      ))}
    </div>
  );
}

// ── Main Vishnu Login page ─────────────────────────────────────────────────────
const SECRET_CODE = '232830';
const VISHNU_EMAIL = 'ilovepahad@moutain.com';
const VISHNU_PASS  = 'pahadibabu@321';

export default function VishnuLogin({ onClose }) {
  const navigate = useNavigate();
  const [phase,    setPhase]   = useState('code');  // code | login | error
  const [codeErr,  setCodeErr] = useState(false);
  const [email,    setEmail]   = useState('');
  const [password, setPassword]= useState('');
  const [loginErr, setLoginErr]= useState('');
  const [loading,  setLoading] = useState(false);
  const [shake,    setShake]   = useState(false);

  const handleCode = (code) => {
    if (code === SECRET_CODE) {
      setCodeErr(false);
      setPhase('login');
    } else {
      setCodeErr(true);
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginErr('');
    setLoading(true);
    setTimeout(() => {
      if (email.trim().toLowerCase() === VISHNU_EMAIL && password === VISHNU_PASS) {
        saveSession({ role: 'vishnu', email: VISHNU_EMAIL, name: 'Vishnu' });
        navigate('/vishnu');
      } else {
        setLoginErr('Invalid credentials');
        setLoading(false);
      }
    }, 600);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <SpaceCanvas />

      {/* Close button */}
      <button onClick={onClose}
        style={{ position: 'fixed', top: 20, right: 24, zIndex: 10, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        ✕
      </button>

      <AnimatePresence mode="wait">
        {/* ── Phase 1: Enter secret code ── */}
        {phase === 'code' && (
          <motion.div key="code"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{ position: 'relative', zIndex: 5, textAlign: 'center', padding: '48px 40px', maxWidth: 420, width: '100%' }}>
            {/* God icon */}
            <motion.div
              animate={{ scale: [1, 1.08, 1], filter: ['brightness(1)', 'brightness(1.4)', 'brightness(1)'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              style={{ fontSize: 72, marginBottom: 20, display: 'block' }}>
              🕉️
            </motion.div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', marginBottom: 6 }}>
              Vishnu Access
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>
              Enter the sacred code to proceed
            </div>
            <motion.div animate={shake ? { x: [-8, 8, -6, 6, -4, 4, 0] } : {}} transition={{ duration: 0.4 }}>
              <CodeInput onComplete={handleCode} />
            </motion.div>
            {codeErr && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                style={{ marginTop: 16, fontSize: 13, color: '#ff6b6b', fontWeight: 600 }}>
                ⛔ Incorrect code. Try again.
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── Phase 2: Vishnu Login ── */}
        {phase === 'login' && (
          <motion.div key="login"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            style={{ position: 'relative', zIndex: 5, width: '100%', maxWidth: 380, padding: '0 20px' }}>
            {/* Card */}
            <div style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: '36px 32px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <motion.div style={{ fontSize: 52, marginBottom: 10 }}
                  animate={{ rotate: [0, -5, 5, 0] }} transition={{ duration: 4, repeat: Infinity }}>
                  🕉️
                </motion.div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>Vishnu Dashboard</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>Super Admin Portal</div>
              </div>
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6 }}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus
                    placeholder="vishnu@mishracare.com"
                    style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: 12, fontSize: 14, color: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = 'rgba(180,130,255,0.8)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6 }}>Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: 12, fontSize: 14, color: '#fff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = 'rgba(180,130,255,0.8)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'} />
                </div>
                {loginErr && <div style={{ fontSize: 12, color: '#ff6b6b', fontWeight: 600, textAlign: 'center' }}>⛔ {loginErr}</div>}
                <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.97 }}
                  style={{ padding: '13px', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 20px rgba(124,58,237,0.5)', marginTop: 4 }}>
                  {loading ? '⏳ Entering…' : '🕉️ Enter Vishnu'}
                </motion.button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
