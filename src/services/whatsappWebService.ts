/**
 * src/services/whatsappWebService.ts
 * Frontend service that talks to the whatsapp-web.js backend on Render.
 *
 * URL resolution order:
 *  1. ?WA_BACKEND_URL=... query param (overrides everything — useful for testing)
 *  2. VITE_WA_BACKEND_URL env var (set in .env for local dev)
 *  3. Auto-detect:
 *     - On Vercel/production (non-local hostname) → use '/wa-backend' proxy
 *     - On localhost/LAN → use http://localhost:3001
 */

import { getAuth } from 'firebase/auth';

const normalizeUrl = (raw: string): string => {
  const url = raw.trim();
  if (!url) return '';
  // Relative path (e.g. /wa-backend) — use as-is, no protocol needed
  if (url.startsWith('/')) return url.replace(/\/+$/g, '');
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`.replace(/\/+$/g, '');
  }
  return url.replace(/\/+$/g, '');
};

// ── Resolve backend URL ───────────────────────────────────────────────────────
const envBackendUrl = normalizeUrl(
  import.meta.env.VITE_WA_BACKEND_URL ||
  import.meta.env.VITE_HA_BACKEND_URL ||
  ''
);

const queryBackendUrl = typeof window !== 'undefined'
  ? normalizeUrl(new URLSearchParams(window.location.search).get('WA_BACKEND_URL') || '')
  : '';

const localDevUrl = 'http://localhost:3001';

function isLocalAddress(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' ||
    /^10\./.test(hostname) || /^192\.168\./.test(hostname) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);
}

// Auto-detect: on Vercel/production (non-local hostname) use the proxy path '/wa-backend'
// On localhost/LAN: use localhost:3001 directly
function resolveDefaultUrl(): string {
  if (typeof window === 'undefined') return localDevUrl;
  const hostname = window.location.hostname;
  if (isLocalAddress(hostname)) return localDevUrl;
  // Production (Vercel, or any public domain) — use same-origin proxy
  return '/wa-backend';
}

// Priority: query param > .env var > auto-detect
const defaultBackendUrl = envBackendUrl || resolveDefaultUrl();
export let WA_BACKEND_URL: string = queryBackendUrl || defaultBackendUrl;

export const setWABackendUrl = (url: string) => {
  WA_BACKEND_URL = normalizeUrl(url) || localDevUrl;
};

export function isBackendConfigured(): boolean {
  if (WA_BACKEND_URL.startsWith('/')) return true;             // proxy path — always configured
  if (!WA_BACKEND_URL || WA_BACKEND_URL.includes('YOUR-RAILWAY-APP')) return false;
  // Explicit env var set → trust it regardless of hostname
  if (envBackendUrl) return true;
  // localhost URL only valid when page is also on a local address
  if (WA_BACKEND_URL === localDevUrl && typeof window !== 'undefined') {
    return isLocalAddress(window.location.hostname);
  }
  return true;
}

// ── Auth headers ──────────────────────────────────────────────────────────────
async function getIdToken(): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Not logged in');
  return user.getIdToken();
}

async function authHeaders(extra: Record<string, string> = {}): Promise<HeadersInit> {
  const token = await getIdToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...extra,
  };
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
async function apiFetch(path: string, init: RequestInit): Promise<Response> {
  const url = `${WA_BACKEND_URL}${path}`;
  const res = await fetch(url, init);
  return res;
}

async function apiPost<T = any>(path: string, body: object): Promise<T> {
  const res = await apiFetch(path, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

async function apiGet<T = any>(path: string): Promise<T> {
  const res = await apiFetch(path, {
    method: 'GET',
    headers: await authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

async function apiDelete<T = any>(path: string): Promise<T> {
  const res = await apiFetch(path, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

async function apiPostForm<T = any>(path: string, formData: FormData): Promise<T> {
  const token = await getIdToken();
  const res = await apiFetch(path, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

// ── Status ────────────────────────────────────────────────────────────────────

export interface WAStatus {
  status: 'initializing' | 'qr_pending' | 'connected' | 'disconnected' | 'auth_failure';
  qr: string | null;
  qrGeneratedAt: number | null;
  info: { name: string; number: string } | null;
  initError: string | null;
  stats: { sent: number; failed: number; studentsReached: number };
}

export async function getWAStatus(): Promise<WAStatus> {
  return apiGet('/api/whatsapp/status');
}

export async function getWADebug(): Promise<Record<string, unknown>> {
  return apiGet('/api/whatsapp/debug');
}

export async function reconnectWA(): Promise<{ success: boolean; message: string }> {
  return apiPost('/api/whatsapp/reconnect', {});
}

export async function disconnectWA(): Promise<{ success: boolean; message: string }> {
  return apiPost('/api/whatsapp/disconnect', {});
}

export async function deleteWASession(): Promise<{ success: boolean; message: string }> {
  return apiDelete('/api/whatsapp/session');
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function sendDirectMessage(phone: string, message: string) {
  return apiPost('/api/whatsapp/send', { phone, message });
}

export async function broadcastMessage(phones: string[], message: string) {
  return apiPost('/api/whatsapp/broadcast', { phones, message });
}

// ── Results ───────────────────────────────────────────────────────────────────

export interface ResultPayload {
  studentPhone?: string;
  parentPhone?: string;
  studentName: string;
  examTitle: string;
  score: number;
  totalMarks: number;
  percentage: number;
  rank: number;
  totalStudents: number;
  date?: string;
  batch?: string;
  subjects?: { name: string; obtained: number; total: number }[];
}

export async function sendResult(payload: ResultPayload) {
  return apiPost('/api/whatsapp/send-result', payload);
}

export async function sendResultsForExam(examId: string) {
  return apiPost('/api/whatsapp/send-results-exam', { examId });
}

// ── Attendance ────────────────────────────────────────────────────────────────

export async function sendAbsenceAlert(
  studentName: string, parentPhone: string, date?: string, batch?: string
) {
  return apiPost('/api/whatsapp/attendance-alert', { studentName, parentPhone, date, batch });
}

export async function processAttendance(
  records: { studentId: string; status: string; date: string }[]
) {
  return apiPost('/api/whatsapp/process-attendance', { records });
}

export async function sendAttendanceReport(studentId: string, month: number, year: number) {
  return apiPost('/api/whatsapp/attendance-report', { studentId, month, year });
}

// ── Fees ──────────────────────────────────────────────────────────────────────

export async function sendFeeReminder(params: {
  studentName: string;
  parentPhone?: string;
  studentPhone?: string;
  amountDue: string | number;
  dueDate: string;
  batch?: string;
}) {
  return apiPost('/api/whatsapp/fee-reminder', params);
}

export async function runFeeReminders() {
  return apiPost('/api/whatsapp/run-fee-reminders', {});
}

// ── Homework / Notes ──────────────────────────────────────────────────────────

export async function sendHomework(
  file: File | null,
  batch: string,
  subject: string,
  caption: string,
  type: 'homework' | 'notes' = 'homework'
) {
  const form = new FormData();
  if (file) form.append('file', file);
  form.append('batch', batch);
  form.append('subject', subject);
  form.append('caption', caption);
  form.append('type', type);
  return apiPostForm('/api/whatsapp/send-homework', form);
}

// ── Files ─────────────────────────────────────────────────────────────────────

export async function sendFile(phone: string, file: File, caption = '') {
  const form = new FormData();
  form.append('file', file);
  form.append('phone', phone);
  form.append('caption', caption);
  return apiPostForm('/api/whatsapp/send-file', form);
}

export async function sendFileBulk(phones: string[], file: File, caption = '') {
  const form = new FormData();
  form.append('file', file);
  form.append('phones', JSON.stringify(phones));
  form.append('caption', caption);
  return apiPostForm('/api/whatsapp/send-file-bulk', form);
}

// ── Groups ────────────────────────────────────────────────────────────────────

export async function listGroups(): Promise<{
  groups: { id: string; name: string; participantCount: number }[]
}> {
  return apiGet('/api/whatsapp/groups');
}

export async function sendGroupMessage(groupId: string, message: string) {
  return apiPost('/api/whatsapp/group-message', { groupId, message });
}

export async function sendGroupFile(groupId: string, file: File, caption = '') {
  const form = new FormData();
  form.append('file', file);
  form.append('groupId', groupId);
  form.append('caption', caption);
  return apiPostForm('/api/whatsapp/group-file', form);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getStats(): Promise<{
  sent: number; failed: number; studentsReached: number
}> {
  return apiGet('/api/whatsapp/stats');
}

// ── Class broadcast ───────────────────────────────────────────────────────────

/** Send a message to all students in a class (by examName/classId) */
export async function sendClassBroadcast(params: {
  className: string;
  message: string;
  includeParents?: boolean;
}) {
  return apiPost('/api/whatsapp/class-broadcast', params);
}

// ── Quiz results auto-send ────────────────────────────────────────────────────

export interface QuizResultPayload {
  gameId: string;
  quizId?: string;     // Used by backend to fetch quiz questions for the answer sheet
  quizTitle: string;
  classId?: string;    // optional — filter players by class
  players: {
    nickname: string;
    rollNo?: string;
    score: number;
    totalMarks: number;
    correct: number;
    total: number;
    accuracy: number;
    percentile: number;
    rank: number;
    totalPlayers: number;
    phone?: string;
    parentPhone?: string;
    /** Per-question answers — enables answer sheet in the PDF */
    answers?: {
      questionId?: string;
      selectedOption?: string;
      optionId?: string;
      correct: boolean;
      timeToAnswer?: number;
    }[];
  }[];
}

/** Auto-send quiz scorecards to all players who have phone numbers */
export async function sendQuizResultsToAll(payload: QuizResultPayload) {
  return apiPost('/api/whatsapp/quiz-results', payload);
}

// ── OMR Results ──────────────────────────────────────────────────────────────

export interface OMRResultPayload {
  studentPhone?: string;
  parentPhone?: string;
  studentName: string;
  examTitle: string;
  score: number;
  totalMarks: number;
  percentage: number;
  rank?: number;
  totalStudents?: number;
  date?: string;
  batch?: string;
  answerKey?: string[];
  detectedAnswers?: string[];
}

export async function sendOMRResult(payload: OMRResultPayload) {
  return apiPost('/api/whatsapp/omr-send-result', payload);
}

export interface OMRGroupPayload {
  groupId: string;
  examTitle: string;
  date?: string;
  results: { studentName: string; score: number; totalMarks: number; percentage: number }[];
}

export async function sendOMRGroupSummary(payload: OMRGroupPayload) {
  return apiPost('/api/whatsapp/omr-send-group', payload);
}


