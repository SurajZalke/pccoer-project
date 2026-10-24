/**
 * TabSwitchDetector Component
 * Detects when user switches tabs and triggers fade animation
 * Mount this once in your app root
 */
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TabSwitchDetectorProps {
  onTabHidden?: () => void;
  onTabVisible?: () => void;
}

/**
 * Shows a smooth fade-in effect when user returns to tab
 */
export const TabSwitchDetector: React.FC<TabSwitchDetectorProps> = ({
  onTabHidden,
  onTabVisible,
}) => {
  const [showFadeOverlay, setShowFadeOverlay] = useState(false);
  const [isVisible, setIsVisible] = useState(!document.hidden);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const currentlyVisible = !document.hidden;

      if (!currentlyVisible) {
        // Tab is now hidden
        setIsVisible(false);
        onTabHidden?.();
      } else {
        // Tab is now visible - show fade effect
        setShowFadeOverlay(true);
        setIsVisible(true);
        onTabVisible?.();

        // Auto-hide overlay after fade-in
        const timer = setTimeout(() => {
          setShowFadeOverlay(false);
        }, 600);

        return () => clearTimeout(timer);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onTabHidden, onTabVisible]);

  return (
    <AnimatePresence>
      {showFadeOverlay && (
        <motion.div
          key="tab-switch-overlay"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="fixed inset-0 bg-black pointer-events-none z-[5000]"
          style={{ mixBlendMode: 'screen' }}
        />
      )}
    </AnimatePresence>
  );
};

export default TabSwitchDetector;
