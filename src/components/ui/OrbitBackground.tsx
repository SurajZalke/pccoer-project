import React from 'react';

interface OrbitBackgroundProps {
  /** Extra classes for sizing / positioning the wrapper */
  className?: string;
  /** Set false to render fully static (respects prefers-reduced-motion automatically via CSS too) */
  animated?: boolean;
}

/**
 * A subtle science-lab style orbit/particle backdrop used behind dashboard
 * headers and profile cards. Purely decorative (aria-hidden), sits at z-0
 * behind normal content, and never intercepts clicks.
 */
const OrbitBackground: React.FC<OrbitBackgroundProps> = ({ className = '', animated = true }) => {
  return (
    <div className={`lab-orbit-bg ${className}`} aria-hidden="true">
      <div
        className={`orbit-ring ${animated ? 'lab-spin-slow' : ''}`}
        style={{ width: 420, height: 420, left: '-8%', top: '-30%' }}
      />
      <div
        className={`orbit-ring ${animated ? 'lab-spin-reverse' : ''}`}
        style={{ width: 280, height: 280, right: '2%', top: '-10%', borderColor: 'rgba(168,85,247,0.14)' }}
      />
      <div
        className={`orbit-ring ${animated ? 'lab-spin-slow' : ''}`}
        style={{ width: 160, height: 160, right: '18%', bottom: '-20%', borderColor: 'rgba(34,211,238,0.16)' }}
      />
      <span className="orbit-dot" style={{ left: '6%', top: '20%', animation: animated ? 'float 5s ease-in-out infinite' : undefined }} />
      <span className="orbit-dot" style={{ right: '10%', top: '40%', animation: animated ? 'float-slow 6s ease-in-out infinite' : undefined }} />
      <span className="orbit-dot" style={{ right: '28%', bottom: '15%', animation: animated ? 'float 4s ease-in-out infinite' : undefined }} />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 15% 20%, rgba(99,102,241,0.10), transparent 45%), radial-gradient(circle at 85% 30%, rgba(34,211,238,0.08), transparent 40%)',
        }}
      />
    </div>
  );
};

export default OrbitBackground;
