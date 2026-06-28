# Email Service Setup Guide

## Overview
The forgot password functionality requires email service configuration. The backend uses **Nodemailer** to send password reset emails via Gmail.

## ⚠️ Current Status
**Error:** "Failed to send reset email. Email service not configured. Please set EMAIL_USER and EMAIL_PASSWORD in backend .env."

**Solution:** Configure `EMAIL_USER` and `EMAIL_PASSWORD` in the `.env` file.

---

## Setup Instructions

### Option 1: Using Gmail (Recommended)

#### Step 1: Enable 2-Step Verification
1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Click **Security** in the left menu
3. Scroll to **How you sign in to Google**
4. Enable **2-Step Verification** (follow Google's instructions)

#### Step 2: Generate App Password
1. After enabling 2-Step Verification, go back to [myaccount.google.com/security](https://myaccount.google.com/security)
2. Scroll to **App passwords** (it will appear after 2-Step is enabled)
3. Select:
   - App: **Mail**
   - Device: **Windows Computer** (or your device type)
4. Click **Generate**
5. Copy the 16-character app password provided by Google

#### Step 3: Update `.env` File
Edit `backend/.env` and replace:

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
EMAIL_SERVICE=gmail
```

**Example:**
```env
EMAIL_USER=johnsmith@gmail.com
EMAIL_PASSWORD=abcd efgh ijkl mnop
EMAIL_SERVICE=gmail
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your_secret_key_here_min_32_characters_recommended
```

⚠️ **Important:** 
- Use the **16-character App Password** (not your Gmail password)
- The password has spaces - include them as shown by Google
- Never commit `.env` to version control

---

### Option 2: Using Other Email Providers (Mailtrap, SendGrid, etc.)

If you want to use a service like Mailtrap for development:

```env
EMAIL_HOST=live.smtp.mailtrap.io
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=api
EMAIL_PASSWORD=your-mailtrap-password
EMAIL_SERVICE=gmail
```

Get credentials from:
- **Mailtrap:** [mailtrap.io](https://mailtrap.io) → Sending Domain
- **SendGrid:** [sendgrid.com](https://sendgrid.com) → API Keys
- **AWS SES:** [aws.amazon.com/ses](https://aws.amazon.com/ses)

---

## Testing the Setup

After updating `.env`:

1. **Restart the backend server:**
   ```powershell
   npm start
   # Or if using npm run dev
   npm run dev
   ```

2. **Test forgot password feature:**
   - Go to http://localhost:3000/auth/forgotpassword
   - Enter your registered email
   - You should receive a reset email within seconds

3. **Check backend logs:**
   ```
   Password reset email sent to your-email@gmail.com
   ```

---

## Troubleshooting

### "Email transporter verification failed"
- Double-check `EMAIL_USER` and `EMAIL_PASSWORD`
- Ensure 2-Step Verification is enabled on your Google Account
- Verify you're using an **App Password**, not your Gmail password

### "Invalid credentials"
- Gmail may have blocked the app - [Allow less secure apps](https://support.google.com/accounts/answer/3466521)
- Try generating a new App Password

### Email not received
- Check spam/junk folder
- Verify `FRONTEND_URL` is correct (used in reset link)
- Check backend console for error messages

### "Connection timeout"
- Check internet connection
- Verify firewall isn't blocking port 587 (SMTP)
- Try using a different email provider

---

## Environment Variables Reference

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `EMAIL_USER` | ✅ Yes | `your-email@gmail.com` | Sender email address |
| `EMAIL_PASSWORD` | ✅ Yes | `abcd efgh ijkl mnop` | App password (Gmail) or provider password |
| `EMAIL_SERVICE` | ❌ No | `gmail` | Service name (gmail, yahoo, outlook, etc.) |
| `EMAIL_HOST` | ❌ No | `smtp.gmail.com` | SMTP host (if not using predefined service) |
| `EMAIL_PORT` | ❌ No | `587` | SMTP port (usually 587 or 465) |
| `EMAIL_SECURE` | ❌ No | `true` or `false` | Use TLS encryption |
| `FRONTEND_URL` | ✅ Yes | `http://localhost:3000` | Used in reset password link |
| `JWT_SECRET` | ✅ Yes | `your-secret-key` | Secret for password reset tokens |

---

## Security Notes

🔒 **Best Practices:**
- Never commit `.env` to version control
- Use App Passwords instead of main account password
- Rotate credentials periodically in production
- Use environment variable services (AWS Secrets Manager, etc.) in production

---

## Next Steps

1. Set up a Gmail account or use your existing one
2. Enable 2-Step Verification
3. Generate an App Password
4. Update `backend/.env` with credentials
5. Restart backend server
6. Test forgot password feature

**Support:** If you encounter issues, check backend console logs for detailed error messages.
