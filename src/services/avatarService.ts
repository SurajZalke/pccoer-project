import axios from 'axios';
import { getApiBaseUrl } from '@/lib/apiBase';

const API_BASE = import.meta.env.VITE_API_URL || `${getApiBaseUrl()}/api`;

export interface AvatarSubscription {
  active: boolean;
  customAvatarUrl: string | null;
  expiresAt: number | null;
  subscriptionId?: string;
  activatedAt?: number;
}

export interface PaymentInitiation {
  razorpayOrderId: string;
  transactionId: string;
  amount: number;
  currency: string;
  description: string;
  paymentGatewayUrl?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  status: string;
  createdAt: string;
  transactionId?: string;
}

// Get avatar subscription status for a user
export const getAvatarSubscription = async (userId: string): Promise<AvatarSubscription> => {
  try {
    const response = await axios.get(`${API_BASE}/avatar/subscription/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching avatar subscription:', error);
    throw error;
  }
};

// Initiate payment for avatar customization
export const initiateAvatarPayment = async (
  userId: string,
  playerName: string
): Promise<PaymentInitiation> => {
  try {
    const response = await axios.post(`${API_BASE}/avatar/initiate-payment`, {
      userId,
      playerName
    });
    return response.data;
  } catch (error) {
    console.error('Error initiating avatar payment:', error);
    throw error;
  }
};

// Confirm payment and activate avatar subscription
export const confirmAvatarPayment = async (
  userId: string,
  transactionId: string,
  customAvatarUrl: string
): Promise<any> => {
  try {
    const response = await axios.post(`${API_BASE}/avatar/confirm-payment`, {
      userId,
      transactionId,
      customAvatarUrl
    });
    return response.data;
  } catch (error) {
    console.error('Error confirming avatar payment:', error);
    throw error;
  }
};

// Initiate renewal
export const initiateAvatarRenewal = async (userId: string): Promise<PaymentInitiation> => {
  try {
    const response = await axios.post(`${API_BASE}/avatar/renew-subscription`, {
      userId
    });
    return response.data;
  } catch (error) {
    console.error('Error initiating renewal:', error);
    throw error;
  }
};

// Confirm renewal payment
export const confirmAvatarRenewal = async (
  userId: string,
  transactionId: string
): Promise<any> => {
  try {
    const response = await axios.post(`${API_BASE}/avatar/confirm-renewal`, {
      userId,
      transactionId
    });
    return response.data;
  } catch (error) {
    console.error('Error confirming renewal:', error);
    throw error;
  }
};

// Cancel subscription
export const cancelAvatarSubscription = async (userId: string): Promise<any> => {
  try {
    const response = await axios.post(`${API_BASE}/avatar/cancel-subscription/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    throw error;
  }
};

// Get transaction history
export const getAvatarTransactionHistory = async (userId: string): Promise<Transaction[]> => {
  try {
    const response = await axios.get(`${API_BASE}/avatar/history/${userId}`);
    return response.data.transactions;
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    throw error;
  }
};

// Upload custom avatar to Cloudinary (unsigned upload)
export const uploadCustomAvatar = async (
  file: File,
  userId: string
): Promise<{ url: string }> => {
  try {
    const cloudName = import.meta.env.VITE_CLOUDINARY_NAME || 'doxaediez';
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'quiz_app';
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', `dhole_sir/avatars/${userId}`);
    formData.append('resource_type', 'auto');

    console.log('Uploading to Cloudinary:', { cloudName, uploadPreset, userId });

    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      formData,
      {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
      }
    );

    console.log('Upload successful:', response.data.secure_url);
    return { url: response.data.secure_url };
  } catch (error) {
    console.error('Error uploading avatar to Cloudinary:', error);
    // Return a placeholder if upload fails
    if (error instanceof Error) {
      throw new Error(`Avatar upload failed: ${error.message}`);
    }
    throw error;
  }
};

// Verify Razorpay payment (server-side signature verification)
export const verifyRazorpayPayment = async (
  userId: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
  customAvatarUrl: string
): Promise<any> => {
  try {
    const response = await axios.post(`${API_BASE}/avatar/verify-razorpay-payment`, {
      userId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      customAvatarUrl
    });
    return response.data;
  } catch (error) {
    console.error('Error verifying Razorpay payment:', error);
    throw error;
  }
};

// Check if subscription is expired
export const isSubscriptionExpired = (subscription: AvatarSubscription): boolean => {
  if (!subscription.active || !subscription.expiresAt) {
    return true;
  }
  return new Date().getTime() > subscription.expiresAt;
};

// Get days remaining in subscription
export const getDaysRemaining = (expiresAt: number | null): number => {
  if (!expiresAt) return 0;
  const daysMs = expiresAt - new Date().getTime();
  return Math.ceil(daysMs / (1000 * 60 * 60 * 24));
};
