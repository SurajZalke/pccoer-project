const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'test_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'test_secret'
});

// Create payment order
const createPaymentOrder = async (userId, amount = 100, receipt = null) => {
  try {
    const order = await razorpay.orders.create({
      amount: amount, // in paise (100 = ₹1)
      currency: 'INR',
      receipt: receipt || `avatar_${userId}_${Date.now()}`
    });
    return order;
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    throw error;
  }
};

// Verify payment signature
const verifyPaymentSignature = (orderId, paymentId, signature) => {
  try {
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(orderId + '|' + paymentId)
      .digest('hex');
    
    return generated_signature === signature;
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
};

// Get payment details
const getPaymentDetails = async (paymentId) => {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    console.error('Error fetching payment details:', error);
    throw error;
  }
};

module.exports = {
  razorpay,
  createPaymentOrder,
  verifyPaymentSignature,
  getPaymentDetails
};
