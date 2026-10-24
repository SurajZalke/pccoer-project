import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { callAIAPIWithHistory } from '@/services/aiProviderManager';
import type { ChatMessage } from '@/services/aiProviderManager';

// ─────────────────────────────────────────────────────────────────────────────
// SK AI Context — provides AI analysis & chat functionality powered by
// GROQ (llama-3.3-70b-versatile) with Gemini (gemini-2.5-flash) fallback.
// ─────────────────────────────────────────────────────────────────────────────

interface AIAnalysisContextType {
  isAnalyzing: boolean;
  analysisResult: string | null;
  error: string | null;
  analyzeCurrentPage: () => Promise<void>;
  toggleAnalysisVisibility: () => void;
  isAnalysisVisible: boolean;
  askAIQuestion: (question: string) => Promise<string>;
  isProcessingQuestion: boolean;
  aiName: string;
  clearHistory: () => void;
}

const AIAnalysisContext = createContext<AIAnalysisContextType | undefined>(undefined);

// ── SK AI identity ────────────────────────────────────────────────────────────
const AI_NAME = 'SK AI';

const SYSTEM_PROMPT = `You are SK AI, the official intelligent study assistant for PCCOER Education Platform — an interactive online learning platform focused on Chemistry, Physics, and Science education for students.

Your personality:
- Friendly, encouraging, and slightly witty — like a smart senior student
- Concise: keep answers under 120 words unless a detailed explanation is clearly needed
- Use simple language; avoid jargon unless explaining a concept
- Add a relevant emoji occasionally to keep it engaging

Your capabilities:
- Answer Chemistry, Physics, Biology, and Math questions (class 8–12 level)
- Explain quiz results and learning strategies
- Help students understand how to use this platform (joining quizzes, leaderboard, videos)
- Analyze pages the student is currently viewing

Hard rules:
- If asked who created you: answer "I was built by Mr. Suraj Zalke for Dhole Sir's Coaching Classes 🎓"
- If asked who is your creator or inventor: answer "Mr. Suraj Zalke"
- Never pretend to be a human
- Never produce harmful, off-topic, or inappropriate content
- End every response signing off as "— SK AI ✨" only when the response is a self-contained answer (not in mid-conversation)`;

// ─────────────────────────────────────────────────────────────────────────────

export const AIAnalysisProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAnalyzing, setIsAnalyzing]           = useState(false);
  const [analysisResult, setAnalysisResult]     = useState<string | null>(null);
  const [error, setError]                       = useState<string | null>(null);
  const [isAnalysisVisible, setIsAnalysisVisible] = useState(false);
  const [isProcessingQuestion, setIsProcessingQuestion] = useState(false);
  const [aiName] = useState(AI_NAME);

  // Conversation history — persists across questions within a session
  const historyRef = useRef<ChatMessage[]>([]);

  const location = useLocation();

  // Reset analysis (but NOT conversation history) on route change
  useEffect(() => {
    setAnalysisResult(null);
    setError(null);
  }, [location.pathname]);

  // ── Analyze current page ──────────────────────────────────────────────────
  const analyzeCurrentPage = async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const currentPath = location.pathname;
      const pageName =
        currentPath === '/'
          ? 'Home Page'
          : currentPath.charAt(1).toUpperCase() + currentPath.slice(2).replace(/-/g, ' ');

      const messages: ChatMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Analyze the current page the student is on: "${pageName}". 
Give a brief, friendly summary (under 80 words) of what this page does and the top 2–3 actions they can take here. 
Do NOT sign off with "— SK AI" for this one.`,
        },
      ];

      const response = await callAIAPIWithHistory(messages, 'auto');
      const analysis = response.text.trim();

      if (!analysis) throw new Error('Empty analysis received');

      console.log(`✓ SK AI page analysis via ${response.provider}`);
      setAnalysisResult(analysis);
    } catch (err: any) {
      setError('SK AI could not analyze this page. Please try again.');
      console.error('SK AI analysis error:', err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Toggle visibility ─────────────────────────────────────────────────────
  const toggleAnalysisVisibility = () => setIsAnalysisVisible(prev => !prev);

  // ── Ask a question (with conversation memory) ─────────────────────────────
  const askAIQuestion = async (question: string): Promise<string> => {
    const trimmed = question.trim();
    if (!trimmed) return 'Please type a question first.';

    // Hard-coded identity answers (fast, no API call)
    const lc = trimmed.toLowerCase();
    if (
      lc.includes('who is inventor') ||
      lc.includes('who is creator') ||
      lc.includes('who made you') ||
      lc.includes('who built you') ||
      lc.includes('who created you') ||
      lc.includes('birth of you')
    ) {
      return 'I was built by Mr. Suraj Zalke for Dhole Sir\'s Coaching Classes 🎓 — SK AI ✨';
    }
    if (lc === 'who are you' || lc === 'what are you') {
      return `I'm SK AI — your intelligent study companion for Dhole Sir's Coaching Classes. Ask me anything about Chemistry, Physics, quizzes, or this platform! ✨`;
    }

    setIsProcessingQuestion(true);

    try {
      // Build full message thread: system + history + new user message
      const messages: ChatMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...historyRef.current.slice(-10), // keep last 10 turns (5 exchanges) for context
        { role: 'user', content: trimmed },
      ];

      const response = await callAIAPIWithHistory(messages, 'auto');
      const answer = response.text.trim();

      if (!answer) throw new Error('Empty answer from AI');

      console.log(`✓ SK AI answered via ${response.provider}`);

      // Store this exchange in history
      historyRef.current = [
        ...historyRef.current,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: answer },
      ];

      return answer;
    } catch (err: any) {
      console.error('SK AI question error:', err.message);
      return "Sorry, I ran into a problem answering that. Please try again in a moment. — SK AI ✨";
    } finally {
      setIsProcessingQuestion(false);
    }
  };

  // ── Clear conversation history ────────────────────────────────────────────
  const clearHistory = () => {
    historyRef.current = [];
  };

  return (
    <AIAnalysisContext.Provider
      value={{
        isAnalyzing,
        analysisResult,
        error,
        analyzeCurrentPage,
        toggleAnalysisVisibility,
        isAnalysisVisible,
        askAIQuestion,
        isProcessingQuestion,
        aiName,
        clearHistory,
      }}
    >
      {children}
    </AIAnalysisContext.Provider>
  );
};

export const useAIAnalysis = () => {
  const context = useContext(AIAnalysisContext);
  if (context === undefined) {
    throw new Error('useAIAnalysis must be used within an AIAnalysisProvider');
  }
  return context;
};
