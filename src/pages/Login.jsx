import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabase';
import { generateOTP, verifyOTP, sendOTPEmail } from '../utils/otp';
import { saveSession } from '../utils/session';
import OTPInput from '../components/OTPInput';
import Toast from '../components/Toast';
import VishnuLogin from './VishnuLogin';
import DevtaLogin from './DevtaLogin';

// ── Pure CSS leaf styles injected once ────────────────────────────────────
const LEAF_CSS = `
  .login-bg {
    position: fixed;
    inset: 0;
    background: linear-gradient(170deg,
      #f0faf0 0%,
      #d4edda 22%,
      #a8d5b5 48%,
      #6dbf82 74%,
      #3a9e56 100%
    );
    z-index: 0;
  }
  .login-fog-top {
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 50%;
    background: linear-gradient(to bottom, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%);
    z-index: 1;
    pointer-events: none;
  }
  .login-fog-left {
    position: fixed;
    top: 0; left: 0; bottom: 0;
    width: 42%;
    background: linear-gradient(to right, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 100%);
    z-index: 1;
    pointer-events: none;
  }
  @keyframes leafFall {
    0%   { transform: translateY(-60px) rotate(0deg);   opacity: 0; }
    5%   { opacity: 0.85; }
    90%  { opacity: 0.75; }
    100% { transform: translateY(105vh) rotate(400deg); opacity: 0; }
  }
  .leaf {
    position: fixed;
    top: 0;
    z-index: 2;
    pointer-events: none;
    animation: leafFall linear infinite;
    will-change: transform;
  }
`;

const LEAF_COLORS = ['#4CAF50','#66BB6A','#388E3C','#81C784','#2E7D32','#A5D6A7','#43A047','#558B2F','#1B5E20'];

const LEAVES = Array.from({ length: 26 }, (_, i) => ({
  id: i,
  left:     (4 + i * 3.6) % 96 + '%',
  size:     8 + (i * 7) % 12,
  color:    LEAF_COLORS[i % LEAF_COLORS.length],
  duration: 5 + (i * 1.3) % 6 + 's',
  delay:    -(i * 0.55) % 9 + 's', // negative so they start mid-fall immediately
}));

function LeafSVG({ size, color }) {
  return (
    <svg width={size} height={size * 1.5} viewBox="0 0 20 30">
      <path d="M10 0 Q18 8 10 28 Q2 8 10 0 Z" fill={color} />
      <line x1="10" y1="2" x2="10" y2="26" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
    </svg>
  );
}

// ── Animations ─────────────────────────────────────────────────────────────
const slideIn = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -10, transition: { duration: 0.18 } },
};

function useToast() {
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  const show = useCallback((message, type = 'info', duration = 3500) => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), duration);
  }, []);
  return [toast, show];
}

