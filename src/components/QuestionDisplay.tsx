import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Question } from "@/types";
import { Progress } from "@/components/ui/progress";
import { useGame } from "@/contexts/GameContext";
import { Howl } from 'howler';
import { toast } from 'sonner';
import { calculateCorrectAnswerRate, generateAIExplanation } from "@/services/aiExplanationService";
import { motion, AnimatePresence } from 'framer-motion';
import { useRef } from 'react';
import AIExplanationLoader from "@/components/ui/AIExplanationLoader";
import { CheckCircle, Clock, Trophy, Star } from 'lucide-react';

interface QuestionDisplayProps {
  question: Question;
  onAnswer?: (questionId: string, optionId: string) => void;
  showTimer?: boolean;
  isHostView?: boolean;
  disableOptions?: boolean;
  markingType?: string;
  negativeValue?: number;
  onHostSelect?: (optionId: string) => void;
  showCorrectAnswer: boolean;
  isWarningSoundEnabled?: boolean;
  warningSoundVolume?: number;
  selectedAnswer?: string;
  timeLeft?: number; // Add timeLeft prop
  showAIExplanation?: boolean; // Add showAIExplanation prop
  aiExplanationEnabled?: boolean;
}

const warningSound = new Howl({
  src: ['/sounds/mrdeveloper.mp3'],
  volume: 0.8,
});

