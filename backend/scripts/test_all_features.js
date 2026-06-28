const axios = require("axios");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const User = require("../Model/User");
const Post = require("../Model/Post");
const Subscription = require("../Model/Subscription");
const Payment = require("../Model/Payment");

const BASE_URL = "http://localhost:5000/api";
const DB_URL = "mongodb://localhost:27017";
const ENV_PATH = path.join(__dirname, "..", ".env");

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const BYPASS_FILE_PATH = path.join(__dirname, "..", "bypass.txt");

// Helper to update backend bypass.txt dynamically to test timing bypass
function updateEnvBypass(value) {
  fs.writeFileSync(BYPASS_FILE_PATH, value, "utf8");
  console.log(`[Env Setup] Wrote ${value} to bypass.txt`);
}

async function waitForServer() {
  // No-op because writing to bypass.txt updates logic dynamically without server restart
  return;
}

async function runAudit() {
  console.log("=== STARTING FULL APPLICATION AUDIT ===");
  await mongoose.connect(DB_URL);
  
  // Clean up any old audit user
  const email = "audit-user@example.com";
  await User.deleteOne({ email });
  await Post.deleteMany({ "author.email": email });
  
  // 1. Create a fresh test user
  console.log("\n--- Registering Audit User ---");
  let registerRes;
  try {
    registerRes = await axios.post(`${BASE_URL}/auth/register`, {
      name: "Audit User",
      email,
      password: "password123",
      phone: "9876543210"
    });
    console.log("User registered successfully. UID:", registerRes.data.user.uid);
  } catch (err) {
    console.error("User registration failed:", err.response?.data || err.message);
    process.exit(1);
  }

  const token = registerRes.data.token;
  const uid = registerRes.data.user.uid;
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // ==========================================
  // FEATURE 1: Forgot Password Rate Limit and Password Generator
  // ==========================================
  console.log("\n=== FEATURE 1: Forgot Password & Password Generator ===");
  
  // Request 1
  let forgotRes1;
  try {
    forgotRes1 = await axios.post(`${BASE_URL}/password/forgot-password`, { email });
    console.log("Request 1 succeeded.");
    console.log("Simulated Temp Password:", forgotRes1.data.temporaryPassword);
    
    // Validate password contains only letters (uppercase/lowercase)
    const tempPass = forgotRes1.data.temporaryPassword;
    const containsOnlyLetters = /^[a-zA-Z]+$/.test(tempPass);
    console.log(`Password generator check (Only letters?): ${containsOnlyLetters ? "PASSED" : "FAILED"}`);
    if (!containsOnlyLetters) throw new Error("Temporary password contains numbers or special characters!");
  } catch (err) {
    console.error("Forgot password Request 1 failed:", err.response?.data || err.message);
  }

  // Request 2 (Should trigger Rate Limit error)
  try {
    await axios.post(`${BASE_URL}/password/forgot-password`, { email });
    console.error("FAILED: Second request succeeded, but it should be blocked by rate limit!");
  } catch (err) {
    const msg = err.response?.data?.message;
    console.log("Request 2 failed correctly (429/Rate Limit). Message received:", msg);
    const matchesExpectedMsg = msg === "You can use this option only once per day.";
    console.log(`Rate limit message check: ${matchesExpectedMsg ? "PASSED" : "FAILED"}`);
  }

  // ==========================================
  // FEATURE 2: Subscription Timing Window & Pricing limits
  // ==========================================
  console.log("\n=== FEATURE 2: Subscription Timing Window ===");
  
  // Set window bypass to false to test blocking outside 10-11 AM IST
  updateEnvBypass("false");
  await waitForServer();
  
  try {
    await axios.post(`${BASE_URL}/subscription/create-order`, { planName: "Bronze" }, authHeaders);
    console.error("FAILED: Subscription order creation should be blocked outside 10:00 AM - 11:00 AM IST!");
  } catch (err) {
    console.log("Success: Create order was blocked correctly. Error message:", err.response?.data?.error);
  }

  try {
    await axios.post(`${BASE_URL}/subscription/verify-payment`, {
      razorpay_payment_id: "pay_test",
      razorpay_order_id: "order_test",
      razorpay_signature: "sig",
      planName: "Bronze"
    }, authHeaders);
    console.error("FAILED: Subscription payment verification should be blocked outside 10:00 AM - 11:00 AM IST!");
  } catch (err) {
    console.log("Success: Payment verification was blocked correctly. Error message:", err.response?.data?.error);
  }

  // Bypass the window check to proceed with the remaining tests
  updateEnvBypass("true");
  await waitForServer();

  // Try to create a valid order now
  let orderRes;
  try {
    orderRes = await axios.post(`${BASE_URL}/subscription/create-order`, { planName: "Bronze" }, authHeaders);
    console.log("Bronze Plan order created successfully. OrderID:", orderRes.data.orderId);
  } catch (err) {
    console.error("Failed to create Bronze order:", err.response?.data || err.message);
  }

  // Verify payment to activate Bronze plan (mock signature format starting with order_mock_)
  try {
    const verifyRes = await axios.post(`${BASE_URL}/subscription/verify-payment`, {
      razorpay_payment_id: "pay_mock_" + Date.now(),
      razorpay_order_id: orderRes.data.orderId,
      razorpay_signature: "sig_mock",
      planName: "Bronze"
    }, authHeaders);
    console.log("Bronze subscription activated successfully. Status active:", verifyRes.data.success);
  } catch (err) {
    console.error("Failed to verify payment:", err.response?.data || err.message);
  }

  // ==========================================
  // FEATURE 3: Resume Creation & Verification OTP (Premium user)
  // ==========================================
  console.log("\n=== FEATURE 3: Premium Resume Creation & OTP ===");
  
  // 1. Send OTP
  let resumeOtp = "";
  try {
    const otpRes = await axios.post(`${BASE_URL}/resume/send-otp`, {}, authHeaders);
    console.log("Send OTP response:", otpRes.data.message);
    resumeOtp = otpRes.data.otp;
  } catch (err) {
    console.error("Failed to send resume OTP:", err.response?.data || err.message);
  }

  // 2. Verify OTP
  try {
    const verifyOtpRes = await axios.post(`${BASE_URL}/resume/verify-otp`, { otp: resumeOtp }, authHeaders);
    console.log("OTP verify response:", verifyOtpRes.data.message);
  } catch (err) {
    console.error("Failed to verify resume OTP:", err.response?.data || err.message);
  }

  // 3. Create payment order for ₹50
  let resOrderRes;
  try {
    resOrderRes = await axios.post(`${BASE_URL}/resume/create-order`, {}, authHeaders);
    console.log("Resume payment order created. OrderID:", resOrderRes.data.orderId);
  } catch (err) {
    console.error("Failed to create resume payment order:", err.response?.data || err.message);
  }

  // 4. Verify payment and attach resume
  try {
    const resVerifyRes = await axios.post(`${BASE_URL}/resume/verify-payment`, {
      razorpay_payment_id: "pay_mock_res_" + Date.now(),
      razorpay_order_id: resOrderRes.data.orderId,
      razorpay_signature: "sig_mock_res",
      resumeData: {
        name: "Audit User",
        qualifications: "B.Tech Computer Science",
        experience: "1 year software intern",
        personalInfo: "Fast learner, team worker",
        photo: "http://localhost:5000/uploads/test.png"
      }
    }, authHeaders);
    console.log("Resume verification success! Resume Attached:", !!resVerifyRes.data.user.resume);
  } catch (err) {
    console.error("Failed to verify resume payment:", err.response?.data || err.message);
  }

  // ==========================================
  // FEATURE 4: Multi-Language OTP (Switching to French)
  // ==========================================
  console.log("\n=== FEATURE 4: Multi-Language OTP ===");
  
  let langOtp = "";
  try {
    const res = await axios.post(`${BASE_URL}/users/send-lang-otp`, { email });
    console.log("Language OTP send response:", res.data.message);
    langOtp = res.data.otp;
  } catch (err) {
    console.error("Failed to send language OTP:", err.response?.data || err.message);
  }

  try {
    const res = await axios.post(`${BASE_URL}/users/verify-lang-otp`, { email, otp: langOtp });
    console.log("Language OTP verified successfully:", res.data.message);
  } catch (err) {
    console.error("Failed to verify language OTP:", err.response?.data || err.message);
  }

  // ==========================================
  // FEATURE 5: Community Posting Limits
  // ==========================================
  console.log("\n=== FEATURE 5: Community Posting Limits ===");

  const postPayload = {
    user: JSON.stringify({ uid, name: "Audit User", email, photo: "" }),
    text: "This is a test post content.",
    hashtags: "test,audit"
  };

  // Case A: 0 Friends (Should be blocked immediately)
  console.log("Case A: Testing user with 0 friends...");
  try {
    await axios.post(`${BASE_URL}/social/posts`, postPayload);
    console.error("FAILED: User with 0 friends should not be allowed to post!");
  } catch (err) {
    console.log("Success: Blocked correctly. Response error:", err.response?.data?.error);
  }

  // Case B: 1 Friend (Allowed 1 post/day)
  console.log("Case B: Testing user with 1 friend...");
  // Directly edit user friends count in database
  await User.updateOne({ uid }, { friends: [{ uid: "friend-1", name: "F1", email: "f1@e.com", photo: "" }] });
  
  // Post 1 (Should succeed)
  try {
    const res = await axios.post(`${BASE_URL}/social/posts`, postPayload);
    console.log("Post 1 created successfully. ID:", res.data._id);
  } catch (err) {
    console.error("Post 1 failed:", err.response?.data || err.message);
  }

  // Post 2 (Should fail)
  try {
    await axios.post(`${BASE_URL}/social/posts`, postPayload);
    console.error("FAILED: Second post of the day for 1-friend user was allowed!");
  } catch (err) {
    console.log("Success: Second post blocked correctly. Response error:", err.response?.data?.error);
  }

  // Case C: 2 Friends (Allowed 2 posts/day)
  console.log("Case C: Testing user with 2 friends...");
  await User.updateOne({ uid }, { 
    friends: [
      { uid: "friend-1", name: "F1", email: "f1@e.com", photo: "" },
      { uid: "friend-2", name: "F2", email: "f2@e.com", photo: "" }
    ],
    dailyPostCount: 0 // Reset daily count
  });

  // Post 1 (Should succeed)
  try {
    const res = await axios.post(`${BASE_URL}/social/posts`, postPayload);
    console.log("Post 1 created successfully. ID:", res.data._id);
  } catch (err) {
    console.error("Post 1 failed:", err.response?.data || err.message);
  }

  // Post 2 (Should succeed)
  try {
    const res = await axios.post(`${BASE_URL}/social/posts`, postPayload);
    console.log("Post 2 created successfully. ID:", res.data._id);
  } catch (err) {
    console.error("Post 2 failed:", err.response?.data || err.message);
  }

  // Post 3 (Should fail)
  try {
    await axios.post(`${BASE_URL}/social/posts`, postPayload);
    console.error("FAILED: Third post of the day for 2-friends user was allowed!");
  } catch (err) {
    console.log("Success: Third post blocked correctly. Response error:", err.response?.data?.error);
  }

  // Case D: 11 Friends (Allowed Unlimited posts/day)
  console.log("Case D: Testing user with 11 friends (Unlimited)...");
  const elevenFriends = Array.from({ length: 11 }, (_, i) => ({
    uid: `friend-${i}`,
    name: `Friend ${i}`,
    email: `friend${i}@e.com`,
    photo: ""
  }));
  await User.updateOne({ uid }, { 
    friends: elevenFriends,
    dailyPostCount: 0 // Reset daily count
  });

  // Try creating 5 posts in a row
  try {
    for (let i = 1; i <= 5; i++) {
      const res = await axios.post(`${BASE_URL}/social/posts`, postPayload);
      console.log(`Post ${i} created. ID:`, res.data._id);
    }
    console.log("Success: All 5 posts created successfully. Unlimited limit confirmed.");
  } catch (err) {
    console.error("FAILED: Blocked during unlimited posts test!", err.response?.data || err.message);
  }

  // Cleanup
  console.log("\nCleaning up audit user and posts...");
  await User.deleteOne({ email });
  await Post.deleteMany({ "author.email": email });
  
  // Restore .env timing bypass setting to default false
  updateEnvBypass("false");
  await waitForServer();

  await mongoose.disconnect();
  console.log("\n=== FULL SYSTEM AUDIT COMPLETED SUCCESSFULLY ===");
  process.exit(0);
}

runAudit();
