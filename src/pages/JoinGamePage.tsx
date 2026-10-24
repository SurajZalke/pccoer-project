
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import Logo from "@/components/Logo";
import BackgroundContainer from "@/components/BackgroundContainer";
import { lazy, Suspense } from "react";
const CreatorAttribution = lazy(() => import("@/components/CreatorAttribution"));
import PlayerJoinForm from "@/components/PlayerJoinForm";

const JoinGamePage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [gameCode, setGameCode] = useState<string | null>(null);

  useEffect(() => {
    // Get the game code from URL parameters
    const code = searchParams.get("code");
    if (code) {
      setGameCode(code);
      toast({
        title: "Game code detected",
        description: `The game code ${code} has been automatically filled in`,
      });
    }
  }, [searchParams, toast]);

  return (
    <BackgroundContainer>
      <div className="min-h-screen flex flex-col">
        <header className="bg-white/10 dark:bg-gray-900/60 shadow backdrop-blur-md">
          <div className="container mx-auto p-4 flex justify-between items-center">
            <Logo />
          </div>
        </header>

        <main className="container mx-auto p-4 py-8 flex-1 flex flex-col items-center justify-center">
          <div className="w-full max-w-lg mx-auto">
            <Card className="shadow-lg bg-white/5 backdrop-blur-md border-purple-500/20 mb-8">
              <CardContent className="p-6">
                <div className="text-center">
                  <h1 className="text-3xl font-bold mb-2 text-white">Join Game</h1>
                  {gameCode && (
                    <p className="mb-6 text-gray-300">
                      You're joining a game with code: <strong className="text-indigo-400">{gameCode}</strong>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
            <PlayerJoinForm initialGameCode={gameCode} />
          </div>
        </main>
        <Suspense fallback={<div></div>}>
          <CreatorAttribution />
        </Suspense>
      </div>
    </BackgroundContainer>
  );
};

export default JoinGamePage;
