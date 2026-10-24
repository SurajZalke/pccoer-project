/**
 * withPageTransition HOC
 * Wraps any page component with smooth fade and slide animations
 * Usage: export default withPageTransition(MyPage);
 */
import React from 'react';
import { motion } from 'framer-motion';

interface WithPageTransitionOptions {
  direction?: 'up' | 'down' | 'left' | 'right';
  duration?: number;
  delay?: number;
}

/**
 * Higher Order Component for page transitions
 * Adds fade-in and slide animation when page enters
 */
export const withPageTransition = <P extends object>(
  Component: React.ComponentType<P>,
  options: WithPageTransitionOptions = {}
) => {
  const { direction = 'up', duration = 0.4, delay = 0 } = options;

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

  const TransitionedComponent = (props: P) => (
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
      <Component {...props} />
    </motion.div>
  );

  TransitionedComponent.displayName = `withPageTransition(${Component.displayName || Component.name || 'Component'})`;

  return TransitionedComponent;
};

export default withPageTransition;
