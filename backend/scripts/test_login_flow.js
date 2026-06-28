const axios = require("axios");
const mongoose = require("mongoose");
const LoginHistory = require("../Model/LoginHistory");

const BASE_URL = "http://localhost:5000/api";
const DB_URL = "mongodb://localhost:27017";

async function runTests() {
  console.log("Starting automated login flow tests...");
  
  // 1. Desktop Safari Login (Non-Chrome, No time constraint)
  console.log("\n--- TEST 1: Safari on Desktop (Should succeed directly) ---");
  try {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email: "test@example.com",
      password: "newpassword123",
      browser: "Safari",
      os: "macOS",
      deviceType: "desktop"
    });
    console.log("Success! Response status:", res.status);
    console.log("Requires OTP:", !!res.data.requiresOtp);
  } catch (err) {
    console.error("Test 1 failed:", err.response?.data || err.message);
  }

  // 2. Google Chrome Login (Should trigger OTP verification)
  console.log("\n--- TEST 2: Google Chrome Login (Should require OTP) ---");
  let simulatedOtp = "";
  try {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email: "test@example.com",
      password: "newpassword123",
      browser: "Google Chrome",
      os: "Windows",
      deviceType: "desktop"
    });
    console.log("Response status:", res.status);
    console.log("Requires OTP:", res.data.requiresOtp);
    console.log("Simulated OTP received:", res.data.otp);
    simulatedOtp = res.data.otp;
  } catch (err) {
    console.error("Test 2 failed:", err.response?.data || err.message);
  }

  // 3. Verify OTP for Chrome
  console.log("\n--- TEST 3: Google Chrome OTP Verification (Should succeed) ---");
  try {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email: "test@example.com",
      password: "newpassword123",
      browser: "Google Chrome",
      os: "Windows",
      deviceType: "desktop",
      otp: simulatedOtp
    });
    console.log("Success! Response status:", res.status);
    console.log("Requires OTP:", !!res.data.requiresOtp);
    console.log("Token received:", !!res.data.token);
  } catch (err) {
    console.error("Test 3 failed:", err.response?.data || err.message);
  }

  // 4. Mobile Login Outside Time Window (e.g. 9:00 AM IST)
  console.log("\n--- TEST 4: Mobile Login Outside Window (9:00 AM IST) (Should fail 403) ---");
  try {
    await axios.post(`${BASE_URL}/auth/login`, {
      email: "test@example.com",
      password: "newpassword123",
      browser: "Safari",
      os: "iOS",
      deviceType: "mobile",
      mockTime: "2026-06-28T09:00:00+05:30" // 9:00 AM IST
    });
    console.error("Test 4 FAILED: Login should have been blocked!");
  } catch (err) {
    console.log("Success! Login was blocked correctly. Status:", err.response?.status);
    console.log("Error details:", err.response?.data);
  }

  // 5. Mobile Login Inside Time Window (e.g. 11:30 AM IST)
  console.log("\n--- TEST 5: Mobile Login Inside Window (11:30 AM IST) (Should succeed) ---");
  try {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email: "test@example.com",
      password: "newpassword123",
      browser: "Safari",
      os: "iOS",
      deviceType: "mobile",
      mockTime: "2026-06-28T11:30:00+05:30" // 11:30 AM IST
    });
    console.log("Success! Response status:", res.status);
    console.log("Requires OTP:", !!res.data.requiresOtp);
  } catch (err) {
    console.error("Test 5 failed:", err.response?.data || err.message);
  }

  // 6. DB Inspection
  console.log("\n--- DB Inspection: Last 6 LoginHistory Records ---");
  await mongoose.connect(DB_URL);
  try {
    const logs = await LoginHistory.find({ email: "test@example.com" })
      .sort({ createdAt: -1 })
      .limit(6);
    
    logs.forEach((log, index) => {
      console.log(`[${index + 1}] Time: ${log.createdAt.toISOString()} | IP: ${log.ipAddress} | Browser: ${log.browser} | OS: ${log.os} | Device: ${log.deviceType} | Status: ${log.status} | Reason: ${log.failureReason || 'None'}`);
    });
  } catch (err) {
    console.error("Error inspecting database:", err);
  } finally {
    await mongoose.disconnect();
    console.log("\nTests finished.");
    process.exit(0);
  }
}

runTests();
