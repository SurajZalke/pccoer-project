/** @jsxImportSource react */
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { generateSingleExplanation } from '@/services/aiExplanationService';
import * as pdfjs from 'pdfjs-dist';
import { GlobalWorkerOptions } from 'pdfjs-dist';
import { TextItem } from 'pdfjs-dist/types/src/display/api';
import { callAIAPI, getAPIStats } from '@/services/aiProviderManager';

// PDF.js worker setup — use new URL() so Vite bundles the worker locally
// and serves it from the same origin (avoids unpkg.com CORS blocks).
if (!pdfjs.GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

// ------------------- Types -------------------
interface Question {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  correctOption: string;
  timeLimit: number;
  Marks: number;
}

interface FileUploadComponentProps {
  onQuestionsExtracted: (questions: Question[]) => void;
}

// ------------------- AI Correct Answer Determination -------------------
const fetchCorrectOptionsFromAI = async (questions: Question[], setIsGeneratingAnswers: React.Dispatch<React.SetStateAction<boolean>>): Promise<Question[]> => {
    console.log('fetchCorrectOptionsFromAI entered');
    const questionsMissingAnswer = questions.filter(q => !q.correctOption || q.correctOption.trim() === '');
    console.log('Questions missing answers:', questionsMissingAnswer.length);
    if (questionsMissingAnswer.length === 0) return questions;

  const prompt = `For the following multiple choice questions, determine the correct answer.
Provide JSON output with keys as question IDs and values as correct option IDs.

Questions:
${questionsMissingAnswer.map(q => `ID: ${q.id}\nQuestion: ${q.text}\nOptions: ${q.options.map(o => `${o.id}: ${o.text}`).join(', ')}`).join('\n\n')}

Return only JSON like:
{
  "q_1": "a",
  "q_2": "c"
}`;

  const MAX_RETRIES = 3;
  let aiResponse = '';
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await callAIAPI(prompt, 'auto');
      aiResponse = response.text.trim();
      
      // Extract JSON from response
      let jsonString = aiResponse;
      const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch && jsonMatch[1]) jsonString = jsonMatch[1];
      else {
        const firstBrace = jsonString.indexOf('{');
        const lastBrace = jsonString.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace)
          jsonString = jsonString.substring(firstBrace, lastBrace + 1);
      }

      const correctOptions = JSON.parse(jsonString) as Record<string, string>;
      questionsMissingAnswer.forEach(q => { if (correctOptions[q.id]) q.correctOption = correctOptions[q.id]; });
      
      console.log(`✓ AI answers generated using ${response.provider}`);
      break;
    } catch (err: any) {
      console.error(`Attempt ${attempt + 1} failed:`, err.message);
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }

  return questions;
};

// ------------------- Helper -------------------
export const getCorrectOption = (question: Question): { id: string; text: string } | null => {
  if (!question.correctOption || !question.options || question.options.length === 0) return null;
  return question.options.find(opt => opt.id === question.correctOption) || null;
};

