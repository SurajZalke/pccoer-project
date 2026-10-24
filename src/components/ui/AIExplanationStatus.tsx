import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface AIExplanationStatusProps {
  totalQuizzes: number;
  completedQuizzes: number;
  onClose?: () => void;
  className?: string;
}

const AIExplanationStatus: React.FC<AIExplanationStatusProps> = ({
  totalQuizzes,
  completedQuizzes,
  onClose,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [dots, setDots] = useState('');
  const [particleCount, setParticleCount] = useState(0);
  
  // Calculate progress percentage
  const progressPercentage = Math.min(100, Math.round((completedQuizzes / totalQuizzes) * 100));
  const isComplete = completedQuizzes >= totalQuizzes;

  // Dot animation effect
  useEffect(() => {
    if (isComplete) return;
    
    const dotInterval = setInterval(() => {
      setDots(prev => prev.length < 3 ? prev + '.' : '');
    }, 400);
    
    return () => clearInterval(dotInterval);
  }, [isComplete]);

  // Particle animation effect
  useEffect(() => {
    if (isComplete) return;
    
    const particleInterval = setInterval(() => {
      setParticleCount(prev => (prev + 1) % 20);
    }, 200);
    
    return () => clearInterval(particleInterval);
  }, [isComplete]);

  // Auto-hide when complete after delay
  useEffect(() => {
    if (isComplete) {
      const hideTimer = setTimeout(() => {
        setIsVisible(false);
        if (onClose) onClose();
      }, 5000);
      
      return () => clearTimeout(hideTimer);
    }
  }, [isComplete, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) onClose();
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className={`fixed bottom-4 right-4 bg-blue-900/90 border border-blue-700 rounded-lg p-4 shadow-lg max-w-sm z-50 ${className}`}
      >
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center">
            <motion.div
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-blue-400 mr-2"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.5 2C8.67157 2 8 2.67157 8 3.5C8 3.93057 8.18743 4.3128 8.48978 4.57913C7.00551 5.48501 6 7.13285 6 9C6 9.35223 6.03643 9.69584 6.10643 10.0275C4.85353 10.2277 3.83333 11.3346 3.83333 12.6667C3.83333 13.403 4.16533 14.0654 4.68963 14.5022C4.16533 14.9391 3.83333 15.6015 3.83333 16.3378C3.83333 17.6699 4.85353 18.7768 6.10643 18.977C6.03643 19.3087 6 19.6523 6 20.0045C6 21.8717 7.00551 23.5195 8.48978 24.4254C8.18743 24.6917 8 25.0739 8 25.5045C8 26.3329 8.67157 27.0045 9.5 27.0045C10.0168 27.0045 10.4754 26.7437 10.7449 26.3421C10.9938 26.3799 11.2472 26.3996 11.5044 26.3996H12.4956C12.7528 26.3996 13.0062 26.3799 13.2551 26.3421C13.5246 26.7437 13.9832 27.0045 14.5 27.0045C15.3284 27.0045 16 26.3329 16 25.5045C16 25.0739 15.8126 24.6917 15.5102 24.4254C16.9945 23.5195 18 21.8717 18 20.0045C18 19.6523 17.9636 19.3087 17.8936 18.977C19.1465 18.7768 20.1667 17.6699 20.1667 16.3378C20.1667 15.6015 19.8347 14.9391 19.3104 14.5022C19.8347 14.0654 20.1667 13.403 20.1667 12.6667C20.1667 11.3346 19.1465 10.2277 17.8936 10.0275C17.9636 9.69584 18 9.35223 18 9C18 7.13285 16.9945 5.48501 15.5102 4.57913C15.8126 4.3128 16 3.93057 16 3.5C16 2.67157 15.3284 2 14.5 2C13.9832 2 13.5246 2.26082 13.2551 2.66241C13.0062 2.62465 12.7528 2.60489 12.4956 2.60489H11.5044C11.2472 2.60489 10.9938 2.62465 10.7449 2.66241C10.4754 2.26082 10.0168 2 9.5 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 9V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 16V18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 14H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 14H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </motion.div>
            <h3 className="text-lg font-bold text-blue-300">AI Explanation Generator</h3>
          </div>
          <button 
            onClick={handleClose}
            className="text-blue-300 hover:text-blue-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        
        {isComplete ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-green-400 font-medium py-2"
          >
            All explanations generated successfully!
          </motion.div>
        ) : (
          <div className="space-y-3">
            <div className="text-blue-200 text-sm">
              Generating explanations for {totalQuizzes} quizzes{dots}
            </div>
            
            {/* Progress bar */}
            <div className="relative">
              <div className="w-full bg-blue-900/50 rounded-full h-2.5">
                <motion.div 
                  className="bg-blue-500 h-2.5 rounded-full" 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              
              {/* Animated particles above progress bar */}
              <div className="absolute -top-3 left-0 w-full h-6 overflow-hidden pointer-events-none">
                {[...Array(5)].map((_, i) => {
                  const position = (progressPercentage / 100) * 100;
                  const offset = (i * 20) % 100;
                  const particlePosition = Math.min(position, Math.max(0, position - offset));
                  
                  return (
                    <motion.div
                      key={i}
                      className="absolute w-1.5 h-1.5 rounded-full bg-blue-400"
                      style={{ left: `${particlePosition}%` }}
                      animate={{ 
                        y: [0, -8, 0],
                        opacity: [0.3, 1, 0.3],
                        scale: [1, 1.2, 1]
                      }}
                      transition={{ 
                        duration: 1, 
                        repeat: Infinity, 
                        delay: i * 0.2,
                        ease: "easeInOut"
                      }}
                    />
                  );
                })}
              </div>
            </div>
            
            <div className="flex justify-between text-xs text-blue-300">
              <span>{completedQuizzes} completed</span>
              <span>{progressPercentage}%</span>
            </div>
            
            <div className="text-xs text-blue-300/70 italic">
              Explanations are being generated in the background. You can continue using the app.
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default AIExplanationStatus;