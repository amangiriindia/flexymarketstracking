// src/services/ipAuthService.js
const UAParser = require('ua-parser-js');

/**
 * Get real client IP (Cloudflare, Nginx, proxies, localhost safe)
 */
const getClientIp = (req) => {
  const candidates = [
    req.headers['x-forwarded-for']?.split(',')[0]?.trim(),
    req.headers['x-real-ip'],
    req.headers['cf-connecting-ip'],      // Cloudflare
    req.headers['true-client-ip'],
    req.headers['x-client-ip'],
    req.headers['x-cluster-client-ip'],
    req.ip,
    req.connection?.remoteAddress,
    req.socket?.remoteAddress,
    req.connection?.socket?.remoteAddress
  ].filter(Boolean);

  const ip = candidates.find(ip => 
    ip && !ip.includes('127.0.0.1') && ip !== '::1' && ip !== '::ffff:127.0.0.1'
  );

  return ip || '127.0.0.1';
};



/**
 * Format login info for display
 */
const formatLoginInfo = (ip, device) => {
  if (!ip || ip === '127.0.0.1') return 'Local Development';
  const shortDevice = device.length > 50 ? device.substring(0, 47) + '...' : device;
  return `${ip} · ${shortDevice}`;
};

module.exports = {
  getClientIp,
  formatLoginInfo
};