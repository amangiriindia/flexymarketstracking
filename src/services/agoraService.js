// src/services/agoraService.js
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const agoraConfig = require('../config/agora');

class AgoraService {
  /**
   * Generate RTC token for voice call
   * @param {string} channelName - The channel name
   * @param {number} uid - User ID (0 for auto-assign)
   * @param {string} role - 'publisher' or 'subscriber'
   * @returns {string} Agora RTC token
   */
  generateRtcToken(channelName, uid = 0, role = 'publisher') {
    const appId = agoraConfig.appId;
    const appCertificate = agoraConfig.appCertificate;
    const expirationTimeInSeconds = agoraConfig.tokenExpirationTime;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    // Determine role
    const userRole = role === 'publisher' 
      ? RtcRole.PUBLISHER 
      : RtcRole.SUBSCRIBER;

    try {
      const token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        uid,
        userRole,
        privilegeExpiredTs
      );

      return token;
    } catch (error) {
      console.error('Error generating Agora token:', error);
      throw new Error('Failed to generate Agora token');
    }
  }

  /**
   * Generate RTC token with account
   * @param {string} channelName - The channel name
   * @param {string} account - User account
   * @param {string} role - 'publisher' or 'subscriber'
   * @returns {string} Agora RTC token
   */
  generateRtcTokenWithAccount(channelName, account, role = 'publisher') {
    const appId = agoraConfig.appId;
    const appCertificate = agoraConfig.appCertificate;
    const expirationTimeInSeconds = agoraConfig.tokenExpirationTime;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const userRole = role === 'publisher' 
      ? RtcRole.PUBLISHER 
      : RtcRole.SUBSCRIBER;

    try {
      const token = RtcTokenBuilder.buildTokenWithAccount(
        appId,
        appCertificate,
        channelName,
        account,
        userRole,
        privilegeExpiredTs
      );

      return token;
    } catch (error) {
      console.error('Error generating Agora token:', error);
      throw new Error('Failed to generate Agora token');
    }
  }

  /**
   * Validate channel name
   * @param {string} channelName - The channel name to validate
   * @returns {boolean} True if valid
   */
  validateChannelName(channelName) {
    // Channel name should be alphanumeric and can contain underscores
    const regex = /^[a-zA-Z0-9_]+$/;
    return regex.test(channelName) && channelName.length <= 64;
  }
}

module.exports = new AgoraService();