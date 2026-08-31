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
import '../styles/login.css';

// ── animation variants ───────────────────────────────────────────────────────
const fadeSlide = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0,  transition: { duration: 0.35, ease: 'easeOut' } },
  exit:    { opacity: 0, x: -40, transition: { duration: 0.25, ease: 'easeIn'  } },
};

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4 } }),
};

// ── toast hook ───────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  const show = useCallback((message, type = 'info', duration = 3500) => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), duration);
  }, []);
  return [toast, show];
}

// ── component ────────────────────────────────────────────────────────────────
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

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  // Cmd+I / Ctrl+I  → Vishnu login
  // Cmd+E / Ctrl+E  → Devta login
  useEffect(() => {
    const handler = (e) => {
      const mod = e.metaKey || e.ctrlKey; // covers Mac (Cmd) + Win/Linux (Ctrl)
      if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); setShowVishnu(true); }
      if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); setShowDevta(true);  }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── STEP 1: Validate credentials ────────────────────────────────────────
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
        // Admin: plain text password stored in admins.password_hash
        const { data, error } = await supabase
          .from('admins')
          .select('id, full_name, email, password_hash, is_active')
          .eq('email', email.trim().toLowerCase())
          .single();

        if (error || !data) {
          showToast('No admin account found with this email', 'error');
          setFieldErr({ email: 'No account found with this email' });
          return;
        }

        if (data.is_active === false) {
          showToast('Your account is inactive. Contact support.', 'error');
          return;
        }

        if (password !== data.password_hash) {
          showToast('Incorrect password', 'error');
          setFieldErr({ password: 'Incorrect password' });
          return;
        }

        const name = data.full_name || data.email;
        setUserName(name);
        await sendOTPAndProceed(name);

      } else {
        // Store Manager: check store_managers table (plain text password)
        const { data, error } = await supabase
          .from('store_managers')
          .select('id, full_name, email, password, is_active, store_id')
          .eq('email', email.trim().toLowerCase())
          .single();

        if (error || !data) {
          showToast('No store manager account found with this email', 'error');
          setFieldErr({ email: 'No account found with this email' });
          return;
        }

        if (data.is_active === false) {
          showToast('Your account is inactive. Contact admin.', 'error');
          return;
        }

        if (password !== data.password) {
          showToast('Incorrect password', 'error');
          setFieldErr({ password: 'Incorrect password' });
          return;
        }

        // Store manager: no OTP — go straight to dashboard
        const name = data.full_name || data.email;
        saveSession({ role: 'store_manager', email: email.trim().toLowerCase(), name });
        showToast('Login successful! Welcome back 👋', 'success');
        setTimeout(() => navigate('/store/dashboard'), 800);
      }
    } catch (err) {
      console.error('Login error:', err);
      showToast(err.message || 'Something went wrong. Try again.', 'error');
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

  // ── STEP 2: Verify OTP ───────────────────────────────────────────────────
  const handleOTPComplete = (code) => {
    const valid = verifyOTP(email.trim().toLowerCase(), code);

    if (!valid) {
      setOtpError(true);
      showToast('Incorrect OTP. Try again.', 'error');
      return;
    }

    saveSession({ role, email: email.trim().toLowerCase(), name: userName });
    showToast('Login successful! Welcome back 👋', 'success');

    const dest = role === 'admin' ? '/admin/dashboard' : '/store/dashboard';
    setTimeout(() => navigate(dest), 800);
  };

  // ── Resend OTP ───────────────────────────────────────────────────────────
  const startResendCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      const otp = generateOTP(email.trim().toLowerCase());
      await sendOTPEmail(email.trim().toLowerCase(), otp, userName);
      showToast('New OTP sent!', 'success');
      startResendCooldown();
    } catch {
      showToast('Failed to resend OTP', 'error');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="login-page">
      <div className="bg-blob bg-blob-1" />
      <div className="bg-blob bg-blob-2" />
      <div className="bg-blob bg-blob-3" />

      {/* Vishnu login overlay */}
      <AnimatePresence>
        {showVishnu && <VishnuLogin onClose={() => setShowVishnu(false)} />}
      </AnimatePresence>

      {/* Devta login overlay */}
      <AnimatePresence>
        {showDevta && <DevtaLogin onClose={() => setShowDevta(false)} />}
      </AnimatePresence>

      {/* ── Left panel ── */}
      <div className="login-left">
        <motion.div
          className="brand-area"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            className="brand-logo"
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            💊
          </motion.div>
          <div className="brand-name">Mishra<span>Care</span></div>
          <div className="brand-tagline">Pharmacy ERP System</div>
        </motion.div>

        <ul className="feature-list">
          {[
            { icon: '📦', text: 'Inventory Management' },
            { icon: '🧾', text: 'Billing & Invoicing'  },
            { icon: '📊', text: 'Sales Analytics'      },
            { icon: '💊', text: 'Drug Catalog'         },
            { icon: '👥', text: 'Staff Management'     },
          ].map((f, i) => (
            <motion.li
              key={i}
              className="feature-item"
              custom={i}
              variants={fadeUp}
              initial="initial"
              animate="animate"
            >
              <div className="feature-icon">{f.icon}</div>
              <span>{f.text}</span>
            </motion.li>
          ))}
        </ul>
      </div>

      {/* ── Right panel ── */}
      <div className="login-right">
        <div className="login-card">
          <AnimatePresence mode="wait">

            {/* Step 1 — Login */}
            {step === 'login' && (
              <motion.div key="login" {...fadeSlide}>
                <div className="login-card-header">
                  <div className="login-card-title">Welcome back 👋</div>
                  <div className="login-card-sub">Sign in to your MishraCare account</div>
                </div>

                {/* Role selector */}
                <div className="role-selector">
                  {[
                    { id: 'admin',         emoji: '🛡️', label: 'Admin'        },
                    { id: 'store_manager', emoji: '🏪', label: 'Store Manager' },
                  ].map(r => (
                    <motion.button
                      key={r.id}
                      type="button"
                      className={`role-card${role === r.id ? ' active' : ''}`}
                      onClick={() => { setRole(r.id); setFieldErr({}); }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <span className="role-emoji">{r.emoji}</span>
                      <span className="role-name">{r.label}</span>
                      <span className="role-check">✓</span>
                    </motion.button>
                  ))}
                </div>

                {/* Login form — works for both roles */}
                <form onSubmit={handleLogin} noValidate>
                  <div className="form-group">
                    <label className="form-label">Email address</label>
                    <div className="form-input-wrap">
                      <span className="form-input-icon">📧</span>
                      <input
                        type="email"
                        className={`form-input${fieldErr.email ? ' error' : ''}`}
                        placeholder={role === 'admin' ? 'admin@mishracare.com' : 'store@mishracare.com'}
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        autoComplete="email"
                      />
                    </div>
                    {fieldErr.email && <div className="form-error">⚠ {fieldErr.email}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <div className="form-input-wrap">
                      <span className="form-input-icon">🔑</span>
                      <input
                        type="password"
                        className={`form-input${fieldErr.password ? ' error' : ''}`}
                        placeholder="Enter your password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        autoComplete="current-password"
                      />
                    </div>
                    {fieldErr.password && <div className="form-error">⚠ {fieldErr.password}</div>}
                  </div>

                  <motion.button
                    type="submit"
                    className="btn-primary"
                    disabled={loading}
                    whileTap={{ scale: 0.98 }}
                  >
                    {loading
                      ? <><div className="spinner" /> Verifying...</>
                      : <>Continue →</>
                    }
                  </motion.button>
                </form>
              </motion.div>
            )}

            {/* Step 2 — OTP */}
            {step === 'otp' && (
              <motion.div key="otp" {...fadeSlide}>
                <button
                  className="otp-back-btn"
                  onClick={() => { setStep('login'); setOtpError(false); }}
                >
                  ← Back
                </button>

                <div className="login-card-header">
                  <div className="login-card-title">Check your email 📬</div>
                  <div className="login-card-sub">
                    We sent a 4-digit code to verify your identity.
                  </div>
                </div>

                <div className="otp-email-display">
                  <span>📧</span>
                  <span>{email}</span>
                </div>

                <OTPInput
                  length={4}
                  onComplete={handleOTPComplete}
                  hasError={otpError}
                  onReset={() => setOtpError(false)}
                />

                <div className="otp-resend">
                  Didn't receive it?{' '}
                  <button
                    className="otp-resend-btn"
                    onClick={handleResend}
                    disabled={resendCooldown > 0}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                  </button>
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  disabled
                  style={{ opacity: 0.35, cursor: 'default', marginTop: 8 }}
                >
                  Enter the 4-digit code above
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      <Toast {...toast} />
    </div>
  );
}
