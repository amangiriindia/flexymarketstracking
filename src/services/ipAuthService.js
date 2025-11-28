// src/services/ipAuthService.js


const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.headers['cf-connecting-ip'] ||    
    req.headers['true-client-ip'] ||     
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.connection?.socket?.remoteAddress ||
    'unknown'
  );
};

/**
 * Get clean device info from User-Agent
 */
const getDeviceInfo = (req) => {
  const ua = req.headers['user-agent'];
  if (!ua) return 'Unknown Device';

  // Simple detection (you can use 'ua-parser-js' for advanced parsing)
  if (ua.includes('Android')) return `Android · ${ua.split('Android')[1]?.split(';')[0]?.trim() || 'Device'}`;
  if (ua.includes('iPhone')) return 'iPhone';
  if (ua.includes('iPad')) return 'iPad';
  if (ua.includes('Windows')) return `Windows · ${ua.includes('Phone') ? 'Mobile' : 'PC'}`;
  if (ua.includes('Macintosh')) return 'Mac';
  if (ua.includes('Linux')) return 'Linux';

  return ua.substring(0, 60) + (ua.length > 60 ? '...' : '');
};

/**
 * Format login/location string for response
 */
const formatLoginInfo = (ip, device) => {
  const shortDevice = device.substring(0, 50) + (device.length > 50 ? '...' : '');
  return `${ip} · ${shortDevice}`;
};

module.exports = {
  getClientIp,
  getDeviceInfo,
  formatLoginInfo
};