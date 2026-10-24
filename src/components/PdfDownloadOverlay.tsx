/**
 * PdfDownloadOverlay
 * Full-screen animated overlay shown while any PDF is being generated.
 * Usage:
 *   const [pdfLoading, setPdfLoading] = useState(false);
 *   <PdfDownloadOverlay visible={pdfLoading} label="Preparing your exam paper…" />
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  visible: boolean;
  label?: string;
}

const steps = [
  'Building document…',
  'Rendering pages…',
  'Generating PDF…',
  'Almost done…',
];

const PdfDownloadOverlay: React.FC<Props> = ({ visible, label }) => {
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    if (!visible) { setStep(0); return; }
    const id = setInterval(() => setStep(s => (s + 1) % steps.length), 900);
    return () => clearInterval(id);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="pdf-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{ background: 'rgba(10,8,40,0.82)', backdropFilter: 'blur(6px)' }}
        >
          {/* Animated PDF icon */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
            className="mb-6"
          >
            <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
              <rect x="8" y="4" width="44" height="56" rx="5" fill="#1e1b4b" stroke="#6366f1" strokeWidth="2"/>
              <rect x="8" y="4" width="44" height="56" rx="5" fill="url(#pdf-grad)" opacity="0.15"/>
              <path d="M36 12H52L52 28H36V12Z" fill="#6366f1" opacity="0.3"/>
              <path d="M36 12L52 28" stroke="#818cf8" strokeWidth="1.5"/>
              <rect x="14" y="34" width="24" height="2.5" rx="1.25" fill="#818cf8"/>
              <rect x="14" y="40" width="18" height="2.5" rx="1.25" fill="#818cf8" opacity="0.6"/>
              <rect x="14" y="46" width="20" height="2.5" rx="1.25" fill="#818cf8" opacity="0.4"/>
              {/* Down arrow */}
              <motion.g
                animate={{ y: [0, 6, 0], opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              >
                <path d="M56 48L56 62M56 62L50 56M56 62L62 56" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </motion.g>
              <defs>
                <linearGradient id="pdf-grad" x1="8" y1="4" x2="52" y2="60">
                  <stop stopColor="#818cf8"/>
                  <stop offset="1" stopColor="#6366f1" stopOpacity="0"/>
                </linearGradient>
              </defs>
            </svg>
          </motion.div>

          {/* Spinning ring */}
          <div className="relative w-16 h-16 mb-5">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(99,102,241,0.2)" strokeWidth="5"/>
              <motion.circle
                cx="32" cy="32" r="28"
                fill="none"
                stroke="#6366f1"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray="175"
                animate={{ strokeDashoffset: [175, 0, 175] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white font-bold text-xs">PDF</span>
            </div>
          </div>

          {/* Label */}
          <motion.p
            key={step}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="text-white font-semibold text-base mb-1"
          >
            {label || steps[step]}
          </motion.p>
          <p className="text-indigo-300 text-xs">Please wait, do not close this page</p>

          {/* Progress dots */}
          <div className="flex gap-2 mt-5">
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                className="w-2 h-2 rounded-full bg-indigo-400"
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PdfDownloadOverlay;
