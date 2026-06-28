import { useEffect, useMemo, useState } from 'react';
import { api } from '@/utils/api';
import { useSelector } from 'react-redux';
import { selectuser } from '@/Feature/Userslice';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';
import { CreditCard, Shield, Landmark, Smartphone, X, Loader2, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';


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

const plans = [
  { title: 'Free', price: 0, applications: 1, description: 'Submit 1 internship per month' },
  { title: 'Bronze', price: 100, applications: 3, description: 'Submit 3 internships per month' },
  { title: 'Silver', price: 300, applications: 5, description: 'Submit 5 internships per month' },
  { title: 'Gold', price: 1000, applications: Infinity, description: 'Unlimited internship applications' },
];

const subscription = () => {
  const { t, language } = useLanguage();
  const user = useSelector(selectuser);
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState<any>(null);

  const [paymentWindowOpen, setPaymentWindowOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Mock Gateway State
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

  const planDetails = useMemo(() => plans.find((plan) => plan.title === selectedPlan) || null, [selectedPlan]);
  const selectedOrCurrentPlanName = selectedPlan || currentPlan?.planName || 'Free';
  const selectedOrCurrentPlanDetails = plans.find((plan) => plan.title === selectedOrCurrentPlanName) || null;

  const subscriptionPreview = selectedPlan
    ? {
        planName: selectedPlan,
        subscriptionStatus: 'Preview',
        applicationsUsed: currentPlan?.applicationsUsed ?? 0,
        applicationsRemaining: planDetails?.applications ?? currentPlan?.applicationsRemaining ?? 0,
        subscriptionEndDate: currentPlan?.subscriptionEndDate,
      }
    : currentPlan;

  useEffect(() => {
    const fetchSummary = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get('/subscription/summary');
        setCurrentPlan(res.data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    const bypass = process.env.NEXT_PUBLIC_BYPASS_PAYMENT_WINDOW === 'true';
    if (bypass) {
      setPaymentWindowOpen(true);
    } else {
      try {
        const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false } as const;
        const formatter = new Intl.DateTimeFormat('en-US', options);
        const hour = parseInt(formatter.format(new Date()), 10);
        setPaymentWindowOpen(hour === 10);
      } catch (err) {
        const now = new Date();
        const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
        setPaymentWindowOpen(ist.getHours() === 10);
      }
    }
    loadRazorpayScript().catch((err) => console.error(err));
    fetchSummary();
  }, [user]);

  const handleSubscribe = async (targetPlanName?: any) => {
    const planName = typeof targetPlanName === 'string' ? targetPlanName : selectedPlan;
    if (!user) {
      toast.error('Please log in to purchase a plan.');
      router.push('/auth/login');
      return;
    }

    const planToBuy = plans.find((p) => p.title === planName);
    if (!planToBuy) {
      toast.error('Please select a plan before continuing.');
      return;
    }

    if (planToBuy.price === 0) {
      router.push('/internship?plan=Free');
      return;
    }

    if (!paymentWindowOpen) {
      toast.error('Payments are only allowed between 10:00 AM and 11:00 AM IST.');
      return;
    }

    setPaymentLoading(true);
    try {
      const token = window.localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await api.post('/subscription/create-order', { planName });
      const options = {
        key: res.data.keyId,
        amount: res.data.amount * 100,
        currency: 'INR',
        name: 'Internshala Clone',
        description: `${res.data.planName} plan subscription charge`,
        order_id: res.data.orderId,
        handler: async function (response: any) {
          try {
            const verifyRes = await api.post(
              '/subscription/verify-payment',
              {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                planName: planName,
              },
              { headers }
            );
            toast.success('Subscription activated successfully');
            const summaryRes = await api.get('/subscription/summary', { headers });
            setCurrentPlan(summaryRes.data);
          } catch (error: any) {
            console.error(error);
            toast.error(error?.response?.data?.error || 'Payment verification failed');
          }
        },
        prefill: {
          name: user.name,
          email: user.email,
        },
        theme: {
          color: '#2563eb',
        },
      };

      if (res.data.keyId === 'rzp_test_mock_key' || res.data.orderId.startsWith('order_mock_')) {
        setMockGatewayData({
          orderId: res.data.orderId,
          amount: res.data.amount,
          planName: planName,
        });
        setShowMockGateway(true);
        return;
      }

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.error || 'Unable to start payment flow.');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleMockPay = async () => {
    if (!mockGatewayData) return;

    // Validate inputs
    if (mockPaymentMethod === 'card') {
      if (!mockCardNumber || mockCardNumber.length !== 16) {
        toast.error('Please enter a valid 16-digit card number.');
        return;
      }
      if (!mockExpiry || !/^\d{2}\/\d{2}$/.test(mockExpiry)) {
        toast.error('Please enter a valid expiry date in MM/YY format.');
        return;
      }
      const [mm, yy] = mockExpiry.split('/').map(Number);
      if (mm < 1 || mm > 12) {
        toast.error('Expiry month must be between 01 and 12.');
        return;
      }
      if (!mockCvv || mockCvv.length !== 3) {
        toast.error('Please enter a valid 3-digit CVV.');
        return;
      }
      if (!mockCardName.trim()) {
        toast.error('Please enter the cardholder name.');
        return;
      }
    } else if (mockPaymentMethod === 'upi') {
      if (!mockUpiId || !mockUpiId.includes('@')) {
        toast.error('Please enter a valid UPI ID (e.g. username@bank).');
        return;
      }
    }

    setMockGatewayLoading(true);
    setMockGatewayStep('processing');

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const token = window.localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const verifyRes = await api.post(
        '/subscription/verify-payment',
        {
          razorpay_payment_id: `pay_mock_${Date.now()}`,
          razorpay_order_id: mockGatewayData.orderId,
          razorpay_signature: `sig_mock_${Date.now()}`,
          planName: mockGatewayData.planName,
        },
        { headers }
      );
      
      setMockGatewayStep('success');
      toast.success('Subscription activated successfully');
      
      const summaryRes = await api.get('/subscription/summary', { headers });
      setCurrentPlan(summaryRes.data);
      
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setShowMockGateway(false);
      // Reset input fields
      setMockCardNumber('');
      setMockExpiry('');
      setMockCvv('');
      setMockCardName('');
      setMockUpiId('');
      setMockGatewayStep('input');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.error || 'Payment verification failed');
      setMockGatewayStep('input');
    } finally {
      setMockGatewayLoading(false);
    }
  };

  const getPlanTitle = (title: string) => {
    switch (title) {
      case 'Free': return t("subscription.free_plan");
      case 'Bronze': return t("subscription.bronze_plan");
      case 'Silver': return t("subscription.silver_plan");
      case 'Gold': return t("subscription.gold_plan");
      default: return title;
    }
  };

  const getPlanDescription = (title: string, apps: number) => {
    if (apps === Infinity) {
      return t("subscription.unlimited_text");
    }
    return t("subscription.limit_text", { count: apps });
  };

  const actionText = paymentWindowOpen ? 'Subscribe now' : 'Payments allowed only between 10:00 AM and 11:00 AM IST';

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-3xl bg-white p-10 shadow-lg text-left">
          <h1 className="text-3xl font-semibold text-gray-900">{t("subscription.title")}</h1>
          <p className="mt-3 text-gray-600 max-w-2xl">
            {t("subscription.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 mb-10">
          {plans.map((plan) => {
            const active = (selectedPlan || currentPlan?.planName) === plan.title;
            const planStyles: Record<string, { bg: string; border: string; title: string; description: string; badgeBg: string; badgeText: string; buttonBg: string; buttonText: string }> = {
              Free: {
                bg: '#0b7189',
                border: '#38bdf8',
                title: 'text-white',
                description: 'text-cyan-100',
                badgeBg: '#bae6fd',
                badgeText: '#0f172a',
                buttonBg: '#0284c7',
                buttonText: 'text-white',
              },
              Bronze: {
                bg: '#92400e',
                border: '#f59e0b',
                title: 'text-white',
                description: 'text-amber-100',
                badgeBg: '#fde68a',
                badgeText: '#78350f',
                buttonBg: '#b45309',
                buttonText: 'text-white',
              },
              Silver: {
                bg: '#334155',
                border: '#94a3b8',
                title: 'text-white',
                description: 'text-slate-200',
                badgeBg: '#cbd5e1',
                badgeText: '#0f172a',
                buttonBg: '#475569',
                buttonText: 'text-white',
              },
              Gold: {
                bg: '#6d28d9',
                border: '#c084fc',
                title: 'text-white',
                description: 'text-fuchsia-100',
                badgeBg: '#ede9fe',
                badgeText: '#4c1d95',
                buttonBg: '#7c3aed',
                buttonText: 'text-white',
              },
            };
            const isCurrentActive = currentPlan?.planName === plan.title && currentPlan?.subscriptionStatus === 'active';
            const isFreeAndDefault = plan.title === 'Free' && (!currentPlan || currentPlan.subscriptionStatus !== 'active' || currentPlan.planName === 'Free');
            const isActivePlan = isCurrentActive || isFreeAndDefault;
            const isSelected = selectedPlan === plan.title;
            const styles = planStyles[plan.title] || planStyles.Silver;
            return (
              <div
                key={plan.title}
                className={`rounded-3xl border p-6 shadow-lg transition duration-200 ${isActivePlan ? 'ring-2 ring-white/40 shadow-2xl' : active ? 'ring-2 ring-white/20 shadow-2xl' : 'hover:-translate-y-1 hover:shadow-2xl'} text-left`}
                style={{ backgroundColor: styles.bg, borderColor: styles.border }}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className={`text-xl font-semibold ${styles.title}`}>{getPlanTitle(plan.title)}</h2>
                    <p className={`mt-2 ${styles.description}`}>{getPlanDescription(plan.title, plan.applications)}</p>
                  </div>
                  <span className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide" style={{ backgroundColor: styles.badgeBg, color: styles.badgeText, borderColor: styles.border, borderWidth: '1px', borderStyle: 'solid' }}>
                    {plan.title === 'Free' ? t("subscription.free_plan") : getPlanTitle(plan.title)}
                  </span>
                </div>
                <div className="mt-6">
                  <span className={`text-4xl font-bold ${styles.title}`}>{plan.price === 0 ? t("subscription.free_plan") : `₹${plan.price}`}</span>
                  <span className="text-sm text-slate-300">/ {language === 'fr' ? 'mois' : language === 'es' ? 'mes' : language === 'hi' ? 'महीना' : language === 'pt' ? 'mês' : language === 'zh' ? '月' : 'month'}</span>
                </div>
                <div className="mt-6 space-y-3 text-sm text-slate-200">
                  <p><strong>{t("opportunities.category")}:</strong> {plan.applications === Infinity ? t("subscription.unlimited_text") : plan.applications}</p>
                </div>
                <button
                  disabled={isActivePlan}
                  onClick={() => {
                    setSelectedPlan(plan.title);
                  }}
                  className={`mt-6 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition cursor-pointer disabled:cursor-not-allowed`}
                  style={{ 
                    backgroundColor: isActivePlan ? 'rgba(255,255,255,0.1)' : isSelected ? '#ffffff' : styles.buttonBg, 
                    color: isActivePlan ? 'rgba(255,255,255,0.5)' : isSelected ? '#0f172a' : styles.buttonText,
                    border: isActivePlan ? '1px solid rgba(255,255,255,0.15)' : 'none'
                  }}
                >
                  {isActivePlan ? t("subscription.current_plan") : isSelected ? t("subscription.active_plan") : t("subscription.free_plan")}
                </button>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
          <section className="rounded-3xl bg-white p-8 shadow-lg text-left">
            <h2 className="text-2xl font-semibold text-gray-900">{t("subscription.current_plan")}</h2>
            {loading ? (
              <p className="mt-4 text-gray-600">Loading your subscription data...</p>
            ) : (
              <div className="mt-6 grid gap-4">
                <div className="rounded-3xl border border-gray-200 p-6 bg-slate-50">
                  <p className="text-sm text-gray-500">{t("subscription.current_plan")}</p>
                  <h3 className="text-xl font-semibold text-gray-900">{getPlanTitle(currentPlan?.planName || 'Free')}</h3>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-gray-200 p-6">
                    <p className="text-sm text-gray-500">Status</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">{currentPlan?.subscriptionStatus || 'none'}</p>
                  </div>
                  <div className="rounded-3xl border border-gray-200 p-6">
                    <p className="text-sm text-gray-500">Applications used</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">{currentPlan?.applicationsUsed ?? 0}</p>
                  </div>
                  <div className="rounded-3xl border border-gray-200 p-6">
                    <p className="text-sm text-gray-500">Applications remaining</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">{currentPlan?.applicationsRemaining === Infinity ? t("subscription.unlimited_text") : currentPlan?.applicationsRemaining ?? 0}</p>
                  </div>
                  <div className="rounded-3xl border border-gray-200 p-6">
                    <p className="text-sm text-gray-500">Expiry date</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">{currentPlan?.subscriptionEndDate ? new Date(currentPlan.subscriptionEndDate).toLocaleDateString('en-IN') : 'N/A'}</p>
                  </div>
                </div>
                <div className="rounded-3xl border border-dashed border-gray-200 p-6 bg-slate-50">
                  <p className="text-sm text-gray-500">Payment window</p>
                  <p className="mt-2 text-lg font-semibold text-gray-900">{paymentWindowOpen ? 'Open' : 'Closed'}</p>
                  {!paymentWindowOpen && <p className="text-sm text-red-600 mt-2">Payments are only allowed between 10:00 AM and 11:00 AM IST.</p>}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-3xl bg-white p-8 shadow-lg text-left">
            <h2 className="text-2xl font-semibold text-gray-900">{t("subscription.checkout_title")}</h2>
            <div className="mt-6 space-y-4">
              <div className="rounded-3xl border border-gray-200 p-6 bg-slate-50">
                <p className="text-sm text-gray-500">Selected plan</p>
                <p className="mt-2 text-xl font-semibold text-gray-900">{selectedOrCurrentPlanDetails ? getPlanTitle(selectedOrCurrentPlanDetails.title) : 'No plan selected'}</p>
                <p className="text-sm text-gray-500">{selectedOrCurrentPlanDetails ? getPlanDescription(selectedOrCurrentPlanDetails.title, selectedOrCurrentPlanDetails.applications) : 'Select a plan to continue'}</p>
                <p className="mt-4 text-3xl font-bold text-gray-900">{selectedOrCurrentPlanDetails ? (selectedOrCurrentPlanDetails.price === 0 ? t("subscription.free_plan") : `₹${selectedOrCurrentPlanDetails.price}`) : '—'}</p>
              </div>
              <button
                onClick={handleSubscribe}
                disabled={
                  !selectedPlan || 
                  (currentPlan?.planName === selectedPlan && currentPlan?.subscriptionStatus === 'active') || 
                  (selectedPlan === 'Free' && (!currentPlan || currentPlan.subscriptionStatus !== 'active' || currentPlan.planName === 'Free')) || 
                  (!paymentWindowOpen && selectedPlan !== 'Free') || 
                  paymentLoading
                }
                className="w-full rounded-3xl bg-blue-600 px-6 py-4 text-white font-semibold shadow-lg hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400 cursor-pointer"
              >
                {!selectedPlan
                  ? 'Already Active'
                  : (currentPlan?.planName === selectedPlan && currentPlan?.subscriptionStatus === 'active') || (selectedPlan === 'Free' && (!currentPlan || currentPlan.subscriptionStatus !== 'active' || currentPlan.planName === 'Free'))
                  ? 'Already Active'
                  : selectedPlan === 'Free'
                  ? 'Switch to Free Plan'
                  : paymentWindowOpen 
                  ? t("subscription.pay_now")
                  : 'Payments blocked (Outside 10-11 AM IST)'}
              </button>
            </div>
          </section>
        </div>
      </div>

      {showMockGateway && mockGatewayData && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 flex flex-col">
            {/* Header */}
            <div className="bg-slate-900 text-white p-6 relative">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500/20 text-blue-400 p-2 rounded-xl">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Secure Checkout</h3>
                  <p className="text-xs text-slate-400 font-medium">Test Gateway — No real money charged</p>
                </div>
              </div>
              {mockGatewayStep === 'input' && (
                <button
                  onClick={() => {
                    setShowMockGateway(false);
                    setMockGatewayStep('input');
                  }}
                  className="absolute right-4 top-6 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="h-6 w-6" />
                </button>
              )}
            </div>

            {/* Merchant Details */}
            <div className="bg-slate-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center text-sm">
              <div>
                <p className="text-gray-500 text-[10px] font-bold tracking-wider">MERCHANT</p>
                <p className="font-semibold text-gray-800">Internshala Clone</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500 text-[10px] font-bold tracking-wider">AMOUNT</p>
                <p className="font-bold text-blue-600 text-lg">₹{mockGatewayData.amount}</p>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-6 flex-1 min-h-[300px] flex flex-col justify-center">
              {mockGatewayStep === 'input' && (
                <div className="space-y-5">
                  {/* Method Selector */}
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

                  {/* Card Section */}
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
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-center"
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
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-center tracking-widest"
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
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {/* UPI Section */}
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
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-700 leading-relaxed font-medium">
                        Enter your Virtual Payment Address (VPA) / UPI ID to simulate checkout.
                      </div>
                    </div>
                  )}

                  {/* Netbanking Section */}
                  {mockPaymentMethod === 'netbanking' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Select Bank</label>
                        <select
                          value={mockNetbank}
                          onChange={(e) => setMockNetbank(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                        >
                          <option value="sbi">State Bank of India</option>
                          <option value="hdfc">HDFC Bank</option>
                          <option value="icici">ICICI Bank</option>
                          <option value="axis">Axis Bank</option>
                          <option value="kotak">Kotak Mahindra Bank</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Submit button */}
                  <button
                    onClick={handleMockPay}
                    disabled={mockGatewayLoading}
                    className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-2xl hover:bg-blue-700 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-sm shadow-md shadow-blue-200"
                  >
                    Pay ₹{mockGatewayData.amount}
                  </button>
                </div>
              )}

              {/* Processing state */}
              {mockGatewayStep === 'processing' && (
                <div className="text-center py-10 space-y-4 flex flex-col items-center justify-center">
                  <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
                  <div>
                    <h4 className="font-bold text-gray-800 text-base">Processing Payment</h4>
                    <p className="text-xs text-gray-500 mt-1">Connecting securely to sandbox...</p>
                  </div>
                </div>
              )}

              {/* Success state */}
              {mockGatewayStep === 'success' && (
                <div className="text-center py-10 space-y-4 flex flex-col items-center justify-center">
                  <div className="bg-green-50 p-4 rounded-full text-green-500 mb-2">
                    <CheckCircle2 className="h-16 w-16 text-green-500" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-lg">Payment Successful</h4>
                    <p className="text-xs text-gray-500 mt-1 font-medium">Your order has been verified and processed!</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer security badge */}
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

export default subscription;
