
import React from "react";

const CreatorAttribution: React.FC = () => {
  return (
    <div className="fixed bottom-2 md:bottom-4 right-2 md:right-4 z-50">
      <div className="bg-gradient-to-r from-indigo-500/30 to-purple-500/30 backdrop-blur-sm px-2 md:px-4 py-1 md:py-2 rounded-full text-xs md:text-sm text-white shadow-lg">
        <img src="/developer.png" alt="Mr Suraj Zalke" className="h-4 w-4 md:h-6 md:w-6 rounded-full inline-block mr-1 md:mr-2" />
        Created by Mr Suraj Zalke❣️
      </div>
    </div>
  );
};

export default CreatorAttribution;
