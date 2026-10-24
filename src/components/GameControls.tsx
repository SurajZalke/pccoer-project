
import React from "react";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { toast } from "sonner";

interface GameControlsProps {
  onStartGame: () => void;
  onEndGame: () => void;
  onNextQuestion: () => void;
  showStart?: boolean;
  showNext?: boolean;
  disabled?: boolean;
  disableNextButton?: boolean;
  nextButtonText?: string;
}

const GameControls: React.FC<GameControlsProps> = ({
  onStartGame,
  onEndGame,
  onNextQuestion,
  showStart = false,
  showNext = false,
  disabled = false,
  disableNextButton = false,
  nextButtonText = "Next Question"
}) => {
  const handleEndGame = async () => {
    try {
      await onEndGame();
      toast.success("Quiz ended successfully");
    } catch (error: any) {
      console.error("Error ending game:", error);
      toast.error("Failed to end quiz: " + (error?.message || "Unknown error"));
    }
  };

  const handleNextQuestion = async () => {
    try {
      await onNextQuestion();
    } catch (error: any) {
      console.error("Error moving to next question:", error);
      toast.error("Failed to move to next question: " + (error?.message || "Unknown error"));
    }
  };

  const handleStartGame = async () => {
    try {
      await onStartGame();
      toast.success("Quiz started!");
    } catch (error: any) {
      console.error("Error starting game:", error);
      toast.error("Failed to start quiz: " + (error?.message || "Unknown error"));
    }
  };

  return (
    <div className="flex justify-between items-center mb-6">
      {showStart && (
        <Button 
          className="quiz-btn-primary"
          onClick={handleStartGame}
          disabled={disabled}
        >
          <Clock className="h-4 w-4 mr-2" />
          Start Quiz
        </Button>
      )}
      
      {showNext && (
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={handleEndGame}
            className="hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
          >
            End Quiz
          </Button>
          <Button 
            className="quiz-btn-primary animate-pulse-scale"
            onClick={handleNextQuestion}
            disabled={disabled || disableNextButton}
          >
            {nextButtonText}
          </Button>
        </div>
      )}
    </div>
  );
};

export default GameControls;
