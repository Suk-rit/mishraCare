import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function buildWelcomeHTML(
  name: string,
  role: string,
  email: string,
  password: string,
  storeName?: string,
): string {
  const roleLabel = role === 'admin' ? 'Area Admin' : 'Store Manager';
  const roleColor = role === 'admin' ? '#7c3aed' : '#0288D1';
  const storeNote = storeName
    ? `<p style="font-size:14px;color:#64748b;margin:0 0 6px">Store: <strong style="color:#1a1a2e">${storeName}</strong></p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Welcome to JanSwasthya</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',Arial,sans-serif;background:#f0f4f8;padding:40px 20px}
    .wrapper{max-width:560px;margin:0 auto}
    .card{background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 40px rgba(0,0,0,.08)}
    .header{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);padding:40px;text-align:center;position:relative;overflow:hidden}
    .header::before{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;background:rgba(34,197,94,.12);border-radius:50%}
    .header::after{content:'';position:absolute;bottom:-40px;left:-40px;width:160px;height:160px;background:rgba(34,197,94,.08);border-radius:50%}
    .logo-wrap{position:relative;z-index:1}
    .logo-icon{width:64px;height:64px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:18px;display:inline-flex;align-items:center;justify-content:center;font-size:32px;margin-bottom:14px}
    .logo-text{color:#fff;font-size:24px;font-weight:800;letter-spacing:-.5px}
    .logo-text span{color:#86efac}
    .header-sub{color:rgba(255,255,255,.55);font-size:12px;margin-top:5px;letter-spacing:.8px;text-transform:uppercase}
    .body{padding:40px}
    .welcome-badge{display:inline-block;padding:5px 16px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-bottom:20px}
    .greeting{font-size:22px;font-weight:800;color:#1a1a2e;margin-bottom:10px;line-height:1.3}
    .message{font-size:14px;color:#64748b;line-height:1.8;margin-bottom:28px}
    .creds-box{background:linear-gradient(135deg,#f8fafc,#f1f5f9);border:2px solid #e2e8f0;border-radius:16px;padding:24px;margin-bottom:28px}
    .creds-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#94a3b8;margin-bottom:18px}
    .cred-row{display:flex;align-items:center;gap:14px;padding:12px 14px;background:#fff;border-radius:10px;margin-bottom:10px;border:1px solid #e2e8f0}
    .cred-row:last-child{margin-bottom:0}
    .cred-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
    .cred-label{font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
    .cred-value{font-size:15px;font-weight:700;color:#1a1a2e;word-break:break-all}
    .notice{display:flex;gap:12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px;margin-bottom:28px}
    .notice-icon{font-size:20px;flex-shrink:0;margin-top:1px}
    .notice-text{font-size:13px;color:#92400e;line-height:1.7}
    .divider{height:1px;background:#f1f5f9;margin:4px 0 28px}
    .footer{background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #f1f5f9}
    .footer-brand{font-size:13px;font-weight:700;color:#1a1a2e;margin-bottom:6px}
    .footer-text{font-size:12px;color:#94a3b8;line-height:1.8}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="logo-wrap">
          <div class="logo-icon">🏥</div>
          <div class="logo-text">Jan<span>Swasthya</span></div>
          <div class="header-sub">Pharmacy ERP — Welcome</div>
        </div>
      </div>
      <div class="body">
        <div class="welcome-badge" style="background:${roleColor}18;color:${roleColor}">
          ${roleLabel}
        </div>
        <div class="greeting">Welcome aboard, ${name}! 🎉</div>
        <div class="message">
          You have been added to the <strong>JanSwasthya Pharmacy ERP</strong> as a <strong>${roleLabel}</strong>.
          Your account is ready — use the credentials below to log in for the first time.
          ${storeNote}
        </div>

        <div class="creds-box">
          <div class="creds-title">🔐 Your Login Credentials</div>
          <div class="cred-row">
            <div class="cred-icon" style="background:#EFF6FF">✉️</div>
            <div>
              <div class="cred-label">Email / Login ID</div>
              <div class="cred-value">${email}</div>
            </div>
          </div>
          <div class="cred-row">
            <div class="cred-icon" style="background:#F0FDF4">🔑</div>
            <div>
              <div class="cred-label">Password</div>
              <div class="cred-value">${password}</div>
            </div>
          </div>
        </div>

        <div class="notice">
          <div class="notice-icon">⚠️</div>
          <div class="notice-text">
            <strong>Important:</strong> Please keep this password confidential.
            We recommend noting it somewhere safe. Do not share your credentials with anyone.
            If you face any issues logging in, contact your system administrator.
          </div>
        </div>

        <div class="divider"></div>
        <div class="message" style="margin-bottom:0;font-size:13px">
          Need help? Reach out to your Devta administrator. We're glad to have you on the team. 🌱
        </div>
      </div>
      <div class="footer">
        <div class="footer-brand">JanSwasthya Pharmacy ERP</div>
        <div class="footer-text">
          This is an automated onboarding message — please do not reply.<br/>
          © ${new Date().getFullYear()} JanSwasthya. All rights reserved.
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, password, name, role, store_name } = await req.json();

    if (!email || !password || !name || !role) {
      return new Response(
        JSON.stringify({ error: 'email, password, name and role are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const roleLabel = role === 'admin' ? 'Area Admin' : 'Store Manager';
    const html = buildWelcomeHTML(name, role, email, password, store_name);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'JanSwasthya <onboarding@resend.dev>',
        to: [email],
        subject: `Welcome to JanSwasthya — Your ${roleLabel} account is ready`,
        html,
      }),
    });

    const resData = await res.json();

    if (!res.ok) {
      console.error('Resend error:', resData);
      return new Response(
        JSON.stringify({ error: resData.message || 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: resData.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
