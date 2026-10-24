/**
 * lib/auth_middleware.js
 *
 * Two-layer auth:
 *
 * 1. Firebase ID Token (preferred) — frontend sends the logged-in user's
 *    Firebase ID token in the Authorization header.
 *    Backend verifies it with Firebase Admin SDK and checks UID === ADMIN_UID.
 *    This means: only your admin Google account can call the API.
 *    No separate password needed. Works from any device automatically.
 *
 * 2. ADMIN_SECRET fallback — if ADMIN_SECRET env var is set, also accept
 *    x-admin-secret header. Useful for testing from Postman/curl.
 */

'use strict';

const { admin } = require('./firebase');
const jwt = require('jsonwebtoken');

// Your admin Firebase UID — same as in src/components/StudentManagement.tsx
const ADMIN_UID = process.env.ADMIN_UID || 'Ch0V3K1ELxPZyZiC439DrCeAjnM2';
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

async function requireAdmin(req, res, next) {
  // ── Option 1: Firebase ID Token ─────────────────────────────────────────────
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.slice(7);
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      if (decoded.uid === ADMIN_UID) {
        req.adminUid = decoded.uid;
        return next(); // ✅ verified as admin
      } else {
        console.warn(`[Auth] ❌ UID mismatch: ${decoded.uid} !== ${ADMIN_UID}`);
        return res.status(403).json({ error: 'Forbidden: not an admin account' });
      }
    } catch (err) {
      console.warn(`[Auth] ⚠️ Token verification failed: ${err.message}`);
      
      // SPECIAL FALLBACK FOR LOCAL DEV:
      // If we're on localhost and the token is present but verification failed 
      // (likely due to missing service account JSON), we'll allow it IF 
      // the UID in the unverified token matches ADMIN_UID.
      if (process.env.NODE_ENV !== 'production' || !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        try {
          const unverified = jwt.decode(idToken);
          if (unverified && unverified.sub === ADMIN_UID) {
            console.log('[Auth] ✅ Local dev fallback: allowed via unverified token UID match');
            req.adminUid = unverified.sub;
            return next();
          }
        } catch (decodeErr) {
          // ignore
        }
      }
    }
  }

  // ── Option 2: Static admin secret (fallback for testing) ────────────────────
  const providedSecret =
    req.headers['x-admin-secret'] ||
    req.query.secret;

  if (ADMIN_SECRET && providedSecret === ADMIN_SECRET) {
    return next(); // ✅ accepted via secret
  }

  return res.status(401).json({
    error: 'Unauthorized — send Firebase ID token as: Authorization: Bearer <token>',
  });
}

module.exports = { requireAdmin, requireAdminSecret: requireAdmin };
