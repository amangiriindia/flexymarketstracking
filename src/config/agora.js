// src/config/agora.js
module.exports = {
  appId: process.env.AGORA_APP_ID,
  appCertificate: process.env.AGORA_APP_CERTIFICATE,
  tokenExpirationTime: 3600, // 1 hour in seconds
  privilegeExpirationTime: 3600,
};