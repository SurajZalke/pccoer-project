import React, { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Upload, 
  Calendar, 
  Trash2, 
  RotateCw, 
  Lock, 
  Check,
  Loader2,
  AlertCircle
} from 'lucide-react';
import {
  getAvatarSubscription,
  initiateAvatarPayment,
  confirmAvatarPayment,
  uploadCustomAvatar,
  cancelAvatarSubscription,
  initiateAvatarRenewal,
  confirmAvatarRenewal,
  getDaysRemaining,
  getAvatarTransactionHistory,
  AvatarSubscription,
  Transaction,
} from '@/services/avatarService';

interface AvatarCustomizerProps {
  userId: string;
  playerName: string;
  onAvatarChange?: (avatarUrl: string) => void;
}

export const AvatarCustomizer: React.FC<AvatarCustomizerProps> = ({
  userId,
  playerName,
  onAvatarChange,
}) => {
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<AvatarSubscription | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentStep, setPaymentStep] = useState<'upload' | 'payment' | 'confirm'>('upload');
  const [currentTransactionId, setCurrentTransactionId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch subscription status
  useEffect(() => {
    fetchSubscriptionStatus();
  }, [userId]);

  const fetchSubscriptionStatus = async () => {
    try {
      setIsLoading(true);
      const subData = await getAvatarSubscription(userId);
      setSubscription(subData);

      // Fetch transaction history
      const historyData = await getAvatarTransactionHistory(userId);
      setTransactions(historyData);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch subscription status',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid File',
          description: 'Please select an image file',
          variant: 'destructive',
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File Too Large',
          description: 'Image must be less than 5MB',
          variant: 'destructive',
        });
        return;
      }

      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Move to payment step
      setPaymentStep('payment');
    }
  };

  const handleInitiatePayment = async () => {
    try {
      setIsProcessing(true);
      const paymentData = await initiateAvatarPayment(userId, playerName);
      setCurrentTransactionId(paymentData.transactionId);
      setPaymentStep('confirm');

      toast({
        title: 'Payment Initiated',
        description: `Transaction ID: ${paymentData.transactionId}\nAmount: ₹${paymentData.amount}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to initiate payment',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedFile || !preview || !currentTransactionId) {
      toast({
        title: 'Error',
        description: 'Missing required information',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsProcessing(true);

      // Upload avatar to Cloudinary
      const uploadResult = await uploadCustomAvatar(selectedFile, userId);

      // Confirm payment
      await confirmAvatarPayment(userId, currentTransactionId, uploadResult.url);

      toast({
        title: 'Success!',
        description: 'Custom avatar activated for 30 days',
      });

      // Update UI
      onAvatarChange?.(uploadResult.url);
      await fetchSubscriptionStatus();

      // Reset state
      setSelectedFile(null);
      setPreview(null);
      setPaymentStep('upload');
      setCurrentTransactionId(null);
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error confirming payment:', error);
      toast({
        title: 'Error',
        description: 'Failed to activate avatar',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRenewSubscription = async () => {
    try {
      setIsProcessing(true);
      const renewalData = await initiateAvatarRenewal(userId);
      setCurrentTransactionId(renewalData.transactionId);

      // Show renewal confirmation
      const confirmRenewal = window.confirm(
        `Renew avatar subscription for ₹${renewalData.amount}?\nCurrent expiry: ${new Date(renewalData.currentExpiresAt).toLocaleDateString()}`
      );

      if (confirmRenewal) {
        await confirmAvatarRenewal(userId, renewalData.transactionId);
        toast({
          title: 'Success!',
          description: 'Subscription renewed for 30 more days',
        });
        await fetchSubscriptionStatus();
        setCurrentTransactionId(null);
      }
    } catch (error) {
      console.error('Error renewing subscription:', error);
      toast({
        title: 'Error',
        description: 'Failed to renew subscription',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Cancel custom avatar subscription? You will revert to default avatar.')) {
      return;
    }

    try {
      setIsProcessing(true);
      await cancelAvatarSubscription(userId);
      toast({
        title: 'Cancelled',
        description: 'Avatar subscription has been cancelled',
      });
      await fetchSubscriptionStatus();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to cancel subscription',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const daysRemaining = subscription?.expiresAt ? getDaysRemaining(subscription.expiresAt) : 0;
  const isExpired = !subscription?.active || daysRemaining <= 0;

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="w-4 h-4" />
          Customize Avatar
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Avatar Customization</DialogTitle>
          <DialogDescription>
            Get a custom avatar for ₹1 for 30 days
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <Tabs defaultValue="current" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="current">Current Status</TabsTrigger>
              <TabsTrigger value="customize">Customize</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            {/* Current Status Tab */}
            <TabsContent value="current" className="space-y-4">
              {subscription?.active && subscription?.customAvatarUrl ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-600" />
                      Active Subscription
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-center">
                      <Avatar className="w-24 h-24">
                        <AvatarImage src={subscription.customAvatarUrl} />
                        <AvatarFallback>{playerName.charAt(0)}</AvatarFallback>
                      </Avatar>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                        <span className="font-medium">Status:</span>
                        <span className="text-green-600 font-semibold">Active</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                        <span className="font-medium flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Days Remaining:
                        </span>
                        <span className="text-lg font-bold">{daysRemaining} days</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                        <span className="font-medium">Expires:</span>
                        <span>
                          {subscription.expiresAt
                            ? new Date(subscription.expiresAt).toLocaleDateString()
                            : 'N/A'}
                        </span>
                      </div>
                    </div>

                    {daysRemaining <= 7 && daysRemaining > 0 && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-yellow-800">
                          Your subscription will expire in {daysRemaining} days. Consider renewing soon!
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={handleRenewSubscription}
                        disabled={isProcessing}
                        className="flex-1 gap-2"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RotateCw className="w-4 h-4" />
                        )}
                        Renew for ₹1
                      </Button>
                      <Button
                        onClick={handleCancelSubscription}
                        disabled={isProcessing}
                        variant="destructive"
                        className="flex-1 gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="w-5 h-5 text-gray-600" />
                      No Active Subscription
                    </CardTitle>
                    <CardDescription>
                      Activate a custom avatar to stand out in the game
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">
                      Pay just ₹1 to customize your avatar for 30 days
                    </p>
                    <Button
                      onClick={() => setPaymentStep('upload')}
                      className="w-full"
                      size="lg"
                    >
                      Get Custom Avatar
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Customize Tab */}
            <TabsContent value="customize" className="space-y-4">
              {paymentStep === 'upload' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Upload Your Avatar</CardTitle>
                    <CardDescription>
                      Choose an image (JPG, PNG) - Max 5MB
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="avatar-upload"
                      />
                      <label
                        htmlFor="avatar-upload"
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        <Upload className="w-8 h-8 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          Click to upload or drag and drop
                        </span>
                      </label>
                    </div>
                  </CardContent>
                </Card>
              )}

              {paymentStep === 'payment' && preview && (
                <Card>
                  <CardHeader>
                    <CardTitle>Review Your Avatar</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-center">
                      <Avatar className="w-32 h-32">
                        <AvatarImage src={preview} />
                        <AvatarFallback>{playerName.charAt(0)}</AvatarFallback>
                      </Avatar>
                    </div>

                    <div className="p-4 bg-gray-50 rounded space-y-2">
                      <h3 className="font-semibold">Subscription Details:</h3>
                      <div className="flex justify-between text-sm">
                        <span>Duration:</span>
                        <span className="font-medium">30 Days</span>
                      </div>
                      <div className="flex justify-between text-sm border-t pt-2">
                        <span className="font-semibold">Total Amount:</span>
                        <span className="text-lg font-bold text-green-600">₹1</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => setPaymentStep('upload')}
                        variant="outline"
                        className="flex-1"
                      >
                        Back
                      </Button>
                      <Button
                        onClick={handleInitiatePayment}
                        disabled={isProcessing}
                        className="flex-1"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Proceed to Payment
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {paymentStep === 'confirm' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Complete Payment</CardTitle>
                    <CardDescription>
                      Confirm the payment to activate your custom avatar
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-sm text-blue-900">
                        <strong>Transaction ID:</strong> {currentTransactionId}
                      </p>
                      <p className="text-sm text-blue-900 mt-2">
                        <strong>Amount:</strong> ₹1
                      </p>
                    </div>

                    <div className="p-4 bg-green-50 border border-green-200 rounded">
                      <p className="text-sm text-green-900">
                        ✓ In a production environment, you would be redirected to Razorpay/payment gateway here.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setPaymentStep('upload');
                          setSelectedFile(null);
                          setPreview(null);
                          setCurrentTransactionId(null);
                        }}
                        variant="outline"
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleConfirmPayment}
                        disabled={isProcessing}
                        className="flex-1"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Confirm Payment
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-4">
              {transactions.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-gray-500">
                    No transaction history
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {transactions.map((transaction) => (
                    <Card key={transaction.id}>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Transaction ID:</span>
                            <p className="font-mono text-xs break-all">
                              {transaction.transactionId}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Amount:</span>
                            <p className="font-semibold">₹{transaction.amount}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Status:</span>
                            <p className="font-semibold capitalize">
                              {transaction.status.replace(/_/g, ' ')}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Date:</span>
                            <p>
                              {new Date(transaction.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AvatarCustomizer;
