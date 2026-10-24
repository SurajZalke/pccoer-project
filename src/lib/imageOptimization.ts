/**
 * Image Optimization Utility
 * Handles efficient image loading with lazy loading, caching, and preloading
 */

// Cache for generated avatar URLs to prevent regeneration
const avatarUrlCache = new Map<string, string>();

/**
 * Get optimized DiceBear avatar URL (cached to prevent regeneration)
 */
export const getOptimizedAvatarUrl = (seed: string): string => {
  if (avatarUrlCache.has(seed)) {
    return avatarUrlCache.get(seed)!;
  }
  const url = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${encodeURIComponent(seed)}`;
  avatarUrlCache.set(seed, url);
  return url;
};

/**
 * Preload an image to the cache
 */
export const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
};

/**
 * Preload multiple images in parallel
 */
export const preloadImages = async (srcs: string[]): Promise<void> => {
  await Promise.allSettled(srcs.map(preloadImage));
};

/**
 * Get optimized image props for img tags
 * Includes lazy loading, width/height for no layout shift, and error handling
 */
export const getOptimizedImageProps = (src: string, alt: string, options?: {
  width?: number;
  height?: number;
  className?: string;
  errorFallback?: string;
}) => ({
  src,
  alt,
  loading: 'lazy' as const,
  decoding: 'async' as const,
  width: options?.width,
  height: options?.height,
  className: options?.className,
  onError: (e: any) => {
    if (options?.errorFallback) {
      e.currentTarget.src = options.errorFallback;
    }
  },
});

/**
 * Cache for frequently accessed images
 */
export const imageCache = new Map<string, HTMLImageElement>();

/**
 * Clear image caches (useful on memory constraints)
 */
export const clearImageCaches = (): void => {
  avatarUrlCache.clear();
  imageCache.clear();
};

/**
 * Get image dimensions for aspect ratio calculation
 */
export const getImageDimensions = (src: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = src;
  });
};
