import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

// Re-export from central util so consumers only need one import
export { VIP_ADMIN_ROLL } from "@/utils/vipAdmin";

interface VIPAdminEntryAnimationProps {
  show: boolean;
  adminNickname?: string;
  onDone?: () => void;
}

const stars = Array.from({ length: 18 });

const VIPAdminEntryAnimation: React.FC<VIPAdminEntryAnimationProps> = ({
  show,
  adminNickname = "MR SURAJ ZALKE",
  onDone,
}) => {
  const [phase, setPhase] = useState<"idle" | "enter" | "title" | "exit" | "done">("idle");

  useEffect(() => {
    if (!show) {
      setPhase("idle");
      return;
    }

    // Reset to enter phase every time show becomes true
    setPhase("enter");

    // Fire crazy multi-burst confetti
    const burst = () => {
      confetti({ particleCount: 120, spread: 160, origin: { x: 0.2, y: 0.5 }, colors: ["#FFD700", "#FF69B4", "#00E6E6", "#FFF"] });
      confetti({ particleCount: 120, spread: 160, origin: { x: 0.8, y: 0.5 }, colors: ["#FFD700", "#a855f7", "#22d3ee", "#FFF"] });
      confetti({ particleCount: 80, spread: 80, origin: { x: 0.5, y: 0.3 }, colors: ["#FFD700", "#f472b6", "#FFF"] });
    };
    burst();
    const t1 = setTimeout(burst, 600);
    const t2 = setTimeout(burst, 1200);

    const t3 = setTimeout(() => setPhase("title"), 300);
    const t4 = setTimeout(() => setPhase("exit"), 4000);
    const t5 = setTimeout(() => {
      setPhase("done");
      onDone?.();
    }, 4800);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
  }, [show]);

  if (phase === "done" || phase === "idle" || !show) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="vip-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === "exit" ? 0 : 1 }}
        transition={{ duration: phase === "exit" ? 0.7 : 0.3 }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
        style={{
          background: "radial-gradient(ellipse at center, #1a0533 0%, #0a0118 60%, #000 100%)",
        }}
      >
        {/* Spinning star ring */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {stars.map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              initial={{ rotate: (i / stars.length) * 360, x: 0 }}
              animate={{ rotate: (i / stars.length) * 360 + 360 }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: "50% 50%" }}
            >
              <div
                style={{
                  position: "absolute",
                  left: `${Math.cos((i / stars.length) * 2 * Math.PI) * 200 - 8}px`,
                  top: `${Math.sin((i / stars.length) * 2 * Math.PI) * 200 - 8}px`,
                  fontSize: i % 3 === 0 ? "1.5rem" : "1rem",
                  opacity: 0.7 + (i % 3) * 0.1,
                  filter: "drop-shadow(0 0 8px #FFD700)",
                }}
              >
                {i % 4 === 0 ? "⭐" : i % 4 === 1 ? "✨" : i % 4 === 2 ? "💫" : "🌟"}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Pulsing glow rings */}
        {[280, 220, 160].map((size, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border-2"
            style={{
              width: size,
              height: size,
              borderColor: ["#FFD700", "#a855f7", "#22d3ee"][i],
              boxShadow: `0 0 30px ${["#FFD70088", "#a855f788", "#22d3ee88"][i]}`,
            }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
          />
        ))}

        {/* Crown */}
        <motion.div
          initial={{ y: -100, opacity: 0, scale: 0.3 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
          className="text-7xl mb-2 select-none"
          style={{ filter: "drop-shadow(0 0 24px #FFD700)" }}
        >
          👑
        </motion.div>

        {/* VIP Badge */}
        <motion.div
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.25 }}
          className="mb-3 px-6 py-1 rounded-full text-sm font-black tracking-widest uppercase"
          style={{
            background: "linear-gradient(90deg, #FFD700, #FF69B4, #a855f7, #FFD700)",
            backgroundSize: "200% 100%",
            animation: "shimmerBg 2s linear infinite",
            color: "#1a0533",
            boxShadow: "0 0 32px #FFD700aa, 0 0 64px #a855f744",
          }}
        >
          ⚡ VIP ADMIN ⚡
        </motion.div>

        {/* Admin name */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.7 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 10, delay: 0.4 }}
          className="text-center select-none"
        >
          <div
            className="text-5xl sm:text-7xl font-black tracking-tight mb-2"
            style={{
              background: "linear-gradient(90deg, #FFD700 0%, #FF69B4 30%, #00E6E6 60%, #FFD700 100%)",
              backgroundSize: "200% 100%",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "shimmerBg 2s linear infinite",
              textShadow: "none",
              filter: "drop-shadow(0 0 24px #FFD700)",
            }}
          >
            {adminNickname}
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7, type: "spring" }}
            className="text-xl sm:text-2xl font-bold text-yellow-300"
            style={{ textShadow: "0 0 16px #FFD700" }}
          >
            🎯 HAS ENTERED THE ARENA 🎯
          </motion.div>
        </motion.div>

        {/* Bottom flames */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="mt-6 text-4xl select-none"
          style={{ filter: "drop-shadow(0 0 12px #FF4500)" }}
        >
          <motion.span animate={{ rotate: [-5, 5, -5] }} transition={{ duration: 0.4, repeat: Infinity }}>
            🔥
          </motion.span>
          {"  "}
          <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.5, repeat: Infinity, delay: 0.15 }}>
            🔥
          </motion.span>
          {"  "}
          <motion.span animate={{ rotate: [5, -5, 5] }} transition={{ duration: 0.4, repeat: Infinity, delay: 0.3 }}>
            🔥
          </motion.span>
        </motion.div>

        {/* CSS for shimmer */}
        <style>{`
          @keyframes shimmerBg {
            0% { background-position: 0% 50%; }
            100% { background-position: 200% 50%; }
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
};

export default VIPAdminEntryAnimation;
