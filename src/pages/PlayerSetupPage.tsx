import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { database } from '@/lib/firebaseConfig';
import { ref, get, update } from 'firebase/database';
import { avatars } from '@/utils/avatars';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import VIPAdminEntryAnimation from '@/components/VIPAdminEntryAnimation';
import { VIP_ADMIN_ROLL, VIP_ADMIN_NAME, isVIPRoll, lookupPlayer, broadcastVIPJoin } from '@/utils/vipAdmin';
import { AvatarSection } from '@/components/AvatarSection';
import { Save } from 'lucide-react';
const PlayerSetupPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [classId, setClassId] = useState<string>('');
  const [rollNo, setRollNo] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [quizAudienceType, setQuizAudienceType] = useState<'college' | 'classes' | null>(null);

  const [showVIPAnimation, setShowVIPAnimation] = useState(false);
  const [isVIP, setIsVIP] = useState(false);
  const vipShownOnSubmit = useRef(false);

  // Detect VIP roll number as user types
  useEffect(() => {
    if (isVIPRoll(rollNo)) {
      setIsVIP(true);
      // Auto-select first avatar for VIP if none selected
      if (!selectedAvatar && avatars.length > 0) {
        setSelectedAvatar(avatars[0]);
      }
    } else {
      setIsVIP(false);
    }
  }, [rollNo]);

  useEffect(() => {
    const fetchGameData = async () => {
      if (location.state && location.state.gameId) {
        setGameId(location.state.gameId);
        setPlayerId(location.state.playerId);
        const { avatarUrl, rollNo: initialRollNo } = location.state;
        if (avatarUrl) {
          setSelectedAvatar(avatarUrl);
        }
        if (initialRollNo) {
          setRollNo(initialRollNo);
        }

        try {
          const gameRef = ref(database, `games/${location.state.gameId}`);
          const snapshot = await get(gameRef);
          if (snapshot.exists()) {
            const gameData = snapshot.val();
            setQuizAudienceType(gameData.quizAudienceType || 'classes');
          } else {
            toast({ title: "Error", description: "Game not found.", variant: "destructive" });
            navigate('/join');
          }
        } catch (error) {
          console.error("Error fetching game data:", error);
          toast({ title: "Error", description: "Failed to fetch game data.", variant: "destructive" });
          navigate('/join');
        }
      } else {
        toast({ title: "Error", description: "Game or player information not found.", variant: "destructive" });
        navigate('/join');
      }
    };

    fetchGameData();
  }, [location.state, navigate, toast]);

  const handleAvatarSelect = (avatar: string) => {
    setSelectedAvatar(avatar);
  };

  const fetchPlayerName = useCallback(async (currentRollNo: string) => {
    // Use centralized lookup — VIP is handled without DB call
    const result = await lookupPlayer(currentRollNo);
    if (result) {
      setPlayerName(result.name);
      setClassId(result.classId);
      return result;
    }
    setPlayerName('');
    setClassId('');
    return null;
  }, []);

  useEffect(() => {
    if (rollNo && rollNo.length === 6) {
      fetchPlayerName(rollNo);
    } else {
      setPlayerName('');
      setClassId('');
    }
  }, [rollNo, fetchPlayerName]);

  const handleSaveAvatar = async () => {
    if (!gameId || !playerId || !selectedAvatar || !rollNo) {
      toast({ title: "Error", description: "Missing information, or no avatar selected.", variant: "destructive" });
      return;
    }

    // Show VIP animation before joining if VIP roll number
    if (rollNo === VIP_ADMIN_ROLL && !vipShownOnSubmit.current) {
      vipShownOnSubmit.current = true;
      setShowVIPAnimation(true);
      // Proceed with saving after animation starts (don't block)
    }

    try {
      const gameRef = ref(database, `games/${gameId}`);
      const gameSnapshot = await get(gameRef);

      if (gameSnapshot.exists()) {
        const result = await fetchPlayerName(rollNo);
        if (!result) {
          toast({ title: "Error", description: "Roll number not found.", variant: "destructive" });
          return;
        }

        const { name: fetchedName, classId: fetchedClassId } = result;
        const gameData = gameSnapshot.val();
        const players = gameData.players || {};

        if (players[playerId]) {
          players[playerId].avatar = selectedAvatar;
          // For VIP, always use the canonical VIP_ADMIN_NAME
          const displayName = isVIPRoll(rollNo) ? VIP_ADMIN_NAME : fetchedName;
          players[playerId].name = displayName;
          players[playerId].nickname = displayName;
          players[playerId].rollNo = rollNo;
          players[playerId].classId = fetchedClassId;
          if (isVIPRoll(rollNo)) {
            players[playerId].isVIP = true;
          }
          await update(gameRef, { [`players/${playerId}`]: players[playerId] });
        } else {
          throw new Error("Player not found in game.");
        }
      } else {
        throw new Error("Game not found.");
      }

      toast({ title: "✅ Joined!", description: "Avatar saved. Entering the arena..." });

      if (isVIPRoll(rollNo)) {
        // Broadcast to ALL connected screens — pass playerId so nickname gets updated too
        await broadcastVIPJoin(gameId, playerId);
        // Navigate after animation (4 seconds)
        setTimeout(() => {
          navigate(`/game-room?gameId=${gameId}&playerId=${playerId}`);
        }, 4200);
      } else {
        navigate(`/game-room?gameId=${gameId}&playerId=${playerId}`);
      }
    } catch (error) {
      console.error("Error saving avatar:", error);
      toast({ title: "Error", description: "Failed to save avatar. Please try again.", variant: "destructive" });
    }
  };

  if (!gameId || !playerId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-900 flex items-center justify-center p-4">
        <p className="text-white text-xl">Loading player data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-900 flex items-center justify-center p-4">
      {/* VIP Admin Entry Animation */}
      <VIPAdminEntryAnimation
        show={showVIPAnimation}
        adminNickname={VIP_ADMIN_NAME}
        onDone={() => setShowVIPAnimation(false)}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`bg-gray-800 bg-opacity-70 backdrop-filter backdrop-blur-lg rounded-xl shadow-2xl p-8 w-full max-w-md border transition-all duration-500 ${
          isVIP
            ? 'border-yellow-400 shadow-yellow-400/40 shadow-2xl'
            : 'border-gray-700'
        }`}
      >
        {/* VIP crown header */}
        <AnimatePresence>
          {isVIP && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className="text-center mb-4"
            >
              <div className="text-5xl mb-1" style={{ filter: 'drop-shadow(0 0 16px #FFD700)' }}>👑</div>
              <div
                className="text-lg font-black tracking-widest"
                style={{
                  background: 'linear-gradient(90deg, #FFD700, #FF69B4, #a855f7, #FFD700)',
                  backgroundSize: '200% 100%',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: 'shimmerBg 2s linear infinite',
                }}
              >
                ⚡ VIP ADMIN DETECTED ⚡
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <h2 className="text-3xl font-bold text-white text-center mb-6">
          {isVIP ? '🎯 Enter The Arena' : 'Enter Details & Select Avatar'}
        </h2>

        {/* Roll number input */}
        <div className="mb-4">
          <div className="relative">
            <Input
              type="text"
              placeholder="Enter your 6-digit Roll Number"
              value={rollNo}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').substring(0, 6);
                setRollNo(val);
              }}
              className={`w-full p-3 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-300 shadow-md text-center text-xl tracking-widest ${
                isVIP
                  ? 'border-2 border-yellow-400 bg-gradient-to-r from-yellow-900/40 to-purple-900/40 ring-2 ring-yellow-400/60 text-yellow-200'
                  : 'border border-gray-700 bg-gray-800 focus:ring-purple-500'
              }`}
            />
            {isVIP && (
              <motion.div
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-yellow-400 text-xl"
              >
                ⭐
              </motion.div>
            )}
          </div>

          {/* Player name display */}
          <AnimatePresence>
            {playerName && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`text-center mt-2 font-bold text-lg ${isVIP ? 'text-yellow-300' : 'text-white'}`}
              >
                {isVIP ? `👑 Welcome, ${playerName}!` : `Welcome, ${playerName}!`}
              </motion.div>
            )}
          </AnimatePresence>
          {classId && !isVIP && (
            <p className="text-gray-400 text-center text-xs mt-1">Class: {classId}</p>
          )}
          {isVIP && (
            <motion.p
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-center text-yellow-500/80 text-xs mt-1 font-semibold"
            >
              🔥 Legendary Status Unlocked
            </motion.p>
          )}
        </div>

        {/* Avatar grid and custom avatar option */}
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-3 gap-4">
            {avatars.map((avatar, index) => (
              <motion.div
                key={index}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                className={`cursor-pointer rounded-full overflow-hidden transition-all duration-200 ${
                  selectedAvatar === avatar
                    ? isVIP
                      ? 'border-4 border-yellow-400 shadow-lg shadow-yellow-400/50'
                      : 'border-4 border-purple-500'
                    : 'border-2 border-transparent hover:border-purple-400'
                }`}
                onClick={() => handleAvatarSelect(avatar)}
              >
                <img src={avatar} alt={`Avatar ${index + 1}`} width={100} height={100} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </motion.div>
            ))}
          </div>

          {/* Custom Avatar Option */}
          <div className="flex justify-center pt-2">
            {playerId && playerName && (
              <AvatarSection 
                userId={playerId}
                playerName={playerName}
                rollNo={rollNo}
                onAvatarSelect={(customUrl) => setSelectedAvatar(customUrl)}
                currentAvatar={selectedAvatar}
              />
            )}
          </div>
        </div>

        {/* Join button */}
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={handleSaveAvatar}
            disabled={!selectedAvatar || (!isVIPRoll(rollNo) && !classId) || !rollNo || !playerName}
            className={`w-full p-3 rounded-md text-white font-bold transition-all duration-300 flex items-center justify-center space-x-2 ${
              isVIP
                ? 'bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 hover:from-yellow-600 hover:via-orange-600 hover:to-red-600 shadow-lg shadow-yellow-500/40 disabled:opacity-50'
                : 'bg-purple-600 hover:bg-purple-700 disabled:opacity-50'
            }`}
          >
            {isVIP ? (
              <>
                <span className="text-lg">👑</span>
                <span>Enter The Arena as VIP</span>
                <span className="text-lg">⚡</span>
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                <span>Save Avatar and Join Game</span>
              </>
            )}
          </Button>
        </motion.div>
      </motion.div>

      <style>{`
        @keyframes shimmerBg {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>
    </div>
  );
};

export default PlayerSetupPage;
