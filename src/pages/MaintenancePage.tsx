import { useEffect, useRef, useState } from "react";

const MaintenancePage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const animationStateRef = useRef({ rotationX: 0, rotationY: 0, particles: [] as any[] });

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // Loading animation timer - show only briefly
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  // 3D Canvas Animation - Continuous (PERSISTENT)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Initialize particles on first load
    if (animationStateRef.current.particles.length === 0) {
      const particles: Array<{
        x: number;
        y: number;
        z: number;
        vx: number;
        vy: number;
        vz: number;
        size: number;
        color: string;
      }> = [];

      for (let i = 0; i < 60; i++) {
        particles.push({
          x: Math.random() * canvas.width - canvas.width / 2,
          y: Math.random() * canvas.height - canvas.height / 2,
          z: Math.random() * 400 - 200,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          vz: (Math.random() - 0.5) * 1.5,
          size: Math.random() * 2 + 1,
          color: Math.random() > 0.5 ? "rgba(59, 130, 246, 0.6)" : "rgba(168, 85, 247, 0.6)",
        });
      }
      animationStateRef.current.particles = particles;
    }

    const particles = animationStateRef.current.particles;

    const rotateX = (point: [number, number, number], angle: number): [number, number, number] => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return [
        point[0],
        point[1] * cos - point[2] * sin,
        point[1] * sin + point[2] * cos,
      ];
    };

    const rotateY = (point: [number, number, number], angle: number): [number, number, number] => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return [
        point[0] * cos + point[2] * sin,
        point[1],
        -point[0] * sin + point[2] * cos,
      ];
    };

    let animationFrameId: number;
    
    const animate = () => {
      // Continuous background - no fade
      ctx.fillStyle = "rgba(15, 23, 42, 0.02)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Continuous smooth rotation - NEVER STOPS
      animationStateRef.current.rotationX += 0.002;
      animationStateRef.current.rotationY += 0.003;

      // Update and draw particles continuously
      particles.forEach((particle) => {
        // Continuous movement
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.z += particle.vz;

        // Smooth wrap around with buffer
        if (particle.x > canvas.width / 2 + 100) particle.x = -canvas.width / 2 - 100;
        if (particle.x < -canvas.width / 2 - 100) particle.x = canvas.width / 2 + 100;
        if (particle.y > canvas.height / 2 + 100) particle.y = -canvas.height / 2 - 100;
        if (particle.y < -canvas.height / 2 - 100) particle.y = canvas.height / 2 + 100;
        if (particle.z > 200) particle.z = -200;
        if (particle.z < -200) particle.z = 200;

        // 3D rotation using stored state
        let point: [number, number, number] = [particle.x, particle.y, particle.z];
        point = rotateX(point, animationStateRef.current.rotationX);
        point = rotateY(point, animationStateRef.current.rotationY);

        // Perspective projection
        const scale = 400 / (point[2] + 300);
        const x = point[0] * scale + canvas.width / 2;
        const y = point[1] * scale + canvas.height / 2;
        const depth = (point[2] + 200) / 400;

        // Draw particle with glow
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, particle.size * 3);
        gradient.addColorStop(0, particle.color.replace("0.6", "0.8"));
        gradient.addColorStop(1, particle.color.replace("0.6", "0"));

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, particle.size * (depth * 1.5 + 0.5), 0, Math.PI * 2);
        ctx.fill();

        // Draw connecting lines between nearby particles
        particles.forEach((otherParticle) => {
          const dx = otherParticle.x - particle.x;
          const dy = otherParticle.y - particle.y;
          const dz = otherParticle.z - particle.z;
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (distance < 180) {
            let otherPoint: [number, number, number] = [otherParticle.x, otherParticle.y, otherParticle.z];
            otherPoint = rotateX(otherPoint, animationStateRef.current.rotationX);
            otherPoint = rotateY(otherPoint, animationStateRef.current.rotationY);

            const otherScale = 400 / (otherPoint[2] + 300);
            const otherX = otherPoint[0] * otherScale + canvas.width / 2;
            const otherY = otherPoint[1] * otherScale + canvas.height / 2;

            ctx.strokeStyle = `rgba(99, 102, 241, ${0.15 * (1 - distance / 180)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(otherX, otherY);
            ctx.stroke();
          }
        });
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Loading Screen Component
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center relative overflow-hidden">
        {/* Loading Canvas Background */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ opacity: 0.7 }}
        />

        {/* Loading Content */}
        <div className="relative z-10 text-center">
          {/* Animated loading logo */}
          <div className="mb-12 flex justify-center">
            <div className="relative w-32 h-32">
              {/* Outer rotating ring - fast */}
              <div
                className="absolute inset-0 border-4 border-transparent border-t-cyan-500 border-r-purple-600 rounded-full"
                style={{
                  animation: "spin 1.5s linear infinite",
                }}
              ></div>

              {/* Middle rotating ring - medium speed, reverse */}
              <div
                className="absolute inset-4 border-3 border-transparent border-b-purple-500 border-l-cyan-600 rounded-full"
                style={{
                  animation: "spin 2.5s linear infinite reverse",
                }}
              ></div>

              {/* Inner rotating ring - slow */}
              <div
                className="absolute inset-8 border-2 border-transparent border-t-cyan-400 border-b-purple-400 rounded-full"
                style={{
                  animation: "spin 4s linear infinite",
                }}
              ></div>

              {/* Center pulsing dot */}
              <div className="absolute inset-12 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-full animate-pulse"></div>
            </div>
          </div>

          {/* Loading text */}
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Preparing Maintenance
          </h2>

          <p className="text-slate-400 mb-8 text-lg">
            <span className="inline-block">
              Loading
              <span className="animate-pulse">.</span>
              <span className="animate-pulse animation-delay-200">.</span>
              <span className="animate-pulse animation-delay-400">.</span>
            </span>
          </p>

          {/* Progress bar */}
          <div className="w-64 h-1 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full"
              style={{
                animation: "loadingProgress 2.8s ease-in-out forwards",
              }}
            ></div>
          </div>
        </div>

        <style>{`
          @keyframes spin {
            from {
              transform: rotate(360deg);
            }
            to {
              transform: rotate(0deg);
            }
          }

          @keyframes loadingProgress {
            0% {
              width: 0%;
            }
            100% {
              width: 100%;
            }
          }

          .animation-delay-200 {
            animation-delay: 0.2s;
          }

          .animation-delay-400 {
            animation-delay: 0.4s;
          }
        `}</style>
      </div>
    );
  }

  // Main Maintenance Page
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* 3D Canvas Background - Continuous */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.7 }}
      />

      {/* Content Container */}
      <div className="relative z-10 w-full max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left Side - Developer Image with Advanced Animations */}
          <div className="flex justify-center lg:justify-end perspective">
            <div className="relative w-full max-w-sm group">
              {/* Floating animation wrapper */}
              <div
                className="relative animate-pulse"
                style={{
                  animation: "float 6s ease-in-out infinite",
                }}
              >
                {/* Outer glow rings */}
                <div className="absolute -inset-8 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-lg blur-2xl group-hover:from-cyan-500/30 group-hover:to-purple-500/30 transition-all duration-500"></div>

                {/* Animated border - top & left */}
                <div
                  className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    animation: "borderFlowH 3s linear infinite",
                    backgroundSize: "300% 100%",
                    WebkitMaskImage:
                      "linear-gradient(90deg, transparent 0%, black 5%, black 95%, transparent 100%)",
                  }}
                ></div>

                {/* Animated border - bottom & right */}
                <div
                  className="absolute -inset-1 bg-gradient-to-l from-purple-500 to-purple-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    animation: "borderFlowV 3s linear infinite reverse",
                    backgroundSize: "100% 300%",
                    WebkitMaskImage:
                      "linear-gradient(180deg, transparent 0%, black 5%, black 95%, transparent 100%)",
                  }}
                ></div>

                {/* Main Image Container */}
                <div className="relative bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-lg overflow-hidden border border-cyan-500/30 backdrop-blur-sm shadow-2xl group-hover:border-purple-500/50 transition-colors duration-500">
                  {/* Developer Image */}
                  <img
                    src="/developer.jpg"
                    alt="Suraj Zalke - AI Developer"
                    width={500}
                    height={600}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />

                  {/* Glow overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 via-transparent to-purple-500/0 rounded-lg pointer-events-none"></div>
                </div>

                {/* Floating corner dots */}
                <div
                  className="absolute -bottom-4 -right-4 w-8 h-8 border-2 border-cyan-500 rounded-full opacity-60 group-hover:opacity-100 transition-opacity"
                  style={{
                    animation: "pulse 2s ease-in-out infinite",
                  }}
                ></div>
                <div
                  className="absolute -top-4 -left-4 w-8 h-8 border-2 border-purple-500 rounded-full opacity-60 group-hover:opacity-100 transition-opacity"
                  style={{
                    animation: "pulse 2s ease-in-out infinite 1s",
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Right Side - Content with Smooth Animations */}
          <div className="space-y-6 md:space-y-8">
            {/* Heading Section - Slide in animation */}
            <div
              className="space-y-4"
              style={{
                animation: "slideInRight 0.8s ease-out",
              }}
            >
              <p className="text-cyan-400 text-sm uppercase tracking-widest font-semibold mb-2 flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
                Under Maintenance
              </p>
              <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
                We're improving your experience
              </h1>
              <p className="text-slate-300 text-lg leading-relaxed">
                The platform is temporarily unavailable while we enhance features and improve performance. We're working to bring you back an even better experience.
              </p>
            </div>

            {/* Status Box - Fade in animation */}
            <div
              className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-6 space-y-3 hover:border-cyan-500/60 hover:bg-slate-800/70 transition-all duration-500"
              style={{
                animation: "fadeIn 1s ease-out 0.3s both",
              }}
            >
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 animate-pulse flex-shrink-0"></div>
                <div>
                  <p className="text-cyan-300 font-semibold">Status: Maintenance in Progress</p>
                  <p className="text-slate-400 text-sm mt-1">
                    We expect to be back online within a few hours. Thank you for your patience!
                  </p>
                </div>
              </div>
            </div>

            {/* Developer Info Section - Slide up animation */}
            <div
              className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-purple-500/30 rounded-lg p-6 space-y-4 hover:border-purple-500/60 hover:from-slate-800/60 hover:to-slate-900/60 transition-all duration-500 transform hover:scale-105 hover:shadow-xl hover:shadow-purple-500/20"
              style={{
                animation: "slideInUp 0.8s ease-out 0.6s both",
              }}
            >
              <p className="text-slate-300 text-sm">
                <span className="text-purple-400 font-semibold">Developed & Maintained by:</span>
              </p>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent bg-size-200 animate-gradient">
                  Suraj Zalke
                </h3>
                <p className="text-slate-300 text-sm font-medium">
                  Independent AI Developer & Software Engineer
                </p>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Specializing in AI-driven applications, automation tooling, computer vision, and voice interfaces. Building intelligent systems that solve real-world problems.
                </p>
              </div>

              {/* Contact Button - Bounce animation */}
              <a
                href="https://suraj-zalke-protfolio.netlify.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-110 hover:shadow-lg hover:shadow-purple-500/50 group active:scale-95 mt-4"
                style={{
                  animation: "bounceIn 0.8s ease-out 0.9s both",
                }}
              >
                <svg
                  className="w-4 h-4 group-hover:rotate-45 transition-transform duration-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <span>Contact Developer</span>
                <svg
                  className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </a>
            </div>

            {/* Action Button - Scale animation */}
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 active:scale-95"
              style={{
                animation: "slideInUp 0.8s ease-out 1.2s both",
              }}
            >
              Refresh Page
            </button>

            {/* Footer */}
            <p
              className="text-xs text-slate-500 text-center"
              style={{
                animation: "fadeIn 1s ease-out 1.5s both",
              }}
            >
              Dhole Sir Coaching Classes © {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        @keyframes spin {
          from {
            transform: rotate(360deg);
          }
          to {
            transform: rotate(0deg);
          }
        }

        @keyframes borderFlowH {
          0% {
            background-position: 0% 0%;
          }
          100% {
            background-position: 300% 0%;
          }
        }

        @keyframes borderFlowV {
          0% {
            background-position: 0% 0%;
          }
          100% {
            background-position: 0% 300%;
          }
        }

        @keyframes gradientShift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        @keyframes textGlow {
          0%, 100% {
            text-shadow: 0 0 5px rgba(34, 211, 238, 0.5);
          }
          50% {
            text-shadow: 0 0 20px rgba(168, 85, 247, 0.8);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(40px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 0.6;
          }
          50% {
            opacity: 1;
          }
        }

        .animate-gradient {
          background-size: 200% 200%;
          animation: gradientShift 3s ease infinite;
        }
      `}</style>
    </div>
  );
};

export default MaintenancePage;
