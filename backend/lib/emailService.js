'use strict';

/**
 * lib/emailService.js
 *
 * Uses Resend (https://resend.com) instead of nodemailer/Gmail SMTP.
 * Render free tier blocks outbound SMTP ports (465/587), so nodemailer
 * always timed out. Resend uses HTTPS (port 443) which works everywhere.
 *
 * Setup:
 *  1. Sign up at https://resend.com (free — 3,000 emails/month)
 *  2. Get your API key from the dashboard
 *  3. Add RESEND_API_KEY to Render environment variables
 *  4. Add and verify a sending domain in Resend, OR use the default
 *     onboarding@resend.dev address for testing (only sends to your
 *     own verified email until you add a domain)
 */

const { Resend } = require('resend');
const crypto     = require('crypto');

// Lazily construct the Resend client. Constructing it eagerly throws when
// RESEND_API_KEY is absent, which crashed the entire server at require-time
// (this module is imported by routes/auth.js on every boot).
let resend = null;
function getResend() {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set — add it to your environment variables.');
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

// Fallback "from" address — works without a verified domain on Resend free plan..
// Change to "Mr. Suraj Zalke <noreply@yourdomain.com>" once you verify a domain
const FROM_ADDRESS = process.env.EMAIL_FROM || 'Mr. Suraj Zalke <onboarding@resend.dev>';
const OWNER_EMAIL  = process.env.OWNER_EMAIL || process.env.EMAIL_USER || 'surajzalke724@gmail.com';

if (!process.env.RESEND_API_KEY) {
  console.error('[Email] ⚠️  RESEND_API_KEY is not set — emails will fail. Add it to Render env vars.');
} else {
  console.log('[Email] ✅ Resend API key loaded — ready to send emails.');
}

// ── Generate reset token ──────────────────────────────────────────────────────
const generateResetToken = () => crypto.randomBytes(32).toString('hex');

// ── Password reset email ──────────────────────────────────────────────────────
const sendPasswordResetEmail = async (email, resetToken, userId) => {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&userId=${userId}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);padding:20px}
    .wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.1)}
    .hdr{background:linear-gradient(135deg,#667eea,#764ba2);padding:40px 20px;text-align:center;color:#fff}
    .hdr h1{font-size:28px;font-weight:700;margin-bottom:8px}
    .body{padding:40px 30px}
    .btn{display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:14px 40px;border-radius:6px;text-decoration:none;font-weight:600;margin:20px 0}
    .link-box{word-break:break-all;background:#f0f0f0;padding:12px;border-radius:4px;font-size:12px;color:#666;font-family:monospace;margin:12px 0}
    .warn{background:#fff3cd;border:1px solid #ffc107;padding:12px;border-radius:4px;font-size:14px;color:#856404;margin:20px 0}
    .ftr{background:#f8f9fa;padding:20px;text-align:center;font-size:12px;color:#666;border-top:1px solid #e0e0e0}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr"><h1>🔐 Password Reset</h1><p>Mr. Suraj Zalke — Dhole Sir Coaching Classes</p></div>
    <div class="body">
      <p>Hi there,</p>
      <p style="margin:12px 0;line-height:1.6">We received a request to reset your password. If you didn't make this request, ignore this email.</p>
      <a href="${resetLink}" class="btn">🔑 Reset Password</a>
      <p style="font-size:12px;color:#666">Button not working? Copy this link:</p>
      <div class="link-box">${resetLink}</div>
      <div class="warn">⏰ <strong>Important:</strong> This link expires in 24 hours.</div>
    </div>
    <div class="ftr"><p>© 2024 PCCOER Education Platform. Do not reply to this email.</p></div>
  </div>
</body>
</html>`;

  try {
    const { data, error } = await getResend().emails.send({
      from:    FROM_ADDRESS,
      to:      [email],
      subject: '🔐 Password Reset — Mr. Suraj Zalke | Dhole Sir Coaching',
      html,
    });

    if (error) {
      console.error('[Email] ❌ Password reset email error:', error);
      return { success: false, error: error.message };
    }

    console.log('[Email] ✅ Password reset email sent to:', email, 'id:', data.id);
    return { success: true, messageId: data.id };
  } catch (err) {
    console.error('[Email] ❌ Password reset email exception:', err.message);
    return { success: false, error: err.message };
  }
};

// ── Contact form → developer ──────────────────────────────────────────────────
const sendContactEmail = async (name, email, subject, message, phone = '') => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',sans-serif;background:#f5f5f5;padding:20px}
    .wrap{max-width:700px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.1)}
    .hdr{background:linear-gradient(135deg,#667eea,#764ba2);padding:30px 20px;text-align:center;color:#fff}
    .body{padding:30px}
    .field{margin-bottom:18px}
    .lbl{font-weight:600;color:#333;margin-bottom:4px;display:block}
    .val{color:#666;padding:10px;background:#f8f9fa;border-radius:4px;border-left:3px solid #667eea}
    .msg{background:#f0f7ff;padding:15px;border-radius:6px;border-left:4px solid #667eea}
    .ftr{background:#f8f9fa;padding:20px;text-align:center;font-size:12px;color:#666;border-top:1px solid #e0e0e0}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr"><h2>📬 New Contact Form Submission</h2></div>
    <div class="body">
      <div class="field"><span class="lbl">👤 Name:</span><div class="val">${name}</div></div>
      <div class="field"><span class="lbl">📧 Email:</span><div class="val"><a href="mailto:${email}" style="color:#667eea">${email}</a></div></div>
      ${phone ? `<div class="field"><span class="lbl">📱 Phone:</span><div class="val">${phone}</div></div>` : ''}
      <div class="field"><span class="lbl">📝 Subject:</span><div class="val">${subject}</div></div>
      <div class="field"><span class="lbl">💬 Message:</span><div class="msg">${message.replace(/\n/g, '<br>')}</div></div>
      <div style="background:#fff3cd;padding:10px;border-radius:4px;margin-top:16px;font-size:12px;color:#856404">
        <strong>⏰ Sent:</strong> ${new Date().toLocaleString()}
      </div>
    </div>
    <div class="ftr"><p>Reply to the user's email address. Do not reply here.</p></div>
  </div>
</body>
</html>`;

  try {
    const { data, error } = await getResend().emails.send({
      from:     FROM_ADDRESS,
      to:       [OWNER_EMAIL],
      replyTo:  email,
      subject:  `📬 New Contact: ${subject}`,
      html,
    });

    if (error) {
      console.error('[Email] ❌ Contact email error:', error);
      return { success: false, error: error.message };
    }

    console.log('[Email] ✅ Contact email sent to owner. id:', data.id);
    return { success: true, messageId: data.id };
  } catch (err) {
    console.error('[Email] ❌ Contact email exception:', err.message);
    return { success: false, error: err.message };
  }
};

// ── Confirmation email → user ─────────────────────────────────────────────────
const sendContactConfirmationEmail = async (name, email) => {
  const html = `<!DOCTYPE html>
<html>
<body style="font-family:'Segoe UI',sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);padding:20px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:40px 20px;text-align:center;color:#fff">
      <h2>✅ Message Received!</h2>
    </div>
    <div style="padding:40px 30px;line-height:1.6;color:#333">
      <p style="font-size:40px;text-align:center;margin-bottom:20px">✨</p>
      <p>Hi ${name},</p><br>
      <p>Thank you for reaching out! We've received your message and will get back to you shortly.</p>
    </div>
    <div style="background:#f8f9fa;padding:20px;text-align:center;font-size:12px;color:#666;border-top:1px solid #e0e0e0">
      <p>© 2024 PCCOER Education Platform</p>
    </div>
  </div>
</body>
</html>`;

  try {
    const { data, error } = await getResend().emails.send({
      from:    FROM_ADDRESS,
      to:      [email],
      subject: '✅ We Received Your Message',
      html,
    });

    if (error) {
      console.error('[Email] ❌ Confirmation email error:', error);
      return { success: false };
    }

    console.log('[Email] ✅ Confirmation email sent to:', email, 'id:', data.id);
    return { success: true, messageId: data.id };
  } catch (err) {
    console.error('[Email] ❌ Confirmation email exception:', err.message);
    return { success: false };
  }
};

module.exports = {
  generateResetToken,
  sendPasswordResetEmail,
  sendContactEmail,
  sendContactConfirmationEmail,
};
