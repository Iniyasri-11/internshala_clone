import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { login } from "@/Feature/Userslice";

const LoginPage = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
  const [simulatedOtp, setSimulatedOtp] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [env, setEnv] = useState<{ browser: string; os: string; deviceType: string } | null>(null);
  const dispatch = useDispatch();

  useEffect(() => {
    const detectEnvironment = async () => {
      const ua = navigator.userAgent;
      let browser = 'Unknown';
      let os = 'Unknown';
      let deviceType = 'desktop';

      // Detect OS
      if (/windows/i.test(ua)) os = 'Windows';
      else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
      else if (/linux/i.test(ua)) os = 'Linux';
      else if (/android/i.test(ua)) os = 'Android';
      else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';

      // Detect Browser
      if (/edg/i.test(ua)) browser = 'Edge';
      else if (/opr/i.test(ua) || /opera/i.test(ua)) browser = 'Opera';
      else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
      else if (/chrome|crios/i.test(ua)) browser = 'Google Chrome';
      else if (/safari/i.test(ua)) browser = 'Safari';

      // Detect Device Type (desktop, laptop, mobile)
      if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) {
        deviceType = 'mobile';
      } else {
        deviceType = 'desktop'; // default desktop
        const nav = navigator as any;
        if (nav.getBattery) {
          try {
            const battery = await nav.getBattery();
            if (battery) {
              deviceType = 'laptop';
            }
          } catch (err) {
            console.error("Battery API error:", err);
          }
        }
      }

      setEnv({ browser, os, deviceType });
    };

    detectEnvironment();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    if (otpRequired && !otp) {
      setError("Please enter the verification OTP code.");
      return;
    }

    (async () => {
      try {
        const payload = { 
          email, 
          password, 
          otp: otpRequired ? otp : undefined,
          browser: env?.browser,
          os: env?.os,
          deviceType: env?.deviceType
        };

        const res = await (await import('@/utils/api')).api.post('/auth/login', payload);
        
        if (res.data.requiresOtp) {
          setOtpRequired(true);
          setMessage("A verification OTP has been sent to your email. Please verify to complete login.");
          if (res.data.otp) {
            setSimulatedOtp(res.data.otp);
          }
          return;
        }

        const dataUser = res.data.user || res.data;
        const token = res.data.token;
        if (!dataUser) throw new Error('Invalid server response');
        try {
          localStorage.setItem('user', JSON.stringify(dataUser));
          if (token) localStorage.setItem('token', token);
        } catch (e) {}
        dispatch(login(dataUser));
        setMessage('Login successful. Redirecting to home...');
        setTimeout(() => router.push('/'), 800);
      } catch (err: any) {
        console.error(err);
        setError(err?.response?.data?.error || err?.message || 'Unable to login.');
      }
    })();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full rounded-3xl bg-white p-10 shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {otpRequired ? "Security Verification" : "Login"}
          </h1>
          <p className="mt-3 text-gray-600 text-sm">
            {otpRequired 
              ? "We sent a 6-digit verification code to your email." 
              : "Sign in with your registered email and password."}
          </p>
        </div>

        {!otpRequired ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-700">
                {message}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                required
              />
            </div>

            <div className="flex justify-end">
              <Link href="/auth/forgotpassword" className="text-sm text-blue-600 hover:text-blue-700">Forgot password?</Link>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 px-5 py-3 text-white font-medium hover:bg-blue-700 transition"
            >
              Login
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-700">
                {message}
              </div>
            )}

            <div>
              <label htmlFor="email-static" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <input
                id="email-static"
                type="email"
                value={email}
                disabled
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-500 focus:outline-none cursor-not-allowed text-sm"
              />
            </div>

            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                Verification Code (OTP)
              </label>
              <input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 text-center text-lg font-semibold tracking-widest"
                required
              />
              {simulatedOtp && (
                <p className="mt-2 text-xs text-blue-600 bg-blue-50 rounded-lg p-2.5 text-center border border-blue-100 leading-relaxed">
                  <strong>Simulated Mode:</strong> Use code <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-sm font-bold text-blue-800">{simulatedOtp}</code> to verify.
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 px-5 py-3 text-white font-medium hover:bg-blue-700 transition"
            >
              Verify & Login
            </button>

            <button
              type="button"
              onClick={() => {
                setOtpRequired(false);
                setOtp("");
                setSimulatedOtp("");
                setMessage("");
                setError("");
              }}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700 font-medium pt-2 block"
            >
              Back to credentials login
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-sm text-gray-600">
          New here?{' '}
          <Link href="/auth/register" className="text-blue-600 hover:text-blue-700 font-medium">
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
