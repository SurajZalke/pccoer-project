import React, { useState } from 'react';
import { confirmPasswordResetWithCode } from '@/services/firebaseService';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface PasswordResetFormProps {
  onResetSuccess: () => void;
  email: string;
}

const PasswordResetForm: React.FC<PasswordResetFormProps> = ({ onResetSuccess, email }) => {
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordResetWithCode(email, code, newPassword);
      toast({
        title: 'Success',
        description: 'Password reset successful!',
        variant: 'default',
      });
      onResetSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Invalid code or email.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">A verification code has been sent to {email}.</p>
      <div>
        <label htmlFor="code" className="sr-only">Verification Code</label>
        <Input
          id="code"
          type="text"
          placeholder="Verification Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <div>
        <label htmlFor="newPassword" className="sr-only">New Password</label>
        <Input
          id="newPassword"
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="sr-only">Confirm New Password</label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Confirm New Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Resetting...' : 'Reset Password'}
      </Button>
    </form>
  );
};

export default PasswordResetForm;