import React, { useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';

interface RazorpayPaymentButtonProps {
  razorpayOrderId: string;
  amount: number;
  description: string;
  userId: string;
  customAvatarUrl: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

declare global {
  interface Window {
    RazorpayPaymentButton: any;
  }
}

export const RazorpayPaymentButton: React.FC<RazorpayPaymentButtonProps> = ({
  razorpayOrderId,
  amount,
  description,
  userId,
  customAvatarUrl,
  onSuccess,
  onError,
}) => {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Razorpay Payment Button script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/payment-button.js';
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      // Script loaded successfully
      console.log('Razorpay Payment Button script loaded');
    };

    script.onerror = () => {
      console.error('Failed to load Razorpay Payment Button script');
      onError('Failed to load payment gateway');
    };

    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [onError]);

  // Note: The actual payment button is rendered via HTML form element
  // Update the data-payment_button_id in AvatarSection component
  
  return (
    <div ref={containerRef}>
      {/* Payment button will be injected here via HTML form */}
    </div>
  );
};

export default RazorpayPaymentButton;
