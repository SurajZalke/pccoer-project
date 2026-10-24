import React from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import BackgroundContainer from "@/components/BackgroundContainer";
import { lazy, Suspense } from "react";
const CreatorAttribution = lazy(() => import("@/components/CreatorAttribution"));

const NotFound: React.FC = () => {
  return (
    <BackgroundContainer className="flex flex-col justify-center items-center p-4">
      <div className="mb-8">
        <Logo size="lg" />
      </div>
      <div className="max-w-md w-full quiz-card text-center p-8 attractive-glow">
        <h1 className="text-6xl font-bold text-quiz-primary mb-4">404</h1>
        <h2 className="text-2xl font-bold text-quiz-dark mb-4">Page Not Found</h2>
        <p className="text-gray-600 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/">
          <Button className="quiz-btn-primary animate-pulse-scale shadow-glow-purple">
            Back to Home
          </Button>
        </Link>
      </div>
      <Suspense fallback={<div></div>}>
        <CreatorAttribution />
      </Suspense>
    </BackgroundContainer>
  );
};

export default NotFound;
