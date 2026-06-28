import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { auth } from "../firebase/firebase";
import { Search, Sun, Moon, Bell, Check, X, User, Globe } from "lucide-react";
import { signOut } from "firebase/auth";
import { useSelector, useDispatch } from "react-redux";
import { selectuser, logout } from "@/Feature/Userslice";
import { api } from "@/utils/api";
import { toast } from "react-toastify";
import { useLanguage } from "@/context/LanguageContext";


const Navbar = () => {
  const user = useSelector(selectuser);
  const dispatch = useDispatch();
  const { t, language, changeLanguage } = useLanguage();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  const [notifications, setNotifications] = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);
  const langRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();


  useEffect(() => {
    setInitialized(true);
    // Initialize Theme
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" || "light";
    setTheme(savedTheme);
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  useEffect(() => {
    const handleRouteChange = () => {
      setShowProfileMenu(false);
      setShowNotifications(false);
      setShowLangMenu(false);
    };
    router.events.on("routeChangeStart", handleRouteChange);
    return () => {
      router.events.off("routeChangeStart", handleRouteChange);
    };
  }, [router.events]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  const fetchNavbarNotifications = async () => {
    if (!user?.uid) return;
    try {
      const [notifRes, requestsRes] = await Promise.all([
        api.get(`/social/notifications/${user.uid}`),
        api.get(`/users/requests/${user.uid}`),
      ]);
      setNotifications(notifRes.data || []);
      const reqs = requestsRes.data?.incoming || requestsRes.data?.incomingRequests || requestsRes.data || [];
      setFriendRequests(Array.isArray(reqs) ? reqs : []);
    } catch (err) {
      console.error("Navbar notifications load error", err);
    }
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setFriendRequests([]);
      return;
    }
    fetchNavbarNotifications();
    const interval = setInterval(fetchNavbarNotifications, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const handlelogout = () => {
    try {
      signOut(auth);
    } catch (e) {}
    dispatch(logout());
  };

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleAcceptRequest = async (e: React.MouseEvent, requesterUid: string) => {
    e.stopPropagation();
    if (!user?.uid) return;
    try {
      setNotifLoading(true);
      await api.post("/users/friend-requests/accept", { uid: user.uid, requesterUid });
      toast.success("Friend request accepted!");
      await fetchNavbarNotifications();
    } catch (err) {
      console.error(err);
      toast.error("Unable to accept request.");
    } finally {
      setNotifLoading(false);
    }
  };

  const handleRejectRequest = async (e: React.MouseEvent, requesterUid: string) => {
    e.stopPropagation();
    if (!user?.uid) return;
    try {
      setNotifLoading(true);
      await api.post("/users/friend-requests/reject", { uid: user.uid, requesterUid });
      toast.success("Friend request rejected.");
      await fetchNavbarNotifications();
    } catch (err) {
      console.error(err);
      toast.error("Unable to reject request.");
    } finally {
      setNotifLoading(false);
    }
  };

  const handleMarkAsRead = async (noticeId: string) => {
    try {
      await api.patch(`/social/notifications/${noticeId}/read`);
      await fetchNavbarNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const unreadNotifs = notifications.filter(n => !n.read);
  const totalUnread = unreadNotifs.length + friendRequests.length;

  return (
    <div className="relative">
      <nav className="bg-white border-b border-gray-200 shadow-sm transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link href="/" className="text-xl font-bold text-blue-600">
                <img src="/logo.png" alt="InternArea Logo" className="h-16 cursor-pointer" />
              </Link>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-8">
              <button className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 font-semibold text-sm transition">
                <Link href="/internship">
                  <span>{t("navbar.internships")}</span>
                </Link>
              </button>
              <button className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 font-semibold text-sm transition">
                <Link href="/job">
                  <span>{t("navbar.jobs")}</span>
                </Link>
              </button>
              <button className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 font-semibold text-sm transition">
                <Link href="/community">
                  <span>{t("navbar.community")}</span>
                </Link>
              </button>
              <button className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 font-semibold text-sm transition">
                <Link href="/community/friends">
                  <span>{t("navbar.friends")}</span>
                </Link>
              </button>
              <button className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 font-semibold text-sm transition">
                <Link href="/subscription">
                  <span>{t("navbar.subscriptions")}</span>
                </Link>
              </button>
              <div className="flex items-center bg-gray-100 rounded-full px-4 py-2 transition-colors">
                <Search size={16} className="text-gray-400" />
                <input
                  type="text"
                  placeholder={t("navbar.search_placeholder")}
                  className="ml-2 bg-transparent focus:outline-none text-sm w-48 text-gray-800 dark:text-gray-200 placeholder-gray-400"
                />
              </div>
            </div>

            {/* Actions / Auth */}
            <div className="flex items-center space-x-4">
              {/* Language Selector */}
              <div className="relative" ref={langRef}>
                <button
                  type="button"
                  onClick={() => setShowLangMenu((prev) => !prev)}
                  className="p-2 text-gray-500 hover:text-blue-600 rounded-full hover:bg-gray-100 transition focus:outline-none flex items-center space-x-1 cursor-pointer"
                  title="Change Language"
                >
                  <Globe size={20} />
                  <span className="text-xs font-bold uppercase">{language}</span>
                </button>
                {showLangMenu && (
                  <div className="absolute right-0 mt-3 w-40 rounded-xl border border-gray-200 bg-white shadow-2xl z-50 pointer-events-auto overflow-hidden">
                    <div className="py-1">
                      {[
                        { code: "en", label: "English" },
                        { code: "es", label: "Español" },
                        { code: "hi", label: "हिन्दी" },
                        { code: "pt", label: "Português" },
                        { code: "zh", label: "中文" },
                        { code: "fr", label: "Français" }
                      ].map((lang) => (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => {
                            changeLanguage(lang.code as any);
                            setShowLangMenu(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center justify-between cursor-pointer ${
                            language === lang.code ? "text-blue-600 font-bold bg-blue-50/50" : "text-gray-700"
                          }`}
                        >
                          <span>{lang.label}</span>
                          {language === lang.code && <Check size={14} className="text-blue-600" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Theme Toggle Button */}
              <button
                type="button"
                onClick={toggleTheme}
                className="p-2 text-gray-500 hover:text-blue-600 rounded-full hover:bg-gray-100 transition focus:outline-none cursor-pointer"
                title="Toggle Theme"
              >
                {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
              </button>

              {/* Notification icon */}
              {initialized && user && (
                <div className="relative" ref={notifRef}>
                  <button
                    type="button"
                    onClick={() => setShowNotifications((prev) => !prev)}
                    className="p-2 text-gray-500 hover:text-blue-600 rounded-full hover:bg-gray-100 transition focus:outline-none relative cursor-pointer"
                    title="Notifications"
                  >
                    <Bell size={20} />
                    {totalUnread > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white animate-pulse">
                        {totalUnread}
                      </span>
                    )}
                  </button>

                  {/* Notifications Dropdown */}
                  {showNotifications && (
                    <div className="absolute right-0 mt-3 w-80 rounded-2xl border border-gray-200 bg-white shadow-2xl z-50 pointer-events-auto overflow-hidden">
                      <div className="px-4 py-3.5 border-b border-gray-100 bg-slate-50 flex justify-between items-center">
                        <span className="font-bold text-gray-900 text-sm">Notifications</span>
                        {totalUnread > 0 && (
                          <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                            {totalUnread} New
                          </span>
                        )}
                      </div>

                      <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                        {/* Friend Requests alerts */}
                        {friendRequests.map((req) => (
                          <div key={`req-${req.uid}`} className="p-4 hover:bg-gray-50 flex items-start gap-3 transition">
                            <img
                              src={req.photo || "/logo.png"}
                              alt={req.name}
                              className="w-10 h-10 rounded-full object-cover border border-gray-100"
                            />
                            <div className="flex-1 text-left min-w-0">
                              <p className="text-xs text-gray-800 font-semibold truncate">{req.name || req.email}</p>
                              <p className="text-[11px] text-gray-500 mt-0.5">Sent you a friend request.</p>
                              <div className="mt-2.5 flex gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => handleAcceptRequest(e, req.uid)}
                                  disabled={notifLoading}
                                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[10px] transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <Check size={11} /> Accept
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleRejectRequest(e, req.uid)}
                                  disabled={notifLoading}
                                  className="px-3 py-1 bg-gray-100 hover:bg-gray-250 text-gray-700 font-bold rounded-lg text-[10px] transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <X size={11} /> Reject
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Social notifications */}
                        {unreadNotifs.map((notice) => (
                          <div
                            key={`notice-${notice._id}`}
                            onClick={() => {
                              handleMarkAsRead(notice._id);
                              router.push("/community");
                            }}
                            className="p-4 hover:bg-gray-50 flex items-start gap-3 transition cursor-pointer"
                          >
                            <img
                              src={notice.actor?.photo || "/logo.png"}
                              alt={notice.actor?.name}
                              className="w-10 h-10 rounded-full object-cover border border-gray-100"
                            />
                            <div className="flex-1 text-left min-w-0">
                              <p className="text-[11px] text-gray-800 leading-relaxed font-medium">
                                <span className="font-semibold">{notice.actor?.name}</span> {notice.message.replace(notice.actor?.name, "").trim()}
                              </p>
                              <p className="text-[9px] text-gray-400 mt-1">
                                {new Date(notice.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <span className="h-2 w-2 bg-blue-600 rounded-full flex-shrink-0 mt-1.5" />
                          </div>
                        ))}

                        {friendRequests.length === 0 && unreadNotifs.length === 0 && (
                          <div className="py-8 text-center text-gray-500 text-xs">
                            No new notifications
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* User Dropdown */}
              {initialized && user ? (
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setShowProfileMenu((prev) => !prev)}
                    className="flex items-center rounded-full overflow-hidden focus:outline-none cursor-pointer border border-gray-150"
                  >
                    {user.photo ? (
                      <img
                        src={user.photo}
                        alt={user.name || "Profile"}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                        <span className="text-sm font-semibold">U</span>
                      </div>
                    )}
                  </button>
                  {showProfileMenu && (
                    <div className="absolute right-0 mt-3 w-48 rounded-xl border border-gray-200 bg-white shadow-2xl z-50 pointer-events-auto">
                      <Link
                        href="/profile"
                        onClick={() => setShowProfileMenu(false)}
                        className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left"
                      >
                        {t("navbar.profile")}
                      </Link>
                      <Link
                        href="/userapplication"
                        onClick={() => setShowProfileMenu(false)}
                        className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left"
                      >
                        {t("navbar.my_applications")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          handlelogout();
                          setShowProfileMenu(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-gray-50 rounded-b-xl cursor-pointer"
                      >
                        {t("navbar.logout")}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition"
                  >
                    {t("navbar.login")}
                  </Link>
                  <Link
                    href="/auth/register"
                    className="bg-white border border-blue-600 text-blue-600 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-blue-50 transition"
                  >
                    {t("navbar.signup")}
                  </Link>
                  <Link
                    href="/adminlogin"
                    className="text-gray-600 hover:text-gray-800 font-semibold text-sm transition"
                  >
                    {t("navbar.admin")}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Navbar;
