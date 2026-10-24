import React, { useState, useRef, useEffect, useMemo } from "react";
import { ref as dbRef, push as dbPush, set as dbSet, get, child, update, remove as dbRemove } from "firebase/database";
import { generateExplanation, generateSingleExplanation } from '../services/aiExplanationService';
import { Question, Folder as FolderType } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { scienceSubjects } from "@/utils/gameUtils";
import { Plus, Minus, Smile, FolderPlus } from "lucide-react";
import { uploadToCloudinary } from '@/lib/cloudinary';
import { database } from "@/lib/firebaseConfig";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Cloudinary } from '@cloudinary/url-gen';
import { AdvancedImage } from '@cloudinary/react';
import { fill } from '@cloudinary/url-gen/actions/resize';
import { byRadius } from '@cloudinary/url-gen/actions/roundCorners';
import { autoGravity } from '@cloudinary/url-gen/qualifiers/gravity';
import Cropper from 'react-easy-crop';
import { Slider } from '@/components/ui/slider';

import { v4 as uuidv4 } from 'uuid';

import {
  MATH_SYMBOLS,
  CHEMISTRY_SYMBOLS,
  PHYSICS_SYMBOLS,
  BIOLOGY_SYMBOLS,
  COMMON_FORMULAS,
  CONSTANTS,
  ADVANCED_MATH,
  ADVANCED_PHYSICS,
  ADVANCED_CHEMISTRY,
  ADVANCED_BIOLOGY,
  CONSTANT_SYMBOLS,
  GREEK_SYMBOLS,
  SUPERSCRIPT_NUMBERS,
  SUBSCRIPT_NUMBERS,
  SUPERSCRIPT_LETTERS,
  SUBSCRIPT_LETTERS,
} from '@/utils/constants';

import 'katex/dist/katex.min.css';
import katex from 'katex';
import { useLocation, useNavigate } from "react-router-dom";

