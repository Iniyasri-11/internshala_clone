const User = require('../Model/User');
const { getISTDate } = require('./timeUtils');

async function checkAndResetMonthlyApplications(user) {
  if (!user) return;
  const now = new Date();
  const nowIST = getISTDate(now);
  let changed = false;

  // 1. Check for subscription expiration
  if (user.subscriptionStatus === 'active' && user.subscriptionEndDate) {
    const endDate = new Date(user.subscriptionEndDate);
    if (endDate < nowIST) {
      user.subscriptionStatus = 'expired';
      user.subscriptionPlan = 'Free';
      user.applicationsUsed = 0;
      user.lastApplicationReset = now;
      changed = true;
      console.log(`[Expiry] Downgraded user ${user.email} to Free plan due to expired subscription.`);
    }
  }

  // 2. Check for calendar month change reset
  if (!changed) {
    const lastReset = user.lastApplicationReset ? new Date(user.lastApplicationReset) : new Date(user.createdAt || now);
    const lastResetIST = getISTDate(lastReset);

    if (nowIST.getFullYear() !== lastResetIST.getFullYear() || nowIST.getMonth() !== lastResetIST.getMonth()) {
      user.applicationsUsed = 0;
      user.lastApplicationReset = now;
      changed = true;
      console.log(`[Reset] Reset applications count to 0 for user ${user.email} due to new calendar month.`);
    }
  }

  if (changed) {
    await user.save();
  }
}

module.exports = {
  checkAndResetMonthlyApplications,
};
