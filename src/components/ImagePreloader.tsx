/**
 * ImagePreloader Component
 * Preloads critical images to improve perceived performance
 * Mount this once in your app root (e.g., in App.tsx)
 */
import { useEffect } from 'react';
import { preloadImages } from '@/lib/imageOptimization';

interface ImagePreloaderProps {
  images?: string[];
}

export const ImagePreloader: React.FC<ImagePreloaderProps> = ({ 
  images = [
    '/msplogo.jpg',
    '/developer.jpg',
    '/chemistry_teacher2.webp',
  ] 
}) => {
  useEffect(() => {
    // Preload images asynchronously without blocking render
    preloadImages(images).catch(() => {
      // Silently handle errors - images will still load normally
    });
  }, [images]);

  return null;
};

export default ImagePreloader;
