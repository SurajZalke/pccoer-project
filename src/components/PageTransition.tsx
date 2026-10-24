/**
 * PageTransition Component
 * Wraps page content with smooth fade and slide animations
 * Use this to wrap your page content for smooth transitions
 */
import React from 'react';
import { motion } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  duration?: number;
  delay?: number;
}

/**
 * Smooth page transition animation
 * Fades in while sliding from specified direction
 */
export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  direction = 'up',
  duration = 0.4,
  delay = 0,
}) => {
  const getInitialPosition = () => {
    switch (direction) {
      case 'down':
        return { y: -40, opacity: 0 };
      case 'left':
        return { x: 40, opacity: 0 };
      case 'right':
        return { x: -40, opacity: 0 };
      case 'up':
      default:
        return { y: 40, opacity: 0 };
    }
  };

  return (
    <motion.div
      initial={getInitialPosition()}
      animate={{ x: 0, y: 0, opacity: 1 }}
      exit={getInitialPosition()}
      transition={{
        duration,
        delay,
        ease: 'easeOut',
      }}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
