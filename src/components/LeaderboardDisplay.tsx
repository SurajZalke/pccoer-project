import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Player, Quiz } from "@/types";
import { Progress } from '@/components/ui/progress';

interface LeaderboardDisplayProps {
  players: Player[];
  activeQuiz?: Quiz;
  showScores?: boolean;
  hasHostSubmitted?: boolean;
}

const LeaderboardDisplay: React.FC<LeaderboardDisplayProps> = ({ 
  players, 
  activeQuiz, 
  showScores = false, 
  hasHostSubmitted = false 
}) => {
  // Track previous order for animation
  const [prevOrder, setPrevOrder] = useState<string[]>([]);
  const [animateRows, setAnimateRows] = useState<{[id: string]: 'up'|'down'|null}>({});
  const prevPlayersRef = useRef<Player[]>(players);

  // Extend Player with isHost for local use
  type PlayerWithHost = Player & { isHost: boolean };
  const allPlayers: PlayerWithHost[] = players.map(player => ({
    ...player,
    isHost: player.player_id === activeQuiz?.createdBy
  }));
  const sortedPlayers = [...allPlayers].sort((a, b) => {
    // Primary sort by score (descending)
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    // Secondary sort by average time to answer (ascending) if scores are equal
    // Calculate average time for player a
    const aCorrectAnswers = a.answers?.filter(ans => ans.correct) || [];
    const aTotalTime = aCorrectAnswers.reduce((sum, ans) => sum + ans.timeToAnswer, 0);
    const aAvgTime = aCorrectAnswers.length > 0 ? aTotalTime / aCorrectAnswers.length : Infinity;

    // Calculate average time for player b
    const bCorrectAnswers = b.answers?.filter(ans => ans.correct) || [];
    const bTotalTime = bCorrectAnswers.reduce((sum, ans) => sum + ans.timeToAnswer, 0);
    const bAvgTime = bCorrectAnswers.length > 0 ? bTotalTime / bCorrectAnswers.length : Infinity;

    return aAvgTime - bAvgTime;
  });

  // Animation logic: compare previous and current order
  useEffect(() => {
    const newOrder = sortedPlayers.map(p => p.player_id);
    const anim: {[id: string]: 'up'|'down'|null} = {};
    if (prevOrder.length > 0) {
      newOrder.forEach((id, idx) => {
        const prevIdx = prevOrder.indexOf(id);
        if (prevIdx !== -1) {
          if (prevIdx > idx) anim[id] = 'up';
          else if (prevIdx < idx) anim[id] = 'down';
          else anim[id] = null;
        } else {
          anim[id] = null;
        }
      });
      setAnimateRows(anim);
      // Remove animation after 1s
      setTimeout(() => setAnimateRows({}), 1000);
    }
    setPrevOrder(newOrder);
    prevPlayersRef.current = players;
  }, [players, showScores, hasHostSubmitted]);

  // Helper: check for 3+ correct answers in a row (streak)
  const getStreak = (player: Player) => {
    if (!player.answers || player.answers.length < 3) return 0;
    let streak = 0;
    for (let i = player.answers.length - 1; i >= 0; i--) {
      if (player.answers[i].correct) streak++;
      else break;
    }
    return streak;
  };

  const getRankIcon = (index: number) => {
    switch(index) {
      case 0:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" 
               className="w-6 h-6 text-yellow-500">
            <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
          </svg>
        );
      case 1:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" 
               className="w-6 h-6 text-gray-400">
            <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
          </svg>
        );
      case 2:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" 
               className="w-6 h-6 text-amber-500">
            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
          </svg>
        );
      case 3:
      case 4:
      case 5:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" 
               className="w-5 h-5 text-blue-400">
            <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-1.007.607-2.295-.217-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.007z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null; // Or a default icon for ranks beyond 6 if desired
    }
  };

  const getBackgroundClass = (index: number) => {
    switch(index) {
      case 0:
        return 'bg-[#2a3356] border-[#2a3356] hover:bg-[#323c64]';
      case 1:
        return 'bg-[#2a3356] border-[#2a3356] hover:bg-[#323c64]';
      case 2:
        return 'bg-[#2a3356] border-[#2a3356] hover:bg-[#323c64]';
      default:
        return 'bg-[#2a3356] border-[#2a3356] hover:bg-[#323c64]';
    }
  };

  const markingType = activeQuiz
    ? activeQuiz.hasNegativeMarking
      ? `Negative Marking: -${activeQuiz.negativeMarkingValue}%`
      : "Simple Marking"
    : undefined;

  // Only show/animate leaderboard when scores are revealed
  const shouldShowLeaderboard = showScores && hasHostSubmitted;

  // Store the last revealed sortedPlayers and scores for freezing
  const [frozenPlayers, setFrozenPlayers] = useState<Player[]>([]);
  const [frozenScores, setFrozenScores] = useState<number[]>([]);
  const hasFrozenRef = useRef(false);

  useEffect(() => {
    if (shouldShowLeaderboard && !hasFrozenRef.current) {
      setFrozenPlayers(sortedPlayers);
      setFrozenScores(sortedPlayers.map(p => p.score));
      hasFrozenRef.current = true;
    }
    if (!shouldShowLeaderboard) {
      hasFrozenRef.current = false;
    }
  }, [shouldShowLeaderboard, sortedPlayers]);

  // Helper for up/down arrow
  const getMoveArrow = (animate: 'up' | 'down' | null) => {
    if (animate === 'up') {
      return (
        <span className="ml-2 animate-arrow-crazy">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 20V4M12 4l-5 5M12 4l5 5" stroke="#00e6e6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
      );
    }
    if (animate === 'down') {
      return (
        <span className="ml-2 animate-arrow-down">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 4v16M12 20l-5-5M12 20l5-5" stroke="#ff4d4d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
      );
    }
    return null;
  };

  // --- Polling logic for host: count answers for each option ---
  // (Removed from leaderboard, will be moved to QuestionDisplay)

  // Use frozenPlayers/frozenScores if not revealed, else live sortedPlayers
  const displayPlayers = shouldShowLeaderboard ? sortedPlayers : frozenPlayers;
  const displayScores = shouldShowLeaderboard ? sortedPlayers.map(p => p.score) : frozenScores;

  return (
    <Card className="quiz-card p-0 border border-glow-purple/30 shadow-glow-purple rounded-2xl bg-white/90 dark:bg-gray-900/80 max-w-full md:max-w-2xl mx-auto px-2 sm:px-4">
      <CardHeader className="bg-[#232b4a] dark:bg-[#232b4a] rounded-t-2xl px-6 py-4 border-b border-glow-purple/20">
        <CardTitle className="text-3xl font-extrabold text-white text-center">Leaderboard</CardTitle>
        {markingType && (
          <div className="text-xs text-gray-300 mt-1 text-center font-medium">
            {markingType}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-[#2a3356]">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Rank</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Player</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {displayPlayers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-gray-300 py-8 text-lg">No players yet</td>
                </tr>
              ) : (
                displayPlayers.map((player, index) => {
                  // Cast player to PlayerWithHost to access isHost
                  const playerWithHost = player as Player & { isHost?: boolean };
                  const streak = getStreak(playerWithHost);
                  const animate = shouldShowLeaderboard ? animateRows[playerWithHost.player_id] : null;
                  let streakNameClass = '';
                  let streakBadge = null;
                  let streakEffect = null;
                  // Streak logic: show count and label only, no emoji
                  if (shouldShowLeaderboard && streak >= 7) {
                    streakNameClass = 'text-yellow-400 font-extrabold';
                    streakBadge = (
                      <span className="ml-2 px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold border border-yellow-300">Golden {streak}x</span>
                    );
                  } else if (shouldShowLeaderboard && streak >= 10) {
                    streakNameClass = 'text-purple-400 font-extrabold';
                    streakBadge = (
                      <span className="ml-2 px-2 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-bold border border-purple-300">Grandmaster {streak}x</span>
                    );
                  } else if (shouldShowLeaderboard && streak >= 5) {
                    streakNameClass = 'text-blue-400 font-bold';
                    streakBadge = (
                      <span className="ml-2 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold border border-blue-300">Platinum {streak}x</span>
                    );
                  } else if (shouldShowLeaderboard && streak >= 3) {
                    streakNameClass = 'text-gray-300 font-bold';
                    streakBadge = (
                      <span className="ml-2 px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-bold border border-gray-300">Silver {streak}x</span>
                    );
                  }
                  streakEffect = null;
                  const rowAnim = shouldShowLeaderboard ? `animate-leaderboard-row-in animate-delay-${index}` : '';
                  const topGlow = shouldShowLeaderboard && index < 3 ? `leaderboard-top-glow leaderboard-top-glow-${index}` : '';
                  const shimmer = shouldShowLeaderboard && index === 0 ? 'leaderboard-shimmer' : '';
                  return (
                    <tr
                      key={playerWithHost.player_id}
                      className={`bg-[#232b4a] hover:bg-[#323c64] transition-all duration-500 ${rowAnim} ${topGlow} ${shimmer}`}
                    >
                      <td className="px-6 py-4 font-bold text-lg text-indigo-300 align-middle">{index + 1}</td>
                      <td className="px-6 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-9 h-9 border-2 border-gray-700 shadow-sm">
                            <AvatarImage src={playerWithHost.avatar || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${playerWithHost.nickname}`} />
                            <AvatarFallback className="bg-gradient-to-br from-purple-400 to-pink-400 text-white">
                              {typeof playerWithHost.nickname === 'string' && playerWithHost.nickname.length > 0 
                                ? playerWithHost.nickname.charAt(0).toUpperCase() 
                                : '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span className={`font-semibold text-gray-200 transition-all duration-500 ${streakNameClass}`}>{playerWithHost.nickname}</span>
                          {streakBadge}
                          {streakEffect}
                          {getRankIcon(index)}
                          {playerWithHost.isHost && (
                            <span className="text-xs bg-purple-700 text-white px-3 py-1 rounded-full font-medium ml-2">Host</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-middle font-bold text-gray-200 text-lg">{displayScores[index]}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

// Add CSS for exclusive streak animations
// .animate-streak-three { animation: streakThree 1.3s cubic-bezier(.68,-0.55,.27,1.55); }
// .text-rainbow { background: linear-gradient(90deg, #FFD700, #FF69B4, #00E6E6, #FFD700); background-size: 200% 200%; -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-shadow: 0 0 16px #FFD700, 0 0 32px #FF69B4; animation: rainbowText 2s linear infinite alternate; }
// .animate-crown-pop { animation: crownPop 1.3s cubic-bezier(.68,-0.55,.27,1.55); }
// .animate-stick-pop { animation: stickPop 1.1s cubic-bezier(.68,-0.55,.27,1.55); }
// .animate-fire-burst { animation: fireBurst 1.1s cubic-bezier(.68,-0.55,.27,1.55); }
// @keyframes streakThree { 0% { transform: scale(1); } 30% { transform: scale(1.18) rotate(-8deg); } 60% { transform: scale(0.97) rotate(4deg); } 100% { transform: scale(1); } }
// @keyframes rainbowText { 0% { background-position: 0% 50%; } 100% { background-position: 100% 50%; } }
// @keyframes crownPop { 0% { transform: scale(0.5) rotate(-20deg); opacity: 0; } 80% { transform: scale(1.4) rotate(10deg); opacity: 1; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
// @keyframes stickPop { 0% { transform: scale(0.7) rotate(-10deg); opacity: 0; } 80% { transform: scale(1.2) rotate(8deg); opacity: 1; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
// @keyframes fireBurst { 0% { transform: scale(0.7) rotate(-10deg); opacity: 0; } 80% { transform: scale(1.2) rotate(8deg); opacity: 1; } 100% { transform: scale(1) rotate(0); opacity: 1; } }

export default LeaderboardDisplay;