function EarthInput({ icon, type, placeholder, value, onChange, error, autoComplete }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
          fontSize: 15, pointerEvents: 'none', opacity: focused ? 1 : 0.55,
        }}>{icon}</span>
        <input
          type={type} placeholder={placeholder} value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%', padding: '12px 13px 12px 42px',
            background: focused ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.65)',
            border: `1.5px solid ${error ? '#E57373' : focused ? '#2E7D32' : 'rgba(0,100,0,0.18)'}`,
            borderRadius: 11, fontSize: 14, color: '#1B4D1F',
            fontFamily: 'inherit', outline: 'none', transition: 'all 0.18s',
            boxSizing: 'border-box',
            boxShadow: focused ? '0 0 0 3px rgba(46,125,50,0.13)' : 'none',
          }}
        />
      </div>
      {error && <div style={{ fontSize: 11, color: '#C62828', marginTop: 4 }}>⚠ {error}</div>}
    </div>
  );
}

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

  useEffect(() => {
    const h = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); setShowVishnu(true); }
      if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); setShowDevta(true); }
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
          .select('id,full_name,email,password_hash,is_active')
          .eq('email', email.trim().toLowerCase()).single();
        if (error || !data) { showToast('No admin account found', 'error'); setFieldErr({ email: 'No account found' }); return; }
        if (!data.is_active) { showToast('Account inactive.', 'error'); return; }
        if (password !== data.password_hash) { showToast('Incorrect password', 'error'); setFieldErr({ password: 'Incorrect password' }); return; }
        const name = data.full_name || data.email;
        setUserName(name);
        await sendOTPAndProceed(name);
      } else {
        const { data, error } = await supabase.from('store_managers')
          .select('id,full_name,email,password,is_active')
          .eq('email', email.trim().toLowerCase()).single();
        if (error || !data) { showToast('No manager account found', 'error'); setFieldErr({ email: 'No account found' }); return; }
        if (!data.is_active) { showToast('Account inactive.', 'error'); return; }
        if (password !== data.password) { showToast('Incorrect password', 'error'); setFieldErr({ password: 'Incorrect password' }); return; }
        const name = data.full_name || data.email;
        saveSession({ role: 'store_manager', email: email.trim().toLowerCase(), name });
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
    showToast('OTP sent!', 'success');
    setStep('otp');
    startResendCooldown();
  };

  const handleOTPComplete = (code) => {
    const valid = verifyOTP(email.trim().toLowerCase(), code);
    if (!valid) { setOtpError(true); showToast('Incorrect OTP.', 'error'); return; }
    saveSession({ role, email: email.trim().toLowerCase(), name: userName });
    showToast('Login successful!', 'success');
    setTimeout(() => navigate(role === 'admin' ? '/admin/dashboard' : '/store/dashboard'), 800);
  };

  const startResendCooldown = () => {
    setResendCooldown(60);
    const iv = setInterval(() => {
      setResendCooldown(p => { if (p <= 1) { clearInterval(iv); return 0; } return p - 1; });
    }, 1000);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await sendOTPEmail(email.trim().toLowerCase(), generateOTP(email.trim().toLowerCase()), userName);
      showToast('New OTP sent!', 'success');
      startResendCooldown();
    } catch { showToast('Failed', 'error'); }
  };

  return (
    <>
      {/* Inject CSS once */}
      <style>{LEAF_CSS}</style>

      {/* Background layers — all fixed, no JS */}
      <div className="login-bg" />
      <div className="login-fog-top" />
      <div className="login-fog-left" />

      {/* CSS-animated leaves */}
      {LEAVES.map(l => (
        <div key={l.id} className="leaf"
          style={{ left: l.left, animationDuration: l.duration, animationDelay: l.delay }}>
          <LeafSVG size={l.size} color={l.color} />
        </div>
      ))}

      {/* Overlays */}
      <AnimatePresence>
        {showVishnu && <VishnuLogin onClose={() => setShowVishnu(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showDevta && <DevtaLogin onClose={() => setShowDevta(false)} />}
      </AnimatePresence>

      {/* Page wrapper — transparent, just for centering */}
      <div style={{
        position: 'relative', zIndex: 10,
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}>
        {/* Login card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1.5px solid rgba(255,255,255,0.9)',
            borderRadius: 24,
            padding: '38px 32px',
            width: '100%', maxWidth: 390,
            boxShadow: '0 16px 48px rgba(0,80,0,0.18), 0 2px 8px rgba(255,255,255,0.5)',
          }}
        >
          {/* Brand */}
          <div style={{ textAlign: 'center', marginBottom: 26 }}>
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ fontSize: 48, marginBottom: 10, lineHeight: 1, display: 'block' }}>
              🌿
            </motion.div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#1B4D1F', letterSpacing: '-0.5px', marginBottom: 2 }}>
              Mishra<span style={{ color: '#2E7D32' }}>Care</span>
            </div>
            <div style={{ fontSize: 11, color: '#66BB6A', letterSpacing: '1.8px', textTransform: 'uppercase', fontWeight: 600 }}>
              Pharmacy ERP
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === 'login' && (
              <motion.div key="login" {...slideIn}>
                {/* Role selector */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                  {[
                    { id: 'admin',         icon: '🛡️', label: 'Admin'        },
                    { id: 'store_manager', icon: '🌱', label: 'Store Manager' },
                  ].map(r => (
                    <button key={r.id} onClick={() => { setRole(r.id); setFieldErr({}); }}
                      style={{
                        padding: '11px 8px', borderRadius: 12, border: '1.5px solid',
                        borderColor: role === r.id ? '#2E7D32' : 'rgba(0,100,0,0.15)',
                        background: role === r.id ? 'rgba(46,125,50,0.10)' : 'rgba(255,255,255,0.5)',
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.18s',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                        boxShadow: role === r.id ? '0 0 0 3px rgba(46,125,50,0.12)' : 'none',
                      }}>
                      <span style={{ fontSize: 22 }}>{r.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: role === r.id ? '#1B5E20' : '#555' }}>{r.label}</span>
                    </button>
                  ))}
                </div>

                <form onSubmit={handleLogin} noValidate>
                  <EarthInput icon="✉️" type="email"
                    placeholder={role === 'admin' ? 'admin@mishracare.com' : 'store@mishracare.com'}
                    value={email} onChange={setEmail} error={fieldErr.email} autoComplete="email" />
                  <EarthInput icon="🔑" type="password"
                    placeholder="Enter your password"
                    value={password} onChange={setPassword} error={fieldErr.password} autoComplete="current-password" />

                  <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.97 }}
                    style={{
                      width: '100%', padding: '13px',
                      background: 'linear-gradient(145deg, #2E7D32, #1B5E20)',
                      color: '#fff', border: 'none', borderRadius: 12,
                      fontSize: 15, fontWeight: 700,
                      cursor: loading ? 'default' : 'pointer',
                      fontFamily: 'inherit', marginTop: 4,
                      boxShadow: '0 4px 16px rgba(46,125,50,0.4)',
                      opacity: loading ? 0.75 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                    {loading
                      ? <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.65s linear infinite' }} /> Verifying…</>
                      : 'Sign In →'}
                  </motion.button>
                </form>
              </motion.div>
            )}

            {step === 'otp' && (
              <motion.div key="otp" {...slideIn}>
                <button onClick={() => { setStep('login'); setOtpError(false); }}
                  style={{ background: 'none', border: 'none', color: '#2E7D32', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 18 }}>
                  ← Back
                </button>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#1B4D1F', marginBottom: 5 }}>Check your email 📬</div>
                  <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>4-digit code sent to</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#2E7D32', background: 'rgba(46,125,50,0.08)', border: '1px solid rgba(46,125,50,0.2)', borderRadius: 9, padding: '7px 14px', display: 'inline-block' }}>
                    ✉️ {email}
                  </div>
                </div>
                <OTPInput length={4} onComplete={handleOTPComplete} hasError={otpError} onReset={() => setOtpError(false)} />
                <div style={{ textAlign: 'center', fontSize: 13, color: '#666', marginTop: 14 }}>
                  Didn't receive it?{' '}
                  <button onClick={handleResend} disabled={resendCooldown > 0}
                    style={{ background: 'none', border: 'none', color: '#2E7D32', fontSize: 13, fontWeight: 600, cursor: resendCooldown > 0 ? 'default' : 'pointer', fontFamily: 'inherit', opacity: resendCooldown > 0 ? 0.5 : 1 }}>
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <Toast {...toast} />
    </>
  );
}
