/**
 * WhatsAppAdminDashboard.tsx
 * Full admin panel for the whatsapp-web.js automation system.
 * Replaces the old Twilio-based WhatsAppManager.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, Send, Users, FileText, Bell, DollarSign,
  BookOpen, RefreshCw, CheckCircle, XCircle, Loader2,
  QrCode, Wifi, WifiOff, BarChart3, Upload, ChevronDown,
  ChevronUp, Phone, AlertTriangle, Clock, Group,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  getWAStatus, reconnectWA, disconnectWA, deleteWASession,
  sendDirectMessage, broadcastMessage,
  sendResultsForExam, sendFeeReminder, runFeeReminders,
  sendHomework, sendFile, sendFileBulk, listGroups, sendGroupMessage,
  sendGroupFile, getStats, isBackendConfigured, WA_BACKEND_URL,
  type WAStatus,
} from '@/services/whatsappWebService';
import { getDatabase, ref, get } from 'firebase/database';
import { app } from '@/lib/firebaseConfig';
import type { Student } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

type TabId = 'status' | 'broadcast' | 'results' | 'fees' | 'homework' | 'groups' | 'files';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'status',     label: 'Dashboard',  icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'broadcast',  label: 'Broadcast',  icon: <Send className="h-4 w-4" /> },
  { id: 'results',    label: 'Results',    icon: <FileText className="h-4 w-4" /> },
  { id: 'fees',       label: 'Fees',       icon: <DollarSign className="h-4 w-4" /> },
  { id: 'homework',   label: 'Homework',   icon: <BookOpen className="h-4 w-4" /> },
  { id: 'groups',     label: 'Groups',     icon: <Users className="h-4 w-4" /> },
  { id: 'files',      label: 'Send File',  icon: <Upload className="h-4 w-4" /> },
];

function StatusBadge({ status }: { status: WAStatus['status'] }) {
  const map: Record<WAStatus['status'], { color: string; label: string; icon: React.ReactNode }> = {
    connected:    { color: 'text-green-400 bg-green-500/10 border-green-500/20',  label: 'Connected',    icon: <Wifi className="h-3.5 w-3.5" /> },
    qr_pending:   { color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', label: 'QR Pending', icon: <QrCode className="h-3.5 w-3.5" /> },
    disconnected: { color: 'text-red-400 bg-red-500/10 border-red-500/20',       label: 'Disconnected', icon: <WifiOff className="h-3.5 w-3.5" /> },
    initializing: { color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',    label: 'Initializing', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
    auth_failure: { color: 'text-red-400 bg-red-500/10 border-red-500/20',       label: 'Auth Failure', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  };
  const s = map[status] || map.disconnected;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${s.color}`}>
      {s.icon} {s.label}
    </span>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900/60 border border-white/10 rounded-2xl p-5 space-y-4">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {children}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const WhatsAppAdminDashboard: React.FC = () => {
  const { toast } = useToast();
  const configured = isBackendConfigured();

  const [activeTab, setActiveTab]   = useState<TabId>('status');
  const [waStatus, setWaStatus]     = useState<WAStatus | null>(null);
  const [loading, setLoading]       = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Students from Realtime DB players/{classId}/{rollNo}
  // This is the same data source as AdminPlayerManagementPage
  const [students, setStudents] = useState<Student[]>([]);
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const db = getDatabase(app);
        const snap = await get(ref(db, 'players'));
        if (!snap.exists()) return;
        const data = snap.val();
        const list: Student[] = [];
        Object.entries(data).forEach(([classId, classPlayers]: [string, any]) => {
          Object.entries(classPlayers || {}).forEach(([rollNo, p]: [string, any]) => {
            list.push({
              id: `${classId}/${rollNo}`,
              name: p.name || '',
              marks: 0,
              examName: classId,
              percentage: 0,
              rollNo,
              phone: p.mobile || '',
              parentPhone: p.parentPhone || '',
              batch: classId,
              feeAmount: p.feeAmount ? Number(p.feeAmount) : undefined,
              feeDueDate: p.feeDueDate || '',
              feePaid: p.feePaid || false,
            });
          });
        });
        // Sort by name for easy lookup
        list.sort((a, b) => a.name.localeCompare(b.name));
        setStudents(list);
      } catch (err) {
        console.warn('[WhatsApp Dashboard] Failed to load players:', err);
      }
    };
    fetchPlayers();
  }, []);

  // ── Status polling ──────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    if (!configured) return;
    try {
      const s = await getWAStatus();
      setWaStatus(s);
      setBackendError(null);
    } catch (e: any) {
      console.error('Fetch status error:', e);
      setBackendError(e.message || 'Failed to reach backend');
    }
  }, [configured]);

  useEffect(() => {
    fetchStatus();
    // Poll fast (3s) when QR is pending so we detect auth immediately after scan.
    // Poll slow (8s) otherwise to avoid hammering the server.
    const interval = (waStatus?.status === 'qr_pending') ? 3000 : 8000;
    pollRef.current = setInterval(fetchStatus, interval);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchStatus, waStatus?.status]);

  // ── Reconnect ───────────────────────────────────────────────────────────────
  const handleReconnect = async () => {
    setLoading(true);
    try {
      await reconnectWA();
      toast({ title: '🔄 Reconnecting WhatsApp…' });
      setTimeout(fetchStatus, 3000);
    } catch (e: any) {
      if (e.message.includes('Chromium not installed')) {
        toast({ 
          title: 'WhatsApp unavailable', 
          description: 'Chromium is not installed. Use Docker deployment for WhatsApp automation.', 
          variant: 'destructive' 
        });
      } else {
        toast({ title: 'Reconnect failed', description: e.message, variant: 'destructive' });
      }
    } finally { setLoading(false); }
  };

  // ── Disconnect ──────────────────────────────────────────────────────────────
  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await disconnectWA();
      toast({ title: '⏹️ WhatsApp disconnected' });
      setTimeout(fetchStatus, 2000);
    } catch (e: any) {
      toast({ title: 'Disconnect failed', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  // ── Delete Session ──────────────────────────────────────────────────────────
  const handleDeleteSession = async () => {
    if (!window.confirm('Delete the WhatsApp session? You will need to scan the QR code again.')) return;
    setLoading(true);
    try {
      await deleteWASession();
      toast({ title: '🗑️ Session deleted — scan QR to reconnect' });
      setTimeout(fetchStatus, 4000);
    } catch (e: any) {
      toast({ title: 'Delete session failed', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  if (!configured) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 text-amber-300 text-sm">
        <p className="font-semibold mb-2">⚙️ Backend not configured</p>
        <p>Add these to your <code className="bg-black/30 px-1 rounded">.env</code> file:</p>
        <pre className="mt-2 bg-black/30 rounded p-3 text-xs text-amber-200 overflow-x-auto">{`VITE_WA_BACKEND_URL=http://localhost:3001
VITE_WA_ADMIN_SECRET=your_strong_secret_here`}</pre>
        <p className="mt-2 text-xs">
          If you are using an older env name, rename <code className="bg-black/30 px-1 rounded">VITE_HA_BACKEND_URL</code> to <code className="bg-black/30 px-1 rounded">VITE_WA_BACKEND_URL</code>.
        </p>
        <p className="mt-2 text-xs">
          Do not include <code className="bg-black/30 px-1 rounded">/app</code> in the backend URL; it should point to the root of the WhatsApp backend.
        </p>
        <p className="mt-2 text-xs">
          You can also override the backend URL in the browser using <code className="bg-black/30 px-1 rounded">?WA_BACKEND_URL=http://localhost:3001</code>.
        </p>
        <p className="mt-3 text-xs">Then start the backend: <code className="bg-black/30 px-1 rounded">cd backend && npm install && npm start</code></p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-green-400" /> WhatsApp Automation
          </h2>
          <p className="text-gray-400 text-sm mt-0.5">Powered by whatsapp-web.js — no API costs</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {waStatus && <StatusBadge status={waStatus.status} />}
          <Button size="sm" variant="outline" onClick={fetchStatus}
            className="border-gray-600 text-gray-300 rounded-xl gap-1.5 text-xs h-8">
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
          <Button size="sm" onClick={handleReconnect} disabled={loading}
            className="bg-blue-700 hover:bg-blue-600 text-white rounded-xl gap-1.5 text-xs h-8">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Reconnect
          </Button>
          {waStatus?.status === 'connected' && (
            <Button size="sm" onClick={handleDisconnect} disabled={loading}
              className="bg-orange-700 hover:bg-orange-600 text-white rounded-xl gap-1.5 text-xs h-8">
              <WifiOff className="h-3 w-3" /> Disconnect
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleDeleteSession} disabled={loading}
            className="border-red-600 text-red-400 hover:bg-red-900/20 rounded-xl gap-1.5 text-xs h-8">
            <XCircle className="h-3 w-3" /> Delete Session
          </Button>
        </div>
      </div>

      {/* Backend error banner */}
      {backendError && !waStatus && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm flex items-start gap-3">
          <WifiOff className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Backend not reachable</p>
            <p className="text-xs text-red-400 mt-0.5">{backendError}</p>
            <p className="text-xs text-red-400 mt-1">
              Backend URL: <span className="font-mono text-white">{WA_BACKEND_URL}</span>
            </p>
            <p className="text-xs text-red-400 mt-1">
              Make sure the WhatsApp backend is running and <code className="bg-black/30 px-1 rounded">VITE_WA_BACKEND_URL</code> is set to a valid host.
            </p>
          </div>
        </div>
      )}

      {/* Init error banner — Chromium/Puppeteer crash on server */}
      {waStatus?.initError && (waStatus.status === 'disconnected' || waStatus.status === 'auth_failure') && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 text-orange-300 text-sm flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">WhatsApp failed to start (Puppeteer/Chromium error)</p>
            <p className="text-xs text-orange-400 mt-1 font-mono break-all">{waStatus.initError}</p>
            <p className="text-xs text-orange-400 mt-2">
              To use WhatsApp automation, deploy the backend with Docker (see root-level render.yaml) or install Chromium on your server.
            </p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <a href={`${WA_BACKEND_URL}/api/whatsapp/debug`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-orange-300 underline mt-0.5">
                View debug info ↗
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Initializing banner */}
      {waStatus?.status === 'initializing' && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-blue-300 text-sm flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <div>
            <p className="font-semibold">Starting WhatsApp…</p>
            <p className="text-xs text-blue-400 mt-0.5">Launching Chromium on the server. QR code will appear here in ~15–30 seconds.</p>
          </div>
        </div>
      )}

      {/* QR Code display */}
      <AnimatePresence>
        {waStatus?.status === 'qr_pending' && waStatus.qr && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3">
            <p className="text-gray-800 font-semibold text-sm">Scan this QR code with WhatsApp</p>
            <div className="relative">
              <img src={waStatus.qr} alt="WhatsApp QR" className="w-56 h-56 rounded-xl" />
              {/* Show stale warning if QR is older than 18 seconds */}
              {waStatus.qrGeneratedAt && (Date.now() - waStatus.qrGeneratedAt) > 18000 && (
                <div className="absolute inset-0 bg-white/90 rounded-xl flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
                  <p className="text-gray-600 text-xs font-medium">QR refreshing…</p>
                </div>
              )}
            </div>
            <p className="text-gray-500 text-xs">Open WhatsApp → ⋮ → Linked Devices → Link a Device</p>
            <p className="text-green-700 text-xs font-medium">✅ After scanning once, you won't need to scan again</p>
            {waStatus.qrGeneratedAt && (
              <p className="text-gray-400 text-xs">
                QR generated {Math.round((Date.now() - waStatus.qrGeneratedAt) / 1000)}s ago — auto-refreshes every 20s
              </p>
            )}
          </motion.div>
        )}
        {waStatus?.status === 'qr_pending' && !waStatus.qr && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-yellow-300 text-sm flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            <p>QR code generating… refresh in a moment.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap bg-gray-900/40 border border-white/10 rounded-2xl p-1.5">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-green-600 text-white shadow'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>

          {activeTab === 'status'     && <StatusTab waStatus={waStatus} onReconnect={handleReconnect} onDisconnect={handleDisconnect} onDeleteSession={handleDeleteSession} />}
          {activeTab === 'broadcast'  && <BroadcastTab toast={toast} students={students} />}
          {activeTab === 'results'    && <ResultsTab toast={toast} students={students} />}
          {activeTab === 'fees'       && <FeesTab toast={toast} students={students} />}
          {activeTab === 'homework'   && <HomeworkTab toast={toast} students={students} />}
          {activeTab === 'groups'     && <GroupsTab toast={toast} />}
          {activeTab === 'files'      && <FilesTab toast={toast} students={students} />}

        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STATUS TAB
// ─────────────────────────────────────────────────────────────────────────────

function StatusTab({ waStatus, onReconnect, onDisconnect, onDeleteSession }: {
  waStatus: WAStatus | null;
  onReconnect: () => void;
  onDisconnect: () => void;
  onDeleteSession: () => void;
}) {
  const stats = waStatus?.stats || { sent: 0, failed: 0, studentsReached: 0 };
  const statCards = [
    { label: 'Messages Sent Today', value: stats.sent,           icon: <Send className="h-5 w-5 text-green-400" />,  color: 'border-green-500/20' },
    { label: 'Students Reached',    value: stats.studentsReached, icon: <Users className="h-5 w-5 text-blue-400" />,  color: 'border-blue-500/20' },
    { label: 'Failed Messages',     value: stats.failed,         icon: <XCircle className="h-5 w-5 text-red-400" />, color: 'border-red-500/20' },
  ];

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {statCards.map(c => (
          <div key={c.label} className={`bg-gray-900/60 border ${c.color} rounded-2xl p-4 flex items-center gap-3`}>
            <div className="p-2 bg-white/5 rounded-xl">{c.icon}</div>
            <div>
              <p className="text-2xl font-bold text-white">{c.value}</p>
              <p className="text-gray-400 text-xs">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Connection info */}
      <SectionCard title="Connection Info">
        {waStatus ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3">
              <span className="text-gray-400 w-32">Status</span>
              <StatusBadge status={waStatus.status} />
            </div>
            {waStatus.info && (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 w-32">Name</span>
                  <span className="text-white">{waStatus.info.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 w-32">Number</span>
                  <span className="text-green-400">+{waStatus.info.number}</span>
                </div>
              </>
            )}
            {waStatus.status === 'disconnected' && (
              <Button onClick={onReconnect} size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl mt-2">
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reconnect Now
              </Button>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Backend not reachable. Make sure <code className="bg-white/5 px-1 rounded">npm start</code> is running in <code className="bg-white/5 px-1 rounded">backend/</code>.</p>
        )}
      </SectionCard>

      {/* Quick actions */}
      <SectionCard title="Quick Actions">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { label: 'Send Test Message', icon: <Send className="h-4 w-4" />, color: 'bg-green-700 hover:bg-green-600', action: async () => {
              const phone = prompt('Enter phone number (+91XXXXXXXXXX):');
              if (phone) await sendDirectMessage(phone, '👋 Test message from PCCOER Education Platform!');
            }},
            { label: 'Run Fee Reminders', icon: <DollarSign className="h-4 w-4" />, color: 'bg-amber-700 hover:bg-amber-600', action: () => runFeeReminders() },
            { label: 'Reconnect WhatsApp', icon: <RefreshCw className="h-4 w-4" />, color: 'bg-blue-700 hover:bg-blue-600', action: onReconnect },
            { label: 'Disconnect', icon: <WifiOff className="h-4 w-4" />, color: 'bg-orange-700 hover:bg-orange-600', action: onDisconnect },
            { label: 'Delete Session', icon: <XCircle className="h-4 w-4" />, color: 'bg-red-800 hover:bg-red-700', action: onDeleteSession },
          ].map(btn => (
            <Button key={btn.label} size="sm" onClick={btn.action}
              className={`${btn.color} text-white rounded-xl gap-1.5 text-xs`}>
              {btn.icon} {btn.label}
            </Button>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BROADCAST TAB
// ─────────────────────────────────────────────────────────────────────────────

function BroadcastTab({ toast, students }: { toast: any; students: Student[] }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Derive unique class IDs from player data
  const classIds = Array.from(new Set(students.map(s => s.examName).filter(Boolean))).sort();

  // Step 1: pick class
  const [selectedClass, setSelectedClass] = useState('');
  // Step 2: pick student (or "all")
  const [selectedStudent, setSelectedStudent] = useState('all');

  const studentsInClass = students.filter(s => s.examName === selectedClass);

  const handleSend = async () => {
    if (!selectedClass) { toast({ title: 'Select a class first', variant: 'destructive' }); return; }
    if (!message.trim()) { toast({ title: 'Enter a message', variant: 'destructive' }); return; }

    setSending(true);
    try {
      if (selectedStudent === 'all') {
        // Broadcast to all students + parents in the class
        const { sendClassBroadcast } = await import('@/services/whatsappWebService');
        const res = await sendClassBroadcast({ className: selectedClass, message, includeParents: true });
        toast({ title: `✅ Sent to class "${selectedClass}"`, description: `${res.sent} sent · ${res.failed ?? 0} failed` });
      } else {
        // Single student
        const s = students.find(st => st.id === selectedStudent);
        if (!s) { toast({ title: 'Student not found', variant: 'destructive' }); setSending(false); return; }
        const targets = [s.phone, s.parentPhone].filter(Boolean) as string[];
        if (!targets.length) { toast({ title: 'No phone numbers for this student', variant: 'destructive' }); setSending(false); return; }
        const res = await broadcastMessage(targets, message);
        toast({ title: `✅ Sent to ${s.name}`, description: `${res.sent} sent · ${res.failed} failed` });
      }
    } catch (e: any) {
      toast({ title: 'Send failed', description: e.message, variant: 'destructive' });
    } finally { setSending(false); }
  };

  return (
    <SectionCard title="📢 Broadcast Message">
      <div className="space-y-3">

        {/* Step 1: Class selector */}
        <div>
          <Label className="text-gray-300 text-xs mb-1 block">Step 1 — Select Class</Label>
          <select
            value={selectedClass}
            onChange={e => { setSelectedClass(e.target.value); setSelectedStudent('all'); }}
            className="w-full bg-gray-800 border border-gray-600 text-white rounded-xl px-3 py-2 text-sm"
          >
            <option value="">— Choose a class —</option>
            {classIds.map(c => (
              <option key={c} value={c}>{c} ({students.filter(s => s.examName === c).length} students)</option>
            ))}
          </select>
        </div>

        {/* Step 2: Student selector — only shows after class is picked */}
        {selectedClass && (
          <div>
            <Label className="text-gray-300 text-xs mb-1 block">Step 2 — Send to</Label>
            <select
              value={selectedStudent}
              onChange={e => setSelectedStudent(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 text-white rounded-xl px-3 py-2 text-sm"
            >
              <option value="all">📢 All students in "{selectedClass}" ({studentsInClass.length} students + parents)</option>
              {studentsInClass.map(s => (
                <option key={s.id} value={s.id}>
                  👤 {s.name} — Roll {s.rollNo} {s.phone ? `(${s.phone})` : '⚠️ no phone'}
                </option>
              ))}
            </select>
            {selectedStudent !== 'all' && (() => {
              const s = students.find(st => st.id === selectedStudent);
              return s && (
                <div className="mt-1.5 flex gap-3 text-xs text-gray-400 pl-1">
                  {s.phone && <span className="text-green-400">📱 Student: {s.phone}</span>}
                  {s.parentPhone && <span className="text-blue-400">👨‍👩 Parent: {s.parentPhone}</span>}
                  {!s.phone && !s.parentPhone && <span className="text-red-400">⚠️ No phone numbers — add them in Players tab</span>}
                </div>
              );
            })()}
          </div>
        )}

        {/* Message */}
        <div>
          <Label className="text-gray-300 text-xs mb-1 block">Message</Label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5}
            placeholder="Type your message…"
            className="w-full bg-gray-800 border border-gray-600 text-white rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-green-500" />
        </div>

        <Button onClick={handleSend} disabled={sending || !selectedClass}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl gap-2">
          {sending
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
            : <><Send className="h-4 w-4" />
                {selectedStudent === 'all'
                  ? `Send to All in "${selectedClass}"`
                  : `Send to ${students.find(s => s.id === selectedStudent)?.name || 'Student'}`}
              </>}
        </Button>
      </div>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULTS TAB
// ─────────────────────────────────────────────────────────────────────────────

// ── Shared-history quiz sender ────────────────────────────────────────────────
interface SharedQuizEntry {
  quizId: string;
  quizTitle: string;
  playerCount: number;
  players: {
    playerId: string;
    nickname: string;
    rollNo?: string;
    classId?: string;
    score: number;
    totalQuestions: number;
    correctAnswersCount?: number;
    accuracy?: number;
    percentile?: number;
  }[];
}

function SendQuizFromHistorySection({
  toast,
  students,
}: {
  toast: any;
  students: Student[];
}) {
  const [quizList, setQuizList]           = useState<SharedQuizEntry[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [loaded, setLoaded]               = useState(false);

  // Selection state
  const classIds = Array.from(new Set(students.map(s => s.examName).filter(Boolean))).sort();
  const [selClass, setSelClass]           = useState('');        // '' = all classes
  const [selStudent, setSelStudent]       = useState('all');    // 'all' or student.id
  const [selQuizId, setSelQuizId]         = useState('');

  const [sending, setSending]             = useState(false);
  const [progress, setProgress]           = useState<{ done: number; total: number } | null>(null);

  // Students visible in dropdown based on selected class
  const studentsInClass = selClass
    ? students.filter(s => s.examName === selClass)
    : students;

  // Reset student selection when class changes
  const handleClassChange = (cls: string) => {
    setSelClass(cls);
    setSelStudent('all');
  };

  // Load shared quiz history from Firebase on demand
  const loadQuizzes = async () => {
    setLoadingQuizzes(true);
    try {
      const db = getDatabase(app);
      const snap = await get(ref(db, 'sharedQuizResults'));
      if (!snap.exists()) { toast({ title: 'No shared quiz history found', variant: 'destructive' }); setLoaded(true); return; }
      const data = snap.val();
      const entries: SharedQuizEntry[] = [];
      for (const quizId in data) {
        const quizData = data[quizId];
        const rawPlayers = quizData.players || {};
        const players = Object.entries(rawPlayers).map(([playerId, p]: [string, any]) => ({
          playerId,
          nickname: p.nickname || 'Unknown',
          rollNo: p.rollNo || '',
          classId: p.classId || '',
          score: Number(p.score) || 0,
          totalQuestions: Number(p.totalQuestions) || 0,
          correctAnswersCount: Number(p.correctAnswersCount) || 0,
          accuracy: Number(p.accuracy) || 0,
          percentile: Number(p.percentile) || 0,
        }));
        if (players.length > 0) {
          entries.push({
            quizId,
            quizTitle: quizData.quizTitle || quizId,
            playerCount: players.length,
            players,
          });
        }
      }
      entries.sort((a, b) => a.quizTitle.localeCompare(b.quizTitle));
      setQuizList(entries);
      setLoaded(true);
    } catch (e: any) {
      toast({ title: 'Failed to load quiz history', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingQuizzes(false);
    }
  };

  const selectedQuiz = quizList.find(q => q.quizId === selQuizId);

  // Build a ranked player list for the selected quiz, optionally filtered by class
  const buildTargetPlayers = () => {
    if (!selectedQuiz) return [];
    let players = [...selectedQuiz.players];

    // Filter to selected class if not "all classes"
    if (selClass) {
      players = players.filter(p => p.classId === selClass);
    }

    // Sort by score desc and assign rank
    players.sort((a, b) => b.score - a.score);
    const totalPlayers = players.length;
    const maxScore = players[0]?.score || 0;

    return players.map((p, i) => {
      // Try to match to a registered student by rollNo + classId
      const matched = students.find(
        s => s.rollNo === p.rollNo && s.examName === p.classId
      );
      const pct = maxScore > 0 ? Number(((p.score / maxScore) * 100).toFixed(1)) : 0;
      return {
        ...p,
        rank: i + 1,
        totalPlayers,
        percentileCalc: pct,
        phone: matched?.phone || '',
        parentPhone: matched?.parentPhone || '',
        studentName: matched?.name || p.nickname,
        batch: matched?.examName || p.classId || '',
      };
    });
  };

  const handleSend = async () => {
    if (!selQuizId) { toast({ title: 'Select a quiz first', variant: 'destructive' }); return; }

    const targets = buildTargetPlayers().filter(p => {
      if (selStudent === 'all') return true;
      // individual — match student.id
      const s = students.find(st => st.id === selStudent);
      if (!s) return false;
      return p.rollNo === s.rollNo && p.classId === s.examName;
    });

    if (targets.length === 0) {
      toast({ title: 'No matching players found for the selection', variant: 'destructive' });
      return;
    }

    const quizTitle = selectedQuiz!.quizTitle;
    const quizLink  = `${window.location.origin}/play-quiz/${selQuizId}`;
    const date      = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    setSending(true);
    setProgress({ done: 0, total: targets.length });

    let sent = 0, failed = 0, skipped = 0;

    for (let i = 0; i < targets.length; i++) {
      const p = targets[i];
      const phones: string[] = [];
      if (p.phone) phones.push(p.phone);
      if (p.parentPhone && p.parentPhone !== p.phone) phones.push(p.parentPhone);

      if (phones.length === 0) { skipped++; setProgress({ done: i + 1, total: targets.length }); continue; }

      const pct = p.accuracy ?? p.percentileCalc;
      const message =
        `🎯 *Quiz Result — ${quizTitle}*\n\n` +
        `👤 Student: *${p.studentName}*\n` +
        (p.rollNo ? `📋 Roll No: ${p.rollNo}\n` : '') +
        (p.batch   ? `🏫 Class: ${p.batch}\n` : '') +
        `\n📊 *Your Score*\n` +
        `• Score: *${p.score} / ${p.totalQuestions}*\n` +
        `• Correct: ${p.correctAnswersCount} / ${p.totalQuestions} questions\n` +
        `• Accuracy: *${Number(p.accuracy ?? 0).toFixed(1)}%*\n` +
        `• Rank: *${p.rank} out of ${p.totalPlayers}*\n` +
        `\n▶️ Play again: ${quizLink}\n\n` +
        `📅 Date: ${date}\n` +
        `🎓 *PCCOER Education Platform*\nKeep learning, keep growing! 💪`;

      try {
        await sendDirectMessage(phones[0], message);
        // send to parent separately if different number
        if (phones[1]) {
          const parentMsg =
            `🎯 *Quiz Result — ${quizTitle}*\n\n` +
            `👤 Student: *${p.studentName}*\n` +
            (p.rollNo ? `📋 Roll No: ${p.rollNo}\n` : '') +
            (p.batch   ? `🏫 Class: ${p.batch}\n` : '') +
            `\n📊 *Score*: *${p.score} / ${p.totalQuestions}*\n` +
            `• Rank: *${p.rank} out of ${p.totalPlayers}*\n` +
            `• Accuracy: *${Number(p.accuracy ?? 0).toFixed(1)}%*\n` +
            `\n🎓 *PCCOER Education Platform*`;
          await sendDirectMessage(phones[1], parentMsg);
        }
        sent++;
      } catch {
        failed++;
      }
      setProgress({ done: i + 1, total: targets.length });
      // small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 400));
    }

    setSending(false);
    setProgress(null);
    toast({
      title: '✅ Quiz Results Sent',
      description: `${sent} sent · ${failed} failed · ${skipped} skipped (no phone)`,
    });
  };

  const targetPreview = loaded ? buildTargetPlayers().filter(p => {
    if (selStudent === 'all') return true;
    const s = students.find(st => st.id === selStudent);
    if (!s) return false;
    return p.rollNo === s.rollNo && p.classId === s.examName;
  }) : [];

  const withPhone    = targetPreview.filter(p => p.phone || p.parentPhone).length;
  const withoutPhone = targetPreview.filter(p => !p.phone && !p.parentPhone).length;

  return (
    <SectionCard title="🎮 Send Quiz Results from Shared History">
      <p className="text-gray-400 text-xs -mt-2">
        Fetch quiz/game data from Shared History → select class & students → send score report via WhatsApp automatically.
      </p>

      {/* Load button */}
      {!loaded && (
        <Button onClick={loadQuizzes} disabled={loadingQuizzes}
          className="w-full bg-indigo-700 hover:bg-indigo-600 text-white rounded-xl gap-2">
          {loadingQuizzes ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</> : '📂 Load Shared Quiz History'}
        </Button>
      )}

      {loaded && (
        <div className="space-y-3">
          {/* Refresh */}
          <Button variant="ghost" size="sm" onClick={loadQuizzes} disabled={loadingQuizzes}
            className="text-gray-400 hover:text-white text-xs gap-1.5 px-2 h-7">
            <RefreshCw className={`h-3.5 w-3.5 ${loadingQuizzes ? 'animate-spin' : ''}`} /> Refresh
          </Button>

          {quizList.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No shared quiz history found.</p>
          ) : (
            <>
              {/* Step 1 — Select class */}
              <div>
                <Label className="text-gray-300 text-xs mb-1 block">Step 1 — Select Class</Label>
                <select value={selClass} onChange={e => handleClassChange(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 text-white rounded-xl px-3 py-2 text-sm">
                  <option value="">📢 All Classes ({students.length} students)</option>
                  {classIds.map(c => (
                    <option key={c} value={c}>{c} ({students.filter(s => s.examName === c).length} students)</option>
                  ))}
                </select>
              </div>

              {/* Step 2 — Select student */}
              <div>
                <Label className="text-gray-300 text-xs mb-1 block">Step 2 — Send to</Label>
                <select value={selStudent} onChange={e => setSelStudent(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 text-white rounded-xl px-3 py-2 text-sm">
                  <option value="all">
                    📢 All students{selClass ? ` in "${selClass}"` : ''} ({studentsInClass.length})
                  </option>
                  {studentsInClass.map(s => (
                    <option key={s.id} value={s.id}>
                      👤 {s.name} — Roll {s.rollNo} {s.phone ? `(${s.phone})` : '⚠️ no phone'}
                    </option>
                  ))}
                </select>
                {selStudent !== 'all' && (() => {
                  const s = students.find(st => st.id === selStudent);
                  return s && (
                    <div className="mt-1 flex gap-3 text-xs text-gray-400 pl-1">
                      {s.phone && <span className="text-green-400">📱 {s.phone}</span>}
                      {s.parentPhone && <span className="text-blue-400">👨‍👩 {s.parentPhone}</span>}
                      {!s.phone && !s.parentPhone && <span className="text-red-400">⚠️ No phone — add in Players tab</span>}
                    </div>
                  );
                })()}
              </div>

              {/* Step 3 — Select quiz */}
              <div>
                <Label className="text-gray-300 text-xs mb-1 block">Step 3 — Select Quiz / Game</Label>
                <select value={selQuizId} onChange={e => setSelQuizId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 text-white rounded-xl px-3 py-2 text-sm">
                  <option value="">— Select a quiz —</option>
                  {quizList.map(q => (
                    <option key={q.quizId} value={q.quizId}>
                      🎯 {q.quizTitle} ({q.playerCount} players)
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview */}
              {selQuizId && targetPreview.length > 0 && (
                <div className="bg-gray-800/60 rounded-xl p-3 text-xs space-y-1">
                  <p className="text-gray-300 font-medium">Preview</p>
                  <p className="text-gray-400">
                    {targetPreview.length} player{targetPreview.length !== 1 ? 's' : ''} matched ·{' '}
                    <span className="text-green-400">{withPhone} with phone</span> ·{' '}
                    {withoutPhone > 0 && <span className="text-red-400">{withoutPhone} no phone</span>}
                  </p>
                  {targetPreview.slice(0, 3).map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-gray-500">
                      <span>#{p.rank} {p.studentName} {p.rollNo ? `(Roll ${p.rollNo})` : ''}</span>
                      <span>{p.score}/{p.totalQuestions} pts · {p.phone ? <span className="text-green-400">✓</span> : <span className="text-red-400">no phone</span>}</span>
                    </div>
                  ))}
                  {targetPreview.length > 3 && <p className="text-gray-600">…and {targetPreview.length - 3} more</p>}
                </div>
              )}

              {selQuizId && targetPreview.length === 0 && (
                <p className="text-yellow-500 text-xs">No players found for this quiz in the selected class/student filter.</p>
              )}

              {/* Progress */}
              {sending && progress && (
                <div className="bg-gray-800 rounded-xl px-3 py-2">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Sending…</span>
                    <span>{progress.done} / {progress.total}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5">
                    <div
                      className="bg-green-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${(progress.done / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Send button */}
              <Button onClick={handleSend} disabled={sending || !selQuizId}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl gap-2">
                {sending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                  : <><Send className="h-4 w-4" />
                      {selStudent === 'all'
                        ? `Send to ${withPhone} students${selClass ? ` in "${selClass}"` : ''}`
                        : `Send to ${students.find(s => s.id === selStudent)?.name || 'Student'}`}
                    </>}
              </Button>
            </>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function ResultsTab({ toast, students }: { toast: any; students: Student[] }) {
  const [examId, setExamId]   = useState('');
  const [sending, setSending] = useState(false);

  const handleBulk = async () => {
    if (!examId.trim()) { toast({ title: 'Enter exam ID', variant: 'destructive' }); return; }
    setSending(true);
    try {
      const res = await sendResultsForExam(examId.trim());
      toast({ title: '✅ Results sent', description: `${res.sent} sent · ${res.failed} failed` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-4">
      {/* ── Send from Shared History ── */}
      <SendQuizFromHistorySection toast={toast} students={students} />

      <SectionCard title="📤 Send All Results for an Exam">
        <p className="text-gray-400 text-xs">Fetches all results for the exam from Firestore and sends to every student & parent automatically.</p>
        <div className="flex gap-2">
          <Input value={examId} onChange={e => setExamId(e.target.value)}
            placeholder="Firestore exam document ID" className="bg-gray-800 border-gray-600 text-white flex-1" />
          <Button onClick={handleBulk} disabled={sending}
            className="bg-green-700 hover:bg-green-600 text-white rounded-xl gap-1.5 shrink-0">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send All
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FEES TAB
// ─────────────────────────────────────────────────────────────────────────────

function FeesTab({ toast, students }: { toast: any; students: Student[] }) {
  const [form, setForm] = useState({ studentName: '', parentPhone: '', studentPhone: '', amountDue: '', dueDate: '', batch: '' });
  const [sending, setSending]   = useState(false);
  const [running, setRunning]   = useState(false);

  // Class-first quick fill
  const classIds = Array.from(new Set(students.map(s => s.examName).filter(Boolean))).sort();
  const [qfClass, setQfClass] = useState('');
  const studentsInQfClass = students.filter(s => s.examName === qfClass);

  const handleSelectStudentForFee = (studentId: string) => {
    const s = students.find(st => st.id === studentId);
    if (!s) return;
    setForm(p => ({
      ...p,
      studentName: s.name,
      studentPhone: s.phone || '',
      parentPhone: s.parentPhone || '',
      batch: s.examName || '',
      amountDue: s.feeAmount ? String(s.feeAmount) : p.amountDue,
      dueDate: s.feeDueDate || p.dueDate,
    }));
  };

  const handleSend = async () => {
    if (!form.studentName || !form.amountDue || !form.dueDate) {
      toast({ title: 'Student name, amount and due date required', variant: 'destructive' }); return;
    }
    setSending(true);
    try {
      await sendFeeReminder(form);
      toast({ title: '✅ Fee reminder sent' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSending(false); }
  };

  const handleRunAll = async () => {
    setRunning(true);
    try {
      const res = await runFeeReminders();
      toast({ title: '✅ Fee reminders complete', description: `Sent: ${res.sent} · Skipped: ${res.skipped}` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setRunning(false); }
  };

  return (
    <div className="space-y-4">
      <SectionCard title="💰 Send Fee Reminder">
        {students.length > 0 && (
          <div className="mb-3 space-y-2">
            <Label className="text-gray-300 text-xs mb-1 block">Quick Fill from Players</Label>
            <div className="grid grid-cols-2 gap-2">
              <select value={qfClass} onChange={e => setQfClass(e.target.value)}
                className="bg-gray-800 border border-gray-600 text-white rounded-xl px-3 py-2 text-sm">
                <option value="">— Select class —</option>
                {classIds.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select onChange={e => handleSelectStudentForFee(e.target.value)} disabled={!qfClass}
                className="bg-gray-800 border border-gray-600 text-white rounded-xl px-3 py-2 text-sm disabled:opacity-40">
                <option value="">— Select student —</option>
                {studentsInQfClass.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.feePaid ? ' ✅ Paid' : s.feeAmount ? ` — ₹${s.feeAmount} due` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            ['studentName','Student Name *'],['parentPhone','Parent Phone'],
            ['studentPhone','Student Phone'],['amountDue','Amount Due (₹) *'],
            ['dueDate','Due Date *'],['batch','Batch'],
          ] as [keyof typeof form, string][]).map(([k, label]) => (
            <div key={k}>
              <Label className="text-gray-300 text-xs mb-1 block">{label}</Label>
              <Input value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                placeholder={k === 'parentPhone' || k === 'studentPhone' ? '+91XXXXXXXXXX' : k === 'dueDate' ? '30 Jun 2026' : ''}
                className="bg-gray-800 border-gray-600 text-white" />
            </div>
          ))}
        </div>
        <Button onClick={handleSend} disabled={sending}
          className="w-full bg-amber-700 hover:bg-amber-600 text-white rounded-xl gap-2">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
          Send Reminder
        </Button>
      </SectionCard>

      <SectionCard title="🤖 Auto Fee Reminders">
        <p className="text-gray-400 text-xs">
          Scans all students in Firestore with <code className="bg-white/5 px-1 rounded">feePaid !== true</code> and sends reminders to overdue ones.
          This also runs automatically every day at 9 AM IST.
        </p>
        <Button onClick={handleRunAll} disabled={running}
          className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl gap-2">
          {running ? <><Loader2 className="h-4 w-4 animate-spin" /> Running…</> : <><Clock className="h-4 w-4" /> Run All Fee Reminders Now</>}
        </Button>
      </SectionCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOMEWORK TAB
// ─────────────────────────────────────────────────────────────────────────────

function HomeworkTab({ toast, students }: { toast: any; students: Student[] }) {
  const [file, setFile]       = useState<File | null>(null);
  const [batch, setBatch]     = useState('');
  const [subject, setSubject] = useState('');
  const [caption, setCaption] = useState('');
  const [type, setType]       = useState<'homework' | 'notes'>('homework');
  const classIds = Array.from(new Set(students.map(s => s.examName).filter(Boolean))).sort();
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    if (!batch.trim()) { toast({ title: 'Select a class/batch first', variant: 'destructive' }); return; }
    setSending(true);
    try {
      const res = await sendHomework(file!, batch, subject, caption, type);
      if (res.error) throw new Error(res.error);
      toast({ title: `✅ ${type === 'notes' ? 'Notes' : 'Homework'} sent`, description: `${res.sent} sent · ${res.failed} failed · ${res.groupsSent} groups` });
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSending(false); }
  };

  return (
    <SectionCard title="📚 Send Homework / Notes to Batch">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-gray-300 text-xs mb-1 block">Class / Batch *</Label>
          {/* Class selector — picks from Player Management data */}
          <select
            value={batch}
            onChange={e => setBatch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
          >
            <option value="">— Select class —</option>
            {classIds.map(c => (
              <option key={c} value={c}>{c} ({students.filter(s => s.examName === c).length} students)</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-gray-300 text-xs mb-1 block">Subject</Label>
          <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Chemistry"
            className="bg-gray-800 border-gray-600 text-white" />
        </div>
        <div>
          <Label className="text-gray-300 text-xs mb-1 block">Type</Label>
          <select value={type} onChange={e => setType(e.target.value as 'homework' | 'notes')}
            className="w-full bg-gray-800 border border-gray-600 text-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="homework">Homework</option>
            <option value="notes">Notes</option>
          </select>
        </div>
        <div>
          <Label className="text-gray-300 text-xs mb-1 block">PDF / File (optional)</Label>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.png" onChange={e => setFile(e.target.files?.[0] || null)}
            className="w-full text-gray-300 text-xs bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-green-700 file:text-white file:text-xs cursor-pointer" />
        </div>
      </div>
      <div>
        <Label className="text-gray-300 text-xs mb-1 block">Custom Caption (optional)</Label>
        <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={3}
          placeholder="Leave empty for auto-generated caption…"
          className="w-full bg-gray-800 border border-gray-600 text-white rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-green-500" />
      </div>
      <Button onClick={handleSend} disabled={sending || !batch}
        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl gap-2">
        {sending
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending to batch…</>
          : <><Send className="h-4 w-4" /> Send to {batch || 'Batch'}</>}
      </Button>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUPS TAB
// ─────────────────────────────────────────────────────────────────────────────

function GroupsTab({ toast }: { toast: any }) {
  const [groups, setGroups]     = useState<{ id: string; name: string; participantCount: number }[]>([]);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState('');
  const [message, setMessage]   = useState('');
  const [file, setFile]         = useState<File | null>(null);
  const [sending, setSending]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const res = await listGroups();
      setGroups(res.groups);
    } catch (e: any) {
      toast({ title: 'Failed to load groups', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleSend = async () => {
    if (!selected) { toast({ title: 'Select a group', variant: 'destructive' }); return; }
    setSending(true);
    try {
      if (file) {
        await sendGroupFile(selected, file, message);
        setFile(null);
        if (fileRef.current) fileRef.current.value = '';
      } else if (message.trim()) {
        await sendGroupMessage(selected, message);
      } else {
        toast({ title: 'Enter message or attach a file', variant: 'destructive' });
        setSending(false); return;
      }
      toast({ title: '✅ Sent to group' });
      setMessage('');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-4">
      <SectionCard title="📋 WhatsApp Groups">
        <Button onClick={loadGroups} disabled={loading} size="sm"
          className="bg-indigo-700 hover:bg-indigo-600 text-white rounded-xl gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Load Groups from WhatsApp
        </Button>
        {groups.length > 0 && (
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {groups.map(g => (
              <div key={g.id} onClick={() => setSelected(g.id)}
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 cursor-pointer transition-all ${
                  selected === g.id ? 'bg-green-700/30 border border-green-500/40' : 'bg-gray-800/50 border border-white/5 hover:bg-gray-700/40'
                }`}>
                <div>
                  <p className="text-white text-sm font-medium">{g.name}</p>
                  <p className="text-gray-500 text-xs">{g.participantCount} members · {g.id}</p>
                </div>
                {selected === g.id && <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="📤 Send to Selected Group">
        <div>
          <Label className="text-gray-300 text-xs mb-1 block">Message</Label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
            placeholder="Message to send to the group…"
            className="w-full bg-gray-800 border border-gray-600 text-white rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-green-500" />
        </div>
        <div>
          <Label className="text-gray-300 text-xs mb-1 block">Attach File (optional)</Label>
          <input ref={fileRef} type="file" onChange={e => setFile(e.target.files?.[0] || null)}
            className="w-full text-gray-300 text-xs bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-indigo-700 file:text-white file:text-xs cursor-pointer" />
        </div>
        <Button onClick={handleSend} disabled={sending || !selected}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl gap-2">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send to Group
        </Button>
      </SectionCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FILES TAB
// ─────────────────────────────────────────────────────────────────────────────

function FilesTab({ toast, students }: { toast: any; students: Student[] }) {
  const [file, setFile]     = useState<File | null>(null);
  const [phone, setPhone]   = useState('');
  const [phones, setPhones] = useState('');
  const [caption, setCaption] = useState('');
  const [mode, setMode]     = useState<'single' | 'bulk'>('single');
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLoadAllPhones = () => {
    const nums = students
      .flatMap(s => [s.phone, s.parentPhone])
      .filter((p): p is string => Boolean(p && p.trim()))
      .filter((p, i, arr) => arr.indexOf(p) === i);
    if (nums.length === 0) { toast({ title: 'No phone numbers in student data', variant: 'destructive' }); return; }
    setPhones(nums.join('\n'));
    setMode('bulk');
    toast({ title: `Loaded ${nums.length} numbers` });
  };

  const handleSend = async () => {
    if (!file) { toast({ title: 'Select a file', variant: 'destructive' }); return; }
    setSending(true);
    try {
      if (mode === 'single') {
        if (!phone) { toast({ title: 'Phone number required', variant: 'destructive' }); setSending(false); return; }
        await sendFile(phone, file, caption);
        toast({ title: '✅ File sent' });
      } else {
        const list = phones.split(/[\n,]/).map(p => p.trim()).filter(Boolean);
        if (!list.length) { toast({ title: 'Enter phone numbers', variant: 'destructive' }); setSending(false); return; }
        const res = await sendFileBulk(list, file, caption);
        toast({ title: '✅ File sent', description: `${res.sent} sent · ${res.failed} failed` });
      }
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSending(false); }
  };

  return (
    <SectionCard title="📎 Send File / PDF">
      <div className="flex gap-2 mb-3">
        {(['single','bulk'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all ${mode === m ? 'bg-green-600 text-white' : 'text-gray-400 bg-white/5 hover:text-white'}`}>
            {m === 'single' ? '👤 Single' : '👥 Bulk'}
          </button>
        ))}
      </div>

      <div>
        <Label className="text-gray-300 text-xs mb-1 block">File (PDF / Image) *</Label>
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.png,.jpeg" onChange={e => setFile(e.target.files?.[0] || null)}
          className="w-full text-gray-300 text-xs bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-green-700 file:text-white file:text-xs cursor-pointer" />
      </div>

      {mode === 'single' ? (
        <div>
          <Label className="text-gray-300 text-xs mb-1 block">Phone Number *</Label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91XXXXXXXXXX"
            className="bg-gray-800 border-gray-600 text-white" />
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-gray-300 text-xs">Phone Numbers (one per line)</Label>
            <Button size="sm" variant="outline" onClick={handleLoadAllPhones}
              className="border-green-600 text-green-400 hover:bg-green-900/20 text-xs h-7 px-2">
              <Users className="h-3 w-3 mr-1" /> Load from Students
            </Button>
          </div>
          <textarea value={phones} onChange={e => setPhones(e.target.value)} rows={4}
            placeholder="+91XXXXXXXXXX&#10;+91YYYYYYYYYY"
            className="w-full bg-gray-800 border border-gray-600 text-white rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-green-500" />
        </div>
      )}

      <div>
        <Label className="text-gray-300 text-xs mb-1 block">Caption (optional)</Label>
        <Input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Optional caption…"
          className="bg-gray-800 border-gray-600 text-white" />
      </div>

      <Button onClick={handleSend} disabled={sending}
        className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white rounded-xl gap-2">
        {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><Upload className="h-4 w-4" /> Send File</>}
      </Button>
    </SectionCard>
  );
}

export default WhatsAppAdminDashboard;
