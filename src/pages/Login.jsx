import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import { generateOTP, verifyOTP, sendOTPEmail } from '../utils/otp';
import { saveSession } from '../utils/session';
import OTPInput from '../components/OTPInput';
import Toast from '../components/Toast';
import VishnuLogin from './VishnuLogin';
import DevtaLogin from './DevtaLogin';
import '../styles/login.css';

// ── Nature Fog Canvas ──────────────────────────────────────────────────────
function EarthCanvas() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      canvas.style.width  = window.innerWidth  + 'px';
      canvas.style.height = window.innerHeight + 'px';
    };
    resize();
    window.addEventListener('resize', resize);

    // Floating pollen / mist motes
    const particles = Array.from({ length: 50 }, () => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height,
      r:     Math.random() * 2.8 + 0.5,
      vx:    (Math.random() - 0.5) * 0.25,
      vy:   -(Math.random() * 0.3 + 0.05), // drift upward gently
      alpha: Math.random() * 0.35 + 0.08,
      color: ['#fff','#D4EDD4','#B8D8B8','#E8F5E8','#C8E6C9'][Math.floor(Math.random()*5)],
    }));

    // Falling leaves
    const leaves = Array.from({ length: 28 }, () => ({
      x:    Math.random() * canvas.width,
      y:    -30 - Math.random() * canvas.height,  // spread vertically so they're visible immediately
      vy:   0.3 + Math.random() * 0.55,
      vx:   (Math.random() - 0.5) * 0.7,
      rot:  Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.033,
      size: 5 + Math.random() * 11,
      color:['#4CAF50','#66BB6A','#388E3C','#81C784','#2E7D32','#A5D6A7','#43A047','#1B5E20'][Math.floor(Math.random()*8)],
      alpha: 0.45 + Math.random() * 0.45,
    }));

    // Rolling fog layers
    const fogLayers = Array.from({ length: 4 }, (_, i) => ({
      x:     Math.random() * canvas.width * 1.5 - canvas.width * 0.25,
      y:     canvas.height * (0.5 + i * 0.14),
      w:     canvas.width * (1.2 + Math.random() * 0.6),
      h:     60 + i * 30 + Math.random() * 50,
      vx:    0.18 + Math.random() * 0.18,
      alpha: 0.07 + i * 0.04,
    }));

    function drawLeaf(x, y, size, rot, color, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.quadraticCurveTo(size * 0.7, -size * 0.2, 0, size);
      ctx.quadraticCurveTo(-size * 0.7, -size * 0.2, 0, -size);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.7);
      ctx.lineTo(0, size * 0.7);
      ctx.stroke();
      ctx.restore();
    }

    let animId;
    const tick = () => {
      // Fill full background every frame — prevents any transparent holes
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Solid gradient background — matches CSS background exactly
      const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bg.addColorStop(0,    '#E8F5E9');
      bg.addColorStop(0.25, '#C8E6C9');
      bg.addColorStop(0.5,  '#A5D6A7');
      bg.addColorStop(0.75, '#81C784');
      bg.addColorStop(1,    '#4CAF50');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Soft white fog from top
      const topFog = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.5);
      topFog.addColorStop(0,   'rgba(255,255,255,0.5)');
      topFog.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.fillStyle = topFog;
      ctx.fillRect(0, 0, canvas.width, canvas.height * 0.5);

      // Left side mist
      const leftFog = ctx.createLinearGradient(0, 0, canvas.width * 0.4, 0);
      leftFog.addColorStop(0,  'rgba(255,255,255,0.3)');
      leftFog.addColorStop(1,  'rgba(255,255,255,0)');
      ctx.fillStyle = leftFog;
      ctx.fillRect(0, 0, canvas.width * 0.4, canvas.height);

      // Rolling fog bands
      fogLayers.forEach(f => {
        const fog = ctx.createRadialGradient(
          f.x + f.w * 0.5, f.y + f.h * 0.5, 0,
          f.x + f.w * 0.5, f.y + f.h * 0.5, f.w * 0.55
        );
        fog.addColorStop(0,   `rgba(255,255,255,${f.alpha * 1.4})`);
        fog.addColorStop(0.5, `rgba(240,250,240,${f.alpha})`);
        fog.addColorStop(1,   'rgba(255,255,255,0)');
        ctx.fillStyle = fog;
        ctx.fillRect(f.x, f.y, f.w, f.h);
        f.x += f.vx;
        if (f.x > canvas.width + 200) f.x = -canvas.width * 0.5;
      });

      // Pollen / mist particles
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.globalAlpha = 1;
        p.x += p.vx; p.y += p.vy;
        if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
      });

      // Leaves
      leaves.forEach(l => {
        drawLeaf(l.x, l.y, l.size, l.rot, l.color, l.alpha);
        l.y += l.vy;
        l.x += l.vx + Math.sin(l.y * 0.015) * 0.5;
        l.rot += l.rotV;
        if (l.y > canvas.height + 30) { l.y = -20; l.x = Math.random() * canvas.width; }
      });

      animId = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
    return (
      <canvas
        ref={ref}
        style={{
          position: 'fixed',
          top: 0, left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
    );
}

// ── Animations ────────────────────────────────────────────────────────────────
const slideIn = {
  initial: { opacity:0, y:16 },
  animate: { opacity:1, y:0, transition:{ duration:0.32, ease:'easeOut' } },
  exit:    { opacity:0, y:-12, transition:{ duration:0.2 } },
};

// ── Toast hook ────────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState({ visible:false, message:'', type:'info' });
  const show = useCallback((message, type='info', duration=3500) => {
    setToast({ visible:true, message, type });
    setTimeout(() => setToast(t => ({ ...t, visible:false })), duration);
  }, []);
  return [toast, show];
}

