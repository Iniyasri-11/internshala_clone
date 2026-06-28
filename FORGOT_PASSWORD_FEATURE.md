# Forgot Password Feature - Implementation Guide

## Overview
This document outlines the Forgot Password feature implementation for the Internshala Clone application.

## Features Implemented

### 1. **Rate Limiting**
- Users can request password reset **only once per day**
- System tracks `lastPasswordResetRequest` timestamp in the User model
- Attempting to reset more than once per day returns: `"You can use this option only once per day."`
- Returns retry time in hours

### 2. **Password Generator**
- Creates secure random passwords with 12 characters (customizable)
- Contains **only uppercase and lowercase letters** (no numbers or special characters)
- User-friendly for manual entry if needed

### 3. **Secure Reset Token**
- Uses JWT tokens with 24-hour expiration
- Tokens are stored in the database and validated before password change
- Prevents token reuse after password is reset

### 4. **Email Integration**
- Sends password reset email with:
  - Temporary password for immediate access
  - Reset link for secure password change
  - Professional email template
  - 24-hour expiration notice
- Uses Gmail SMTP for reliable delivery

## File Structure

```
Backend:
├── Routes/
│   └── password.js                    # Password reset routes
├── utils/
│   ├── passwordGenerator.js          # Password generation utility
│   └── emailService.js               # Email sending utility
├── Model/
│   └── User.js                       # Updated with password reset fields
└── .env.example                      # Environment configuration template

Frontend:
├── pages/auth/
│   ├── forgotpassword.tsx           # Forgot password request page
│   ├── reset-password.tsx           # Password reset form page
│   └── login.tsx                    # Updated with forgot password link
└── Components/
    └── Navbar.tsx                   # Updated with forgot password link
```

## Database Schema Updates

### User Model Fields Added:
```javascript
{
  phone: String,                           // Optional: for reset via phone
  password: String,                        // Hashed password storage
  passwordResetToken: String,              // JWT token for reset link
  passwordResetExpires: Date,              // Token expiration time
  lastPasswordResetRequest: {              // Rate limiting timestamp
    type: Date,
    default: null
  }
}
```

## API Endpoints

### 1. POST `/api/password/forgot-password`
**Request:**
```json
{
  "email": "user@example.com"
  // OR
  "phone": "+1234567890"
}
```

**Response (Success):**
```json
{
  "message": "Password reset email sent successfully. Check your inbox for instructions.",
  "email": "user@example.com"
}
```

**Response (Rate Limited):**
```json
{
  "message": "You can use this option only once per day.",
  "retryAfter": 18,
  "statusCode": 429
}
```

### 2. POST `/api/password/reset-password`
**Request:**
```json
{
  "token": "jwt_reset_token_here",
  "newPassword": "SecureNewPassword123"
}
```

**Response (Success):**
```json
{
  "message": "Password updated successfully. Please log in with your new password."
}
```

### 3. GET `/api/password/verify-token`
**Request:**
```
GET /api/password/verify-token?token=jwt_reset_token_here
```

**Response (Valid):**
```json
{
  "valid": true
}
```

**Response (Invalid/Expired):**
```json
{
  "valid": false,
  "message": "Invalid or expired token"
}
```

## Environment Configuration

Update your `.env` file in the backend folder:

```env
# JWT Secret for password reset tokens
JWT_SECRET=your-secret-key-here-min-32-characters

# Email Configuration (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password-16-chars

# Frontend URL for reset links
FRONTEND_URL=http://localhost:3000
```

### Setting Up Gmail for Email Sending:
1. Enable 2-Step Verification on Google Account
2. Generate an App Password: https://support.google.com/accounts/answer/185833
3. Use the 16-character app password (not your regular Gmail password)

## Frontend Pages

### 1. Forgot Password Page (`/auth/forgotpassword`)
- **Contact Method Selection:** Email or Phone
- **Single Input Field:** Based on selected method
- **Rate Limit Handling:** Shows friendly message with retry time
- **Info Box:** Explains what happens next
- **Features:**
  - Real-time validation
  - Loading states
  - Success/error feedback
  - Auto-clear messages after 5 seconds

### 2. Reset Password Page (`/auth/reset-password`)
- **Token Verification:** Validates link before showing form
- **Password Input:** With show/hide toggle
- **Password Confirmation:** Ensures matching passwords
- **Features:**
  - Minimum 8 character requirement
  - Token expiration handling
  - Auto-redirect to login after successful reset
  - Invalid token error page with option to request new link

### 3. Updated Login Page (`/auth/login`)
- Added "Forgot your password?" link
- Redirects to forgot password page

### 4. Updated Navbar
- Added "Forgot password?" link in the login section
- Easily accessible for users who can't log in

## Security Features

✅ **Rate Limiting:** One request per day maximum
✅ **Token Expiration:** 24-hour validity
✅ **Secure Password Storage:** bcryptjs hashing
✅ **Email Verification:** Confirmation of user identity
✅ **Temporary Password:** Allows immediate access if needed
✅ **JWT Validation:** Prevents token tampering
✅ **HTTPS Recommended:** For production environments

## Testing the Feature

### Test Case 1: Successful Password Reset
1. Click "Forgot password?" on login page
2. Enter registered email
3. Click "Send Reset Link"
4. Check email for reset link
5. Click link or manually enter temporary password
6. Enter new password and confirm
7. Verify login works with new password

### Test Case 2: Rate Limiting
1. Request password reset
2. Immediately try to request again
3. Verify error: "You can use this option only once per day."

### Test Case 3: Token Expiration
1. Generate reset link
2. Wait 24+ hours
3. Try to use link
4. Verify error: "Password reset token has expired"

### Test Case 4: Invalid Email/Phone
1. Try to reset with non-existent email
2. Verify error: "User not found with provided email or phone"

## Production Considerations

1. **Email Service:** Consider using SendGrid, Mailgun, or AWS SES for production
2. **HTTPS:** Ensure all reset links use HTTPS
3. **Rate Limiting:** Adjust 24-hour limit based on business requirements
4. **Token Expiration:** Adjust 24-hour expiration if needed
5. **Password Requirements:** Add stronger validation (uppercase, lowercase, numbers, special chars)
6. **Logging:** Implement audit logging for security
7. **Monitoring:** Track failed reset attempts for security alerts

## Troubleshooting

### Emails not sending:
- Verify EMAIL_USER and EMAIL_PASSWORD are correct
- Check if 2-Step Verification is enabled (for Gmail)
- Verify app password was generated correctly
- Check firewall/network settings
- Review Gmail account security settings

### Reset link not working:
- Verify JWT_SECRET is consistent across restarts
- Check if token has expired (24 hours)
- Verify FRONTEND_URL is correct in .env

### Rate limiting not working:
- Check if lastPasswordResetRequest field is being saved
- Verify MongoDB connection and data persistence
- Restart backend service to clear any in-memory issues

## Future Enhancements

- [ ] SMS-based password reset (using Twilio)
- [ ] Security questions as additional verification
- [ ] Password strength meter
- [ ] Biometric authentication
- [ ] Account recovery codes
- [ ] Multi-device session management