export function QuestionDisplay({
  question, 
  onAnswer,
  showTimer = true,
  isHostView = false,
  disableOptions = false,
  markingType, // added to destructuring to avoid ReferenceError
  negativeValue,
  onHostSelect,
  showCorrectAnswer,
  selectedAnswer, // Add selectedAnswer to props
  timeLeft, // Add timeLeft to props
  showAIExplanation = false,
  aiExplanationEnabled = true,
}: QuestionDisplayProps) {
  // Fallback if question is undefined
  if (!question) {
    return <div className="text-white p-6">Question not available</div>;
  }
  const [selectedOption, setSelectedOption] = useState<string | null>(selectedAnswer || null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  const { activeGame, currentPlayer } = useGame();
  const [warningSoundPlayed, setWarningSoundPlayed] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string>("");
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const explanationFetchedRef = useRef<string | null>(null); // Add useRef

  const normalizeExplanation = (explanation: any) => {
    if (typeof explanation === 'string') return explanation;
    if (Array.isArray(explanation)) {
      return explanation
        .map(item => (typeof item === 'string' ? item : JSON.stringify(item)))
        .join(' ');
    }
    if (typeof explanation === 'object' && explanation !== null) {
      return JSON.stringify(explanation, null, 2);
    }
    return String(explanation ?? '');
  };

  // Polling logic: count answers for each option for this question
  let pollCounts: Record<string, number> = {};
  let totalAnswers = 0;
  if (activeGame && question) {
    (question.options || []).forEach(opt => { pollCounts[opt.id] = 0; });
    activeGame.players.forEach(player => {
      const ans = player.answers?.find(a => a.questionId === question.id);
      if (ans) {
        pollCounts[ans.selectedOption] = (pollCounts[ans.selectedOption] || 0) + 1;
        totalAnswers++;
      }
    });
  }

  // Effect to play sound when 10 seconds remain
  useEffect(() => {
    if (timeLeft === 10 && !warningSoundPlayed) {
      warningSound.play();
      setWarningSoundPlayed(true);
    }
    if (timeLeft && (timeLeft > 10 || timeLeft === question.timeLimit)) {
      setWarningSoundPlayed(false);
    }
  }, [timeLeft, question.id, question.timeLimit, warningSoundPlayed]);
  
  useEffect(() => {
    setSelectedOption(null);
    setIsAnswered(false);
    setWarningSoundPlayed(false);
    setShowExplanation(false); // Reset explanation state when question changes
    setAiExplanation(""); // Clear any previous explanation
    explanationFetchedRef.current = null; // Reset the ref when question changes
    setHasAnswered(false); // Ensure hasAnswered is reset for the new question
  }, [question.id, question.timeLimit, selectedAnswer, disableOptions]); // Added disableOptions to dependencies

  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false);

  useEffect(() => {
    if (showCorrectAnswer) {
      setIsAnswered(true);
      
      // AI explanation is COMPLETELY disabled if aiExplanationEnabled is false
      const aiEnabled = Boolean(aiExplanationEnabled);
      
      if (!aiEnabled) {
        // Never show AI explanation when disabled
        setShowExplanation(false);
        setAiExplanation("");
        setIsGeneratingExplanation(false);
        return;
      }

      // Determine if AI explanation should be shown (only when enabled)
      const shouldShowAIExplanation = (
        showAIExplanation ||
        isHostView ||
        showCorrectAnswer ||
        (currentPlayer?.answers && calculateCorrectAnswerRate(currentPlayer.answers) < 80) ||
        (timeLeft === 0 && totalAnswers === 0)
      );

      if (shouldShowAIExplanation && question.explanation) {
        setAiExplanation(normalizeExplanation(question.explanation));
        setShowExplanation(true);
      } else if (shouldShowAIExplanation && !question.explanation) {
        // Fallback if explanation is not pre-fetched (e.g., old quiz data)
        const optionForExplanation = selectedOption || question.correctOption;
        if (optionForExplanation && explanationFetchedRef.current !== question.id) {
          explanationFetchedRef.current = question.id;
          setIsGeneratingExplanation(true);
          
          generateAIExplanation(question, optionForExplanation)
            .then(explanation => {
              setAiExplanation(explanation);
              setShowExplanation(true);
              setIsGeneratingExplanation(false);
            })
            .catch(error => {
              console.error("Error generating AI explanation:", error);
              explanationFetchedRef.current = null;
              setIsGeneratingExplanation(false);
            });
        }
      }
    }
    // Trigger MathJax typesetting after explanation is set
    if (window.MathJax) {
      window.MathJax.typesetPromise();
    }
  }, [showCorrectAnswer, currentPlayer, question, selectedOption, isHostView, timeLeft, totalAnswers, aiExplanationEnabled, showAIExplanation]);
  
  const handleSelectOption = (optionId: string) => {
    if (isAnswered || disableOptions) return;
    setSelectedOption(optionId);
    setIsAnswered(true);
    setHasAnswered(true);
    if (isHostView && onHostSelect) {
      onHostSelect(optionId);
    } else if (onAnswer) {
      onAnswer(question.id, optionId);
    }
  };
  
  const getProgressColor = () => {
    if (!timeLeft || !question.timeLimit) return "bg-gray-300"; // Handle cases where timeLeft or timeLimit might be undefined
    const percentLeft = (timeLeft / question.timeLimit) * 100;
    if (percentLeft > 66) return "bg-green-500";
    if (percentLeft > 33) return "bg-yellow-500";
    return "bg-red-500";
  };
  
  // --- DEBUG: Log option image URLs to verify data ---
  useEffect(() => {
    if (question?.options) {
      (question.options || []).forEach((option, idx) => {
        // eslint-disable-next-line no-console
        console.log(`Option ${String.fromCharCode(65 + idx)} imageUrl:`, option.imageUrl);
      });
    }
  }, [question]);


  return (
    <div className={`relative ${isHostView ? "host-view" : ""}`}>

      <Card className="quiz-card overflow-hidden border-0 bg-transparent shadow-none">
      <CardContent className="pt-4 space-y-4 px-2 sm:px-4">
        <div>
        {showTimer && timeLeft !== undefined && question.timeLimit !== undefined && (
          <div className="space-y-1">
            {/* Gamified timer */}
            <div className="flex justify-between items-center text-sm mb-1">
              <div className="flex items-center gap-1.5">
                <Clock className={`w-4 h-4 ${timeLeft <= 5 ? 'text-red-400 animate-spin' : timeLeft <= 10 ? 'text-yellow-400' : 'text-green-400'}`} />
                <span className="font-medium text-white">Time</span>
              </div>
              <motion.span
                key={timeLeft}
                initial={{ scale: 1.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`font-black text-xl ${timeLeft <= 5 ? 'text-red-400' : timeLeft <= 10 ? 'text-yellow-300' : 'text-green-300'}`}
              >
                {timeLeft}s
              </motion.span>
            </div>
            <div className="relative h-3 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className={`absolute inset-y-0 left-0 rounded-full transition-colors duration-500 ${
                  timeLeft / question.timeLimit > 0.66 
                    ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                    : timeLeft / question.timeLimit > 0.33
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-400'
                      : 'bg-gradient-to-r from-red-400 to-rose-500'
                }`}
                initial={false}
                animate={{ width: `${(timeLeft / question.timeLimit) * 100}%` }}
                transition={{ duration: 0.9, ease: 'linear' }}
              />
              {/* Glow effect */}
              {timeLeft <= 5 && (
                <motion.div
                  className="absolute inset-0 bg-red-400/30 rounded-full"
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
              )}
            </div>
          </div>
        )}
        
        <div className="space-y-4">
        </div>
          <motion.h3
            key={question.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-lg sm:text-xl md:text-2xl font-black text-center whitespace-pre-line leading-relaxed text-white drop-shadow-lg px-2 py-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10"
          >
            {question.text}
          </motion.h3>
          
          {question.imageUrl && (
            <div className="flex justify-center my-4">
              <div className="max-w-3xl w-full overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800 p-2">
                <img 
                  src={question.imageUrl.includes('cloudinary.com') ? 
                    question.imageUrl.replace('/upload/', '/upload/f_auto,q_auto,w_600,c_limit/') : 
                    question.imageUrl} 
                  alt="Question" 
                  className="max-h-96 w-auto mx-auto object-contain rounded-md"
                  loading="lazy"
                  crossOrigin="anonymous"
                  style={{ display: 'block' }}
                  referrerPolicy="no-referrer"
                  onError={e => {
                    const imgElement = e.currentTarget as HTMLImageElement;
                    const originalSrc = question.imageUrl;
                    let newSrc = originalSrc;
                    if (originalSrc && originalSrc.includes('cloudinary.com') && !originalSrc.includes('/upload/f_auto')) {
                      newSrc = originalSrc.replace('/upload/', '/upload/f_auto,q_auto,w_600,c_limit/');
                    }
                    if (originalSrc && !originalSrc.includes('?v=')) {
                      newSrc = `${newSrc}?v=${new Date().getTime()}`;
                      imgElement.src = newSrc;
                    }
                  }}
                />

              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(question.options || []).map((option, idx) => {
              const optionLabel = String.fromCharCode(65 + idx);
              const selected = selectedOption === option.id;
              const disabled = isAnswered || disableOptions;
              const isCorrect = showCorrectAnswer && option.id === question.correctOption;
              const isWrong = showCorrectAnswer && option.id !== question.correctOption && selected;

              let imgSrc = "";
              if (typeof option.imageUrl === "string" && option.imageUrl.trim() !== "") {
                imgSrc = option.imageUrl.includes('cloudinary.com')
                  ? option.imageUrl.replace('/upload/', '/upload/f_auto,q_auto,w_300,c_limit/')
                  : option.imageUrl;
              }

              // Color system
              const optionColors = [
                'from-red-500 to-pink-600',
                'from-blue-500 to-cyan-600',
                'from-yellow-500 to-orange-500',
                'from-green-500 to-emerald-600',
              ];
              const baseColor = optionColors[idx % 4];

              return (
                <motion.div
                  key={option.id}
                  initial={{ opacity: 0, x: idx % 2 === 0 ? -20 : 20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ delay: idx * 0.07, duration: 0.35, type: 'spring', stiffness: 300 }}
                  whileHover={!disabled ? { scale: 1.03, y: -2 } : {}}
                  whileTap={!disabled ? { scale: 0.97 } : {}}
                  className={`relative flex items-center gap-3 px-5 py-5 rounded-2xl cursor-pointer transition-all duration-300 shadow-lg select-none
                    ${isCorrect
                      ? 'bg-gradient-to-r from-green-400 to-emerald-500 ring-4 ring-green-300 shadow-green-400/60'
                      : isWrong
                        ? 'bg-gradient-to-r from-red-500 to-rose-600 ring-4 ring-red-300 shadow-red-400/60'
                        : selected && !showCorrectAnswer
                          ? `bg-gradient-to-r ${baseColor} ring-4 ring-white/40 shadow-white/20`
                          : showCorrectAnswer && option.id !== question.correctOption
                            ? 'bg-white/5 border border-white/10 opacity-50'
                            : `bg-gradient-to-r ${baseColor} hover:brightness-110 shadow-lg`
                    }
                    ${disabled ? 'pointer-events-none' : ''}
                  `}
                  style={{ minHeight: '76px' }}
                  onClick={() => !disabled && handleSelectOption(option.id)}
                >
                  {/* Option label badge */}
                  <span className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl font-black text-lg bg-black/25 text-white shadow-inner border border-white/20">
                    {optionLabel}
                  </span>

                  <div className="flex-1 text-left break-words">
                    <span className="whitespace-pre-line text-base sm:text-lg md:text-xl font-bold text-white drop-shadow leading-snug">
                      {option.text}
                    </span>
                    {imgSrc && (
                      <div className="mt-2 overflow-hidden rounded-xl bg-white/10 p-1.5">
                        <img
                          src={imgSrc}
                          alt={`Option ${optionLabel}`}
                          className="max-h-28 w-auto mx-auto object-contain rounded-lg"
                          loading="lazy"
                          crossOrigin="anonymous"
                          referrerPolicy="no-referrer"
                          onError={e => {
                            const el = e.currentTarget as HTMLImageElement;
                            let s = option.imageUrl;
                            if (s?.includes('cloudinary.com') && !s.includes('/upload/f_auto')) {
                              s = s.replace('/upload/', '/upload/f_auto,q_auto,w_300,c_limit/');
                            }
                            if (s && !s.includes('?v=')) el.src = `${s}?v=${Date.now()}`;
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Correct / Wrong icon */}
                  <AnimatePresence>
                    {isCorrect && (
                      <motion.span
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="ml-2 flex-shrink-0"
                      >
                        <CheckCircle className="w-7 h-7 text-white drop-shadow-lg" />
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {/* Shimmer effect on hover */}
                  {!disabled && !showCorrectAnswer && (
                    <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
          {showCorrectAnswer && (
<>
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className="mt-4"
  >
    {/* Correct answer announcement */}
    <div className="flex items-center gap-2 mb-3 p-3 rounded-xl bg-green-500/20 border border-green-500/40">
      <Trophy className="w-5 h-5 text-yellow-400 flex-shrink-0" />
      <span className="text-white font-bold text-sm sm:text-base">
        Correct: <span className="text-green-300">{question.options.find(opt => opt.id === question.correctOption)?.text}</span>
      </span>
      {(() => {
        const correctOption = question.options.find(opt => opt.id === question.correctOption);
        return correctOption && typeof correctOption.imageUrl === "string" && correctOption.imageUrl.trim() !== "" ? (
          <div className="ml-2 overflow-hidden rounded-md bg-white/10 p-1 max-w-[80px]">
            <img
              src={correctOption.imageUrl.includes('cloudinary.com')
                ? correctOption.imageUrl.replace('/upload/', '/upload/f_auto,q_auto,w_300,c_limit/')
                : correctOption.imageUrl}
              alt="Correct Answer"
              className="max-h-16 w-auto mx-auto object-contain rounded"
              loading="lazy"
            />
          </div>
        ) : null;
      })()}
    </div>

    {/* Marks info */}
    <div className="flex items-center justify-between text-xs text-gray-400 px-1 mb-3">
      <div className="flex items-center gap-1">
        <Star className="w-3 h-3 text-yellow-400" />
        <span>{question.Marks} marks</span>
      </div>
      {markingType === "negative" && (
        <span className="text-red-400">-{negativeValue}% for wrong</span>
      )}
      {isAnswered && <span className="text-green-400">✓ Submitted</span>}
    </div>

    {/* AI Explanation */}
    {isGeneratingExplanation && Boolean(aiExplanationEnabled) && (
      <AIExplanationLoader
        className="mt-3"
        questionNumber={parseInt(question.id.split('-')[1]) || undefined}
      />
    )}

    {showExplanation && aiExplanation && !isGeneratingExplanation && aiExplanationEnabled && (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mt-3 p-4 rounded-2xl bg-gradient-to-br from-blue-900/50 to-indigo-900/50 border border-blue-500/30 backdrop-blur-sm shadow-lg"
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🧠</span>
          <h4 className="text-base font-bold text-blue-300">AI Explanation</h4>
        </div>
        <p className="text-sm mb-1 text-gray-300"><strong className="text-white">Q:</strong> {question.text}</p>
        {selectedOption && (
          <p className="text-sm mb-1 text-gray-300"><strong className="text-white">Your Answer:</strong> <span className={selectedOption === question.correctOption ? 'text-green-400' : 'text-red-400'}>{question.options.find(o => o.id === selectedOption)?.text}</span></p>
        )}
        <p className="text-sm mb-2 text-gray-300"><strong className="text-white">Correct:</strong> <span className="text-green-400">{question.options.find(o => o.id === question.correctOption)?.text}</span></p>
        <div className="text-sm text-blue-100 leading-relaxed border-t border-blue-500/20 pt-2 mt-2"
          dangerouslySetInnerHTML={{ __html: aiExplanation.replace(/\n/g, '<br/>') }}
        />
        <p className="text-xs text-blue-400/60 mt-2 italic">AI generated · for learning purposes</p>
      </motion.div>
    )}

    {/* Explanation from question object (pre-stored) */}
    {Boolean(aiExplanationEnabled) && !showExplanation && !isGeneratingExplanation && question.explanation && (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mt-3 p-4 rounded-2xl bg-gradient-to-br from-blue-900/50 to-indigo-900/50 border border-blue-500/30 backdrop-blur-sm"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🧠</span>
          <h4 className="text-base font-bold text-blue-300">AI Explanation</h4>
        </div>
        <div className="text-sm text-blue-100 leading-relaxed whitespace-pre-wrap">
          {normalizeExplanation(question.explanation)}
        </div>
        <p className="text-xs text-blue-400/60 mt-2 italic">AI generated · for learning purposes</p>
      </motion.div>
    )}
  </motion.div>
</>
          )}
        </div>
      </CardContent>
    </Card>
    </div>
  );
}
