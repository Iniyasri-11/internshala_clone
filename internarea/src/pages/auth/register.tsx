import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { login } from "@/Feature/Userslice";
import { useLanguage } from "@/context/LanguageContext";

const RegisterPage = () => {
  const router = useRouter();
  const { t } = useLanguage();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dispatch = useDispatch();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!fullName || !email || !password || !confirmPassword) {
      setError(t("auth.placeholder_fullname")); // simple fallback or custom alert
      return;
    }

    if (password !== confirmPassword) {
      setError(t("auth.placeholder_confirm")); // password mismatch alert
      return;
    }

    (async () => {
      try {
        const payload = { name: fullName, email, phone, password };
        const res = await (await import('@/utils/api')).api.post('/auth/register', payload);
        const created = res.data.user || res.data;
        const token = res.data.token;
        if (!created) throw new Error('Registration failed');
        try {
          localStorage.setItem('user', JSON.stringify(created));
          if (token) localStorage.setItem('token', token);
        } catch (e) {}
        dispatch(login(created));
        setMessage(t("auth.register_success"));
        setTimeout(() => router.push('/'), 900);
      } catch (err: any) {
        console.error(err);
        setError(err?.response?.data?.error || err?.message || 'Unable to register.');
      }
    })();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full rounded-3xl bg-white p-10 shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{t("auth.register_title")}</h1>
          <p className="mt-3 text-gray-600 text-sm">
            {t("auth.join_public")}
          </p>
        </div>

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
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
              {t("auth.full_name_label")}
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t("auth.placeholder_fullname")}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 text-gray-900"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              {t("auth.email_label")}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.placeholder_email")}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 text-gray-900"
              required
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              {t("auth.phone_label")}
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("auth.placeholder_phone")}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 text-gray-900"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              {t("auth.password_label")}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.placeholder_password")}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 text-gray-900"
              required
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              {t("auth.confirm_password_label")}
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("auth.placeholder_confirm")}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 text-gray-900"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 px-5 py-3 text-white font-medium hover:bg-blue-700 transition"
          >
            {t("auth.register_title")}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          {t("auth.already_account")}{' '}
          <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium">
            {t("navbar.login")}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
