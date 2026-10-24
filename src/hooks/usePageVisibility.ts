/**
 * usePageVisibility Hook
 * Detects when user switches tabs or windows
 * Triggers animations on visibility change
 */
import { useEffect, useCallback, useRef } from 'react';

interface VisibilityCallbacks {
  onHidden?: () => void;
  onVisible?: () => void;
}

/**
 * Hook to detect page visibility changes
 * Useful for pausing/resuming animations or operations
 */
export const usePageVisibility = ({
  onHidden,
  onVisible,
}: VisibilityCallbacks = {}) => {
  const isVisibleRef = useRef(true);

  const handleVisibilityChange = useCallback(() => {
    const isVisible = !document.hidden;
    isVisibleRef.current = isVisible;

    if (isVisible && onVisible) {
      onVisible();
    } else if (!isVisible && onHidden) {
      onHidden();
    }
  }, [onHidden, onVisible]);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);

  return isVisibleRef.current;
};

export default usePageVisibility;
