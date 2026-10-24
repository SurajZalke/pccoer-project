/**
 * WhatsApp Messaging Service — PCCOER Education Platform
 *
 * Uses Twilio WhatsApp Business API.
 * Set these in your .env file:
 *
 *   VITE_TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
 *   VITE_TWILIO_AUTH_TOKEN=your_auth_token
 *   VITE_TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   (Twilio sandbox number)
 *
 * Group numbers are stored in Firebase under: whatsappGroups/{hostUid}/
 * so each host can manage their own groups from the dashboard.
 *
 * NOTE: WhatsApp Business API (Twilio) cannot send PDF files directly from
 * a browser. Instead, this service sends a formatted text report with all
 * score details and a shareable quiz link.
 */

import { getDatabase, ref, get, set, push, remove } from 'firebase/database';
import { app } from '@/lib/firebaseConfig';

export interface PlayerScore {
  name: string;
  mobile?: string;
  rollNo?: string;
  score: number;
  totalMarks: number;
  correct: number;
  total: number;
  accuracy: number;
  percentile: number;
  rank: number;
  totalPlayers?: number;
}

export interface GameSummary {
  quizTitle: string;
  quizId?: string;
  hostName: string;
  totalPlayers: number;
  averageScore: number;
  topPlayer: string;
  date: string;
  players: PlayerScore[];
}

export interface WhatsAppGroup {
  id: string;
  name: string;
  number: string; // +91XXXXXXXXXX
  description?: string;
}

// ── Twilio credentials from env ───────────────────────────────────────────────
const ACCOUNT_SID = import.meta.env.VITE_TWILIO_ACCOUNT_SID  || '';
const AUTH_TOKEN  = import.meta.env.VITE_TWILIO_AUTH_TOKEN   || '';
const FROM_NUMBER = import.meta.env.VITE_TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

const TWILIO_URL = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;

