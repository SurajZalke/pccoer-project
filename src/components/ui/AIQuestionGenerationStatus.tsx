import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Brain, Sparkles, Zap, CheckCircle2, Cpu, Layers, Code } from 'lucide-react';

interface AIQuestionGenerationStatusProps {
  isGenerating: boolean;
  topic: string;
  numQuestions: number;
  onClose?: () => void;
  className?: string;
}

const AIQuestionGenerationStatus: React.FC<AIQuestionGenerationStatusProps> = ({
  isGenerating,
  topic,
  numQuestions,
  onClose,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [dots, setDots] = useState('');
  const [loadingPhase, setLoadingPhase] = useState(0);
  
  const loadingSteps = [
    { icon: Brain, text: 'Analyzing topic', color: 'text-purple-400', subtext: 'Understanding key concepts...' },
    { icon: Cpu, text: 'Generating questions', color: 'text-blue-400', subtext: 'Crafting engaging questions...' },
    { icon: Layers, text: 'Structuring content', color: 'text-cyan-400', subtext: 'Organizing question types...' },
    { icon: Zap, text: 'Finalizing quiz', color: 'text-yellow-400', subtext: 'Polishing the final quiz...' },
  ];

  useEffect(() => {
    if (!isGenerating) return;
    
    const dotInterval = setInterval(() => {
      setDots(prev => prev.length < 3 ? prev + '.' : '');
    }, 400);
    
    return () => clearInterval(dotInterval);
  }, [isGenerating]);

  useEffect(() => {
    if (!isGenerating) return;
    
    const phaseInterval = setInterval(() => {
      setLoadingPhase(prev => (prev + 1) % loadingSteps.length);
    }, 1800);
    
    return () => clearInterval(phaseInterval);
  }, [isGenerating]);

  useEffect(() => {
    if (!isGenerating) {
      const hideTimer = setTimeout(() => {
        setIsVisible(false);
        if (onClose) onClose();
      }, 5000);
      
      return () => clearTimeout(hideTimer);
    }
  }, [isGenerating, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) onClose();
  };

  if (!isVisible) return null;

  const CurrentIcon = loadingSteps[loadingPhase].icon;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.9 }}
        className={`fixed bottom-6 right-6 bg-gradient-to-br from-slate-900 via-purple-900/80 to-slate-900 border border-purple-500/30 rounded-3xl p-6 shadow-2xl shadow-purple-500/20 backdrop-blur-xl max-w-md w-full z-50 ${className}`}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 rounded-full blur-md opacity-50"
              />
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="relative p-3 bg-slate-800 rounded-full"
              >
                <Brain className="w-6 h-6 text-white" />
              </motion.div>
            </div>
            <div>
              <h3 className="text-lg font-bold bg-gradient-to-r from-purple-300 via-blue-300 to-cyan-300 bg-clip-text text-transparent">
                AI Question Generator
              </h3>
              <p className="text-xs text-slate-400">
                Generating {numQuestions} questions
              </p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {!isGenerating ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-center gap-2 py-4"
          >
            <CheckCircle2 className="w-8 h-8 text-green-400" />
            <div className="text-center">
              <p className="text-green-300 font-semibold">Questions generated successfully!</p>
              <p className="text-sm text-green-400/70">Your quiz is ready!</p>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-5">
            <div className="px-3 py-2 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <p className="text-xs text-slate-400">Topic</p>
              <p className="text-sm font-medium text-slate-200 truncate">
                {topic}
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-full bg-slate-800 rounded-full h-2 relative overflow-hidden">
                <motion.div 
                  className="h-full rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ 
                    width: `${((loadingPhase + 1) / loadingSteps.length) * 100}%`
                  }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{
                    background: 'linear-gradient(90deg, #a855f7, #3b82f6, #06b6d4)'
                  }}
                />
                <motion.div
                  className="absolute top-0 left-0 h-full w-1/3 bg-white opacity-40 blur-sm"
                  initial={{ x: '-100%' }}
                  animate={{ x: '200%' }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                />
              </div>
              <p className="text-xs text-right text-slate-400">
                {Math.round(((loadingPhase + 1) / loadingSteps.length) * 100)}%
              </p>
            </div>

            <motion.div 
              key={loadingPhase}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl border border-purple-500/20"
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 1, repeat: Infinity, repeatDelay: 0.5 }}
              >
                <CurrentIcon className={`w-5 h-5 ${loadingSteps[loadingPhase].color}`} />
              </motion.div>
              <div className="flex-1">
                <p className="font-medium text-slate-200">
                  {loadingSteps[loadingPhase].text}{dots}
                </p>
                <p className="text-xs text-slate-400">
                  {loadingSteps[loadingPhase].subtext}
                </p>
              </div>
            </motion.div>

            <div className="relative h-16 w-full flex items-center justify-center overflow-hidden">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  initial={{
                    x: i * 20 - 70,
                    y: 0,
                    opacity: 0,
                    scale: 0.5,
                  }}
                  animate={{
                    y: [0, -30, 0],
                    opacity: [0, 1, 0],
                    scale: [0.5, 1.2, 0.5],
                    x: i * 20 - 70 + Math.sin(i) * 20,
                  }}
                  transition={{
                    duration: 2 + Math.random() * 2,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: 'easeInOut',
                  }}
                >
                  {i % 4 === 0 && <Sparkles className="w-3 h-3 text-purple-400" />}
                  {i % 4 === 1 && <Zap className="w-3 h-3 text-blue-400" />}
                  {i % 4 === 2 && <Code className="w-3 h-3 text-cyan-400" />}
                  {i % 4 === 3 && <div className="w-2 h-2 rounded-full bg-yellow-400" />}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default AIQuestionGenerationStatus;