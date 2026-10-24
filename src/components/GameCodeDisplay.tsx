
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { use3DTilt } from "@/utils/animationUtils";
import { Sparkles, Star, Copy, CheckCircle, QrCode } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import confetti from 'canvas-confetti';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"; 

interface GameCodeDisplayProps {
  code: string;
  playerCount: number;
  className?: string;
}

const GameCodeDisplay: React.FC<GameCodeDisplayProps> = ({ code, playerCount }) => {
  const { cardRef, handleMouseMove, resetTilt } = use3DTilt(25);
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const triggerConfetti = () => {
    const duration = 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.65 },
        colors: ['#9333ea', '#6366f1', '#4f46e5']
      });
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.65 },
        colors: ['#9333ea', '#6366f1', '#4f46e5']
      });
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  const handleCopy = async (text: string, successMessage: string, errorMessage: string) => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        throw new Error("Clipboard API not available or not in a secure context.");
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      triggerConfetti();
      toast({
        title: "Copied!",
        description: successMessage,
        duration: 2000,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(errorMessage, err);
      toast({
        title: "Error",
        description: `${errorMessage}: ${(err as Error).message}`,
        variant: "destructive",
      });
    }
  };

  const copyCodeToClipboard = () => handleCopy(code, "Game code copied to clipboard", "Failed to copy game code");

  // Generate QR code URL using a free service
  const joinLink = `${window.location.origin}/join?code=${code}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${joinLink}`;

  const shareJoinLink = async () => {
    const shareData = {
      title: 'Join My Quiz Game!',
      text: `Come join my quiz game! Use code ${code} or click the link:`, 
      url: joinLink,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast({
          title: "Shared!",
          description: "Join link shared successfully",
          duration: 2000,
        });
      } else {
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareData.title + '\n' + shareData.text + ' ' + shareData.url)}`;
        window.open(whatsappUrl, '_blank');
        toast({
          title: "Opened WhatsApp!",
          description: "Please share the link manually",
          duration: 2000,
        });
      }
    } catch (err) {
      console.error("Failed to share join link:", err);
      toast({
        title: "Error",
        description: `Failed to share join link: ${(err as Error).message}`,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Card
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={resetTilt}
        className="quiz-card text-center transition-all duration-300 hover:shadow-xl transform hover:scale-[1.02] glow-border glass-dark attractive-glow gradient-animated-bg"
        style={{ position: "relative", overflow: "hidden" }}
      >
        <div className="absolute left-4 top-4 glowing-dot animate-float" />
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Star size={36} strokeWidth={2.2} color="#b09cff" className="animate-pulse-scale drop-shadow-lg" />
            <h3 className="text-lg font-medium gradient-heading">Game Code</h3>
            <Sparkles size={28} color="#F97316" className="animate-fade-in" />
          </div>
          <div 
            className="text-4xl font-bold tracking-wider mt-2 text-quiz-primary animate-pulse-scale select-all cursor-pointer flex items-center justify-center gap-2 bg-indigo-900/20 py-2 px-4 rounded-lg"
            onClick={copyCodeToClipboard}
          >
            {code.split('').map((char, idx) => (
              <span 
                key={idx} 
                className="inline-block"
                style={{ 
                  animationDelay: `${idx * 0.2}s`,
                  animation: 'scale-in 0.5s ease-out forwards'
                }}
              >
                {char}
              </span>
            ))}
            
            {copied ? (
              <CheckCircle size={20} className="text-green-500" />
            ) : (
              <Copy size={20} className="text-gray-400 hover:text-white transition-colors" />
            )}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-300">Click to copy</p>
          <div className="border-t border-gray-300 dark:border-glow-purple/30 pt-4">
            <h3 className="text-lg font-medium text-gray-700 dark:text-purple-200">Players Joined</h3>
            <div className="text-3xl font-bold mt-2 text-quiz-secondary animate-float flex justify-center items-center gap-2">
              {playerCount}
              <span className="glowing-dot" />
            </div>
          </div>
          <div className="flex justify-center gap-2 mt-3">
            <Button
              onClick={shareJoinLink}
              className="quiz-btn-primary animate-pulse-scale"
            >
              Share Join Link
            </Button>
          </div>
          <Button 
            variant="outline" 
            className="bg-white/10 hover:bg-white/20 border-white/20 gap-2"
            onClick={() => setShowQR(true)}
          >
            <QrCode size={16} />
            <span>Show QR Code</span>
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle>Scan to Join the Game</DialogTitle>
          </DialogHeader>
          <div className="p-6 flex flex-col items-center gap-4">
            <div className="bg-white p-2 rounded-lg shadow-inner">
              <img 
                src={qrCodeUrl} 
                alt="QR Code to join game" 
                className="w-64 h-64 mx-auto animate-fade-in" 
              />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Scan this QR code with your phone camera to join the game
            </p>
            <p className="font-mono text-lg font-bold text-indigo-600 dark:text-indigo-400">
              {code}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GameCodeDisplay;
