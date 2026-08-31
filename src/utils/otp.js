// In-memory OTP store: { email: { code, expiresAt } }
const otpStore = {};

/**
 * Generate a 4-digit OTP and store with 10-min expiry.
 */
export function generateOTP(email) {
  const code = String(Math.floor(1000 + Math.random() * 9000));
  otpStore[email] = {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  return code;
}

/**
 * Verify OTP for an email. One-time use — deleted after success.
 */
export function verifyOTP(email, inputCode) {
  const entry = otpStore[email];
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    delete otpStore[email];
    return false;
  }
  if (entry.code === inputCode) {
    delete otpStore[email];
    return true;
  }
  return false;
}

/**
 * Send OTP via Supabase Edge Function (avoids CORS issues with Resend).
 */
export async function sendOTPEmail(email, otp, name = 'User') {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const response = await fetch(`${supabaseUrl}/functions/v1/send-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ email, otp, name }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to send OTP email');
  }

  return await response.json();
}