// ── Input component ───────────────────────────────────────────────────────────
function EarthInput({ icon, type, placeholder, value, onChange, error, autoComplete }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ position:'relative' }}>
        <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)',
          fontSize:16, pointerEvents:'none', zIndex:1,
          filter: focused ? 'none' : 'brightness(0.7)' }}>
          {icon}
        </span>
        <input
          type={type} placeholder={placeholder} value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ width:'100%', padding:'13px 14px 13px 44px',
            background: focused ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)',
            border:`1.5px solid ${error ? '#E57373' : focused ? '#388E3C' : 'rgba(0,100,0,0.15)'}`,
            borderRadius:12, fontSize:14, color:'#1B4D1F',
            fontFamily:'inherit', outline:'none', transition:'all 0.18s',
            boxSizing:'border-box',
            boxShadow: focused ? '0 0 0 3px rgba(56,142,60,0.12)' : 'none' }}
        />
      </div>
      {error && (
        <div style={{ fontSize:11, color:'#FF6B6B', marginTop:5, fontWeight:500 }}>
          ⚠ {error}
        </div>
      )}
    </div>
  );
}

// ── Main Login ────────────────────────────────────────────────────────────────
export default function Login() {
  const navigate = useNavigate();
  const [toast, showToast] = useToast();

  const [step,           setStep]           = useState('login');
  const [role,           setRole]           = useState('admin');
  const [email,          setEmail]          = useState('');
  const [password,       setPassword]       = useState('');
  const [loading,        setLoading]        = useState(false);
  const [otpError,       setOtpError]       = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [userName,       setUserName]       = useState('');
  const [fieldErr,       setFieldErr]       = useState({});
  const [showVishnu,     setShowVishnu]     = useState(false);
  const [showDevta,      setShowDevta]      = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); setShowVishnu(true); }
      if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); setShowDevta(true);  }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setFieldErr({});
    const errors = {};
    if (!email.trim())    errors.email    = 'Email is required';
    if (!password.trim()) errors.password = 'Password is required';
    if (Object.keys(errors).length) { setFieldErr(errors); return; }

    setLoading(true);
    try {
      if (role === 'admin') {
        const { data, error } = await supabase.from('admins')
          .select('id, full_name, email, password_hash, is_active')
          .eq('email', email.trim().toLowerCase()).single();
        if (error || !data) { showToast('No admin account found', 'error'); setFieldErr({ email: 'No account found' }); return; }
        if (!data.is_active) { showToast('Account inactive. Contact support.', 'error'); return; }
        if (password !== data.password_hash) { showToast('Incorrect password', 'error'); setFieldErr({ password: 'Incorrect password' }); return; }
        const name = data.full_name || data.email;
        setUserName(name);
        await sendOTPAndProceed(name);
      } else {
        const { data, error } = await supabase.from('store_managers')
          .select('id, full_name, email, password, is_active')
          .eq('email', email.trim().toLowerCase()).single();
        if (error || !data) { showToast('No manager account found', 'error'); setFieldErr({ email: 'No account found' }); return; }
        if (!data.is_active) { showToast('Account inactive. Contact admin.', 'error'); return; }
        if (password !== data.password) { showToast('Incorrect password', 'error'); setFieldErr({ password: 'Incorrect password' }); return; }
        const name = data.full_name || data.email;
        saveSession({ role:'store_manager', email:email.trim().toLowerCase(), name });
        showToast('Welcome back! 🌱', 'success');
        setTimeout(() => navigate('/store/dashboard'), 800);
      }
    } catch (err) {
      showToast(err.message || 'Something went wrong', 'error');
    } finally {
      setLoading(false);
    }
  };

  const sendOTPAndProceed = async (name) => {
    const otp = generateOTP(email.trim().toLowerCase());
    await sendOTPEmail(email.trim().toLowerCase(), otp, name);
    showToast('OTP sent to your email!', 'success');
    setStep('otp');
    startResendCooldown();
  };

  const handleOTPComplete = (code) => {
    const valid = verifyOTP(email.trim().toLowerCase(), code);
    if (!valid) { setOtpError(true); showToast('Incorrect OTP. Try again.', 'error'); return; }
    saveSession({ role, email: email.trim().toLowerCase(), name: userName });
    showToast('Login successful! Welcome back 👋', 'success');
    setTimeout(() => navigate(role === 'admin' ? '/admin/dashboard' : '/store/dashboard'), 800);
  };

  const startResendCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown(prev => { if (prev <= 1) { clearInterval(interval); return 0; } return prev - 1; });
    }, 1000);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      const otp = generateOTP(email.trim().toLowerCase());
      await sendOTPEmail(email.trim().toLowerCase(), otp, userName);
      showToast('New OTP sent!', 'success');
      startResendCooldown();
    } catch { showToast('Failed to resend OTP', 'error'); }
  };

  // Card style
  const card = {
    position:'relative', zIndex:5,
    background:'rgba(255,255,255,0.62)',
    backdropFilter:'blur(32px) saturate(180%)',
    WebkitBackdropFilter:'blur(32px) saturate(180%)',
    border:'1px solid rgba(255,255,255,0.85)',
    borderRadius:24,
    padding:'38px 34px',
    width:'100%', maxWidth:390,
    boxShadow:'0 20px 60px rgba(0,80,0,0.18), 0 4px 16px rgba(255,255,255,0.5), inset 0 1px 0 rgba(255,255,255,0.9)',
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter',-apple-system,sans-serif",
      position: 'relative', overflow: 'hidden',
      /* CSS gradient — always covers full page, no canvas gaps */
      background: `
        linear-gradient(160deg,
          #E8F5E9 0%,
          #C8E6C9 20%,
          #A5D6A7 45%,
          #81C784 70%,
          #4CAF50 100%)
      `,
    }}>
      <EarthCanvas />

      {/* White fog from top */}
      <div style={{ position:'fixed', top:0, left:0, right:0, height:'50vh', zIndex:1, pointerEvents:'none',
        background:'linear-gradient(to bottom, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)' }} />
      {/* Left mist */}
      <div style={{ position:'fixed', top:0, left:0, bottom:0, width:'35vw', zIndex:1, pointerEvents:'none',
        background:'linear-gradient(to right, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 100%)' }} />

      {/* Vishnu / Devta overlays */}
      <AnimatePresence>
        {showVishnu && <VishnuLogin onClose={() => setShowVishnu(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showDevta && <DevtaLogin onClose={() => setShowDevta(false)} />}
      </AnimatePresence>

      <motion.div style={card}
        initial={{ opacity:0, scale:0.95, y:24 }}
        animate={{ opacity:1, scale:1,    y:0  }}
        transition={{ duration:0.45, ease:[0.22,1,0.36,1] }}>

        {/* Brand */}
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <motion.div
            animate={{ y:[0,-5,0] }}
            transition={{ duration:3.5, repeat:Infinity, ease:'easeInOut' }}
            style={{ fontSize:52, marginBottom:10, display:'block', lineHeight:1 }}>
            🌿
          </motion.div>
          <div style={{ fontSize:26, fontWeight:800, color:'#1B4D1F',
            letterSpacing:'-0.5px', marginBottom:3 }}>
            Mishra<span style={{ color:'#388E3C' }}>Care</span>
          </div>
          <div style={{ fontSize:12, color:'#81C784',
            letterSpacing:'1.5px', textTransform:'uppercase', fontWeight:600 }}>
            Pharmacy ERP
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 'login' && (
            <motion.div key="login" {...slideIn}>

              {/* Role pills */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:22 }}>
                {[
                  { id:'admin',         icon:'🛡️', label:'Admin'        },
                  { id:'store_manager', icon:'🌱', label:'Store Manager' },
                ].map(r => (
                  <button key={r.id} onClick={() => { setRole(r.id); setFieldErr({}); }}
                    style={{ padding:'12px 10px', borderRadius:12, border:'1.5px solid',
                      borderColor: role===r.id ? '#388E3C' : 'rgba(0,100,0,0.12)',
                      background:  role===r.id ? 'rgba(56,142,60,0.10)' : 'rgba(0,0,0,0.03)',
                      cursor:'pointer', fontFamily:'inherit', transition:'all 0.18s',
                      display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                    <span style={{ fontSize:22 }}>{r.icon}</span>
                    <span style={{ fontSize:12, fontWeight:600,
                      color: role===r.id ? '#2E7D32' : '#666' }}>
                      {r.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Form */}
              <form onSubmit={handleLogin} noValidate>
                <EarthInput icon="✉️" type="email"
                  placeholder={role==='admin' ? 'admin@mishracare.com' : 'store@mishracare.com'}
                  value={email} onChange={setEmail}
                  error={fieldErr.email} autoComplete="email" />
                <EarthInput icon="🔑" type="password"
                  placeholder="Enter your password"
                  value={password} onChange={setPassword}
                  error={fieldErr.password} autoComplete="current-password" />

                <motion.button type="submit" disabled={loading}
                  whileTap={{ scale:0.97 }}
                  style={{ width:'100%', padding:'14px',
                    background:'linear-gradient(145deg,#2E7D32,#1B5E20)',
                    color:'#fff', border:'none', borderRadius:12,
                    fontSize:15, fontWeight:700, cursor: loading ? 'default' : 'pointer',
                    fontFamily:'inherit', marginTop:4,
                    boxShadow:'0 4px 18px rgba(46,125,50,0.35)',
                    transition:'all 0.18s',
                    opacity: loading ? 0.75 : 1 }}>
                  {loading
                    ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                        <svg width="17" height="17" viewBox="0 0 17 17" style={{ animation:'spin 0.65s linear infinite' }}>
                          <circle cx="8.5" cy="8.5" r="6" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
                          <path d="M8.5 2.5 A6 6 0 0 1 14.5 8.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        Verifying…
                      </span>
                    : 'Sign In →'}
                </motion.button>
              </form>
            </motion.div>
          )}

          {step === 'otp' && (
            <motion.div key="otp" {...slideIn}>
              <button onClick={() => { setStep('login'); setOtpError(false); }}
                style={{ background:'none', border:'none', color:'#388E3C',
                  fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                  padding:0, marginBottom:20, display:'flex', alignItems:'center', gap:5 }}>
                ← Back
              </button>

              <div style={{ textAlign:'center', marginBottom:24 }}>
                <div style={{ fontSize:22, fontWeight:700, color:'#1B4D1F', marginBottom:5 }}>
                  Check your email 📬
                </div>
                <div style={{ fontSize:13, color:'#666' }}>
                  4-digit code sent to
                </div>
                <div style={{ marginTop:8, fontSize:13, fontWeight:600,
                  color:'#2E7D32', background:'rgba(56,142,60,0.08)',
                  border:'1px solid rgba(56,142,60,0.2)',
                  borderRadius:9, padding:'8px 14px', display:'inline-block' }}>
                  ✉️ {email}
                </div>
              </div>

              <OTPInput length={4} onComplete={handleOTPComplete}
                hasError={otpError} onReset={() => setOtpError(false)} />

              <div style={{ textAlign:'center', fontSize:13, color:'#666',
                marginTop:14 }}>
                Didn't receive it?{' '}
                <button onClick={handleResend} disabled={resendCooldown > 0}
                  style={{ background:'none', border:'none', color:'#2E7D32',
                    fontSize:13, fontWeight:600, cursor: resendCooldown > 0 ? 'default' : 'pointer',
                    fontFamily:'inherit', opacity: resendCooldown > 0 ? 0.5 : 1 }}>
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* CSS for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <Toast {...toast} />
    </div>
  );
}
