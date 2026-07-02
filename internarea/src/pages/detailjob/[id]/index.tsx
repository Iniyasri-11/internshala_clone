import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Calendar,
  Check,
  Clock,
  DollarSign,
  MapPin,
  X,
  Briefcase,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api } from "@/utils/api";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import { selectuser } from "@/Feature/Userslice";
import { useLanguage } from "@/context/LanguageContext";

const index = () => {
  const user = useSelector(selectuser);
  const router = useRouter();
  const { t } = useLanguage();
  const { id } = router.query;
  const [jobData, setJobData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availability, setAvailability] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [limitInfo, setLimitInfo] = useState<any>(null);
  const [hasApplied, setHasApplied] = useState(false);

  useEffect(() => {
    const fetchJob = async () => {
      if (!id) return;
      setIsLoading(true);
      setFetchError(null);
      try {
        const res = await api.get(`/job/${id}`);
        setJobData(res.data || null);

        if (user) {
          try {
            const appsRes = await api.get("/application/user");
            const appliedList = appsRes.data || [];
            const matches = appliedList.some((app: any) => app.internshipId === id || app.Application === id);
            setHasApplied(matches);
          } catch (appErr) {
            console.error("Error fetching user applications", appErr);
          }
        }
      } catch (error) {
        console.error(error);
        setFetchError(t("details.not_found"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchJob();
  }, [id, user]);

  const createdAt = jobData?.createAt || jobData?.createdAt || new Date().toISOString();

  const handleSubmitApplication = async () => {
    if (!coverLetter.trim()) {
      toast.error(t("details.write_cover_letter"));
      return;
    }
    if (!availability) {
      toast.error(t("details.select_availability"));
      return;
    }

    try {
      const applicationData = {
        category: jobData?.category,
        company: jobData?.company,
        coverLetter,
        user,
        Application: id,
        availability,
      };
      await api.post("/application", applicationData);
      toast.success(t("details.success_apply"));
      setHasApplied(true);
      router.push("/job");
    } catch (error: any) {
      console.error(error);
      if (error?.response?.status === 403 && error?.response?.data?.error?.includes("limit exceeded")) {
        setLimitInfo({
          currentPlan: error.response.data.currentPlan || "Free",
          applicationsRemaining: error.response.data.applicationsRemaining ?? 0,
        });
        setIsModalOpen(false);
        setShowUpgradeModal(true);
      } else {
        toast.error(error?.response?.data?.error || "Failed to submit application.");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (fetchError || !jobData) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white p-8 rounded-3xl shadow-lg text-center">
          <p className="text-lg font-semibold text-gray-900">{fetchError || t("details.not_found")}</p>
          <Link href="/job" className="mt-4 inline-flex px-5 py-3 bg-blue-600 text-white rounded-full">
            {t("details.back_to_jobs")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-8">
        <main className="bg-white rounded-3xl shadow-lg overflow-hidden">
          <div className="p-8 border-b border-gray-100">
            <div className="flex items-center gap-3 text-blue-600 mb-4">
              <ArrowUpRight className="h-5 w-5" />
              <span className="font-semibold">{t("details.actively_hiring")}</span>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">{jobData?.title}</h1>
            <p className="text-xl text-gray-600 mb-4">{jobData?.company}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                <span>{jobData?.location || "Location not specified"}</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                <span>{jobData?.CTC ? `CTC ${jobData.CTC}` : "CTC not specified"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                <span>{jobData?.StartDate || new Date(createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-10">
            <section>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">{t("details.about_company")}</h2>
                  <p className="text-sm text-gray-500">{t("details.about_company_sub")}</p>
                </div>
                <span className="text-sm text-gray-500">{jobData?.category || "General"}</span>
              </div>
              <p className="text-gray-600 leading-7">{jobData?.aboutCompany || "No company description available."}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t("details.about_job")}</h2>
              <p className="text-gray-600 leading-7">{jobData?.aboutJob || "No role description available."}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t("details.who_can_apply")}</h2>
              <p className="text-gray-600 leading-7">{jobData?.whoCanApply || jobData?.Whocanapply || "Any eligible candidate may apply."}</p>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="bg-gray-50 rounded-3xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("details.job_details")}</h3>
                <div className="space-y-3 text-sm text-gray-700">
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-4 w-4 text-blue-600" />
                    <span>{jobData?.category || "Category not specified"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-green-600" />
                    <span>{jobData?.Experience || "Experience not specified"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-4 w-4 text-indigo-600" />
                    <span>{jobData?.partTime ? "Part-time" : "Full-time"}</span>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-3xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("details.perks")}</h3>
                {Array.isArray(jobData?.perks) && jobData?.perks.length ? (
                  <ul className="space-y-2 text-gray-600">
                    {jobData?.perks.map((perk: string, index: number) => (
                      <li key={index} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-600">{typeof jobData?.perks === "string" ? jobData.perks : "No perks specified."}</p>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Additional information</h2>
              <p className="text-gray-600 leading-7">{jobData?.AdditionalInfo || jobData?.additionalInfo || "No additional information available."}</p>
            </section>
          </div>
        </main>

        <aside className="space-y-6">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Snapshot</h2>
            <div className="space-y-4 text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <span>Company</span>
                <strong>{jobData?.company}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>{t("home.fields.ctc")}</span>
                <strong>{jobData?.CTC || "N/A"}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>{t("home.fields.experience")}</span>
                <strong>{jobData?.Experience || "N/A"}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>{t("details.posted_on")}</span>
                <strong>{new Date(createdAt).toLocaleDateString()}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>{t("opportunities.category")}</span>
                <strong>{jobData?.category || "N/A"}</strong>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{t("details.apply_modal_title")}</h2>
            {hasApplied ? (
              <button
                disabled
                className="w-full bg-gray-400 text-white py-3 rounded-2xl cursor-not-allowed transition"
              >
                {t("details.already_applied")}
              </button>
            ) : (
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full bg-blue-600 text-white py-3 rounded-2xl hover:bg-blue-700 transition cursor-pointer"
              >
                {t("details.apply_now")}
              </button>
            )}
            <p className="mt-3 text-sm text-gray-500">Please login before applying. Your resume will be submitted along with your application.</p>
          </div>
        </aside>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-6">
              <div>
                <h3 className="text-2xl font-semibold text-gray-900">{t("details.apply_modal_title")}</h3>
                <p className="text-sm text-gray-500">Complete your application to {jobData?.company}.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t("details.cover_letter_label")}</label>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  rows={6}
                  className="w-full rounded-3xl border border-gray-200 p-4 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Tell the recruiter why you'd be a great fit for this role."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t("details.availability_label")}</label>
                <div className="space-y-3">
                  {["Available immediately", "Available after notice period", "Available in 1 month", "Other"].map((option) => (
                    <label key={option} className="flex items-center gap-3 text-gray-700">
                      <input
                        type="radio"
                        name="availability"
                        value={option}
                        checked={availability === option}
                        onChange={(e) => setAvailability(e.target.value)}
                        className="h-4 w-4 text-blue-600"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-3xl border border-gray-200 px-6 py-3 text-gray-700 hover:bg-gray-50"
                >
                  {t("subscription.cancel")}
                </button>
                {user ? (
                  <button
                    type="button"
                    onClick={handleSubmitApplication}
                    className="rounded-3xl bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
                  >
                    {t("details.submit_application")}
                  </button>
                ) : (
                  <Link href="/auth/login" className="rounded-3xl bg-blue-600 px-6 py-3 text-white hover:bg-blue-700">
                    {t("navbar.login")}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showUpgradeModal && limitInfo && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 text-center">
            <div className="flex justify-end">
              <button onClick={() => setShowUpgradeModal(false)} className="text-gray-400 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="mt-2 flex flex-col items-center">
              <div className="p-3 bg-red-50 text-red-500 rounded-full mb-4">
                <Sparkles className="h-10 w-10 text-red-500 animate-pulse" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Limit Exceeded</h3>
              <p className="mt-3 text-gray-600">
                You have reached the monthly application limit for your current plan.
              </p>
              <div className="mt-5 w-full bg-slate-50 rounded-2xl p-4 space-y-2 text-sm text-gray-700 text-left border border-slate-100">
                <div className="flex justify-between">
                  <span>Current Plan</span>
                  <span className="font-semibold text-slate-900">{limitInfo.currentPlan}</span>
                </div>
                <div className="flex justify-between">
                  <span>Applications Remaining</span>
                  <span className="font-semibold text-red-600">{limitInfo.applicationsRemaining}</span>
                </div>
              </div>
              <div className="mt-6 w-full flex flex-col gap-3">
                <Link
                  href="/subscription"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-2xl transition shadow-lg inline-block text-center"
                >
                  Upgrade Plan
                </Link>
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-2xl transition"
                >
                  {t("auth.close")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default index;