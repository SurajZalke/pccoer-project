/**
 * lib/firebase.js
 * Firebase Admin SDK — Firestore + Realtime Database + Storage.
 *
 * Credential resolution order:
 *  1. FIREBASE_SERVICE_ACCOUNT_JSON  — full JSON string (most reliable on Render)
 *  2. Individual env vars            — FIREBASE_PRIVATE_KEY + FIREBASE_CLIENT_EMAIL
 *  3. FIREBASE_SERVICE_ACCOUNT_PATH  — path to a JSON file
 *  4. Application Default Credentials (fallback — not recommended for production)
 */

'use strict';

const admin = require('firebase-admin');
const path  = require('path');

function initFirebase() {
  // Already initialized — skip
  const apps = admin.getApps ? admin.getApps() : (admin.apps || []);
  if (apps.length > 0) {
    return;
  }

  let credential;

  // ── Option 1: Full JSON string (recommended for Render) ──────────────────
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim();
      const serviceAccount = JSON.parse(raw);
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      credential = admin.credential.cert(serviceAccount);
      console.log('[Firebase] Using FIREBASE_SERVICE_ACCOUNT_JSON credentials.');
    } catch (err) {
      console.error('[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', err.message);
      throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON — check the env var value in Render dashboard');
    }
  }

  // ── Option 2: Individual env vars ────────────────────────────────────────
  else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    try {
      let privateKey = process.env.FIREBASE_PRIVATE_KEY.trim();

      // Remove surrounding quotes if present (common copy-paste artifact)
      if ((privateKey.startsWith('"') && privateKey.endsWith('"')) ||
          (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
        privateKey = privateKey.slice(1, -1);
      }

      // Unescape literal \n sequences
      privateKey = privateKey.replace(/\\n/g, '\n');

      if (!privateKey.includes('-----BEGIN')) {
        throw new Error(
          'Private key is missing -----BEGIN PRIVATE KEY----- header. ' +
          'Make sure you pasted the full private_key value from the service account JSON.'
        );
      }

      const serviceAccount = {
        type:                        'service_account',
        project_id:                  process.env.FIREBASE_PROJECT_ID,
        private_key_id:              process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key:                 privateKey,
        client_email:                process.env.FIREBASE_CLIENT_EMAIL,
        client_id:                   process.env.FIREBASE_CLIENT_ID,
        auth_uri:                    'https://accounts.google.com/o/oauth2/auth',
        token_uri:                   'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url:        process.env.FIREBASE_CLIENT_CERT_URL,
      };
      credential = admin.credential.cert(serviceAccount);
      console.log('[Firebase] Using individual env var credentials.');
    } catch (err) {
      console.error('[Firebase] Failed to build credentials from individual env vars:', err.message);
      throw err;
    }
  }

  // ── Option 3: Service account file path ──────────────────────────────────
  else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const fs = require('fs');
    const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const possiblePaths = [
      keyPath,
      path.resolve(keyPath),
      path.join(__dirname, '../', keyPath),
      path.join(__dirname, '../../', keyPath),
      path.join(process.cwd(), keyPath),
    ];

    let foundPath = null;
    for (const tryPath of possiblePaths) {
      if (fs.existsSync(tryPath)) { foundPath = tryPath; break; }
    }

    if (!foundPath) {
      console.error('[Firebase] Service account file not found. Tried:');
      possiblePaths.forEach(p => console.error('  -', p));
      throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH file not found: ' + keyPath);
    }

    const serviceAccount = JSON.parse(fs.readFileSync(foundPath, 'utf8'));
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    credential = admin.credential.cert(serviceAccount);
    console.log('[Firebase] Using service account file:', foundPath);
  }

  // ── Option 4: Application Default Credentials (fallback) ─────────────────
  else {
    console.warn(
      '[Firebase] ⚠️  No Firebase credentials found in env vars!\n' +
      '  Set FIREBASE_SERVICE_ACCOUNT_JSON in your Render dashboard.\n' +
      '  Falling back to Application Default Credentials (will likely fail on Render).'
    );
    try {
      credential = admin.credential.applicationDefault();
      console.log('[Firebase] Using Application Default Credentials.');
    } catch (err) {
      console.error('[Firebase] All credential methods failed:', err.message);
      throw err;
    }
  }

  admin.initializeApp({
    credential,
    databaseURL:   process.env.FIREBASE_DATABASE_URL,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });

  console.log('[Firebase] Admin SDK initialized successfully.');

  if (process.env.FIREBASE_DATABASE_URL) {
    // Verify RTDB is reachable by getting the instance (doesn't make a network call)
    admin.database();
    console.log('[Firebase] Realtime Database ready.');
  } else {
    console.warn('[Firebase] ⚠️  FIREBASE_DATABASE_URL not set — Realtime Database unavailable.');
  }
}

initFirebase();

module.exports = {
  get db()      { return admin.firestore(); },
  get storage() { return admin.storage(); },
  get rtdb()    {
    if (!process.env.FIREBASE_DATABASE_URL) {
      throw new Error('[Firebase] FIREBASE_DATABASE_URL is not set — cannot use Realtime Database.');
    }
    return admin.database();
  },
  admin,
};
