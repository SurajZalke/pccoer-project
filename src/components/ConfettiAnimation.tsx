import React, { useEffect, useState } from 'react';
import Confetti from 'react-confetti';

interface ConfettiAnimationProps {
  active: boolean;
}

const ConfettiAnimation: React.FC<ConfettiAnimationProps> = ({ active }) => {
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowDimension, setWindowDimension] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const detectSize = () => {
    setWindowDimension({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  };

  useEffect(() => {
    window.addEventListener('resize', detectSize);
    return () => {
      window.removeEventListener('resize', detectSize);
    };
  }, []);

  useEffect(() => {
    if (active) {
      setShowConfetti(true);
      const timer = setTimeout(() => {
        setShowConfetti(false);
      }, 5000); // Show confetti for 5 seconds
      return () => clearTimeout(timer);
    } else {
      setShowConfetti(false);
    }
  }, [active]);

  return (
    <>
      {showConfetti && (
        <Confetti
          width={windowDimension.width}
          height={windowDimension.height}
          recycle={false} // Only run once
          numberOfPieces={500} // More pieces for a grand effect
          tweenDuration={5000} // Confetti falls for 5 seconds
          gravity={0.1} // Slower fall
          initialVelocityX={{ min: -10, max: 10 }} // Spread out horizontally
          initialVelocityY={{ min: -10, max: 10 }} // Spread out vertically
          confettiSource={{ x: 0, y: windowDimension.height * 0.8, w: windowDimension.width, h: windowDimension.height * 0.2 }} // From bottom
          colors={['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#795548', '#9E9E9E', '#607D8B']}
        />
      )}
    </>
  );
};

export default ConfettiAnimation;