import React, { useState, useEffect } from 'react';
import { getDatabase, ref, get, set, update, query, orderByKey, limitToLast } from 'firebase/database';
import { app } from '@/lib/firebaseConfig';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Search, Download, Edit, Trash2, AlertCircle, Upload, FileText, Phone, MessageCircle, DollarSign, Send, Users, CheckCircle, XCircle, Loader2, Crown, PlusCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { sendDirectMessage, sendFeeReminder, isBackendConfigured } from '@/services/whatsappWebService';
import { VIP_ADMIN_ROLL, VIP_ADMIN_NAME, VIP_ADMIN_CLASS, ensureVIPPlayerExists } from '@/utils/vipAdmin';
import PdfDownloadOverlay from '@/components/PdfDownloadOverlay';
import OrbitBackground from '@/components/ui/OrbitBackground';

// Deterministic gradient per class, mirrors QuizCard's subject accent system
const classAccent = (classId: string): string => {
  const palette = [
    'from-cyan-500 to-teal-500',
    'from-indigo-500 to-purple-600',
    'from-blue-500 to-indigo-500',
    'from-pink-500 to-rose-500',
    'from-emerald-500 to-green-600',
    'from-amber-500 to-orange-500',
  ];
  let hash = 0;
  for (let i = 0; i < classId.length; i++) hash = (hash * 31 + classId.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
};

// PDF.js worker setup — use new URL() so Vite bundles the worker locally
// and serves it from the same origin (avoids unpkg.com CORS blocks).
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface Player {
  rollNo: string;
  name: string;
  classId: string;
  mobile?: string;
  parentPhone?: string;
  feeAmount?: string;
  feeDueDate?: string;
  feePaid?: boolean;
  originalRollNo?: string;
  originalClassId?: string;
}

interface BulkPlayer { name: string; rollNo: string; mobile?: string; parentPhone?: string; }

// ---- Roll number generation for bulk ----
// Generates a random unique 6-digit roll number that does not collide
// with any already-used rolls (passed as a Set).
const generateUniqueRollNo = (usedRolls: Set<string>): string => {
  let roll: string;
  let attempts = 0;
  do {
    // Random 6-digit number: 100000–999999
    const n = Math.floor(100000 + Math.random() * 900000);
    roll = String(n);
    attempts++;
    if (attempts > 10000) break; // safety guard — should never hit
  } while (usedRolls.has(roll));
  usedRolls.add(roll);
  return roll;
};

// Valid roll number: exactly 6 digits
const isValidRollNo = (rollNo: string): boolean => /^\d{6}$/.test(rollNo);

const AdminPlayerManagementPage: React.FC = () => {
  const { toast } = useToast();
  const [players, setPlayers] = useState<Record<string, Player[]>>({});
  const [newPlayer, setNewPlayer] = useState<Player>({ rollNo: '', name: '', classId: '', mobile: '', parentPhone: '', feeAmount: '', feeDueDate: '', feePaid: false });
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [refreshPlayers, setRefreshPlayers] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // ---- Rename class dialog ----
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTargetClass, setRenameTargetClass] = useState('');
  const [renameNewClass, setRenameNewClass] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // ---- Bulk upload dialog ----
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkClassId, setBulkClassId] = useState('');
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkPreview, setBulkPreview] = useState<BulkPlayer[]>([]);
  const [isBulkExtracting, setIsBulkExtracting] = useState(false);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  // ---- PDF loading overlay ----
  const [pdfLoading, setPdfLoading] = useState(false);
  const withPdfLoading = async (fn: () => void | Promise<void>) => {
    setPdfLoading(true);
    try { await fn(); } finally { setTimeout(() => setPdfLoading(false), 400); }
  };

  // Effect to suggest next roll number
  useEffect(() => {
    const suggestNextRollNo = async () => {
      if (newPlayer.classId && !editingPlayer) {
        try {
          const db = getDatabase(app);
          const classPlayersRef = ref(db, `players/${newPlayer.classId}`);
          const playersQuery = query(classPlayersRef, orderByKey(), limitToLast(1));
          const snapshot = await get(playersQuery);

          let nextRollNo;
          if (snapshot.exists()) {
            const lastPlayerRollNo = Object.keys(snapshot.val())[0];
            nextRollNo = parseInt(lastPlayerRollNo, 10) + 1;
          } else {
            // Generate a random 6-digit starting roll number for a new class
            // Between 100,000 and 900,000 to keep it 6 digits
            nextRollNo = Math.floor(100000 + Math.random() * 800000);
          }
          setNewPlayer(prev => ({ ...prev, rollNo: String(nextRollNo).padStart(6, '0') }));
        } catch (error) {
          console.error('Error suggesting next roll number:', error);
        }
      }
    };
    suggestNextRollNo();
  }, [newPlayer.classId, editingPlayer]);

  const handleDownloadPdf = (classId: string) => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const PW = doc.internal.pageSize.getWidth();
      const PH = doc.internal.pageSize.getHeight();
      const M  = 14;

      const classPlayers = (players[classId] || []).sort((a, b) => a.rollNo.localeCompare(b.rollNo));

      // ── Branded header band ───────────────────────────────────────────────
      doc.setFillColor(30, 27, 75); // indigo-900
      doc.rect(0, 0, PW, 30, 'F');

      try { doc.addImage('/msplogo.jpg', 'JPEG', M, 4, 20, 20); } catch (_) {}

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('PCCOER EDUCATION PLATFORM', PW / 2, 12, { align: 'center' });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(199, 210, 254);
      doc.text(
        `Student List  ·  Class: ${classId}  ·  Total: ${classPlayers.length}`,
        PW / 2, 20, { align: 'center' }
      );
      doc.text(
        new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        PW / 2, 26, { align: 'center' }
      );

      autoTable(doc, {
        head: [['Roll Number', 'Student Name']],
        body: classPlayers.map(p => [p.rollNo, p.name]),
        startY: 36,
        theme: 'grid',
        styles: {
          fontSize: 10,
          cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 },
          valign: 'middle',
          lineWidth: 0.2,
          lineColor: [209, 213, 219],
        },
        headStyles: {
          fillColor: [30, 27, 75],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 10.5,
        },
        columnStyles: {
          0: { cellWidth: 45, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 'auto' },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { top: 36, bottom: 18, left: M, right: M },
        didDrawPage: () => {
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.3);
          doc.line(M, PH - 10, PW - M, PH - 10);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(148, 163, 184);
          doc.text(
            `PCCOER Education Platform  ·  Class: ${classId}  ·  Auto-generated`,
            PW / 2, PH - 5.5, { align: 'center' }
          );
          doc.text('Created by Mr. Suraj Zalke', M, PH - 5.5);
          doc.text(`Page ${doc.getNumberOfPages()}`, PW - M, PH - 5.5, { align: 'right' });
        },
      });

      doc.save(`Students_${classId}.pdf`);

      toast({
        title: 'PDF Downloaded',
        description: `Student list for ${classId} has been downloaded.`,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Download Failed',
        description: 'An error occurred while generating the PDF.',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        // Ensure VIP admin is always in the database
        await ensureVIPPlayerExists();

        const db = getDatabase(app);
        const playersRef = ref(db, 'players');
        const snapshot = await get(playersRef);

        if (snapshot.exists()) {
          const playersData = snapshot.val();
          const groupedPlayers: Record<string, Player[]> = {};
          for (const classId in playersData) {
            if (playersData.hasOwnProperty(classId)) {
              const classPlayers = playersData[classId];
              groupedPlayers[classId] = [];
              for (const rollNo in classPlayers) {
                if (classPlayers.hasOwnProperty(rollNo)) {
                  groupedPlayers[classId].push({
                    rollNo: rollNo,
                    name: classPlayers[rollNo].name,
                    classId: classId,
                    mobile: classPlayers[rollNo].mobile || '',
                    parentPhone: classPlayers[rollNo].parentPhone || '',
                    feeAmount: classPlayers[rollNo].feeAmount || '',
                    feeDueDate: classPlayers[rollNo].feeDueDate || '',
                    feePaid: classPlayers[rollNo].feePaid || false,
                  });
                }
              }
            }
          }
          setPlayers(groupedPlayers);
        } else {
          setPlayers({});
        }


      } catch (error) {
        console.error('Error fetching players:', error);
      toast({
        title: 'Error',
        description: `Failed to load players: ${error.message || error}`,
        variant: 'destructive',
        });
      }
    };

    fetchPlayers();
  }, [toast, refreshPlayers]);

  const handleAddPlayer = async () => {
    if (!newPlayer.rollNo || !newPlayer.name || !newPlayer.classId) {
      toast({
        title: 'Error',
        description: 'Please fill all fields (Class ID, Roll Number, Player Name).',
        variant: 'destructive',
      });
      return;
    }

    if (!isValidRollNo(newPlayer.rollNo)) {
      toast({
        title: 'Error',
        description: 'Roll Number must be exactly 6 digits.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const db = getDatabase(app);
      const playerRef = ref(db, `players/${newPlayer.classId}/${newPlayer.rollNo}`);
      await set(playerRef, { name: newPlayer.name, classId: newPlayer.classId, mobile: newPlayer.mobile || '', parentPhone: newPlayer.parentPhone || '', feeAmount: newPlayer.feeAmount || '', feeDueDate: newPlayer.feeDueDate || '', feePaid: newPlayer.feePaid || false });

      // Also add the classId to the 'classes' node if it doesn't exist
      const classRef = ref(db, `classes/${newPlayer.classId}`);
      await set(classRef, true); // Set to true or any value to indicate existence


      setNewPlayer({ rollNo: '', name: '', classId: '', mobile: '', parentPhone: '', feeAmount: '', feeDueDate: '', feePaid: false });
      toast({
        title: 'Success',
        description: 'Player added successfully!',
      });
      setRefreshPlayers(prev => !prev);
    } catch (error) {
      console.error('Error adding player:', error);
      toast({
        title: 'Error',
        description: `Failed to add player: ${error.message || error}`,
        variant: 'destructive',
      });
    }
  };

  const handleUpdatePlayer = async () => {
    if (!editingPlayer) return;

    if (!isValidRollNo(editingPlayer.rollNo)) {
      toast({
        title: 'Error',
        description: 'Roll Number must be exactly 6 digits.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const db = getDatabase(app);
      const oldPlayerRef = ref(db, `players/${editingPlayer.originalClassId}/${editingPlayer.originalRollNo}`);
      const newPlayerRef = ref(db, `players/${editingPlayer.classId}/${editingPlayer.rollNo}`);

      const rollNoChanged = editingPlayer.rollNo !== editingPlayer.originalRollNo;
      const classIdChanged = editingPlayer.classId !== editingPlayer.originalClassId;

      if (rollNoChanged || classIdChanged) {
        // Delete old entry
        await set(oldPlayerRef, null);
        // Create new entry
        await set(newPlayerRef, { name: editingPlayer.name, classId: editingPlayer.classId, mobile: editingPlayer.mobile || '', parentPhone: editingPlayer.parentPhone || '', feeAmount: editingPlayer.feeAmount || '', feeDueDate: editingPlayer.feeDueDate || '', feePaid: editingPlayer.feePaid || false });

        // Update class entry if classId changed
        if (classIdChanged) {
          const newClassRef = ref(db, `classes/${editingPlayer.classId}`);
          await set(newClassRef, true);
          // Optionally, check if old class is empty and remove it
          const oldClassPlayersRef = ref(db, `players/${editingPlayer.originalClassId}`);
          const oldClassSnapshot = await get(oldClassPlayersRef);
          if (oldClassSnapshot.exists() && Object.keys(oldClassSnapshot.val()).length === 0) {
            await set(ref(db, `classes/${editingPlayer.originalClassId}`), null);
          }
        }
      } else {
        // Only name/mobile changed, update existing entry
        await update(newPlayerRef, { name: editingPlayer.name, mobile: editingPlayer.mobile || '', parentPhone: editingPlayer.parentPhone || '', feeAmount: editingPlayer.feeAmount || '', feeDueDate: editingPlayer.feeDueDate || '', feePaid: editingPlayer.feePaid || false });
      }

      setPlayers(prevPlayers => {
        const updatedPlayers = { ...prevPlayers };
        if (updatedPlayers[editingPlayer.classId]) {
          updatedPlayers[editingPlayer.classId] = updatedPlayers[editingPlayer.classId].map(p =>
            p.rollNo === editingPlayer.rollNo ? editingPlayer : p
          );
        }
        return updatedPlayers;
      });
      setEditingPlayer(null);
      toast({
        title: 'Success',
        description: 'Player updated successfully!',
      });
      setRefreshPlayers(prev => !prev);
    } catch (error) {
      console.error('Error updating player:', error);
      toast({
        title: 'Error',
        description: `Failed to update player: ${error.message || error}`,
        variant: 'destructive',
      });
    }
  };

  const handleDeletePlayer = async (rollNo: string, classId: string) => {
    try {
      const db = getDatabase(app);
      const playerRef = ref(db, `players/${classId}/${rollNo}`);
      await set(playerRef, null);

      setPlayers(prevPlayers => {
        const updatedPlayers = { ...prevPlayers };
        if (updatedPlayers[classId]) {
          updatedPlayers[classId] = updatedPlayers[classId].filter(p => p.rollNo !== rollNo);
          if (updatedPlayers[classId].length === 0) {
            delete updatedPlayers[classId];
          }
        }
        return updatedPlayers;
      });
      toast({
        title: 'Success',
        description: 'Player deleted successfully!',
      });
      setRefreshPlayers(prev => !prev);
    } catch (error) {
      console.error('Error deleting player:', error);
      toast({
        title: 'Error',
        description: `Failed to delete player: ${error.message || error}`,
        variant: 'destructive',
      });
    }
  };

  // ---- Rename class: move all players to new classId ----
  const handleRenameClass = async () => {
    if (!renameTargetClass.trim() || !renameNewClass.trim()) {
      toast({ title: 'Fill both fields', variant: 'destructive' }); return;
    }
    if (renameTargetClass.trim() === renameNewClass.trim()) {
      toast({ title: 'Names are the same', variant: 'destructive' }); return;
    }
    setIsRenaming(true);
    try {
      const db = getDatabase(app);
      const classPlayers = players[renameTargetClass.trim()] || [];
      if (classPlayers.length === 0) {
        toast({ title: 'No players in that class', variant: 'destructive' });
        setIsRenaming(false); return;
      }
      for (const p of classPlayers) {
        await set(ref(db, `players/${renameNewClass.trim()}/${p.rollNo}`), { name: p.name, classId: renameNewClass.trim() });
        await set(ref(db, `players/${renameTargetClass.trim()}/${p.rollNo}`), null);
      }
      await set(ref(db, `players/${renameTargetClass.trim()}`), null);
      await set(ref(db, `classes/${renameTargetClass.trim()}`), null);
      await set(ref(db, `classes/${renameNewClass.trim()}`), true);
      toast({ title: 'Class renamed', description: `"${renameTargetClass}" → "${renameNewClass}" (${classPlayers.length} players moved)` });
      setRenameDialogOpen(false); setRenameTargetClass(''); setRenameNewClass('');
      setRefreshPlayers(p => !p);
    } catch (err: any) {
      toast({ title: 'Rename failed', description: err.message, variant: 'destructive' });
    } finally { setIsRenaming(false); }
  };

  // ---- Bulk upload helpers ----
  const extractTextFromPdf = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const typedArray = new Uint8Array(e.target!.result as ArrayBuffer);
          const pdf = await getDocument({ data: typedArray }).promise;
          let text = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += (content.items as TextItem[]).map(item => item.str).join(' ') + '\n';
          }
          resolve(text);
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('Failed to read PDF'));
      reader.readAsArrayBuffer(file);
    });
  };

  const extractTextFromImage = async (file: File): Promise<string> => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target!.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // Collect all available API keys
    const keys: string[] = (() => {
      try {
        const raw = import.meta.env.VITE_GEMINI_KEYS || '';
        if (raw.startsWith('[')) return JSON.parse(raw).filter(Boolean);
        if (raw.trim()) return [raw.trim()];
      } catch {}
      return [];
    })();
    const singleKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    const allKeys = [...new Set([...keys, singleKey].filter(Boolean))];
    if (allKeys.length === 0) throw new Error('No Gemini API key configured');

    // Models to try in order (fallback from newer to stable)
    const models = ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-pro'];
    const prompt = 'Extract all text from this image exactly as written.';
    const inlineData = { data: base64, mimeType: file.type as 'image/jpeg' | 'image/png' };

    let lastError: Error = new Error('All Gemini keys and models exhausted');

    for (const apiKey of allKeys) {
      for (const modelName of models) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent([{ inlineData }, prompt]);
            return result.response.text();
          } catch (err: any) {
            lastError = err;
            const msg: string = err?.message || '';
            // 503 overloaded → try next model, don't retry same one
            if (msg.includes('503') || msg.includes('overloaded') || msg.includes('high demand')) {
              break; // break attempt loop, go to next model
            }
            // 429 rate limited → wait briefly then retry once
            if (msg.includes('429') && attempt === 0) {
              await new Promise(r => setTimeout(r, 2000));
              continue;
            }
            // Other errors (key invalid, etc.) → skip this key
            break;
          }
        }
      }
    }
    throw lastError;
  };

  const handleDownloadTemplate = (slots: number = 30) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const classLabel = bulkClassId.trim() || '_______________';

    // ── Header ──
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('PCCOER EDUCATION PLATFORM', pageWidth / 2, 14, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 70, 70);
    doc.text('Student Data Entry Sheet  -  Fill & Upload as Image', pageWidth / 2, 22, { align: 'center' });

    // Horizontal rule under heading
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.line(15, 26, pageWidth - 15, 26);

    // Class & Date line
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    doc.text(`Class: ${classLabel}`, 15, 32);
    doc.text(`Date: ${today}`, pageWidth - 15, 32, { align: 'right' });

    // ── Instructions box — plain text, no emojis ──
    doc.setFillColor(235, 245, 255);
    doc.setDrawColor(100, 149, 237);
    doc.setLineWidth(0.5);
    doc.roundedRect(15, 36, pageWidth - 30, 18, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 50, 120);
    doc.text('INSTRUCTIONS:', 18, 42);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 60, 130);
    doc.text(
      '1. Fill in Student Name, Student Mobile (+91...) and Parent Mobile (+91...) for each row.',
      18, 48
    );
    doc.text(
      '2. Take a clear photo of this filled sheet and upload it in the Bulk Upload dialog to auto-import all students.',
      18, 53.5
    );

    // ── Table — roll number column left blank for teacher to fill ──
    const rows: string[][] = Array.from({ length: slots }, () => ['', '', '', '']);

    autoTable(doc, {
      head: [['#', 'Student Name', 'Student Mobile', 'Parent Mobile']],
      body: rows,
      startY: 57,
      theme: 'grid',
      styles: {
        fontSize: 9.5,
        cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
        valign: 'middle',
        textColor: [30, 30, 30],
        lineColor: [180, 180, 180],
        lineWidth: 0.25,
        font: 'helvetica',
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 9.5,
      },
      columnStyles: {
        0: { cellWidth: 14, halign: 'center', fontStyle: 'bold', textColor: [80, 80, 80] },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 42 },
        3: { cellWidth: 42 },
      },
      // Draw row number (1, 2, 3…) in the first column
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 0) {
          data.cell.text = [String(data.row.index + 1)];
        }
      },
      alternateRowStyles: { fillColor: [245, 250, 255] },
      margin: { top: 57, bottom: 20, left: 15, right: 15 },
      didDrawPage: (data: any) => {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text(
          'Created by Mr. Suraj Zalke  |  PCCOER Education Platform',
          pageWidth / 2, pageHeight - 8, { align: 'center' }
        );
        doc.text(`Page ${data.pageNumber}`, pageWidth - 15, pageHeight - 8, { align: 'right' });
      },
    });

    doc.save(`StudentTemplate_${classLabel.replace(/\s+/g, '_')}.pdf`);
    toast({ title: 'Template downloaded', description: 'Print, fill in student details, then photo-upload the sheet.' });
  };

  const handleBulkExtract = async () => {
    if (!bulkFile) { toast({ title: 'Select a file first', variant: 'destructive' }); return; }
    setIsBulkExtracting(true); setBulkPreview([]);
    try {
      let text = '';
      if (bulkFile.type === 'application/pdf') text = await extractTextFromPdf(bulkFile);
      else if (bulkFile.type.startsWith('image/')) text = await extractTextFromImage(bulkFile);
      else { toast({ title: 'Unsupported file', description: 'Use PDF, PNG, or JPG.', variant: 'destructive' }); return; }

      const { callAIAPI } = await import('@/services/aiProviderManager');
      const prompt = `Extract student data from the text. Return ONLY a JSON array with no extra text:
[{"name":"Student Name","rollNo":"","mobile":"+91XXXXXXXXXX","parentPhone":"+91XXXXXXXXXX"},...]
Rules:
- "name": real student name only, ignore headers/column titles.
- "rollNo": 6-digit number if present next to the name, else "".
- "mobile": student mobile number if present (keep country code like +91), else "".
- "parentPhone": parent mobile number if present, else "".
- Include every student row. Do not skip any.
Text: ${text.substring(0, 5000)}`;
      const response = await callAIAPI(prompt, 'auto');
      let jsonStr = response.text.trim();
      const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fence) jsonStr = fence[1];
      else { const f = jsonStr.indexOf('['), l = jsonStr.lastIndexOf(']'); if (f !== -1 && l > f) jsonStr = jsonStr.slice(f, l + 1); }
      const parsed: { name: string; rollNo?: string; mobile?: string; parentPhone?: string }[] = JSON.parse(jsonStr);

      // Collect all existing roll numbers from Firebase to avoid collisions
      const db = getDatabase(app);
      const existingSnap = await get(ref(db, 'players'));
      const usedRolls = new Set<string>();
      if (existingSnap.exists()) {
        const allClasses = existingSnap.val() as Record<string, Record<string, any>>;
        for (const cls of Object.values(allClasses)) {
          for (const roll of Object.keys(cls)) usedRolls.add(roll);
        }
      }

      const preview: BulkPlayer[] = parsed.map((item) => ({
        name: item.name,
        rollNo: (item.rollNo && /^\d{6}$/.test(item.rollNo) && !usedRolls.has(item.rollNo))
          ? (() => { usedRolls.add(item.rollNo!); return item.rollNo!; })()
          : generateUniqueRollNo(usedRolls),
        mobile: item.mobile || '',
        parentPhone: item.parentPhone || '',
      }));
      setBulkPreview(preview);
      toast({ title: 'Extraction done', description: `Found ${preview.length} students. Review and confirm.` });
    } catch (err: any) {
      toast({ title: 'Extraction failed', description: err.message, variant: 'destructive' });
    } finally { setIsBulkExtracting(false); }
  };

  const handleBulkSave = async () => {
    if (bulkPreview.length === 0) return;
    if (!bulkClassId.trim()) { toast({ title: 'Enter Class ID first', variant: 'destructive' }); return; }
    setIsBulkSaving(true);
    let ok = 0, fail = 0;
    try {
      const db = getDatabase(app);
      await set(ref(db, `classes/${bulkClassId.trim()}`), true);
      for (const p of bulkPreview) {
        try {
          await set(ref(db, `players/${bulkClassId.trim()}/${p.rollNo}`), {
            name: p.name,
            classId: bulkClassId.trim(),
            mobile: p.mobile || '',
            parentPhone: p.parentPhone || '',
            feeAmount: '',
            feeDueDate: '',
            feePaid: false,
          });
          ok++;
        } catch { fail++; }
      }
      toast({ title: 'Bulk upload complete', description: `${ok} students added${fail > 0 ? `, ${fail} failed` : ''}.` });
      setBulkDialogOpen(false); setBulkFile(null); setBulkClassId(''); setBulkPreview([]);
      setRefreshPlayers(p => !p);
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally { setIsBulkSaving(false); }
  };

  // ---- Delete entire class ----
  const handleDeleteClass = async (classId: string) => {
    if (!window.confirm(`Delete ALL students in class "${classId}"? This cannot be undone.`)) return;
    try {
      const db = getDatabase(app);
      await set(ref(db, `players/${classId}`), null);
      await set(ref(db, `classes/${classId}`), null);
      toast({ title: 'Class deleted', description: `All students in "${classId}" have been removed.` });
      setRefreshPlayers(p => !p);
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  // ---- WhatsApp: send message to one student ----
  const [sendingWA, setSendingWA] = useState<string | null>(null);
  const handleSendWhatsApp = async (player: Player, type: 'msg' | 'fee') => {
    const phone = player.mobile;
    if (!phone) { toast({ title: 'No phone number', description: 'Add a mobile number first.', variant: 'destructive' }); return; }
    if (!isBackendConfigured()) { toast({ title: 'WhatsApp not connected', variant: 'destructive' }); return; }
    setSendingWA(`${type}-${player.rollNo}`);
    try {
      if (type === 'msg') {
        const msg = prompt(`Send WhatsApp to ${player.name} (${phone}):\nType your message:`);
        if (!msg) { setSendingWA(null); return; }
        await sendDirectMessage(phone, msg);
        if (player.parentPhone) await sendDirectMessage(player.parentPhone, msg);
        toast({ title: `✅ Sent to ${player.name}` });
      } else {
        // Fee reminder
        if (!player.feeAmount || !player.feeDueDate) {
          toast({ title: 'Fee details missing', description: 'Add fee amount and due date first.', variant: 'destructive' });
          setSendingWA(null); return;
        }
        await sendFeeReminder({
          studentName: player.name,
          studentPhone: player.mobile,
          parentPhone: player.parentPhone,
          amountDue: player.feeAmount,
          dueDate: player.feeDueDate,
          batch: player.classId,
        });
        toast({ title: `💰 Fee reminder sent to ${player.name}` });
      }
    } catch (err: any) {
      toast({ title: 'Send failed', description: err.message, variant: 'destructive' });
    } finally { setSendingWA(null); }
  };

  // ---- WhatsApp: mark fee paid ----
  const handleMarkFeePaid = async (player: Player) => {
    try {
      const db = getDatabase(app);
      await update(ref(db, `players/${player.classId}/${player.rollNo}`), { feePaid: true });
      toast({ title: `✅ ${player.name} marked as fee paid` });
      setRefreshPlayers(p => !p);
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      <PdfDownloadOverlay visible={pdfLoading} label="Generating PDF…" />
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Player Management</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-4">Add, edit, or delete player names and their associated roll numbers.</p>

      {/* ---- Top action buttons ---- */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Button
          variant="outline"
          onClick={() => setRenameDialogOpen(true)}
          className="border-yellow-500 text-yellow-400 hover:bg-yellow-900/20"
        >
          ✏️ Edit Class ID
        </Button>
        <Button
          variant="outline"
          onClick={() => setBulkDialogOpen(true)}
          className="border-green-500 text-green-400 hover:bg-green-900/20"
        >
          <Upload className="mr-2 h-4 w-4" /> Bulk Upload Students
        </Button>
        <Button
          variant="outline"
          onClick={() => withPdfLoading(() => handleDownloadTemplate(30))}
          disabled={pdfLoading}
          className="border-blue-500 text-blue-400 hover:bg-blue-900/20 disabled:opacity-60"
        >
          <Download className="mr-2 h-4 w-4" /> Download Template PDF
        </Button>
      </div>

      {/* ---- Rename Class Dialog ---- */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-[420px] bg-gray-900 border border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Edit / Rename Class ID</DialogTitle>
            <DialogDescription className="text-gray-400">
              All players in the old class will be moved to the new class ID.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label className="text-gray-300 mb-1 block">Current Class ID</Label>
              <Input
                value={renameTargetClass}
                onChange={(e) => setRenameTargetClass(e.target.value)}
                placeholder="e.g., 11thBoys"
                list="existing-classes"
                className="bg-gray-800 border-gray-600 text-white"
              />
              <datalist id="existing-classes">
                {Object.keys(players).map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <Label className="text-gray-300 mb-1 block">New Class ID</Label>
              <Input
                value={renameNewClass}
                onChange={(e) => setRenameNewClass(e.target.value)}
                placeholder="e.g., Class-11-Boys"
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)} className="border-gray-600 text-gray-300">Cancel</Button>
            <Button onClick={handleRenameClass} disabled={isRenaming} className="bg-yellow-600 hover:bg-yellow-700 text-white">
              {isRenaming ? 'Renaming...' : 'Rename Class'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Bulk Upload Dialog ---- */}
      <Dialog open={bulkDialogOpen} onOpenChange={(o) => { setBulkDialogOpen(o); if (!o) { setBulkFile(null); setBulkPreview([]); setBulkClassId(''); } }}>
        <DialogContent className="sm:max-w-[540px] bg-gray-900 border border-gray-700 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-400" /> Bulk Upload Students
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Upload a PDF or image containing a student name list. AI will extract names and auto-assign roll numbers.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label className="text-gray-300 mb-1 block">Class ID</Label>
              <Input
                value={bulkClassId}
                onChange={(e) => setBulkClassId(e.target.value)}
                placeholder="e.g., Class-11A, 11thBoys"
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-300 mb-1 block">Student List File (PDF, PNG, JPG)</Label>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => { if (e.target.files?.[0]) { setBulkFile(e.target.files[0]); setBulkPreview([]); } }}
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>
            <Button
              type="button"
              onClick={handleBulkExtract}
              disabled={isBulkExtracting || !bulkFile}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isBulkExtracting ? <span className="flex items-center gap-2"><span className="animate-spin">⟳</span> Extracting...</span> : 'Extract Student Names'}
            </Button>
            {bulkPreview.length > 0 && (
              <div>
                <p className="text-green-400 text-sm mb-2 font-medium">Preview — {bulkPreview.length} students found:</p>
                <div className="max-h-52 overflow-y-auto rounded border border-gray-700">
                  <Table>
                    <TableHeader className="bg-gray-800">
                      <TableRow>
                        <TableHead className="text-gray-300">#</TableHead>
                        <TableHead className="text-gray-300">Name</TableHead>
                        <TableHead className="text-gray-300">Roll No</TableHead>
                        <TableHead className="text-gray-300">Student Mobile</TableHead>
                        <TableHead className="text-gray-300">Parent Mobile</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bulkPreview.map((s, i) => (
                        <TableRow key={i} className="border-b border-gray-700">
                          <TableCell className="text-gray-400">{i + 1}</TableCell>
                          <TableCell className="text-white font-medium">{s.name}</TableCell>
                          <TableCell className="text-blue-300">{s.rollNo}</TableCell>
                          <TableCell className="text-green-400 text-xs">{s.mobile || '—'}</TableCell>
                          <TableCell className="text-cyan-400 text-xs">{s.parentPhone || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)} className="border-gray-600 text-gray-300">Cancel</Button>
            {bulkPreview.length > 0 && (
              <Button onClick={handleBulkSave} disabled={isBulkSaving || !bulkClassId.trim()} className="bg-green-600 hover:bg-green-700 text-white">
                {isBulkSaving ? 'Saving...' : `Confirm & Add ${bulkPreview.length} Students`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Add / Edit Player Card ---- */}
      <div className="relative overflow-hidden lab-panel lab-panel-glow mb-8">
        <OrbitBackground />
        <div className="relative z-10 p-6">
          <div className="flex items-center gap-2 mb-6">
            <span className="stat-icon-chip bg-gradient-to-br from-cyan-500 to-indigo-600 text-white">
              {editingPlayer ? <Edit className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
            </span>
            <h2 className="lab-heading text-xl">
              {editingPlayer ? `Edit: ${editingPlayer.name}` : 'Add New Student'}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Row 1: Class, Roll, Name */}
            <div>
              <Label className="block text-sm font-medium text-gray-300 mb-1.5 font-display">Class ID</Label>
              <Input
                placeholder="e.g., 10th Grade"
                value={editingPlayer ? editingPlayer.classId : newPlayer.classId}
                onChange={(e) => editingPlayer ? setEditingPlayer({ ...editingPlayer, classId: e.target.value }) : setNewPlayer({ ...newPlayer, classId: e.target.value })}
                className="lab-input text-white placeholder:text-gray-500 rounded-xl h-11"
              />
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-300 mb-1.5 font-display">Roll Number (auto)</Label>
              <Input
                value={editingPlayer ? editingPlayer.rollNo : newPlayer.rollNo}
                disabled
                className="lab-input !bg-white/[0.02] text-gray-400 rounded-xl h-11 cursor-not-allowed"
              />
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-300 mb-1.5 font-display">Student Name</Label>
              <Input
                placeholder="e.g., Rahul Sharma"
                value={editingPlayer ? editingPlayer.name : newPlayer.name}
                onChange={(e) => editingPlayer ? setEditingPlayer({ ...editingPlayer, name: e.target.value }) : setNewPlayer({ ...newPlayer, name: e.target.value })}
                className="lab-input text-white placeholder:text-gray-500 rounded-xl h-11"
              />
            </div>
            {/* Row 2: Mobile, Parent Phone */}
            <div>
              <Label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5 font-display">
                <Phone className="h-3.5 w-3.5 text-emerald-400" /> Student Mobile (WhatsApp)
              </Label>
              <Input
                placeholder="+91XXXXXXXXXX"
                value={editingPlayer ? (editingPlayer.mobile || '') : (newPlayer.mobile || '')}
                onChange={(e) => editingPlayer ? setEditingPlayer({ ...editingPlayer, mobile: e.target.value }) : setNewPlayer({ ...newPlayer, mobile: e.target.value })}
                className="lab-input text-white placeholder:text-gray-500 rounded-xl h-11 focus:!border-emerald-400/60"
              />
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5 font-display">
                <Users className="h-3.5 w-3.5 text-blue-400" /> Parent Mobile (WhatsApp)
              </Label>
              <Input
                placeholder="+91XXXXXXXXXX"
                value={editingPlayer ? (editingPlayer.parentPhone || '') : (newPlayer.parentPhone || '')}
                onChange={(e) => editingPlayer ? setEditingPlayer({ ...editingPlayer, parentPhone: e.target.value }) : setNewPlayer({ ...newPlayer, parentPhone: e.target.value })}
                className="lab-input text-white placeholder:text-gray-500 rounded-xl h-11 focus:!border-blue-400/60"
              />
            </div>
            {/* Row 3: Fee Amount, Due Date, Fee Paid */}
            <div>
              <Label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5 font-display">
                <DollarSign className="h-3.5 w-3.5 text-amber-400" /> Fee Amount (₹)
              </Label>
              <Input
                placeholder="e.g., 5000"
                type="number"
                value={editingPlayer ? (editingPlayer.feeAmount || '') : (newPlayer.feeAmount || '')}
                onChange={(e) => editingPlayer ? setEditingPlayer({ ...editingPlayer, feeAmount: e.target.value }) : setNewPlayer({ ...newPlayer, feeAmount: e.target.value })}
                className="lab-input text-white placeholder:text-gray-500 rounded-xl h-11 focus:!border-amber-400/60"
              />
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-300 mb-1.5 font-display">Fee Due Date</Label>
              <Input
                type="date"
                value={editingPlayer ? (editingPlayer.feeDueDate || '') : (newPlayer.feeDueDate || '')}
                onChange={(e) => editingPlayer ? setEditingPlayer({ ...editingPlayer, feeDueDate: e.target.value }) : setNewPlayer({ ...newPlayer, feeDueDate: e.target.value })}
                className="lab-input text-white rounded-xl h-11 [color-scheme:dark]"
              />
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2.5 cursor-pointer mt-5 lab-input rounded-xl h-11 px-4 w-full">
                <input
                  type="checkbox"
                  checked={editingPlayer ? (editingPlayer.feePaid || false) : (newPlayer.feePaid || false)}
                  onChange={(e) => editingPlayer ? setEditingPlayer({ ...editingPlayer, feePaid: e.target.checked }) : setNewPlayer({ ...newPlayer, feePaid: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded"
                />
                <span className="text-sm text-gray-300 flex items-center gap-1.5 font-display">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> Fee Paid
                </span>
              </label>
            </div>
          </div>
          {/* Buttons */}
          <div className="flex gap-3 mt-6">
            <Button
              onClick={editingPlayer ? handleUpdatePlayer : handleAddPlayer}
              className="bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:opacity-90 text-white font-semibold font-display px-6 h-11 rounded-xl shadow-lg shadow-indigo-500/25"
            >
              {editingPlayer ? 'Update Student' : 'Add Student'}
            </Button>
            {editingPlayer && (
              <Button variant="outline" onClick={() => setEditingPlayer(null)}
                className="border-white/10 text-gray-300 hover:bg-white/10 hover:text-white h-11 rounded-xl">
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 lab-panel overflow-hidden">
        <div className="p-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="stat-icon-chip bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
              <Users className="h-4 w-4" />
            </span>
            <h2 className="lab-heading text-xl">Existing Players</h2>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <Input
              placeholder="Search by name or roll number..."
              className="w-full pl-10 pr-4 lab-input text-white placeholder:text-gray-500 rounded-xl h-11"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="p-0">
          {Object.keys(players).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <Users className="h-12 w-12 opacity-20 mb-3" />
              <p>No players added yet. Use the form above to add new players.</p>
            </div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {Object.entries(players).sort(([classIdA], [classIdB]) => classIdA.localeCompare(classIdB)).map(([classId, classPlayers]) => {
                const filteredClassPlayers = classPlayers.filter(player =>
                  player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  player.rollNo.includes(searchTerm)
                );

                if (filteredClassPlayers.length === 0 && searchTerm !== '') {
                  return null; // Don't show class if no players match search term
                }

                return (
                  <AccordionItem key={classId} value={classId} className="border-b border-white/5 last:border-b-0">
                    <AccordionTrigger className="flex justify-between items-center px-6 py-4 text-white hover:bg-white/[0.03] hover:no-underline group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 bg-gradient-to-br ${classAccent(classId)} text-white shadow-md`}>
                          {classId.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="text-left min-w-0">
                          <p className="font-semibold font-display truncate group-hover:text-cyan-300 transition-colors">{classId}</p>
                          <p className="text-xs text-gray-500">{filteredClassPlayers.length} players</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            withPdfLoading(() => handleDownloadPdf(classId));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                              withPdfLoading(() => handleDownloadPdf(classId));
                            }
                          }}
                          className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-full border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 cursor-pointer transition-all duration-200"
                        >
                          <Download className="mr-1.5 h-3.5 w-3.5" /> <span className="hidden sm:inline">Download PDF</span>
                        </div>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!isBackendConfigured()) { toast({ title: 'WhatsApp not connected', variant: 'destructive' }); return; }
                            const msg = prompt(`📢 Broadcast to all students in "${classId}":\nType your message:`);
                            if (!msg) return;
                            try {
                              const { sendClassBroadcast } = await import('@/services/whatsappWebService');
                              const r = await sendClassBroadcast({ className: classId, message: msg, includeParents: true });
                              toast({ title: `✅ Broadcast sent`, description: `${r.sent} sent · ${r.failed ?? 0} failed` });
                            } catch (err: any) {
                              toast({ title: 'Broadcast failed', description: err.message, variant: 'destructive' });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                            }
                          }}
                          className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-full border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 cursor-pointer transition-all duration-200"
                        >
                          <Send className="mr-1.5 h-3.5 w-3.5" /> <span className="hidden sm:inline">Broadcast</span>
                        </div>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClass(classId);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                              handleDeleteClass(classId);
                            }
                          }}
                          className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-full border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-300 cursor-pointer transition-all duration-200"
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> <span className="hidden sm:inline">Delete Class</span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Table>
                        <TableHeader className="bg-white/[0.03]">
                          <TableRow className="border-white/5 hover:bg-transparent">
                            <TableHead className="px-3 py-3 text-xs font-medium text-gray-400 uppercase font-display">Roll No</TableHead>
                            <TableHead className="px-3 py-3 text-xs font-medium text-gray-400 uppercase font-display">Name</TableHead>
                            <TableHead className="px-3 py-3 text-xs font-medium text-gray-400 uppercase font-display">
                              <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-emerald-400" /> Student Mobile</span>
                            </TableHead>
                            <TableHead className="px-3 py-3 text-xs font-medium text-gray-400 uppercase font-display">
                              <span className="flex items-center gap-1"><Users className="h-3 w-3 text-blue-400" /> Parent Mobile</span>
                            </TableHead>
                            <TableHead className="px-3 py-3 text-xs font-medium text-gray-400 uppercase font-display">
                              <span className="flex items-center gap-1"><DollarSign className="h-3 w-3 text-amber-400" /> Fee</span>
                            </TableHead>
                            <TableHead className="px-3 py-3 text-xs font-medium text-gray-400 uppercase font-display">Due Date</TableHead>
                            <TableHead className="px-3 py-3 text-xs font-medium text-gray-400 uppercase font-display">Status</TableHead>
                            <TableHead className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase font-display">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-white/5">
                          {filteredClassPlayers.length === 0 ? (
                            <TableRow className="border-white/5">
                              <TableCell colSpan={8} className="text-center text-gray-500 py-4">No players found.</TableCell>
                            </TableRow>
                          ) : (
                            filteredClassPlayers.map((player) => (
                              <TableRow
                                key={`${player.classId}-${player.rollNo}`}
                                className={`border-white/5 hover:bg-white/[0.03] ${
                                  player.rollNo === VIP_ADMIN_ROLL
                                    ? 'bg-gradient-to-r from-yellow-900/30 to-purple-900/30 border-l-4 border-l-yellow-400'
                                    : ''
                                }`}
                              >
                                <TableCell className="px-3 py-3 text-sm text-gray-300">
                                  {!isValidRollNo(player.rollNo) && <AlertCircle className="inline h-4 w-4 text-yellow-500 mr-1" />}
                                  <span className="font-mono">{player.rollNo}</span>
                                  {player.rollNo === VIP_ADMIN_ROLL && (
                                    <Crown className="inline h-4 w-4 text-yellow-400 ml-1" />
                                  )}
                                </TableCell>
                                <TableCell className="px-3 py-3 text-sm font-semibold text-white font-display">
                                  {player.name}
                                  {player.rollNo === VIP_ADMIN_ROLL && (
                                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-black bg-gradient-to-r from-yellow-400 to-orange-400 text-black">
                                      👑 VIP ADMIN
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="px-3 py-3 text-sm">
                                  {player.mobile
                                    ? <span className="text-green-400 flex items-center gap-1"><Phone className="h-3 w-3" />{player.mobile}</span>
                                    : <span className="text-gray-500 italic text-xs">—</span>}
                                </TableCell>
                                <TableCell className="px-3 py-3 text-sm">
                                  {player.parentPhone
                                    ? <span className="text-blue-400 flex items-center gap-1"><Phone className="h-3 w-3" />{player.parentPhone}</span>
                                    : <span className="text-gray-500 italic text-xs">—</span>}
                                </TableCell>
                                <TableCell className="px-3 py-3 text-sm text-yellow-400 font-medium">
                                  {player.feeAmount ? `₹${player.feeAmount}` : <span className="text-gray-500 italic text-xs">—</span>}
                                </TableCell>
                                <TableCell className="px-3 py-3 text-sm text-gray-400">
                                  {player.feeDueDate || <span className="italic text-xs">—</span>}
                                </TableCell>
                                <TableCell className="px-3 py-3">
                                  {player.feePaid
                                    ? <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-xs">✅ Paid</Badge>
                                    : player.feeAmount
                                      ? <Badge className="bg-red-600/20 text-red-400 border-red-600/30 text-xs">⏳ Pending</Badge>
                                      : <span className="text-gray-500 text-xs">—</span>}
                                </TableCell>
                                <TableCell className="px-3 py-3 text-right">
                                  <div className="flex items-center justify-end gap-1 flex-wrap">
                                    {/* WhatsApp msg */}
                                    <Button variant="ghost" size="sm"
                                      onClick={() => handleSendWhatsApp(player, 'msg')}
                                      disabled={sendingWA === `msg-${player.rollNo}`}
                                      title="Send WhatsApp message"
                                      className="text-green-500 hover:text-green-300 hover:bg-green-900/20 h-7 w-7 p-0">
                                      {sendingWA === `msg-${player.rollNo}`
                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        : <MessageCircle className="h-3.5 w-3.5" />}
                                    </Button>
                                    {/* Fee reminder */}
                                    {!player.feePaid && (
                                      <Button variant="ghost" size="sm"
                                        onClick={() => handleSendWhatsApp(player, 'fee')}
                                        disabled={sendingWA === `fee-${player.rollNo}`}
                                        title="Send fee reminder"
                                        className="text-yellow-500 hover:text-yellow-300 hover:bg-yellow-900/20 h-7 w-7 p-0">
                                        {sendingWA === `fee-${player.rollNo}`
                                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          : <DollarSign className="h-3.5 w-3.5" />}
                                      </Button>
                                    )}
                                    {/* Mark fee paid */}
                                    {!player.feePaid && player.feeAmount && (
                                      <Button variant="ghost" size="sm"
                                        onClick={() => handleMarkFeePaid(player)}
                                        title="Mark fee as paid"
                                        className="text-emerald-500 hover:text-emerald-300 hover:bg-emerald-900/20 h-7 w-7 p-0">
                                        <CheckCircle className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    {/* Edit */}
                                    <Button variant="ghost" size="sm"
                                      onClick={() => setEditingPlayer({ ...player, originalRollNo: player.rollNo, originalClassId: player.classId })}
                                      className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/20 h-7 w-7 p-0">
                                      <Edit className="h-3.5 w-3.5" />
                                    </Button>
                                    {/* Delete */}
                                    <Button variant="ghost" size="sm"
                                      onClick={() => handleDeletePlayer(player.rollNo, player.classId)}
                                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-7 w-7 p-0">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>
      </div>
    </div>
  );
};


export default AdminPlayerManagementPage;