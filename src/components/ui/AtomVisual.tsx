import React from 'react';

interface AtomVisualProps {
  className?: string;
}

/**
 * A lightweight, pure CSS/SVG "glowing atom" — nucleus + 3 tilted orbit
 * rings each carrying an electron. Used as a science-lab hero accent.
 * No Three.js/WebGL needed, so it's cheap and works everywhere,
 * including reduced-motion (rings still render, just static).
 */
const AtomVisual: React.FC<AtomVisualProps> = ({ className = '' }) => {
  return (
    <div className={`relative pointer-events-none select-none ${className}`} aria-hidden="true">
      <div className="relative w-full h-full [perspective:800px]">
        {/* Glow core */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full"
          style={{
            background: 'radial-gradient(circle, #67e8f9 0%, #6366f1 60%, transparent 100%)',
            boxShadow: '0 0 40px 10px rgba(99,102,241,0.55), 0 0 80px 20px rgba(34,211,238,0.25)',
            animation: 'pulse 3s ease-in-out infinite',
          }}
        />

        {/* Orbit rings, each with an electron dot */}
        {[
          { rot: '0deg', dur: '9s', color: '#22d3ee' },
          { rot: '60deg', dur: '13s', color: '#a855f7' },
          { rot: '120deg', dur: '16s', color: '#818cf8' },
        ].map((ring, i) => (
          <div
            key={i}
            className="absolute top-1/2 left-1/2 w-full h-full max-w-[380px] max-h-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full border"
            style={{
              borderColor: `${ring.color}55`,
              transform: `translate(-50%, -50%) rotateX(70deg) rotateZ(${ring.rot})`,
              transformStyle: 'preserve-3d',
            }}
          >
            <div
              className="absolute -top-1.5 left-1/2 w-3 h-3 rounded-full"
              style={{
                background: ring.color,
                boxShadow: `0 0 12px 3px ${ring.color}aa`,
                animation: `lab-spin-slow ${ring.dur} linear infinite`,
                transformOrigin: `-1px 190px`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default AtomVisual;
