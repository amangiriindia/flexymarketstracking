// src/jobs/notificationScheduler.js
const cron = require('node-cron');
const notificationService = require('../services/notificationService');
const Notification = require('../models/Notification');
const DeviceToken = require('../models/DeviceToken');

class NotificationScheduler {
  /**
   * Initialize all cron jobs
   */
  static init() {
    console.log('📅 Initializing notification cron jobs...');

    // Process scheduled notifications every minute
    this.scheduleNotificationProcessor();

    // Clean up expired notifications daily at 2 AM
    this.scheduleCleanupExpired();

    // Clean up old inactive device tokens weekly
    this.scheduleCleanupDeviceTokens();

    console.log('✅ Notification cron jobs initialized');
  }

  /**
   * Process scheduled notifications every minute
   */
  static scheduleNotificationProcessor() {
    // Run every minute
    cron.schedule('* * * * *', async () => {
      try {
        console.log('🔄 Processing scheduled notifications...');
        const results = await notificationService.processScheduledNotifications();
        
        if (results.length > 0) {
          console.log(`✅ Processed ${results.length} scheduled notifications`);
        }
      } catch (error) {
        console.error('❌ Error processing scheduled notifications:', error);
      }
    });

    console.log('✅ Scheduled notification processor initialized (runs every minute)');
  }

  /**
   * Clean up expired notifications daily at 2 AM
   */
  static scheduleCleanupExpired() {
    // Run daily at 2:00 AM
    cron.schedule('0 2 * * *', async () => {
      try {
        console.log('🧹 Cleaning up expired notifications...');
        const result = await Notification.cleanupExpired();
        console.log(`✅ Deleted ${result.deletedCount} expired notifications`);
      } catch (error) {
        console.error('❌ Error cleaning up expired notifications:', error);
      }
    });

    console.log('✅ Expired notifications cleanup scheduled (daily at 2 AM)');
  }

  /**
   * Clean up old inactive device tokens weekly
   */
  static scheduleCleanupDeviceTokens() {
    // Run every Sunday at 3:00 AM
    cron.schedule('0 3 * * 0', async () => {
      try {
        console.log('🧹 Cleaning up old device tokens...');
        const result = await DeviceToken.cleanupOldTokens(90); // 90 days old
        console.log(`✅ Deleted ${result.deletedCount} old device tokens`);
      } catch (error) {
        console.error('❌ Error cleaning up device tokens:', error);
      }
    });

    console.log('✅ Device token cleanup scheduled (weekly on Sunday at 3 AM)');
  }

  /**
   * Manual trigger for testing
   */
  static async triggerScheduledNotifications() {
    try {
      console.log('🔄 Manually triggering scheduled notifications...');
      const results = await notificationService.processScheduledNotifications();
      console.log(`✅ Processed ${results.length} scheduled notifications`);
      return results;
    } catch (error) {
      console.error('❌ Error triggering scheduled notifications:', error);
      throw error;
    }
  }

  /**
   * Manual trigger for cleanup
   */
  static async triggerCleanup() {
    try {
      console.log('🧹 Manually triggering cleanup...');
      
      const [expiredNotifs, oldTokens] = await Promise.all([
        Notification.cleanupExpired(),
        DeviceToken.cleanupOldTokens(90)
      ]);

      console.log(`✅ Deleted ${expiredNotifs.deletedCount} expired notifications`);
      console.log(`✅ Deleted ${oldTokens.deletedCount} old device tokens`);
      
      return {
        expiredNotifications: expiredNotifs.deletedCount,
        oldDeviceTokens: oldTokens.deletedCount
      };
    } catch (error) {
      console.error('❌ Error triggering cleanup:', error);
      throw error;
    }
  }
}

module.exports = NotificationScheduler;