const SymbolPicker = ({ onSelect }: { onSelect: (symbol: string) => void }) => {
  const [activeTab, setActiveTab] = useState('math');

  const tabs = useMemo(() => [
    {
      id: 'math',
      label: 'Math',
      sections: [
        {
          title: 'Basic Operations',
          symbols: [
            { symbol: '±', name: 'Plus-Minus' },
            { symbol: '×', name: 'Multiplication' },
            { symbol: '÷', name: 'Division' },
            { symbol: '≠', name: 'Not Equal' },
            { symbol: '≈', name: 'Approximately' },
            { symbol: '∞', name: 'Infinity' },
            { symbol: '∑', name: 'Summation' },
            { symbol: '∫', name: 'Integral' },
            { symbol: '√', name: 'Square Root' },
            { symbol: '∏', name: 'Product' },
          ],
        },
        {
          title: 'Calculus & Logic',
          symbols: [
            { symbol: '∂', name: 'Partial Derivative' },
            { symbol: '∇', name: 'Nabla/Del' },
            { symbol: '∆', name: 'Delta/Change' },
            { symbol: '∈', name: 'Element Of' },
            { symbol: '∉', name: 'Not Element Of' },
            { symbol: '⊂', name: 'Subset Of' },
            { symbol: '⊃', name: 'Superset Of' },
            { symbol: '∪', name: 'Union' },
            { symbol: '∩', name: 'Intersection' },
            { symbol: '∀', name: 'For All' },
            { symbol: '∃', name: 'There Exists' },
            { symbol: '∄', name: 'Does Not Exist' },
            { symbol: '∅', name: 'Empty Set' },
            { symbol: '∝', name: 'Proportional To' },
          ],
        },
        {
          title: 'Superscript Numbers',
          symbols: SUPERSCRIPT_NUMBERS,
        },
        {
          title: 'Subscript Numbers',
          symbols: SUBSCRIPT_NUMBERS,
        },
        {
          title: 'Superscript Letters',
          symbols: SUPERSCRIPT_LETTERS,
        },
        {
          title: 'Subscript Letters',
          symbols: SUBSCRIPT_LETTERS,
        },
      ],
    },
    {
      id: 'greek',
      label: 'Greek',
      sections: [
        {
          title: 'Uppercase',
          symbols: [
            { symbol: 'Α', name: 'Alpha (Uppercase)' },
            { symbol: 'Β', name: 'Beta (Uppercase)' },
            { symbol: 'Γ', name: 'Gamma (Uppercase)' },
            { symbol: 'Δ', name: 'Delta (Uppercase)' },
            { symbol: 'Ε', name: 'Epsilon (Uppercase)' },
            { symbol: 'Ζ', name: 'Zeta (Uppercase)' },
            { symbol: 'Η', name: 'Eta (Uppercase)' },
            { symbol: 'Θ', name: 'Theta (Uppercase)' },
            { symbol: 'Ι', name: 'Iota (Uppercase)' },
            { symbol: 'Κ', name: 'Kappa (Uppercase)' },
            { symbol: 'Λ', name: 'Lambda (Uppercase)' },
            { symbol: 'Μ', name: 'Mu (Uppercase)' },
            { symbol: 'Ν', name: 'Nu (Uppercase)' },
            { symbol: 'Ξ', name: 'Xi (Uppercase)' },
            { symbol: 'Ο', name: 'Omicron (Uppercase)' },
            { symbol: 'Π', name: 'Pi (Uppercase)' },
            { symbol: 'Ρ', name: 'Rho (Uppercase)' },
            { symbol: 'Σ', name: 'Sigma (Uppercase)' },
            { symbol: 'Τ', name: 'Tau (Uppercase)' },
            { symbol: 'Υ', name: 'Upsilon (Uppercase)' },
            { symbol: 'Φ', name: 'Phi (Uppercase)' },
            { symbol: 'Χ', name: 'Chi (Uppercase)' },
            { symbol: 'Ψ', name: 'Psi (Uppercase)' },
            { symbol: 'Ω', name: 'Omega (Uppercase)' },
          ],
        },
        {
          title: 'Lowercase',
          symbols: [
            { symbol: 'α', name: 'Alpha (Lowercase)' },
            { symbol: 'β', name: 'Beta (Lowercase)' },
            { symbol: 'γ', name: 'Gamma (Lowercase)' },
            { symbol: 'δ', name: 'Delta (Lowercase)' },
            { symbol: 'ε', name: 'Epsilon (Lowercase)' },
            { symbol: 'ζ', name: 'Zeta (Lowercase)' },
            { symbol: 'η', name: 'Eta (Lowercase)' },
            { symbol: 'θ', name: 'Theta (Lowercase)' },
            { symbol: 'ι', name: 'Iota (Lowercase)' },
            { symbol: 'κ', name: 'Kappa (Lowercase)' },
            { symbol: 'λ', name: 'Lambda (Lowercase)' },
            { symbol: 'μ', name: 'Mu (Lowercase)' },
            { symbol: 'ν', name: 'Nu (Lowercase)' },
            { symbol: 'ξ', name: 'Xi (Lowercase)' },
            { symbol: 'ο', name: 'Omicron (Lowercase)' },
            { symbol: 'π', name: 'Pi (Lowercase)' },
            { symbol: 'ρ', name: 'Rho (Lowercase)' },
            { symbol: 'σ', name: 'Sigma (Lowercase)' },
            { symbol: 'τ', name: 'Tau (Lowercase)' },
            { symbol: 'υ', name: 'Upsilon (Lowercase)' },
            { symbol: 'φ', name: 'Phi (Lowercase)' },
            { symbol: 'χ', name: 'Chi (Lowercase)' },
            { symbol: 'ψ', name: 'Psi (Lowercase)' },
            { symbol: 'ω', name: 'Omega (Lowercase)' },
          ],
        },
      ],
    },
    {
      id: 'chemistry',
      label: 'Chemistry',
      sections: [
        {
          title: 'Common Compounds',
          symbols: [
            { symbol: 'H₂O', name: 'Water' },
            { symbol: 'CO₂', name: 'Carbon Dioxide' },
            { symbol: 'NaCl', name: 'Sodium Chloride' },
            { symbol: 'H₂SO₄', name: 'Sulfuric Acid' },
            { symbol: 'HCl', name: 'Hydrochloric Acid' },
            { symbol: 'NaOH', name: 'Sodium Hydroxide' },
            { symbol: 'CH₄', name: 'Methane' },
            { symbol: 'C₂H₅OH', name: 'Ethanol' },
            { symbol: 'NH₃', name: 'Ammonia' },
            { symbol: 'O₃', name: 'Ozone' },
            { symbol: 'CaCO₃', name: 'Calcium Carbonate' },
            { symbol: 'Fe₂O₃', name: 'Iron(III) Oxide' },
            { symbol: 'KMnO₄', name: 'Potassium Permanganate' },
            { symbol: 'AgNO₃', name: 'Silver Nitrate' },
          ],
        },
        {
          title: 'Reaction Symbols',
          symbols: [
            { symbol: '→', name: 'Reaction Arrow' },
            { symbol: '⇌', name: 'Equilibrium' },
            { symbol: '∆', name: 'Heat' },
            { symbol: '↑', name: 'Gas Evolution' },
            { symbol: '↓', name: 'Precipitation' },
            { symbol: '⇅', name: 'Resonance' },
          ],
        },
      ],
    },
    {
      id: 'physics',
      label: 'Physics',
      sections: [
        {
          title: 'Greek Letters',
          symbols: [
            { symbol: 'λ', name: 'Wavelength' },
            { symbol: 'μ', name: 'Micro' },
            { symbol: 'Ω', name: 'Ohm' },
            { symbol: 'π', name: 'Pi' },
            { symbol: 'θ', name: 'Theta' },
            { symbol: 'ρ', name: 'Density' },
            { symbol: 'σ', name: 'Sigma' },
            { symbol: 'τ', name: 'Tau' },
            { symbol: 'φ', name: 'Phi' },
            { symbol: 'ν', name: 'Frequency' },
            { symbol: 'α', name: 'Alpha' },
            { symbol: 'β', name: 'Beta' },
            { symbol: 'γ', name: 'Gamma' },
          ],
        },
        {
          title: 'Physical Constants & Variables',
          symbols: [
            { symbol: 'ε₀', name: 'Permittivity of Free Space' },
            { symbol: 'μ₀', name: 'Permeability of Free Space' },
            { symbol: '∆x', name: 'Displacement' },
            { symbol: '∆v', name: 'Change in Velocity' },
            { symbol: '∆t', name: 'Time Interval' },
            { symbol: '∆E', name: 'Change in Energy' },
            { symbol: '∆P', name: 'Change in Momentum' },
          ],
        },
      ],
    },
    {
      id: 'biology',
      label: 'Biology',
      sections: [
        {
          title: 'Basic Symbols',
          symbols: [
            { symbol: '♂', name: 'Male' },
            { symbol: '♀', name: 'Female' },
            { symbol: '→', name: 'Leads to' },
            { symbol: '⇌', name: 'Reversible Process' },
          ],
        },
        {
          title: 'Biomolecules & Concepts',
          symbols: [
            { symbol: 'ATP', name: 'Adenosine Triphosphate' },
            { symbol: 'DNA', name: 'Deoxyribonucleic Acid' },
            { symbol: 'RNA', name: 'Ribonucleic Acid' },
            { symbol: 'ADP', name: 'Adenosine Diphosphate' },
            { symbol: 'NADH', name: 'Nicotinamide Adenine Dinucleotide' },
            { symbol: 'CO₂', name: 'Carbon Dioxide' },
            { symbol: 'O₂', name: 'Oxygen' },
            { symbol: 'H₂O', name: 'Water' },
            { symbol: 'C₆H₁₂O₆', name: 'Glucose' },
            { symbol: 'pH', name: 'pH Scale' },
            { symbol: '∆G', name: 'Change in Gibbs Free Energy' },
          ],
        },
      ],
    },
    {
      id: 'formulas',
      label: 'Formulas',
      sections: [
        {
          title: 'Common Formulas',
          symbols: COMMON_FORMULAS,
        },
      ],
    },
    {
      id: 'constants',
      label: 'Constants',
      sections: [
        {
          title: 'Physical Constants',
          symbols: CONSTANTS,
        },
      ],
    },
    {
      id: 'advanced-math',
      label: 'Advanced Math',
      sections: [
        {
          title: 'Advanced Math Symbols',
          symbols: ADVANCED_MATH,
        },
      ],
    },
    {
      id: 'advanced-physics',
      label: 'Advanced Physics',
      sections: [
        {
          title: 'Advanced Physics Symbols',
          symbols: ADVANCED_PHYSICS,
        },
      ],
    },
    {
      id: 'advanced-chemistry',
      label: 'Advanced Chemistry',
      sections: [
        {
          title: 'Advanced Chemistry Symbols',
          symbols: ADVANCED_CHEMISTRY,
        },
      ],
    },
    {
      id: 'advanced-biology',
      label: 'Advanced Biology',
      sections: [
        {
          title: 'Advanced Biology Symbols',
          symbols: ADVANCED_BIOLOGY,
        },
      ],
    },
  ], []);

  return (
    <div className="p-4 max-h-[400px] overflow-y-auto">
      <div className="flex space-x-2 mb-4 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "outline"}
            onClick={() => setActiveTab(tab.id)}
            className="px-3 py-1 text-sm whitespace-nowrap"
          >
            {tab.label}
          </Button>
        ))}
      </div>
      <div className="space-y-4">
        {tabs.find(tab => tab.id === activeTab)?.sections.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            <h3 className="text-md font-semibold mb-2">{section.title}</h3>
            <div className="grid grid-cols-6 gap-2">
              {section.symbols.map((item) => (
                <Button
                  key={item.symbol}
                  variant="outline"
                  onClick={() => onSelect(item.symbol)}
                  className="p-2 h-auto hover:bg-gray-100 dark:hover:bg-gray-700 flex flex-col items-center justify-center gap-1 text-wrap"
                  title={item.name}
                >
                  <span className="text-md break-all text-center">{item.symbol}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 break-all text-center">
                    {item.name}
                  </span>
                  {('unit' in item) && (
                    <span className="text-xs text-blue-500 dark:text-blue-400">
                      {String(item.unit)}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </div>
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
  publicId?: string; // Add publicId for Cloudinary
  options: QuizOption[];
  correctOption: string;
  timeLimit: number;
  Marks: number;
}


const CreateQuizForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [title, setTitle] = useState("");
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");


  const [grade, setGrade] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([{
    id: `q_${Date.now()}`,
    text: "",
    options: [
      { id: "a", text: "" },
      { id: "b", text: "" },
      { id: "c", text: "" },
      { id: "d", text: "" }
    ],
    correctOption: "a",
    timeLimit: 30,
    Marks: 4,
    explanation: null
  }]);
  const [hasNegativeMarking, setHasNegativeMarking] = useState(false);
  const [negativeMarkingValue, setNegativeMarkingValue] = useState(25);
  
  // Folder management state
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>("none");
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#6366f1"); // Default indigo color
  
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizUpdateAction, setQuizUpdateAction] = useState<'saving' | 'updating' | 'generating'>('saving');
  const [activeInputRef, setActiveInputRef] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);

  const [numAiQuestions, setNumAiQuestions] = useState(25);
  const [loadingAiQuestions, setLoadingAiQuestions] = useState(false);

  const [suggestedQuestions, setSuggestedQuestions] = useState<QuizQuestion[]>([]);
  const [selectedSuggestedQuestions, setSelectedSuggestedQuestions] = useState<Set<string>>(new Set());
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  
  // Debounce logic for auto-suggest
  const [debouncedTopic, setDebouncedTopic] = useState("");

  // Per-question inline validation errors: { [questionIndex]: string[] }
  const [questionErrors, setQuestionErrors] = useState<Record<number, string[]>>({});
  const [suggestingForIndex, setSuggestingForIndex] = useState<number | null>(null);

  // Image cropping state
  const [currentCropIndex, setCurrentCropIndex] = useState<number | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const location = useLocation();
  const quizId = location.state?.quizId;
  const isEdit = Boolean(quizId);


  // Load folders when component mounts
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

  // Debounce topic input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTopic(topic);
    }, 1000);
    return () => clearTimeout(timer);
  }, [topic]);

  // Auto-generate questions when debouncedTopic changes — only if AI is enabled
  useEffect(() => {
    // Read AI enabled flag from Firebase profile before auto-generating
    const maybeGenerate = async () => {
      if (debouncedTopic.trim().length < 3) {
        setSuggestedQuestions([]);
        setShowSuggestionsModal(false);
        return;
      }
      try {
        if (currentUser?.uid) {
          const { ref: dbR, get: dbG } = await import('firebase/database');
          const profRef = dbR(database, `users/${currentUser.uid}/profile/aiExplanationEnabled`);
          const snap = await dbG(profRef);
          // If the flag is explicitly set to false, skip generation entirely
          if (snap.exists() && snap.val() === false) {
            setSuggestedQuestions([]);
            return;
          }
        }
      } catch { /* can't read flag — proceed */ }
      handleGenerateAiQuestions(debouncedTopic);
    };
    maybeGenerate();
  }, [debouncedTopic]);

  useEffect(() => {
    if (quizId) {
      // Fetch quiz from DB and pre-fill form fields
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
          // Set folder if it exists, otherwise set to "none"
          if (data.folderId) {
            setSelectedFolder(data.folderId);
          } else {
            setSelectedFolder("none");
          }
          // Always set default to 25 if not present or 0
          setNegativeMarkingValue(
            data.negativeMarkingValue === undefined || data.negativeMarkingValue === 0
              ? 25
              : data.negativeMarkingValue
          );
          setQuestions(
            (data.questions || []).map((q: any) => ({
              id: q.id,
              text: q.text || q.questionText || "",
              options: q.options || [
                { id: "a", text: "" },
                { id: "b", text: "" },
                { id: "c", text: "" },
                { id: "d", text: "" }
              ],
              correctOption: q.correctOption || q.correctOptionId || "a",
              timeLimit: q.timeLimit || 30,
              Marks: q.Marks || q.marks || 4,
              imageUrl: q.imageUrl || q.questionImage || "",
              imageFile: null,
            }))
          );
        }
      };
      fetchQuiz();
    }
    // eslint-disable-next-line
  }, [quizId]);
  
  // Function to handle folder creation
  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !currentUser?.uid) return;
    
    try {
      const folderId = uuidv4();
      const newFolder: FolderType = {
        id: folderId,
        name: newFolderName.trim(),
        userId: currentUser.uid,
        createdAt: new Date().toISOString(),
        parentId: null,
        color: newFolderColor || null
      };
      
      // Add folder to Firebase
      await update(dbRef(database, `folders/${folderId}`), newFolder);
      
      // Update local state
      setFolders([...folders, newFolder]);
      setSelectedFolder(folderId); // Select the newly created folder
      setNewFolderName("");
      setFolderDialogOpen(false);
      
      toast({
        title: "Folder Created",
        description: `Folder "${newFolderName}" has been created successfully.`,
        variant: "default"
      });
    } catch (error) {
      console.error('Error creating folder:', error);
      toast({
        title: "Error",
        description: "Failed to create folder. Please try again.",
        variant: "destructive"
      });
    }
  };

  interface SuperscriptMap {
    [key: string]: string;
  }

  const initialSuperscriptMap: SuperscriptMap = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', 'x': 'ˣ', 't': 'ᵗ',
    'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ', 'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ', 'p': 'ᵖ', 'q': 'ᵠ', 'r': 'ʳ', 's': 'ˢ', 'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ', 'y': 'ʸ', 'z': 'ᶻ'
  };

  const initialSubscriptMap: { [key: string]: string } = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
    'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ', 'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ', 'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ', 'v': 'ᵥ', 'x': 'ₓ'
  };

  const convertToUnicodeMath = (text: string): string => {
    let convertedText = text;

    // Convert superscripts: x^2 -> x²
    convertedText = convertedText.replace(/(\w|\))(\^)([0-9+\-=\(\)a-zA-Z]+)/g, (match, base, caret, exponent) => {
      let unicodeExponent = '';
      for (const char of exponent) {
        unicodeExponent += superscriptMap[char] || char;
      }
      return base + unicodeExponent;
    });

    // Convert subscripts: x_2 -> x₂
    convertedText = convertedText.replace(/(\w|\))(_)([0-9+\-=\(\) ]+)/g, (match, base, underscore, subscript) => {
      let unicodeSubscript = '';
      for (const char of subscript) {
        unicodeSubscript += subscriptMap[char] || char;
      }
      return base + unicodeSubscript;
    });

    // Convert asterisk to multiplication sign
    convertedText = convertedText.replace(/\*/g, '×');

    // Convert forward slash to division sign

    return convertedText;
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setActiveInputRef(e.target);
  };

  const renderMath = (text: string) => {
    // Preprocess the text to convert common notations to LaTeX
    let latexText = text;
    // Convert x^y to x^{y}
    latexText = latexText.replace(/(\w+)\^(\w+)/g, '$1^{$2}');
    // Convert squ(x) to \sqrt{x}
    latexText = latexText.replace(/squ\(([^)]*)\)/g, '\\sqrt{$1}');
    // Convert division like a/b to \frac{a}{b}
    latexText = latexText.replace(/(\w+)\/(\w+)/g, '\\frac{$1}{$2}');

    try {
      return katex.renderToString(latexText, { throwOnError: false });
    } catch (e) {
      return text;
    }
  };

  const insertTextAtCursor = (text: string) => {
    if (activeInputRef) {
      const start = activeInputRef.selectionStart || 0;
      const end = activeInputRef.selectionEnd || 0;
      const currentValue = activeInputRef.value;
      let newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
      
      // Apply conversion to the new value before updating state
      newValue = convertToUnicodeMath(newValue);

      // Find the question and option being edited
      let questionIndex = -1;
      let optionIndex = -1;

      for (let i = 0; i < questions.length; i++) {
        if (activeInputRef.id === `question_${questions[i].id}`) {
          questionIndex = i;
          break;
        }
        for (let j = 0; j < questions[i].options.length; j++) {
          if (activeInputRef.id === `option_${questions[i].id}_${questions[i].options[j].id}`) {
            questionIndex = i;
            optionIndex = j;
            break;
          }
        }
        if (questionIndex !== -1) break;
      }

      if (questionIndex !== -1) {
        const newQuestions = [...questions];
        const question = newQuestions[questionIndex];
  
        if (optionIndex !== -1) {
          // Update option text
          const updatedOptions = [...question.options];
          updatedOptions[optionIndex] = { ...updatedOptions[optionIndex], text: newValue };
          newQuestions[questionIndex] = { ...question, options: updatedOptions };
        } else {
          // Update question text
          newQuestions[questionIndex] = { ...question, text: newValue };
        }
  
        setQuestions(newQuestions);

        // Manually set cursor position after state update, if activeInputRef is still valid
        // This might require a slight delay or a more robust approach for controlled components
        // For now, keeping it simple as the primary goal is content display.
        activeInputRef.setSelectionRange(start + text.length, start + text.length);
      }
    }
  };

  const handleSymbolSelect = (symbol: string) => {
    insertTextAtCursor(symbol);
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
        { id: "d", text: "" }
      ],
      correctOption: "a",
      timeLimit: 30,
      Marks: 4,
      explanation: null
    }]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length > 1) {
      const newQuestions = [...questions];
      newQuestions.splice(index, 1);
      setQuestions(newQuestions);
      // Rebuild question errors with shifted indices
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
    // Clear inline error for this question when user edits it
    if (questionErrors[index]) {
      setQuestionErrors(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  // Image cropping functions
  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

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
      await uploadToCloudinary(
        file,
        (successResult) => {
          newQuestions[index] = {
            ...newQuestions[index],
            imageFile: file,
            imageUrl: successResult.url,
            publicId: successResult.id
          };
          setQuestions(newQuestions);
          toast({ title: 'Image Uploaded', description: 'Image uploaded successfully!' });
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

  const superscriptMap: { [key: string]: string } = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', 'x': 'ˣ', 't': 'ᵗ',
    'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ', 'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ', 'p': 'ᵖ', 'q': 'ᵠ', 'r': 'ʳ', 's': 'ˢ', 'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ', 'y': 'ʸ', 'z': 'ᶻ'
  };

  const subscriptMap: { [key: string]: string } = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
    'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ', 'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ', 'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ', 'v': 'ᵥ', 'x': 'ₓ'
  };

  const handleOptionChange = (questionIndex: number, optionId: string, value: string) => {
    const newQuestions = [...questions];
    const optionIndex = newQuestions[questionIndex].options.findIndex(opt => opt.id === optionId);
    if (optionIndex !== -1) {
      const convertedValue = convertToUnicodeMath(value); // Apply conversion
      newQuestions[questionIndex].options[optionIndex].text = convertedValue;
      setQuestions(newQuestions);
    }
    // Clear inline error for this question when user edits it
    if (questionErrors[questionIndex]) {
      setQuestionErrors(prev => {
        const next = { ...prev };
        delete next[questionIndex];
        return next;
      });
    }
  };

  const handleGenerateAiQuestions = async (topicToUse: string) => {
    if (!topicToUse || numAiQuestions <= 0) {
      return;
    }

    setLoadingAiQuestions(true);
    setQuizUpdateAction('generating');
    try {
      const generatedQuestions = await generateExplanation(topicToUse, numAiQuestions);
      
      // Log the raw response for debugging
      console.log('Raw AI response:', generatedQuestions);
      
      // Filter out any questions with empty text
      const validQuestions = Array.isArray(generatedQuestions) ? generatedQuestions.filter(q => q && q.text && q.text.trim() !== '') : [];
      
      if (validQuestions.length < (generatedQuestions?.length || 0)) {
        console.warn(`Filtered out ${(generatedQuestions?.length || 0) - validQuestions.length} questions with empty text`);
      }
      
      // Validate and format questions with proper option IDs
      const formattedQuestions: QuizQuestion[] = validQuestions.map((q: any) => {
        // Ensure each question has valid options with proper IDs
        const validOptions = Array.isArray(q.options) ? q.options.filter(opt => opt && typeof opt === 'object') : [];
        
        // Default option IDs if missing
        const defaultIds = ['a', 'b', 'c', 'd'];
        
        // Map options with validation for IDs
        const formattedOptions = validOptions.map((opt: any, index: number) => ({
          id: (opt.id && typeof opt.id === 'string') ? opt.id : defaultIds[index] || `option_${index + 1}`,
          text: opt.text ? opt.text.trim() : ''
        }));
        
        // Ensure we have at least 4 options
        while (formattedOptions.length < 4) {
          const index = formattedOptions.length;
          formattedOptions.push({
            id: defaultIds[index] || `option_${index + 1}`,
            text: ''
          });
        }
        
        // Validate correctOption
        let correctOption = q.correctOption && formattedOptions.some(opt => opt.id === q.correctOption) 
          ? q.correctOption 
          : formattedOptions[0].id;

        // Ensure the correct option has non-empty text
        const currentCorrectOptionText = formattedOptions.find(opt => opt.id === correctOption)?.text.trim();
        if (!currentCorrectOptionText) {
          const firstNonEmptyOption = formattedOptions.find(opt => opt.text.trim() !== '');
          if (firstNonEmptyOption) {
            correctOption = firstNonEmptyOption.id;
            console.warn(`AI-generated correct option had empty text. Reassigned to first non-empty option: ${correctOption}`);
          } else {
            console.warn(`All options for AI-generated question have empty text. Correct option remains: ${correctOption}`);
          }
        }
        
        return {
          id: `q_${Date.now()}_${Math.random().toString(36).substring(7)}`, // Generate a unique ID
          text: q.text.trim(),
          options: formattedOptions,
          correctOption: correctOption,
          timeLimit: 30, // Default value
          Marks: 4, // Default value
          imageUrl: undefined,
          imageFile: undefined,
          publicId: undefined,
          explanation: q.explanation ? q.explanation.trim() : null, // Ensure explanation is included
        };
      });

      setSuggestedQuestions(formattedQuestions);
      setSelectedSuggestedQuestions(new Set(formattedQuestions.map(q => q.id)));
      setShowSuggestionsModal(true);
    } catch (error) {
      console.error("Error generating AI questions:", error);
      toast({
        title: "Error",
        description: "Failed to generate questions from AI. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingAiQuestions(false);
    }
  };

  // Add this function to generate questions from content
  const handleAddSelectedQuestions = () => {
    const selectedQuestions = suggestedQuestions.filter(q => selectedSuggestedQuestions.has(q.id));
    setQuestions(prev => [...prev, ...selectedQuestions]);
    setShowSuggestionsModal(false);
    setSuggestedQuestions([]);
    setSelectedSuggestedQuestions(new Set());
    toast({
      title: "Questions Added",
      description: `Added ${selectedQuestions.length} selected questions to your quiz.`,
      variant: "default",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setQuizUpdateAction(quizId ? 'updating' : 'saving');

    if (!currentUser?.uid) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to create a quiz.",
        variant: "destructive"
      });
      setIsSubmitting(false);
      return;
    }

    if (!title || !subject || !grade || !description) {
      toast({
        title: "Missing Information",
        description: "Please fill out all quiz details",
        variant: "destructive"
      });
      setIsSubmitting(false);
      return;
    }

    const errors: string[] = [];

    // Validate class
    if (!grade || grade.trim() === "") {
      errors.push("Class is missing.");
    }

    // Validate description
    if (!description || description.trim() === "") {
      errors.push("Description is missing.");
    }

    // Validate questions — build per-question error map for inline display
    const newQuestionErrors: Record<number, string[]> = {};

    questions.forEach((q, idx) => {
      const qErrs: string[] = [];
      const missingOptions = q.options.filter(opt => !opt.text || opt.text.trim() === "");
      if (!q.text || q.text.trim() === "") {
        qErrs.push("Question text is missing.");
        errors.push(`Question ${idx + 1}: text is missing.`);
      }
      if (missingOptions.length > 0) {
        const missingLabels = missingOptions.map(opt => opt.id.toUpperCase()).join(", ");
        qErrs.push(`Options missing: ${missingLabels}`);
        errors.push(`Question ${idx + 1}: option(s) ${missingLabels} are empty.`);
      }
      if (!q.correctOption || !q.options.some(opt => opt.id === q.correctOption)) {
        qErrs.push("No valid correct option selected.");
        errors.push(`Question ${idx + 1}: no valid correct option selected.`);
      }
      if (qErrs.length > 0) {
        newQuestionErrors[idx] = qErrs;
      }
    });

    // If there are validation errors, show them inline and scroll to first bad question
    if (errors.length > 0) {
      setQuestionErrors(newQuestionErrors);
      const firstBadIdx = Object.keys(newQuestionErrors).map(Number).sort((a, b) => a - b)[0];
      if (firstBadIdx !== undefined) {
        // Scroll to the first question with an error
        setTimeout(() => {
          const el = document.getElementById(`question-card-${firstBadIdx}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 50);
      }
      toast({
        title: "Fix Incomplete Questions",
        description: `${Object.keys(newQuestionErrors).length} question(s) have issues. Check the highlighted sections and fix them before saving.`,
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    // Clear any previous question errors
    setQuestionErrors({});

    // Generate explanations for questions that don't have them
    // Only generate if AI explanation is enabled globally for this host
    let hostAiEnabled = true;
    try {
      if (currentUser?.uid) {
        const { ref: dbR, get: dbG } = await import('firebase/database');
        const profRef = dbR(database, `users/${currentUser.uid}/profile/aiExplanationEnabled`);
        const profSnap = await dbG(profRef);
        if (profSnap.exists()) hostAiEnabled = Boolean(profSnap.val());
      }
    } catch { /* ignore, default to true */ }

    if (hostAiEnabled) {
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        if (!question.explanation || question.explanation.trim() === '') {
          try {
            toast({
              title: "Generating Explanations",
              description: `Generating explanation for question ${i + 1}...`,
              variant: "default",
            });
            
            setQuizUpdateAction('generating');
            const explanation = await generateSingleExplanation(question.text);
            questions[i] = { ...question, explanation };
          } catch (error) {
            console.error(`Error generating explanation for question ${i + 1}:`, error);
            toast({
              title: "Note",
              description: `Explanation for question ${i + 1} will be generated later.`,
              variant: "default",
            });
          }
        }
      }
    }

    try {
      let newQuizId: string;
      let userQuizRef: any;
      let globalQuizRef: any;

      if (quizId) {
        // EDITING: keep the same quiz ID so shared links stay valid
        newQuizId = quizId;
        userQuizRef = dbRef(database, `users/${currentUser.uid}/quizzes/${newQuizId}`);
        globalQuizRef = dbRef(database, `quizzes/${newQuizId}`);
      } else {
        // NEW quiz: generate a fresh Firebase push key
        const userQuizzesRef = dbRef(database, `users/${currentUser.uid}/quizzes`);
        const newQuizRef = dbPush(userQuizzesRef);
        newQuizId = newQuizRef.key!;
        userQuizRef = dbRef(database, `users/${currentUser.uid}/quizzes/${newQuizId}`);
        globalQuizRef = dbRef(database, `quizzes/${newQuizId}`);
      }

      const newQuiz = {
        id: newQuizId,
        title,
        description,
        subject,
        grade,
        topic,
        folderId: selectedFolder === "none" ? null : selectedFolder,
        questions: questions.map(q => ({
          id: q.id,
          text: q.text,
          imageUrl: q.imageUrl || null,
          publicId: q.publicId || null,
          options: q.options,
          correctOption: q.correctOption,
          timeLimit: q.timeLimit,
          Marks: q.Marks,
          explanation: q.explanation || null,
        })),
        createdBy: currentUser.uid,
        createdAt: new Date().toISOString(),
        totalQuestions: questions.length,
        totalMarks: questions.reduce((sum, question) => sum + question.Marks, 0),
        hasNegativeMarking: hasNegativeMarking,
        negativeMarkingValue: hasNegativeMarking ? negativeMarkingValue : 0
      };

      // Save quiz (overwrite if editing, create if new)
      // When editing, newQuizId === quizId, so we just overwrite in place.
      // No deletion needed — deleting would break shared links.
      await dbSet(userQuizRef, newQuiz);
      await dbSet(globalQuizRef, newQuiz);

      toast({
        title: "Success",
        description: "Quiz saved successfully!",
        variant: "default"
      });

      onClose();
    } catch (error) {
      console.error("Error saving quiz:", error);
      toast({
        title: "Success",
        description: "Quiz saved successfully!",
        variant: "default"
      });
      navigate("/host-dashboard");
    } finally {
      setIsSubmitting(false);
    }
  };

  const containerClass = "flex justify-center items-start bg-transparent py-4";
  const cardClass = isEdit
    ? "bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-4xl"
    : "bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto";

  function handleSuggestOptions(qIndex: number): void {
    throw new Error("Function not implemented.");
  }

  return (
    <div className={containerClass}>

    <Card className={cardClass}>
      {/* Image Crop Dialog */}
      <Dialog open={currentCropIndex !== null} onOpenChange={(open) => {
        if (!open) {
          setCurrentCropIndex(null);
          setImageSrc(null);
        }
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogTitle>Crop Image</DialogTitle>
          {imageSrc && (
            <div className="relative h-96 w-full overflow-hidden rounded-lg bg-gray-900">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={16 / 9}
                cropShape="rect"
                showGrid={true}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
          )}
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Zoom</label>
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.1}
                onValueChange={(value) => setZoom(value[0])}
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => {
              setCurrentCropIndex(null);
              setImageSrc(null);
            }}>Cancel</Button>
            <Button onClick={handleCropComplete}>Crop & Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder Creation Dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Create New Folder</DialogTitle>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="folderName" className="text-right text-sm font-medium col-span-1">
                Name
              </label>
              <Input
                id="folderName"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="col-span-3"
                placeholder="Enter folder name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="folderColor" className="text-right text-sm font-medium col-span-1">
                Color
              </label>
              <Input
                id="folderColor"
                type="color"
                value={newFolderColor}
                onChange={(e) => setNewFolderColor(e.target.value)}
                className="col-span-3 h-10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateFolder}>
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold dark:text-white bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
              {isEdit ? "Edit Quiz" : "Create New Quiz"}
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium dark:text-gray-200 mb-1">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Quiz Title"
                className="dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium dark:text-gray-200 mb-1">Folder</label>
              <div className="flex gap-2">
                <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                  <SelectTrigger className="w-full dark:bg-gray-700 dark:border-gray-600">
                    <SelectValue placeholder="Select Folder" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                    <SelectItem value="none">None</SelectItem>
                    {folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: folder.color }}></div>
                          {folder.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setFolderDialogOpen(true)}
                  className="dark:bg-gray-700 dark:border-gray-600"
                >
                  <FolderPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button type="button" onClick={() => setShowSymbolPicker(!showSymbolPicker)} className="ml-2">
              <Smile className="h-4 w-4" />
            </Button>
            <div>
              <label className="block text-sm font-medium dark:text-gray-200 mb-1">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Quiz Description" 
                className="dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium dark:text-gray-200 mb-1">Subject</label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="w-full dark:bg-gray-700 dark:border-gray-600">
                  <SelectValue placeholder="Select Subject" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                  {scienceSubjects.map((sub) => (
                    <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium dark:text-gray-200 mb-1">
                Topic
              </label>
              <div className="relative">
                <Input
                  placeholder="e.g., 'Thermodynamics', 'Genetics'"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="dark:bg-gray-700 dark:border-gray-600 pr-10"
                />
                {loadingAiQuestions && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              {suggestedQuestions.length > 0 && !showSuggestionsModal && (
                <Button
                  type="button"
                  onClick={() => setShowSuggestionsModal(true)}
                  className="mt-2 w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white transition-all duration-300 transform hover:scale-[1.02]"
                >
                  View {suggestedQuestions.length} Suggested Questions ✨
                </Button>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium dark:text-gray-200 mb-1">Grade Level</label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger className="w-full dark:bg-gray-700 dark:border-gray-600">
                  <SelectValue placeholder="Select Grade" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-700 dark:border-gray-600">
                  {['11th', '12th'].map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex space-x-2">
              <div className="flex-grow">
                <label className="block text-sm font-medium dark:text-gray-200 mb-1">Negative Marking</label>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={hasNegativeMarking}
                    onCheckedChange={setHasNegativeMarking}
                    className="dark:bg-gray-700"
                  />
                  <span className="text-sm dark:text-gray-200">{hasNegativeMarking ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
              {hasNegativeMarking && (
                <div className="flex-grow">
                  <label className="block text-sm font-medium dark:text-gray-200 mb-1">Negative Marks (%)</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={negativeMarkingValue}
                    onChange={e => setNegativeMarkingValue(Number(e.target.value))}
                    className="w-full dark:bg-gray-700 dark:border-gray-600"
                    placeholder="Value %"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleAddQuestion}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl"
        >
          <Plus className="h-5 w-5 mr-2" /> Add New Question
        </Button>

        <div className="space-y-4">
          {questions.map((question, qIndex) => (
            <div
              key={question.id}
              id={`question-card-${qIndex}`}
              className={`space-y-4 p-6 border rounded-2xl dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${
                questionErrors[qIndex] ? "border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20" : ""
              }`}
            >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium dark:text-white">
                Question {qIndex + 1}
                {questionErrors[qIndex] && (
                  <span className="ml-2 text-sm text-red-600 dark:text-red-400 font-normal">
                    ⚠ {questionErrors[qIndex].join(" · ")}
                  </span>
                )}
              </h3>
              <div className="flex space-x-2">
                {questions.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleRemoveQuestion(qIndex)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleAddQuestion()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Textarea
                  id={`question_${question.id}`}
                  value={question.text}
                  onChange={(e) => handleQuestionChange(qIndex, 'text', e.target.value)}
                  onFocus={handleInputFocus}
                  placeholder="Enter question text"
                  rows={1}
                  className="flex-1 dark:bg-gray-700 dark:border-gray-600"
                />

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Smile className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <SymbolPicker onSelect={handleSymbolSelect} />
                  </DialogContent>
                </Dialog>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  // Guard: only call if AI is enabled for this host
                  if (currentUser?.uid) {
                    const { ref: dbR, get: dbG } = await import('firebase/database');
                    const snap = await dbG(dbR(database, `users/${currentUser.uid}/profile/aiExplanationEnabled`)).catch(() => null);
                    if (snap?.exists() && snap.val() === false) {
                      toast({ title: 'AI is disabled', description: 'Enable AI Explanation from your Dashboard to use this feature.', variant: 'destructive' });
                      return;
                    }
                  }
                  handleSuggestOptions(qIndex);
                }}
                disabled={suggestingForIndex === qIndex}
                className="mt-1 text-xs text-purple-400 border-purple-400 hover:bg-purple-900/20"
              >
                {suggestingForIndex === qIndex ? (
                  <span className="flex items-center gap-1"><span className="animate-spin inline-block">⟳</span> Suggesting...</span>
                ) : (
                  "✨ AI Suggest Options"
                )}
              </Button>

              <div className="flex items-center space-x-2">
                <label htmlFor={`image-upload-${question.id}`} className="block text-sm font-medium dark:text-gray-200">Image (Optional)</label>
                <Input
                  id={`image-upload-${question.id}`}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(qIndex, e)}
                  className="flex-1 dark:bg-gray-700 dark:border-gray-600"
                />
                {question.imageUrl && (

                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleQuestionChange(qIndex, 'imageUrl', undefined)}
                  >
                    Remove Image
                  </Button>
                )}
              </div>

              {question.imageUrl && (
                <div className="mt-2">
                  <img src={question.imageUrl} alt="Question Preview" width={384} height={144} loading="lazy" decoding="async" className="w-48 h-36 object-cover rounded-lg" />
                </div>
              )}

              <div className="space-y-2">
                {question.options.map((option) => {
                  // Ensure option.id is a valid string
                  const optionId = option.id && typeof option.id === 'string' ? option.id : '';
                  const displayId = optionId.toUpperCase();
                  
                  return (
                    <div key={optionId || Math.random().toString(36).substring(7)} className="flex items-center space-x-2">
                      <span className="w-8 text-center">{displayId}</span>
                      <Textarea
                        id={`option_${question.id}_${optionId}`}
                        value={convertToUnicodeMath(option.text || '')}
                        onChange={(e) => handleOptionChange(qIndex, optionId, e.target.value)}
                        onFocus={handleInputFocus}
                        placeholder={`Option ${displayId}`}
                        rows={1}
                        className="flex-1 dark:bg-gray-700 dark:border-gray-600"
                      />

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="icon">
                            <Smile className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <SymbolPicker onSelect={insertTextAtCursor} />
                        </DialogContent>
                      </Dialog>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium dark:text-gray-200 mb-1">Correct Option</label>
                  <Select
                    value={question.correctOption}
                    onValueChange={(value) => handleQuestionChange(qIndex, 'correctOption', value)}
                  >
                    <SelectTrigger className="w-full dark:bg-gray-700 dark:border-gray-600">
                      <SelectValue placeholder="Select correct option" />
                    </SelectTrigger>
                    <SelectContent>
                      {question.options.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          Option {option.id.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium dark:text-gray-200 mb-1">Time Limit (seconds)</label>
                  <Input
                    type="number"
                    value={question.timeLimit}
                    onChange={(e) => handleQuestionChange(qIndex, 'timeLimit', parseInt(e.target.value))}
                    className="dark:bg-gray-700 dark:border-gray-600"
                    min="10"
                    max="300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium dark:text-gray-200 mb-1">Points</label>
                  <Input
                    type="number"
                    value={question.Marks}
                    onChange={(e) => handleQuestionChange(qIndex, 'Marks', parseInt(e.target.value))}
                    className="dark:bg-gray-700 dark:border-gray-600"
                    min="1"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
        </div>
        {showSymbolPicker && (
          <Dialog open={showSymbolPicker} onOpenChange={setShowSymbolPicker}>
            <DialogContent className="sm:max-w-[600px]">
              <SymbolPicker onSelect={handleSymbolSelect} />
            </DialogContent>
          </Dialog>
        )}
        {showSuggestionsModal && (
          <Dialog open={showSuggestionsModal} onOpenChange={setShowSuggestionsModal}>
            <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
              <DialogTitle className="text-xl font-bold">
                Select Questions to Add ({selectedSuggestedQuestions.size} selected)
              </DialogTitle>
              <div className="space-y-3 mt-4">
                {suggestedQuestions.map((question, idx) => (
                  <div
                    key={question.id}
                    className={`p-4 border rounded-lg flex items-start gap-3 cursor-pointer transition-all ${
                      selectedSuggestedQuestions.has(question.id)
                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500"
                        : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    }`}
                    onClick={() => {
                      const newSelected = new Set(selectedSuggestedQuestions);
                      if (newSelected.has(question.id)) {
                        newSelected.delete(question.id);
                      } else {
                        newSelected.add(question.id);
                      }
                      setSelectedSuggestedQuestions(newSelected);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSuggestedQuestions.has(question.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedSuggestedQuestions);
                        if (e.target.checked) {
                          newSelected.add(question.id);
                        } else {
                          newSelected.delete(question.id);
                        }
                        setSelectedSuggestedQuestions(newSelected);
                      }}
                      className="mt-1 w-5 h-5"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-lg dark:text-white">
                        {idx + 1}. {question.text}
                      </p>
                      <div className="mt-2 space-y-1 text-sm dark:text-gray-300">
                        {question.options.map((option) => (
                          <p
                            key={option.id}
                            className={
                              option.id === question.correctOption
                                ? "text-green-600 dark:text-green-400 font-medium"
                                : ""
                            }
                          >
                            {option.id.toUpperCase()}. {option.text}
                            {option.id === question.correctOption && " ✓"}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <DialogFooter className="flex justify-between items-center mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const allIds = suggestedQuestions.map(q => q.id);
                    setSelectedSuggestedQuestions(new Set(allIds));
                  }}
                >
                  Select All
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowSuggestionsModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleAddSelectedQuestions}
                    disabled={selectedSuggestedQuestions.size === 0}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Add Selected ({selectedSuggestedQuestions.size})
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        <div className="flex justify-end space-x-3 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (isEdit) {
                navigate("/host-dashboard");
              } else {
                onClose();
              }
            }}
            className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
          >
            Cancel
          </Button>
          
          <Button 
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            disabled={isSubmitting}
          >
            {isSubmitting ? (isEdit ? "Updating..." : "Creating...") : (isEdit ? "Update Quiz" : "Create Quiz")}
          </Button>
        </div>
      </form>
    </Card>
  </div>
  );
};

export default CreateQuizForm;
