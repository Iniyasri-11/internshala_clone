from pathlib import Path

job_path = Path(__file__).resolve().parent.parent / 'src' / 'pages' / 'detailjob' / '[id]' / 'index.tsx'
intern_path = Path(__file__).resolve().parent.parent / 'src' / 'pages' / 'detailiternship' / '[id]' / 'index.tsx'

job_source = '''import Link from "next/link";
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
} from "lucide-react";
import { api } from "@/utils/api";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import { selectuser } from "@/Feature/Userslice";

const index = () => {
  const user = useSelector(selectuser);
  const router = useRouter();
  const { id } = router.query;
  const [jobData, setJobData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availability, setAvailability] = useState("");
  const [coverLetter, setCoverLetter] = useState("");

  useEffect(() => {
    const fetchJob = async () => {
      if (!id) return;
      setIsLoading(true);
      setFetchError(null);
      try {
        const res = await api.get(`/job/${id}`);
        setJobData(res.data || null);
      } catch (error) {
        console.error(error);
        setFetchError("Unable to load job details.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchJob();
  }, [id]);

  const createdAt = jobData?.createAt || jobData?.createdAt || new Date().toISOString();

  const handleSubmitApplication = async () => {
    if (!coverLetter.trim()) {
      toast.error("Please write a cover letter.");
      return;
    }
    if (!availability) {
      toast.error("Please select your availability.");
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
      toast.success("Application submitted successfully.");
      router.push("/job");
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit application.");
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
          <p className="text-lg font-semibold text-gray-900">{fetchError || "Job not found."}</p>
          <Link href="/job" className="mt-4 inline-flex px-5 py-3 bg-blue-600 text-white rounded-full">
            Back to jobs
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
              <span className="font-semibold">Actively Recruiting</span>
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
                  <h2 className="text-2xl font-semibold text-gray-900">About the company</h2>
                  <p className="text-sm text-gray-500">Learn what makes this company unique.</p>
                </div>
                <span className="text-sm text-gray-500">{jobData?.category || "General"}</span>
              </div>
              <p className="text-gray-600 leading-7">{jobData?.aboutCompany || "No company description available."}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">About the role</h2>
              <p className="text-gray-600 leading-7">{jobData?.aboutJob || "No role description available."}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Who can apply</h2>
              <p className="text-gray-600 leading-7">{jobData?.whoCanApply || jobData?.Whocanapply || "Any eligible candidate may apply."}</p>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="bg-gray-50 rounded-3xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Job details</h3>
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
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Perks</h3>
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
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Application details</h2>
            <div className="space-y-4 text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <span>Company</span>
                <strong>{jobData?.company}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>CTC</span>
                <strong>{jobData?.CTC || "N/A"}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Experience</span>
                <strong>{jobData?.Experience || "N/A"}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Posted on</span>
                <strong>{new Date(createdAt).toLocaleDateString()}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Category</span>
                <strong>{jobData?.category || "N/A"}</strong>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Apply for this job</h2>
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full bg-blue-600 text-white py-3 rounded-2xl hover:bg-blue-700 transition"
            >
              Apply Now
            </button>
            <p className="mt-3 text-sm text-gray-500">Please login before applying. Your resume will be submitted along with your application.</p>
          </div>
        </aside>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-6">
              <div>
                <h3 className="text-2xl font-semibold text-gray-900">Apply to {jobData?.company}</h3>
                <p className="text-sm text-gray-500">Complete your application and submit your cover letter.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cover Letter</label>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  rows={6}
                  className="w-full rounded-3xl border border-gray-200 p-4 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Tell the recruiter why you'd be a great fit for this role."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
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
                  Cancel
                </button>
                {user ? (
                  <button
                    type="button"
                    onClick={handleSubmitApplication}
                    className="rounded-3xl bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
                  >
                    Submit application
                  </button>
                ) : (
                  <Link href="/auth/login" className="rounded-3xl bg-blue-600 px-6 py-3 text-white hover:bg-blue-700">
                    Sign in to apply
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default index;
'''

