import { ReactNode } from "react";

export interface User {
  id: string;
  email: string;
  name: string;
  user_metadata?: {
     id?: string;
     name?: string;
     avatar_url?: string;
     bio?: string;
     email?: string;
     createdAt?: any; // Using 'any' for serverTimestamp type
   };
}

export interface Player {
  uid: string;
  id: any;
  player_id: string;
  nickname: string;
  score: number;
  answers: PlayerAnswer[];
  avatar?: string;
  customAvatarUrl?: string; // Custom paid avatar
  hasAvatarSubscription?: boolean; // Whether user has active subscription
  status?: 'waiting' | 'answered';
  streak?: number;
}

export interface PlayerAnswer {
  questionId: string;
  selectedOption: string;
  correct: boolean;
  timeToAnswer: number; // in seconds
}

export interface Student {
  id: string;
  name: string;
  marks: number;
  examName: string;
  percentage: number;
  rank?: number;
  photoURL?: string;
  rollNo?: string;
  phone?: string;        // student WhatsApp number e.g. +91XXXXXXXXXX
  parentPhone?: string;  // parent WhatsApp number e.g. +91XXXXXXXXXX
  // Fee management
  feeAmount?: number;
  feeDueDate?: string;   // "YYYY-MM-DD"
  feePaid?: boolean;
  batch?: string;
  // AI/auto fields
  lastResultSent?: string;
  lastFeeSent?: string;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  subject: string;
  grade: string;
  topic?: string;
  createdBy: string;
  createdAt: string;
  questions: Question[];
  totalQuestions: number;
  totalMarks: number;
  hasNegativeMarking?: boolean;
  negativeMarkingValue?: number;
  folderId?: string;
  quizAudienceType?: 'college' | 'classes';
  aiExplanationEnabled?: boolean;
}

export interface Question {
  [x: string]: any;
  correctOption: string;
  text: any;
  id: string;
  publicId?: string; // For Cloudinary image management
  questionText: string;
  options: QuestionOption[];
  correctAnswer: string;
  Marks: number;
  timeLimit: number; // in seconds
  imageUrl?: string;
  imageFile?: File | null;
  explanation?: string;
  aiExplanationEnabled?: boolean;
  playerAnswerId?: string | null;
}

export interface QuestionOption {
  correct: any;
  id: string;
  text: string;
  imageUrl?: string;
  imageFile?: File | null;
  publicId?: string; // For Cloudinary image management
}

export interface GameRoom {
  gameCode: any;
  negativeMarkingValue: number;
  settings: any;
  winner: any;
  questionStartTime: number;
  showScores: boolean;
  id: string;
  code: string;
  quiz: Quiz;
  hostId: string;
  players: Player[];
  status: "waiting" | "active" | "finished" | "ended";
  currentQuestionIndex: number;
  startTime: Date | null;
  endTime: Date | null;
  hostSubmitted?: boolean;
  removedPlayers?: { [playerId: string]: boolean };
  removedNicknames?: { [nickname: string]: boolean };
  quizAudienceType?: 'college' | 'classes';
}

export interface ScienceSubject {
  id: string;
  name: string;
}

export interface Folder {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  parentId?: string; // For nested folders
  color?: string; // Optional color for folder
}

export interface Topic {
  id: string;
  name: string;
  quizCount: number;
}

export interface GameSettings {
  timePerQuestion: number;
  hasNegativeMarking: boolean;
  negativeMarkingValue: number;
  showLeaderboardAfterEachQuestion: boolean;
}

export interface YouTubeVideo {
  id: string;
  url: string;
  title: string;
  topic: string;
  chapter: string;
}

export interface ScheduledTest {
  id: string;
  title: string;
  classId: string;
  classIds?: string[]; // Multiple class support
  startTime: string; // ISO string
  endTime: string; // ISO string
  duration: number; // minutes
  rollNumber?: string; // Added rollNumber field
  quizId?: string; // Added optional quizId for existing quizzes
  cbtParams?: { // Made cbtParams optional
    amount: number;
    category?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    type: 'multiple' | 'boolean';
  };
  createdBy: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────
// OMR (Optical Mark Recognition) Types
// ─────────────────────────────────────────────────────────────────

/** An OMR exam created by the host, linked to a class and a quiz */
export interface OMRExam {
  id: string;
  title: string;
  /** Unique short code printed on every sheet (e.g. "OMR-2024-ABCD") */
  examCode: string;
  /** Firestore class/examName this exam belongs to */
  classId: string;
  className: string;
  /** Optional quiz whose questions are used as the answer key */
  quizId?: string;
  /** Manual answer key: array of correct option letters e.g. ["A","C","B",...] */
  answerKey: string[];
  /** Number of questions (= answerKey.length) */
  totalQuestions: number;
  /** Marks per correct answer */
  marksPerQuestion: number;
  /** Negative marks deducted per wrong answer (0 = no negative marking) */
  negativeMarks: number;
  createdBy: string;
  createdAt: string;
  /** Has the host already generated sheets? */
  sheetsGenerated: boolean;
  status: 'draft' | 'active' | 'completed';
}

/** One student's submitted OMR response after scanning */
export interface OMRResult {
  id: string;
  examId: string;
  examCode: string;
  /** Student info resolved from the unique sheet code */
  studentId: string;
  studentName: string;
  rollNo: string;
  className: string;
  /** The answers detected by OCR/image processing, indexed 0..n */
  detectedAnswers: string[];
  /** Computed score */
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  /** Per-question breakdown */
  questionResults: OMRQuestionResult[];
  scannedAt: string;
  /** URL of the uploaded scan file */
  scanFileUrl?: string;
  resultPdfUrl?: string;
  status: 'pending' | 'processed' | 'error';
}

export interface OMRQuestionResult {
  questionNo: number;
  correctAnswer: string;
  studentAnswer: string;
  isCorrect: boolean;
  marksAwarded: number;
}

/** Per-student sheet info — stored so each printed sheet has a unique link */
export interface OMRSheet {
  id: string;
  examId: string;
  examCode: string;
  studentId: string;
  studentName: string;
  rollNo: string;
  className: string;
  /** Unique sheet barcode / QR data: "examCode|studentId|rollNo" */
  sheetCode: string;
  printed: boolean;
  submitted: boolean;
  createdAt: string;
}
