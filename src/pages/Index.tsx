import React, { useEffect } from "react";
import HomePage from "./HomePage";

const Index = () => {
  // Apply dark mode by default for better color scheme
  useEffect(() => {
    // Always use dark mode for better color experience
    document.documentElement.classList.add("dark");
    
    // Update page title to match the new branding
    document.title = "MSP COLLEGE - Quiz Game";
    
    // Monitor system dark mode preference, but keep dark mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Listen for changes - but we'll keep dark mode even if they change
    const listener = () => {
      // We're always using dark mode for this app
      document.documentElement.classList.add("dark");
    };
    
    mediaQuery.addEventListener('change', listener);
    
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);
  
  return <HomePage />;
};

export default Index;
