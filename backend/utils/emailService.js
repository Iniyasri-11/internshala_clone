const nodemailer = require('nodemailer');
require('dotenv').config();

const emailUser = process.env.EMAIL_USER;
const emailPassword = process.env.EMAIL_PASSWORD;
const emailService = process.env.EMAIL_SERVICE || 'gmail';
const emailHost = process.env.EMAIL_HOST;
const emailPort = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : null;
const emailSecure = process.env.EMAIL_SECURE === 'true';
const testMode = process.env.TEST_EMAIL_MODE === 'true';

function buildTransportConfig() {
  if (!emailUser || !emailPassword) {
    return null;
  }

  if (emailHost && emailPort) {
    return {
      host: emailHost,
      port: emailPort,
      secure: emailSecure,
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    };
  }

  return {
    service: emailService,
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  };
}

async function sendPasswordResetEmail(email, name, resetLink, temporaryPassword, expiresAt) {
  const expirationText = expiresAt
    ? new Date(expiresAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST'
    : '24 hours';

  const mailOptions = {
    from: emailUser || 'no-reply@example.com',
    to: email,
    subject: 'Password Reset Request - Internshala Clone',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Password Reset Request</h2>
        <p>Hello ${name},</p>
        <p>We received a request to reset your password. Here's your temporary password:</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <p style="margin: 0; font-size: 18px; font-weight: bold; letter-spacing: 2px;">${temporaryPassword}</p>
        </div>
        
        <p>You can also click the link below to reset your password:</p>
        <a href="${resetLink}" style="display: inline-block; padding: 12px 30px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Reset Password
        </a>
        
        <p style="color: #666; font-size: 14px;">
          <strong>Important:</strong> This temporary password and link will expire on ${expirationText}.
        </p>
        
        <p style="color: #666; font-size: 14px;">
          If you didn't request a password reset, please ignore this email or contact our support team.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          © ${new Date().getFullYear()} Internshala Clone. All rights reserved.
        </p>
      </div>
    `,
  };

  // Test mode: log credentials instead of sending
  if (testMode) {
    console.log('\n' + '='.repeat(80));
    console.log('📧 TEST MODE: Password Reset Email (not actually sent)');
    console.log('='.repeat(80));
    console.log(`To: ${email}`);
    console.log(`Recipient Name: ${name}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log('\n📋 Temporary Password:');
    console.log(`   ${temporaryPassword}`);
    console.log('\n🔗 Reset Link:');
    console.log(`   ${resetLink}`);
    console.log('\n💡 To use: Copy the reset link above and paste it in your browser, or use the temporary password to login.');
    console.log('='.repeat(80) + '\n');
    return { success: true, simulated: true };
  }

  // Production mode: use actual email service
  const transportConfig = buildTransportConfig();

  const fallbackToLog = (reason) => {
    console.warn(`⚠️ Email transporter failed (${reason}). Falling back to simulated log mode.`);
    console.log('\n' + '='.repeat(80));
    console.log('📧 SIMULATED FALLBACK MODE: Password Reset Email (SMTP Failed)');
    console.log('='.repeat(80));
    console.log(`To: ${email}`);
    console.log(`Recipient Name: ${name}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log('\n📋 Temporary Password:');
    console.log(`   ${temporaryPassword}`);
    console.log('\n🔗 Reset Link:');
    console.log(`   ${resetLink}`);
    console.log('='.repeat(80) + '\n');
    return { success: true, simulated: true };
  };

  if (!transportConfig) {
    return fallbackToLog('Email credentials/host not configured');
  }

  let transporter;
  try {
    transporter = nodemailer.createTransport({
      ...transportConfig,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });
    await transporter.verify();
  } catch (error) {
    console.error('Email transporter verification failed:', error.message);
    return fallbackToLog(`Transporter verify failed: ${error.message}`);
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    return fallbackToLog(`sendMail failed: ${error.message}`);
  }
}

async function sendSubscriptionEmail(email, name, details) {
  const { planName, price, invoiceNumber, paymentId, transactionDate, expiryDate } = details;
  const mailOptions = {
    from: emailUser || 'no-reply@example.com',
    to: email,
    subject: `Subscription Confirmation - ${planName} Plan`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Subscription Activated</h2>
        <p>Hi ${name},</p>
        <p>Thank you for subscribing to the <strong>${planName}</strong> plan.</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tbody>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Plan</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${planName}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Price</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">₹${price}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Invoice</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${invoiceNumber}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Payment ID</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${paymentId}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Transaction Date</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${new Date(transactionDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Expiry Date</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${new Date(expiryDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</td></tr>
          </tbody>
        </table>
        <p style="margin-top: 20px;">If you have any questions, contact our support team at <a href="mailto:${emailUser}">${emailUser}</a>.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
        <p style="color: #999; font-size: 12px; text-align: center;">© 2026 Internshala Clone. All rights reserved.</p>
      </div>
    `,
  };

  const fallbackToLog = (reason) => {
    console.warn(`⚠️ Email transporter failed (${reason}). Falling back to simulated log mode.`);
    console.log('\n' + '='.repeat(80));
    console.log('📧 SIMULATED FALLBACK MODE: Subscription Email (SMTP Failed)');
    console.log('='.repeat(80));
    console.log(`To: ${email}`);
    console.log(`Recipient Name: ${name}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log('\n📋 Plan & Invoice Details:');
    console.log(`   Plan: ${planName}`);
    console.log(`   Price: ₹${price}`);
    console.log(`   Invoice Number: ${invoiceNumber}`);
    console.log(`   Payment ID: ${paymentId}`);
    console.log(`   Transaction Date: ${new Date(transactionDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log(`   Expiry Date: ${new Date(expiryDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log('='.repeat(80) + '\n');
    return { success: true, simulated: true };
  };

  if (testMode) {
    console.log('\n' + '='.repeat(80));
    console.log('📧 TEST MODE: Subscription Email (not actually sent)');
    console.log('='.repeat(80));
    console.log(`To: ${email}`);
    console.log(`Recipient Name: ${name}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`Details: ${JSON.stringify(details, null, 2)}`);
    console.log('='.repeat(80) + '\n');
    return { success: true };
  }

  const transportConfig = buildTransportConfig();
  if (!transportConfig) {
    return fallbackToLog('Email credentials/host not configured');
  }

  let transporter;
  try {
    transporter = nodemailer.createTransport({
      ...transportConfig,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });
    await transporter.verify();
  } catch (error) {
    return fallbackToLog(`Transporter verify failed: ${error.message}`);
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Subscription email sent to ${email}`);
    return { success: true };
  } catch (error) {
    return fallbackToLog(`sendMail failed: ${error.message}`);
  }
}

async function sendOTPEmail(email, name, otp) {
  const mailOptions = {
    from: emailUser || 'no-reply@example.com',
    to: email,
    subject: 'Verification OTP - Resume Creation',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Resume Creation Verification</h2>
        <p>Hi ${name},</p>
        <p>You requested to create a premium resume on our platform. Please use the following One-Time Password (OTP) to verify your request:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <p style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #1e40af;">${otp}</p>
        </div>
        <p style="color: #666; font-size: 14px;">This OTP is valid for 10 minutes. If you did not make this request, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
        <p style="color: #999; font-size: 12px; text-align: center;">© 2026 Internshala Clone. All rights reserved.</p>
      </div>
    `,
  };

  const fallbackToLog = (reason) => {
    console.warn(`⚠️ Email transporter failed (${reason}). Falling back to simulated log mode.`);
    console.log('\n' + '='.repeat(80));
    console.log('📧 SIMULATED FALLBACK MODE: Resume OTP Verification');
    console.log('='.repeat(80));
    console.log(`To: ${email}`);
    console.log(`Recipient Name: ${name}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`OTP: ${otp}`);
    console.log('='.repeat(80) + '\n');
    return { success: true, simulated: true };
  };

  if (testMode) {
    console.log('\n' + '='.repeat(80));
    console.log('📧 TEST MODE: Resume OTP (not actually sent)');
    console.log('='.repeat(80));
    console.log(`To: ${email}`);
    console.log(`Recipient Name: ${name}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`OTP: ${otp}`);
    console.log('='.repeat(80) + '\n');
    return { success: true };
  }

  const transportConfig = buildTransportConfig();
  if (!transportConfig) {
    return fallbackToLog('Email credentials/host not configured');
  }

  let transporter;
  try {
    transporter = nodemailer.createTransport({
      ...transportConfig,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });
    await transporter.verify();
  } catch (error) {
    return fallbackToLog(`Transporter verify failed: ${error.message}`);
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Resume OTP email sent to ${email}`);
    return { success: true };
  } catch (error) {
    return fallbackToLog(`sendMail failed: ${error.message}`);
  }
}

async function sendLanguageOTPEmail(email, name, otp) {
  const mailOptions = {
    from: emailUser || 'no-reply@example.com',
    to: email,
    subject: 'Verification OTP - French Language Activation',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #2563eb; margin: 0; font-size: 24px;">Activate French Translation</h2>
          <p style="color: #4b5563; font-size: 14px; margin-top: 5px;">Security Verification Required</p>
        </div>
        <p>Hi ${name || 'User'},</p>
        <p>You requested to switch the website language to French. Please enter the following 6-digit One-Time Password (OTP) on the verification screen to complete this change:</p>
        <div style="background-color: #f3f4f6; padding: 18px; border-radius: 8px; margin: 25px 0; text-align: center; border: 1px dashed #cbd5e1;">
          <p style="margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #1e40af;">${otp}</p>
        </div>
        <p style="color: #ef4444; font-size: 13px; font-weight: 500;">
          <strong>Important:</strong> This verification code is valid for 10 minutes and can only be used once.
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          If you did not request this language change, please ignore this email or contact support if you suspect unauthorized access.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
        <p style="color: #999; font-size: 12px; text-align: center;">
          © ${new Date().getFullYear()} Internshala Clone. All rights reserved.
        </p>
      </div>
    `,
  };

  const fallbackToLog = (reason) => {
    console.warn(`⚠️ Email transporter failed (${reason}). Falling back to simulated log mode.`);
    console.log('\n' + '='.repeat(80));
    console.log('📧 SIMULATED FALLBACK MODE: French Language OTP Verification');
    console.log('='.repeat(80));
    console.log(`To: ${email}`);
    console.log(`Recipient Name: ${name}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`OTP: ${otp}`);
    console.log('='.repeat(80) + '\n');
    return { success: true, simulated: true };
  };

  if (testMode) {
    console.log('\n' + '='.repeat(80));
    console.log('📧 TEST MODE: French Language OTP (not actually sent)');
    console.log('='.repeat(80));
    console.log(`To: ${email}`);
    console.log(`Recipient Name: ${name}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`OTP: ${otp}`);
    console.log('='.repeat(80) + '\n');
    return { success: true };
  }

  const transportConfig = buildTransportConfig();
  if (!transportConfig) {
    return fallbackToLog('Email credentials/host not configured');
  }

  let transporter;
  try {
    transporter = nodemailer.createTransport({
      ...transportConfig,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });
    await transporter.verify();
  } catch (error) {
    return fallbackToLog(`Transporter verify failed: ${error.message}`);
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ French Language OTP email sent to ${email}`);
    return { success: true };
  } catch (error) {
    return fallbackToLog(`sendMail failed: ${error.message}`);
  }
}

async function sendLoginOTPEmail(email, name, otp) {
  const mailOptions = {
    from: emailUser || 'no-reply@example.com',
    to: email,
    subject: 'Google Chrome Login Verification OTP - Internshala Clone',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #2563eb; margin: 0; font-size: 24px;">Chrome Login Verification</h2>
          <p style="color: #4b5563; font-size: 14px; margin-top: 5px;">Security Verification Required</p>
        </div>
        <p>Hi ${name || 'User'},</p>
        <p>You are attempting to log in from Google Chrome. Please enter the following 6-digit One-Time Password (OTP) to complete your login:</p>
        <div style="background-color: #f3f4f6; padding: 18px; border-radius: 8px; margin: 25px 0; text-align: center; border: 1px dashed #cbd5e1;">
          <p style="margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #1e40af;">${otp}</p>
        </div>
        <p style="color: #ef4444; font-size: 13px; font-weight: 500;">
          <strong>Important:</strong> This verification code is valid for 10 minutes and can only be used once.
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          If you did not request this login, please change your password immediately as your credentials may be compromised.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
        <p style="color: #999; font-size: 12px; text-align: center;">
          © ${new Date().getFullYear()} Internshala Clone. All rights reserved.
        </p>
      </div>
    `,
  };

  const fallbackToLog = (reason) => {
    console.warn(`⚠️ Email transporter failed (${reason}). Falling back to simulated log mode.`);
    console.log('\n' + '='.repeat(80));
    console.log('📧 SIMULATED FALLBACK MODE: Chrome Login OTP Verification');
    console.log('='.repeat(80));
    console.log(`To: ${email}`);
    console.log(`Recipient Name: ${name}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`OTP: ${otp}`);
    console.log('='.repeat(80) + '\n');
    return { success: true, simulated: true };
  };

  if (testMode) {
    console.log('\n' + '='.repeat(80));
    console.log('📧 TEST MODE: Chrome Login OTP (not actually sent)');
    console.log('='.repeat(80));
    console.log(`To: ${email}`);
    console.log(`Recipient Name: ${name}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`OTP: ${otp}`);
    console.log('='.repeat(80) + '\n');
    return { success: true, simulated: true };
  }

  const transportConfig = buildTransportConfig();
  if (!transportConfig) {
    return fallbackToLog('Email credentials/host not configured');
  }

  let transporter;
  try {
    transporter = nodemailer.createTransport({
      ...transportConfig,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });
    await transporter.verify();
  } catch (error) {
    return fallbackToLog(`Transporter verify failed: ${error.message}`);
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Chrome Login OTP email sent to ${email}`);
    return { success: true };
  } catch (error) {
    return fallbackToLog(`sendMail failed: ${error.message}`);
  }
}

module.exports = { sendPasswordResetEmail, sendSubscriptionEmail, sendOTPEmail, sendLanguageOTPEmail, sendLoginOTPEmail };
