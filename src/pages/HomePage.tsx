import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from 'framer-motion';
import { Sparkles as SparklesIcon, Bot, Zap, BookOpen, Trophy } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import BackgroundContainer from "@/components/BackgroundContainer";
import { useAuth } from "@/contexts/AuthContext";
import { LogIn, Play, Settings, Users, Search, ExternalLink, Upload } from "lucide-react";
import { Helmet } from "react-helmet";
import { getTopStudents, getYouTubeVideos } from '@/services/firebaseService';
import { Student, YouTubeVideo } from '@/types';
import ConfettiAnimation from '@/components/ConfettiAnimation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
// Lazy-loaded components
const CreatorAttribution = React.lazy(() => import('@/components/CreatorAttribution'));
const StudentCard = React.lazy(() => import('@/components/StudentCard'));


const HomePage: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showTeacherDetails, setShowTeacherDetails] = useState(false);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Background customization states
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showConfetti, setShowConfetti] = useState(false);
  const teacherSectionRef = useRef<HTMLDivElement>(null);
  const topPerformersSectionRef = useRef<HTMLDivElement>(null);

  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeVideo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredVideos, setFilteredVideos] = useState<YouTubeVideo[]>([]);
  const [showAllVideos, setShowAllVideos] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [displayedVideos, setDisplayedVideos] = useState<YouTubeVideo[]>([]);
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const [searchResultVideo, setSearchResultVideo] = useState<YouTubeVideo | null>(null);
  const [uniqueChapters, setUniqueChapters] = useState<string[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  
  // Function to handle background image upload
  const customizeBackground = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string;
        setBackgroundImage(imageUrl);
        // Close the modal after setting the background
        setShowCustomizeModal(false);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // Function to handle background image URL input
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>('');
  
  const handleBackgroundUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBackgroundImageUrl(e.target.value);
  };

  const applyBackgroundFromUrl = () => {
    if (backgroundImageUrl.trim()) {
      setBackgroundImage(backgroundImageUrl);
      setShowCustomizeModal(false);
    }
  };
  
  // Function to trigger file input click
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);



  const handleHostClick = () => {
    navigate(currentUser ? "/host-dashboard" : "/host-login");
  };

  const [topStudents, setTopStudents] = useState<Student[]>([]);

  useEffect(() => {
    const fetchTopStudents = async () => {
      const result = await getTopStudents(10);
      if (result.success && result.students) {
        setTopStudents(result.students as Student[]);
      }
    };
    fetchTopStudents();

    const fetchYouTubeVideos = async () => {
      const result = await getYouTubeVideos();
      if (result.success && result.videos) {
        setYoutubeVideos(result.videos as YouTubeVideo[]);
        setFilteredVideos(result.videos as YouTubeVideo[]);

        // Extract unique chapters
        const chapters = Array.from(new Set(result.videos.map(video => video.chapter)));
        setUniqueChapters(chapters);
      }
    };
    fetchYouTubeVideos();
  }, []);
  
  // Update displayed videos when filtered videos change or show all toggle changes
  useEffect(() => {
    let videosToDisplay = filteredVideos;

    if (selectedChapter) {
      videosToDisplay = filteredVideos.filter(video => video.chapter === selectedChapter);
    }

    if (showAllVideos || videosToDisplay.length <= 3 || selectedChapter) {
      setDisplayedVideos(videosToDisplay);
    } else {
      setDisplayedVideos(videosToDisplay.slice(0, 3));
    }
  }, [filteredVideos, showAllVideos]);

  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5, // Trigger when 50% of the section is visible
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setShowConfetti(true);
          // Optionally, stop observing after the first trigger if you only want it once
          // observer.unobserve(entry.target);
        } else {
          setShowConfetti(false);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    if (teacherSectionRef.current) {
      observer.observe(teacherSectionRef.current);
    }
    if (topPerformersSectionRef.current) {
      observer.observe(topPerformersSectionRef.current);
    }

    return () => {
      if (teacherSectionRef.current) {
        observer.unobserve(teacherSectionRef.current);
      }
      if (topPerformersSectionRef.current) {
        observer.unobserve(topPerformersSectionRef.current);
      }
    };
  }, []);

  const handleJoinClick = () => {
    navigate("/join");
  };

  const handleTeacherClick = () => {
    setShowTeacherDetails(true);
  };

  const handleSearchInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
    // When the input changes, hide the search popup immediately.
    // The actual filtering and showing of the popup will happen on button click.
    setShowSearchPopup(false); 
    // If the user clears the input, reset filtered videos to all videos.
    if (event.target.value === '') {
      setFilteredVideos(youtubeVideos);
      setSelectedChapter(null); // Clear selected chapter when search query is cleared
    }
  };

  const handleSearchButtonClick = () => {
    setShowAllVideos(false); // Reset show all videos when a search is initiated
    setSelectedChapter(null); // Clear selected chapter when a search is initiated

    if (searchQuery) { // Only perform search if query is not empty
      const filteredResults = youtubeVideos.filter(video =>
        video.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.chapter.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      setFilteredVideos(filteredResults);
      
      // Show popup notification with the first matching video
      if (filteredResults.length > 0) {
        // Close any existing popup first
        setShowSearchPopup(false); // Ensure it's closed before re-opening
        
        // Then show the new popup after a brief delay for animation effect
        setTimeout(() => {
          setSearchResultVideo(filteredResults[0]);
          setShowSearchPopup(true);
          setShowAllVideos(true); // Ensure all videos are shown so the target video is visible
          
          // Auto-hide popup after 8 seconds
          setTimeout(() => {
            setShowSearchPopup(false);
          }, 8000);
        }, 100);
      } else {
        // No results found
        setShowSearchPopup(false);
      }
    } else { // If search button is clicked with an empty query
      setFilteredVideos(youtubeVideos); // Show all videos
      setShowSearchPopup(false); // Ensure popup is hidden
    }
  };

  // Extract YouTube video ID from URL
  const getYouTubeVideoId = (url: string): string => {
    if (!url) return '';

    const patterns = [
      /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([^\u0026\?\n\r#]+)/,
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:playlist\?list=)([^\u0026\?\n\r#]+)/,
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:user\/[^\/]+\/|channel\/[^\/]+\/)?videos\/?(?:\?flow=grid\u0026view=0\u0026sort=p\u0026shelf_id=0)?$/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        // Basic validation for video ID length (YouTube video IDs are 11 characters)
        if (match[1].length === 11) {
          return match[1];
        }
      }
    }

    // Fallback for direct video ID or short URLs if regex fails
    const lastSegment = url.split('/').pop();
    if (lastSegment && lastSegment.length === 11) {
      return lastSegment;
    }

    return '';
  };
  
  const handleViewMoreClick = () => {
    setShowAllVideos(true);
  };
  
  const handleViewLessClick = () => {
    setShowAllVideos(false);
  };
  
  const handleClosePopup = () => {
    setShowSearchPopup(false);
  };


  return (
    <>
      <Helmet>
        <title>PCCOER Education Platform - Home</title>
        <meta name="description" content="PCCOER Education Platform is a smart student platform with modern tools, learning features, and official updates for students." />
        <meta name="keywords" content="PCCOER, Education Platform, Student Platform, Coaching Classes, Study Tool" />
      </Helmet>

      <BackgroundContainer 
        className="homepage-background relative min-h-screen" 
        backgroundImage={backgroundImage || undefined}
        backgroundStyle={backgroundImage ? 'image' : 'gradient'}
        animationSpeed="slow"
      >
        <div className="relative z-10 flex flex-col">
          {/* Deep animated gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-indigo-900/30 to-blue-900/40 pointer-events-none" />
          {/* Floating orbs */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
            <div className="absolute top-1/3 -right-32 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
            <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob animation-delay-4000" />
            <div className="absolute top-2/3 left-1/4 w-64 h-64 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-3000" />
          </div>

          {/* Header */}
          <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white/5 backdrop-blur-xl border-b border-white/10 shadow-lg relative z-10"
          >
            <div className="container mx-auto px-4 py-3 flex flex-col md:flex-row justify-between items-center gap-3">
              <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                <Logo />
                <Button
                  variant="outline"
                  className="text-sm bg-white/10 hover:bg-white/20 border-white/20 text-white w-full md:w-auto backdrop-blur-sm"
                  onClick={() => setShowCustomizeModal(true)}
                >
                  <Upload className="w-3 h-3 mr-1" />
                  Customize Background
                </Button>
              </div>
              {currentUser ? (
                <Button variant="ghost" className="text-white hover:bg-white/10 w-full md:w-auto" onClick={() => navigate("/host-dashboard")}>
                  Dashboard
                </Button>
              ) : (
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                  <Button variant="ghost" className="text-white hover:bg-white/10 w-full md:w-auto" onClick={() => navigate("/host-login")}>
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In
                  </Button>
                  <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white w-full md:w-auto shadow-lg shadow-indigo-500/30 border border-indigo-400/20" onClick={() => navigate("/host-signup")}>
                    Host Sign Up
                  </Button>
                </div>
              )}
            </div>
          </motion.header>

          {/* Hero Section */}
          <main className="container mx-auto flex-1 px-4 py-8 md:py-12 min-h-[90vh] relative">

            {/* Ambient background blobs */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute -top-20 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl animate-pulse" />
              <div className="absolute top-1/2 right-0 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl" style={{animation:'pulse 5s ease-in-out infinite', animationDelay:'1.5s'}} />
              <div className="absolute bottom-10 left-1/3 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl" style={{animation:'pulse 6s ease-in-out infinite', animationDelay:'3s'}} />
              {/* Subtle grid lines */}
              <div className="absolute inset-0 opacity-[0.03]"
                style={{backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '60px 60px'}}
              />
            </div>

            {/* Two-column layout: text left, SK AI right */}
            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-12 h-full min-h-[88vh] py-6">

              {/* ── LEFT COLUMN ───────────────────────────────────────────── */}
              <div className="flex-[1.15] flex flex-col justify-center items-center lg:items-start text-center lg:text-left order-2 lg:order-1 pb-6 lg:pb-0 w-full">

                {/* Badge */}
                <motion.div
                  initial={{ opacity: 0, y: -16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="flex items-center gap-2 mb-6"
                >
                  <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cyan-300 bg-cyan-500/10 border border-cyan-500/25 rounded-full px-4 py-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse inline-block shadow-[0_0_6px_2px_rgba(34,211,238,0.5)]" />
                    AI-Powered Science Learning
                  </span>
                </motion.div>

                {/* Heading — bigger, bolder */}
                <motion.h1
                  initial={{ opacity: 0, x: -40 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.7 }}
                  className="text-5xl md:text-6xl lg:text-7xl xl:text-8xl mb-6 leading-[1.05] font-black tracking-tight"
                >
                  <span className="block text-white drop-shadow-[0_2px_24px_rgba(139,92,246,0.4)]">Interactive</span>
                  <span className="block bg-gradient-to-r from-indigo-300 via-purple-300 to-fuchsia-300 bg-clip-text text-transparent drop-shadow-[0_2px_20px_rgba(168,85,247,0.5)]">
                    Learning
                  </span>
                  <span className="block text-white drop-shadow-[0_2px_24px_rgba(99,102,241,0.4)]">Platform</span>
                </motion.h1>

                {/* Sub-text — wider, more visible */}
                <motion.p
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.7, delay: 0.2 }}
                  className="text-lg md:text-xl text-gray-300 max-w-lg leading-relaxed mb-4"
                >
                  Create and join engaging quizzes, explore Chemistry topics with SK AI, and climb the live leaderboard — all in one place.
                </motion.p>

                {/* Stats row */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="flex items-center gap-6 mb-8 flex-wrap justify-center lg:justify-start"
                >
                  {[
                    { value: '500+', label: 'Students Helped', emoji: '🏆' },
                    { value: '1000+', label: 'Quizzes Played', emoji: '🎯' },
                    { value: '24/7', label: 'SK AI Ready', emoji: '⚡' },
                  ].map((stat, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.35 + i * 0.1 }}
                      className="flex items-center gap-2"
                    >
                      <span className="text-xl">{stat.emoji}</span>
                      <div>
                        <div className="text-lg font-black text-white leading-none">{stat.value}</div>
                        <div className="text-[11px] text-gray-400 leading-none mt-0.5">{stat.label}</div>
                      </div>
                      {i < 2 && <div className="w-px h-8 bg-white/10 ml-3" />}
                    </motion.div>
                  ))}
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.35 }}
                  className="relative w-full max-w-lg mb-8"
                >
                  <Input
                    type="text"
                    placeholder="Search videos by topic, title, or chapter..."
                    className="w-full py-3.5 pl-11 pr-28 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-gray-400 shadow-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-400 transition-all text-sm"
                    value={searchQuery}
                    onChange={handleSearchInputChange}
                    onKeyPress={(e) => { if (e.key === 'Enter') handleSearchButtonClick(); }}
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Button
                    onClick={handleSearchButtonClick}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white px-5 text-sm font-semibold shadow-lg"
                  >
                    Search
                  </Button>
                </motion.div>

                {/* Action cards — wide, prominent */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
                  {[
                    {
                      title: "Join as Player",
                      desc: "Enter a game code and compete with classmates in real-time quizzes.",
                      icon: <Users className="h-8 w-8 text-indigo-300" />,
                      gradient: "from-indigo-600/35 to-blue-700/35",
                      border: "border-indigo-500/50",
                      shadow: "shadow-indigo-500/25",
                      accentBar: "from-indigo-500 to-blue-400",
                      glow: "hover:shadow-[0_0_32px_6px_rgba(99,102,241,0.25)]",
                      button: (
                        <Button onClick={handleJoinClick} className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white w-full shadow-lg shadow-indigo-500/30 font-bold text-base py-5">
                          <Play className="h-5 w-5 mr-2" /> Join Game
                        </Button>
                      ),
                    },
                    {
                      title: "Host a Game",
                      desc: "Create quizzes, invite players, and manage your interactive sessions.",
                      icon: <Settings className="h-8 w-8 text-purple-300" />,
                      gradient: "from-purple-600/35 to-fuchsia-700/35",
                      border: "border-purple-500/50",
                      shadow: "shadow-purple-500/25",
                      accentBar: "from-purple-500 to-fuchsia-400",
                      glow: "hover:shadow-[0_0_32px_6px_rgba(168,85,247,0.25)]",
                      button: (
                        <Button onClick={handleHostClick} className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white w-full shadow-lg shadow-purple-500/30 font-bold text-base py-5">
                          {currentUser ? "Dashboard" : "Host Sign In"}
                        </Button>
                      ),
                    },
                  ].map(({ title, desc, icon, gradient, border, shadow, accentBar, glow, button }, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + idx * 0.12, duration: 0.5, type: 'spring' }}
                      whileHover={{ scale: 1.03, y: -6 }}
                      className={`relative p-6 rounded-3xl border ${border} bg-gradient-to-br ${gradient} backdrop-blur-sm shadow-2xl ${shadow} ${glow} overflow-hidden transition-shadow duration-300`}
                    >
                      {/* Accent top bar */}
                      <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${accentBar}`} />
                      {/* Subtle inner glow corner */}
                      <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/10 border border-white/20 shadow-lg mb-5">
                        {icon}
                      </div>
                      <h2 className="text-xl font-extrabold text-white mb-2">{title}</h2>
                      <p className="text-gray-300 text-sm leading-relaxed mb-5">{desc}</p>
                      {button}
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* ── RIGHT COLUMN: SK AI Assistant ────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, scale: 0.88, x: 60 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ duration: 0.85, delay: 0.15, type: 'spring', stiffness: 75 }}
                className="order-1 lg:order-2 flex-shrink-0 w-full max-w-[360px] sm:max-w-[420px] lg:max-w-[480px] xl:max-w-[520px] relative"
              >
                {/* ── NEW SK AI IS INTEGRATED — animated banner ── */}
                <motion.div
                  initial={{ opacity: 0, y: -20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.3, type: 'spring', stiffness: 120 }}
                  className="relative mb-4 overflow-hidden rounded-2xl border border-violet-500/40 bg-gradient-to-r from-violet-900/70 via-fuchsia-900/60 to-indigo-900/70 backdrop-blur-xl shadow-lg shadow-violet-500/20 px-4 py-3"
                >
                  {/* Animated shimmer sweep */}
                  <motion.div
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.5 }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent skew-x-12 pointer-events-none"
                  />
                  {/* Left glow dot */}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-24 h-full bg-violet-500/15 blur-xl pointer-events-none" />

                  <div className="relative flex items-center gap-3">
                    {/* Pulsing "NEW" pill */}
                    <motion.span
                      animate={{ scale: [1, 1.12, 1], opacity: [1, 0.85, 1] }}
                      transition={{ duration: 1.6, repeat: Infinity }}
                      className="flex-shrink-0 inline-flex items-center text-[10px] font-black tracking-[0.15em] uppercase bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white rounded-full px-2.5 py-1 shadow-[0_0_12px_4px_rgba(217,70,239,0.45)]"
                    >
                      NEW
                    </motion.span>

                    {/* Animated text — typing/scroll effect */}
                    <div className="flex-1 overflow-hidden">
                      <motion.p
                        animate={{ opacity: [0.75, 1, 0.75] }}
                        transition={{ duration: 2.5, repeat: Infinity }}
                        className="text-sm font-bold tracking-wide whitespace-nowrap"
                      >
                        <span className="text-white">SK AI </span>
                        <span className="bg-gradient-to-r from-fuchsia-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">
                          is now Integrated
                        </span>
                        <span className="text-white"> 🚀</span>
                      </motion.p>
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                        Your AI study companion is live &amp; ready
                      </p>
                    </div>

                    {/* Animated spark icon */}
                    <motion.div
                      animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500/30 to-violet-500/30 border border-fuchsia-400/40 flex items-center justify-center"
                    >
                      <SparklesIcon className="w-4 h-4 text-fuchsia-300" />
                    </motion.div>
                  </div>

                  {/* Bottom progress bar — loops */}
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5 overflow-hidden rounded-b-2xl">
                    <motion.div
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                      className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-fuchsia-400 to-transparent"
                    />
                  </div>
                </motion.div>
                {/* Outer glow halos */}
                <div className="absolute inset-x-[5%] bottom-0 h-[40%] bg-violet-600/30 blur-3xl rounded-full pointer-events-none" />
                <div className="absolute inset-x-[15%] top-0 h-[50%] bg-cyan-500/15 blur-3xl rounded-full pointer-events-none" />

                {/* Decorative corner frames */}
                <div className="absolute -top-2 -right-2 w-16 h-16 border-t-2 border-r-2 border-violet-400/50 rounded-tr-3xl pointer-events-none" />
                <div className="absolute -bottom-2 -left-2 w-16 h-16 border-b-2 border-l-2 border-cyan-400/50 rounded-bl-3xl pointer-events-none" />

                {/* ── Main card ── */}
                <div className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/8 to-white/3 backdrop-blur-xl shadow-2xl overflow-hidden">

                  {/* Top shimmer bar */}
                  <div className="h-[3px] w-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-cyan-400" />

                  {/* Header row */}
                  <div className="flex items-center justify-between px-5 pt-4 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_3px_rgba(74,222,128,0.6)]" />
                      <span className="text-xs font-bold tracking-widest text-green-300 uppercase">SK AI Online</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-violet-300 bg-violet-500/15 border border-violet-500/25 rounded-full px-3 py-1.5">
                      <Zap className="w-3 h-3" />
                      Powered by AI
                    </div>
                  </div>

                  {/* ── SK AI Photo — full portrait, no cropping ── */}
                  <div className="relative mx-4 mb-3 rounded-2xl overflow-hidden bg-[#0a0818] border border-white/8"
                    style={{ minHeight: '320px' }}
                  >
                    {/* Inner glow behind character */}
                    <div className="absolute inset-0 bg-gradient-to-t from-violet-900/60 via-transparent to-transparent pointer-events-none z-10" />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-violet-600/25 blur-2xl rounded-full pointer-events-none z-10" />

                    {/* Spinning orbit rings behind image */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                      <div className="w-72 h-72 rounded-full border border-violet-400/15"
                        style={{ animation: 'spin 14s linear infinite' }} />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                      <div className="w-80 h-80 rounded-full border border-fuchsia-400/10"
                        style={{ animation: 'spin 20s linear infinite reverse' }} />
                    </div>

                    {/* The actual image — full body, contained */}
                    <motion.img
                      src="/sk ai.png"
                      alt="SK AI Assistant"
                      animate={{ y: [0, -10, 0] }}
                      transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                      className="relative z-20 w-full h-full mx-auto block"
                      style={{
                        objectFit: 'contain',
                        objectPosition: 'center bottom',
                        maxHeight: '380px',
                        minHeight: '300px',
                        filter: 'drop-shadow(0 0 28px rgba(139,92,246,0.55)) drop-shadow(0 0 60px rgba(168,85,247,0.25))',
                      }}
                      draggable={false}
                    />

                    {/* Badge overlays on the photo */}
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2.5, repeat: Infinity }}
                      className="absolute top-3 right-3 z-30 w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 border-2 border-white/25 flex items-center justify-center shadow-xl"
                    >
                      <Bot className="w-5 h-5 text-white" />
                    </motion.div>

                    <motion.div
                      animate={{ scale: [1, 1.12, 1] }}
                      transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                      className="absolute top-3 left-3 z-30 w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 border-2 border-white/25 flex items-center justify-center shadow-xl"
                    >
                      <SparklesIcon className="w-4 h-4 text-white" />
                    </motion.div>
                  </div>

                  {/* Name & title */}
                  <div className="text-center px-5 pb-3">
                    <h3 className="text-2xl font-black text-white tracking-tight">
                      SK <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">AI Assistant</span>
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">Your intelligent study companion</p>
                  </div>

                  {/* Feature chips */}
                  <div className="flex flex-wrap justify-center gap-2 px-5 pb-4">
                    {[
                      { icon: <BookOpen className="w-3 h-3" />, label: 'Smart Explanations', color: 'text-violet-300 border-violet-500/35 bg-violet-500/10' },
                      { icon: <Trophy className="w-3 h-3" />, label: 'Quiz Generation', color: 'text-cyan-300 border-cyan-500/35 bg-cyan-500/10' },
                      { icon: <Zap className="w-3 h-3" />, label: 'Instant Answers', color: 'text-fuchsia-300 border-fuchsia-500/35 bg-fuchsia-500/10' },
                    ].map((chip, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.6 + i * 0.1 }}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${chip.color}`}
                      >
                        {chip.icon}
                        {chip.label}
                      </motion.span>
                    ))}
                  </div>

                  {/* Chat preview */}
                  <div className="mx-4 mb-5 rounded-2xl bg-white/5 border border-white/10 p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 border border-violet-400/40 bg-[#0a0818]">
                        <img src="/sk ai.png" alt="SK AI" className="w-full h-full object-contain" />
                      </div>
                      <div className="flex-1 bg-violet-600/20 border border-violet-500/25 rounded-2xl rounded-tl-none px-3.5 py-2.5">
                        <p className="text-sm text-gray-200 leading-relaxed">
                          Hi! I'm SK AI. Ask me anything about Chemistry, Physics, or your quizzes — I'm here to help! ✨
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pl-10">
                      <span className="text-[11px] text-gray-500">SK AI is ready</span>
                      <motion.span
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.4, repeat: Infinity }}
                        className="flex gap-1"
                      >
                        {[0, 1, 2].map(i => (
                          <span key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" />
                        ))}
                      </motion.span>
                    </div>
                  </div>

                  {/* Bottom bar */}
                  <div className="h-[3px] w-full bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-violet-500 opacity-60" />
                </div>

                {/* Floating stat bubbles */}

                <motion.div
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                  className="absolute -bottom-5 -right-5 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-2.5 shadow-xl z-20 pointer-events-none"
                >
                  <div className="text-[11px] text-gray-400 mb-0.5">AI Responses</div>
                  <div className="text-lg font-black text-cyan-300">⚡ Instant</div>
                </motion.div>

              </motion.div>

            </div>
          </main>
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            ref={teacherSectionRef}
            className="p-6 md:p-10 bg-gradient-to-br from-indigo-900/80 to-purple-900/80 backdrop-blur-sm text-white rounded-2xl shadow-2xl mx-auto max-w-6xl mt-2 mb-10 flex flex-col md:flex-row items-center justify-center gap-8 cursor-pointer border border-indigo-500/20 hover:scale-[1.01] transition-transform duration-300 relative overflow-hidden"
            onClick={handleTeacherClick}
          >
            {/* Glow accent */}
            <div className="absolute -top-16 -right-16 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="flex-shrink-0 relative z-10">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 blur-md opacity-60 scale-105" />
                <img
                  src="/chemistry_teacher2.webp"
                  alt="PCCOER Education Platform"
                  width={256}
                  height={256}
                  loading="lazy"
                  decoding="async"
                  className="relative w-48 h-48 md:w-64 md:h-64 rounded-full object-cover border-4 border-yellow-400 shadow-2xl"
                />
              </div>
            </div>
            <div className="text-center md:text-left relative z-10">
              <h2 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent mb-2">PCCOER Education Platform</h2>
              <h3 className="text-lg md:text-xl font-semibold text-indigo-200 mb-4">Pimpri Chinchwad College of Engineering & Research</h3>
              <p className="text-indigo-100/90 leading-relaxed max-w-2xl mx-auto md:mx-0 mb-5 text-sm md:text-base">
                PCCOER Education Platform by Pimpri Chinchwad College of Engineering & Research provides professional guidance that transforms complex concepts into easily digestible knowledge.
              </p>
              <Button onClick={handleTeacherClick} className="bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-300 hover:to-orange-300 text-indigo-900 font-bold py-2 px-7 rounded-full shadow-lg shadow-yellow-400/30">
                Read More
              </Button>
            </div>
          </motion.div>

          {/* Teacher Details Modal */}
          <Dialog open={showTeacherDetails} onOpenChange={setShowTeacherDetails}>
            <DialogContent
              className="sm:max-w-[800px] bg-gradient-to-br from-purple-700 to-indigo-900 text-white p-6 rounded-lg shadow-xl border border-purple-600 animate-scale-in max-h-[80vh] overflow-y-auto"
              aria-labelledby="teacher-dialog-title"
              aria-describedby="teacher-dialog-description"
            >
              <DialogHeader>
                <DialogTitle id="teacher-dialog-title" className="text-3xl font-extrabold text-yellow-300 mb-2">PCCOER Education Platform</DialogTitle>
                <DialogDescription id="teacher-dialog-description" className="text-xl font-semibold text-indigo-200 mb-4">Pimpri Chinchwad College of Engineering & Research</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="flex-shrink-0">
                  <img
                    src="/chemistry_teacher2.webp"
                    alt="PCCOER Education Platform"
                    width={192}
                    height={192}
                    loading="lazy"
                    decoding="async"
                    className="w-48 h-48 rounded-full object-cover border-4 border-yellow-400 shadow-lg"
                  />
                </div>
                <div className="text-lg text-indigo-100 leading-relaxed">
                  <p className="mb-4">PCCOER Education Platform by Pimpri Chinchwad College of Engineering & Research provides professional guidance that transforms complex concepts into easily digestible knowledge. Our dedication ensures every student receives the support needed to excel.</p>
                  <ul className="list-disc list-inside mb-4 space-y-2">
                    <li><span className="font-semibold text-yellow-200">Innovative Teaching:</span> Employs unique methodologies focusing on conceptual clarity and practical application.</li>
                    <li><span className="font-semibold text-yellow-200">Personalized Mentorship:</span> Offers one-on-one guidance to help students achieve their academic and career goals.</li>
                    <li><span className="font-semibold text-yellow-200">Proven Track Record:</span> Consistently helps students achieve top scores and develop a deep love for chemistry.</li>
                    <li><span className="font-semibold text-yellow-200">Comprehensive Curriculum:</span> Covers all essential topics with advanced insights, preparing students for competitive exams.</li>
                  </ul>
                  <p>Mr. Dhole Sir's commitment extends beyond the classroom, fostering an environment where curiosity thrives and every student is empowered to reach their full potential.</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Our Classes in Action Section */}
          <section className="p-4 md:p-8 bg-gradient-to-br from-blue-900/80 to-teal-900/80 backdrop-blur-sm text-white rounded-2xl shadow-2xl mx-auto max-w-6xl my-8 border border-blue-500/20">
            <motion.h2
              initial={{ opacity: 0, y: -10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl font-extrabold text-center mb-8 bg-gradient-to-r from-blue-300 to-teal-300 bg-clip-text text-transparent"
            >Our Classes in Action</motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[{
                img: "/physics_teacher1.webp",
                title: "Interactive Learning",
                description: "Engage with dynamic content and interactive modules for a richer learning experience.",
                color: "from-blue-500/20 to-cyan-500/20",
                border: "border-blue-500/30"
              },
              {
                img: "/chemistry_teacher1.webp",
                title: "AI Explanations",
                description: "Get instant, AI-powered explanations for complex topics and questions.",
                color: "from-purple-500/20 to-pink-500/20",
                border: "border-purple-500/30"
              },
              {
                img: "/math_teacher1.webp",
                title: "Real-time Dashboards",
                description: "Monitor your progress and performance with intuitive, real-time dashboards.",
                color: "from-indigo-500/20 to-blue-500/20",
                border: "border-indigo-500/30"
              },
              {
                img: "/english_teacher1.webp",
                title: "AI Question Generation",
                description: "Generate custom quizzes and practice questions with our advanced AI.",
                color: "from-teal-500/20 to-green-500/20",
                border: "border-teal-500/30"
              },
              {
                img: "/science_teacher1.webp",
                title: "Live Leaderboards",
                description: "Compete with peers and see your rank instantly on live leaderboards.",
                color: "from-yellow-500/20 to-orange-500/20",
                border: "border-yellow-500/30"
              },
              {
                img: "/principal.webp",
                title: "Shareable Quizzes",
                description: "Create and share quizzes with friends or students for collaborative learning.",
                color: "from-rose-500/20 to-red-500/20",
                border: "border-rose-500/30"
              },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.04, y: -4 }}
                  className={`bg-gradient-to-br ${item.color} border ${item.border} rounded-2xl shadow-lg overflow-hidden backdrop-blur-sm transition-all duration-300 group`}
                >
                  <div className="overflow-hidden">
                    <img
                      src={item.img}
                      alt={item.title}
                      width={400}
                      height={192}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-110 cursor-pointer"
                      onClick={() => {
                        setSelectedImage(item.img);
                        setIsModalOpen(true);
                      }}
                    />
                  </div>
                  <div className="p-5">
                    <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-blue-100/80 text-sm leading-relaxed">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
          <section ref={topPerformersSectionRef} className="p-4 md:p-8 bg-gradient-to-br from-purple-900/80 to-indigo-900/80 backdrop-blur-sm text-white rounded-2xl shadow-2xl mx-auto max-w-6xl my-8 border border-purple-500/20">
            <motion.h2
              initial={{ opacity: 0, y: -10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl font-extrabold text-center mb-4 bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent"
            >Our Top Performers</motion.h2>
            <p className="text-center text-indigo-200/80 mb-6 max-w-3xl mx-auto text-sm">Discover the brightest minds in our community! These students have consistently achieved outstanding results.</p>
            <div className="flex flex-wrap justify-center gap-6 md:gap-8">
              {topStudents.length > 0 ? (
                topStudents.map((student, index) => (
                  <StudentCard key={student.id} student={student} style={{ animationDelay: `${index * 100}ms` }} />
                ))
              ) : (
                <p className="col-span-full text-center text-indigo-300 text-lg">No top students to display yet. Keep playing to get on the leaderboard!</p>
              )}
            </div>
          </section>

          {/* YouTube Video Tutorials Section */}
          <section className="p-4 md:p-8 bg-gradient-to-br from-green-900/80 to-blue-900/80 backdrop-blur-sm text-white rounded-2xl shadow-2xl mx-auto max-w-6xl my-8 border border-green-500/20">
            <motion.h2
              initial={{ opacity: 0, y: -10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl font-extrabold text-center mb-6 bg-gradient-to-r from-green-300 to-cyan-300 bg-clip-text text-transparent"
            >YouTube Video Tutorials</motion.h2>
            
            {/* Search Bar */}
            <div className="max-w-md mx-auto mb-8">
              <div className="relative flex items-center space-x-2">
                <Search className="absolute left-3 text-blue-300" size={18} />
                <Input
                  type="text"
                  placeholder="Search videos by title, topic or chapter..."
                  value={searchQuery}
                  onChange={handleSearchInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearchButtonClick();
                    }
                  }}
                  className="flex-grow pl-10 bg-white/10 border-blue-400 text-white placeholder:text-blue-200 focus:ring-2 focus:ring-yellow-400"
                />
                <Button
                  onClick={handleSearchButtonClick}
                  className="bg-yellow-500 hover:bg-yellow-600 text-blue-900 font-bold py-2 px-4 rounded-full shadow-lg transform transition-transform duration-300 hover:scale-105"
                >
                  Search
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedVideos.length > 0 ? (
                displayedVideos.map((video, vidIdx) => (
                  <motion.div
                    id={`video-${video.id}`}
                    key={video.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: vidIdx * 0.05 }}
                    whileHover={{ scale: 1.03, y: -3 }}
                    className="bg-white/5 border border-green-500/20 rounded-2xl shadow-lg overflow-hidden backdrop-blur-sm transition-all duration-300"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <iframe
                      className="w-full h-48 pointer-events-auto"
                      src={`https://www.youtube.com/embed/${getYouTubeVideoId(video.url)}`}
                      title={video.title}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      playsInline
                    ></iframe>
                    <div className="p-4">
                      <h3 className="text-lg font-bold text-white mb-1">{video.title}</h3>
                      <p className="text-green-200/70 text-xs">Topic: {video.topic}</p>
                      <p className="text-cyan-200/70 text-xs cursor-pointer hover:underline" onClick={() => setSelectedChapter(video.chapter)}>Chapter: {video.chapter}</p>
                    </div>
                  </motion.div>
                ))
              ) : (
                <p className="col-span-full text-center text-green-200/70 text-lg py-8">No videos found for your search. Try a different keyword!</p>
              )}
            </div>
            
            <div className="flex justify-center mt-6 gap-3 flex-wrap">
              {!showChapters && (
                <Button onClick={() => setShowChapters(true)} className="bg-gradient-to-r from-green-600 to-cyan-600 hover:from-green-500 hover:to-cyan-500 text-white font-bold py-2 px-6 rounded-full shadow-lg">
                  Explore Chapters
                </Button>
              )}
              {showChapters && (
                <div className="flex flex-wrap justify-center gap-3">
                  {uniqueChapters.map(chapter => (
                    <Button
                      key={chapter}
                      onClick={() => { setSelectedChapter(chapter); setShowChapters(false); setShowAllVideos(true); }}
                      className={`font-bold py-2 px-5 rounded-full shadow-md transition-all ${selectedChapter === chapter ? 'bg-gradient-to-r from-purple-600 to-indigo-600' : 'bg-white/10 border border-white/20 hover:bg-white/20'} text-white`}
                    >
                      {chapter}
                    </Button>
                  ))}
                  <Button
                    onClick={() => { setSelectedChapter(null); setShowChapters(false); setShowAllVideos(false); }}
                    className="font-bold py-2 px-5 rounded-full bg-white/5 border border-white/10 hover:bg-white/15 text-gray-300"
                  >
                    View All
                  </Button>
                </div>
              )}
              {!showChapters && !selectedChapter && displayedVideos.length < filteredVideos.length && (
                <Button onClick={() => setShowAllVideos(!showAllVideos)} className="bg-white/10 border border-white/20 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-full">
                  {showAllVideos ? 'View Less' : 'View More'}
                </Button>
              )}
            </div>
            
            {/* Search Result Popup */}
            {showSearchPopup && searchResultVideo && (
              <motion.div
                initial={{ opacity: 0, x: 40, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40 }}
                className="fixed top-24 right-4 z-50 w-80 bg-gradient-to-br from-gray-900/95 to-indigo-950/95 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-green-500/30"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center p-3 border-b border-white/10">
                  <h3 className="text-white font-bold text-sm flex items-center gap-2">
                    <Search className="text-green-400 w-4 h-4" />
                    Search Result
                  </h3>
                  <button onClick={handleClosePopup} className="text-gray-400 hover:text-white w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">✕</button>
                </div>
                <div className="p-4">
                  <iframe
                    className="w-full h-40 mb-3 rounded-xl border border-white/10 pointer-events-auto"
                    src={`https://www.youtube.com/embed/${getYouTubeVideoId(searchResultVideo.url)}`}
                    title={searchResultVideo.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen playsInline
                  ></iframe>
                  <h4 className="text-base font-bold text-white mb-2">{searchResultVideo.title}</h4>
                  <p className="text-gray-400 text-xs">Topic: <span className="text-green-300">{searchResultVideo.topic}</span></p>
                  <p className="text-gray-400 text-xs mt-1">Chapter: <span className="text-cyan-300">{searchResultVideo.chapter}</span></p>
                  <Button
                    onClick={() => { setTimeout(() => { document.getElementById(`video-${searchResultVideo.id}`)?.scrollIntoView({ behavior: 'smooth' }); setShowSearchPopup(false); }, 100); }}
                    className="w-full mt-3 bg-gradient-to-r from-green-600 to-cyan-600 hover:from-green-500 hover:to-cyan-500 text-white text-xs rounded-xl"
                  >
                    Go to Video
                  </Button>
                </div>
              </motion.div>
            )}
          </section>
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="p-6 md:p-10 bg-gradient-to-br from-indigo-900/80 to-cyan-900/80 backdrop-blur-sm text-white rounded-2xl shadow-2xl mx-auto max-w-6xl my-8 border border-cyan-500/20"
          >
            <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-6 bg-gradient-to-r from-cyan-300 to-indigo-300 bg-clip-text text-transparent">Contact Us</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center mb-6">
              {[
                { label: 'Email', value: 'vivekddhole@gmail.com', href: 'mailto:vivekddhole@gmail.com', icon: '✉️' },
                { label: 'Phone', value: '+91 94232 49660', href: 'tel:+919423249660', icon: '📞' },
                { label: 'WhatsApp', value: '+91 94232 49660', href: 'https://wa.me/919423249660', icon: '💬' },
                { label: 'Location', value: 'Digras, Maharashtra', href: '#', icon: '📍' },
              ].map((item, i) => (
                <motion.a
                  key={i}
                  href={item.href}
                  whileHover={{ scale: 1.05, y: -2 }}
                  className="block p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm hover:bg-white/10 transition-all"
                >
                  <div className="text-3xl mb-2">{item.icon}</div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{item.label}</p>
                  <p className="text-sm font-semibold text-cyan-300">{item.value}</p>
                </motion.a>
              ))}
            </div>
            <div className="text-center">
              <Link 
                to="/contact" 
                className="inline-block px-8 py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-600 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-lg transition-all transform hover:scale-105"
              >
                📧 Send us a Message
              </Link>
            </div>
          </motion.section>
          <CreatorAttribution />
          <ConfettiAnimation active={showConfetti} />
        </div>

        {isModalOpen && selectedImage && (
          <div
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
            onClick={() => setIsModalOpen(false)}
          >
            <div className="relative max-w-3xl max-h-full overflow-auto" onClick={(e) => e.stopPropagation()}>
              <button
                className="absolute top-2 right-2 text-white text-3xl font-bold bg-gray-800 rounded-full w-10 h-10 flex items-center justify-center"
                onClick={() => setIsModalOpen(false)}
              >
                &times;
              </button>
              <img src={selectedImage} alt="Enlarged view" className="max-w-full max-h-full object-contain" />
            </div>
          </div>
        )}

        {/* Background Customization Modal */}
        <Dialog open={showCustomizeModal} onOpenChange={setShowCustomizeModal}>
          <DialogContent className="sm:max-w-[425px] bg-gradient-to-br from-indigo-800 to-purple-900 text-white p-6 rounded-lg shadow-xl border border-indigo-600">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-yellow-300">Customize Background</DialogTitle>
              <DialogDescription className="text-indigo-200">Upload an image or enter a URL to set as your background.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-full">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-indigo-200 mb-1">Use Default Rotating Backgrounds</label>
                  <Button 
                    onClick={() => setBackgroundImage(null)} 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    Use Default
                  </Button>
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-indigo-200 mb-1">Use Custom Background Image (URL)</label>
                  <div className="flex gap-2">
                    <Input 
                      type="text" 
                      placeholder="https://example.com/image.jpg" 
                      className="flex-1 bg-indigo-700/50 border-indigo-500 text-white placeholder:text-indigo-300"
                      value={backgroundImageUrl}
                      onChange={handleBackgroundUrlChange}
                    />
                    <Button 
                      onClick={applyBackgroundFromUrl}
                      className="bg-yellow-500 hover:bg-yellow-600 text-indigo-900"
                    >
                      Apply
                    </Button>
                  </div>
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-indigo-200 mb-1">Or Upload Image File</label>
                  <Button 
                    onClick={handleUploadClick} 
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-indigo-900 font-bold py-2 px-6 rounded shadow-lg"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose Image
                  </Button>
                </div>
              </div>
              
              {backgroundImage && (
                <div className="relative w-full h-40 rounded-lg overflow-hidden border-2 border-indigo-400">
                  <img src={backgroundImage} alt="Current background" className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-xs text-center py-1 text-white">Preview</div>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="absolute top-2 right-2" 
                    onClick={() => setBackgroundImage(null)}
                  >
                    Remove
                  </Button>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={customizeBackground} 
              />
            </div>
          </DialogContent>
        </Dialog>
      </BackgroundContainer>
    </>
  );
};

export default HomePage;

