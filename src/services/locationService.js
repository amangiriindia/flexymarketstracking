// src/services/locationService.js
const axios = require('axios');

/**
 * Get accurate location from IP (country, city, state, pincode, lat/lng)
 * Using ip-api.com — FREE, no key, 45 req/sec, 99.99% uptime
 */
const getLocationFromIp = async (ip) => {
  // Skip localhost
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
    return {
      country: 'Local',
      state: 'Localhost',
      city: 'Development',
      pincode: '000000',
      formattedAddress: 'Local Development',
      lat: 0,
      lng: 0
    };
  }

  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}`, {
      timeout: 5000
    });

    if (response.data.status !== 'success') {
      console.log('IP Geolocation failed:', response.data);
      return null;
    }

    const data = response.data;

    return {
      country: data.country || 'Unknown',
      state: data.regionName || 'Unknown',
      city: data.city || 'Unknown',
      pincode: data.zip || 'Unknown',
      formattedAddress: `${data.city}, ${data.regionName}, ${data.country} ${data.zip}`.trim(),
      lat: data.lat,
      lng: data.lon
    };
  } catch (error) {
    console.error('Location service error:', error.message);
    return null;
  }
};

module.exports = { getLocationFromIp };