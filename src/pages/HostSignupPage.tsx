import React from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import HostSignupForm from "@/components/HostSignupForm";
import BackgroundContainer from "@/components/BackgroundContainer";
import { lazy, Suspense } from "react";
const CreatorAttribution = lazy(() => import("@/components/CreatorAttribution"));

const HostSignupPage: React.FC = () => {
  return (
    <BackgroundContainer>
      <header className="container mx-auto p-4">
        <Link to="/" className="inline-block">
          <Logo />
        </Link>
      </header>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md transform hover:scale-[1.01] transition-all duration-500">
          <HostSignupForm />
        </div>
      </div>
      <footer className="container mx-auto p-4 text-center text-white text-sm">
        <p>&copy; {new Date().getFullYear()} Science Stream Quiz Arena</p>
      </footer>
      <Suspense fallback={<div></div>}>
        <CreatorAttribution />
      </Suspense>
    </BackgroundContainer>
  );
};

export default HostSignupPage;
