import React, { createContext, useContext, useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { selectuser } from "@/Feature/Userslice";
import { translations, Language } from "../utils/translations";
import { api } from "../utils/api";
import { toast } from "react-toastify";
import { ShieldCheck, Mail, KeyRound, Loader2, X } from "lucide-react";

interface LanguageContextProps {
  language: Language;
  changeLanguage: (lang: Language) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useSelector(selectuser);
  const [language, setLanguageState] = useState<Language>('en');
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [simulatedOtp, setSimulatedOtp] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("preferredLanguage") as Language;
    if (saved && ['en', 'es', 'hi', 'pt', 'zh', 'fr'].includes(saved)) {
      setLanguageState(saved);
    }
  }, []);

  const changeLanguage = (lang: Language) => {
    if (lang === 'fr') {
      if (language === 'fr') return; // Already French
      
      // If user is logged in, prefill email
      if (user && user.email) {
        setEmail(user.email);
      } else {
        setEmail("");
      }
      setOtp("");
      setOtpSent(false);
      setSimulatedOtp(null);
      setShowModal(true);
    } else {
      setLanguageState(lang);
      localStorage.setItem("preferredLanguage", lang);
      toast.success(`Language changed to ${lang.toUpperCase()}`);
    }
  };

  const handleSendOtp = async () => {
    if (!email) {
      toast.error("Please enter your email address.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/users/send-lang-otp", { email });
      if (res.data.success) {
        setOtpSent(true);
        toast.success(t("auth.otp_sent"));
        if (res.data.simulated && res.data.otp) {
          setSimulatedOtp(res.data.otp);
          console.log(`[TEST MODE] French Verification OTP: ${res.data.otp}`);
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP code.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/users/verify-lang-otp", { email, otp });
      if (res.data.success) {
        setLanguageState('fr');
        localStorage.setItem("preferredLanguage", 'fr');
        setShowModal(false);
        toast.success(t("auth.otp_verified"));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || t("auth.otp_error"));
    } finally {
      setLoading(false);
    }
  };

  const t = (key: string, replacements?: Record<string, string | number>) => {
    const keys = key.split('.');
    let current: any = translations[language] || translations['en'];
    
    for (const k of keys) {
      if (current && current[k] !== undefined) {
        current = current[k];
      } else {
        // Fallback to English
        let fallback: any = translations['en'];
        for (const fk of keys) {
          if (fallback && fallback[fk] !== undefined) {
            fallback = fallback[fk];
          } else {
            return key;
          }
        }
        current = fallback;
        break;
      }
    }

    let translated = typeof current === 'string' ? current : key;
    if (replacements) {
      Object.entries(replacements).forEach(([k, v]) => {
        translated = translated.replace(`{${k}}`, String(v));
      });
    }
    return translated;
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-150 overflow-hidden transform scale-100 transition-all duration-300">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative">
              <button 
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-white/80 hover:text-white transition"
              >
                <X size={20} />
              </button>
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <ShieldCheck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">{t("auth.verification_required")}</h3>
                  <p className="text-xs text-white/80 mt-0.5">Secure Access Verification</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              <p className="text-sm text-gray-600 leading-relaxed">
                {t("auth.verification_msg")}
              </p>

              {/* Email Step */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t("auth.enter_email")}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    value={email}
                    disabled={otpSent || (!!user && !!user.email)}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("auth.email_placeholder")}
                    className="block w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-800 disabled:bg-gray-100 disabled:text-gray-500 transition-all"
                  />
                </div>
              </div>

              {/* OTP Step */}
              {otpSent && (
                <div className="space-y-2 animate-slideDown">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t("auth.enter_otp")}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <KeyRound size={16} />
                    </div>
                    <input
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="e.g. 123456"
                      className="block w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-800 tracking-[0.25em] font-mono text-center transition-all"
                    />
                  </div>
                  {simulatedOtp && (
                    <div className="mt-2.5 p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 flex flex-col gap-1">
                      <span className="font-bold">🧪 Test Mode OTP Code:</span>
                      <span className="font-mono text-sm tracking-wider font-semibold">{simulatedOtp}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl text-sm transition cursor-pointer"
              >
                {t("auth.close")}
              </button>

              {!otpSent ? (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {loading && <Loader2 className="animate-spin h-4 w-4" />}
                  <span>{t("auth.send_otp")}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={loading}
                  className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-sm transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {loading && <Loader2 className="animate-spin h-4 w-4" />}
                  <span>{t("auth.verify_otp")}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
