/**
 * deviceDetector.js - Extracts client machine IP and parses human-readable device/OS/browser info.
 */

function getClientIp(req) {
  if (!req) return '127.0.0.1';

  // Check proxy / load balancer headers
  const forwarded = req.headers['x-forwarded-for'];
  let rawIp = '';
  if (forwarded) {
    const list = String(forwarded).split(',');
    rawIp = list[0].trim();
  } else if (req.headers['x-real-ip']) {
    rawIp = String(req.headers['x-real-ip']).trim();
  } else if (req.headers['cf-connecting-ip']) {
    rawIp = String(req.headers['cf-connecting-ip']).trim();
  } else if (req.ip) {
    rawIp = String(req.ip).trim();
  } else if (req.socket?.remoteAddress) {
    rawIp = String(req.socket.remoteAddress).trim();
  } else if (req.connection?.remoteAddress) {
    rawIp = String(req.connection.remoteAddress).trim();
  }

  if (!rawIp) return '127.0.0.1';

  // Strip IPv6-mapped IPv4 prefix (::ffff:192.168.1.1 -> 192.168.1.1)
  if (rawIp.startsWith('::ffff:')) {
    rawIp = rawIp.replace('::ffff:', '');
  }

  // Handle local loopback representations
  if (rawIp === '::1' || rawIp === '127.0.0.1') {
    return '127.0.0.1 (Localhost)';
  }

  return rawIp;
}

function parseDevice(userAgent = '') {
  if (!userAgent || typeof userAgent !== 'string') return 'Desktop (Browser)';

  const ua = userAgent;

  // OS Detection
  let os = 'Unknown OS';
  if (/windows phone/i.test(ua)) os = 'Windows Phone';
  else if (/win64|win32|windows/i.test(ua)) {
    if (/windows nt 10.0/i.test(ua)) os = 'Windows 10/11';
    else if (/windows nt 6.3/i.test(ua)) os = 'Windows 8.1';
    else if (/windows nt 6.1/i.test(ua)) os = 'Windows 7';
    else os = 'Windows';
  } else if (/iphone/i.test(ua)) os = 'iPhone';
  else if (/ipad/i.test(ua)) os = 'iPad';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/cros/i.test(ua)) os = 'Chrome OS';
  else if (/linux/i.test(ua)) os = 'Linux';

  // Browser Detection
  let browser = 'Browser';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
  else if (/samsungbrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';

  // Device Form Factor icon prefix
  const isMobile = /mobile|iphone|ipod|android.*mobile/i.test(ua);
  const isTablet = /tablet|ipad/i.test(ua);

  const formIcon = isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'PC';

  return `${os} · ${browser} (${formIcon})`;
}

module.exports = {
  getClientIp,
  parseDevice,
};