// ------------------- Component -------------------
const FileUploadComponent = ({ onQuestionsExtracted }: FileUploadComponentProps): JSX.Element => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingAnswers, setIsGeneratingAnswers] = useState(false); // New state for AI answer generation
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  // ------------------- AI Question Extraction -------------------
const extractQuestionsFromAI = async (text: string): Promise<Question[]> => {
  if (!text || text.trim().length < 20) {
    throw new Error('Extracted text is too short or empty. Make sure the file has readable content.');
  }

  const prompt = `You are a quiz question extractor. Extract ALL multiple-choice questions from the text below and return them as a JSON array.

RULES:
- Each question MUST have exactly 4 options with ids "a", "b", "c", "d"
- Set correctOption to the id of the correct answer
- If correct answer is not shown, use your knowledge to determine it
- timeLimit = 30, Marks = 4 for all questions
- Return ONLY the JSON array, no explanation, no markdown

JSON FORMAT:
[
  {
    "id": "q_1",
    "text": "Question text here",
    "options": [
      { "id": "a", "text": "Option A" },
      { "id": "b", "text": "Option B" },
      { "id": "c", "text": "Option C" },
      { "id": "d", "text": "Option D" }
    ],
    "correctOption": "b",
    "timeLimit": 30,
    "Marks": 4
  }
]

TEXT TO PROCESS:
${text.substring(0, 8000)}`;

  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await callAIAPI(prompt, 'auto');
      let aiResponse = response.text.trim();

      // Strip markdown code fences if present
      const fenceMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fenceMatch) aiResponse = fenceMatch[1];

      // Extract JSON array
      const firstBracket = aiResponse.indexOf('[');
      const lastBracket = aiResponse.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket > firstBracket) {
        aiResponse = aiResponse.substring(firstBracket, lastBracket + 1);
      }

      const parsedQuestions = JSON.parse(aiResponse) as Question[];
      if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
        throw new Error('AI returned empty question array');
      }

      console.log(`✓ ${parsedQuestions.length} questions extracted using ${response.provider}`);

      return parsedQuestions.map((q, index) => ({
        ...q,
        id: `q_${Date.now()}_${index + 1}`,
        timeLimit: q.timeLimit || 30,
        Marks: q.Marks || 4,
        options: (q.options || []).map((opt, optIndex) => ({
          id: opt.id || String.fromCharCode(97 + optIndex),
          text: opt.text || ''
        }))
      }));
    } catch (err: any) {
      console.error(`Extraction attempt ${attempt + 1} failed:`, err.message);
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 2000));
      } else {
        throw new Error(`AI could not extract questions after ${MAX_RETRIES} attempts: ${err.message}`);
      }
    }
  }
  throw new Error('All AI extraction attempts failed.');
};

  // ------------------- Extract Questions -------------------
  const extractQuestionsFromText = (text: string): Question[] => {
    const questions: Question[] = [];
    const cleanedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = cleanedText.split('\n').map(l => l.trim()).filter(Boolean);

    let i = 0, questionId = 1;
    while (i < lines.length) {
      // Updated regex to be more flexible with question numbering and phrasing
      const qMatch = lines[i].match(/^(?:\d+\.|Q(?:uestion)?\s*\d+\.?|\*\s*|\-\s*)(.+)$/i);
      if (qMatch) {
        let qText = qMatch[1].trim(); // Capture the question text more accurately
        let options: { id: string; text: string }[] = [];
        let correctOption: string | null = null;
        let optionLines: string[] = [];
        let j = i + 1;

        while (j < lines.length &&
               !lines[j].match(/^(?:\d+\.|Q(?:uestion)?\s*\d+\.?|\*\s*|\-\s*)(.+)$/i) &&
               !/^((correct )?answer[:\s])/i.test(lines[j])) {
          optionLines.push(lines[j]);
          j++;
        }

        let answerLine = '';
        // Look for answer line immediately after options or within the next few lines
        for (let k = j; k < Math.min(j + 3, lines.length); k++) {
          if (/^((correct )?answer[:\s])/i.test(lines[k])) { answerLine = lines[k]; break; }
        }

        optionLines = optionLines.filter(Boolean);
        options = optionLines.map((opt, idx) => {
          // Updated regex for option matching to handle more variations (e.g., A., A), and different delimiters
          const optMatch = opt.match(/^([A-Da-d]|\d{1})[\.\)]?\s*(.+)$/);
          if (optMatch) {
            let id = optMatch[1].toLowerCase();
            // Convert numeric options (1, 2, 3, 4) to 'a', 'b', 'c', 'd'
            if (/[1-4]/.test(id)) id = String.fromCharCode(96 + parseInt(id));
            return { id, text: optMatch[2].trim() };
          }
          // Fallback for options without explicit labels, assign 'a', 'b', 'c', ...
          return { id: String.fromCharCode(97 + idx), text: opt.trim() };
        });

        if (answerLine) {
          const ansText = answerLine.split(':').slice(1).join(':').trim().replace(/^\-/, '').trim();
          let ansId = ansText.toLowerCase();
          // Convert numeric answer (1, 2, 3, 4) to 'a', 'b', 'c', 'd'
          if (/[1-4]/.test(ansId)) ansId = String.fromCharCode(96 + parseInt(ansId));

          // Find correct option by ID or by matching text (case-insensitive, punctuation-agnostic)
          let foundOption = options.find(opt => opt.id === ansId);
          if (!foundOption) {
            foundOption = options.find(opt =>
              opt.text.replace(/[^\w\s]/gi, '').toLowerCase() === ansText.replace(/[^\w\s]/gi, '').toLowerCase()
            );
          }
          if (foundOption) correctOption = foundOption.id;
        }

        if (options.length >= 2) {
          questions.push({
            id: `q_${Date.now()}_${questionId++}`,
            text: qText,
            options,
            correctOption: correctOption || '',
            timeLimit: 30,
            Marks: 4
          });
        }

        i = j + (answerLine ? 1 : 0);
      } else i++;
    }
    return questions;
  };

  // ------------------- Process Image (OCR via Gemini Vision) -------------------
  const processImageFile = async (file: File): Promise<string> => {
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
      'Extract all text from this image exactly as written. Preserve question numbers, option labels (A, B, C, D), and answer indicators.'
    ]);
    return result.response.text();
  };

  // ------------------- Process DOCX -------------------
  // DOCX files are read as plain text — sufficient for extracting question content.
  // For richer DOCX parsing, install the 'mammoth' package separately.
  const processDocxFile = async (file: File): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => reject(new Error('Failed to read DOCX file'));
      reader.readAsText(file);
    });
  };

  // ------------------- Process PDF -------------------
  const processPdfFile = async (file: File): Promise<string> => {
    const fileReader = new FileReader();
    return new Promise((resolve, reject) => {
      fileReader.onload = async (event) => {
        try {
          if (!event.target?.result) { reject(new Error('Failed to read file')); return; }
          const typedArray = new Uint8Array(event.target.result as ArrayBuffer);
          const loadingTask = pdfjs.getDocument({ 
            data: typedArray,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + pdfjs.version + '/cmaps/',
            cMapPacked: true 
          });
          const pdf = await Promise.race([loadingTask.promise, new Promise((_, rej) => setTimeout(() => rej(new Error('PDF loading timed out')), 30000))]) as any;
          let extractedText = '';

          for (let i = 1; i <= pdf.numPages; i++) {
            setProgress(Math.floor((i / pdf.numPages) * 100));
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const textItems = textContent.items as TextItem[];
            let lastY = -1, lastX = -1, pageText = '';
            const sortedItems = [...textItems].sort((a, b) => Math.abs(a.transform[5] - b.transform[5]) > 5 ? b.transform[5] - a.transform[5] : a.transform[4] - b.transform[4]);
            for (const item of sortedItems) {
              if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) { pageText += '\n'; lastX = -1; }
              else if (lastX !== -1) { const xGap = item.transform[4] - lastX - (lastX > 0 ? 5 : 0); if (xGap > 10) pageText += ' '.repeat(Math.min(Math.floor(xGap / 5), 10)); else if (pageText.length > 0 && pageText[pageText.length - 1] !== '\n') pageText += ' '; }
              pageText += item.str; lastY = item.transform[5]; lastX = item.transform[4] + (item.width || 0);
            }
            extractedText += pageText + '\n\n';
          }
          resolve(extractedText);
        } catch (error) { reject(new Error(`Failed to process PDF: ${error instanceof Error ? error.message : String(error)}`)); }
      };
      fileReader.onerror = () => reject(new Error('Failed to read file'));
      fileReader.readAsArrayBuffer(file);
    });
  };

  const processTextFile = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => e.target?.result ? resolve(e.target.result as string) : reject(new Error('Failed to read text file'));
    reader.onerror = () => reject(new Error('Failed to read text file'));
    reader.readAsText(file);
  });

  // ------------------- Handle Upload -------------------
  const handleUpload = async (): Promise<void> => {
    if (!file) { setError('Please select a file to upload'); return; }
    setIsProcessing(true); setProgress(0); setError(null);

    try {
      let extractedText = '';
      const fileType = file.type.toLowerCase();
      const fileName = file.name.toLowerCase();
      if (fileType === 'application/pdf') extractedText = await processPdfFile(file);
      else if (fileType === 'text/plain' || fileType === 'application/txt') extractedText = await processTextFile(file);
      else if (fileType === 'image/png' || fileType === 'image/jpeg' || fileType === 'image/jpg') extractedText = await processImageFile(file);
      else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileType === 'application/msword' || fileName.endsWith('.docx') || fileName.endsWith('.doc')) extractedText = await processDocxFile(file);
      else throw new Error('Unsupported file type. Upload PDF, TXT, PNG, JPG, or DOCX.');

      // Use AI for question extraction
      let extractedQuestions = await extractQuestionsFromAI(extractedText);

      if (extractedQuestions.length === 0) throw new Error('No questions extracted by AI.');

      const questionsMissingAnswer = extractedQuestions.filter(q => !q.correctOption || q.correctOption.trim() === '');

      setIsProcessing(false); // File processing complete

      if (questionsMissingAnswer.length > 0) {
        console.log('Setting isGeneratingAnswers to true');
        setIsGeneratingAnswers(true); // Set state to true when AI generation starts
      }

      // ------------------- Fill missing correct options with AI -------------------
      extractedQuestions = await fetchCorrectOptionsFromAI(extractedQuestions, setIsGeneratingAnswers);

      onQuestionsExtracted(extractedQuestions);

      toast({ title: "Success", description: `${extractedQuestions.length} questions extracted successfully.`, variant: "default", duration: 6000 });

    } catch (err) {
      console.error('Error processing file:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      toast({ title: "Error", description: err instanceof Error ? err.message : 'Failed to process file', variant: "destructive" });
    } finally { console.log('Finally block: Resetting states'); setIsProcessing(false); setProgress(0); setIsGeneratingAnswers(false); }
  };

  // ------------------- JSX -------------------
  return (
    <Card className="p-4 mb-6">
      <h2 className="text-xl font-bold mb-4">Upload Questions File</h2>
      <p className="text-sm text-gray-500 mb-4">
        Upload a PDF, text, image (PNG/JPG), or Word document (DOCX) containing questions and answers. The system will extract questions, options, and correct answers automatically.
      </p>

      {isProcessing ? (
        <Card className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-blue-500 rounded-lg text-blue-400 h-48 bg-blue-900/20 animate-pulse-slow">
          <div className="relative mb-4">
            <FileText className="w-16 h-16" />
            <span className="absolute top-0 right-0 block h-4 w-4 rounded-full ring-2 ring-blue-900 bg-blue-400 animate-ping"></span>
            <span className="absolute top-0 right-0 block h-4 w-4 rounded-full ring-2 ring-blue-900 bg-blue-400"></span>
          </div>
          <p className="text-lg font-semibold text-blue-300">Processing your file...</p>
          <p className="text-sm text-center text-blue-200">Please wait while we extract questions and determine answers.</p>
        </Card>
      ) : isGeneratingAnswers ? (
        <Card className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-green-500 rounded-lg text-green-400 h-48 bg-green-900/20 animate-pulse-slow">
          <div className="relative mb-4">
            <svg className="animate-spin h-16 w-16 text-green-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-lg font-semibold text-green-300">AI is generating answers...</p>
          <p className="text-sm text-center text-green-200">This might take a moment. Please Check after generation AI can make mistake....</p>

        </Card>
      ) : (
        <div className="flex items-center gap-4 mb-4">
          <Input type="file" accept=".pdf,.txt,.png,.jpg,.jpeg,.docx,.doc" onChange={handleFileChange} disabled={isProcessing} className="flex-1"/>
          <Button onClick={handleUpload} disabled={!file || isProcessing} className="flex items-center gap-2">
            Extract Questions <Upload size={16}/>
          </Button>
        </div>
      )}

      {isProcessing && (
        <div className="mb-4">
          <p className="text-sm mb-2">Processing file... {progress}%</p>
          <Progress value={progress} className="h-2"/>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="text-sm text-gray-500">
        <p className="flex items-center gap-2 mb-1"><FileText size={16}/> Supported file types: PDF, TXT, PNG, JPG, DOCX</p>
        <div className="text-xs bg-gray-800 p-2 rounded-md mt-2">
          <p>For best results, ensure questions follow a consistent format with labeled options (A, B, C, D) and answers.</p>
          <p><strong>Image files (PNG/JPG):</strong> Text will be extracted via AI vision (Gemini). Ensure the image is clear and legible.</p>
          <p><strong>Example:</strong><br />
          1. What is AI?<br />
          A. Machine Learning<br />
          B. Deep Learning<br />
          C. Neural Networks<br />
          D. Robotics<br />
          Answer: A</p>
        </div>
      </div>
    </Card>
  );
};

export default FileUploadComponent;
