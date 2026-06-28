import { useEffect, useState } from 'react';
import { api } from '@/utils/api';
import { toast } from 'react-toastify';
import Link from 'next/link';
import { 
  ArrowLeft, 
  RefreshCw, 
  CreditCard, 
  Users, 
  DollarSign, 
  Activity, 
  Award, 
  Settings, 
  FileText, 
  ChevronRight,
  TrendingUp
} from 'lucide-react';

export default function SubscriptionsManagement() {
  const [stats, setStats] = useState<any>({
    totalUsers: 0,
    activeSubscriptions: 0,
    expiredSubscriptions: 0,
    totalPayments: 0,
    totalApplications: 0,
    monthlyApplications: 0,
  });
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Manual Adjustment Form States
  const [adjustUid, setAdjustUid] = useState('');
  const [adjustPlan, setAdjustPlan] = useState('Free');
  const [adjustLoading, setAdjustLoading] = useState(false);

  // Refund State
  const [refundLoadingId, setRefundLoadingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [overviewRes, subRes, payRes] = await Promise.all([
        api.get('/admin/overview'),
        api.get('/admin/subscriptions'),
        api.get('/admin/payments'),
      ]);
      setStats(overviewRes.data);
      setSubscriptions(subRes.data.subscriptions || []);
      setPayments(payRes.data.payments || []);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.error || 'Failed to fetch admin data. Make sure you are logged in as admin.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleAdjustPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustUid.trim()) {
      toast.error('Please enter a User UID.');
      return;
    }
    setAdjustLoading(true);
    try {
      await api.post('/admin/subscription/adjust', {
        uid: adjustUid.trim(),
        planName: adjustPlan,
      });
      toast.success(`User plan adjusted to ${adjustPlan} successfully!`);
      setAdjustUid('');
      handleRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.error || 'Failed to adjust user plan.');
    } finally {
      setAdjustLoading(false);
    }
  };

  const handleRefund = async (paymentId: string) => {
    if (!confirm('Are you sure you want to refund this transaction?')) return;
    setRefundLoadingId(paymentId);
    try {
      await api.post('/admin/payments/refund', { paymentId });
      toast.success('Payment marked as refunded successfully.');
      handleRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.error || 'Failed to refund transaction.');
    } finally {
      setRefundLoadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
          <p className="text-gray-500 font-medium">Loading subscription center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 text-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <Link href="/adminpanel" className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800 font-semibold gap-1 mb-2 transition">
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Subscriptions & Payments</h1>
            <p className="mt-1 text-slate-500">Monitor billing status, handle refunds, and adjust subscriber tier levels.</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-sm hover:bg-slate-50 transition text-sm font-semibold disabled:opacity-50 text-slate-700"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Records
          </button>
        </div>

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60 flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Total Users</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.totalUsers}</h3>
            </div>
          </div>
          
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Active Subscriptions</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.activeSubscriptions}</h3>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60 flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Expired / None</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.expiredSubscriptions}</h3>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60 flex items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Total Transactions</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats.totalPayments}</h3>
            </div>
          </div>
        </div>

        {/* Sub-panels Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          
          {/* Left panel: Manual adjustment form */}
          <div className="lg:col-span-1 bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60 self-start">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <Settings className="h-5 w-5 text-indigo-600" />
              <h2 className="text-xl font-bold text-slate-950">Manual Plan Adjust</h2>
            </div>
            <p className="text-sm text-slate-500 mb-6">Manually overwrite user subscription levels. Changes apply immediately.</p>
            
            <form onSubmit={handleAdjustPlan} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">User UID</label>
                <input
                  type="text"
                  placeholder="Enter User UID (e.g. user-178...)"
                  value={adjustUid}
                  onChange={(e) => setAdjustUid(e.target.value)}
                  className="w-full text-slate-900 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Plan</label>
                <select
                  value={adjustPlan}
                  onChange={(e) => setAdjustPlan(e.target.value)}
                  className="w-full text-slate-900 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50"
                >
                  <option value="Free">Free Plan (₹0 / 1 application)</option>
                  <option value="Bronze">Bronze Plan (₹100 / 3 applications)</option>
                  <option value="Silver">Silver Plan (₹300 / 5 applications)</option>
                  <option value="Gold">Gold Plan (₹1000 / Unlimited)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={adjustLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl shadow-md transition disabled:opacity-50 text-sm"
              >
                {adjustLoading ? 'Applying Changes...' : 'Adjust Subscription'}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <h4 className="text-sm font-bold text-slate-900">Application Statistics</h4>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 text-sm space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Submissions</span>
                  <span className="font-bold text-slate-900">{stats.totalApplications}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">This Calendar Month</span>
                  <span className="font-bold text-slate-900">{stats.monthlyApplications}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel: Subscriptions & Payment Lists */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Active Subscriptions List */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">All Subscriptions</h2>
                <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-full">{subscriptions.length} total</span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-semibold border-b border-slate-100">
                      <th className="py-3.5 px-6">User ID</th>
                      <th className="py-3.5 px-6">Plan Name</th>
                      <th className="py-3.5 px-6">Price</th>
                      <th className="py-3.5 px-6">Date Range</th>
                      <th className="py-3.5 px-6">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subscriptions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">No subscription records found.</td>
                      </tr>
                    ) : (
                      subscriptions.map((sub: any) => (
                        <tr key={sub._id} className="hover:bg-slate-50/50">
                          <td className="py-4 px-6 font-mono text-xs text-slate-500 max-w-[150px] truncate" title={sub.userId}>
                            {sub.userId}
                          </td>
                          <td className="py-4 px-6 font-semibold text-slate-900">{sub.planName}</td>
                          <td className="py-4 px-6 font-medium">₹{sub.price}</td>
                          <td className="py-4 px-6 text-slate-500 text-xs whitespace-nowrap">
                            {new Date(sub.startDate).toLocaleDateString('en-IN')} - {new Date(sub.endDate).toLocaleDateString('en-IN')}
                          </td>
                          <td className="py-4 px-6">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              sub.status === 'active' 
                                ? 'bg-emerald-50 text-emerald-700' 
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              {sub.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment History List */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Payment Transactions</h2>
                <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-full">{payments.length} total</span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-semibold border-b border-slate-100">
                      <th className="py-3.5 px-6">Invoice</th>
                      <th className="py-3.5 px-6">User ID</th>
                      <th className="py-3.5 px-6">Amount</th>
                      <th className="py-3.5 px-6">Date</th>
                      <th className="py-3.5 px-6">Status</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">No payment history found.</td>
                      </tr>
                    ) : (
                      payments.map((pay: any) => (
                        <tr key={pay._id} className="hover:bg-slate-50/50">
                          <td className="py-4 px-6 font-semibold text-indigo-600 max-w-[120px] truncate" title={pay.invoiceNumber}>
                            {pay.invoiceNumber}
                          </td>
                          <td className="py-4 px-6 font-mono text-xs text-slate-500 max-w-[120px] truncate" title={pay.userId}>
                            {pay.userId}
                          </td>
                          <td className="py-4 px-6 font-semibold">₹{pay.amount}</td>
                          <td className="py-4 px-6 text-slate-500 text-xs whitespace-nowrap">
                            {new Date(pay.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="py-4 px-6">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              pay.status === 'paid' 
                                ? 'bg-emerald-50 text-emerald-700' 
                                : pay.status === 'refunded'
                                ? 'bg-blue-50 text-blue-700'
                                : pay.status === 'failed'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              {pay.status}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right whitespace-nowrap">
                            {pay.status === 'paid' && (
                              <button
                                onClick={() => handleRefund(pay.paymentId)}
                                disabled={refundLoadingId === pay.paymentId}
                                className="bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                              >
                                {refundLoadingId === pay.paymentId ? 'Refunding...' : 'Refund'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