// ── Core send ─────────────────────────────────────────────────────────────────
export async function sendWhatsAppMessage(
  to: string,
  body: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  if (!ACCOUNT_SID || !AUTH_TOKEN) {
    console.warn('[WhatsApp] Twilio not configured. Add VITE_TWILIO_ACCOUNT_SID and VITE_TWILIO_AUTH_TOKEN to .env');
    return { success: false, error: 'Twilio not configured' };
  }

  const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  try {
    const params = new URLSearchParams();
    params.append('To',   toNumber);
    params.append('From', FROM_NUMBER);
    params.append('Body', body);

    const response = await fetch(TWILIO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`),
      },
      body: params.toString(),
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      return { success: true, sid: data.sid };
    } else {
      return { success: false, error: data.message || `HTTP ${response.status}` };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Format helpers ────────────────────────────────────────────────────────────
function gradeEmoji(percentile: number): string {
  if (percentile >= 90) return '🏆';
  if (percentile >= 75) return '⭐';
  if (percentile >= 50) return '✅';
  return '📝';
}

function rankSuffix(rank: number, total: number): string {
  const s = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;
  return `${s} out of ${total}`;
}

// ── Individual student score report message ───────────────────────────────────
export function buildStudentReportMessage(player: PlayerScore, quizTitle: string, quizLink?: string): string {
  const emoji = gradeEmoji(player.percentile);
  const totalPl = player.totalPlayers || player.rank;
  const lines = [
    `${emoji} *Quiz Result — ${quizTitle}*`,
    ``,
    `👤 Student: *${player.name}*`,
    player.rollNo ? `📋 Roll No: ${player.rollNo}` : '',
    ``,
    `📊 *Your Score*`,
    `• Score: *${player.score} / ${player.totalMarks}*`,
    `• Correct: ${player.correct} / ${player.total} questions`,
    `• Accuracy: *${player.accuracy.toFixed(1)}%*`,
    `• Percentile: *${player.percentile.toFixed(1)}%*`,
    `• Rank: *${rankSuffix(player.rank, totalPl)}*`,
    ``,
  ];
  if (quizLink) {
    lines.push(`▶️ Play this quiz again: ${quizLink}`);
    lines.push(``);
  }
  lines.push(`🎓 *PCCOER Education Platform*`);
  lines.push(`Keep learning, keep growing! 💪`);
  return lines.filter(l => l !== undefined).join('\n');
}

// ── Group game summary report ─────────────────────────────────────────────────
export function buildGroupSummaryMessage(summary: GameSummary): string {
  const topThree = summary.players
    .slice(0, 3)
    .map((p, i) => {
      const medals = ['🥇', '🥈', '🥉'];
      const acc = typeof p.accuracy === 'number' ? `${p.accuracy.toFixed(0)}%` : 'N/A';
      return `${medals[i]} ${p.name} — ${p.score} pts | Accuracy: ${acc}`;
    })
    .join('\n');

  const link = summary.quizId
    ? `${window.location.origin}/play-quiz/${summary.quizId}`
    : '';

  const lines = [
    `🎯 *Game Complete — ${summary.quizTitle}*`,
    `📅 ${summary.date}`,
    ``,
    `📈 *Stats*`,
    `• Total Players: *${summary.totalPlayers}*`,
    `• Average Score: *${summary.averageScore.toFixed(1)}*`,
    ``,
    `🏆 *Top 3 Students*`,
    topThree || 'No players',
    ``,
  ];

  if (link) {
    lines.push(`▶️ Play this quiz again: ${link}`);
    lines.push(``);
  }

  lines.push(`🎓 *PCCOER Education Platform*`);
  return lines.join('\n');
}

// ── Send to one student ───────────────────────────────────────────────────────
export async function sendScoreToStudent(
  mobile: string,
  player: PlayerScore,
  quizTitle: string,
  quizLink?: string
): Promise<{ success: boolean; error?: string }> {
  const message = buildStudentReportMessage(player, quizTitle, quizLink);
  return sendWhatsAppMessage(mobile, message);
}

// ── Send to all students with mobile numbers ──────────────────────────────────
export async function sendScoresToAllStudents(
  players: PlayerScore[],
  quizTitle: string,
  quizLink?: string,
  onProgress?: (done: number, total: number) => void
): Promise<{ sent: number; failed: number; skipped: number }> {
  let sent = 0, failed = 0, skipped = 0;
  const withMobile = players.filter(p => p.mobile && p.mobile.replace(/\D/g, '').length >= 10);
  skipped = players.length - withMobile.length;

  for (let i = 0; i < withMobile.length; i++) {
    const p = withMobile[i];
    const result = await sendScoreToStudent(p.mobile!, p, quizTitle, quizLink);
    if (result.success) sent++; else failed++;
    if (onProgress) onProgress(i + 1, withMobile.length);
    await new Promise(r => setTimeout(r, 350)); // rate limit buffer
  }
  return { sent, failed, skipped };
}

// ── Send group summary to one number ─────────────────────────────────────────
export async function sendGroupSummaryToNumber(
  number: string,
  summary: GameSummary
): Promise<{ success: boolean; error?: string }> {
  const message = buildGroupSummaryMessage(summary);
  return sendWhatsAppMessage(number, message);
}

// ── Send to all saved groups ──────────────────────────────────────────────────
// NOTE: Twilio WhatsApp Sandbox only allows messaging numbers that have
// individually opted in by sending "join <code>" to the sandbox number.
// Sending to group admin numbers does NOT broadcast to the whole group.
// This function is intentionally disabled to prevent unexpected messages.
export async function sendGroupSummaryToAll(
  _summary: GameSummary,
  _hostUid: string
): Promise<{ sent: number; failed: number }> {
  // Groups disabled — Twilio sandbox cannot send to WhatsApp groups.
  // To enable, upgrade to a Twilio WhatsApp Business-approved number and
  // ensure all recipients have opted in.
  return { sent: 0, failed: 0 };
}

// ── Firebase: WhatsApp group management ──────────────────────────────────────
export async function getWhatsAppGroups(hostUid: string): Promise<WhatsAppGroup[]> {
  const db = getDatabase(app);
  const snap = await get(ref(db, `whatsappGroups/${hostUid}`));
  if (!snap.exists()) return [];
  const data = snap.val();
  return Object.entries(data).map(([id, val]: [string, any]) => ({
    id,
    name: val.name || '',
    number: val.number || '',
    description: val.description || '',
  }));
}

export async function addWhatsAppGroup(
  hostUid: string,
  group: Omit<WhatsAppGroup, 'id'>
): Promise<string> {
  const db = getDatabase(app);
  const newRef = push(ref(db, `whatsappGroups/${hostUid}`));
  await set(newRef, group);
  return newRef.key!;
}

export async function deleteWhatsAppGroup(hostUid: string, groupId: string): Promise<void> {
  const db = getDatabase(app);
  await remove(ref(db, `whatsappGroups/${hostUid}/${groupId}`));
}

// ── Send direct message to any number ────────────────────────────────────────
export async function sendDirectMessage(
  to: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  return sendWhatsAppMessage(to, message);
}

// ── Configured check ──────────────────────────────────────────────────────────
export function isWhatsAppConfigured(): boolean {
  return Boolean(ACCOUNT_SID && AUTH_TOKEN);
}
