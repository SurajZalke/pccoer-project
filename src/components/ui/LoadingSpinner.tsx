import React, { useState, useEffect } from 'react';

interface LoadingSpinnerProps {
  loadingTime: number | null;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ loadingTime, className }) => {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    let timer: number | undefined;
    if (loadingTime === null && countdown > 0) {
      timer = window.setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (loadingTime !== null) {
      setCountdown(0); // Stop countdown if loading is complete
    }
    return () => { if (timer !== undefined) clearInterval(timer); };
  }, [loadingTime, countdown]);

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500"></div>
      <div className="mt-4 text-white text-xl font-medium">
        {loadingTime !== null
          ? `Quiz Loaded!`
          : `Loading Quiz...`}
      </div>
      <p className="text-white text-lg mt-4">
        {loadingTime !== null
          ? `Loaded in ${loadingTime.toFixed(2)} seconds`
          : countdown > 0
            ? `Please wait, ${countdown} seconds remaining...`
            : `Loading... Please wait`}
      </p>
      <div className="mt-4 text-white text-sm">
        If the quiz takes longer to load, please check your internet connection.
      </div>
    </div>
  );
};

export default LoadingSpinner;