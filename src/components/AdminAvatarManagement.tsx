import React, { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Trash2, Search } from 'lucide-react';
import { getDatabase, ref, query, orderByChild, get } from 'firebase/database';

interface AvatarSubscriptionData {
  userId: string;
  customAvatarUrl: string;
  expiresAt: number;
  activatedAt: number;
  renewalCount: number;
  transactionId: string;
}

export const AdminAvatarManagement: React.FC = () => {
  const { toast } = useToast();
  const db = getDatabase();
  const [subscriptions, setSubscriptions] = useState<AvatarSubscriptionData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchUserId, setSearchUserId] = useState('');
  const [filteredSubs, setFilteredSubs] = useState<AvatarSubscriptionData[]>([]);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setIsLoading(true);
      const subsRef = ref(db, 'avatarSubscriptions');
      const snapshot = await get(subsRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const subs = Object.entries(data).map(([userId, subData]: any) => ({
          userId,
          ...subData,
        }));
        setSubscriptions(subs);
        setFilteredSubs(subs);
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch subscriptions',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (searchTerm: string) => {
    setSearchUserId(searchTerm);
    if (!searchTerm) {
      setFilteredSubs(subscriptions);
      return;
    }
    const filtered = subscriptions.filter((sub) =>
      sub.userId.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredSubs(filtered);
  };

  const handleCancelSubscription = async (userId: string) => {
    if (!window.confirm(`Cancel subscription for user ${userId}?`)) {
      return;
    }

    try {
      const subRef = ref(db, `avatarSubscriptions/${userId}`);
      await get(subRef).then((snapshot) => {
        if (snapshot.exists()) {
          snapshot.ref.remove();
        }
      });

      setSubscriptions(subscriptions.filter((sub) => sub.userId !== userId));
      setFilteredSubs(filteredSubs.filter((sub) => sub.userId !== userId));
      
      toast({
        title: 'Success',
        description: `Subscription cancelled for user ${userId}`,
      });
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel subscription',
        variant: 'destructive',
      });
    }
  };

  const isExpired = (expiresAt: number) => {
    return new Date().getTime() > expiresAt;
  };

  const getDaysRemaining = (expiresAt: number) => {
    const daysMs = expiresAt - new Date().getTime();
    return Math.ceil(daysMs / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Avatar Subscriptions Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search by User ID..."
                value={searchUserId}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={fetchSubscriptions} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
            </Button>
          </div>

          <div className="text-sm text-gray-600">
            Total Active Subscriptions: {subscriptions.length}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : filteredSubs.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              {searchUserId ? 'No subscriptions found' : 'No active subscriptions'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">User ID</th>
                    <th className="text-left p-3 font-semibold">Days Remaining</th>
                    <th className="text-left p-3 font-semibold">Expires</th>
                    <th className="text-left p-3 font-semibold">Renewals</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                    <th className="text-left p-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubs.map((sub) => {
                    const daysLeft = getDaysRemaining(sub.expiresAt);
                    const expired = isExpired(sub.expiresAt);
                    return (
                      <tr key={sub.userId} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-mono text-xs break-all">{sub.userId}</td>
                        <td className="p-3">
                          <span className={expired ? 'text-red-600 font-bold' : 'text-green-600'}>
                            {daysLeft} days
                          </span>
                        </td>
                        <td className="p-3">
                          {new Date(sub.expiresAt).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-center">{sub.renewalCount}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              expired
                                ? 'bg-red-100 text-red-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {expired ? 'Expired' : 'Active'}
                          </span>
                        </td>
                        <td className="p-3">
                          <Button
                            onClick={() => handleCancelSubscription(sub.userId)}
                            variant="destructive"
                            size="sm"
                            className="gap-2"
                          >
                            <Trash2 className="w-3 h-3" />
                            Cancel
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {subscriptions.length}
              </div>
              <p className="text-gray-600 text-sm mt-2">Active Subscriptions</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                ₹{subscriptions.length}
              </div>
              <p className="text-gray-600 text-sm mt-2">Total Revenue (₹1 each)</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">
                {subscriptions.reduce((sum, sub) => sum + (sub.renewalCount || 0), 0)}
              </div>
              <p className="text-gray-600 text-sm mt-2">Total Renewals</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAvatarManagement;
