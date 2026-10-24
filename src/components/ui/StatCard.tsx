import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  /** Numeric value gets an animated count-up. Pass a string for non-numeric values. */
  value: number | string;
  /** Small text under the value, e.g. "+3 this week" or "across 12 quizzes" */
  helperText?: string;
  helperPositive?: boolean;
  /** Tailwind classes for the card's soft background gradient, e.g. "from-indigo-500/10 to-purple-500/10" */
  gradient?: string;
  /** Tailwind classes for the border, e.g. "border-indigo-500/20" */
  borderClass?: string;
  /** Tailwind classes for the icon chip background gradient */
  iconGradient?: string;
  /** Tailwind text color class for the label + icon */
  accentText?: string;
  delay?: number;
}

/**
 * Animated count-up for numeric stat values. Falls back to rendering the
 * raw value immediately when it isn't a finite number (e.g. "—" or text).
 */
const useCountUp = (target: number, durationMs = 900) => {
  const [value, setValue] = useState(0);
  const frame = useRef<number>();

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    const start = performance.now();
    const from = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      }
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target, durationMs]);

  return value;
};

const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  helperText,
  helperPositive = true,
  gradient = 'from-indigo-500/10 to-purple-500/10',
  borderClass = 'border-indigo-500/20',
  iconGradient = 'from-indigo-500 to-purple-600',
  accentText = 'text-indigo-300',
  delay = 0,
}) => {
  const isNumeric = typeof value === 'number' && Number.isFinite(value);
  const animatedValue = useCountUp(isNumeric ? (value as number) : 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -4 }}
      className={`stat-card lab-panel-glow bg-gradient-to-br ${gradient} border ${borderClass} p-5`}
    >
      <div className="flex items-start justify-between mb-4">
        <span className={`stat-icon-chip bg-gradient-to-br ${iconGradient} text-white`}>
          {icon}
        </span>
        {helperText && (
          <span
            className={`flex items-center gap-1 text-xs font-medium rounded-full px-2 py-1 ${
              helperPositive ? 'text-emerald-300 bg-emerald-500/10' : 'text-gray-400 bg-white/5'
            }`}
          >
            {helperPositive && <ArrowUpRight className="h-3 w-3" />}
            {helperText}
          </span>
        )}
      </div>

      <p className={`text-xs font-semibold uppercase tracking-wider ${accentText} mb-1 font-display`}>
        {label}
      </p>

      <div className="text-3xl md:text-4xl font-bold text-white font-display tabular-nums">
        {isNumeric ? animatedValue.toLocaleString() : value}
      </div>
    </motion.div>
  );
};

export default StatCard;
