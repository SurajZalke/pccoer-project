
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { sendPasswordResetCode } from "@/services/firebaseService";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";
import { AlertCircle, LogIn, Eye, EyeOff } from "lucide-react";
import PasswordResetForm from './PasswordResetForm'; // Import the new component
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
<meta name="google-site-verification" content="pkmknusJfsYMLKfeycQLKDeW4-r8vtXU_1U9YYePvQU" />

const HostLoginForm: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordReset, setShowPasswordReset] = useState(false); // State to control dialog visibility
  const [resetEmail, setResetEmail] = useState(''); // State to store email for reset
  const { login, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();



  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    console.log("HostLoginForm: handleLogin called."); // Added log

    if (!email || !password) {
      setError("Please enter both email and password");
      console.log("HostLoginForm: Login attempt failed: Email or password missing"); // Added log
      return;
    }

    setIsLoading(true);
    console.log("HostLoginForm: setIsLoading(true)"); // Added log
    console.log("HostLoginForm: Login attempt started for email:", email); // Added log
    
    try {
      console.log("HostLoginForm: Calling login function from AuthContext..."); // Added log
      const user = await login(email, password);
      console.log("HostLoginForm: login function returned."); // Added log
      console.log("HostLoginForm: Login successful for user:", user); // Added log
      toast({
        title: "Welcome back!",
        description: "Successfully logged in",
      });
      console.log("HostLoginForm: Navigating to /host-dashboard."); // Added log
      navigate("/host-dashboard");
    } catch (error: any) {
      console.error("HostLoginForm: Login failed:", error.message); // Added log
      setError(error.message);
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message || "Please check your credentials and try again",
      });
    } finally {
      setIsLoading(false);
      console.log("HostLoginForm: setIsLoading(false)"); // Added log
      console.log("HostLoginForm: Login process finished."); // Added log
    }
  };

  const handleForgotPassword = () => {
    navigate('/forgot-password');
  };

  return (
    <Card className="quiz-card w-full max-w-md mx-auto">
      <CardContent className="pt-6">
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-quiz-dark dark:text-white">Host Login</h2>
            <p className="text-gray-500 dark:text-gray-300 text-sm">Sign in to access your host dashboard</p>
          </div>
          
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 p-3 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          
          <div className="space-y-3">
            <div>
              <Input
                type="email"
                placeholder="Email"
                className="quiz-input dark:bg-gray-800 dark:border-gray-700"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                className="quiz-input dark:bg-gray-800 dark:border-gray-700 pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <div className="text-right text-sm">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-quiz-primary hover:underline font-medium"
              >
                Forgot Password?
              </button>
            </div>
          </div>
          
          <Button
            type="submit"
            className="quiz-btn-primary w-full flex items-center justify-center gap-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </span>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Sign In
              </>
            )}
          </Button>
          
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            Don't have an account?{" "}
            <Link to="/host-signup" className="text-quiz-primary hover:underline font-medium">
              Sign up
            </Link>
          </div>
        </form>
      </CardContent>

      <Dialog open={showPasswordReset} onOpenChange={setShowPasswordReset}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter the verification code sent to your email and your new password.
            </DialogDescription>
          </DialogHeader>
          <PasswordResetForm
            email={resetEmail}
            onResetSuccess={() => {
              setShowPasswordReset(false);
              setResetEmail('');
            }}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default HostLoginForm;
