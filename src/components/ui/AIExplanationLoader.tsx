import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface AIExplanationLoaderProps {
  questionNumber?: number;
  className?: string;
  isComplete?: boolean;
}

const AIExplanationLoader: React.FC<AIExplanationLoaderProps> = ({ 
  questionNumber, 
  className = '',
  isComplete = false
}) => {
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [dots, setDots] = useState('');
  
  // Phrases that simulate AI thinking process
  const thinkingPhrases = [
    'Analyzing question content',
    'Processing scientific concepts',
    'Retrieving relevant information',
    'Formulating explanation',
    'Finalizing response'
  ];

  // Dot animation effect
  useEffect(() => {
    if (isComplete) return;
    
    const dotInterval = setInterval(() => {
      setDots(prev => prev.length < 3 ? prev + '.' : '');
    }, 400);
    
    return () => clearInterval(dotInterval);
  }, [isComplete]);

  // Phase transition effect
  useEffect(() => {
    if (isComplete) return;
    
    const phaseInterval = setInterval(() => {
      setLoadingPhase(prev => (prev + 1) % thinkingPhrases.length);
    }, 2000);
    
    return () => clearInterval(phaseInterval);
  }, [isComplete]);

  // Brain wave animation variants
  const waveVariants = {
    animate: {
      d: [
        "M 0,20 Q 20,5 40,20 Q 60,35 80,20 Q 100,5 120,20",
        "M 0,20 Q 20,35 40,20 Q 60,5 80,20 Q 100,35 120,20",
        "M 0,20 Q 20,5 40,20 Q 60,35 80,20 Q 100,5 120,20"
      ],
      transition: {
        duration: 2,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "loop" as const
      }
    }
  };

  return (
    <div className={`bg-blue-900/30 border border-blue-700 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-center mb-3">
        {/* Brain icon with pulsing effect */}
        <div className="relative">
          <motion.div
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-blue-400 flex items-center justify-center"
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9.5 2C8.67157 2 8 2.67157 8 3.5C8 3.93057 8.18743 4.3128 8.48978 4.57913C7.00551 5.48501 6 7.13285 6 9C6 9.35223 6.03643 9.69584 6.10643 10.0275C4.85353 10.2277 3.83333 11.3346 3.83333 12.6667C3.83333 13.403 4.16533 14.0654 4.68963 14.5022C4.16533 14.9391 3.83333 15.6015 3.83333 16.3378C3.83333 17.6699 4.85353 18.7768 6.10643 18.977C6.03643 19.3087 6 19.6523 6 20.0045C6 21.8717 7.00551 23.5195 8.48978 24.4254C8.18743 24.6917 8 25.0739 8 25.5045C8 26.3329 8.67157 27.0045 9.5 27.0045C10.0168 27.0045 10.4754 26.7437 10.7449 26.3421C10.9938 26.3799 11.2472 26.3996 11.5044 26.3996H12.4956C12.7528 26.3996 13.0062 26.3799 13.2551 26.3421C13.5246 26.7437 13.9832 27.0045 14.5 27.0045C15.3284 27.0045 16 26.3329 16 25.5045C16 25.0739 15.8126 24.6917 15.5102 24.4254C16.9945 23.5195 18 21.8717 18 20.0045C18 19.6523 17.9636 19.3087 17.8936 18.977C19.1465 18.7768 20.1667 17.6699 20.1667 16.3378C20.1667 15.6015 19.8347 14.9391 19.3104 14.5022C19.8347 14.0654 20.1667 13.403 20.1667 12.6667C20.1667 11.3346 19.1465 10.2277 17.8936 10.0275C17.9636 9.69584 18 9.35223 18 9C18 7.13285 16.9945 5.48501 15.5102 4.57913C15.8126 4.3128 16 3.93057 16 3.5C16 2.67157 15.3284 2 14.5 2C13.9832 2 13.5246 2.26082 13.2551 2.66241C13.0062 2.62465 12.7528 2.60489 12.4956 2.60489H11.5044C11.2472 2.60489 10.9938 2.62465 10.7449 2.66241C10.4754 2.26082 10.0168 2 9.5 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 9V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 16V18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 14H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 14H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.div>
          
          {/* Animated brain waves */}
          <motion.svg
            width="120"
            height="40"
            viewBox="0 0 120 40"
            className="absolute top-1/2 left-full ml-1 transform -translate-y-1/2"
          >
            <motion.path
              variants={{
                animate: {
                  d: [
                    "M 0,20 Q 20,5 40,20 Q 60,35 80,20 Q 100,5 120,20",
                    "M 0,20 Q 20,35 40,20 Q 60,5 80,20 Q 100,35 120,20",
                    "M 0,20 Q 20,5 40,20 Q 60,35 80,20 Q 100,5 120,20"
                  ],
                  transition: {
                    duration: 2,
                    ease: ["easeInOut"],
                    repeat: Infinity,
                    repeatType: "loop"
                  }
                }
              }}
              animate="animate"
              stroke="#60a5fa"
              strokeWidth="2"
              fill="none"
            />
          </motion.svg>
        </div>
        
        <h3 className="text-lg font-bold text-blue-300 ml-2">AI Explanation Generator</h3>
      </div>
      
      {isComplete ? (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-green-400 font-medium"
        >
          Explanation generated successfully!
        </motion.div>
      ) : (
        <div className="space-y-3">
          <div className="text-center text-blue-200">
            {questionNumber ? `Generating explanation for question ${questionNumber}${dots}` : `Generating explanation${dots}`}
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-blue-900/50 rounded-full h-2.5">
            <motion.div 
              className="bg-blue-500 h-2.5 rounded-full" 
              initial={{ width: 0 }}
              animate={{ width: `${(loadingPhase + 1) * (100 / thinkingPhrases.length)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          
          {/* Current thinking phase */}
          <div className="text-sm text-blue-300 text-center">
            {thinkingPhrases[loadingPhase]}{dots}
          </div>
          
          {/* Animated particles */}
          <div className="relative h-10">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full bg-blue-400"
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
        </div>
      )}
    </div>
  );
};

export default AIExplanationLoader;