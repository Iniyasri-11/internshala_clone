import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Mail, Phone, Loader, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react';
import { api } from '@/utils/api';
import io from 'socket.io-client';

const ForgotPasswordPage = () => {
  const [contactMethod, setContactMethod] = useState('email'); // 'email' or 'phone'
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const [socketId, setSocketId] = useState<string | null>(null);
  const [simulated, setSimulated] = useState(false);
  const [resetLink, setResetLink] = useState('');
  const [tempPassword, setTempPassword] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';
    const socketUrl = baseUrl.replace(/\/api$/, '');
    const socket = io(socketUrl, {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      setSocketId(socket.id || null);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    setSuccess(false);
    setSimulated(false);

    try {
      const payload = contactMethod === 'email' 
        ? { email, socketId } 
        : { phone, socketId };

      const response = await api.post('/password/forgot-password', payload);
      setMessage(response.data.message);
      setSuccess(true);
      if (response.data.simulated) {
        setSimulated(true);
        setResetLink(response.data.resetLink || '');
        setTempPassword(response.data.temporaryPassword || '');
      }
      setEmail('');
      setPhone('');
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError(err.response.data.message);
        setRetryAfter(err.response.data.retryAfter);
      } else {
        const errMsg = err.response?.data?.message || 'An error occurred. Please try again.';
        setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full rounded-3xl bg-white p-10 shadow-lg border border-gray-100/50">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-blue-50 rounded-2xl text-blue-600 mb-4">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Forgot Password</h1>
          <p className="mt-2 text-gray-600 text-sm">
            Enter your email or phone number to reset your password
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 animate-fade-in">
            <AlertCircle className="text-red-500 shrink-0" size={20} />
            <div>
              <p className="text-red-700 text-sm font-medium">{error}</p>
              {retryAfter && (
                <p className="text-red-600 text-xs mt-1">
                  {retryAfter >= 60
                    ? `Please try again in about ${Math.ceil(retryAfter / 60)} hour(s).`
                    : `You can retry after approximately ${retryAfter} minute(s).`}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Success Message */}
        {success ? (
          <div className="space-y-6 animate-fade-in">
            <div className="p-5 bg-green-50 border border-green-200 rounded-2xl flex gap-3">
              <CheckCircle className="text-green-500 shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-green-800 text-sm font-bold">Reset instructions sent!</p>
                <p className="text-green-700 text-xs mt-1.5 leading-relaxed">
                  {message || 'A password reset link and temporary password have been successfully sent to your registered mail ID.'}
                </p>
                <p className="text-green-600 text-[10px] mt-2 font-medium">
                  * Note: The link and temporary credentials will remain active for 24 hours.
                </p>
              </div>
            </div>

            {simulated && (
              <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
                <p className="text-amber-800 text-xs font-bold uppercase tracking-wider">⚠️ Developer / Local Fallback Active</p>
                <p className="text-amber-700 text-[11px] leading-relaxed">
                  Since a valid SMTP mail server is not configured in the backend `.env` file, the mail was simulated locally.
                </p>
                <div className="bg-white p-3.5 border border-slate-100 rounded-xl space-y-2.5 shadow-sm text-xs">
                  <div>
                    <span className="font-bold text-slate-400">Temporary Password:</span>{' '}
                    <span className="font-mono font-bold text-slate-800 tracking-wider select-all">{tempPassword}</span>
                  </div>
                  <div className="text-center pt-1.5">
                    <Link
                      href={resetLink}
                      className="inline-block w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 px-4 rounded-xl text-center transition-all cursor-pointer text-[11px]"
                    >
                      Reset Password Now (Direct Link)
                    </Link>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setSuccess(false);
                setMessage('');
                setError('');
                setSimulated(false);
              }}
              className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 hover:shadow-lg transition-all flex items-center justify-center cursor-pointer"
            >
              Request Another Link
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Contact Method Tabs */}
            <div className="flex gap-3 mb-6">
              <button
                type="button"
                onClick={() => setContactMethod('email')}
                className={`flex-1 py-2.5 px-3 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
                  contactMethod === 'email'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Mail size={16} className="inline mr-2" />
                Email
              </button>
              <button
                type="button"
                onClick={() => setContactMethod('phone')}
                className={`flex-1 py-2.5 px-3 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
                  contactMethod === 'phone'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Phone size={16} className="inline mr-2" />
                Phone
              </button>
            </div>

            {/* Email Input */}
            {contactMethod === 'email' && (
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            )}

            {/* Phone Input */}
            {contactMethod === 'phone' && (
              <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter your registered phone number"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 hover:shadow-lg transition-all disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader size={18} className="animate-spin" />
                  Sending Request...
                </>
              ) : (
                'Send Reset Link'
              )}
            </button>

            {/* Info Box */}
            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700">
              <p className="font-bold mb-1 flex items-center gap-1.5 text-xs tracking-wide uppercase">
                What happens next?
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs text-blue-600/90 font-medium">
                <li>We'll generate a secure temporary password</li>
                <li>You'll receive a password reset link in your mail</li>
                <li>Both credentials will expire in 24 hours</li>
                <li>Requests are limited to once per day</li>
              </ul>
            </div>
          </form>
        )}

        {/* Back to Login Link */}
        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm">
            Remember your password?{' '}
            <Link href="/" className="text-blue-600 hover:text-blue-700 font-semibold">
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