intern_source = '''import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { ArrowUpRight, Calendar, Check, Clock, DollarSign, MapPin, X } from "lucide-react";
import { api } from "@/utils/api";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import { selectuser } from "@/Feature/Userslice";

const index = () => {
  const user = useSelector(selectuser);
  const router = useRouter();
  const { id } = router.query;
  const [internshipData, setInternshipData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availability, setAvailability] = useState("");
  const [coverLetter, setCoverLetter] = useState("");

  useEffect(() => {
    const fetchInternship = async () => {
      if (!id) return;
      setIsLoading(true);
      setFetchError(null);
      try {
        const res = await api.get(`/internship/${id}`);
        setInternshipData(res.data || null);
      } catch (error) {
        console.error(error);
        setFetchError("Unable to load internship details.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchInternship();
  }, [id]);

  const createdAt = internshipData?.createAt || internshipData?.createdAt || new Date().toISOString();

  const handleSubmitApplication = async () => {
    if (!coverLetter.trim()) {
      toast.error("Please write a cover letter.");
      return;
    }
    if (!availability) {
      toast.error("Please select your availability.");
      return;
    }

    try {
      const applicationData = {
        category: internshipData?.category,
        company: internshipData?.company,
        coverLetter,
        user,
        Application: id,
        availability,
      };
      await api.post("/application", applicationData);
      toast.success("Application submitted successfully.");
      router.push("/internship");
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit application.");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (fetchError || !internshipData) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white p-8 rounded-3xl shadow-lg text-center">
          <p className="text-lg font-semibold text-gray-900">{fetchError || "Internship not found."}</p>
          <Link href="/internship" className="mt-4 inline-flex px-5 py-3 bg-blue-600 text-white rounded-full">
            Back to internships
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 xl:grid-cols-[3fr_1.2fr] gap-8">
        <main className="bg-white rounded-3xl shadow-lg overflow-hidden">
          <div className="p-8 border-b border-gray-100">
            <div className="flex items-center gap-3 text-blue-600 mb-4">
              <ArrowUpRight className="h-5 w-5" />
              <span className="font-semibold">Actively Hiring</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{internshipData?.title}</h1>
            <p className="text-lg text-gray-600 mb-4">{internshipData?.company}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                <span>{internshipData?.location || "Location not specified"}</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                <span>{internshipData?.stipend || internshipData?.Stipend || "Stipend not specified"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                <span>{internshipData?.startDate || internshipData?.StartDate || "Start date not specified"}</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-green-500">
              <Clock className="h-4 w-4" />
              <span>Posted on {new Date(createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="p-8 space-y-10">
            <section>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">About the company</h2>
                  <p className="text-sm text-gray-500">Get to know the company behind this internship.</p>
                </div>
                <span className="text-sm text-gray-500">{internshipData?.category || "General"}</span>
              </div>
              <p className="text-gray-600 leading-7">{internshipData?.aboutCompany || "No company description available."}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">About the internship</h2>
              <p className="text-gray-600 leading-7">{internshipData?.aboutInternship || internshipData?.aboutJob || "No internship description available."}</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Who can apply</h2>
              <p className="text-gray-600 leading-7">{internshipData?.whoCanApply || internshipData?.Whocanapply || "Students and fresh graduates are welcome to apply."}</p>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="bg-gray-50 rounded-3xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Internship details</h3>
                <div className="space-y-3 text-sm text-gray-700">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">Duration:</span>
                    <span>{internshipData?.Duration || internshipData?.duration || "Not specified"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">Openings:</span>
                    <span>{internshipData?.numberOfOpening || internshipData?.numberOfopning || "Not specified"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">Stipend:</span>
                    <span>{internshipData?.stipend || internshipData?.Stipend || "Not specified"}</span>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-3xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Perks</h3>
                {Array.isArray(internshipData?.perks) && internshipData?.perks.length ? (
                  <ul className="space-y-2 text-gray-600">
                    {internshipData?.perks.map((perk: string, index: number) => (
                      <li key={index} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-600">{internshipData?.perks || "No perks specified."}</p>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Additional information</h2>
              <p className="text-gray-600 leading-7">{internshipData?.additionalInfo || internshipData?.AdditionalInfo || "No additional information available."}</p>
            </section>
          </div>
        </main>

        <aside className="space-y-6">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Internship snapshot</h2>
            <div className="space-y-4 text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <span>Company</span>
                <strong>{internshipData?.company}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Stipend</span>
                <strong>{internshipData?.stipend || internshipData?.Stipend || "N/A"}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Duration</span>
                <strong>{internshipData?.Duration || internshipData?.duration || "N/A"}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Posted on</span>
                <strong>{new Date(createdAt).toLocaleDateString()}</strong>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Apply for this internship</h2>
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full bg-blue-600 text-white py-3 rounded-2xl hover:bg-blue-700 transition"
            >
              Apply Now
            </button>
            <p className="mt-3 text-sm text-gray-500">Please login to apply. Your resume and cover letter will be shared with the recruiter.</p>
          </div>
        </aside>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-6">
              <div>
                <h3 className="text-2xl font-semibold text-gray-900">Apply to {internshipData?.company}</h3>
                <p className="text-sm text-gray-500">Submit your application for this internship.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cover Letter</label>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  rows={6}
                  className="w-full rounded-3xl border border-gray-200 p-4 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Tell the recruiter why you'd be a great fit for this internship."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                <div className="space-y-3">
                  {["Yes, I am available to join immediately", "No, I am currently on notice period", "No, I will have to serve notice period", "Other"].map((option) => (
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
                  Cancel
                </button>
                {user ? (
                  <button
                    type="button"
                    onClick={handleSubmitApplication}
                    className="rounded-3xl bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
                  >
                    Submit application
                  </button>
                ) : (
                  <Link href="/auth/login" className="rounded-3xl bg-blue-600 px-6 py-3 text-white hover:bg-blue-700">
                    Sign in to apply
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default index;
'''

job_path.write_text(job_source, encoding='utf-8')
intern_path.write_text(intern_source, encoding='utf-8')
print('Wrote', job_path)
print('Wrote', intern_path)
