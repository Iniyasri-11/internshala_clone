/**
 * Lightweight helper to parse User-Agent header strings into Browser, OS, and Device Type.
 */
function parseUserAgent(uaString) {
  const ua = uaString || '';
  let browser = 'Unknown';
  let os = 'Unknown';
  let deviceType = 'desktop';

  // 1. Detect OS
  if (/windows/i.test(ua)) {
    os = 'Windows';
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = 'macOS';
  } else if (/android/i.test(ua)) {
    os = 'Android';
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = 'iOS';
  } else if (/linux/i.test(ua)) {
    os = 'Linux';
  }

  // 2. Detect Browser (Order is important because Chrome contains Safari, Edge contains Chrome, etc.)
  if (/edg/i.test(ua)) {
    browser = 'Edge';
  } else if (/opr/i.test(ua) || /opera/i.test(ua)) {
    browser = 'Opera';
  } else if (/firefox|fxios/i.test(ua)) {
    browser = 'Firefox';
  } else if (/chrome|crios/i.test(ua)) {
    browser = 'Google Chrome';
  } else if (/safari/i.test(ua)) {
    browser = 'Safari';
  }

  // 3. Detect Device Type (desktop, laptop, or mobile)
  if (/mobile|phone|android|iphone|ipod|blackberry|iemobile/i.test(ua)) {
    deviceType = 'mobile';
  } else if (/ipad|tablet|playbook|silk/i.test(ua)) {
    deviceType = 'mobile';
  } else {
    deviceType = 'desktop';
  }

  return { browser, os, deviceType };
}

module.exports = { parseUserAgent };
