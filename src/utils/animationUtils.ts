
import React, { useRef, useCallback } from 'react';

// 3D card tilt effect with improved sensitivity and dynamics
export const use3DTilt = (intensity: number = 20) => {
  const cardRef = useRef<HTMLDivElement>(null);
  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = (y - centerY) / intensity;
    const rotateY = (centerX - x) / intensity;
    
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
    card.style.transition = 'transform 0.1s ease-out';
  }, [intensity]);
  
  const resetTilt = useCallback(() => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
    cardRef.current.style.transition = 'transform 0.5s ease-out';
  }, []);
  
  return { cardRef, handleMouseMove, resetTilt };
};

// Staggered animation for lists with more variety
export const getStaggeredAnimation = (index: number, baseDelay: number = 0.1, type: 'fade' | 'scale' | 'slide' = 'fade') => {
  const delay = `${baseDelay * index}s`;
  
  switch (type) {
    case 'fade':
      return {
        animationDelay: delay,
        animation: `fadeIn 0.5s ease-out ${delay} forwards`,
        opacity: 0,
      };
    case 'scale':
      return {
        animationDelay: delay,
        animation: `scaleIn 0.5s ease-out ${delay} forwards`,
        opacity: 0,
        transform: 'scale(0.8)',
      };
    case 'slide':
      return {
        animationDelay: delay,
        animation: `slideIn 0.5s ease-out ${delay} forwards`,
        opacity: 0,
        transform: 'translateY(20px)',
      };
  }
};

// Floating animation effect
export const useFloatingAnimation = () => {
  const elementRef = useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
    if (!elementRef.current) return;
    
    const element = elementRef.current;
    let startTime = Date.now();
    let animationFrame: number;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const movement = Math.sin(elapsed / 1000) * 5;
      
      if (element) {
        element.style.transform = `translateY(${movement}px)`;
      }
      
      animationFrame = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, []);
  
  return elementRef;
};

// Pulse scale animation
export const usePulseAnimation = (scale: number = 1.05, duration: number = 2000) => {
  const elementRef = useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
    if (!elementRef.current) return;
    
    const element = elementRef.current;
    element.style.transition = `transform ${duration / 1000}s ease-in-out`;
    
    let growing = true;
    
    const pulse = () => {
      if (!element) return;
      
      if (growing) {
        element.style.transform = `scale(${scale})`;
      } else {
        element.style.transform = 'scale(1)';
      }
      
      growing = !growing;
    };
    
    const interval = setInterval(pulse, duration);
    
    return () => {
      clearInterval(interval);
    };
  }, [scale, duration]);
  
  return elementRef;
};
