
import React from "react";
import { useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Wifi, RefreshCw, Users } from "lucide-react";

import { Player } from "@/types";

interface GameHeaderProps {
  connectionStatus: "connected" | "connecting" | "disconnected";
  onRefresh: () => void;
  name?: string;
  avatarUrl?: string;
  isWarningSoundEnabled: boolean;
  setIsWarningSoundEnabled: (enabled: boolean) => void;
  players?: Player[];
}

const GameHeader: React.FC<GameHeaderProps> = ({ connectionStatus, onRefresh, isWarningSoundEnabled, setIsWarningSoundEnabled, players }) => {
  return (
    <header className="bg-white/10 dark:bg-gray-900/60 shadow backdrop-blur-md">
      <div className="container mx-auto p-4 flex justify-between items-center">
        <Logo />
        
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2 bg-gray-800 bg-opacity-75 p-2 rounded-lg shadow-lg">
            {players && (
              <div className="flex items-center gap-1 text-white text-xs">
                <Users size={16} className="text-blue-400" />
                <span>{players.length} Players</span>
              </div>
            )}
          </div>
          <div 
            className="flex items-center gap-1 cursor-pointer bg-black/20 px-2 py-1 rounded-md hover:bg-black/30 transition-colors" 
            onClick={onRefresh}
          >
            {connectionStatus === "connected" ? (
              <Wifi size={16} className="text-green-400" />
            ) : (
              <RefreshCw size={16} className="text-amber-400 animate-spin" />
            )}
            <span className="text-xs text-white">
              {connectionStatus === "connected" ? "Live" : "Updating..."}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default GameHeader;
