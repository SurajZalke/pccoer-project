/**
 * Animation utilities and constants for the application
 * Provides smooth, professional animations for UI elements
 */

export const animationClasses = {
  // Fade animations
  fadeIn: 'animate-fade-in',
  fadeOut: 'animate-fade-out',
  fadeInUp: 'animate-fade-in-up',
  fadeInDown: 'animate-fade-in-down',
  fadeInLeft: 'animate-fade-in-left',
  fadeInRight: 'animate-fade-in-right',

  // Scale animations
  scaleIn: 'animate-scale-in',
  scaleOut: 'animate-scale-out',
  scaleUp: 'animate-scale-up',
  scaleDown: 'animate-scale-down',

  // Slide animations
  slideInLeft: 'animate-slide-in-left',
  slideInRight: 'animate-slide-in-right',
  slideInUp: 'animate-slide-in-up',
  slideInDown: 'animate-slide-in-down',
  slideOutLeft: 'animate-slide-out-left',
  slideOutRight: 'animate-slide-out-right',

  // Bounce animations
  bounce: 'animate-bounce',
  bounceIn: 'animate-bounce-in',
  bounceOut: 'animate-bounce-out',

  // Pulse animations
  pulse: 'animate-pulse',
  pulseGlow: 'animate-pulse-glow',

  // Spin animations
  spin: 'animate-spin',
  spinSlow: 'animate-spin-slow',

  // Shimmer animations
  shimmer: 'animate-shimmer',
  shimmerWave: 'animate-shimmer-wave',

  // Gradient animations
  gradientShift: 'animate-gradient-shift',
  gradientFlow: 'animate-gradient-flow',

  // Combined animations
  popIn: 'animate-pop-in',
  popOut: 'animate-pop-out',
  flipIn: 'animate-flip-in',
  flipOut: 'animate-flip-out',
};

export const animationDurations = {
  fast: '150ms',
  normal: '300ms',
  slow: '500ms',
  slower: '700ms',
  slowest: '1000ms',
};

export const animationDelays = {
  none: '0ms',
  fast: '50ms',
  normal: '100ms',
  slow: '200ms',
  slower: '300ms',
  slowest: '500ms',
};

/**
 * Get animation class with optional delay
 */
export const getAnimationClass = (
  animation: keyof typeof animationClasses,
  delay?: keyof typeof animationDelays
): string => {
  const baseClass = animationClasses[animation];
  const delayClass = delay ? `animation-delay-${delay}` : '';
  return `${baseClass} ${delayClass}`.trim();
};

/**
 * Stagger animation for multiple elements
 */
export const getStaggeredAnimation = (
  animation: keyof typeof animationClasses,
  index: number,
  delayIncrement: number = 50
): string => {
  const baseClass = animationClasses[animation];
  const delay = index * delayIncrement;
  return `${baseClass} animation-delay-${delay}ms`;
};

/**
 * Animation presets for common UI patterns
 */
export const animationPresets = {
  // Modal/Dialog animations
  modalEnter: 'animate-fade-in animate-scale-in',
  modalExit: 'animate-fade-out animate-scale-out',

  // Card animations
  cardEnter: 'animate-fade-in-up',
  cardHover: 'hover:animate-scale-up',

  // Button animations
  buttonHover: 'hover:animate-pulse-glow',
  buttonClick: 'active:animate-scale-down',

  // Loading animations
  loadingSpinner: 'animate-spin',
  loadingPulse: 'animate-pulse',
  loadingShimmer: 'animate-shimmer',

  // Success animations
  successPop: 'animate-pop-in',
  successBounce: 'animate-bounce-in',

  // Error animations
  errorShake: 'animate-shake',
  errorPulse: 'animate-pulse-glow',

  // List item animations
  listItemEnter: 'animate-fade-in-left',
  listItemHover: 'hover:animate-scale-up',

  // Page transitions
  pageEnter: 'animate-fade-in-up',
  pageExit: 'animate-fade-out',

  // Notification animations
  notificationEnter: 'animate-slide-in-right',
  notificationExit: 'animate-slide-out-right',

  // Tooltip animations
  tooltipEnter: 'animate-fade-in-up animate-scale-in',
  tooltipExit: 'animate-fade-out animate-scale-out',
};

/**
 * Get CSS for custom animation timing
 */
export const getAnimationTiming = (duration: string, delay: string = '0ms'): React.CSSProperties => {
  return {
    animation: `${duration} ease-in-out ${delay}`,
  };
};
