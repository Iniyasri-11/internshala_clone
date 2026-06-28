import { selectuser, login } from "@/Feature/Userslice";
import { ExternalLink, Mail, User, Sparkles, FileText, Award, Briefcase, Plus, Laptop, Monitor, Smartphone, History, Camera } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { api } from "@/utils/api";
import { auth } from "@/firebase/firebase";
import { signOut } from "firebase/auth";
interface ProfileUser {
  name: string;
  email: string;
  photo: string;
}
const index = () => {
  const [applications, setApplications] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const user = useSelector(selectuser);
  const dispatch = useDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("photo", file);

    try {
      const res = await api.post("/users/update-photo", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.data.success && res.data.user) {
        const updatedUser = res.data.user;
        try {
          localStorage.setItem("user", JSON.stringify(updatedUser));
        } catch (e) {
          console.error("LocalStorage write error:", e);
        }
        dispatch(login(updatedUser));
      } else {
        throw new Error(res.data.error || "Failed to update profile picture.");
      }
    } catch (err: any) {
      console.error("Upload failed:", err);
      setUploadError(err?.response?.data?.error || err?.message || "Failed to upload photo.");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchDashboardData = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const [appRes, subscriptionRes, historyRes] = await Promise.all([
          api.get("/application"),
          api.get("/subscription/summary"),
          api.get("/users/login-history"),
        ]);
        const applicationData = Array.isArray(appRes.data) ? appRes.data : [];
        const userApps = applicationData.filter(
          (app: any) => app.user?.email === user.email
        );
        setApplications(userApps);
        setSubscription(subscriptionRes.data);
        setLoginHistory(historyRes.data.history || []);
      } catch (error) {
        console.error("Failed to load dashboard data", error);
        setFetchError("Unable to load your dashboard data right now.");
        setApplications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const recentApplications = applications.slice(0, 5);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please log in</h1>
          <p className="text-gray-600">
            You need to sign in to view your profile and application details.
          </p>
          <Link href="/" className="mt-6 inline-flex items-center px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Go back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-lg overflow-visible">
          {/* Profile Header */}
          <div className="relative h-32 bg-gradient-to-r from-blue-500 to-blue-600 overflow-visible">
            <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
              <div className="relative group">
                <button
                  type="button"
                  onClick={handlePhotoClick}
                  className="relative focus:outline-none w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden block"
                  disabled={uploading}
                >
                  {user?.photo ? (
                    <img
                      src={user.photo}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <User className="h-12 w-12 text-gray-400" />
                    </div>
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-white">
                    <Camera className="h-5 w-5 mb-1" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Change</span>
                  </div>

                  {/* Uploading Spinner */}
                  {uploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-t-transparent border-white" />
                    </div>
                  )}
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Profile Content */}
          <div className="pt-16 pb-8 px-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900">{user?.name}</h1>
              {uploadError && (
                <p className="text-xs text-red-600 bg-red-50 py-1 px-3 rounded-full inline-block border border-red-200 mt-2">
                  {uploadError}
                </p>
              )}
              <div className="mt-2 flex items-center justify-center text-gray-500">
                <Mail className="h-4 w-4 mr-2" />
                <span>{user?.email}</span>
              </div>
            </div>

            {/* Profile Details */}
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <span className="text-blue-600 font-semibold text-2xl">
                    {applications.length}
                  </span>
                  <p className="text-blue-600 text-sm mt-1">My Applications</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <span className="text-green-600 font-semibold text-2xl">
                    {applications.filter((app) => app.status === "accepted").length}
                  </span>
                  <p className="text-green-600 text-sm mt-1">
                    Accepted Applications
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-indigo-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-indigo-700">Current plan</p>
                  <p className="mt-2 text-lg font-semibold text-gray-900">{subscription?.planName || 'Free'}</p>
                </div>
                <div className="bg-indigo-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-indigo-700">Remaining apps</p>
                  <p className="mt-2 text-lg font-semibold text-gray-900">{subscription?.applicationsRemaining === Infinity ? 'Unlimited' : subscription?.applicationsRemaining ?? 0}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-yellow-50 rounded-lg p-4 text-center">
                  <span className="text-yellow-700 font-semibold text-2xl">
                    {applications.filter((app) => app.status === "pending").length}
                  </span>
                  <p className="text-yellow-700 text-sm mt-1">Pending</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <span className="text-red-600 font-semibold text-2xl">
                    {applications.filter((app) => app.status === "rejected").length}
                  </span>
                  <p className="text-red-600 text-sm mt-1">Rejected</p>
                </div>
              </div>
              {/* Premium Resume Section */}
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-gray-900">
                      My Premium Resume
                    </h2>
                  </div>
                  {subscription?.user?.resume ? (
                    <span className="bg-green-50 text-green-700 text-xs px-2.5 py-1 rounded-full font-bold border border-green-200">
                      Attached
                    </span>
                  ) : (
                    <span className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full font-bold border border-blue-200">
                      Not Created
                    </span>
                  )}
                </div>

                {subscription?.user?.resume ? (
                  <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-4 border-b pb-4">
                      {subscription.user.resume.photo ? (
                        <img
                          src={subscription.user.resume.photo}
                          alt={subscription.user.resume.name}
                          className="w-16 h-16 rounded-full object-cover border"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center border text-slate-400">
                          <User className="h-8 w-8" />
                        </div>
                      )}
                      <div className="text-left">
                        <h3 className="font-bold text-gray-800 text-base">{subscription.user.resume.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{subscription.user.resume.email} | {subscription.user.resume.phone}</p>
                        {subscription.user.resume.address && (
                          <p className="text-[11px] text-gray-400 mt-0.5">{subscription.user.resume.address}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 text-left">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <Award className="h-3.5 w-3.5" />
                          Education
                        </h4>
                        <p className="text-sm font-semibold text-gray-800 mt-1">{subscription.user.resume.degree}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {subscription.user.resume.college} 
                          {subscription.user.resume.graduationYear && ` (${subscription.user.resume.graduationYear})`}
                          {subscription.user.resume.grade && ` - Grade: ${subscription.user.resume.grade}`}
                        </p>
                      </div>

                      {subscription.user.resume.experienceTitle && (
                        <div className="border-t pt-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <Briefcase className="h-3.5 w-3.5" />
                            Experience / Projects
                          </h4>
                          <p className="text-sm font-semibold text-gray-800 mt-1">{subscription.user.resume.experienceTitle}</p>
                          <p className="text-xs text-gray-600 mt-0.5">
                            {subscription.user.resume.company} 
                            {subscription.user.resume.duration && ` (${subscription.user.resume.duration})`}
                          </p>
                          {subscription.user.resume.experienceDesc && (
                            <p className="text-xs text-gray-500 mt-1.5 italic bg-slate-50 p-2 rounded-lg leading-relaxed">
                              {subscription.user.resume.experienceDesc}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="border-t pt-3 flex justify-end">
                      <Link
                        href="/profile/create-resume"
                        className="text-xs text-blue-600 font-semibold hover:text-blue-700 flex items-center gap-1"
                      >
                        Edit Resume
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-dashed border-slate-200 p-6 text-center">
                    <p className="text-sm text-gray-600 mb-4">
                      Build and attach a premium professional resume to automate and streamline your future applications.
                    </p>
                    <Link
                      href="/profile/create-resume"
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition shadow-md"
                    >
                      <Plus className="h-4 w-4" />
                      Create Resume (₹50)
                    </Link>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Applied Jobs & Internships
                  </h2>
                  <span className="text-sm text-gray-500">{applications.length} total</span>
                </div>
                {loading ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
                    Loading applications...
                  </div>
                ) : fetchError ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-red-600">
                    {fetchError}
                  </div>
                ) : recentApplications.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
                    No job or internship applications yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentApplications.map((application) => (
                      <div
                        key={application._id}
                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">
                              {application.category || "Unknown category"}
                            </p>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {application.company || "Unknown company"}
                            </h3>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              application.status === "accepted"
                                ? "bg-green-100 text-green-800"
                                : application.status === "rejected"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {application.status || "pending"}
                          </span>
                        </div>
                        <div className="mt-3 text-sm text-gray-500">
                          Applied on {application.createdAt ? new Date(application.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }) : "Unknown date"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Login History Section */}
              <div className="bg-gray-50 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <History className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Recent Login Activity
                  </h2>
                </div>
                {loginHistory.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
                    No login history records found.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {loginHistory.map((log: any) => {
                      const dateStr = log.createdAt 
                        ? new Date(log.createdAt).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            dateStyle: "medium",
                            timeStyle: "short",
                          }) + " IST"
                        : "Unknown Date";

                      // Helper to render device icons
                      const renderDeviceIcon = (type: string) => {
                        switch (type) {
                          case 'mobile':
                            return <Smartphone className="h-5 w-5 text-gray-500" />;
                          case 'laptop':
                            return <Laptop className="h-5 w-5 text-gray-500" />;
                          default:
                            return <Monitor className="h-5 w-5 text-gray-500" />;
                        }
                      };

                      return (
                        <div
                          key={log._id}
                          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex items-start gap-4"
                        >
                          <div className="bg-gray-100 p-2.5 rounded-xl flex items-center justify-center mt-0.5 animate-pulse-once">
                            {renderDeviceIcon(log.deviceType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                              <div>
                                <h3 className="text-sm font-semibold text-gray-900 capitalize">
                                  {log.browser} • {log.os}
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  IP: {log.ipAddress} | Device: <span className="capitalize">{log.deviceType}</span>
                                </p>
                              </div>
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                  log.status === "Success"
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : log.status === "OTP_Pending"
                                    ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                    : "bg-red-50 text-red-700 border-red-200"
                                }`}
                              >
                                {log.status === "OTP_Pending" ? "OTP Pending" : log.status}
                              </span>
                            </div>
                            {log.status === "Failed" && log.failureReason && (
                              <p className="mt-2 text-xs text-red-600 bg-red-50/50 p-2 rounded-lg border border-red-100">
                                <strong>Reason:</strong> {log.failureReason}
                              </p>
                            )}
                            {log.status === "OTP_Pending" && log.failureReason && (
                              <p className="mt-2 text-xs text-yellow-600 bg-yellow-50/50 p-2 rounded-lg border border-yellow-100">
                                {log.failureReason}
                              </p>
                            )}
                            <div className="mt-2 text-[11px] text-gray-400">
                              {dateStr}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-center pt-4">
                <Link
                  href="/userapplication"
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  View Applications
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default index;
