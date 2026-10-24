import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Upload, Calendar, Check, Crop } from 'lucide-react';
import Cropper from 'react-easy-crop';
import RazorpayPaymentForm from '@/components/RazorpayPaymentForm';
import { 
  uploadCustomAvatar,
  getDaysRemaining
} from '@/services/avatarService';

interface AvatarSectionProps {
  userId: string;
  playerName: string;
  onAvatarSelect: (avatarUrl: string) => void;
  currentAvatar: string | null;
  rollNo?: string; // Add roll number
}

export const AvatarSection: React.FC<AvatarSectionProps> = ({
  userId,
  playerName,
  onAvatarSelect,
  currentAvatar,
  rollNo,
}) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [step, setStep] = useState<'view' | 'upload' | 'crop' | 'confirm' | 'payment'>('view');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [razorpayOrderId, setRazorpayOrderId] = useState<string | null>(null);
  
  // Crop states
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const cropperRef = useRef(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Use roll number as storage key if available, otherwise use userId
  const storageKey = rollNo ? `avatar_subscription_${rollNo}` : `avatar_subscription_${userId}`;

  useEffect(() => {
    if (isOpen) {
      fetchSubscription();
    }
  }, [isOpen]);

  const fetchSubscription = async () => {
    try {
      setIsLoading(true);
      // Check localStorage for subscription data using roll number or user id
      let storedSubscription = localStorage.getItem(storageKey);
      
      // If not found with primary key, try the alternative key
      if (!storedSubscription) {
        const altKey = rollNo ? `avatar_subscription_${userId}` : `avatar_subscription_${rollNo}`;
        storedSubscription = localStorage.getItem(altKey);
      }
      
      if (storedSubscription) {
        const sub = JSON.parse(storedSubscription);
        // Check if subscription is expired
        if (sub.expiresAt && new Date().getTime() > sub.expiresAt) {
          // Subscription expired, remove it
          localStorage.removeItem(storageKey);
          const altKey = rollNo ? `avatar_subscription_${userId}` : `avatar_subscription_${rollNo}`;
          localStorage.removeItem(altKey);
          setSubscription({ active: false, customAvatarUrl: null, expiresAt: null });
        } else {
          setSubscription(sub);
        }
      } else {
        setSubscription({ active: false, customAvatarUrl: null, expiresAt: null });
      }
    } catch (error) {
      console.warn('Error fetching subscription:', error);
      setSubscription({ active: false, customAvatarUrl: null, expiresAt: null });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Invalid File', description: 'Please select an image', variant: 'destructive' });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'Too Large', description: 'Max 5MB', variant: 'destructive' });
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageSrc(reader.result as string);
        setStep('crop');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = async () => {
    if (!imageSrc || !canvasRef.current) return;

    try {
      setIsLoading(true);
      const image = new Image();
      image.src = imageSrc;
      
      image.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas to square (avatar is circular, so square crop works best)
        const size = Math.min(image.width, image.height);
        canvas.width = 400;
        canvas.height = 400;

        // Calculate source coordinates
        const srcX = (image.width - size) / 2;
        const srcY = (image.height - size) / 2;

        // Apply zoom and crop
        ctx.drawImage(
          image,
          srcX + (crop.x * size) / 100,
          srcY + (crop.y * size) / 100,
          size * (1 - Math.abs(crop.x) / 50),
          size * (1 - Math.abs(crop.y) / 50),
          0,
          0,
          400,
          400
        );

        // Convert canvas to blob and create preview
        canvas.toBlob((blob) => {
          if (blob) {
            const croppedFile = new File([blob], selectedFile?.name || 'avatar.jpg', { type: 'image/jpeg' });
            setSelectedFile(croppedFile);
            setPreview(canvas.toDataURL('image/jpeg'));
            setStep('confirm');
          }
        }, 'image/jpeg', 0.95);
      };
    } catch (error) {
      console.error('Crop error:', error);
      toast({ title: 'Error', description: 'Failed to crop image', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async () => {
    // Simply move to payment step
    // Razorpay button will handle everything
    setTransactionId(`AVATAR_${userId}_${Date.now()}`);
    setRazorpayOrderId(`AVATAR_${userId}_${Date.now()}`);
    setStep('payment');
  };

  const handlePaymentSuccess = async () => {
    if (!selectedFile || !preview) return;

    try {
      setIsLoading(true);
      console.log('Payment success! Starting avatar upload...', { userId, rollNo, hasFile: !!selectedFile });
      
      // Upload avatar to Cloudinary
      const uploadResult = await uploadCustomAvatar(selectedFile, userId);
      console.log('Avatar uploaded successfully:', uploadResult.url);
      
      // Calculate expiry date (30 days from now)
      const expiresAt = new Date().getTime() + 30 * 24 * 60 * 60 * 1000;
      
      // Save subscription to localStorage using roll number or user id
      const subscription = {
        active: true,
        customAvatarUrl: uploadResult.url,
        expiresAt,
        activatedAt: new Date().getTime(),
        userId,
        rollNo: rollNo || userId,
        playerName
      };
      
      localStorage.setItem(storageKey, JSON.stringify(subscription));
      console.log(`Subscription saved with key: ${storageKey}`);
      
      // Also store by the other key (rollNo or userId) for redundancy
      if (rollNo) {
        localStorage.setItem(`avatar_subscription_${userId}`, JSON.stringify(subscription));
        console.log(`Also saved with key: avatar_subscription_${userId}`);
      } else if (userId) {
        localStorage.setItem(`avatar_subscription_${rollNo}`, JSON.stringify(subscription));
        console.log(`Also saved with key: avatar_subscription_${rollNo}`);
      }
      
      toast({ 
        title: 'Success!', 
        description: `Custom avatar activated for 30 days (Roll: ${rollNo || userId})` 
      });
      
      onAvatarSelect(uploadResult.url);
      await fetchSubscription();
      
      // Reset form
      setSelectedFile(null);
      setPreview(null);
      setTransactionId(null);
      setRazorpayOrderId(null);
      setStep('view');
    } catch (error) {
      console.error('Error:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to activate avatar', 
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentError = (error: string) => {
    console.error('Payment error:', error);
    // Don't change step, let user try again
  };

  const daysRemaining = subscription?.expiresAt ? getDaysRemaining(subscription.expiresAt) : 0;
  const isExpired = !subscription?.active || daysRemaining <= 0;

  return (
    <>
      <Button 
        variant="outline" 
        onClick={() => { setIsOpen(true); setStep('view'); }}
        className="gap-2"
      >
        <Upload className="w-4 h-4" />
        Customize Avatar (₹1/30 days)
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Avatar Customization</DialogTitle>
          </DialogHeader>

          {isLoading && step === 'view' ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : step === 'view' ? (
            <div className="space-y-4">
              {subscription?.active && subscription?.customAvatarUrl ? (
                <>
                  <div className="text-center">
                    <Avatar className="w-24 h-24 mx-auto mb-2">
                      <AvatarImage src={subscription.customAvatarUrl} />
                      <AvatarFallback>{playerName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <p className="text-sm text-green-600 flex items-center justify-center gap-1">
                      <Check className="w-4 h-4" /> Active
                    </p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-2 bg-blue-50 rounded">
                      <span>Days Remaining:</span>
                      <span className="font-bold">{daysRemaining} days</span>
                    </div>
                    <div className="flex justify-between p-2 bg-blue-50 rounded">
                      <span>Expires:</span>
                      <span>{new Date(subscription.expiresAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-600 mb-4">No active subscription</p>
                </div>
              )}
              <Button 
                onClick={() => setStep('upload')} 
                className="w-full"
              >
                {subscription?.active ? 'Change Avatar' : 'Get Custom Avatar'}
              </Button>
            </div>
          ) : step === 'crop' && imageSrc ? (
            <div className="space-y-4">
              <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ height: '400px' }}>
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={true}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Zoom</label>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    setStep('upload');
                    setImageSrc(null);
                    setCrop({ x: 0, y: 0 });
                    setZoom(1);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Back
                </Button>
                <Button 
                  onClick={handleCropComplete}
                  disabled={isLoading}
                  className="flex-1 gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crop className="w-4 h-4" />}
                  Crop & Continue
                </Button>
              </div>
            </div>
          ) : step === 'confirm' ? (
            <div className="space-y-4">
              <div className="text-center">
                <Avatar className="w-32 h-32 mx-auto mb-4">
                  <AvatarImage src={preview || ''} />
                  <AvatarFallback>{playerName.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>
              <div className="p-3 bg-gray-100 rounded space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Duration:</span>
                  <span className="font-medium">30 Days</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-semibold">Amount:</span>
                  <span className="text-lg font-bold text-green-600">₹1</span>
                </div>
              </div>
              <Button 
                onClick={handlePayment}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Proceed to Payment
              </Button>

            </div>
          ) : step === 'payment' && razorpayOrderId ? (
            <div className="space-y-4">
              {/* Payment Header */}
              <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white p-6 rounded-lg -m-6 mb-6 text-center">
                <h2 className="text-2xl font-bold mb-2">Complete Payment</h2>
                <p className="text-purple-100">Just ₹1 for 30-day custom avatar</p>
              </div>

              {/* Avatar Preview */}
              <div className="text-center bg-gray-50 p-6 rounded-lg">
                <p className="text-sm text-gray-600 mb-3">Your Custom Avatar</p>
                <Avatar className="w-24 h-24 mx-auto">
                  <AvatarImage src={preview || ''} />
                  <AvatarFallback>{playerName.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>

              {/* Order Summary */}
              <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-700">Custom Avatar Subscription</span>
                  <span className="font-semibold text-gray-900">₹1</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-700">Duration</span>
                  <span className="font-semibold text-gray-900">30 Days</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">Total Amount</span>
                    <span className="text-2xl font-bold text-green-600">₹1</span>
                  </div>
                </div>
              </div>

              {/* Razorpay Payment Button */}
              <RazorpayPaymentForm 
                amount={1}
                description="Custom Avatar 30-day subscription"
              />

              {/* Confirm After Payment */}
              <Button
                onClick={handlePaymentSuccess}
                disabled={isLoading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 h-auto"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Activating Avatar...
                  </>
                ) : (
                  <>
                    ✅ I've Completed Payment - Activate Avatar
                  </>
                )}
              </Button>

              {/* Back Button */}
              <Button 
                onClick={() => {
                  setStep('confirm');
                  setRazorpayOrderId(null);
                }}
                variant="outline"
                className="w-full"
              >
                Back
              </Button>

              {/* Info Text */}
              <p className="text-xs text-gray-500 text-center">
                After completing payment with Razorpay, click "Activate Avatar" to finalize.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="avatar-input"
                />
                <label htmlFor="avatar-input" className="cursor-pointer">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Click to upload image</p>
                  <p className="text-xs text-gray-400">JPG, PNG - Max 5MB</p>
                </label>
              </div>
              <Button 
                onClick={() => setStep('view')}
                variant="outline"
                className="w-full"
              >
                Back
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Hidden canvas for image cropping */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </>
  );
};
