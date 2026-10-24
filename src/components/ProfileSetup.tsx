import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import { Camera, Loader2, Sparkles, UserRound } from 'lucide-react';
import { uploadFileToCloudinary } from '@/lib/firebaseStorage';
import { avatars } from '@/utils/avatars';
import OrbitBackground from '@/components/ui/OrbitBackground';

const ProfileSetup: React.FC = () => {
  const { currentUser, updateProfile, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      setAvatarUrl(URL.createObjectURL(file)); // Show preview of selected file
    }
  };

  const [predefinedAvatars] = useState(avatars);

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/host-login');
      return;
    }

    if (currentUser?.user_metadata) {
      setNickname(currentUser.user_metadata.name || '');
      setAvatarUrl(currentUser.user_metadata.avatar_url || predefinedAvatars[0]);
      setBio(currentUser.user_metadata.bio || '');
    }
  }, [currentUser, isLoggedIn, navigate, predefinedAvatars]);

  const handleAvatarSelect = (avatarUrl: string) => {
    setAvatarUrl(avatarUrl);
    setAvatarFile(null);
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const previewUrl = URL.createObjectURL(file);
      setAvatarUrl(previewUrl);
    }
  };

  


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
        let finalAvatarUrl = currentUser?.user_metadata?.avatar_url || '';

        if (avatarFile && currentUser) {
          try {
            const uploadResult = await uploadFileToCloudinary(
              avatarFile,
              `avatars/${currentUser.uid}`
            );
            finalAvatarUrl = uploadResult.downloadURL;
            toast({
              title: "Avatar Uploaded",
              description: "Your profile picture was successfully uploaded to Cloudinary.",
              variant: "default",
            });
          } catch (uploadError) {
            toast({
              title: "Upload Failed",
              description: "Failed to upload profile picture to Cloudinary.",
              variant: "destructive",
            });
            throw new Error("Failed to upload avatar to Cloudinary");
          }
        } else if (avatarUrl && avatarUrl !== currentUser?.user_metadata?.avatar_url) {
          finalAvatarUrl = avatarUrl;
        }

      await updateProfile({
        name: nickname,
        avatar_url: finalAvatarUrl,
        bio: bio
      });

      toast({
        title: 'Profile updated',
        description: 'Your profile has been set up successfully!',
      });

      navigate('/host-dashboard');

    } catch (error: any) {

      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full max-w-md mx-auto">
      <div className="relative overflow-hidden lab-panel lab-panel-glow">
        <OrbitBackground />
        <div className="relative z-10 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-3 py-1 mb-3">
                <Sparkles className="h-3 w-3" /> Profile Setup
              </span>
              <h2 className="lab-heading text-2xl sm:text-3xl">Complete Your Profile</h2>
              <p className="text-sm text-gray-400 mt-1.5">
                Add a photo and a few details so others can recognize you
              </p>
            </div>

            <div className="flex flex-col items-center space-y-5">
              <div className="relative">
                <div className="avatar-ring">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={avatarUrl} alt="Profile" />
                    <AvatarFallback className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
                      {nickname?.charAt(0)?.toUpperCase() || <UserRound className="w-8 h-8" />}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <label
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 p-2 bg-gradient-to-br from-cyan-500 to-indigo-600 text-white rounded-full cursor-pointer shadow-lg shadow-indigo-500/30 hover:scale-110 transition-transform"
                >
                  <Camera className="w-4 h-4" />
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </label>
              </div>

              <div className="w-full">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 text-center font-display">
                  Or pick an avatar
                </p>
                <div className="grid grid-cols-5 gap-2.5 w-full p-2 lab-panel !bg-white/[0.03] !border-white/5">
                  <button
                    type="button"
                    onClick={() => handleAvatarSelect(avatarUrl)}
                    className={`avatar-chip ${avatarUrl && !predefinedAvatars.includes(avatarUrl) ? 'selected' : ''}`}
                  >
                    <Avatar className="w-11 h-11">
                      <AvatarImage src={avatarUrl} alt="Current avatar" />
                    </Avatar>
                  </button>
                  {predefinedAvatars.map((avatar, index) => (
                    <button
                      key={index}
                      type="button"
                      className={`avatar-chip ${avatarUrl === avatar ? 'selected' : ''}`}
                      onClick={() => handleAvatarSelect(avatar)}
                    >
                      <Avatar className="w-11 h-11">
                        <AvatarImage src={avatar} alt={`Avatar ${index + 1}`} />
                      </Avatar>
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full space-y-4">
                <div>
                  <Input
                    placeholder="Nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full lab-input text-white placeholder:text-gray-500 rounded-xl h-11"
                  />
                </div>

                <div>
                  <Textarea
                    placeholder="Tell us a bit about yourself"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full h-24 resize-none lab-input text-white placeholder:text-gray-500 rounded-xl"
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:opacity-90 text-white font-semibold font-display shadow-lg shadow-indigo-500/25 transition-opacity"
              disabled={isLoading || !nickname.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Complete Setup'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
