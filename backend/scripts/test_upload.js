const axios = require("axios");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:5000/api";
const IMAGE_PATH = "C:\\Users\\iniya\\.gemini\\antigravity-ide\\brain\\3bc306e9-b20c-482d-8a75-1f9ffe297d83\\test_avatar_1782622539488.png";

async function runUploadTest() {
  console.log("Starting backend upload verification (Native FormData)...");

  try {
    // 1. Login to get token
    console.log("Logging in...");
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: "test@example.com",
      password: "newpassword123",
      browser: "Safari",
      os: "macOS",
      deviceType: "desktop"
    });

    const token = loginRes.data.token;
    console.log("Token obtained successfully.");

    // 2. Prepare native FormData
    console.log("Preparing file payload...");
    const fileBuffer = fs.readFileSync(IMAGE_PATH);
    const fileBlob = new Blob([fileBuffer], { type: "image/png" });
    const formData = new FormData();
    formData.append("photo", fileBlob, "test_avatar.png");

    // 3. Post file
    console.log("Sending photo upload request...");
    const uploadRes = await axios.post(`${BASE_URL}/users/update-photo`, formData, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log("\nSuccess! Upload response:");
    console.log(JSON.stringify(uploadRes.data, null, 2));

    // 4. Verify file exists in uploads folder
    const photoUrl = uploadRes.data.user.photo;
    const fileName = path.basename(photoUrl);
    const savedPath = path.join(__dirname, "..", "uploads", fileName);
    if (fs.existsSync(savedPath)) {
      console.log(`\nVerified: Uploaded file successfully saved to disk at: ${savedPath}`);
    } else {
      console.error(`\nError: File not found at: ${savedPath}`);
    }

  } catch (err) {
    console.error("Test failed:", err.response?.data || err.message);
  } finally {
    console.log("\nTests finished.");
    process.exit(0);
  }
}

runUploadTest();
