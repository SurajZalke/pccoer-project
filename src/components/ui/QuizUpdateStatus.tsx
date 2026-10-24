import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save } from 'lucide-react';

interface QuizUpdateStatusProps {
  isUpdating: boolean;
  action: 'saving' | 'updating' | 'generating';
  onClose?: () => void;
  className?: string;
}

const QuizUpdateStatus: React.FC<QuizUpdateStatusProps> = ({
  isUpdating,
  action,
  onClose,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [dots, setDots] = useState('');
  const [loadingPhase, setLoadingPhase] = useState(0);
  
  // Phrases that simulate the updating process
  const getActionPhrases = () => {
    switch(action) {
      case 'saving':
        return [
          'Preparing quiz data',
          'Validating questions',
          'Uploading to database',
          'Finalizing changes'
        ];
      case 'updating':
        return [
          'Retrieving current quiz',
          'Applying changes',
          'Validating updates',
          'Finalizing quiz'
        ];
      case 'generating':
        return [
          'Processing request',
          'Generating content',
          'Validating results',
          'Finalizing content'
        ];
      default:
        return [
          'Processing request',
          'Applying changes',
          'Finalizing updates'
        ];
    }
  };

  const thinkingPhrases = getActionPhrases();

  // Dot animation effect
  useEffect(() => {
    if (!isUpdating) return;
    
    const dotInterval = setInterval(() => {
      setDots(prev => prev.length < 3 ? prev + '.' : '');
    }, 400);
    
    return () => clearInterval(dotInterval);
  }, [isUpdating]);

  // Phase transition effect
  useEffect(() => {
    if (!isUpdating) return;
    
    const phaseInterval = setInterval(() => {
      setLoadingPhase(prev => (prev + 1) % thinkingPhrases.length);
    }, 2000);
    
    return () => clearInterval(phaseInterval);
  }, [isUpdating, thinkingPhrases]);

  // Auto-hide when complete after delay
  useEffect(() => {
    if (!isUpdating) {
      const hideTimer = setTimeout(() => {
        setIsVisible(false);
        if (onClose) onClose();
      }, 5000);
      
      return () => clearTimeout(hideTimer);
    }
  }, [isUpdating, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) onClose();
  };

  if (!isVisible) return null;

  const getStatusTitle = () => {
    switch(action) {
      case 'saving': return 'Saving Quiz';
      case 'updating': return 'Updating Quiz';
      case 'generating': return 'Generating Content';
      default: return 'Processing';
    }
  };

  const getSuccessMessage = () => {
    switch(action) {
      case 'saving': return 'Quiz saved successfully!';
      case 'updating': return 'Quiz updated successfully!';
      case 'generating': return 'Content generated successfully!';
      default: return 'Operation completed successfully!';
    }
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className={`fixed bottom-4 right-4 bg-green-900/90 border border-green-700 rounded-lg p-4 shadow-lg max-w-sm z-50 ${className}`}
      >
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center">
            <motion.div
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-green-400 mr-2"
            >
              <Save size={24} />
            </motion.div>
            <h3 className="text-lg font-bold text-green-300">{getStatusTitle()}</h3>
          </div>
          <button 
            onClick={handleClose}
            className="text-green-300 hover:text-green-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        
        {!isUpdating ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-green-400 font-medium py-2"
          >
            {getSuccessMessage()}
          </motion.div>
        ) : (
          <div className="space-y-3">
            <div className="text-green-200 text-sm">
              {action === 'saving' ? 'Saving your quiz' : 
               action === 'updating' ? 'Updating your quiz' : 
               'Processing your request'}{dots}
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-green-900/50 rounded-full h-2.5">
              <motion.div 
                className="bg-green-500 h-2.5 rounded-full" 
                initial={{ width: 0 }}
                animate={{ width: `${(loadingPhase + 1) * (100 / thinkingPhrases.length)}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            
            {/* Current thinking phase */}
            <div className="text-sm text-green-300 text-center">
              {thinkingPhrases[loadingPhase]}{dots}
            </div>
            
            {/* Animated particles */}
            <div className="relative h-10">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1.5 h-1.5 rounded-full bg-green-400"
                  initial={{ 
                    x: 10 + (i * 30), 
                    y: 20, 
                    opacity: 0.3 
                  }}
                  animate={{ 
                    y: [20, 5, 20],
                    opacity: [0.3, 1, 0.3],
                    scale: [1, 1.2, 1]
                  }}
                  transition={{ 
                    duration: 1.5, 
                    repeat: Infinity, 
                    delay: i * 0.2,
                    ease: "easeInOut"
                  }}
                />
              ))}
            </div>
            
            <div className="text-xs text-green-300/70 italic">
              Your quiz is being processed in the background. You can continue using the app.
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default QuizUpdateStatus;