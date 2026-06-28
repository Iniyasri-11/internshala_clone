const MS_PER_MINUTE = 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getISTParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map = {};
  parts.forEach(p => {
    map[p.type] = p.value;
  });
  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10) - 1, // 0-indexed month
    day: parseInt(map.day, 10),
    hour: parseInt(map.hour, 10),
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10),
  };
}

function getISTDate(date = new Date()) {
  const parts = getISTParts(date);
  const utcMillis = Date.UTC(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second);
  return new Date(utcMillis);
}

function startOfMonth(date = new Date()) {
  const parts = getISTParts(date);
  const utcMillis = Date.UTC(parts.year, parts.month, 1, 0, 0, 0);
  return new Date(utcMillis - IST_OFFSET_MS);
}

function startOfNextMonth(date = new Date()) {
  const parts = getISTParts(date);
  const utcMillis = Date.UTC(parts.year, parts.month + 1, 1, 0, 0, 0);
  return new Date(utcMillis - IST_OFFSET_MS);
}

function isPaymentWindow(date = new Date()) {
  if (process.env.BYPASS_PAYMENT_WINDOW === 'true') {
    return true;
  }
  try {
    const fs = require('fs');
    const path = require('path');
    const bypassPath = path.join(__dirname, '..', 'bypass.txt');
    if (fs.existsSync(bypassPath)) {
      const content = fs.readFileSync(bypassPath, 'utf8').trim();
      if (content === 'true') return true;
    }
  } catch (err) {
    // Ignore error
  }
  const parts = getISTParts(date);
  return parts.hour === 10;
}

function formatIST(date = new Date()) {
  const parts = getISTParts(date);
  const pad = (num) => String(num).padStart(2, '0');
  return `${parts.year}-${pad(parts.month + 1)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}+05:30`;
}

module.exports = {
  getISTParts,
  getISTDate,
  isPaymentWindow,
  startOfMonth,
  startOfNextMonth,
  formatIST,
};

