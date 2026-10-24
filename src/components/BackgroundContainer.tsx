
import React, { useState, useEffect } from "react";
// AIAnalysisToggle is now positioned independently and doesn't need to be included here

interface BackgroundContainerProps {
  children: React.ReactNode;
  className?: string;
  backgroundImage?: string; // Custom background image URL
  backgroundPattern?: string; // Optional pattern overlay
  animationSpeed?: 'slow' | 'normal' | 'fast'; // Control animation speed
  overlayOpacity?: number; // Control overlay opacity (0-100)
  backgroundStyle?: 'gradient' | 'solid' | 'image'; // Background style type
  backgroundTheme?: 'professional' | 'vibrant' | 'dark' | 'light'; // Theme preset
  customGradient?: string; // Custom gradient string
}

const BackgroundContainer: React.FC<BackgroundContainerProps> = ({ 
  children, 
  className = "", 
  backgroundImage,
  backgroundPattern = "none",
  animationSpeed = "normal",
  overlayOpacity = 20,
  backgroundStyle = "gradient",
  backgroundTheme = "professional",
  customGradient = ""
}) => {
  const [currentBgIndex, setCurrentBgIndex] = useState(0);
  
  // Theme-based background gradients
  const themeBackgrounds = {
    professional: [
      "bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-800", // Professional dark blue
      "bg-gradient-to-br from-gray-900 via-gray-800 to-zinc-700", // Elegant dark
      "bg-gradient-to-br from-indigo-900 via-blue-800 to-blue-600", // Corporate blue
      "bg-gradient-to-br from-emerald-900 via-emerald-700 to-teal-600", // Professional green
      "bg-gradient-to-br from-purple-900 via-indigo-800 to-blue-700", // Professional purple
    ],
    vibrant: [
      "bg-gradient-to-br from-red-700 via-red-500 to-orange-400", // Red to orange
      "bg-gradient-to-br from-emerald-700 via-green-500 to-lime-300", // Green gradient 
      "bg-gradient-to-br from-indigo-900 via-blue-600 to-cyan-400", // Blue gradient
      "bg-gradient-to-br from-purple-800 via-violet-600 to-pink-500", // Purple gradient
      "bg-gradient-to-br from-amber-600 via-orange-500 to-yellow-400", // Amber gradient
    ],
    dark: [
      "bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800", // Dark gray
      "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800", // Dark slate
      "bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800", // Dark zinc
      "bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-800", // Dark neutral
      "bg-gradient-to-br from-stone-950 via-stone-900 to-stone-800", // Dark stone
    ],
    light: [
      "bg-gradient-to-br from-blue-100 via-blue-50 to-white", // Light blue
      "bg-gradient-to-br from-emerald-100 via-emerald-50 to-white", // Light green
      "bg-gradient-to-br from-violet-100 via-violet-50 to-white", // Light violet
      "bg-gradient-to-br from-amber-100 via-amber-50 to-white", // Light amber
      "bg-gradient-to-br from-rose-100 via-rose-50 to-white", // Light rose
    ]
  };
  
  // Get the appropriate background set based on theme
  const backgrounds = themeBackgrounds[backgroundTheme];
  
  // Enhanced pattern overlays for added visual interest
  const patterns = {
    none: "",
    dots: "bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==')]",
    grid: "bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgMGg0MHY0MEgwVjB6bTQwIDQwVjBoLTF2MzlIMHYxaDQweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgZmlsbC1ydWxlPSJldmVub2RkIi8+PC9zdmc+')]",
    hexagons: "bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEwIDFsMTAgMTcuMzJoLTIweiIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDgpIiBmaWxsPSJub25lIi8+PC9zdmc+')]",
    circles: "bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iMzgiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+PC9zdmc+')]",
    waves: "bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjIwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0wIDEwIGMgMzAgLTIwLCA3MCAtMjAsIDEwMCAwIHYgMTAgaCAtMTAwIHoiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')]",
  };
  
  // Animation speed control
  const speedMap = {
    slow: 15000,
    normal: 8000,
    fast: 4000
  };
  
  // Change background color based on animation speed
  useEffect(() => {
    // Don't rotate if a custom image is provided or style is not gradient
    if (backgroundImage || backgroundStyle !== 'gradient') return; 
    
    const intervalId = setInterval(() => {
      setCurrentBgIndex(prevIndex => (prevIndex + 1) % backgrounds.length);
    }, speedMap[animationSpeed]);
    
    return () => clearInterval(intervalId);
  }, [backgroundImage, animationSpeed, backgroundStyle, backgrounds.length]); // Re-run effect if props change
  
  // Prepare background styles based on the selected style
  let bgStyle = {};
  
  if (backgroundStyle === 'image' && backgroundImage) {
    // Image background
    bgStyle = { 
      backgroundImage: `url(${backgroundImage})`, 
      backgroundSize: 'cover', 
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    };
  } else if (backgroundStyle === 'solid') {
    // Solid color background - use the first color from the theme
    const solidColorClass = backgrounds[0].split(' ')[1]; // Extract the 'from-X' color
    bgStyle = {
      backgroundColor: `var(--${solidColorClass.replace('from-', '')})`,
    };
  } else if (customGradient) {
    // Custom gradient
    bgStyle = {
      backgroundImage: customGradient,
    };
  }
  // For gradient style, we'll use Tailwind classes directly

  return (
    <div 
      className={`min-h-screen w-full overflow-x-hidden transition-all duration-[1000000] ${backgroundStyle === 'gradient' && !customGradient ? backgrounds[currentBgIndex] : ''} ${patterns[backgroundPattern as keyof typeof patterns]} ${className}`}
      style={bgStyle}
    >
      {/* Animated overlay with configurable opacity */}
      <div 
        className={`absolute inset-0 bg-gradient-to-b from-transparent pointer-events-none transition-opacity duration-1000`}
        style={{ 
          backgroundImage: `linear-gradient(to bottom, transparent, rgba(0,0,0,${overlayOpacity / 100}))`
        }}
      ></div>
      
      {/* Optional animated particles effect for professional look */}
      {backgroundTheme === 'professional' && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -inset-[10%] opacity-10">
            {/* Animated dots */}
            <div className="absolute top-1/4 left-1/4 w-1 h-1 rounded-full bg-white animate-pulse"></div>
            <div className="absolute top-3/4 left-1/3 w-1.5 h-1.5 rounded-full bg-white animate-ping"></div>
            <div className="absolute top-1/2 left-2/3 w-1 h-1 rounded-full bg-white animate-pulse"></div>
            <div className="absolute top-1/3 left-1/2 w-2 h-2 rounded-full bg-white animate-ping"></div>
            <div className="absolute top-2/3 left-3/4 w-1 h-1 rounded-full bg-white animate-pulse"></div>
          </div>
        </div>
      )}
      
      {/*// Content container with improved z-index */}
      <div className="relative z-10 w-full">
        {children}
      </div>
    </div>
  );
};

export default BackgroundContainer;
