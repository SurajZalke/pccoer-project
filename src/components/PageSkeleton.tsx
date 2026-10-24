/**
 * PageSkeleton — animated skeleton shown while lazy-loaded pages are fetching.
 * Replaces the plain spinner with a content-aware shimmer layout.
 */
import React from 'react';
import { motion } from 'framer-motion';

// Base shimmer block
const Shimmer: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`rounded-lg bg-white/10 overflow-hidden relative ${className}`}
    style={{ isolation: 'isolate' }}
  >
    <motion.div
      className="absolute inset-0"
      style={{
        background:
          'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
      }}
      animate={{ x: ['-100%', '100%'] }}
      transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
    />
  </div>
);

const PageSkeleton: React.FC = () => (
  <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-900 via-purple-800 to-indigo-900 p-6">

    {/* Navbar skeleton */}
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-3">
        <Shimmer className="w-10 h-10 rounded-full" />
        <Shimmer className="w-40 h-5" />
      </div>
      <div className="flex gap-3">
        <Shimmer className="w-20 h-8" />
        <Shimmer className="w-24 h-8" />
      </div>
    </div>

    {/* Hero / title area */}
    <div className="flex flex-col items-center mb-10 gap-3">
      <Shimmer className="w-64 h-7" />
      <Shimmer className="w-44 h-4" />
    </div>

    {/* Card grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl w-full mx-auto">
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07, duration: 0.4 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col gap-3"
        >
          <div className="flex items-center gap-3">
            <Shimmer className="w-10 h-10 rounded-full flex-shrink-0" />
            <div className="flex flex-col gap-2 flex-1">
              <Shimmer className="h-4 w-3/4" />
              <Shimmer className="h-3 w-1/2" />
            </div>
          </div>
          <Shimmer className="h-3 w-full" />
          <Shimmer className="h-3 w-5/6" />
          <Shimmer className="h-3 w-4/6" />
          <div className="flex gap-2 mt-1">
            <Shimmer className="h-7 w-20 rounded-full" />
            <Shimmer className="h-7 w-16 rounded-full" />
          </div>
        </motion.div>
      ))}
    </div>

    {/* Bottom pulse dots */}
    <div className="flex justify-center gap-2 mt-10">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full bg-purple-400"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
          transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.18 }}
        />
      ))}
    </div>
  </div>
);

export default PageSkeleton;
