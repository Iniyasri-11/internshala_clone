import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import { selectuser } from '@/Feature/Userslice';
import { api } from '@/utils/api';
import { toast } from 'react-toastify';
import { Shield, X, Loader2, CheckCircle2, FileText, Landmark, CreditCard, Smartphone } from 'lucide-react';
import Link from 'next/link';

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Window not available'));
    }
    if ((window as any).Razorpay) {
      return resolve(true);
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Razorpay SDK failed to load.'));
    document.body.appendChild(script);
  });
}

const CreateResume = () => {
  const user = useSelector(selectuser);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    photo: '',
    degree: '',
    college: '',
    graduationYear: '',
    grade: '',
    experienceTitle: '',
    company: '',
    duration: '',
    experienceDesc: '',
  });

  // OTP State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [simulatedOtp, setSimulatedOtp] = useState<string | null>(null);


  // Payment Mock State
  const [showMockGateway, setShowMockGateway] = useState(false);
  const [mockGatewayData, setMockGatewayData] = useState<any>(null);
  const [mockPaymentMethod, setMockPaymentMethod] = useState<'card' | 'upi' | 'netbanking'>('card');
  const [mockCardNumber, setMockCardNumber] = useState('');
  const [mockExpiry, setMockExpiry] = useState('');
  const [mockCvv, setMockCvv] = useState('');
  const [mockCardName, setMockCardName] = useState('');
  const [mockUpiId, setMockUpiId] = useState('');
  const [mockNetbank, setMockNetbank] = useState('sbi');
  const [mockGatewayLoading, setMockGatewayLoading] = useState(false);
  const [mockGatewayStep, setMockGatewayStep] = useState<'input' | 'processing' | 'success'>('input');

  useEffect(() => {
    const checkPremiumStatus = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get('/subscription/summary');
        setSubscription(res.data);
        // Pre-fill name and email
        setFormData((prev) => ({
          ...prev,
          name: prev.name || res.data?.user?.name || user.name || '',
          email: prev.email || res.data?.user?.email || user.email || '',
          photo: prev.photo || res.data?.user?.photo || user.photo || '',
        }));
      } catch (error) {
        console.error(error);
        toast.error('Unable to fetch subscription status.');
      } finally {
        setLoading(false);
      }
    };

    loadRazorpayScript().catch((err) => console.error(err));
    checkPremiumStatus();
  }, [user]);

  const isPremiumActive = subscription?.subscriptionStatus === 'active' && subscription?.planName !== 'Free';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleVerifyAndPay = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPremiumActive) {
      toast.error('Premium Plan is required to create a resume.');
      return;
    }

    if (!formData.name || !formData.email || !formData.phone || !formData.degree || !formData.college) {
      toast.error('Please fill in the required fields (Name, Email, Phone, Degree, College).');
      return;
    }

    setSubmitLoading(true);
    try {
      // Step 1: Send OTP to email
      const res = await api.post('/resume/send-otp');
      toast.success('Verification OTP has been sent to your email.');
      if (res.data?.simulated && res.data?.otp) {
        setSimulatedOtp(res.data.otp);
      } else {
        setSimulatedOtp(null);
      }
      setShowOtpModal(true);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.error || 'Unable to send OTP.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP.');
      return;
    }

    setOtpLoading(true);
    try {
      // Step 2: Verify OTP
      await api.post('/resume/verify-otp', { otp });
      toast.success('OTP verified successfully!');
      setShowOtpModal(false);

      // Step 3: Create Order for ₹50
      const res = await api.post('/resume/create-order');
      const orderData = res.data;

      // Handle Sandbox Gateway mock keys
      if (orderData.keyId === 'rzp_test_mock_key' || orderData.orderId.startsWith('order_mock_res_')) {
        setMockGatewayData({
          orderId: orderData.orderId,
          amount: orderData.amount,
          resumeData: formData,
        });
        setShowMockGateway(true);
        return;
      }

      // Live Razorpay setup
      const options = {
        key: orderData.keyId,
        amount: orderData.amount * 100,
        currency: orderData.currency,
        name: 'Internshala Resume Builder',
        description: 'Premium Resume Creation Charge',
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            await api.post('/resume/verify-payment', {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              resumeData: formData,
            });
            toast.success('Resume created and attached to profile successfully!');
            router.push('/profile');
          } catch (verifyErr: any) {
            console.error(verifyErr);
            toast.error(verifyErr?.response?.data?.error || 'Payment verification failed.');
          }
        },
        prefill: {
          name: formData.name,
          email: formData.email,
          contact: formData.phone,
        },
        theme: {
          color: '#2563eb',
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.error || 'OTP Verification or order creation failed.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleMockPay = async () => {
    if (!mockGatewayData) return;

    if (mockPaymentMethod === 'card') {
      if (!mockCardNumber || mockCardNumber.length !== 16) {
        toast.error('Please enter a valid 16-digit card number.');
        return;
      }
      if (!mockExpiry || !/^\d{2}\/\d{2}$/.test(mockExpiry)) {
        toast.error('Please enter MM/YY expiry.');
        return;
      }
      if (!mockCvv || mockCvv.length !== 3) {
        toast.error('Please enter 3-digit CVV.');
        return;
      }
      if (!mockCardName.trim()) {
        toast.error('Please enter cardholder name.');
        return;
      }
    } else if (mockPaymentMethod === 'upi') {
      if (!mockUpiId.includes('@')) {
        toast.error('Please enter a valid UPI ID.');
        return;
      }
    }

    setMockGatewayLoading(true);
    setMockGatewayStep('processing');

    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      await api.post('/resume/verify-payment', {
        razorpay_payment_id: `pay_mock_res_${Date.now()}`,
        razorpay_order_id: mockGatewayData.orderId,
        razorpay_signature: `sig_mock_res_${Date.now()}`,
        resumeData: mockGatewayData.resumeData,
      });

      setMockGatewayStep('success');
      toast.success('Resume created and attached to profile successfully!');

      await new Promise((resolve) => setTimeout(resolve, 1500));
      setShowMockGateway(false);
      setMockGatewayStep('input');
      router.push('/profile');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.error || 'Payment verification failed.');
      setMockGatewayStep('input');
    } finally {
      setMockGatewayLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4 font-sans">Access Denied</h1>
          <p className="text-gray-600">Please sign in to access the Premium Resume Builder.</p>
          <Link href="/auth/login" className="mt-6 inline-flex px-5 py-3 bg-blue-600 text-white rounded-full">
            Log In
          </Link>
        </div>
      </div>
    );
  }

  if (!isPremiumActive) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-gray-100">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
            <Shield className="h-8 w-8 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Premium Feature</h1>
          <p className="text-gray-600 mb-6">
            The Resume Builder is exclusively available to our Premium members. Upgrading to Bronze, Silver, or Gold unlocks this feature.
          </p>
          <div className="flex flex-col gap-3">
            <Link href="/subscription" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-2xl text-center shadow-lg transition">
              Upgrade Subscription
            </Link>
            <Link href="/profile" className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3.5 rounded-2xl text-center transition">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-gray-100">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-10 text-white relative">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 p-3 rounded-2xl text-white">
                <FileText className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Premium Resume Builder</h1>
                <p className="text-blue-100 mt-2 text-sm sm:text-base">
                  Design a professional, automated resume to attach directly to your application workflow.
                </p>
              </div>
            </div>
            <div className="absolute top-6 right-6 bg-white/20 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider">
              Fee: ₹50
            </div>
          </div>

          {/* Form Content */}
          <form onSubmit={handleVerifyAndPay} className="p-8 space-y-8">
            {/* Section 1: Personal Details */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 border-b pb-2 mb-4">1. Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="name@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="City, State"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Profile Photo URL</label>
                  <input
                    type="text"
                    name="photo"
                    value={formData.photo}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Education / Qualifications */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 border-b pb-2 mb-4">2. Qualifications & Education</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Degree / Specialization *</label>
                  <input
                    type="text"
                    name="degree"
                    value={formData.degree}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="B.Tech Computer Science, B.Com, etc."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">College / School *</label>
                  <input
                    type="text"
                    name="college"
                    value={formData.college}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="University/College Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Graduation Year</label>
                  <input
                    type="text"
                    name="graduationYear"
                    value={formData.graduationYear}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 2026"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Grade / CGPA</label>
                  <input
                    type="text"
                    name="grade"
                    value={formData.grade}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 8.5 CGPA or 85%"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Work Experience */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 border-b pb-2 mb-4">3. Experience & Projects</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Job/Project Title</label>
                  <input
                    type="text"
                    name="experienceTitle"
                    value={formData.experienceTitle}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Frontend Intern or Personal Project"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Company / Organization</label>
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. TechCorp Solutions"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Duration</label>
                  <input
                    type="text"
                    name="duration"
                    value={formData.duration}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 3 Months, June 2026 - Aug 2026"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                  <textarea
                    name="experienceDesc"
                    value={formData.experienceDesc}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Describe your key achievements, tech stack, and responsibilities."
                  />
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={submitLoading}
                className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:bg-gray-400"
              >
                {submitLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  'Verify & Pay ₹50'
                )}
              </button>
              <Link href="/profile" className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition text-center">
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 text-center border border-gray-100">
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowOtpModal(false);
                  setOtp('');
                }}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="mt-2 flex flex-col items-center">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Email Verification OTP</h3>
              <p className="mt-2 text-sm text-gray-500">
                For security, we sent a 6-digit verification code to <strong>{formData.email}</strong>. Please enter it to continue.
              </p>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="XXXXXX"
                required
                className="mt-6 w-40 text-center tracking-[8px] text-2xl font-bold border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {simulatedOtp && (
                <div className="mt-4 p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 flex flex-col gap-1 w-full max-w-[280px]">
                  <span className="font-bold">🧪 Test Mode OTP Code:</span>
                  <span className="font-mono text-sm tracking-wider font-semibold">{simulatedOtp}</span>
                </div>
              )}
              <div className="mt-6 w-full flex gap-3">
                <button
                  onClick={handleVerifyOtp}
                  disabled={otpLoading || otp.length !== 6}
                  className="flex-1 bg-blue-600 text-white font-semibold py-3.5 rounded-2xl hover:bg-blue-700 transition flex items-center justify-center gap-2 cursor-pointer disabled:bg-gray-400"
                >
                  {otpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & Continue'}
                </button>
                <button
                  onClick={() => {
                    setShowOtpModal(false);
                    setOtp('');
                  }}
                  className="px-5 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-2xl transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mock Sandbox Gateway Modal */}
      {showMockGateway && mockGatewayData && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 flex flex-col">
            <div className="bg-slate-900 text-white p-6 relative">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500/20 text-blue-400 p-2 rounded-xl">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Secure Resume Checkout</h3>
                  <p className="text-xs text-slate-400 font-medium">Test Sandbox — Charge: ₹50</p>
                </div>
              </div>
              {mockGatewayStep === 'input' && (
                <button
                  onClick={() => setShowMockGateway(false)}
                  className="absolute right-4 top-6 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="h-6 w-6" />
                </button>
              )}
            </div>

            <div className="bg-slate-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center text-sm">
              <div>
                <p className="text-gray-500 text-[10px] font-bold tracking-wider">MERCHANT</p>
                <p className="font-semibold text-gray-800">Internshala Resume Builder</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500 text-[10px] font-bold tracking-wider">AMOUNT</p>
                <p className="font-bold text-blue-600 text-lg">₹{mockGatewayData.amount}</p>
              </div>
            </div>

            <div className="p-6 flex-1 min-h-[300px] flex flex-col justify-center">
              {mockGatewayStep === 'input' && (
                <div className="space-y-5">
                  <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => setMockPaymentMethod('card')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        mockPaymentMethod === 'card' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setMockPaymentMethod('upi')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        mockPaymentMethod === 'upi' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      UPI
                    </button>
                    <button
                      type="button"
                      onClick={() => setMockPaymentMethod('netbanking')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        mockPaymentMethod === 'netbanking' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Landmark className="h-3.5 w-3.5" />
                      Banking
                    </button>
                  </div>

                  {mockPaymentMethod === 'card' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Card Number</label>
                        <input
                          type="text"
                          value={mockCardNumber}
                          onChange={(e) => setMockCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                          placeholder="4111 2222 3333 4444"
                          required
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Expiry Date</label>
                          <input
                            type="text"
                            value={mockExpiry}
                            onChange={(e) => setMockExpiry(e.target.value.slice(0, 5))}
                            placeholder="MM/YY"
                            required
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">CVV</label>
                          <input
                            type="password"
                            value={mockCvv}
                            onChange={(e) => setMockCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                            placeholder="123"
                            required
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-center tracking-widest"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Cardholder Name</label>
                        <input
                          type="text"
                          value={mockCardName}
                          onChange={(e) => setMockCardName(e.target.value)}
                          placeholder="John Doe"
                          required
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {mockPaymentMethod === 'upi' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">UPI ID (VPA)</label>
                        <input
                          type="text"
                          value={mockUpiId}
                          onChange={(e) => setMockUpiId(e.target.value)}
                          placeholder="username@okaxis"
                          required
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {mockPaymentMethod === 'netbanking' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Select Bank</label>
                        <select
                          value={mockNetbank}
                          onChange={(e) => setMockNetbank(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                        >
                          <option value="sbi">State Bank of India</option>
                          <option value="hdfc">HDFC Bank</option>
                          <option value="icici">ICICI Bank</option>
                          <option value="axis">Axis Bank</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleMockPay}
                    disabled={mockGatewayLoading}
                    className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-2xl hover:bg-blue-700 transition flex items-center justify-center gap-2 cursor-pointer text-sm shadow-md"
                  >
                    Pay ₹{mockGatewayData.amount}
                  </button>
                </div>
              )}

              {mockGatewayStep === 'processing' && (
                <div className="text-center py-10 space-y-4 flex flex-col items-center justify-center">
                  <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
                  <div>
                    <h4 className="font-bold text-gray-800 text-base">Processing verified transaction</h4>
                    <p className="text-xs text-gray-500 mt-1">Attaching resume to profile...</p>
                  </div>
                </div>
              )}

              {mockGatewayStep === 'success' && (
                <div className="text-center py-10 space-y-4 flex flex-col items-center justify-center">
                  <div className="bg-green-50 p-4 rounded-full text-green-500 mb-2">
                    <CheckCircle2 className="h-16 w-16 text-green-500" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-lg">Payment Successful</h4>
                    <p className="text-xs text-gray-500 mt-1 font-medium">Resume saved and verified successfully!</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400 font-semibold tracking-wider">
              <span>SECURED BY RAZORPAY MOCK</span>
              <span>PCI-DSS COMPLIANT</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateResume;
