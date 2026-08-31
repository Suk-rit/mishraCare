import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function buildOTPEmailHTML(otp: string, name: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>MishraCare OTP</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',Arial,sans-serif;background:#f0f4f8;padding:40px 20px}
    .wrapper{max-width:520px;margin:0 auto}
    .card{background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 40px rgba(0,0,0,.08)}
    .header{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);padding:40px 40px 32px;text-align:center;position:relative;overflow:hidden}
    .header::before{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;background:rgba(229,57,53,.15);border-radius:50%}
    .header::after{content:'';position:absolute;bottom:-40px;left:-40px;width:160px;height:160px;background:rgba(229,57,53,.1);border-radius:50%}
    .logo-wrap{position:relative;z-index:1}
    .logo-icon{width:56px;height:56px;background:linear-gradient(135deg,#e53935,#c62828);border-radius:16px;display:inline-flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:12px}
    .logo-text{color:#fff;font-size:22px;font-weight:800;letter-spacing:-.5px}
    .logo-text span{color:#ef9a9a}
    .header-sub{color:rgba(255,255,255,.6);font-size:13px;margin-top:4px;letter-spacing:.5px;text-transform:uppercase}
    .body{padding:40px}
    .greeting{font-size:18px;font-weight:600;color:#1a1a2e;margin-bottom:10px}
    .message{font-size:14px;color:#64748b;line-height:1.7;margin-bottom:32px}
    .otp-section{background:linear-gradient(135deg,#f8fafc,#f1f5f9);border:2px dashed #cbd5e1;border-radius:16px;padding:28px;text-align:center;margin-bottom:28px}
    .otp-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:14px}
    .otp-code{display:inline-flex;gap:10px}
    .otp-digit{width:54px;height:64px;background:#fff;border:2px solid #e2e8f0;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;color:#1a1a2e;box-shadow:0 2px 8px rgba(0,0,0,.06)}
    .otp-expiry{font-size:12px;color:#94a3b8;margin-top:14px}
    .otp-expiry strong{color:#e53935}
    .divider{height:1px;background:#f1f5f9;margin:28px 0}
    .warning{display:flex;gap:12px;background:#fff7f7;border:1px solid #fecdd3;border-radius:12px;padding:16px;margin-bottom:24px}
    .warning-icon{font-size:18px;flex-shrink:0;margin-top:1px}
    .warning-text{font-size:13px;color:#7f1d1d;line-height:1.6}
    .footer{background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #f1f5f9}
    .footer-text{font-size:12px;color:#94a3b8;line-height:1.8}
    .footer-brand{font-size:13px;font-weight:700;color:#1a1a2e;margin-bottom:6px}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="logo-wrap">
          <div class="logo-icon">💊</div>
          <div class="logo-text">Mishra<span>Care</span></div>
          <div class="header-sub">Pharmacy ERP System</div>
        </div>
      </div>
      <div class="body">
        <div class="greeting">Hello, ${name} 👋</div>
        <div class="message">We received a login request for your MishraCare account. Use the one-time password below to complete your verification.</div>
        <div class="otp-section">
          <div class="otp-label">Your One-Time Password</div>
          <div class="otp-code">
            ${otp.split('').map(d => `<div class="otp-digit">${d}</div>`).join('')}
          </div>
          <div class="otp-expiry">This code expires in <strong>10 minutes</strong></div>
        </div>
        <div class="warning">
          <div class="warning-icon">🔒</div>
          <div class="warning-text"><strong>Never share this code</strong> with anyone. MishraCare staff will never ask for your OTP. If you did not request this, please ignore this email.</div>
        </div>
        <div class="divider"></div>
        <div class="message" style="margin-bottom:0">Having trouble? Contact your system administrator.</div>
      </div>
      <div class="footer">
        <div class="footer-brand">MishraCare Pharmacy ERP</div>
        <div class="footer-text">This is an automated message — please do not reply.<br/>© ${new Date().getFullYear()} MishraCare. All rights reserved.</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, otp, name } = await req.json();

    if (!email || !otp) {
      return new Response(
        JSON.stringify({ error: 'email and otp are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = buildOTPEmailHTML(otp, name || 'User');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'MishraCare <onboarding@resend.dev>',
        to: [email],
        subject: `${otp} is your MishraCare login code`,
        html,
      }),
    });

    const resData = await res.json();

    if (!res.ok) {
      console.error('Resend error:', resData);
      return new Response(
        JSON.stringify({ error: resData.message || 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: resData.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
