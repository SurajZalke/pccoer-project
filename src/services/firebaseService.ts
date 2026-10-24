import { auth, app } from '@/lib/firebaseConfig';
import { getStorage } from 'firebase/storage';
const storage = getStorage(app);
import { getFirestore } from 'firebase/firestore';
const firestore = getFirestore(app);
import { getFunctions, httpsCallable } from 'firebase/functions';
const functions = getFunctions(app);
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc, getDocs, query, orderBy, limit, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';



const ADMIN_UID = 'Ch0V3K1ELxPZyZiC439DrCeAjnM2';
const isCurrentUserAdmin = () => {
  return auth.currentUser && auth.currentUser.uid === ADMIN_UID;
};

// Add this helper function for Cloudinary upload
export const uploadImageToCloudinary = async (file: File): Promise<string> => {
  const CLOUDINARY_ACCOUNTS = [
    { cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME, uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET },
    { cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME1, uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET1 },
    { cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME2, uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET2 },
    { cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME3, uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET3 },
    { cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME4, uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET4 },
    { cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME5, uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET5 },
  ];

  for (let i = 0; i < CLOUDINARY_ACCOUNTS.length; i++) {
    const { cloudName, uploadPreset } = CLOUDINARY_ACCOUNTS[i];
    if (!cloudName || !uploadPreset) {
      console.warn(`Skipping Cloudinary account ${i} due to missing environment variables.`);
      continue;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        return data.secure_url;
      } else {
        const errorData = await response.json();
        console.error(`Cloudinary upload failed for account ${i}:`, errorData.error ? errorData.error.message : 'Unknown error');
      }
    } catch (error) {
      console.error(`Error uploading to Cloudinary account ${i}:`, error);
    }
  }
  throw new Error('All Cloudinary upload attempts failed.');
};

export const addStudent = async (studentData: { name: string; marks: number; examName: string; percentage: number; rank: number | null; photoFile: File | null; rollNo?: string; phone?: string; parentPhone?: string; feeAmount?: number; feeDueDate?: string; feePaid?: boolean; batch?: string }) => {
  if (!isCurrentUserAdmin()) {
    return { success: false, error: 'Unauthorized: Only admin can add students.' };
  }
  try {
    let photoURL = '';
    if (studentData.photoFile) {
      try {
        photoURL = await uploadImageToCloudinary(studentData.photoFile);
      } catch (error) {
        console.warn('Cloudinary upload failed, proceeding without photo:', error);
        // Continue without photo
      }
    }

    const docRef = await addDoc(collection(firestore, 'students'), {
      name: studentData.name,
      marks: studentData.marks,
      examName: studentData.examName,
      percentage: studentData.percentage,
      rank: studentData.rank,
      photoURL,
      rollNo: studentData.rollNo || '',
      phone: studentData.phone || '',
      parentPhone: studentData.parentPhone || '',
      feeAmount: studentData.feeAmount || 0,
      feeDueDate: studentData.feeDueDate || '',
      feePaid: studentData.feePaid || false,
      batch: studentData.batch || studentData.examName || '',
      createdAt: new Date(),
    });
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error('Error adding student:', error.message);
    return { success: false, error: error.message };
  }
};

export const updateStudent = async (id: string, studentData: { name?: string; marks?: number; examName?: string; percentage?: number; rank?: number | null; photoFile?: File | null; photoURL?: string | null; rollNo?: string; phone?: string; parentPhone?: string; feeAmount?: number; feeDueDate?: string; feePaid?: boolean; batch?: string }) => {
  if (!isCurrentUserAdmin()) {
    return { success: false, error: 'Unauthorized: Only admin can update students.' };
  }
  try {
    const studentRef = doc(firestore, 'students', id);
    const updateData: any = { ...studentData };

    if (studentData.photoFile) {
      try {
        updateData.photoURL = await uploadImageToCloudinary(studentData.photoFile);
      } catch (error) {
        console.warn('Cloudinary upload failed, proceeding without updating photo:', error);
        // Don't update photo if upload fails
      }
      delete updateData.photoFile;
    } else if (studentData.photoURL === null) {
      updateData.photoURL = '';
    }

    await updateDoc(studentRef, updateData);
    return { success: true };
  } catch (error: any) {
    console.error('Error updating student:', error.message);
    return { success: false, error: error.message };
  }
};

export const deleteStudent = async (id: string, photoURL?: string) => {
  if (!isCurrentUserAdmin()) {
    return { success: false, error: 'Unauthorized: Only admin can delete students.' };
  }
  try {
    await deleteDoc(doc(firestore, 'students', id));
    // Don't try to delete from Firebase Storage since we use Cloudinary now
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting student:', error.message);
    return { success: false, error: error.message };
  }
};

export const getTopStudents = async (limitCount: number = 10) => {
  try {
    const q = query(collection(firestore, 'students'), orderBy('percentage', 'desc'), limit(limitCount));
    const querySnapshot = await getDocs(q);
    const students = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return { success: true, students };
  } catch (error: any) {
    console.error('Error getting top students:', error.message);
    return { success: false, error: error.message };
  }
};

