import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import { getDatabase } from "firebase-admin/database";
import * as dotenv from "dotenv";

dotenv.config();

admin.initializeApp();
const db = getDatabase();

// Configure the email transporter using environment variables
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_PASSWORD,
  },
});

export const sendPasswordResetCode = functions.https.onCall(async (data: any, context) => {
  const email = data.email;

  if (!email) {
    throw new functions.https.HttpsError("invalid-argument", "Email is required.");
  }

  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    const uid = userRecord.uid;

    // Generate a 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryTime = Date.now() + 5 * 60 * 1000; // Code valid for 5 minutes

    // Store the code in Realtime Database
    await db.ref(`passwordResetCodes/${uid}`).set({
      code: verificationCode,
      email: email,
      expiry: expiryTime,
      createdAt: admin.database.ServerValue.TIMESTAMP,
    });

    const mailOptions = {
      from: process.env.GMAIL_EMAIL,
      to: email,
      subject: "Password Reset Verification Code",
      html: `<p>Your password reset verification code is: <strong>${verificationCode}</strong></p><p>This code is valid for 5 minutes.</p>`,
    };

    await transporter.sendMail(mailOptions);
    return { success: true, message: "Password reset verification code sent successfully." };

  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      throw new functions.https.HttpsError("not-found", "No user found with that email address.");
    }
    console.error("Error sending password reset code:", error);
    throw new functions.https.HttpsError("internal", "Failed to send password reset code.", error.message);
  }
});

export const confirmPasswordResetWithCode = functions.https.onCall(async (data: any, context) => {
  const { email, code, newPassword } = data;

  if (!email || !code || !newPassword) {
    throw new functions.https.HttpsError("invalid-argument", "Email, code, and new password are required.");
  }

  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    const uid = userRecord.uid;

    const codeRef = db.ref(`passwordResetCodes/${uid}`);
    const snapshot = await codeRef.once('value');
    const storedData = snapshot.val();

    if (!storedData || storedData.code !== code || storedData.expiry < Date.now()) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid or expired verification code.");
    }

    // Update user's password
    await admin.auth().updateUser(uid, { password: newPassword });

    // Delete the used code from the database
    await codeRef.remove();

    return { success: true, message: "Password has been reset successfully." };

  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      throw new functions.https.HttpsError("not-found", "No user found with that email address.");
    }
    console.error("Error confirming password reset:", error);
    throw new functions.https.HttpsError("internal", "Failed to reset password.", error.message);
  }
});

export const generateQuestions = functions.https.onCall(async (data: any, context: any) => {
  // Ensure the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const { topic, numQuestions } = data;

  // Validate input
  if (!topic || typeof topic !== 'string' || numQuestions <= 0 || typeof numQuestions !== 'number') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Invalid topic or number of questions provided.'
    );
  }

  try {
    // Call an external AI service (e.g., OpenAI API)
    // Replace with your actual AI API call
    const aiResponse = await fetch('https://api.openai.com/v1/engines/davinci-codex/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_KEY}`,
      },
      body: JSON.stringify({
        prompt: `Generate ${numQuestions} multiple-choice questions about ${topic}. Each question should have 4 options (A, B, C, D) and indicate the correct answer. Format as JSON.`, 
        max_tokens: 1000,
        n: 1,
        stop: null,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorData = await aiResponse.json();
      console.error('AI API Error:', errorData);
      throw new functions.https.HttpsError('internal', 'Failed to get response from AI service.', errorData);
    }

    const aiData = await aiResponse.json();
    const questions = JSON.parse(aiData.choices[0].text);

    // Basic validation of the AI-generated questions structure
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new functions.https.HttpsError('internal', 'AI service did not return questions in the expected format.');
    }

    return questions;
  } catch (error) {
    console.error('Error generating questions:', error);
    throw new functions.https.HttpsError('internal', 'Unable to generate questions.', error);
  }
});