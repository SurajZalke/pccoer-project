import { useState, useEffect, useCallback } from 'react';
import {
  getAvatarSubscription,
  isSubscriptionExpired,
  getDaysRemaining,
  AvatarSubscription,
} from '@/services/avatarService';

export const useAvatarSubscription = (userId: string) => {
  const [subscription, setSubscription] = useState<AvatarSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getAvatarSubscription(userId);
      setSubscription(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch subscription';
      setError(errorMessage);
      console.error('Error fetching subscription:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchSubscription();
      // Refresh subscription status every 5 minutes
      const interval = setInterval(fetchSubscription, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [userId, fetchSubscription]);

  const isExpired = subscription ? isSubscriptionExpired(subscription) : true;
  const daysRemaining = subscription?.expiresAt ? getDaysRemaining(subscription.expiresAt) : 0;
  const hasActiveSubscription = subscription?.active && !isExpired;

  return {
    subscription,
    isLoading,
    error,
    isExpired,
    daysRemaining,
    hasActiveSubscription,
    refreshSubscription: fetchSubscription,
  };
};

export default useAvatarSubscription;
