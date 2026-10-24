import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Plus, Trash2, Send, Phone, Users, Check, AlertCircle, Search, UserPlus, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getDatabase, ref, get, set, push, remove } from 'firebase/database';
import { app } from '@/lib/firebaseConfig';
import {
  getWhatsAppGroups, addWhatsAppGroup, deleteWhatsAppGroup,
  sendDirectMessage, isWhatsAppConfigured,
  type WhatsAppGroup,
} from '@/services/whatsappService';

interface StudentContact {
  rollNo: string;
  name: string;
  classId: string;
  mobile: string;
}

const WhatsAppManager: React.FC = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const uid = currentUser?.uid || '';
  const configured = isWhatsAppConfigured();

  // ── Groups ──
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingGroup, setSendingGroup] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState('👋 Hello from PCCOER Education Platform! This is a test message from your quiz platform.');

  // ── Students ──
  const [students, setStudents] = useState<StudentContact[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [sendingStudent, setSendingStudent] = useState<string | null>(null);
  const [studentMessage, setStudentMessage] = useState('📚 Hello {name}, this is a message from PCCOER Education Platform.');
  const [broadcastClass, setBroadcastClass] = useState<string>('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // ── Add student number manually ──
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentClass, setNewStudentClass] = useState('');
  const [newStudentMobile, setNewStudentMobile] = useState('');
  const [savingStudent, setSavingStudent] = useState(false);

  // ── Direct message ──
  const [directNumber, setDirectNumber] = useState('');
  const [directMessage, setDirectMessage] = useState('');
  const [sendingDirect, setSendingDirect] = useState(false);

  useEffect(() => {
    if (!uid) return;
    loadGroups();
    loadStudents();
  }, [uid]);

  const loadGroups = async () => {
    setLoadingGroups(true);
    try {
      const data = await getWhatsAppGroups(uid);
      setGroups(data);
    } catch (err: any) {
      toast({ title: 'Failed to load groups', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingGroups(false);
    }
  };

  const loadStudents = async () => {
    setLoadingStudents(true);
    try {
      const db = getDatabase(app);
      const snap = await get(ref(db, 'players'));
      const list: StudentContact[] = [];
      if (snap.exists()) {
        const data = snap.val();
        for (const classId in data) {
          for (const rollNo in data[classId]) {
            const p = data[classId][rollNo];
            if (p.mobile && p.mobile.trim()) {
              list.push({ rollNo, name: p.name || 'Unknown', classId, mobile: p.mobile.trim() });
            }
          }
        }
      }
      list.sort((a, b) => a.classId.localeCompare(b.classId) || a.name.localeCompare(b.name));
      setStudents(list);
    } catch (err: any) {
      toast({ title: 'Failed to load students', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingStudents(false);
    }
  };

  const uniqueClasses = Array.from(new Set(students.map(s => s.classId))).sort();

  const filteredStudents = students.filter(s => {
    const matchSearch = !studentSearch ||
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.rollNo.includes(studentSearch) ||
      s.mobile.includes(studentSearch);
    const matchClass = selectedClass === 'all' || s.classId === selectedClass;
    return matchSearch && matchClass;
  });

  // ── Group handlers ──
  const handleAddGroup = async () => {
    if (!newName.trim() || !newNumber.trim()) {
      toast({ title: 'Fill all required fields', variant: 'destructive' }); return;
    }
    const cleaned = newNumber.trim().replace(/\s/g, '');
    if (!/^\+\d{10,15}$/.test(cleaned)) {
      toast({ title: 'Invalid format', description: 'Use +91XXXXXXXXXX', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      await addWhatsAppGroup(uid, { name: newName.trim(), number: cleaned, description: newDesc.trim() });
      setNewName(''); setNewNumber(''); setNewDesc(''); setShowAddForm(false);
      await loadGroups();
      toast({ title: '✅ Group saved' });
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleDeleteGroup = async (groupId: string, name: string) => {
    if (!window.confirm(`Remove group "${name}"?`)) return;
    try {
      await deleteWhatsAppGroup(uid, groupId);
      await loadGroups();
      toast({ title: 'Group removed' });
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleSendTestToGroup = async (group: WhatsAppGroup) => {
    if (!configured) { toast({ title: '⚠️ Twilio not configured', variant: 'destructive' }); return; }
    setSendingGroup(group.id);
    const result = await sendDirectMessage(group.number, testMessage);
    setSendingGroup(null);
    if (result.success) toast({ title: `✅ Sent to ${group.name}` });
    else toast({ title: 'Failed', description: result.error, variant: 'destructive' });
  };

  // ── Student handlers ──
  const handleSendToStudent = async (student: StudentContact) => {
    if (!configured) { toast({ title: '⚠️ Twilio not configured', variant: 'destructive' }); return; }
    setSendingStudent(student.rollNo);
    const msg = studentMessage.replace('{name}', student.name).replace('{rollNo}', student.rollNo).replace('{class}', student.classId);
    const result = await sendDirectMessage(student.mobile, msg);
    setSendingStudent(null);
    if (result.success) toast({ title: `✅ Sent to ${student.name}` });
    else toast({ title: 'Failed', description: result.error, variant: 'destructive' });
  };

  const handleBroadcastToClass = async () => {
    if (!configured) { toast({ title: '⚠️ Twilio not configured', variant: 'destructive' }); return; }
    if (!broadcastMsg.trim()) { toast({ title: 'Enter a message', variant: 'destructive' }); return; }
    const targets = students.filter(s => broadcastClass === 'all' || s.classId === broadcastClass);
    if (targets.length === 0) { toast({ title: 'No students with mobile numbers in this class', variant: 'destructive' }); return; }
    setSendingBroadcast(true);
    let sent = 0, failed = 0;
    for (const s of targets) {
      const msg = broadcastMsg.replace('{name}', s.name).replace('{rollNo}', s.rollNo).replace('{class}', s.classId);
      const r = await sendDirectMessage(s.mobile, msg);
      if (r.success) sent++; else failed++;
      await new Promise(r => setTimeout(r, 300));
    }
    setSendingBroadcast(false);
    toast({ title: `✅ Broadcast complete`, description: `${sent} sent · ${failed} failed` });
  };

  // ── Add student manually ──
  const handleAddStudentNumber = async () => {
    if (!newStudentName.trim() || !newStudentMobile.trim() || !newStudentClass.trim()) {
      toast({ title: 'Fill all fields', variant: 'destructive' }); return;
    }
    const cleaned = newStudentMobile.trim().replace(/\s/g, '');
    if (!/^\+\d{10,15}$/.test(cleaned)) {
      toast({ title: 'Invalid number', description: 'Use +91XXXXXXXXXX', variant: 'destructive' }); return;
    }
    setSavingStudent(true);
    try {
      const db = getDatabase(app);
      // Generate roll no from year + timestamp
      const rollNo = `${new Date().getFullYear()}${String(Date.now()).slice(-4)}`;
      await set(ref(db, `players/${newStudentClass.trim()}/${rollNo}`), {
        name: newStudentName.trim(),
        classId: newStudentClass.trim(),
        mobile: cleaned,
      });
      toast({ title: '✅ Student added', description: `${newStudentName} added with roll no ${rollNo}` });
      setNewStudentName(''); setNewStudentMobile(''); setNewStudentClass('');
      setShowAddStudent(false);
      await loadStudents();
    } catch (err: any) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally { setSavingStudent(false); }
  };

  // ── Direct message ──
  const handleSendDirect = async () => {
    if (!configured) { toast({ title: '⚠️ Twilio not configured', variant: 'destructive' }); return; }
    const cleaned = directNumber.trim().replace(/\s/g, '');
    if (!cleaned || !directMessage.trim()) { toast({ title: 'Fill number and message', variant: 'destructive' }); return; }
    setSendingDirect(true);
    const result = await sendDirectMessage(cleaned, directMessage);
    setSendingDirect(false);
    if (result.success) { toast({ title: `✅ Sent to ${cleaned}` }); setDirectMessage(''); }
    else toast({ title: 'Failed', description: result.error, variant: 'destructive' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-green-400" /> WhatsApp Manager
          </h2>
          <p className="text-gray-400 text-sm mt-1">Manage groups, students and send messages</p>
        </div>
        {configured ? (
          <span className="flex items-center gap-1.5 text-green-400 text-sm bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full">
            <Check className="h-3.5 w-3.5" /> Twilio Connected
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-full">
            <AlertCircle className="h-3.5 w-3.5" /> Not Configured
          </span>
        )}
      </div>

      {!configured && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-300 text-sm">
          <p className="font-semibold mb-1">⚙️ Setup Required</p>
          <pre className="mt-2 bg-black/30 rounded p-2 text-xs text-amber-200">
{`VITE_TWILIO_ACCOUNT_SID=ACxxxxxxxx
VITE_TWILIO_AUTH_TOKEN=your_token
VITE_TWILIO_WHATSAPP_FROM=whatsapp:+14155238886`}
          </pre>
          <p className="mt-2 text-xs">Get free credentials at <a href="https://console.twilio.com" target="_blank" rel="noreferrer" className="underline">console.twilio.com</a></p>
        </div>
      )}

      {/* ── STUDENTS SECTION ── */}
      <div className="bg-gray-900/60 border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-green-400" /> Students
            <span className="text-xs text-gray-500 font-normal">({students.length} with mobile)</span>
          </h3>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setShowAddStudent(v => !v)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-1.5 text-xs">
              <UserPlus className="h-3.5 w-3.5" /> Add Number
            </Button>
            <Button size="sm" variant="outline" onClick={loadStudents}
              className="border-gray-600 text-gray-300 rounded-xl text-xs">
              Refresh
            </Button>
          </div>
        </div>

        {/* Add student manually */}
        <AnimatePresence>
          {showAddStudent && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
              <div className="bg-gray-800/60 border border-white/10 rounded-xl p-4 mb-4 space-y-3">
                <p className="text-gray-400 text-xs">Add a student's WhatsApp number manually. They'll be stored in the Players list.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-gray-300 text-xs mb-1 block">Name *</Label>
                    <Input value={newStudentName} onChange={e => setNewStudentName(e.target.value)}
                      placeholder="e.g. Rahul Sharma" className="bg-gray-700 border-gray-600 text-white" />
                  </div>
                  <div>
                    <Label className="text-gray-300 text-xs mb-1 block">Class ID *</Label>
                    <Input value={newStudentClass} onChange={e => setNewStudentClass(e.target.value)}
                      placeholder="e.g. 11thBoys" className="bg-gray-700 border-gray-600 text-white"
                      list="class-options" />
                    <datalist id="class-options">
                      {uniqueClasses.map(c => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                  <div>
                    <Label className="text-gray-300 text-xs mb-1 block">Mobile * (+91XXXXXXXXXX)</Label>
                    <Input value={newStudentMobile} onChange={e => setNewStudentMobile(e.target.value)}
                      placeholder="+91XXXXXXXXXX" className="bg-gray-700 border-gray-600 text-white" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowAddStudent(false)} className="border-gray-600 text-gray-300">Cancel</Button>
                  <Button size="sm" onClick={handleAddStudentNumber} disabled={savingStudent} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {savingStudent ? 'Saving…' : 'Save Student'}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message template */}
        <div className="mb-4">
          <Label className="text-gray-400 text-xs mb-1 block">Message template <span className="text-gray-600">(use {'{name}'}, {'{rollNo}'}, {'{class}'})</span></Label>
          <Input value={studentMessage} onChange={e => setStudentMessage(e.target.value)}
            className="bg-gray-800 border-gray-600 text-white text-sm" />
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
            <Input value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
              placeholder="Search name, roll no…" className="pl-8 bg-gray-800 border-gray-600 text-white text-sm h-8" />
          </div>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
            className="bg-gray-800 border border-gray-600 text-gray-300 rounded-lg px-2 text-sm h-8">
            <option value="all">All Classes</option>
            {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Students list */}
        {loadingStudents ? (
          <p className="text-gray-500 text-sm py-4 text-center">Loading students…</p>
        ) : filteredStudents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Phone className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No students with mobile numbers found.</p>
            <p className="text-xs mt-1">Add mobile numbers in the Player Management tab or click "Add Number" above.</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {filteredStudents.map(s => (
              <motion.div key={`${s.classId}-${s.rollNo}`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center justify-between bg-gray-800/50 border border-white/5 rounded-xl px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{s.name}</p>
                  <p className="text-gray-500 text-xs flex items-center gap-2">
                    <span className="text-indigo-400">{s.classId}</span>
                    <span>·</span>
                    <span>{s.rollNo}</span>
                    <span>·</span>
                    <span className="text-green-400 flex items-center gap-0.5">
                      <Phone className="h-2.5 w-2.5" />{s.mobile}
                    </span>
                  </p>
                </div>
                <Button size="sm"
                  onClick={() => handleSendToStudent(s)}
                  disabled={sendingStudent === s.rollNo || !configured}
                  className="ml-2 bg-green-700 hover:bg-green-600 text-white text-xs h-7 px-2.5 rounded-lg gap-1 shrink-0"
                >
                  {sendingStudent === s.rollNo ? <span className="animate-spin text-xs">⟳</span> : <Send className="h-3 w-3" />}
                  Send
                </Button>
              </motion.div>
            ))}
          </div>
        )}

        {/* Broadcast to class */}
        <div className="mt-4 pt-4 border-t border-white/5">
          <p className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-purple-400" /> Broadcast to a Class
          </p>
          <div className="space-y-2">
            <div className="flex gap-2">
              <select value={broadcastClass} onChange={e => setBroadcastClass(e.target.value)}
                className="bg-gray-800 border border-gray-600 text-gray-300 rounded-xl px-3 text-sm flex-shrink-0">
                <option value="all">All Classes</option>
                {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="text-gray-500 text-xs self-center">
                {students.filter(s => broadcastClass === 'all' || s.classId === broadcastClass).length} students
              </span>
            </div>
            <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)}
              rows={3} placeholder="Broadcast message… (use {name}, {rollNo}, {class})"
              className="w-full bg-gray-800 border border-gray-600 text-white rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-purple-500" />
            <Button onClick={handleBroadcastToClass} disabled={sendingBroadcast || !configured}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl gap-2">
              {sendingBroadcast ? <><span className="animate-spin">⟳</span> Broadcasting…</> : <><Send className="h-4 w-4" /> Broadcast</>}
            </Button>
          </div>
        </div>
      </div>

      {/* ── GROUPS SECTION ── */}
      <div className="bg-gray-900/60 border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-400" /> WhatsApp Groups
            <span className="text-xs text-gray-500 font-normal">({groups.length} saved)</span>
          </h3>
          <Button size="sm" onClick={() => setShowAddForm(v => !v)}
            className="bg-green-600 hover:bg-green-700 text-white rounded-xl gap-1.5">
            <Plus className="h-4 w-4" /> Add Group
          </Button>
        </div>

        <AnimatePresence>
          {showAddForm && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
              <div className="bg-gray-800/60 rounded-xl p-4 mb-4 border border-white/10 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-gray-300 text-xs mb-1 block">Group Name *</Label>
                    <Input value={newName} onChange={e => setNewName(e.target.value)}
                      placeholder="e.g. Class 11 Boys" className="bg-gray-700 border-gray-600 text-white" />
                  </div>
                  <div>
                    <Label className="text-gray-300 text-xs mb-1 block">WhatsApp Number * (admin number)</Label>
                    <Input value={newNumber} onChange={e => setNewNumber(e.target.value)}
                      placeholder="+91XXXXXXXXXX" className="bg-gray-700 border-gray-600 text-white" />
                  </div>
                </div>
                <div>
                  <Label className="text-gray-300 text-xs mb-1 block">Description (optional)</Label>
                  <Input value={newDesc} onChange={e => setNewDesc(e.target.value)}
                    placeholder="e.g. 11th Science batch 2026" className="bg-gray-700 border-gray-600 text-white" />
                </div>
                <p className="text-xs text-gray-500">
                  ⚠️ Students must opt-in by sending <code className="bg-black/30 px-1 rounded">join &lt;sandbox-code&gt;</code> to your Twilio number first.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)} className="border-gray-600 text-gray-300">Cancel</Button>
                  <Button size="sm" onClick={handleAddGroup} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
                    {saving ? 'Saving…' : 'Save Group'}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mb-4">
          <Label className="text-gray-400 text-xs mb-1 block">Test message</Label>
          <Input value={testMessage} onChange={e => setTestMessage(e.target.value)}
            className="bg-gray-800 border-gray-600 text-white text-sm" />
        </div>

        {loadingGroups ? (
          <p className="text-gray-500 text-sm py-4 text-center">Loading groups…</p>
        ) : groups.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No groups saved yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map(g => (
              <motion.div key={g.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between bg-gray-800/50 border border-white/5 rounded-xl px-4 py-3">
                <div>
                  <p className="text-white font-medium text-sm">{g.name}</p>
                  <p className="text-green-400 text-xs flex items-center gap-1 mt-0.5">
                    <Phone className="h-3 w-3" /> {g.number}
                  </p>
                  {g.description && <p className="text-gray-500 text-xs mt-0.5">{g.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => handleSendTestToGroup(g)} disabled={sendingGroup === g.id || !configured}
                    className="bg-green-700 hover:bg-green-600 text-white text-xs h-8 px-3 rounded-lg gap-1">
                    {sendingGroup === g.id ? <span className="animate-spin">⟳</span> : <Send className="h-3 w-3" />}
                    Send Test
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteGroup(g.id, g.name)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-8 w-8 p-0 rounded-lg">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── DIRECT MESSAGE ── */}
      <div className="bg-gray-900/60 border border-white/10 rounded-2xl p-5">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Send className="h-5 w-5 text-purple-400" /> Send Direct Message
        </h3>
        <div className="space-y-3">
          <div>
            <Label className="text-gray-300 text-xs mb-1 block">Mobile Number (+91XXXXXXXXXX)</Label>
            <Input value={directNumber} onChange={e => setDirectNumber(e.target.value)}
              placeholder="+91XXXXXXXXXX" className="bg-gray-800 border-gray-600 text-white" />
          </div>
          <div>
            <Label className="text-gray-300 text-xs mb-1 block">Message</Label>
            <textarea value={directMessage} onChange={e => setDirectMessage(e.target.value)}
              rows={4} placeholder="Type your message here…"
              className="w-full bg-gray-800 border border-gray-600 text-white rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-indigo-500" />
          </div>
          <Button onClick={handleSendDirect} disabled={sendingDirect || !configured}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl gap-2">
            {sendingDirect ? <><span className="animate-spin">⟳</span> Sending…</> : <><Send className="h-4 w-4" /> Send Message</>}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppManager;
