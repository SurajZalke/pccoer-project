import React from "react";
import { Trophy, Award, Medal } from "lucide-react";
import { Player } from "@/types";

// Animation styles for winners (trophy bounce, glow etc)
const winnerStyles = [
  "animate-bounce shadow-xl border-yellow-400",
  "animate-pulse shadow-lg border-gray-400",
  "animate-wiggle shadow-md border-amber-400",
];

const icons = [
  <Trophy size={40} className="text-yellow-400 drop-shadow-glow" />,
  <Award size={32} className="text-gray-400" />,
  <Medal size={28} className="text-amber-500" />,
];

interface TrophyAnimationProps {
  winners: Player[];
}

// Keyframes for cool custom winner animation (add wiggle in tailwind config if you like)
const TrophyAnimation: React.FC<TrophyAnimationProps> = ({ winners }) => {
  return (
    <div className="flex items-end justify-center gap-8 my-8">
      {winners.map((player, idx) => (
        <div
          key={player.id}
          className={`flex flex-col items-center ${winnerStyles[idx] || ""} border-2 rounded-lg p-3 bg-white dark:bg-gray-800`}
          style={{ zIndex: 3 - idx }}
        >
          <div className="flex items-center justify-center gap-2">
            {player.avatar ? (
              <img src={player.avatar} alt="Player Avatar" className="w-8 h-8 rounded-full" />
            ) : (
              <img src={`https://api.dicebear.com/7.x/fun-emoji/svg?seed=${player.nickname}`} alt="Player Avatar" className="w-8 h-8 rounded-full" />
            )}
            <span className="text-xl font-bold text-quiz-primary drop-shadow-lg">{player.nickname}</span>
          </div>
          <span className="text-sm text-gray-600">Score: {player.score}</span>
          <div className="mt-1 text-xs text-gray-400 font-semibold">{["1st", "2nd", "3rd"][idx]}</div>
        </div>
      ))}
    </div>
  );
};

export default TrophyAnimation;
