import React, { useState, useEffect, useRef } from 'react';
import { useAIAnalysis } from '@/contexts/AIAnalysisContext';
import { Button } from '@/components/ui/button';
import { X, ChevronUp, ChevronDown, Loader2, Send, Sparkles, Zap, Shield, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { animationClasses, animationPresets } from '@/utils/animations';

interface EnhancedAIWidgetProps {
  className?: string;
}

const EnhancedAIWidget: React.FC<EnhancedAIWidgetProps> = ({ className }) => {
  const { isAnalyzing, analysisResult, error, analyzeCurrentPage, isAnalysisVisible, toggleAnalysisVisibility, askAIQuestion, isProcessingQuestion, aiName } = useAIAnalysis();
  const [isMinimized, setIsMinimized] = useState(true);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState<{question: string, answer: string}[]>([]);
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [answers]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (widgetRef.current) {
      setIsDragging(true);
      const rect = widgetRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleAskQuestion = async () => {
    if (!question.trim()) return;

    setIsAskingQuestion(true);
    const userQuestion = question;
    setQuestion('');

    try {
      const answer = await askAIQuestion(userQuestion);
      setAnswers([...answers, { question: userQuestion, answer }]);
    } catch (err) {
      console.error('Error asking question:', err);
      setAnswers([...answers, { question: userQuestion, answer: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsAskingQuestion(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAskQuestion();
    }
  };

  return (
    <div
      ref={widgetRef}
      className={cn(
        'fixed z-50 rounded-lg shadow-2xl transition-all duration-300',
        isMinimized ? 'w-16 h-16' : 'w-96 h-[600px]',
        animationClasses.fadeIn,
        className
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
    >
      {/* Widget Container */}
      <div className={cn(
        'w-full h-full bg-gradient-to-br from-blue-600 via-blue-500 to-purple-600 rounded-lg flex flex-col overflow-hidden',
        'border border-blue-400/30 backdrop-blur-sm',
        !isMinimized && animationClasses.scaleIn
      )}>
        {/* Header */}
        <div
          className={cn(
            'bg-gradient-to-r from-blue-700 to-purple-700 p-4 flex items-center justify-between cursor-move',
            'border-b border-blue-400/30 hover:shadow-lg transition-shadow'
          )}
          onMouseDown={handleMouseDown}
        >
          <div className='flex items-center gap-2'>
            <div className={cn(
              'p-2 bg-white/20 rounded-lg',
              animationClasses.pulse
            )}>
              <Sparkles className='w-5 h-5 text-white' />
            </div>
            <span className='text-white font-bold text-sm'>{aiName}</span>
          </div>

          <div className='flex items-center gap-2'>
            <Button
              size='sm'
              variant='ghost'
              onClick={() => setIsMinimized(!isMinimized)}
              className='text-white hover:bg-white/20 h-8 w-8 p-0'
            >
              {isMinimized ? <ChevronUp className='w-4 h-4' /> : <ChevronDown className='w-4 h-4' />}
            </Button>
            <Button
              size='sm'
              variant='ghost'
              onClick={() => {
                setIsMinimized(true);
                setAnswers([]);
              }}
              className='text-white hover:bg-white/20 h-8 w-8 p-0'
            >
              <X className='w-4 h-4' />
            </Button>
          </div>
        </div>

        {/* Content */}
        {!isMinimized && (
          <div className={cn(
            'flex-1 flex flex-col overflow-hidden',
            animationClasses.fadeIn
          )}>
            {/* Messages Area */}
            <div className='flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-blue-50/10 to-purple-50/10'>
              {answers.length === 0 && !isAnalyzing && (
                <div className={cn(
                  'flex flex-col items-center justify-center h-full text-center',
                  animationClasses.fadeInUp
                )}>
                  <div className={cn(
                    'p-4 bg-white/10 rounded-full mb-4',
                    animationClasses.bounce
                  )}>
                    <MessageCircle className='w-8 h-8 text-white' />
                  </div>
                  <p className='text-white/80 text-sm font-medium'>Ask me anything!</p>
                  <p className='text-white/60 text-xs mt-1'>I'm here to help</p>
                </div>
              )}

              {/* Analysis Result */}
              {isAnalyzing && (
                <div className={cn(
                  'flex items-center gap-3 p-4 bg-white/10 rounded-lg',
                  animationClasses.fadeIn
                )}>
                  <Loader2 className={cn('w-5 h-5 text-white', animationClasses.spin)} />
                  <span className='text-white text-sm'>Analyzing page...</span>
                </div>
              )}

              {analysisResult && (
                <div className={cn(
                  'p-4 bg-white/15 rounded-lg border border-white/20',
                  animationClasses.fadeInUp
                )}>
                  <p className='text-white/90 text-sm leading-relaxed'>{analysisResult}</p>
                </div>
              )}

              {error && (
                <div className={cn(
                  'p-4 bg-red-500/20 rounded-lg border border-red-400/30',
                  animationClasses.fadeInUp
                )}>
                  <p className='text-red-100 text-sm'>{error}</p>
                </div>
              )}

              {/* Chat Messages */}
              {answers.map((item, index) => (
                <div
                  key={index}
                  className={cn(
                    'space-y-2',
                    animationClasses.fadeInUp
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* User Question */}
                  <div className='flex justify-end'>
                    <div className={cn(
                      'max-w-xs p-3 bg-blue-700/60 rounded-lg text-white text-sm',
                      'border border-blue-400/30'
                    )}>
                      {item.question}
                    </div>
                  </div>

                  {/* AI Answer */}
                  <div className='flex justify-start'>
                    <div className={cn(
                      'max-w-xs p-3 bg-white/15 rounded-lg text-white text-sm',
                      'border border-white/20'
                    )}>
                      {item.answer}
                    </div>
                  </div>
                </div>
              ))}

              {isProcessingQuestion && (
                <div className={cn(
                  'flex items-center gap-2 p-3 bg-white/10 rounded-lg',
                  animationClasses.fadeIn
                )}>
                  <Loader2 className={cn('w-4 h-4 text-white', animationClasses.spin)} />
                  <span className='text-white text-sm'>Thinking...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className='p-4 border-t border-white/20 bg-gradient-to-t from-blue-700/50 to-transparent'>
              <div className='flex gap-2'>
                <input
                  type='text'
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder='Ask a question...'
                  disabled={isProcessingQuestion}
                  className={cn(
                    'flex-1 px-3 py-2 bg-white/20 text-white placeholder-white/50',
                    'rounded-lg border border-white/30 focus:outline-none focus:border-white/50',
                    'transition-colors disabled:opacity-50'
                  )}
                />
                <Button
                  onClick={handleAskQuestion}
                  disabled={isProcessingQuestion || !question.trim()}
                  className={cn(
                    'bg-white/20 hover:bg-white/30 text-white h-10 w-10 p-0',
                    'border border-white/30 transition-all',
                    animationClasses.scaleUp
                  )}
                >
                  <Send className='w-4 h-4' />
                </Button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className='p-3 border-t border-white/20 flex gap-2'>
              <Button
                onClick={analyzeCurrentPage}
                disabled={isAnalyzing}
                className={cn(
                  'flex-1 bg-white/20 hover:bg-white/30 text-white text-xs',
                  'border border-white/30 transition-all',
                  animationClasses.scaleUp
                )}
              >
                <Zap className='w-3 h-3 mr-1' />
                Analyze Page
              </Button>
              <Button
                onClick={toggleAnalysisVisibility}
                className={cn(
                  'flex-1 bg-white/20 hover:bg-white/30 text-white text-xs',
                  'border border-white/30 transition-all',
                  animationClasses.scaleUp
                )}
              >
                <Shield className='w-3 h-3 mr-1' />
                {isAnalysisVisible ? 'Hide' : 'Show'}
              </Button>
            </div>
          </div>
        )}

        {/* Minimized State */}
        {isMinimized && (
          <button
            onClick={() => setIsMinimized(false)}
            className={cn(
              'w-full h-full flex items-center justify-center',
              'hover:shadow-lg transition-all',
              animationClasses.pulse
            )}
          >
            <Sparkles className='w-6 h-6 text-white' />
          </button>
        )}
      </div>
    </div>
  );
};

export default EnhancedAIWidget;
