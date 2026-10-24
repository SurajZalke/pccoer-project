
import React, { useState, useEffect, useMemo } from "react";
import { ref as dbRef, update, get, set as dbSet } from "firebase/database";
import { generateExplanation, generateSingleExplanation } from '../services/aiExplanationService';
import { Folder as FolderType } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { scienceSubjects } from "@/utils/gameUtils";
import { Plus, Minus, Smile, ArrowLeft, Sparkles, Brain, Zap, Lightbulb, Wand2, CheckCircle2, Rocket, Loader2, TrendingUp, ChevronRight, Image as ImageIcon } from "lucide-react";
import Cropper from 'react-easy-crop';
import { Slider } from '@/components/ui/slider';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { database } from "@/lib/firebaseConfig";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { v4 as uuidv4 } from 'uuid';
import {
  GREEK_SYMBOLS,
  SUPERSCRIPT_NUMBERS,
  SUBSCRIPT_NUMBERS,
  SUPERSCRIPT_LETTERS,
  SUBSCRIPT_LETTERS,
} from '@/utils/constants';
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from 'framer-motion';

const SymbolPicker = ({ onSelect }: { onSelect: (symbol: string) => void }) => {
  const [activeTab, setActiveTab] = useState('math');

  const tabs = useMemo(() => [
    { id: 'math', label: 'Math', sections: [{ title: 'Basic Operations', symbols: [{ symbol: '±', name: 'Plus-Minus' }, { symbol: '×', name: 'Multiplication' }, { symbol: '÷', name: 'Division' }, { symbol: '≠', name: 'Not Equal' }, { symbol: '≈', name: 'Approximately' }, { symbol: '∞', name: 'Infinity' }, { symbol: '∑', name: 'Summation' }, { symbol: '∫', name: 'Integral' }, { symbol: '√', name: 'Square Root' }, { symbol: '∏', name: 'Product' }] }, { title: 'Calculus & Logic', symbols: [{ symbol: '∂', name: 'Partial Derivative' }, { symbol: '∇', name: 'Nabla/Del' }, { symbol: '∆', name: 'Delta/Change' }, { symbol: '∈', name: 'Element Of' }, { symbol: '∉', name: 'Not Element Of' }, { symbol: '⊂', name: 'Subset Of' }, { symbol: '⊃', name: 'Superset Of' }, { symbol: '∪', name: 'Union' }, { symbol: '∩', name: 'Intersection' }, { symbol: '∀', name: 'For All' }, { symbol: '∃', name: 'There Exists' }, { symbol: '∄', name: 'Does Not Exist' }, { symbol: '∅', name: 'Empty Set' }, { symbol: '∝', name: 'Proportional To' }] }, { title: 'Superscript Numbers', symbols: SUPERSCRIPT_NUMBERS }, { title: 'Subscript Numbers', symbols: SUBSCRIPT_NUMBERS }, { title: 'Superscript Letters', symbols: SUPERSCRIPT_LETTERS }, { title: 'Subscript Letters', symbols: SUBSCRIPT_LETTERS }] },
    { id: 'greek', label: 'Greek', sections: [{ title: 'Uppercase', symbols: [{ symbol: 'Α', name: 'Alpha (Uppercase)' }, { symbol: 'Β', name: 'Beta (Uppercase)' }, { symbol: 'Γ', name: 'Gamma (Uppercase)' }, { symbol: 'Δ', name: 'Delta (Uppercase)' }, { symbol: 'Ε', name: 'Epsilon (Uppercase)' }, { symbol: 'Ζ', name: 'Zeta (Uppercase)' }, { symbol: 'Η', name: 'Eta (Uppercase)' }, { symbol: 'Θ', name: 'Theta (Uppercase)' }, { symbol: 'Ι', name: 'Iota (Uppercase)' }, { symbol: 'Κ', name: 'Kappa (Uppercase)' }, { symbol: 'Λ', name: 'Lambda (Uppercase)' }, { symbol: 'Μ', name: 'Mu (Uppercase)' }, { symbol: 'Ν', name: 'Nu (Uppercase)' }, { symbol: 'Ξ', name: 'Xi (Uppercase)' }, { symbol: 'Ο', name: 'Omicron (Uppercase)' }, { symbol: 'Π', name: 'Pi (Uppercase)' }, { symbol: 'Ρ', name: 'Rho (Uppercase)' }, { symbol: 'Σ', name: 'Sigma (Uppercase)' }, { symbol: 'Τ', name: 'Tau (Uppercase)' }, { symbol: 'Υ', name: 'Upsilon (Uppercase)' }, { symbol: 'Φ', name: 'Phi (Uppercase)' }, { symbol: 'Χ', name: 'Chi (Uppercase)' }, { symbol: 'Ψ', name: 'Psi (Uppercase)' }, { symbol: 'Ω', name: 'Omega (Uppercase)' }] }, { title: 'Lowercase', symbols: [{ symbol: 'α', name: 'Alpha (Lowercase)' }, { symbol: 'β', name: 'Beta (Lowercase)' }, { symbol: 'γ', name: 'Gamma (Lowercase)' }, { symbol: 'δ', name: 'Delta (Lowercase)' }, { symbol: 'ε', name: 'Epsilon (Lowercase)' }, { symbol: 'ζ', name: 'Zeta (Lowercase)' }, { symbol: 'η', name: 'Eta (Lowercase)' }, { symbol: 'θ', name: 'Theta (Lowercase)' }, { symbol: 'ι', name: 'Iota (Lowercase)' }, { symbol: 'κ', name: 'Kappa (Lowercase)' }, { symbol: 'λ', name: 'Lambda (Lowercase)' }, { symbol: 'μ', name: 'Mu (Lowercase)' }, { symbol: 'ν', name: 'Nu (Lowercase)' }, { symbol: 'ξ', name: 'Xi (Lowercase)' }, { symbol: 'ο', name: 'Omicron (Lowercase)' }, { symbol: 'π', name: 'Pi (Lowercase)' }, { symbol: 'ρ', name: 'Rho (Lowercase)' }, { symbol: 'σ', name: 'Sigma (Lowercase)' }, { symbol: 'τ', name: 'Tau (Lowercase)' }, { symbol: 'υ', name: 'Upsilon (Lowercase)' }, { symbol: 'φ', name: 'Phi (Lowercase)' }, { symbol: 'χ', name: 'Chi (Lowercase)' }, { symbol: 'ψ', name: 'Psi (Lowercase)' }, { symbol: 'ω', name: 'Omega (Lowercase)' }] }] },
  ], []);

  return (
    <div className="p-6 max-h-[500px] overflow-y-auto">
      <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <motion.button
            key={tab.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm whitespace-nowrap rounded-xl transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {tab.label}
          </motion.button>
        ))}
      </div>
      <div className="space-y-6">
        {tabs.find(tab => tab.id === activeTab)?.sections.map((section, sectionIndex) => (
          <motion.div
            key={sectionIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: sectionIndex * 0.05 }}
          >
            <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-200">{section.title}</h3>
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {section.symbols.map((item, idx) => (
                <motion.button
                  key={idx}
                  whileHover={{ scale: 1.1, rotate: 2 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-4 rounded-2xl border-2 bg-white dark:bg-gray-800 hover:border-blue-500 dark:hover:border-blue-400 flex flex-col items-center gap-2 text-wrap transition-all shadow-sm hover:shadow-xl cursor-pointer"
                  onClick={() => onSelect(item.symbol)}
                  title={item.name}
                >
                  <span className="text-2xl break-all text-center">{item.symbol}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 break-all text-center">{item.name}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

interface QuizOption {
  id: string;
  text: string;
}

interface QuizQuestion {
  explanation?: string | null;
  id: string;
  text: string;
  imageUrl?: string;
  imageFile?: File | null;
  publicId?: string;
  options: QuizOption[];
  correctOption: string;
  timeLimit: number;
  Marks: number;
}

const CreateQuizPage: React.FC = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [grade, setGrade] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([
    {
      id: `q_${Date.now()}`,
      text: "",
      options: [
        { id: "a", text: "" },
        { id: "b", text: "" },
        { id: "c", text: "" },
        { id: "d", text: "" },
      ],
      correctOption: "a",
      timeLimit: 30,
      Marks: 4,
      explanation: null,
    },
  ]);
  const [hasNegativeMarking, setHasNegativeMarking] = useState(false);
  const [negativeMarkingValue, setNegativeMarkingValue] = useState(25);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>("none");
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizUpdateAction, setQuizUpdateAction] = useState<'saving' | 'updating' | 'generating'>('saving');
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number | null>(null);
  const [numAiQuestions] = useState(25);
  const [loadingAiQuestions, setLoadingAiQuestions] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<QuizQuestion[]>([]);
  const [selectedSuggestedQuestions, setSelectedSuggestedQuestions] = useState<Set<string>>(new Set());
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [lastGeneratedTopic, setLastGeneratedTopic] = useState("");
  const [questionErrors, setQuestionErrors] = useState<Record<number, string[]>>({});
  const [aiExplanationEnabled, setAiExplanationEnabled] = useState(true);
  const location = useLocation();
  const quizId = location.state?.quizId;
  const isEdit = Boolean(quizId);

  // AI features
  const [loadingExplanation, setLoadingExplanation] = useState<number | null>(null);
  const [showSmartTips, setShowSmartTips] = useState(true);
  const [progress, setProgress] = useState(0);

  // Image cropping state
  const [currentCropIndex, setCurrentCropIndex] = useState<number | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const AiLoader = () => (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ rotate: [0, 15, -15, 0], scale: [0.95, 1.05, 0.95] }}
        transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
        className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg"
      >
        <Brain className="w-5 h-5 text-white drop-shadow-lg" />
      </motion.div>
      <div className="hidden md:flex flex-col items-start">
        <span className="text-xs text-indigo-200 font-semibold">Summoning the AI</span>
        <div className="flex items-center gap-1">
          <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-2 h-2 rounded-full bg-indigo-300" />
          <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 rounded-full bg-indigo-300" />
          <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 rounded-full bg-indigo-300" />
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    if (!currentUser?.uid) return;

    const loadHostSettings = async () => {
      try {
        const profileRef = dbRef(database, `users/${currentUser.uid}/profile`);
        const snapshot = await get(profileRef);
        if (snapshot.exists()) {
          const profile = snapshot.val() || {};
          setAiExplanationEnabled(profile.aiExplanationEnabled ?? true);
        }
      } catch (error) {
        console.error('Error loading AI explanation setting:', error);
      }
    };

    loadHostSettings();
  }, [currentUser?.uid]);

  useEffect(() => {
    const loadFolders = async () => {
      if (!currentUser?.uid) return;
      try {
        const foldersRef = dbRef(database, 'folders');
        const snapshot = await get(foldersRef);
        if (snapshot.exists()) {
          const foldersData = snapshot.val();
          const userFolders = Object.entries(foldersData)
            .filter(([_, folder]: [string, any]) => folder.userId === currentUser.uid)
            .map(([id, folder]: [string, any]) => ({
              id,
              name: folder.name,
              userId: folder.userId,
              createdAt: folder.createdAt,
              parentId: folder.parentId || null,
              color: folder.color || null
            }));
          setFolders(userFolders);
        }
      } catch (error) {
        console.error('Error loading folders:', error);
      }
    };
    loadFolders();
  }, [currentUser?.uid]);

  const generateQuestionsForTopic = async (topicToUse: string) => {
    if (!topicToUse || topicToUse.trim().length < 3) return;
    if (topicToUse.trim() === lastGeneratedTopic.trim()) return;
    setLastGeneratedTopic(topicToUse.trim());
    await handleGenerateAiQuestions(topicToUse.trim());
  };

  const handleTopicBlur = () => {
    if (!topic || topic.trim().length < 3) {
      setSuggestedQuestions([]);
      setShowSuggestionsModal(false);
      return;
    }
    generateQuestionsForTopic(topic);
  };

  useEffect(() => {
    if (quizId) {
      const fetchQuiz = async () => {
        const quizRef = dbRef(database, `quizzes/${quizId}`);
        const snapshot = await get(quizRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          setTitle(data.title || "");
          setDescription(data.description || "");
          setSubject(data.subject || "");
          setGrade(String(data.grade || ""));
          setTopic(data.topic || "");
          setHasNegativeMarking(!!data.hasNegativeMarking);
          if (data.folderId) setSelectedFolder(data.folderId);
          else setSelectedFolder("none");
          setNegativeMarkingValue(
            data.negativeMarkingValue === undefined || data.negativeMarkingValue === 0
              ? 25
              : data.negativeMarkingValue
          );
          setAiExplanationEnabled(data.aiExplanationEnabled ?? true);
          setQuestions(
            (data.questions || []).map((q: any) => ({
              id: q.id,
              text: q.text || q.questionText || "",
              options: q.options || [
                { id: "a", text: "" },
                { id: "b", text: "" },
                { id: "c", text: "" },
                { id: "d", text: "" },
              ],
              correctOption: q.correctOption || q.correctOptionId || "a",
              timeLimit: q.timeLimit || 30,
              Marks: q.Marks || q.marks || 4,
              imageUrl: q.imageUrl || q.questionImage || "",
              imageFile: null,
              explanation: q.explanation || null
            }))
          );
        }
      };
      fetchQuiz();
    }
  }, [quizId]);

  // Calculate progress
  useEffect(() => {
    let filled = 0;
    const total = 4; // basic fields
    if (title.trim()) filled++;
    if (subject) filled++;
    if (grade) filled++;
    if (questions.every(q => q.text.trim() && q.options.some(o => o.text.trim()))) filled++;
    setProgress((filled / total) * 100);
  }, [title, subject, grade, questions]);

  const initialSuperscriptMap: { [key: string]: string } = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', 'x': 'ˣ', 't': 'ᵗ', 'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ',
    'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ', 'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ',
    'o': 'ᵒ', 'p': 'ᵖ', 'q': 'ᵠ', 'r': 'ʳ', 's': 'ˢ', 'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ',
    'y': 'ʸ', 'z': 'ᶻ'
  };

  const initialSubscriptMap: { [key: string]: string } = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
    'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ', 'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ',
    'n': 'ₙ', 'o': 'ₒ', 'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ', 'v': 'ᵥ', 'x': 'ₓ'
  };

  const convertToUnicodeMath = (text: string): string => {
    let convertedText = text;
    convertedText = convertedText.replace(/(\w|\))(\^)([0-9+\-=\(\)a-zA-Z]+)/g, (_, base, __, exponent) => {
      let unicodeExponent = '';
      for (const char of exponent) {
        unicodeExponent += (initialSuperscriptMap[char] || char);
      }
      return base + unicodeExponent;
    });
    convertedText = convertedText.replace(/(\w|\))(_)([0-9+\-=\(\) ]+)/g, (_, base, __, subscript) => {
      let unicodeSubscript = '';
      for (const char of subscript) {
        unicodeSubscript += (initialSubscriptMap[char] || char);
      }
      return base + unicodeSubscript;
    });
    convertedText = convertedText.replace(/\*/g, '×');
    return convertedText;
  };

  const insertTextAtCursor = (text: string, index: number) => {
    if (activeQuestionIndex === index) {
      const newQuestions = [...questions];
      const q = newQuestions[index];
      const processedText = convertToUnicodeMath(text);
      newQuestions[index] = { ...q, text: q.text + processedText };
      setQuestions(newQuestions);
    }
  };

  const handleSymbolSelect = (symbol: string) => {
    if (activeQuestionIndex !== null) {
      insertTextAtCursor(symbol, activeQuestionIndex);
    }
    setShowSymbolPicker(false);
  };

  const handleAddQuestion = () => {
    setQuestions([...questions, {
      id: `q_${Date.now()}`,
      text: "",
      options: [
        { id: "a", text: "" },
        { id: "b", text: "" },
        { id: "c", text: "" },
        { id: "d", text: "" },
      ],
      correctOption: "a",
      timeLimit: 30,
      Marks: 4,
      explanation: null,
    }]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length > 1) {
      const newQuestions = [...questions];
      newQuestions.splice(index, 1);
      setQuestions(newQuestions);
      setQuestionErrors(prev => {
        const next: Record<number, string[]> = {};
        Object.entries(prev).forEach(([key, val]) => {
          const k = Number(key);
          if (k < index) next[k] = val;
          else if (k > index) next[k - 1] = val;
        });
        return next;
      });
    }
  };

  const handleQuestionChange = (index: number, field: keyof QuizQuestion, value: any) => {
    const newQuestions = [...questions];
    let processedValue = value;
    if (field === 'text') {
      processedValue = convertToUnicodeMath(String(value));
    } else if (field === 'timeLimit' || field === 'Marks') {
      processedValue = parseInt(value);
    }
    newQuestions[index] = { ...newQuestions[index], [field]: processedValue };
    setQuestions(newQuestions);
    if (questionErrors[index]) {
      setQuestionErrors(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  const handleGenerateAiQuestions = async (topicToUse: string) => {
    if (!topicToUse || numAiQuestions <= 0) return;
    setShowSuggestionsModal(false);
    setLoadingAiQuestions(true);
    setQuizUpdateAction('generating');
    try {
      const generatedQuestions = await generateExplanation(topicToUse, numAiQuestions);
      const validQuestions = Array.isArray(generatedQuestions) ? generatedQuestions.filter(q => q && q.text && q.text.trim() !== '') : [];
      const formattedQuestions: QuizQuestion[] = validQuestions.map((q: any) => {
        const validOptions = Array.isArray(q.options) ? q.options.filter(opt => opt && typeof opt === 'object') : [];
        const defaultIds = ['a', 'b', 'c', 'd'];
        const formattedOptions = validOptions.map((opt: any, index: number) => ({
          id: (opt.id && typeof opt.id === 'string') ? opt.id : defaultIds[index] || `option_${index + 1}`,
          text: opt.text ? opt.text.trim() : ''
        }));
        while (formattedOptions.length < 4) {
          const idx = formattedOptions.length;
          formattedOptions.push({ id: defaultIds[idx] || `option_${idx + 1}`, text: '' });
        }
        let correctOption = q.correctOption && formattedOptions.some((opt: any) => opt.id === q.correctOption) ? q.correctOption : formattedOptions[0].id;
        return {
          id: `q_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          text: q.text.trim(),
          options: formattedOptions,
          correctOption: correctOption,
          timeLimit: 30,
          Marks: 4,
          imageUrl: undefined,
          imageFile: undefined,
          publicId: undefined,
          explanation: q.explanation ? q.explanation.trim() : null
        };
      });
      setSuggestedQuestions(formattedQuestions);
      setSelectedSuggestedQuestions(new Set(formattedQuestions.map(q => q.id)));
      if (formattedQuestions.length > 0) {
        setShowSuggestionsModal(true);
      }
    } catch (error) {
      console.error("Error generating AI questions:", error);
      toast({
        title: "Error",
        description: "Failed to generate questions from AI. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoadingAiQuestions(false);
    }
  };

  const handleAddSelectedQuestions = () => {
    const selectedQs = suggestedQuestions.filter(q => selectedSuggestedQuestions.has(q.id));
    setQuestions(prev => [...prev, ...selectedQs]);
    setShowSuggestionsModal(false);
    setSuggestedQuestions([]);
    setSelectedSuggestedQuestions(new Set());
    toast({
      title: "Questions Added",
      description: `Added ${selectedQs.length} selected questions to your quiz! ✨`,
      variant: "default"
    });
  };

  const handleGenerateExplanation = async (index: number) => {
    const q = questions[index];
    if (!q.text.trim()) {
      toast({ title: "Question Text Required", description: "Please enter a question first.", variant: "destructive" });
      return;
    }
    setLoadingExplanation(index);
    try {
      const explanation = await generateSingleExplanation(q.text);
      const newQuestions = [...questions];
      newQuestions[index] = { ...newQuestions[index], explanation };
      setQuestions(newQuestions);
      toast({
        title: "Explanation Generated!",
        description: "AI has added an explanation to this question.",
        variant: "default"
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to generate explanation.",
        variant: "destructive"
      });
    } finally {
      setLoadingExplanation(null);
    }
  };

  // Image cropping and upload functions
  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: any, rotation = 0): Promise<File> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const maxSize = Math.max(image.width, image.height);
    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

    canvas.width = safeArea;
    canvas.height = safeArea;

    if (ctx) {
      ctx.translate(safeArea / 2, safeArea / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-safeArea / 2, -safeArea / 2);

      ctx.drawImage(
        image,
        safeArea / 2 - image.width * 0.5,
        safeArea / 2 - image.height * 0.5
      );

      const data = ctx.getImageData(0, 0, safeArea, safeArea);

      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;

      ctx.putImageData(
        data,
        Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
        Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
      );
    }

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `cropped-image-${Date.now()}.png`, { type: 'image/png' });
          resolve(file);
        }
      }, 'image/png');
    });
  };

  const handleImageChange = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
        setCurrentCropIndex(index);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = async () => {
    if (currentCropIndex === null || !imageSrc || !croppedAreaPixels) return;

    try {
      const croppedFile = await getCroppedImg(imageSrc, croppedAreaPixels);
      await uploadAndSetImage(currentCropIndex, croppedFile);
      setCurrentCropIndex(null);
      setImageSrc(null);
    } catch (error) {
      console.error('Error cropping image:', error);
      toast({
        title: 'Crop Error',
        description: 'Failed to crop image. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const uploadAndSetImage = async (index: number, file: File) => {
    const newQuestions = [...questions];
    try {
      const result = await uploadToCloudinary(
        file,
        (successResult) => {
          newQuestions[index] = {
            ...newQuestions[index],
            imageFile: file,
            imageUrl: successResult.url,
            publicId: successResult.id
          };
          setQuestions(newQuestions);
          toast({ title: 'Image Uploaded', description: 'Image uploaded successfully!', variant: 'default' });
        },
        (error) => {
          console.error('Error uploading image:', error);
          toast({
            title: 'Upload Failed',
            description: 'Failed to upload image. Please try again later.',
            variant: 'destructive'
          });
        }
      );
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Upload Error',
        description: 'Failed to upload image. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: "Quiz Title Required", description: "Please enter a title for your quiz.", variant: "destructive" });
      return;
    }
    if (!subject) {
      toast({ title: "Subject Required", description: "Please select a subject for your quiz.", variant: "destructive" });
      return;
    }
    const errors: Record<number, string[]> = {};
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const errs: string[] = [];
      if (!q.text.trim()) errs.push("Question text is required.");
      let hasAtLeastTwoOptions = false;
      let hasCorrectAnswerWithText = false;
      q.options.forEach((o) => {
        if (o.text.trim()) {
          hasAtLeastTwoOptions = true;
          if (o.id === q.correctOption) hasCorrectAnswerWithText = true;
        }
      });
      if (!hasAtLeastTwoOptions) errs.push("At least two options are required.");
      if (!hasCorrectAnswerWithText) errs.push("Selected correct answer must have text.");
      if (errs.length > 0) errors[i] = errs;
    }
    if (Object.keys(errors).length > 0) {
      setQuestionErrors(errors);
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the questions.",
        variant: "destructive"
      });
      return;
    }
    setIsSubmitting(true);
    setQuizUpdateAction('saving');
    try {
      let questionsToSave = questions;

      if (aiExplanationEnabled) {
        questionsToSave = await Promise.all(
          questions.map(async (q) => {
            if (!q.text.trim() || q.explanation?.trim()) return q;
            try {
              const explanation = await generateSingleExplanation(q.text.trim());
              return { ...q, explanation };
            } catch (error) {
              console.error('Failed to generate explanation for question:', error);
              return q;
            }
          })
        );
        setQuestions(questionsToSave);
      }

      const quizData = {
        id: quizId || uuidv4(),
        title: title.trim(),
        description: description.trim(),
        subject,
        grade,
        topic: topic.trim(),
        questions: questionsToSave.map((q) => ({
          id: q.id,
          text: q.text.trim(),
          options: q.options.map((o) => ({ id: o.id, text: o.text.trim() })),
          correctOption: q.correctOption,
          timeLimit: q.timeLimit,
          Marks: q.Marks,
          imageUrl: q.imageUrl || null,
          publicId: q.publicId || null,
          explanation: q.explanation || null
        })),
        hasNegativeMarking,
        negativeMarkingValue: hasNegativeMarking ? negativeMarkingValue : 0,
        folderId: selectedFolder !== 'none' ? selectedFolder : null,
        createdBy: currentUser?.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        aiExplanationEnabled,
      };
      if (quizId) {
        await update(dbRef(database, `quizzes/${quizId}`), quizData);
        toast({
          title: "Quiz Updated!",
          description: "Your quiz has been updated successfully! 🚀",
          variant: "default"
        });
      } else {
        await dbSet(dbRef(database, `quizzes/${quizData.id}`), quizData);
        toast({
          title: "Quiz Created!",
          description: "Your quiz has been created successfully! 🎉",
          variant: "default"
        });
      }
      navigate('/host-dashboard');
    } catch (error) {
      console.error("Error saving quiz:", error);
      toast({
        title: "Error Saving Quiz",
        description: "Failed to save quiz. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
          animate={{ x: [0, 30, 0], y: [0, -30, 0], scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 20, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"
          animate={{ x: [0, -30, 0], y: [0, 30, 0], scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 25, ease: "easeInOut", delay: 1 }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/5 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ repeat: Infinity, duration: 15, ease: "easeInOut" }}
        />
      </div>

      <div className="container mx-auto px-4 py-10 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <Button
            onClick={() => navigate('/host-dashboard')}
            variant="ghost"
            className="gap-3 mb-6 text-gray-300 hover:text-white hover:bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl transition-all"
          >
            <ArrowLeft className="w-6 h-6" /> Back
          </Button>
          <div className="flex items-center gap-4 flex-wrap">
            <motion.div
              initial={{ rotate: -10, scale: 0.8 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
            >
              <Rocket className="w-12 h-12 text-blue-400 drop-shadow-[0_0_20px_rgba(96,165,250,0.5)]" />
            </motion.div>
            <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent drop-shadow-2xl">
              {isEdit ? 'Edit Quiz' : 'Create Quiz'}
            </h1>
          </div>
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-6 h-2 bg-white/10 rounded-full overflow-hidden"
          >
            <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
          </motion.div>
          <p className="text-gray-400 mt-3 text-lg">
            {progress < 25 ? "Let's start building your quiz! 🎯" : progress < 75 ? "Great progress! Keep going! 💪" : "Almost done! You're crushing it! 🚀"}
          </p>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-10"
        >
          <Card className="p-8 md:p-10 bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[32px] relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/2 pointer-events-none" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="md:col-span-2"
              >
                <label className="block text-sm font-semibold mb-3 text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  Quiz Title
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter an exciting quiz title..."
                  className="text-lg py-4 px-6 rounded-2xl border-2 border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 transition-all shadow-lg"
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 }}
                className="md:col-span-2"
              >
                <label className="block text-sm font-semibold mb-3 text-white flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-400" />
                  Description
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this quiz is about..."
                  className="rounded-2xl border-2 border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20 transition-all resize-none shadow-lg"
                  rows={3}
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <label className="block text-sm font-semibold mb-3 text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  Subject
                </label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger className="rounded-2xl border-2 border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 transition-all h-14 shadow-lg">
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-slate-800/98 backdrop-blur-xl border-white/10 text-white">
                    {scienceSubjects.map(s => (
                      <SelectItem key={s.name} value={s.name} className="hover:bg-blue-500/20 cursor-pointer">
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45 }}
                className="relative"
              >
                <label className="block text-sm font-semibold mb-3 text-white flex items-center gap-2">
                  <Brain className="w-5 h-5 text-indigo-400" />
                  Topic <span className="text-xs text-indigo-300">(Auto-generates questions)</span>
                </label>
                <div className="relative">
                  <Input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onBlur={handleTopicBlur}
                    placeholder="e.g. Photosynthesis"
                    className="pl-14 pr-14 rounded-2xl border-2 border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/20 transition-all h-14 shadow-lg"
                  />
                  {loadingAiQuestions && (
                    <AiLoader />
                  )}
                </div>
                {loadingAiQuestions && suggestedQuestions.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-indigo-900/60 to-purple-900/60 border border-indigo-500/20 text-white shadow-xl flex items-center gap-4"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                      <Brain className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold">Generating questions with AI…</div>
                      <div className="text-sm text-white/70">Analyzing topic · Synthesizing prompts · Finalizing questions</div>
                    </div>
                  </motion.div>
                )}

                {suggestedQuestions.length > 0 && !showSuggestionsModal && (
                  <motion.button
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowSuggestionsModal(true)}
                    className="mt-4 w-full py-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-3"
                  >
                    <Wand2 className="w-6 h-6" /> View {suggestedQuestions.length} AI Suggested Questions ✨
                  </motion.button>
                )}
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <label className="block text-sm font-semibold mb-3 text-white flex items-center gap-2">
                  <ChevronRight className="w-5 h-5 text-cyan-400" />
                  Grade
                </label>
                <Select value={grade} onValueChange={setGrade}>
                  <SelectTrigger className="rounded-2xl border-2 border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20 transition-all h-14 shadow-lg">
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl bg-slate-800/98 backdrop-blur-xl border-white/10 text-white">
                    <SelectItem value="11">11th</SelectItem>
                    <SelectItem value="12">12th</SelectItem>
                  </SelectContent>
                </Select>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.55 }}
                className="flex flex-col gap-4"
              >
                <label className="block text-sm font-semibold mb-3 text-white flex items-center gap-2">
                  <Minus className="w-5 h-5 text-orange-400" />
                  Negative Marking
                </label>
                <div className="flex items-center gap-4">
                  <Switch
                    checked={hasNegativeMarking}
                    onCheckedChange={setHasNegativeMarking}
                    className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-orange-500 data-[state=checked]:to-red-500 scale-125"
                  />
                  <span className="text-white font-medium">{hasNegativeMarking ? 'Enabled' : 'Disabled'}</span>
                </div>
                {hasNegativeMarking && (
                  <div className="flex items-center gap-4">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={negativeMarkingValue}
                      onChange={e => setNegativeMarkingValue(Number(e.target.value))}
                      className="rounded-2xl border-2 border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:border-orange-400 focus:ring-4 focus:ring-orange-400/20 transition-all w-28 h-12 shadow-lg"
                    />
                    <span className="text-white font-medium">% negative marking</span>
                  </div>
                )}
              </motion.div>
            </div>
          </Card>

          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col md:flex-row justify-between items-center gap-6"
            >
              <h2 className="text-3xl font-black text-white flex items-center gap-3">
                <Zap className="w-8 h-8 text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]" />
                Questions
              </h2>
              <motion.button
                whileHover={{ scale: 1.08, y: -3 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={handleAddQuestion}
                className="px-8 py-4 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/30 transition-all flex items-center gap-3 group"
              >
                <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                Add Question
              </motion.button>
            </motion.div>

            <AnimatePresence>
              {questions.map((question, index) => (
                <motion.div
                  key={question.id}
                  initial={{ opacity: 0, y: 60, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="p-8 bg-white/5 backdrop-blur-2xl border-2 border-white/10 shadow-2xl rounded-[32px] relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-500" />
                  <div className="flex justify-between items-start mb-8 relative z-10">
                    <div className="flex items-center gap-4">
                      <motion.div
                        whileHover={{ scale: 1.15, rotate: 5 }}
                        className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-blue-500/40"
                      >
                        {index + 1}
                      </motion.div>
                      <h3 className="text-2xl font-bold text-white">Question</h3>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => handleRemoveQuestion(index)}
                      disabled={questions.length <= 1}
                      className="rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-lg shadow-red-500/30 transition-all"
                    >
                      <Minus className="w-5 h-5" />
                    </Button>
                  </div>
                  <div className="space-y-6 relative z-10">
                    <div>
                      <Textarea
                        id={`question_${question.id}`}
                        value={question.text}
                        onFocus={() => setActiveQuestionIndex(index)}
                        onChange={(e) => handleQuestionChange(index, 'text', e.target.value)}
                        placeholder="Enter your question here..."
                        className="text-lg py-5 px-6 rounded-2xl border-2 border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 transition-all resize-none shadow-lg"
                        rows={2}
                      />
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => { setActiveQuestionIndex(index); setShowSymbolPicker(true); }}
                          className="rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all"
                        >
                          <Smile className="w-5 h-5 mr-2" />
                          Symbols
                        </Button>
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleGenerateExplanation(index)}
                          disabled={loadingExplanation === index}
                          className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white border border-white/10 transition-all flex items-center gap-2"
                        >
                          {loadingExplanation === index ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                          {loadingExplanation === index ? 'Generating...' : 'Generate Explanation'}
                        </motion.button>
                      </div>
                      {question.explanation && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-4 p-5 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-2xl border border-blue-400/30"
                        >
                          <p className="text-white text-sm">
                            <CheckCircle2 className="w-5 h-5 text-blue-400 inline mr-2 mb-1" />
                            <span className="font-semibold text-blue-300">AI Explanation:</span> {question.explanation}
                          </p>
                        </motion.div>
                      )}

                      {/* Image Upload Section */}
                      <div className="mt-6">
                        <label className="block text-sm font-semibold mb-4 text-white/90 flex items-center gap-2">
                          <ImageIcon className="w-5 h-5 text-blue-400" /> Question Image
                        </label>
                        
                        {question.imageUrl ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative rounded-2xl overflow-hidden border-2 border-white/10 bg-white/5 shadow-xl"
                          >
                            <img
                              src={question.imageUrl}
                              alt="Question preview"
                              className="w-full h-64 object-cover"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleQuestionChange(index, 'imageUrl', undefined)}
                              className="absolute top-4 right-4 bg-red-500/80 hover:bg-red-600 text-white rounded-xl"
                            >
                              Remove Image
                            </Button>
                          </motion.div>
                        ) : (
                          <div className="flex flex-col sm:flex-row gap-4">
                            <label className="flex-1 flex items-center justify-center gap-3 p-8 border-2 border-dashed border-white/20 rounded-2xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer">
                              <ImageIcon className="w-10 h-10 text-blue-400" />
                              <span className="text-white font-medium">Click to select an image</span>
                              <Input
                                id={`image-upload-${question.id}`}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleImageChange(index, e)}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {question.options.map((option, optIdx) => (
                        <motion.div
                          key={option.id}
                          initial={{ opacity: 0, x: optIdx % 2 === 0 ? -20 : 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 + optIdx * 0.05 }}
                          className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                            question.correctOption === option.id
                              ? 'border-green-400 bg-gradient-to-r from-green-500/30 to-emerald-500/30 shadow-xl shadow-green-500/30'
                              : 'border-white/10 bg-white/5 hover:border-blue-400 hover:bg-white/10'
                          }`}
                          onClick={() => handleQuestionChange(index, 'correctOption', option.id)}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${
                              question.correctOption === option.id ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-lg shadow-green-500/40' : 'bg-white/20 text-white'
                            }`}>
                              {option.id.toUpperCase()}
                            </div>
                            <label className="flex-1">
                              <Input
                                id={`option_${question.id}_${option.id}`}
                                value={option.text}
                                onFocus={() => setActiveQuestionIndex(index)}
                                onChange={(e) => {
                                  const newQuestions = [...questions];
                                  const newOptions = [...newQuestions[index].options];
                                  newOptions[optIdx] = { ...newOptions[optIdx], text: convertToUnicodeMath(e.target.value) };
                                  newQuestions[index] = { ...newQuestions[index], options: newOptions };
                                  setQuestions(newQuestions);
                                }}
                                placeholder={`Option ${option.id.toUpperCase()}`}
                                className="rounded-xl border-0 bg-transparent text-white placeholder:text-white/40 focus:ring-0"
                              />
                            </label>
                            <input
                              type="radio"
                              name={`correct-${question.id}`}
                              checked={question.correctOption === option.id}
                              onChange={() => handleQuestionChange(index, 'correctOption', option.id)}
                              className="w-6 h-6 text-green-500 focus:ring-green-500"
                            />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-white/90">Time Limit (seconds)</label>
                        <Input
                          type="number"
                          min="5"
                          max="300"
                          value={question.timeLimit}
                          onChange={(e) => handleQuestionChange(index, 'timeLimit', e.target.value)}
                          className="rounded-2xl border-2 border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20 transition-all h-14 shadow-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-white/90">Marks</label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={question.Marks}
                          onChange={(e) => handleQuestionChange(index, 'Marks', e.target.value)}
                          className="rounded-2xl border-2 border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/20 transition-all h-14 shadow-lg"
                        />
                      </div>
                    </div>
                    {questionErrors[index] && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 p-5 bg-gradient-to-r from-red-500/30 to-rose-500/30 border border-red-400/50 rounded-2xl text-red-200"
                      >
                        {questionErrors[index].map((err, i) => <p key={i} className="text-sm">{err}</p>)}
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="flex justify-end gap-5 pt-6"
          >
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/host-dashboard')}
              className="px-8 py-4 rounded-2xl border-2 border-white/10 text-white hover:bg-white/10 transition-all font-semibold"
            >
              Cancel
            </Button>
            <motion.button
              whileHover={{ scale: 1.08, y: -3 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              disabled={isSubmitting}
              className="px-10 py-4 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 hover:from-blue-600 hover:via-indigo-600 hover:to-purple-600 text-white rounded-2xl font-black text-lg shadow-2xl shadow-indigo-500/40 transition-all disabled:opacity-70"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  {quizUpdateAction === 'saving' ? 'Saving...' : 'Updating...'}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Rocket className="w-6 h-6" />
                  {isEdit ? 'Update Quiz' : 'Create Quiz'}
                </div>
              )}
            </motion.button>
          </motion.div>
        </motion.form>
      </div>

      <AnimatePresence>
        {loadingAiQuestions && (
          <motion.div
            key="ai-loading-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-2xl px-4 py-6"
          >
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="relative max-w-3xl w-full rounded-[32px] border border-white/10 bg-gradient-to-br from-slate-900/95 to-slate-800/95 p-8 overflow-hidden shadow-2xl shadow-fuchsia-500/20"
            >
              <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-violet-500/20 to-transparent blur-3xl" />
              <div className="absolute -left-16 top-16 w-32 h-32 rounded-full bg-cyan-500/20 blur-2xl animate-pulse" />
              <div className="absolute right-0 top-20 w-48 h-48 rounded-full bg-fuchsia-500/15 blur-3xl animate-pulse" />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950 to-transparent" />
              <div className="relative z-10 grid gap-6 lg:grid-cols-[120px_1fr] items-center">
                <div className="relative flex items-center justify-center w-28 h-28 mx-auto rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 shadow-[0_0_60px_rgba(99,102,241,0.35)]">
                  <motion.div
                    animate={{ rotate: [0, 12, -12, 0] }}
                    transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                    className="flex items-center justify-center w-20 h-20 rounded-full bg-white/15"
                  >
                    <Sparkles className="w-10 h-10 text-white" />
                  </motion.div>
                </div>
                <div className="space-y-4 text-center lg:text-left">
                  <p className="text-2xl font-black text-white">AI question generation in progress</p>
                  <p className="text-sm text-slate-300 max-w-2xl">
                    Your topic has been captured. The AI is now designing futuristic question packs, then showing them instantly for review.
                  </p>
                </div>
              </div>
              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {['Analyzing', 'Crafting', 'Polishing'].map((step, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: [0.5, 1, 0.5], y: [0, -8, 0] }}
                    transition={{ repeat: Infinity, duration: 1.8, delay: idx * 0.15 }}
                    className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 p-5 text-center"
                  >
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 animate-[pulse_2s_infinite]" />
                    <span className="block text-3xl font-black text-white mb-2">{idx + 1}</span>
                    <span className="text-sm text-slate-300">{step}</span>
                  </motion.div>
                ))}
              </div>
              <div className="mt-10 rounded-[28px] border border-white/10 bg-white/5 p-5 text-center text-slate-300">
                <div className="relative mx-auto mb-4 h-2 w-full max-w-xl overflow-hidden rounded-full bg-slate-800">
                  <motion.div
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
                    className="absolute inset-y-0 w-1/2 rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-fuchsia-400"
                  />
                </div>
                <p className="text-sm text-slate-200">Creating the wave of future-ready AI questions...</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Crop Dialog */}
      <Dialog open={currentCropIndex !== null} onOpenChange={(open) => {
        if (!open) {
          setCurrentCropIndex(null);
          setImageSrc(null);
        }
      }}>
        <DialogContent className="sm:max-w-2xl rounded-[32px] bg-slate-900/98 backdrop-blur-xl border-white/10">
          <DialogTitle className="text-2xl font-black bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Crop Question Image</DialogTitle>
          {imageSrc && (
            <div className="relative h-96 w-full overflow-hidden rounded-2xl bg-slate-800">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={16 / 9}
                cropShape="rect"
                showGrid={true}
                onCropChange={setCrop}
                onCropComplete={(_, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels)}
                onZoomChange={setZoom}
              />
            </div>
          )}
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-3 text-white/90">Zoom</label>
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.1}
                onValueChange={(value) => setZoom(value[0])}
              />
            </div>
          </div>
          <DialogFooter className="flex gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setCurrentCropIndex(null);
                setImageSrc(null);
              }}
              className="rounded-2xl border-white/10 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCropComplete}
              className="rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
            >
              Crop & Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSymbolPicker} onOpenChange={setShowSymbolPicker}>
        <DialogContent className="sm:max-w-5xl rounded-[32px] bg-slate-900/98 backdrop-blur-xl border-white/10">
          <DialogTitle className="text-2xl font-black bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Insert Symbol</DialogTitle>
          <SymbolPicker onSelect={handleSymbolSelect} />
        </DialogContent>
      </Dialog>

      <Dialog open={showSuggestionsModal} onOpenChange={setShowSuggestionsModal}>
        <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-y-auto rounded-[32px] bg-slate-900/98 backdrop-blur-xl border-white/10">
          <DialogTitle className="text-3xl font-black bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            AI Suggested Questions
            <span className="text-indigo-300 text-lg ml-2">({selectedSuggestedQuestions.size} selected)</span>
          </DialogTitle>
          <DialogDescription className="text-white/70 text-base">
            Select the questions you want to add to your quiz! ✨
          </DialogDescription>
          <div className="space-y-4 mt-8">
            {suggestedQuestions.map((question, idx) => (
              <motion.div
                key={question.id}
                whileHover={{ scale: 1.02, y: -3 }}
                className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedSuggestedQuestions.has(question.id)
                    ? 'border-indigo-400 bg-gradient-to-r from-indigo-500/30 to-purple-500/30 shadow-xl shadow-indigo-500/30'
                    : 'border-white/10 bg-white/5 hover:border-indigo-400/70'
                }`}
                onClick={() => {
                  const newSel = new Set(selectedSuggestedQuestions);
                  if (newSel.has(question.id)) newSel.delete(question.id);
                  else newSel.add(question.id);
                  setSelectedSuggestedQuestions(newSel);
                }}
              >
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={selectedSuggestedQuestions.has(question.id)}
                    onChange={() => {}}
                    className="mt-1 w-7 h-7 text-indigo-500 rounded-lg"
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-xl text-white mb-4">{idx + 1}. {question.text}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {question.options.map(opt => (
                        <div
                          key={opt.id}
                          className={`p-3 rounded-xl ${
                            opt.id === question.correctOption
                              ? 'bg-gradient-to-r from-green-500/30 to-emerald-500/30 text-green-300 font-semibold border border-green-400/30'
                              : 'bg-white/5 text-white/80 border border-white/10'
                          }`}
                        >
                          {opt.id.toUpperCase()}. {opt.text}
                          {opt.id === question.correctOption && <CheckCircle2 className="w-5 h-5 inline ml-2 text-green-400" />}
                        </div>
                      ))}
                    </div>
                    {question.explanation && (
                      <p className="text-sm text-blue-300 mt-3 italic">💡 {question.explanation}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          <DialogFooter className="flex flex-col md:flex-row justify-between items-center gap-4 mt-8">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setSelectedSuggestedQuestions(new Set(suggestedQuestions.map(q => q.id)))}
              className="rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/10 px-6 py-3"
            >
              <CheckCircle2 className="w-5 h-5 mr-2" /> Select All
            </Button>
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowSuggestionsModal(false)}
                className="rounded-2xl border-white/10 text-white hover:bg-white/10 px-6 py-3"
              >
                Cancel
              </Button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={handleAddSelectedQuestions}
                disabled={selectedSuggestedQuestions.size === 0}
                className="rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white px-8 py-3 font-bold shadow-lg shadow-indigo-500/30"
              >
                Add Selected ({selectedSuggestedQuestions.size})
              </motion.button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {showSmartTips && (
          <motion.div
            initial={{ opacity: 0, x: 50, y: 50 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 50, y: 50 }}
            className="fixed bottom-6 right-6 max-w-xs p-6 bg-gradient-to-br from-indigo-500/90 to-blue-500/90 backdrop-blur-xl rounded-[32px] shadow-2xl shadow-indigo-500/40 border border-white/30 z-50 cursor-pointer"
            onClick={() => setShowSmartTips(false)}
          >
            <div className="flex items-start gap-4">
              <Lightbulb className="w-10 h-10 text-yellow-300 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]" />
              <div className="flex-1">
                <h4 className="font-bold text-lg text-white mb-2">Pro Tip!</h4>
                <p className="text-sm text-white/90 leading-relaxed">
                  Enter a topic and let AI generate questions for you! Then just select the ones you like! 🚀
                </p>
              </div>
              <button className="text-white/60 hover:text-white transition-colors">
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CreateQuizPage;
