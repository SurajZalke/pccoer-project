import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAIAnalysis } from '@/contexts/AIAnalysisContext';
import { X, Bot } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// SK AI Toggle Button — fixed bottom-right, shows SK AI photo when closed,
// X icon when open.
// ─────────────────────────────────────────────────────────────────────────────

const AIAnalysisToggle: React.FC = () => {
  const { toggleAnalysisVisibility, isAnalysisVisible } = useAIAnalysis();

  return (
    <motion.button
      onClick={toggleAnalysisVisibility}
      aria-label={isAnalysisVisible ? 'Close SK AI' : 'Open SK AI'}
      title={isAnalysisVisible ? 'Close SK AI' : 'Chat with SK AI'}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.93 }}
      className="fixed bottom-6 right-6 z-[9998] focus:outline-none group"
    >
      {/* Outer pulse rings — only when closed */}
      {!isAnalysisVisible && (
        <>
          <span className="absolute inset-0 rounded-full bg-violet-500/25 animate-ping" style={{ animationDuration: '2s' }} />
          <span className="absolute -inset-1 rounded-full bg-violet-500/10 animate-ping" style={{ animationDuration: '2.6s', animationDelay: '0.4s' }} />
        </>
      )}

      {/* Main button */}
      <div
        className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-violet-400/60 shadow-2xl transition-all duration-300"
        style={{
          background: 'linear-gradient(135deg, #4c1d95 0%, #1e3a5f 100%)',
          boxShadow: isAnalysisVisible
            ? '0 0 0 3px rgba(139,92,246,0.5), 0 8px 32px rgba(0,0,0,0.5)'
            : '0 0 0 2px rgba(139,92,246,0.3), 0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(139,92,246,0.35)',
        }}
      >
        <AnimatePresence mode="wait">
          {isAnalysisVisible ? (
            /* Close state — X icon */
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.22 }}
              className="w-full h-full flex items-center justify-center"
            >
              <X className="w-6 h-6 text-white" />
            </motion.div>
          ) : (
            /* Open state — SK AI photo */
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.22 }}
              className="w-full h-full bg-[#0a0818]"
            >
              <img
                src="/sk ai.png"
                alt="SK AI"
                className="w-full h-full object-contain"
                draggable={false}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Online dot */}
        {!isAnalysisVisible && (
          <span className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-[#0a0818] shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
        )}
      </div>

      {/* Tooltip label */}
      <AnimatePresence>
        {!isAnalysisVisible && (
          <motion.div
            initial={{ opacity: 0, x: 8, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 8, scale: 0.9 }}
            transition={{ duration: 0.18 }}
            className="absolute right-16 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ whiteSpace: 'nowrap' }}
          >
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-violet-500/30 text-xs font-semibold text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              style={{
                background: 'linear-gradient(135deg, #4c1d95cc 0%, #1e3a5fcc 100%)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <Bot className="w-3 h-3 text-violet-300" />
              Chat with SK AI
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

export default AIAnalysisToggle;
