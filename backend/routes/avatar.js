const express = require('express');
const admin = require('firebase-admin');
const { createPaymentOrder, verifyPaymentSignature } = require('../lib/razorpay');
const firebase = require('../lib/firebase');
const router = express.Router();

// Get current avatar subscription status for a player
router.get('/subscription/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const subscriptionRef = firebase.rtdb.ref(`avatarSubscriptions/${userId}`);
    const snapshot = await subscriptionRef.once('value');
    const subscription = snapshot.val();

    if (!subscription) {
      return res.status(200).json({
        active: false,
        customAvatarUrl: null,
        expiresAt: null,
        message: 'No active subscription'
      });
    }

    const now = new Date().getTime();
    const isActive = subscription.expiresAt > now;

    return res.status(200).json({
      active: isActive,
      customAvatarUrl: isActive ? subscription.customAvatarUrl : null,
      expiresAt: subscription.expiresAt,
      subscriptionId: subscription.subscriptionId,
      activatedAt: subscription.activatedAt
    });
  } catch (error) {
    console.error('Error fetching avatar subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription status' });
  }
});

// Initiate payment for avatar customization
router.post('/initiate-payment', async (req, res) => {
  try {
    const { userId, playerName } = req.body;

    if (!userId || !playerName) {
      return res.status(400).json({ error: 'userId and playerName are required' });
    }

    try {
      // Try to create Razorpay order
      const order = await createPaymentOrder(userId, 100, `avatar_${userId}_${Date.now()}`);
      
      // Store order metadata in database
      const transactionRef = firebase.rtdb.ref(`avatarTransactions/${order.id}`);
      await transactionRef.set({
        userId,
        playerName,
        amount: 1,
        status: 'initiated',
        razorpayOrderId: order.id,
        createdAt: admin.database.ServerValue.TIMESTAMP,
        expiryDate: null
      });

      return res.status(200).json({
        transactionId: order.id,
        razorpayOrderId: order.id,
        amount: 1,
        currency: 'INR',
        description: 'Custom Avatar 30-day subscription',
        key: process.env.RAZORPAY_KEY_ID || 'test_key'
      });
    } catch (razorpayError) {
      console.warn('Razorpay integration not available, using mock:', razorpayError.message);
      
      // Fallback to mock payment
      const transactionId = `AVATAR_${userId}_${Date.now()}`;
      const transactionRef = firebase.rtdb.ref(`avatarTransactions/${transactionId}`);
      await transactionRef.set({
        userId,
        playerName,
        amount: 1,
        status: 'initiated',
        createdAt: admin.database.ServerValue.TIMESTAMP,
        expiryDate: null
      });

      return res.status(200).json({
        transactionId,
        amount: 1,
        currency: 'INR',
        description: 'Custom Avatar 30-day subscription',
        message: 'Payment initiated (Mock mode - Razorpay not configured)'
      });
    }
  } catch (error) {
    console.error('Error initiating payment:', error);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

// Verify Razorpay payment
router.post('/verify-razorpay-payment', async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, userId, customAvatarUrl } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ error: 'Missing payment verification data' });
    }

    // Verify signature
    const isSignatureValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    
    if (!isSignatureValid) {
      return res.status(403).json({ error: 'Invalid payment signature' });
    }

    // Calculate expiry date
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).getTime();

    // Create subscription
    const subscriptionRef = firebase.rtdb.ref(`avatarSubscriptions/${userId}`);
    const subscriptionData = {
      userId,
      customAvatarUrl,
      activatedAt: admin.database.ServerValue.TIMESTAMP,
      expiresAt,
      razorpayOrderId,
      razorpayPaymentId,
      amount: 1,
      currency: 'INR',
      renewalCount: 1
    };

    await subscriptionRef.set(subscriptionData);

    // Update transaction status
    const transactionRef = firebase.rtdb.ref(`avatarTransactions/${razorpayOrderId}`);
    await transactionRef.update({
      status: 'confirmed',
      confirmedAt: admin.database.ServerValue.TIMESTAMP,
      razorpayPaymentId
    });

    res.status(200).json({
      success: true,
      message: 'Avatar subscription activated for 30 days',
      subscription: {
        ...subscriptionData,
        expiresAt: new Date(expiresAt).toISOString()
      }
    });
  } catch (error) {
    console.error('Error verifying Razorpay payment:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// Confirm payment and activate avatar subscription
router.post('/confirm-payment', async (req, res) => {
  try {
    const { userId, transactionId, customAvatarUrl } = req.body;

    if (!userId || !transactionId || !customAvatarUrl) {
      return res.status(400).json({ error: 'userId, transactionId, and customAvatarUrl are required' });
    }

    // Verify transaction exists
    const transactionRef = firebase.rtdb.ref(`avatarTransactions/${transactionId}`);
    const transactionSnapshot = await transactionRef.once('value');
    const transaction = transactionSnapshot.val();

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized: userId does not match transaction' });
    }

    // Calculate expiry date (30 days from now)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).getTime();

    // Create or update subscription
    const subscriptionRef = firebase.rtdb.ref(`avatarSubscriptions/${userId}`);
    const subscriptionData = {
      userId,
      customAvatarUrl,
      activatedAt: admin.database.ServerValue.TIMESTAMP,
      expiresAt,
      transactionId,
      amount: 1,
      currency: 'INR',
      renewalCount: (transaction.renewalCount || 0) + 1
    };

    await subscriptionRef.set(subscriptionData);

    // Update transaction status
    await transactionRef.update({
      status: 'confirmed',
      confirmedAt: admin.database.ServerValue.TIMESTAMP,
      subscriptionId: userId
    });

    res.status(200).json({
      success: true,
      message: 'Avatar subscription activated for 30 days',
      subscription: {
        ...subscriptionData,
        expiresAt: new Date(expiresAt).toISOString()
      }
    });
  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// Renew avatar subscription
router.post('/renew-subscription', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Get current subscription
    const subscriptionRef = firebase.rtdb.ref(`avatarSubscriptions/${userId}`);
    const subscriptionSnapshot = await subscriptionRef.once('value');
    const currentSubscription = subscriptionSnapshot.val();

    if (!currentSubscription) {
      return res.status(404).json({ error: 'No active subscription found. Please purchase a new subscription.' });
    }

    // Generate renewal transaction ID
    const renewalTransactionId = `AVATAR_RENEW_${userId}_${Date.now()}`;
    
    // Store renewal transaction
    const renewalRef = firebase.rtdb.ref(`avatarTransactions/${renewalTransactionId}`);
    await renewalRef.set({
      userId,
      amount: 1,
      status: 'renewal_initiated',
      createdAt: admin.database.ServerValue.TIMESTAMP,
      previousSubscriptionId: userId
    });

    return res.status(200).json({
      transactionId: renewalTransactionId,
      amount: 1,
      currency: 'INR',
      description: 'Renew custom avatar subscription for 30 more days',
      currentExpiresAt: new Date(currentSubscription.expiresAt).toISOString()
    });
  } catch (error) {
    console.error('Error renewing subscription:', error);
    res.status(500).json({ error: 'Failed to renew subscription' });
  }
});

// Confirm renewal payment
router.post('/confirm-renewal', async (req, res) => {
  try {
    const { userId, transactionId } = req.body;

    if (!userId || !transactionId) {
      return res.status(400).json({ error: 'userId and transactionId are required' });
    }

    // Get current subscription
    const subscriptionRef = firebase.rtdb.ref(`avatarSubscriptions/${userId}`);
    const subscriptionSnapshot = await subscriptionRef.once('value');
    const currentSubscription = subscriptionSnapshot.val();

    if (!currentSubscription) {
      return res.status(404).json({ error: 'No active subscription to renew' });
    }

    // Calculate new expiry date (30 days from current expiry or now, whichever is later)
    const currentExpiry = new Date(currentSubscription.expiresAt);
    const now = new Date();
    const baseDate = currentExpiry > now ? currentExpiry : now;
    const newExpiresAt = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000).getTime();

    // Update subscription with extended expiry
    await subscriptionRef.update({
      expiresAt: newExpiresAt,
      lastRenewedAt: admin.database.ServerValue.TIMESTAMP,
      renewalCount: (currentSubscription.renewalCount || 0) + 1,
      lastRenewalTransactionId: transactionId
    });

    // Update transaction status
    const transactionRef = firebase.rtdb.ref(`avatarTransactions/${transactionId}`);
    await transactionRef.update({
      status: 'renewal_confirmed',
      confirmedAt: admin.database.ServerValue.TIMESTAMP
    });

    res.status(200).json({
      success: true,
      message: 'Avatar subscription renewed for 30 more days',
      newExpiresAt: new Date(newExpiresAt).toISOString()
    });
  } catch (error) {
    console.error('Error confirming renewal:', error);
    res.status(500).json({ error: 'Failed to confirm renewal' });
  }
});

// Cancel subscription
router.post('/cancel-subscription/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const subscriptionRef = firebase.rtdb.ref(`avatarSubscriptions/${userId}`);
    await subscriptionRef.remove();

    res.status(200).json({
      success: true,
      message: 'Avatar subscription cancelled. You will revert to default avatar.'
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Get avatar history for user
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const transactionsRef = firebase.rtdb.ref('avatarTransactions').orderByChild('userId').equalTo(userId);
    const snapshot = await transactionsRef.once('value');
    const transactions = snapshot.val();

    if (!transactions) {
      return res.status(200).json({ transactions: [] });
    }

    const transactionList = Object.entries(transactions).map(([id, data]) => ({
      id,
      ...data,
      createdAt: new Date(data.createdAt).toISOString()
    }));

    res.status(200).json({ transactions: transactionList });
  } catch (error) {
    console.error('Error fetching avatar history:', error);
    res.status(500).json({ error: 'Failed to fetch transaction history' });
  }
});

module.exports = router;
