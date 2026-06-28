import { api } from "@/utils/api";
import { User, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { useDispatch } from "react-redux";
import { login } from "@/Feature/Userslice";

const index = () => {
  const [formadata, setformadata] = useState({
    username: "",
    password: "",
  });
  const [otp, setOtp] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
  const [simulatedOtp, setSimulatedOtp] = useState("");
  const [env, setEnv] = useState<{ browser: string; os: string; deviceType: string } | null>(null);
  const router = useRouter();
  const dispatch = useDispatch();
  const [isloading, setisloading] = useState(false);

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

      // Detect Device Type
      if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) {
        deviceType = 'mobile';
      } else {
        deviceType = 'desktop';
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

  const handlechange = (e: any) => {
    const { name, value } = e.target;
    setformadata((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlesubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formadata.username || !formadata.password) {
      toast.error("Please fill in all details");
      return;
    }
    if (otpRequired && !otp) {
      toast.error("Please enter the verification OTP code.");
      return;
    }
    try {
      setisloading(true);
      const payload = {
        username: formadata.username,
        password: formadata.password,
        otp: otpRequired ? otp : undefined,
        browser: env?.browser,
        os: env?.os,
        deviceType: env?.deviceType
      };

      const res = await api.post("/admin/adminlogin", payload);
      
      if (res.data.requiresOtp) {
        setOtpRequired(true);
        toast.info("Security Verification Required: OTP has been sent to the registered email.");
        if (res.data.otp) {
          setSimulatedOtp(res.data.otp);
        }
        return;
      }

      window.localStorage.setItem('token', res.data.token);
      dispatch(login(res.data.user));
      toast.success("logged in successfully");
      router.push("/adminpanel");
    } catch (error: any) {
      console.log(error);
      toast.error(error?.response?.data?.error || "Invalid credentials");
    } finally {
      setisloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">
          {otpRequired ? "Security Verification" : "Admin Login"}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {otpRequired 
            ? "Chrome logins require OTP confirmation sent to your registered email" 
            : "Access the admin dashboard to manage internships and applications"}
        </p>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handlesubmit}>
            {!otpRequired ? (
              <>
                <div>
                  <label
                    htmlFor="username"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Username
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="username"
                      name="username"
                      type="text"
                      required
                      value={formadata.username}
                      onChange={handlechange}
                      className="block w-full text-black pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter your username"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Password
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      value={formadata.password}
                      onChange={handlechange}
                      className="block w-full text-black pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter your password"
                    />
                  </div>
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={isloading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isloading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                        Signing in...
                      </div>
                    ) : (
                      " Sign in"
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label
                    htmlFor="username-static"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Username
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="username-static"
                      type="text"
                      disabled
                      value={formadata.username}
                      className="block w-full text-gray-500 pl-10 pr-3 py-2 border border-gray-200 bg-gray-50 rounded-md focus:outline-none cursor-not-allowed sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="otp"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Verification Code (OTP)
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <input
                      id="otp"
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="Enter 6-digit OTP"
                      maxLength={6}
                      className="block w-full text-black px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-semibold tracking-widest sm:text-sm"
                      required
                    />
                  </div>
                  {simulatedOtp && (
                    <p className="mt-2 text-xs text-blue-600 bg-blue-50 rounded-lg p-2.5 text-center border border-blue-100 leading-relaxed">
                      <strong>Simulated Mode:</strong> Use code <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-sm font-bold text-blue-800">{simulatedOtp}</code> to verify.
                    </p>
                  )}
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isloading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isloading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                        Verifying OTP...
                      </div>
                    ) : (
                      "Verify & Sign in"
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setOtpRequired(false);
                    setOtp("");
                    setSimulatedOtp("");
                  }}
                  className="w-full text-center text-sm text-gray-500 hover:text-gray-700 font-medium block"
                >
                  Back to admin credentials
                </button>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default index;
