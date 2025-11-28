// src/services/deviceService.js
const UAParser = require('ua-parser-js');

const getDeviceInfo = (userAgent) => {
  if (!userAgent || userAgent.includes('Postman') || userAgent.includes('curl')) {
    return 'Development Tool (Postman/curl)';
  }

  try {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    const device = result.device.vendor && result.device.model
      ? `${result.device.vendor} ${result.device.model}`
      : result.device.model || result.os.name || 'Unknown Device';

    const os = result.os.name && result.os.version
      ? `${result.os.name} ${result.os.version.split('.')[0]}`
      : result.os.name || '';

    const browser = result.browser.name 
      ? `${result.browser.name} ${result.browser.version?.split('.')[0] || ''}`.trim()
      : '';

    return [device, os, browser].filter(Boolean).join(' · ') || 'Unknown Device';
  } catch (error) {
    return 'Unknown Device';
  }
};

module.exports = { getDeviceInfo };