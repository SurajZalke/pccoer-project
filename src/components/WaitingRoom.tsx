import React, { useState, useEffect } from "react";
import { Player } from "@/types";
import { Button } from "@/components/ui/button";
import { Users, RefreshCw, Clock, Copy, CheckCircle, Share, QrCode, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { lazy, Suspense } from "react";
const CreatorAttribution = lazy(() => import("./CreatorAttribution"));
import confetti from 'canvas-confetti';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import VIPAdminEntryAnimation from "@/components/VIPAdminEntryAnimation";
import { listenVIPJoin, isVIPRoll } from "@/utils/vipAdmin";
import OrbitBackground from "@/components/ui/OrbitBackground";

interface WaitingRoomProps {
  players: Player[];
  onStartGame: () => void;
  onRefreshPlayers?: () => void;
  cardRef: React.RefObject<HTMLDivElement>;
  handleMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  resetTilt: () => void;
  gameCode?: string;
  gameId?: string;
  isHost: boolean;
  nickname?: string;
  avatarUrl?: string;
  onRemovePlayer?: (playerId: string) => Promise<void>;
}

const WaitingRoom: React.FC<WaitingRoomProps> = ({
  players, onStartGame, onRefreshPlayers, cardRef, handleMouseMove,
  resetTilt, gameCode, gameId, isHost, nickname, avatarUrl, onRemovePlayer
}) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activePlayerCount, setActivePlayerCount] = useState(players.length);
  const [showQR, setShowQR] = useState(false);
  const [showVIPAnimation, setShowVIPAnimation] = useState(false);
  const [vipAdminName, setVipAdminName] = useState("MR SURAJ ZALKE");
  const prevPlayerIdsRef = React.useRef<Set<string>>(new Set(players.map(p => p.player_id)));

  // Local VIP detection — triggers animation when VIP player appears in the list
  // This works even without Firebase signal (pure player list comparison)
  const vipAnimShownRef = React.useRef(false);

  useEffect(() => {
    if (vipAnimShownRef.current) return;
    const vipInList = players.some(p =>
      isVIPRoll(p.nickname || '') ||
      isVIPRoll((p as any).rollNo || '') ||
      (p as any).isVIP === true
    );
    if (vipInList) {
      vipAnimShownRef.current = true;
      setVipAdminName("MR SURAJ ZALKE");
      setShowVIPAnimation(true);
    }
  }, [players]);

  // Firebase VIP broadcast listener — also fires on ALL screens simultaneously
  useEffect(() => {
    if (!gameId) return;

    // Fallback: check existing signal on mount in case we joined just after broadcast
    const db = (async () => {
      try {
        const { getDatabase, ref: fbRef, get } = await import('firebase/database');
        const database = getDatabase();
        const signalRef = fbRef(database, `games/${gameId}/vipJoinSignal`);
        const snap = await get(signalRef);
        if (snap.exists()) {
          const data = snap.val();
          if (data?.timestamp && Date.now() - data.timestamp < 15000) {
            setVipAdminName(data.name || "MR SURAJ ZALKE");
            setShowVIPAnimation(true);
          }
        }
      } catch {}
    })();

    const unsub = listenVIPJoin(gameId, (adminName) => {
      setVipAdminName(adminName);
      setShowVIPAnimation(true);
    });
    return unsub;
  }, [gameId]);

  // Local player join detection (confetti for normal players)
  useEffect(() => {
    if (players.length > activePlayerCount) {
      const newPlayers = players.filter(p => !prevPlayerIdsRef.current.has(p.player_id));
      const vipPlayer = newPlayers.find(p =>
        isVIPRoll(p.nickname || '') || isVIPRoll((p as any).rollNo || '')
      );
      if (!vipPlayer) {
        confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
        toast({
          title: "New player joined!",
          description: `${players[players.length - 1]?.nickname || 'Someone'} has entered the game`,
        });
      }
    }
    prevPlayerIdsRef.current = new Set(players.map(p => p.player_id));
    setActivePlayerCount(players.length);
  }, [players.length, activePlayerCount, toast]);

  const copyCodeToClipboard = async () => {
    if (!gameCode) return;
    try {
      await navigator.clipboard.writeText(gameCode);
      setCopied(true);
      toast({ title: "Game code copied!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Error", description: "Failed to copy", variant: "destructive" });
    }
  };

  const handleRefreshClick = () => {
    if (!onRefreshPlayers) return;
    setRefreshing(true);
    onRefreshPlayers();
    setTimeout(() => setRefreshing(false), 600);
  };

  const joinLink = gameCode ? `${window.location.origin}/join?code=${gameCode}` : '';
  const qrCodeUrl = gameCode ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${joinLink}` : '';

  const shareJoinLink = async () => {
    if (!joinLink) return;
    if (navigator.share) {
      try { await navigator.share({ title: 'Join my Quiz!', url: joinLink }); } catch {}
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent('Join: ' + joinLink)}`, '_blank');
    }
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={resetTilt}
      className="relative overflow-hidden rounded-2xl"
      initial={{ opacity: 0, y: 16 }}
      animate={showVIPAnimation
        ? { opacity: 1, y: 0, scale: [1, 1.02, 1], boxShadow: '0 0 32px rgba(99,102,241,0.22)' }
        : { opacity: 1, y: 0, scale: 1, boxShadow: '0 0 0 rgba(0,0,0,0)' }
      }
      transition={{ duration: 0.45, ease: 'easeInOut' }}
    >
      {/* VIP Animation — ALL screens fire via Firebase */}
      <VIPAdminEntryAnimation show={showVIPAnimation} adminNickname={vipAdminName} onDone={() => setShowVIPAnimation(false)} />

      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
        <motion.div animate={{ scale: [1,1.15,1], opacity:[0.12,0.22,0.12] }} transition={{ duration:5, repeat:Infinity }}
          className="absolute -top-20 -left-20 w-64 h-64 bg-indigo-600 rounded-full blur-3xl" />
        <motion.div animate={{ scale:[1,1.2,1], opacity:[0.08,0.18,0.08] }} transition={{ duration:7, repeat:Infinity, delay:1 }}
          className="absolute -bottom-20 -right-20 w-80 h-80 bg-purple-600 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 quiz-card lab-panel lab-panel-glow p-6 overflow-hidden">
        <OrbitBackground />
        {/* Header */}
        <div className="relative z-10 flex items-center justify-between mb-6">
          <motion.h2 initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }}
            className="text-xl font-bold text-white flex items-center gap-2 font-display">
            <motion.span animate={{ rotate:[0,10,-10,0] }} transition={{ duration:2, repeat:Infinity, delay:1 }}>
              <Users className="h-5 w-5 text-cyan-400" />
            </motion.span>
            Waiting Room
          </motion.h2>
          {isHost ? (
            <motion.div whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}>
              <Button className="quiz-btn-primary relative overflow-hidden bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600" onClick={onStartGame} disabled={players.length === 0}>
                <motion.div className="absolute inset-0 bg-white/10" animate={{ x:['-100%','100%'] }}
                  transition={{ duration:1.5, repeat:Infinity, ease:'linear' }} />
                <Clock className="h-4 w-4 mr-2" /> Start Quiz
              </Button>
            </motion.div>
          ) : (
            <div className="text-cyan-300 text-sm font-semibold bg-cyan-500/10 px-3 py-2 rounded-full border border-cyan-500/20 font-display">
              Code: <span className="font-mono font-bold">{gameCode}</span>
            </div>
          )}
        </div>

        {/* Host game code card */}
        {isHost && gameCode && (
          <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }} className="relative z-10 mb-6">
            <Card className="bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 text-white p-4 shadow-xl border-none overflow-hidden relative rounded-2xl">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="text-center relative z-10">
                <h3 className="text-lg font-medium mb-2">Game Code <span className="text-yellow-300">🔥</span></h3>
                <div className="flex items-center justify-center gap-3">
                  <div className="text-3xl font-black tracking-widest bg-white/20 px-6 py-2 rounded-xl border border-white/20">
                    {gameCode.split('').map((char, idx) => (
                      <motion.span key={idx} animate={{ y:[0,-4,0] }} transition={{ duration:1.5, repeat:Infinity, delay:idx*0.12 }}
                        className="inline-block">{char}</motion.span>
                    ))}
                  </div>
                  <Button variant="secondary" size="icon" className="rounded-full bg-white/30 hover:bg-white/40" onClick={copyCodeToClipboard}>
                    {copied ? <CheckCircle className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                  </Button>
                </div>
                <hr className="my-3 border-white/30" />
                <div className="flex items-center justify-center gap-2">
                  <motion.p key={players.length} initial={{ scale:1.4 }} animate={{ scale:1 }} className="text-2xl font-black">
                    {players.length}
                  </motion.p>
                  <span className="text-green-400 text-sm font-semibold">players joined</span>
                </div>
                <div className="flex justify-center gap-2 mt-3">
                  <Button variant="secondary" size="sm" className="bg-white/20 hover:bg-white/30" onClick={shareJoinLink}>
                    <Share className="h-4 w-4 mr-1" /> Share
                  </Button>
                  <Button variant="secondary" size="sm" className="bg-white/20 hover:bg-white/30" onClick={() => setShowQR(true)}>
                    <QrCode className="h-4 w-4 mr-1" /> QR Code
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Player list */}
        <div className="relative z-10 bg-white/[0.03] rounded-2xl border border-white/10 p-4">
          <div className="flex items-center justify-between mb-4">
            <motion.h3 key={players.length} initial={{ scale:1.1 }} animate={{ scale:1 }} className="text-lg font-medium text-gray-200 font-display">
              Players Joined: <span className="text-cyan-400 font-black">{players.length}</span>
            </motion.h3>
            {onRefreshPlayers && (
              <Button variant="outline" size="icon" onClick={handleRefreshClick}
                className={`h-8 w-8 rounded-full border-white/10 hover:bg-cyan-500/10 hover:border-cyan-500/30 ${refreshing ? 'animate-spin' : ''}`}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>

          {players.length === 0 ? (
            <div className="text-center py-8">
              <motion.div animate={{ opacity:[0.4,1,0.4] }} transition={{ duration:2, repeat:Infinity }} className="text-gray-400 mb-3">
                Waiting for players to join...
              </motion.div>
              <div className="flex justify-center gap-2">
                {[0,0.2,0.4].map((d,i) => (
                  <motion.div key={i} animate={{ y:[0,-8,0] }} transition={{ duration:0.8, repeat:Infinity, delay:d }}
                    className="h-3 w-3 bg-indigo-500 rounded-full" />
                ))}
              </div>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2">
              <AnimatePresence>
                {players.map((player, idx) => {
                  const isVIPPlayer = isVIPRoll(player.nickname || '') || isVIPRoll((player as any).rollNo || '');
                  return (
                    <motion.div key={player.player_id || idx}
                      initial={{ opacity:0, x:-30, scale:0.9 }}
                      animate={{ opacity:1, x:0, scale:1 }}
                      exit={{ opacity:0, x:30 }}
                      transition={{ type:'spring', stiffness:300, damping:20, delay:idx*0.05 }}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${
                        isVIPPlayer
                          ? 'bg-gradient-to-r from-yellow-900/50 to-purple-900/50 border border-yellow-400/50 shadow-lg shadow-yellow-400/20'
                          : 'bg-white/5 hover:bg-white/10 border border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className={isVIPPlayer ? '' : 'avatar-ring'}>
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={player.avatar || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${player.nickname}`} />
                              <AvatarFallback>{player.nickname?.charAt(0)?.toUpperCase() || '?'}</AvatarFallback>
                            </Avatar>
                          </div>
                          {isVIPPlayer && (
                            <motion.span animate={{ rotate:[0,10,-10,0] }} transition={{ duration:1.5, repeat:Infinity }}
                              className="absolute -top-1 -right-1 text-xs">👑</motion.span>
                          )}
                        </div>
                        <div>
                          <span className={`font-semibold text-sm ${isVIPPlayer ? 'text-yellow-300' : 'text-white'}`}>
                            {player.nickname}
                          </span>
                          {isVIPPlayer && (
                            <motion.span animate={{ opacity:[0.7,1,0.7] }} transition={{ duration:1.2, repeat:Infinity }}
                              className="ml-2 px-1.5 py-0.5 rounded-full text-xs font-black bg-gradient-to-r from-yellow-400 to-orange-400 text-black">
                              ⚡ ADMIN
                            </motion.span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-xs text-green-400">
                          <motion.div animate={{ scale:[1,1.4,1] }} transition={{ duration:1.5, repeat:Infinity, delay:idx*0.2 }}
                            className="w-2 h-2 bg-green-400 rounded-full" />
                          Ready
                        </div>
                        {isHost && onRemovePlayer && (
                          <Button variant="ghost" size="icon" onClick={() => onRemovePlayer(player.player_id)}
                            className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-900/20">
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          {!isHost && gameCode && (
            <div className="mt-4 text-center">
              <div className="inline-flex items-center gap-2 cursor-pointer hover:bg-indigo-900/30 px-4 py-2 rounded-xl border border-indigo-500/20 transition-colors"
                onClick={copyCodeToClipboard}>
                <span className="text-lg font-black text-indigo-400 tracking-widest">{gameCode}</span>
                {copied ? <CheckCircle size={16} className="text-green-400" /> : <Copy size={16} className="text-gray-400" />}
              </div>
              <div className="flex justify-center mt-2">
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setShowQR(true)}>
                  <QrCode className="h-3 w-3 mr-1" /> Show QR
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* QR Dialog */}
        <Dialog open={showQR} onOpenChange={setShowQR}>
          <DialogContent className="sm:max-w-md text-center">
            <DialogHeader><DialogTitle>Scan to Join the Game</DialogTitle></DialogHeader>
            <div className="p-6 flex flex-col items-center gap-4">
              <div className="bg-white p-2 rounded-lg shadow-inner">
                <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64 mx-auto" />
              </div>
              <p className="text-sm text-gray-400">Scan to join the game</p>
              <p className="font-mono text-lg font-bold text-indigo-400">{gameCode}</p>
            </div>
          </DialogContent>
        </Dialog>

        <Suspense fallback={<div></div>}>
          <CreatorAttribution />
        </Suspense>
      </div>
    </motion.div>
  );
};

export default WaitingRoom;
