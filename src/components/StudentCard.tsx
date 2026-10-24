import React, { useEffect, useState } from 'react';
import { Student } from '@/types';

interface StudentCardProps {
  student: Student;
  style?: React.CSSProperties;
}

const StudentCard: React.FC<StudentCardProps> = ({ student, style }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  // Define animations based on rank
  const getRankBasedStyles = () => {
    const baseClasses = "bg-gradient-to-br rounded-2xl shadow-2xl p-6 flex flex-col items-center text-center transform transition-all duration-500 hover:scale-105 hover:shadow-3xl border relative overflow-hidden group w-64 h-80 text-white";
    
    // Different styles based on rank
    switch(student.rank) {
      case 1: // Gold - 1st rank
        return `${baseClasses} from-yellow-500 to-amber-700 border-yellow-400 animate-float-slow shadow-[0_0_30px_rgba(255,215,0,0.5)]`;
      case 2: // Silver - 2nd rank
        return `${baseClasses} from-slate-300 to-gray-500 border-slate-300 animate-float shadow-[0_0_20px_rgba(192,192,192,0.5)]`;
      case 3: // Bronze - 3rd rank
        return `${baseClasses} from-amber-600 to-amber-900 border-amber-500 animate-float shadow-[0_0_15px_rgba(205,127,50,0.5)]`;
      case 4:
      case 5:
        return `${baseClasses} from-blue-600 to-indigo-800 border-blue-400 animate-pulse-slow shadow-[0_0_10px_rgba(66,135,245,0.5)]`;
      case 6:
      case 7:
        return `${baseClasses} from-purple-600 to-indigo-800 border-purple-400 animate-pulse-slow shadow-[0_0_10px_rgba(147,51,234,0.5)]`;
      case 8:
      case 9:
      case 10:
        return `${baseClasses} from-indigo-600 to-purple-800 border-indigo-400 shadow-[0_0_5px_rgba(79,70,229,0.5)]`;
      default:
        return `${baseClasses} from-purple-700 to-indigo-800 border-purple-500 dark:border-purple-900`;
    }
  };
  
  // Get background animation based on rank
  const getBackgroundAnimation = () => {
    if (student.rank === 1) {
      return "absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-300 to-transparent opacity-20 group-hover:opacity-40 transition-opacity duration-300 animate-pulse-slow";
    } else if (student.rank === 2) {
      return "absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-300 to-transparent opacity-20 group-hover:opacity-40 transition-opacity duration-300 animate-pulse-slow";
    } else if (student.rank === 3) {
      return "absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500 to-transparent opacity-20 group-hover:opacity-40 transition-opacity duration-300 animate-pulse-slow";
    } else if (student.rank && student.rank <= 10) {
      return "absolute inset-0 bg-gradient-to-br from-purple-400 to-indigo-500 opacity-20 group-hover:opacity-40 transition-opacity duration-300";
    } else {
      return "absolute inset-0 bg-gradient-to-br from-purple-400 to-indigo-500 opacity-20 group-hover:opacity-40 transition-opacity duration-300";
    }
  };
  
  // Get photo container animation based on rank
  const getPhotoContainerClass = () => {
    if (student.rank === 1) {
      return "relative w-28 h-28 mb-4 animate-float-slow";
    } else if (student.rank === 2) {
      return "relative w-28 h-28 mb-4 animate-float";
    } else if (student.rank === 3) {
      return "relative w-28 h-28 mb-4 animate-float";
    } else {
      return "relative w-28 h-28 mb-4";
    }
  };
  
  // Get photo border based on rank
  const getPhotoBorderClass = () => {
    if (student.rank === 1) {
      return "w-full h-full rounded-full object-cover border-4 border-yellow-400 shadow-lg flex-shrink-0 transform group-hover:scale-110 transition-transform duration-300";
    } else if (student.rank === 2) {
      return "w-full h-full rounded-full object-cover border-4 border-slate-300 shadow-lg flex-shrink-0 transform group-hover:scale-110 transition-transform duration-300";
    } else if (student.rank === 3) {
      return "w-full h-full rounded-full object-cover border-4 border-amber-600 shadow-lg flex-shrink-0 transform group-hover:scale-110 transition-transform duration-300";
    } else {
      return "w-full h-full rounded-full object-cover border-4 border-white shadow-lg flex-shrink-0 transform group-hover:scale-110 transition-transform duration-300";
    }
  };
  
  // Get progress bar style based on rank
  const getProgressBarClass = () => {
    if (student.rank === 1) {
      return "bg-gradient-to-r from-yellow-400 to-amber-600 h-3 rounded-full shadow-md";
    } else if (student.rank === 2) {
      return "bg-gradient-to-r from-slate-300 to-gray-500 h-3 rounded-full shadow-md";
    } else if (student.rank === 3) {
      return "bg-gradient-to-r from-amber-500 to-amber-700 h-3 rounded-full shadow-md";
    } else if (student.rank && student.rank <= 5) {
      return "bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full shadow-md";
    } else {
      return "bg-gradient-to-r from-indigo-500 to-purple-600 h-3 rounded-full shadow-md";
    }
  };
  
  // Get rank badge based on rank
  const getRankBadge = () => {
    if (student.rank === 1) {
      return (
        <div className="absolute -top-3 -right-3 animate-bounce-slow">
          <div className="relative">
            <span className="absolute inset-0 animate-ping-slow opacity-75 text-yellow-400 text-4xl">👑</span>
            <span className="relative text-yellow-400 text-4xl drop-shadow-lg -rotate-12">👑</span>
          </div>
        </div>
      );
    } else if (student.rank === 2) {
      return (
        <div className="absolute -top-2 -right-2 animate-bounce">
          <span className="text-slate-300 text-3xl drop-shadow-lg -rotate-12">🏆</span>
        </div>
      );
    } else if (student.rank === 3) {
      return (
        <div className="absolute -top-2 -right-2 animate-bounce">
          <span className="text-amber-600 text-3xl drop-shadow-lg -rotate-12">🏅</span>
        </div>
      );
    }
    return null;
  };
  
  // Animate entrance
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div 
      className={`${getRankBasedStyles()} ${isVisible ? 'opacity-100' : 'opacity-0'}`} 
      style={{...style, transition: 'opacity 0.5s ease-in-out, transform 0.5s ease-in-out'}}
    >
      {/* Background effect */}
      <div className={getBackgroundAnimation()}></div>
      
      {/* Particles effect for top 3 */}
      {student.rank && student.rank <= 3 && (
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div 
              key={i}
              className={`absolute w-1 h-1 rounded-full ${student.rank === 1 ? 'bg-yellow-300' : student.rank === 2 ? 'bg-slate-300' : 'bg-amber-500'}`}
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                opacity: Math.random() * 0.5 + 0.3,
                animation: `float-particle ${Math.random() * 3 + 2}s linear infinite`,
                animationDelay: `${Math.random() * 2}s`
              }}
            />
          ))}
        </div>
      )}
      
      <div className="relative z-10 flex flex-col items-center justify-between h-full py-4">
        <div className={getPhotoContainerClass()}>
          <img
            src={student.photoURL || '/placeholder.svg'}
            alt={student.name}
            className={getPhotoBorderClass()}
          />
          {getRankBadge()}
        </div>
        
        <h3 className={`text-2xl font-extrabold mb-1 ${student.rank === 1 ? 'text-white animate-pulse-slow' : 'text-white'}`}>
          {student.name}
        </h3>
        
        <p className="text-sm text-purple-200 mb-1 font-medium">
          Rank: <span className={`text-xl font-bold drop-shadow-lg ${student.rank === 1 ? 'text-yellow-300' : student.rank === 2 ? 'text-slate-300' : student.rank === 3 ? 'text-amber-500' : 'text-yellow-300'}`}>
            {student.rank || 'N/A'}
          </span>
          {student.rank === 4 && <span className="ml-1 text-blue-300 text-lg animate-pulse">🌟</span>}
          {student.rank === 5 && <span className="ml-1 text-blue-300 text-lg animate-pulse">⭐</span>}
          {student.rank && student.rank > 5 && student.rank <= 10 && <span className="ml-1 text-blue-300 text-lg">✨</span>}
        </p>
        
        <p className="text-md text-white mb-3 font-medium">Exam: {student.examName}</p>
        
        <div className="w-full bg-purple-300 dark:bg-purple-700 rounded-full h-3 mb-3">
          <div className={getProgressBarClass()} style={{ width: `${student.percentage}%` }}></div>
        </div>
        
        <div className="flex flex-col items-center mt-auto">
          <p className={`text-xl font-bold ${student.rank === 1 ? 'text-yellow-300 animate-pulse' : student.rank === 2 ? 'text-slate-300 animate-pulse' : student.rank === 3 ? 'text-amber-500 animate-pulse' : 'text-white animate-pulse'}`}>
            Percentage: {student.percentage}%
          </p>
          <p className="text-sm text-purple-200 font-medium">Marks: {student.marks}</p>
        </div>
      </div>
    </div>
  );
};

export default StudentCard;