export const loginUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error: any) {
    console.error('Error logging in:', error.message);
    return { success: false, error: error.message };
  }
};

// Function to call the Firebase Cloud Function for sending password reset code
export const sendPasswordResetCode = async (email: string) => {
  try {
    const callSendPasswordResetCode = httpsCallable(functions, 'sendPasswordResetCode');
    const result = await callSendPasswordResetCode({ email });
    return { success: true, data: result.data };
  } catch (error: any) {
    console.error('Error calling sendPasswordResetCode function:', error.message);
    return { success: false, error: error.message };
  }
};

// Function to call the Firebase Cloud Function for confirming password reset with code
export const confirmPasswordResetWithCode = async (email: string, code: string, newPassword: string) => {
  try {
    const callConfirmPasswordResetWithCode = httpsCallable(functions, 'confirmPasswordResetWithCode');
    const result = await callConfirmPasswordResetWithCode({ email, code, newPassword });
    return { success: true, data: result.data };
  } catch (error: any) {
    console.error('Error calling confirmPasswordResetWithCode function:', error.message);
    return { success: false, error: error.message };
  }
};

// YouTube Video Management Functions
export const addYouTubeVideo = async (videoData: { url: string; title: string; topic: string; chapter: string }) => {
  if (!isCurrentUserAdmin()) {
    return { success: false, error: 'Unauthorized: Only admin can add videos.' };
  }
  try {
    const docRef = await addDoc(collection(firestore, 'youtubeVideos'), {
      ...videoData,
      createdAt: new Date(),
    });
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error('Error adding YouTube video:', error.message);
    return { success: false, error: error.message };
  }
};



export const updateYouTubeVideo = async (id: string, videoData: { url?: string; title?: string; topic?: string; chapter?: string }) => {
  if (!isCurrentUserAdmin()) {
    return { success: false, error: 'Unauthorized: Only admin can update videos.' };
  }
  try {
    const videoRef = doc(firestore, 'youtubeVideos', id);
    await updateDoc(videoRef, videoData);
    return { success: true };
  } catch (error: any) {
    console.error('Error updating YouTube video:', error.message);
    return { success: false, error: error.message };
  }
};

export const deleteYouTubeVideo = async (id: string) => {
  if (!isCurrentUserAdmin()) {
    return { success: false, error: 'Unauthorized: Only admin can delete videos.' };
  }
  try {
    await deleteDoc(doc(firestore, 'youtubeVideos', id));
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting YouTube video:', error.message);
    return { success: false, error: error.message };
  }
};

export const getYouTubeVideos = async (limitCount?: number, p0?: any) => {
  try {
    let q = query(collection(firestore, 'youtubeVideos'), orderBy('createdAt', 'desc'));
    if (limitCount) {
      q = query(q, limit(limitCount));
    }
    const querySnapshot = await getDocs(q);
    const videos = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as any
    }));
    return { success: true, videos };
  } catch (error: any) {
    console.error('Error getting YouTube videos:', error.message);
    return { success: false, error: error.message };
  }
};

// Scheduled Test Functions
export const scheduleTest = async (testData: any) => {
  if (!isCurrentUserAdmin()) {
    return { success: false, error: 'Unauthorized: Only admin can schedule tests.' };
  }
  try {
    const docRef = await addDoc(collection(firestore, 'scheduledTests'), {
      ...testData,
      createdAt: new Date().toISOString(),
    });
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error('Error scheduling test:', error.message);
    return { success: false, error: error.message };
  }
};

export const getScheduledTests = async (classId?: string) => {
  try {
    let q = query(collection(firestore, 'scheduledTests'));
    
    // If classId is provided, we fetch all tests and filter in memory 
    // because Firestore doesn't support 'array-contains' on a field that 
    // might be either a string (old tests) or an array (new tests) easily 
    // without multiple queries or index issues.
    const querySnapshot = await getDocs(q);
    let tests = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as any
    }));

    if (classId) {
      tests = tests.filter(test => {
        if (Array.isArray(test.classIds)) {
          return test.classIds.includes(classId);
        }
        return test.classId === classId;
      });
    }
    
    // Sort in memory to avoid "The query requires an index" error
    tests.sort((a, b) => {
      const timeA = new Date(a.startTime || 0).getTime();
      const timeB = new Date(b.startTime || 0).getTime();
      return timeA - timeB;
    });
    
    return { success: true, tests };
  } catch (error: any) {
    console.error('Error getting scheduled tests:', error.message);
    return { success: false, error: error.message };
  }
};

export const deleteScheduledTest = async (id: string) => {
  if (!isCurrentUserAdmin()) {
    return { success: false, error: 'Unauthorized: Only admin can delete scheduled tests.' };
  }
  try {
    await deleteDoc(doc(firestore, 'scheduledTests', id));
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting scheduled test:', error.message);
    return { success: false, error: error.message };
  }
};

