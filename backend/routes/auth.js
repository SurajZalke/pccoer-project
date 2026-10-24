const express = require('express');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const { sendPasswordResetEmail, generateResetToken, sendContactEmail, sendContactConfirmationEmail } = require('../lib/emailService');

const router = express.Router();

// Store reset tokens in memory (use Redis in production)
const resetTokens = new Map();

// Forgot Password - Send reset email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(200).json({ 
        success: true, 
        message: 'If email exists, password reset link has been sent' 
      });
    }

    // Generate reset token with a fake userId for demo (in production, look up actual user)
    const resetToken = generateResetToken();
    const demoUserId = 'demo_user_' + Date.now(); // Demo purposes only
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

    // Store token
    resetTokens.set(resetToken, {
      userId: demoUserId,
      email: normalizedEmail,
      expiresAt,
    });

    // Send email and wait for result
    try {
      const emailResult = await sendPasswordResetEmail(normalizedEmail, resetToken, demoUserId);
      
      if (!emailResult.success) {
        console.error('[Auth] Email send failed:', emailResult.error);
        return res.status(500).json({ error: 'Failed to send email: ' + emailResult.error });
      }
      
      res.json({ 
        success: true, 
        message: 'Password reset email sent successfully',
        debug: { email: normalizedEmail, messageId: emailResult.messageId }
      });
    } catch (emailError) {
      console.error('[Auth] Email exception:', emailError);
      res.status(500).json({ error: 'Email service error: ' + emailError.message });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process forgot password request' });
  }
});

// Reset Password - Verify token and reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, userId, newPassword } = req.body;

    if (!token || !userId || !newPassword) {
      return res.status(400).json({ error: 'Token, userId, and newPassword are required' });
    }

    // Verify token
    const tokenData = resetTokens.get(token);

    if (!tokenData) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    if (tokenData.expiresAt < Date.now()) {
      resetTokens.delete(token);
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    if (tokenData.userId !== userId) {
      return res.status(400).json({ error: 'Token does not match user' });
    }

    // Update password in Firebase
    try {
      await admin.auth().updateUser(userId, {
        password: newPassword,
      });

      // Clear token
      resetTokens.delete(token);

      res.json({ 
        success: true, 
        message: 'Password reset successfully' 
      });
    } catch (authError) {
      console.error('Auth error:', authError);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Contact Form - Send contact email
router.post('/contact', async (req, res) => {
  try {
    const { name, email, subject, message, phone } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Name, email, subject, and message are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Send emails and wait for results
    try {
      const contactEmailResult = await sendContactEmail(name, email, subject, message, phone);
      const confirmationEmailResult = await sendContactConfirmationEmail(name, email);

      if (!contactEmailResult.success) {
        console.error('[Auth] Contact email send failed:', contactEmailResult.error);
        return res.status(500).json({ error: 'Failed to send contact email: ' + contactEmailResult.error });
      }

      res.json({ 
        success: true, 
        message: 'Thank you for contacting us. We will get back to you soon!',
        debug: { 
          developerEmail: contactEmailResult.messageId,
          confirmationEmail: confirmationEmailResult.messageId 
        }
      });
    } catch (emailError) {
      console.error('[Auth] Email exception:', emailError);
      res.status(500).json({ error: 'Email service error: ' + emailError.message });
    }
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ error: 'Failed to process contact request' });
  }
});

module.exports = router;
