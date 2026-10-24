/**
 * src/lib/apiBase.ts
 *
 * Single source of truth for the backend base URL used by the contact form,
 * forgot/reset password, and avatar upload requests.
 *
 * Previously these pages each hardcoded `http://localhost:3001` as the
 * default and only used a real URL when `VITE_API_BASE_URL` was set at
 * build time — which it never was, so in production every request from a
 * real visitor's browser silently tried (and failed) to reach their own
 * machine on port 3001. That's why contact-form emails and password-reset
 * emails were never actually being sent.
 *
 * This mirrors the working pattern already used by
 * `services/whatsappWebService.ts`: on localhost, use localhost:3001; in
 * production, use the same `/wa-backend` Netlify proxy (already wired to
 * the Render backend in netlify.toml) unless a specific override is set.
 */

const isLocalAddress = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '::1' ||
  /^10\./.test(hostname) ||
  /^192\.168\./.test(hostname) ||
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);

const isLocalHost = typeof window !== 'undefined' && isLocalAddress(window.location.hostname);

export function getApiBaseUrl(): string {
  const override = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (override) return override.replace(/\/+$/g, '');

  if (isLocalHost) return 'http://localhost:3001';

  // Same backend server as WhatsApp — reuse the already-proxied path so no
  // CORS setup or hardcoded Render URL is needed here either.
  return '/wa-backend';
}
