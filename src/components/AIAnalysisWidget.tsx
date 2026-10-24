import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAIAnalysis } from '@/contexts/AIAnalysisContext';
import { Button } from '@/components/ui/button';
import {
  X, Loader2, Send, Sparkles, Zap, ChevronDown,
  MessageCircle, Bot, RotateCcw, Minimize2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// SK AI Chat Widget
// Floating, draggable, animated chat panel with SK AI branding.
// ─────────────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

const WELCOME_MESSAGE: Message = {
  role: 'ai',
  text: "Hi! I'm SK AI, your intelligent study companion. I can analyze this page, answer Chemistry & Physics questions, or help with your quizzes. What would you like to know? ✨",
  timestamp: new Date(),
};

const AIAnalysisWidget: React.FC = () => {
  const {
    isAnalyzing, analysisResult, error,
    analyzeCurrentPage, isAnalysisVisible,
    toggleAnalysisVisibility, askAIQuestion,
    isProcessingQuestion, aiName, clearHistory,
  } = useAIAnalysis();

  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMinimised, setIsMinimised] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'analysis'>('chat');

  const widgetRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── auto-scroll ─────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessingQuestion]);

  // ── push analysis result as AI message when it arrives ──────────────────
  useEffect(() => {
    if (analysisResult) {
      setMessages(prev => {
        // avoid duplicating if already the last AI message
        const last = prev[prev.length - 1];
        if (last?.role === 'ai' && last.text === analysisResult) return prev;
        return [...prev, { role: 'ai', text: analysisResult, timestamp: new Date() }];
      });
    }
  }, [analysisResult]);

  // ── drag ────────────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    if (widgetRef.current) {
      setIsDragging(true);
      const rect = widgetRef.current.getBoundingClientRect();
      setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
    };
    const onUp = () => setIsDragging(false);
    if (isDragging) {
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isDragging, dragOffset]);

  // ── send message ────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isProcessingQuestion) return;

    setMessages(prev => [...prev, { role: 'user', text, timestamp: new Date() }]);
    setInput('');

    try {
      const answer = await askAIQuestion(text);
      setMessages(prev => [...prev, { role: 'ai', text: answer, timestamp: new Date() }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: "Sorry, I couldn't process that. Please try again.",
        timestamp: new Date(),
      }]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleAnalyze = () => {
    setActiveTab('analysis');
    analyzeCurrentPage();
  };

  const clearChat = () => {
    setMessages([WELCOME_MESSAGE]);
    clearHistory(); // also wipes the server-side conversation memory
  };

  if (!isAnalysisVisible) return null;

  return (
    <div
      ref={widgetRef}
      className="fixed z-[9999]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'auto',
        width: isMinimised ? '240px' : '360px',
      }}
    >
      <AnimatePresence>
        <motion.div
          key="sk-ai-widget"
          initial={{ opacity: 0, scale: 0.85, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: -10 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="rounded-2xl overflow-hidden shadow-2xl border border-violet-500/30"
          style={{
            background: 'linear-gradient(145deg, #0d0b1e 0%, #130d2e 50%, #0d1a2e 100%)',
            boxShadow: '0 0 0 1px rgba(139,92,246,0.2), 0 25px 50px rgba(0,0,0,0.6), 0 0 60px rgba(139,92,246,0.12)',
          }}
        >
          {/* ── HEADER ──────────────────────────────────────────────────── */}
          <div
            className="relative flex items-center justify-between px-4 py-3 cursor-move select-none overflow-hidden"
            onMouseDown={handleMouseDown}
            style={{
              background: 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 50%, #1e3a5f 100%)',
              borderBottom: '1px solid rgba(139,92,246,0.3)',
            }}
          >
            {/* shimmer sweep */}
            <motion.div
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', repeatDelay: 2 }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent skew-x-12 pointer-events-none"
            />

            {/* Left: avatar + name */}
            <div className="flex items-center gap-2.5 relative z-10">
              <div className="relative">
                <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-violet-300/40 bg-[#0a0818] flex-shrink-0">
                  <img
                    src="/sk ai.png"
                    alt="SK AI"
                    className="w-full h-full object-contain"
                  />
                </div>
                {/* Online dot */}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[#0d0b1e] shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black text-white tracking-wide">SK</span>
                  <span className="text-sm font-black bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent tracking-wide">AI</span>
                </div>
                <p className="text-[10px] text-green-300 font-medium leading-none">Online · Ready</p>
              </div>
            </div>

            {/* Right: action buttons */}
            <div className="flex items-center gap-1 relative z-10">
              <button
                onClick={handleAnalyze}
                title="Analyze this page"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-violet-300 hover:text-white hover:bg-white/15 transition-all"
              >
                <Zap className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={clearChat}
                title="Clear chat"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-violet-300 hover:text-white hover:bg-white/15 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsMinimised(p => !p)}
                title={isMinimised ? 'Expand' : 'Minimise'}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-violet-300 hover:text-white hover:bg-white/15 transition-all"
              >
                {isMinimised
                  ? <Sparkles className="w-3.5 h-3.5" />
                  : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={toggleAnalysisVisibility}
                title="Close SK AI"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-violet-300 hover:text-red-300 hover:bg-red-500/15 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ── BODY ────────────────────────────────────────────────────── */}
          <AnimatePresence>
            {!isMinimised && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                {/* Tab bar */}
                <div className="flex border-b border-white/8" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {(['chat', 'analysis'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold tracking-wide transition-all',
                        activeTab === tab
                          ? 'text-violet-300 border-b-2 border-violet-400'
                          : 'text-gray-500 hover:text-gray-300'
                      )}
                    >
                      {tab === 'chat'
                        ? <><MessageCircle className="w-3.5 h-3.5" />Chat</>
                        : <><Zap className="w-3.5 h-3.5" />Page Analysis</>
                      }
                    </button>
                  ))}
                </div>

                {/* ── CHAT TAB ────────────────────────────────────────── */}
                {activeTab === 'chat' && (
                  <div className="flex flex-col" style={{ height: '400px' }}>
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-thin scrollbar-thumb-violet-500/20 scrollbar-track-transparent">
                      {messages.map((msg, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                        >
                          {/* AI avatar */}
                          {msg.role === 'ai' && (
                            <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-violet-400/30 bg-[#0a0818] mt-0.5">
                              <img src="/sk ai.png" alt="SK AI" className="w-full h-full object-contain" />
                            </div>
                          )}

                          {/* Bubble */}
                          <div
                            className={cn(
                              'max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed',
                              msg.role === 'user'
                                ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-sm shadow-lg shadow-violet-500/20'
                                : 'bg-white/8 text-gray-200 rounded-tl-sm border border-white/10'
                            )}
                          >
                            {msg.text}
                            <div className={cn(
                              'text-[10px] mt-1 opacity-50',
                              msg.role === 'user' ? 'text-right text-violet-200' : 'text-gray-500'
                            )}>
                              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>

                          {/* User avatar */}
                          {msg.role === 'user' && (
                            <div className="w-6 h-6 rounded-full flex-shrink-0 bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mt-0.5 border border-violet-400/30">
                              <span className="text-[10px] font-bold text-white">U</span>
                            </div>
                          )}
                        </motion.div>
                      ))}

                      {/* Typing indicator */}
                      {isProcessingQuestion && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex gap-2 items-center"
                        >
                          <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-violet-400/30 bg-[#0a0818]">
                            <img src="/sk ai.png" alt="SK AI" className="w-full h-full object-contain" />
                          </div>
                          <div className="bg-white/8 border border-white/10 rounded-2xl rounded-tl-sm px-3 py-2.5 flex items-center gap-1">
                            {[0, 0.18, 0.36].map((delay, i) => (
                              <motion.span
                                key={i}
                                animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                                transition={{ duration: 0.7, repeat: Infinity, delay }}
                                className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block"
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Suggested prompts — show when only welcome message */}
                    {messages.length === 1 && (
                      <div className="px-3 pb-2 flex gap-2 flex-wrap">
                        {['What is this platform?', 'Explain chemistry basics', 'How do I join a quiz?'].map(p => (
                          <button
                            key={p}
                            onClick={() => { setInput(p); inputRef.current?.focus(); }}
                            className="text-[11px] px-2.5 py-1 rounded-full border border-violet-500/30 text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 transition-all"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Input bar */}
                    <div
                      className="flex items-center gap-2 px-3 py-3 border-t border-white/8"
                      style={{ background: 'rgba(255,255,255,0.03)' }}
                    >
                      <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isProcessingQuestion}
                        placeholder="Ask SK AI anything..."
                        className="flex-1 bg-white/8 border border-white/12 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50 focus:bg-white/10 transition-all disabled:opacity-50"
                      />
                      <button
                        onClick={sendMessage}
                        disabled={isProcessingQuestion || !input.trim()}
                        className={cn(
                          'w-9 h-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0',
                          'bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500',
                          'shadow-lg shadow-violet-500/30 border border-violet-400/20',
                          'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none'
                        )}
                      >
                        {isProcessingQuestion
                          ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                          : <Send className="w-4 h-4 text-white" />
                        }
                      </button>
                    </div>
                  </div>
                )}

                {/* ── ANALYSIS TAB ─────────────────────────────────────── */}
                {activeTab === 'analysis' && (
                  <div className="flex flex-col" style={{ height: '400px' }}>
                    <div className="flex-1 overflow-y-auto px-4 py-4">
                      {isAnalyzing ? (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex flex-col items-center justify-center h-full gap-4 text-center"
                        >
                          {/* Pulsing avatar during analysis */}
                          <motion.div
                            animate={{ scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="w-16 h-16 rounded-full overflow-hidden border-2 border-violet-400/40 bg-[#0a0818] shadow-[0_0_24px_rgba(139,92,246,0.4)]"
                          >
                            <img src="/sk ai.png" alt="SK AI" className="w-full h-full object-contain" />
                          </motion.div>
                          <div>
                            <p className="text-sm font-semibold text-violet-300">SK AI is analyzing…</p>
                            <p className="text-xs text-gray-500 mt-1">Reading the current page</p>
                          </div>
                          <div className="flex gap-1.5">
                            {[0, 0.2, 0.4].map((d, i) => (
                              <motion.span
                                key={i}
                                animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
                                transition={{ duration: 0.8, repeat: Infinity, delay: d }}
                                className="w-2 h-2 rounded-full bg-violet-400 inline-block"
                              />
                            ))}
                          </div>
                        </motion.div>
                      ) : error ? (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex flex-col items-center gap-3 h-full justify-center text-center"
                        >
                          <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                            <X className="w-5 h-5 text-red-400" />
                          </div>
                          <p className="text-sm text-red-300">{error}</p>
                          <button
                            onClick={analyzeCurrentPage}
                            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-violet-600/30 border border-violet-500/30 text-violet-300 hover:bg-violet-600/40 transition-all"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Try Again
                          </button>
                        </motion.div>
                      ) : analysisResult ? (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-4"
                        >
                          {/* SK AI avatar + label */}
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full overflow-hidden border border-violet-400/30 bg-[#0a0818] flex-shrink-0">
                              <img src="/sk ai.png" alt="SK AI" className="w-full h-full object-contain" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-violet-300">SK AI — Page Analysis</p>
                              <p className="text-[10px] text-gray-500">Just now</p>
                            </div>
                          </div>
                          {/* Result bubble */}
                          <div className="bg-white/6 border border-white/10 rounded-2xl p-4">
                            <p className="text-sm text-gray-200 leading-relaxed">{analysisResult}</p>
                          </div>
                          {/* Re-analyze */}
                          <button
                            onClick={analyzeCurrentPage}
                            className="w-full flex items-center justify-center gap-1.5 text-xs py-2.5 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30 transition-all"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Re-analyze Page
                          </button>
                        </motion.div>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex flex-col items-center justify-center h-full gap-4 text-center"
                        >
                          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-violet-400/30 bg-[#0a0818]">
                            <img src="/sk ai.png" alt="SK AI" className="w-full h-full object-contain" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">Analyze This Page</p>
                            <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
                              Let SK AI read the current page and give you a smart summary.
                            </p>
                          </div>
                          <button
                            onClick={analyzeCurrentPage}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-violet-500/30 transition-all"
                          >
                            <Zap className="w-4 h-4" /> Analyze Now
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── FOOTER BRANDING ──────────────────────────────────── */}
                <div
                  className="flex items-center justify-center gap-1.5 py-2 border-t border-white/5"
                  style={{ background: 'rgba(0,0,0,0.2)' }}
                >
                  <Bot className="w-3 h-3 text-violet-400" />
                  <span className="text-[10px] text-gray-600 font-medium">Powered by SK AI · Dhole Sir Classes</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default AIAnalysisWidget;
