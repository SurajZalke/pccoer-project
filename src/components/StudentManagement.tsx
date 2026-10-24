import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { addStudent, updateStudent, deleteStudent, getTopStudents } from '@/services/firebaseService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Trash2, Edit, PlusCircle, Upload, FileText } from 'lucide-react';
import { Student } from '@/types';
import * as pdfjs from 'pdfjs-dist';
import { GlobalWorkerOptions } from 'pdfjs-dist';
import { TextItem } from 'pdfjs-dist/types/src/display/api';

// PDF.js worker setup — use new URL() so Vite bundles the worker locally
// and serves it from the same origin (avoids unpkg.com CORS blocks).
if (!pdfjs.GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

export const ADMIN_UID = 'Ch0V3K1ELxPZyZiC439DrCeAjnM2';

interface BulkStudent {
  name: string;
  rollNo: string;
}

const generateBulkRollNo = (index: number): string => {
  const year = new Date().getFullYear();
  return `${year}${String(index + 1).padStart(3, '0')}`;
};

const StudentManagement: React.FC = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [name, setName] = useState('');
  const [marks, setMarks] = useState<number | ''>('');
  const [examName, setExamName] = useState('');
  const [percentage, setPercentage] = useState<number | ''>('');
  const [rank, setRank] = useState<number | ''>('');
  const [rollNo, setRollNo] = useState('');
  const [phone, setPhone] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ---- 3a: Rename Class ----
  const [classNameDialogOpen, setClassNameDialogOpen] = useState(false);
  const [renameOldClass, setRenameOldClass] = useState('');
  const [renameNewClass, setRenameNewClass] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // ---- 3b: Bulk Upload ----
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkClassName, setBulkClassName] = useState('');
  const [bulkPreview, setBulkPreview] = useState<BulkStudent[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const isAdmin = currentUser && currentUser.uid === ADMIN_UID;

  const generateRollNo = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  useEffect(() => {
    fetchStudents();
    setIsLoading(false);
  }, []);

  const fetchStudents = async () => {
    const result = await getTopStudents(100);
    if (result.success && result.students) {
      setStudents(result.students as Student[]);
    } else {
      toast({ title: 'Error', description: result.error || 'Failed to fetch students.', variant: 'destructive' });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    } else {
      setPhotoFile(null);
      setPhotoPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast({ title: 'Unauthorized', description: 'You do not have permission to perform this action.', variant: 'destructive' });
      return;
    }
    if (!name || marks === '' || examName === '' || percentage === '') {
      toast({ title: 'Uploading...', description: 'Please fill in all required fields.', variant: 'default' });
      return;
    }
    const currentRollNo = rollNo || generateRollNo();
    const studentData = { name, marks: Number(marks), examName, percentage: Number(percentage), rank: Number(rank) || null, photoFile, rollNo: currentRollNo, phone, parentPhone };
    let result;
    if (currentStudent) {
      result = await updateStudent(currentStudent.id, studentData);
    } else {
      result = await addStudent(studentData);
    }
    if (result.success) {
      toast({ title: 'Success', description: `Student ${currentStudent ? 'updated' : 'added'} successfully. Roll No: ${currentRollNo}` });
      setIsDialogOpen(false);
      resetForm();
      fetchStudents();
    } else {
      toast({ title: 'Error', description: result.error || `Failed to ${currentStudent ? 'update' : 'add'} student.`, variant: 'destructive' });
    }
  };

  const handleEdit = (student: Student) => {
    setCurrentStudent(student);
    setName(student.name);
    setMarks(student.marks);
    setExamName(student.examName);
    setPercentage(student.percentage);
    setRank(student.rank || '');
    setRollNo(student.rollNo || '');
    setPhone(student.phone || '');
    setParentPhone(student.parentPhone || '');
    setPhotoPreview(student.photoURL || null);
    setPhotoFile(null);
    setIsDialogOpen(true);
  };

  const handleDelete = async (studentId: string, photoURL?: string) => {
    if (!isAdmin) {
      toast({ title: 'Unauthorized', description: 'You do not have permission to perform this action.', variant: 'destructive' });
      return;
    }
    const result = await deleteStudent(studentId, photoURL);
    if (result.success) {
      toast({ title: 'Success', description: 'Student deleted successfully.' });
      fetchStudents();
    } else {
      toast({ title: 'Error', description: result.error || 'Failed to delete student.', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setCurrentStudent(null);
    setName('');
    setMarks('');
    setExamName('');
    setPercentage('');
    setRank('');
    setRollNo('');
    setPhone('');
    setParentPhone('');
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  // ---- 3a: Rename Class Handler ----
  const handleRenameClass = async () => {
    if (!renameOldClass.trim() || !renameNewClass.trim()) {
      toast({ title: 'Fill both fields', description: 'Enter old and new class name.', variant: 'destructive' });
      return;
    }
    setIsRenaming(true);
    try {
      const matching = students.filter(s => s.examName === renameOldClass.trim());
      if (matching.length === 0) {
        toast({ title: 'No students found', description: `No students with class "${renameOldClass}".`, variant: 'destructive' });
        return;
      }
      let failCount = 0;
      for (const s of matching) {
        const res = await updateStudent(s.id, { examName: renameNewClass.trim() });
        if (!res.success) failCount++;
      }
      if (failCount === 0) {
        toast({ title: 'Renamed', description: `Updated ${matching.length} students from "${renameOldClass}" to "${renameNewClass}".` });
      } else {
        toast({ title: 'Partial success', description: `${matching.length - failCount} updated, ${failCount} failed.`, variant: 'destructive' });
      }
      setClassNameDialogOpen(false);
      setRenameOldClass('');
      setRenameNewClass('');
      fetchStudents();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Rename failed.', variant: 'destructive' });
    } finally {
      setIsRenaming(false);
    }
  };

  // ---- 3b: Bulk Upload Helpers ----
  const extractTextFromPdf = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = async (event) => {
        try {
          if (!event.target?.result) { reject(new Error('Failed to read file')); return; }
          const typedArray = new Uint8Array(event.target.result as ArrayBuffer);
          const loadingTask = pdfjs.getDocument({ 
            data: typedArray,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + pdfjs.version + '/cmaps/',
            cMapPacked: true 
          });
          const pdf = await loadingTask.promise;
          let extractedText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const textItems = textContent.items as TextItem[];
            extractedText += textItems.map(item => item.str).join(' ') + '\n';
          }
          resolve(extractedText);
        } catch (error) { reject(error); }
      };
      fileReader.onerror = () => reject(new Error('Failed to read file'));
      fileReader.readAsArrayBuffer(file);
    });
  };

  const extractTextFromImage = async (file: File): Promise<string> => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const geminiKeys: string[] = (() => {
      try {
        const raw = import.meta.env.VITE_GEMINI_KEYS || '';
        if (raw.startsWith('[')) return JSON.parse(raw).filter(Boolean);
        if (raw.trim()) return [raw.trim()];
      } catch {}
      return [];
    })();
    const apiKey = geminiKeys[0] || import.meta.env.VITE_GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const mimeType = file.type as 'image/jpeg' | 'image/png';
    const result = await model.generateContent([
      { inlineData: { data: base64, mimeType } },
      'Extract all text from this image exactly as written.'
    ]);
    return result.response.text();
  };

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setBulkFile(e.target.files[0]);
      setBulkPreview([]);
    }
  };

  const handleBulkExtract = async () => {
    if (!bulkFile) {
      toast({ title: 'No file selected', description: 'Please select a PDF or image file.', variant: 'destructive' });
      return;
    }
    setIsBulkProcessing(true);
    try {
      let extractedText = '';
      const fileType = bulkFile.type.toLowerCase();
      if (fileType === 'application/pdf') {
        extractedText = await extractTextFromPdf(bulkFile);
      } else if (fileType.startsWith('image/')) {
        extractedText = await extractTextFromImage(bulkFile);
      } else {
        toast({ title: 'Unsupported file', description: 'Use PDF, PNG, or JPG.', variant: 'destructive' });
        return;
      }

      const { callAIAPI } = await import('@/services/aiProviderManager');
      const prompt = `Extract student names from the following text. Return a JSON array:
[
  {"name": "Student Name"},
  ...
]
Only include actual student/person names. Ignore headers, numbers that are standalone, roll numbers, marks, etc.
Text: ${extractedText}`;

      const response = await callAIAPI(prompt, 'auto');
      let jsonStr = response.text.trim();
      const match = jsonStr.match(/```json\n?([\s\S]*?)\n?```/);
      if (match) jsonStr = match[1];
      else {
        const first = jsonStr.indexOf('[');
        const last = jsonStr.lastIndexOf(']');
        if (first !== -1 && last !== -1) jsonStr = jsonStr.slice(first, last + 1);
      }
      const parsed: { name: string }[] = JSON.parse(jsonStr);
      const preview: BulkStudent[] = parsed.map((item, index) => ({
        name: item.name,
        rollNo: generateBulkRollNo(index),
      }));
      setBulkPreview(preview);
      toast({ title: 'Extraction complete', description: `Found ${preview.length} students. Review and confirm.` });
    } catch (err: any) {
      toast({ title: 'Extraction failed', description: err.message || 'Could not extract student names.', variant: 'destructive' });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkSave = async () => {
    if (bulkPreview.length === 0) return;
    if (!bulkClassName.trim()) {
      toast({ title: 'Enter class name', description: 'Please provide a class/exam name for bulk students.', variant: 'destructive' });
      return;
    }
    setIsBulkSaving(true);
    let successCount = 0;
    let failCount = 0;
    for (const s of bulkPreview) {
      const res = await addStudent({
        name: s.name,
        marks: 0,
        examName: bulkClassName.trim(),
        percentage: 0,
        rank: null,
        photoFile: null,
        rollNo: s.rollNo,
      });
      if (res.success) successCount++;
      else failCount++;
    }
    setIsBulkSaving(false);
    if (failCount === 0) {
      toast({ title: 'Bulk upload complete', description: `${successCount} students added successfully.` });
    } else {
      toast({ title: 'Partial upload', description: `${successCount} added, ${failCount} failed.`, variant: 'destructive' });
    }
    setBulkDialogOpen(false);
    setBulkFile(null);
    setBulkClassName('');
    setBulkPreview([]);
    fetchStudents();
  };

  // Unique class names for dropdown
  const uniqueClasses = Array.from(new Set(students.map(s => s.examName).filter(Boolean)));

  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-900 via-blue-800 to-purple-800 shadow-xl">
      <h2 className="text-2xl font-bold mb-4 text-white">Student Management</h2>
      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
        </div>
      ) : (
        <>
          {isAdmin && (
            <div className="flex flex-wrap gap-2 mb-4">
              {/* Add Student Dialog */}
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg transition-all duration-300 hover:shadow-xl">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add New Student
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>{currentStudent ? 'Edit Student' : 'Add New Student'}</DialogTitle>
                    <DialogDescription>
                      {currentStudent ? 'Edit the student details.' : 'Add a new student record here.'}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="name" className="text-right">Name</Label>
                      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" required />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="marks" className="text-right">Marks</Label>
                      <Input id="marks" type="number" value={marks} onChange={(e) => setMarks(Number(e.target.value))} className="col-span-3" required />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="examName" className="text-right">Exam Name</Label>
                      <Input id="examName" value={examName} onChange={(e) => setExamName(e.target.value)} className="col-span-3" required />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="percentage" className="text-right">Percentage</Label>
                      <Input id="percentage" type="number" value={percentage} onChange={(e) => setPercentage(Number(e.target.value))} className="col-span-3" required />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="rank" className="text-right">Rank</Label>
                      <Input id="rank" type="number" value={rank} onChange={(e) => setRank(Number(e.target.value))} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="phone" className="text-right">Student Phone</Label>
                      <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91XXXXXXXXXX" className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="parentPhone" className="text-right">Parent Phone</Label>
                      <Input id="parentPhone" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="+91XXXXXXXXXX" className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="photo" className="text-right">Photo</Label>
                      <Input id="photo" type="file" onChange={handleFileChange} className="col-span-3" accept="image/*" />
                    </div>
                    {photoPreview && (
                      <div className="grid grid-cols-4 items-center gap-4">
                        <div className="col-span-1"></div>
                        <img src={photoPreview} alt="Photo Preview" className="col-span-3 w-24 h-24 object-cover rounded-md" />
                      </div>
                    )}
                    <DialogFooter>
                      <Button type="submit">{currentStudent ? 'Save Changes' : 'Add Student'}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              {/* 3a: Edit Class Name Dialog */}
              <Dialog open={classNameDialogOpen} onOpenChange={setClassNameDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-yellow-400 text-yellow-300 hover:bg-yellow-900/20">
                    ✏️ Edit Class Name
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[400px] bg-gray-900 border border-gray-700 text-white">
                  <DialogHeader>
                    <DialogTitle className="text-white">Rename Class</DialogTitle>
                    <DialogDescription className="text-gray-400">
                      Update the class/exam name for all students in a class.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="renameOld" className="text-right text-gray-300">Old Name</Label>
                      <div className="col-span-3">
                        <Input
                          id="renameOld"
                          value={renameOldClass}
                          onChange={(e) => setRenameOldClass(e.target.value)}
                          placeholder="Current class name"
                          list="classlist"
                          className="bg-gray-800 border-gray-600 text-white"
                        />
                        <datalist id="classlist">
                          {uniqueClasses.map(c => <option key={c} value={c} />)}
                        </datalist>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="renameNew" className="text-right text-gray-300">New Name</Label>
                      <Input
                        id="renameNew"
                        value={renameNewClass}
                        onChange={(e) => setRenameNewClass(e.target.value)}
                        placeholder="New class name"
                        className="col-span-3 bg-gray-800 border-gray-600 text-white"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setClassNameDialogOpen(false)} className="border-gray-600 text-gray-300">
                      Cancel
                    </Button>
                    <Button onClick={handleRenameClass} disabled={isRenaming} className="bg-yellow-600 hover:bg-yellow-700 text-white">
                      {isRenaming ? 'Renaming...' : 'Rename Class'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* 3b: Bulk Upload Dialog */}
              <Dialog open={bulkDialogOpen} onOpenChange={(open) => { setBulkDialogOpen(open); if (!open) { setBulkPreview([]); setBulkFile(null); setBulkClassName(''); } }}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-green-400 text-green-300 hover:bg-green-900/20">
                    <Upload className="mr-2 h-4 w-4" /> 📁 Bulk Upload Students
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[540px] bg-gray-900 border border-gray-700 text-white max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-white flex items-center gap-2">
                      <FileText className="h-5 w-5 text-green-400" /> Bulk Upload Students
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                      Upload a PDF or image (PNG/JPG) containing a student name list. AI will extract the names.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div>
                      <Label className="text-gray-300 mb-1 block">Class / Exam Name</Label>
                      <Input
                        value={bulkClassName}
                        onChange={(e) => setBulkClassName(e.target.value)}
                        placeholder="e.g. Class 11A, Batch 2026"
                        className="bg-gray-800 border-gray-600 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 mb-1 block">Student List File (PDF, PNG, JPG)</Label>
                      <Input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={handleBulkFileChange}
                        className="bg-gray-800 border-gray-600 text-white"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleBulkExtract}
                      disabled={isBulkProcessing || !bulkFile}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {isBulkProcessing ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin">⟳</span> Extracting...
                        </span>
                      ) : 'Extract Student Names'}
                    </Button>

                    {bulkPreview.length > 0 && (
                      <div>
                        <p className="text-green-400 text-sm mb-2 font-medium">Preview — {bulkPreview.length} students found:</p>
                        <div className="max-h-48 overflow-y-auto rounded border border-gray-700">
                          <Table>
                            <TableHeader className="bg-gray-800">
                              <TableRow>
                                <TableHead className="text-gray-300">#</TableHead>
                                <TableHead className="text-gray-300">Name</TableHead>
                                <TableHead className="text-gray-300">Roll No</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {bulkPreview.map((s, i) => (
                                <TableRow key={i} className="border-b border-gray-700 hover:bg-gray-800">
                                  <TableCell className="text-gray-300">{i + 1}</TableCell>
                                  <TableCell className="text-white font-medium">{s.name}</TableCell>
                                  <TableCell className="text-blue-300">{s.rollNo}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setBulkDialogOpen(false)} className="border-gray-600 text-gray-300">
                      Cancel
                    </Button>
                    {bulkPreview.length > 0 && (
                      <Button
                        onClick={handleBulkSave}
                        disabled={isBulkSaving || !bulkClassName.trim()}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {isBulkSaving ? 'Saving...' : `Confirm & Add ${bulkPreview.length} Students`}
                      </Button>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}

          <Table className="bg-white/20 backdrop-blur-md rounded-lg overflow-hidden shadow-lg">
            <TableHeader className="bg-blue-900/70">
              <TableRow>
                <TableHead className="text-white font-medium">Roll No</TableHead>
                <TableHead className="text-white font-medium">Rank</TableHead>
                <TableHead className="text-white font-medium">Photo</TableHead>
                <TableHead className="text-white font-medium">Name</TableHead>
                <TableHead className="text-white font-medium">Marks</TableHead>
                <TableHead className="text-white font-medium">Exam Name</TableHead>
                <TableHead className="text-white font-medium">Percentage</TableHead>
                <TableHead className="text-white font-medium">Student Phone</TableHead>
                <TableHead className="text-white font-medium">Parent Phone</TableHead>
                <TableHead className="text-white font-medium">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id} className="border-b border-blue-900/20 hover:bg-blue-900/10 transition-colors">
                  <TableCell className="font-medium text-white">{student.rollNo || 'N/A'}</TableCell>
                  <TableCell className="font-medium text-white">{student.rank}</TableCell>
                  <TableCell>
                    {student.photoURL ? (
                      <img src={student.photoURL} alt={student.name} className="w-12 h-12 object-cover rounded-full border-2 border-indigo-300 shadow-md" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 text-xs border-2 border-gray-300">No Photo</div>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold text-yellow-300">{student.name}</TableCell>
                  <TableCell className="text-blue-200">{student.marks}</TableCell>
                  <TableCell className="text-blue-200">{student.examName}</TableCell>
                  <TableCell className="text-blue-200 font-medium">{student.percentage}%</TableCell>
                  <TableCell className="text-green-300 text-xs">{student.phone || '—'}</TableCell>
                  <TableCell className="text-green-300 text-xs">{student.parentPhone || '—'}</TableCell>
                  <TableCell className="flex items-center space-x-2">
                    {isAdmin && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(student)} className="bg-blue-600/30 border-blue-400/50 hover:bg-blue-700/50 text-white">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(student.id, student.photoURL)} className="bg-red-600/30 hover:bg-red-700/50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {students.length === 0 && !isLoading && (
            <div className="text-center p-8 text-white">
              <p>No student records found.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StudentManagement;
