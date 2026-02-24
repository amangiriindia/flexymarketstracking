// src/jobs/notificationScheduler.js
const cron = require('node-cron');
const notificationService = require('../services/notificationService');

class NotificationScheduler {
  /**
   * Initialize all cron jobs
   */
  static init() {
    console.log('Initializing notification cron jobs...');

    // Process scheduled notifications every minute
    this.scheduleNotificationProcessor();

    console.log(' Notification cron jobs initialized');
  }

  /**
   * Process scheduled notifications every minute
   */
  static scheduleNotificationProcessor() {
    // Run every minute
    cron.schedule('* * * * *', async () => {
      try {
        console.log('Processing scheduled notifications...');
        const results = await notificationService.processScheduledNotifications();
        
        if (results.length > 0) {
          console.log(`Processed ${results.length} scheduled notifications`);
        }
      } catch (error) {
        console.error('Error processing scheduled notifications:', error);
      }
    });

    console.log('Scheduled notification processor initialized (runs every minute)');
  }

  /**
   * Manual trigger for testing
   */
  static async triggerScheduledNotifications() {
    try {
      console.log('Manually triggering scheduled notifications...');
      const results = await notificationService.processScheduledNotifications();
      console.log(`Processed ${results.length} scheduled notifications`);
      return results;
    } catch (error) {
      console.error(' Error triggering scheduled notifications:', error);
      throw error;
    }
  }
}

module.exports = NotificationScheduler;