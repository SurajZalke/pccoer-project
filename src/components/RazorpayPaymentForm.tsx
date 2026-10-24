import React, { useEffect } from 'react';
import { Shield } from 'lucide-react';

interface RazorpayPaymentFormProps {
  amount?: number;
  description?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

declare global {
  interface Window {
    RazorpayPaymentButton: any;
  }
}

export const RazorpayPaymentForm: React.FC<RazorpayPaymentFormProps> = ({ 
  amount = 1, 
  description = 'Custom Avatar 30-day subscription',
  onSuccess,
  onError
}) => {
  useEffect(() => {
    // Load Razorpay payment button script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/payment-button.js';
    script.async = true;
    script.defer = true;

    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900 font-semibold mb-4">Choose Payment Method</p>
        
        {/* Razorpay Payment Button - With ID and proper structure */}
        <form id="razorpay-payment-form" className="w-full">
          <script 
            id="razorpay-button-script"
            src="https://checkout.razorpay.com/v1/payment-button.js" 
            data-payment_button_id="pl_TRJR5V029atMJ7" 
            async={true as any}>
          </script>
        </form>
      </div>

      {/* Security Badge */}
      <div className="flex items-center justify-center gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded">
        <Shield className="w-4 h-4 text-green-600" />
        <span>Secured by <strong>Razorpay</strong> • ₹{amount} payment</span>
      </div>

      {/* Info Text */}
      <p className="text-xs text-gray-500 text-center">
        Complete the payment to activate your custom avatar for 30 days.
      </p>
    </div>
  );
};

export default RazorpayPaymentForm;
