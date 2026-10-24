import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from "@/lib/firebaseConfig";
import { getDatabase } from "firebase/database";
const db = getDatabase();
import { User, onAuthStateChanged, AuthError, Auth, updateProfile as updateProfileFirebase, UserCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import { ref, get, set, onValue, update, serverTimestamp } from "firebase/database";
import { useToast } from "@/components/ui/use-toast";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useNavigate } from "react-router-dom";
import { ensureVIPPlayerExists } from "@/utils/vipAdmin";


interface AuthContextType {
  currentUser: (User & { user_metadata?: { name?: string; avatar_url?: string; bio?: string; email?: string; createdAt?: object; } }) | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
  isLoggedIn: () => boolean;
  updateProfile: (data: { name?: string; avatar_url?: string; bio?: string }) => Promise<void>;
  // refreshSession: () => Promise<void>; // Firebase handles sessions differently
  resetPassword: (email: string) => Promise<void>;
  confirmPasswordReset: (email: string, code: string, newPassword: string) => Promise<void>;
}
 
 export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<(User & { user_metadata?: { name?: string; avatar_url?: string; bio?: string; email?: string; createdAt?: object; } }) | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const functions = getFunctions();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      console.log('onAuthStateChanged: user changed', user);
      if (user) {
        // Seed VIP admin player record (Runs after auth to avoid PERMISSION_DENIED)
        ensureVIPPlayerExists();

        // Fetch profile data from Realtime Database
        const profileRef = ref(db, 'profiles/' + user.uid);
        console.log('onAuthStateChanged: Fetching profile for user', user.uid);
        try {
          const snapshot = await get(profileRef);

          console.log('onAuthStateChanged: Snapshot exists?', snapshot.exists()); // Added log

          if (snapshot.exists()) {
          console.log('onAuthStateChanged: Profile exists', snapshot.val());
          const profileData = snapshot.val();
          console.log('onAuthStateChanged: Profile name from DB:', profileData?.name);
          // Profile exists, update currentUser state with fetched profile data
          const userWithMetadata = user as typeof currentUser;
          userWithMetadata.user_metadata = profileData;
          setCurrentUser(userWithMetadata);
          setLoading(false);
        } else {
            console.warn(`onAuthStateChanged: Profile data not found for user ${user.uid}. Creating a new profile.`);
            // Profile does not exist, create it in Realtime Database
            const newProfileData = {
              name: user.displayName || user.email || 'New User',
               avatar_url: user.photoURL || 'https://www.gravatar.com/avatar/?d=mp',
               bio: '',
               email: user.email || '',
               createdAt: serverTimestamp(),
             };
            console.log('onAuthStateChanged: Creating new profile with data:', newProfileData);
            console.log('onAuthStateChanged: user.displayName:', user.displayName);
            console.log('onAuthStateChanged: user.email:', user.email);
            try { // Added try-catch for profile creation
              await set(profileRef, newProfileData);
              console.log('onAuthStateChanged: Profile created successfully'); // Added log
              const userWithMetadata = user as typeof currentUser;
              userWithMetadata.user_metadata = newProfileData;
              setCurrentUser(userWithMetadata);
              setLoading(false);
            } catch (createError) { // Added catch block
              console.error('onAuthStateChanged: Error creating profile:', createError); // Added log
              // Decide how to handle creation error - maybe set currentUser to null or show a toast
              setCurrentUser(null);
              setLoading(false);
              return; // Stop further processing if profile creation fails
            }
          }
          console.log('onAuthStateChanged: currentUser after profile fetch/create:', currentUser); // Added log
        } catch (error) {
          console.error(`onAuthStateChanged: Error fetching or creating profile for user ${user.uid}:`, error);
          // Optionally, handle the error by setting currentUser to null or showing a toast
          setCurrentUser(null);
          setLoading(false);
          return; // Stop further processing for this user if profile fetch/create fails
                  }
 
           // Real-time subscription for profile changes
          const unsubscribeProfile = onValue(profileRef, (snapshot) => {
            if (snapshot.exists()) {
              console.log('Profile update received via real-time:', snapshot.val());
              const updatedProfileData = snapshot.val();
              console.log('Profile update received via real-time - name:', updatedProfileData?.name);
              if (user) {
                const userWithMetadata = user as typeof currentUser;
                userWithMetadata.user_metadata = updatedProfileData;
                setCurrentUser(userWithMetadata);
              }
            } else {
               console.log('Profile removed via real-time for user:', user?.uid);
               // Handle case where profile is removed from database
               if (user) {
                  setCurrentUser(user);
               }
            }
          });

          // Return unsubscribe function for profile listener
          return () => {
            console.log('onAuthStateChanged: Unsubscribing from profile listener for user', user.uid);
            unsubscribeProfile();
          };

        } else {
          console.log('onAuthStateChanged: user is null');
          setCurrentUser(null);
        }
        setLoading(false);
      });

    // Return unsubscribe function for auth listener
    return () => {
      console.log('AuthProvider: Cleaning up onAuthStateChanged listener');
      unsubscribeAuth();
    };
  }, []);


  const isLoggedIn = () => {
    console.log('isLoggedIn:', currentUser !== null); // Added log
    return currentUser !== null;
  };

  const login = async (email: string, password: string): Promise<User> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Manually fetch profile data and update currentUser immediately after login
      const profileRef = ref(db, 'profiles/' + user.uid);
      const snapshot = await get(profileRef);

      if (snapshot.exists()) {
        const profileData = snapshot.val();
        setCurrentUser({
          ...user,
          user_metadata: profileData
        });
      } else {
        // If profile doesn't exist, create a basic one
        const newProfileData = {
          name: user.displayName || user.email || 'New User',
          avatar_url: user.photoURL || 'https://www.gravatar.com/avatar/?d=mp',
          bio: '',
          email: user.email || '',
          createdAt: serverTimestamp(),
        };
        await set(profileRef, newProfileData);
        setCurrentUser({
          ...user,
          user_metadata: newProfileData
        });
      }
      setLoading(false); // Ensure loading is set to false after user is fully loaded
      return user;
    } catch (error: any) {
      let errorMessage = 'An unexpected error occurred during login.';
      if (error.code) {
        switch (error.code) {
          case 'auth/invalid-email':
            errorMessage = 'Invalid email address.';
            break;
          case 'auth/user-disabled':
            errorMessage = 'This user account has been disabled.';
            break;
          case 'auth/user-not-found':
            errorMessage = 'No user found with this email.';
            break;
          case 'auth/wrong-password':
            errorMessage = 'Incorrect password.';
            break;
          case 'auth/invalid-credential':
            errorMessage = 'Invalid email or password.';
            break;
          default:
            errorMessage = error.message;
            break;
        }
      }
      throw new Error(errorMessage);
    }
  };



  const signup = async (name: string, email: string, password: string): Promise<User> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const { user } = userCredential;

      // Update user profile in Firebase Auth
      await updateProfileFirebase(user, {
        displayName: name,
        photoURL: user.photoURL || 'https://www.gravatar.com/avatar/?d=mp', // Use user's photoURL or a default Gravatar if empty
      });

      // Create a profile entry in Realtime Database with all necessary fields
      await set(ref(db, 'profiles/' + user.uid), {
        name: name,
        avatar_url: user.photoURL || 'https://www.gravatar.com/avatar/?d=mp',
        bio: '',
        email: email,
        createdAt: serverTimestamp(),
      });

       return user;
     } catch (error: any) {
       let errorMessage = 'An unexpected error occurred during signup.';
       if (error.code) {
         switch (error.code) {
           case 'auth/email-already-in-use':
             errorMessage = 'The email address is already in use by another account.';
             break;
           case 'auth/invalid-email':
             errorMessage = 'The email address is not valid.';
             break;
           case 'auth/operation-not-allowed':
             errorMessage = 'Email/password accounts are not enabled.';
             break;
           case 'auth/weak-password':
             errorMessage = 'The password is too weak.';
             break;
           default:
             errorMessage = error.message;
             break;
         }
       }
       throw new Error(errorMessage);
     }
   };
 
   const logout = async () => {
     try {
       await signOut(auth);
       toast({
         title: "Logged out",
         description: "You have been successfully logged out.",
       });
       navigate("/host-login");
     } catch (error: any) {
       console.error("Logout failed:", error.message);
       toast({
         variant: "destructive",
         title: "Logout failed",
         description: error.message || "An error occurred during logout.",
       });
     }
   };
 
   const updateProfile = async (data: { name?: string; avatar_url?: string; bio?: string }) => {
     if (!currentUser) {
       throw new Error("No user logged in.");
     }
 
     try {
       // Update Firebase Auth profile
       await updateProfileFirebase(currentUser, {
         displayName: data.name || currentUser.displayName,
         photoURL: data.avatar_url || currentUser.photoURL,
       });
 
       // Update Realtime Database profile
       const profileRef = ref(db, 'profiles/' + currentUser.uid);
       await update(profileRef, {
         name: data.name || currentUser.displayName,
         avatar_url: data.avatar_url || currentUser.photoURL || 'https://www.gravatar.com/avatar/?d=mp',
         bio: data.bio || (currentUser.user_metadata?.bio || ''),
       });
 
       toast({
         title: "Profile Updated",
         description: "Your profile has been successfully updated.",
       });
     } catch (error: any) {
       console.error("Profile update failed:", error.message);
       toast({
         variant: "destructive",
         title: "Profile update failed",
         description: error.message || "An error occurred while updating your profile.",
       });
       throw error;
     }
   };
 
   const resetPassword = async (email: string) => {
     try {
       await sendPasswordResetEmail(auth, email);
       toast({
         title: "Password Reset Email Sent",
         description: "A password reset link has been sent to your email address.",
       });
     } catch (error: any) {
       let errorMessage = 'An unexpected error occurred during password reset.';
       if (error.code) {
         switch (error.code) {
           case 'auth/invalid-email':
             errorMessage = 'The email address is not valid.';
             break;
           case 'auth/user-not-found':
             errorMessage = 'No user found with this email.';
             break;
           default:
             errorMessage = error.message;
             break;
         }
       }
       console.error("Password reset failed:", errorMessage);
       toast({
         variant: "destructive",
         title: "Password Reset Failed",
         description: errorMessage,
       });
       throw new Error(errorMessage);
     }
   };
 
   const confirmPasswordReset = async (email: string, code: string, newPassword: string) => {
     try {
       const verifyPasswordResetCodeCallable = httpsCallable(functions, 'verifyPasswordResetCode');
       await verifyPasswordResetCodeCallable({ oobCode: code });
 
       const confirmPasswordResetCallable = httpsCallable(functions, 'confirmPasswordReset');
       await confirmPasswordResetCallable({ oobCode: code, newPassword: newPassword });
 
       toast({
         title: "Password Reset Successful",
         description: "Your password has been reset. You can now log in with your new password.",
       });
     } catch (error: any) {
       let errorMessage = 'An unexpected error occurred during password reset confirmation.';
       if (error.code) {
         switch (error.code) {
           case 'auth/expired-action-code':
             errorMessage = 'The password reset link has expired.';
             break;
           case 'auth/invalid-action-code':
             errorMessage = 'The password reset link is invalid.';
             break;
           case 'auth/user-disabled':
             errorMessage = 'The user account has been disabled.';
             break;
           case 'auth/user-not-found':
             errorMessage = 'No user found with this email.';
             break;
           case 'auth/weak-password':
             errorMessage = 'The new password is too weak.';
             break;
           default:
             errorMessage = error.message;
             break;
         }
       }
       console.error("Password reset confirmation failed:", errorMessage);
       toast({
         variant: "destructive",
         title: "Password Reset Failed",
         description: errorMessage,
       });
       throw new Error(errorMessage);
     }
   };
 
   const value = {
     currentUser,
     loading,
     login,
     signup,
     logout,
     isLoggedIn,
     updateProfile,
     resetPassword,
     confirmPasswordReset,
   };
 
   return (
     <AuthContext.Provider value={value}>
       {!loading && children}
     </AuthContext.Provider>
   );
 };