// ── Student queries for WhatsApp ──────────────────────────────────────────────

/** Get all students in a specific class/examName */
export const getStudentsByClass = async (className: string) => {
  try {
    const q = query(
      collection(firestore, 'students'),
      where('examName', '==', className)
    );
    const snap = await getDocs(q);
    const students = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { success: true, students };
  } catch (error: any) {
    console.error('Error getting students by class:', error.message);
    return { success: false, error: error.message };
  }
};

/** Get all students that have at least a phone or parentPhone */
export const getStudentsWithPhones = async () => {
  try {
    const q = query(
      collection(firestore, 'students'),
      orderBy('examName'),
      limit(500)
    );
    const snap = await getDocs(q);
    const students = snap.docs
      .map(d => ({ id: d.id, ...d.data() as any }))
      .filter((s: any) => s.phone || s.parentPhone);
    return { success: true, students };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/** Get unique class names from Firestore students */
export const getClassNames = async (): Promise<string[]> => {
  try {
    const snap = await getDocs(collection(firestore, 'students'));
    const names = new Set<string>();
    snap.docs.forEach(d => {
      const data = d.data() as any;
      if (data.examName) names.add(data.examName);
    });
    return Array.from(names).sort();
  } catch {
    return [];
  }
};


// ─────────────────────────────────────────────────────────────────
// OMR Firebase Service Functions
// ─────────────────────────────────────────────────────────────────
import type { OMRExam, OMRResult, OMRSheet } from '@/types';

/** Create a new OMR exam */
export const createOMRExam = async (examData: Omit<OMRExam, 'id' | 'createdAt'>): Promise<{ success: boolean; id?: string; error?: string }> => {
  if (!isCurrentUserAdmin()) return { success: false, error: 'Unauthorized' };
  try {
    const docRef = await addDoc(collection(firestore, 'omrExams'), {
      ...examData,
      createdAt: new Date().toISOString(),
    });
    return { success: true, id: docRef.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};

/** Update an OMR exam */
export const updateOMRExam = async (id: string, data: Partial<OMRExam>): Promise<{ success: boolean; error?: string }> => {
  if (!isCurrentUserAdmin()) return { success: false, error: 'Unauthorized' };
  try {
    await updateDoc(doc(firestore, 'omrExams', id), data as any);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};

/** Delete an OMR exam and its sheets/results */
export const deleteOMRExam = async (id: string): Promise<{ success: boolean; error?: string }> => {
  if (!isCurrentUserAdmin()) return { success: false, error: 'Unauthorized' };
  try {
    await deleteDoc(doc(firestore, 'omrExams', id));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};

/** Fetch all OMR exams for admin */
export const getOMRExams = async (): Promise<{ success: boolean; exams?: OMRExam[]; error?: string }> => {
  try {
    const q = query(collection(firestore, 'omrExams'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const exams = snap.docs.map(d => ({ id: d.id, ...d.data() } as OMRExam));
    return { success: true, exams };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};

/** Save generated sheets for an exam */
export const saveOMRSheets = async (sheets: Omit<OMRSheet, 'id'>[]): Promise<{ success: boolean; error?: string }> => {
  if (!isCurrentUserAdmin()) return { success: false, error: 'Unauthorized' };
  try {
    for (const sheet of sheets) {
      await addDoc(collection(firestore, 'omrSheets'), sheet);
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};

/** Get all sheets for a specific exam */
export const getOMRSheets = async (examId: string): Promise<{ success: boolean; sheets?: OMRSheet[]; error?: string }> => {
  try {
    const q = query(collection(firestore, 'omrSheets'), where('examId', '==', examId));
    const snap = await getDocs(q);
    const sheets = snap.docs.map(d => ({ id: d.id, ...d.data() } as OMRSheet));
    return { success: true, sheets };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};

/** Save OMR scan result */
export const saveOMRResult = async (result: Omit<OMRResult, 'id'>): Promise<{ success: boolean; id?: string; error?: string }> => {
  if (!isCurrentUserAdmin()) return { success: false, error: 'Unauthorized' };
  try {
    const docRef = await addDoc(collection(firestore, 'omrResults'), {
      ...result,
      scannedAt: new Date().toISOString(),
    });
    return { success: true, id: docRef.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};

/** Get all results for a specific exam */
export const getOMRResults = async (examId: string): Promise<{ success: boolean; results?: OMRResult[]; error?: string }> => {
  try {
    const q = query(collection(firestore, 'omrResults'), where('examId', '==', examId));
    const snap = await getDocs(q);
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as OMRResult));
    return { success: true, results };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};

/** Upload a scan file to Firebase Storage */
export const uploadOMRScanFile = async (examId: string, file: File): Promise<{ success: boolean; url?: string; error?: string }> => {
  if (!isCurrentUserAdmin()) return { success: false, error: 'Unauthorized' };
  try {
    const storageRef = ref(storage, `omr_scans/${examId}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return { success: true, url };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};
