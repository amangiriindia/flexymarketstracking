// src/services/notificationService.js
const admin = require('../config/firebase');
const Notification = require('../models/Notification');
const DeviceToken = require('../models/DeviceToken');

class NotificationService {
  /**
   * Send notification to a single user
   */
  async sendToUser(userId, notificationData) {
    try {
      const { title, body, type = 'general', priority = 'medium', data = {}, imageUrl, actions = [] } = notificationData;

      // Get active device tokens for the user
      const deviceTokens = await DeviceToken.getActiveTokens(userId);

      if (!deviceTokens || deviceTokens.length === 0) {
        throw new Error('No active device tokens found for user');
      }

      const tokens = deviceTokens.map(dt => dt.token);

      // Create notification record
      const notification = await Notification.create({
        sentBy: notificationData.sentBy,
        recipient: userId,
        title,
        body,
        type,
        priority,
        data: new Map(Object.entries(data)),
        imageUrl,
        actions,
        deliveryStatus: 'pending'
      });

      // Prepare FCM message
      const message = {
        notification: {
          title,
          body,
          ...(imageUrl && { imageUrl })
        },
        data: {
          notificationId: notification._id.toString(),
          type,
          priority,
          ...data
        },
        android: {
          priority: this._getAndroidPriority(priority),
          notification: {
            sound: 'default',
            channelId: type,
            priority: this._getAndroidPriority(priority)
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              'content-available': 1
            }
          }
        },
        tokens
      };

      // Send via Firebase
      const response = await admin.messaging().sendEachForMulticast(message);

      // Update notification status
      notification.deliveryStatus = response.successCount > 0 ? 'sent' : 'failed';
      notification.sentAt = new Date();
      notification.firebaseResponse = {
        successCount: response.successCount,
        failureCount: response.failureCount
      };

      console.log('--- FCM NOTIFICATION RESULT ---');
      console.log(`Target User ID: ${userId}`);
      console.log(`Total Tokens Attempted: ${tokens.length}`);
      console.log(`Success: ${response.successCount}, Failures: ${response.failureCount}`);

      // Handle failures and log everything
      response.responses.forEach((resp, idx) => {
        if (resp.success) {
          console.log(`[SUCCESS] Token: ${tokens[idx]}`);
        } else {
          console.log(`[FAILED] Token: ${tokens[idx]}`);
          console.log(`[FAILED] Error:`, resp.error?.message || resp.error);
        }
      });
      console.log('-------------------------------');

      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
            // Mark token as failed in database
            DeviceToken.markAsFailed(tokens[idx], resp.error?.message || 'Unknown error');
          }
        });
        
        if (response.successCount === 0) {
          notification.errorMessage = 'Failed to send to all devices';
        }
      }

      await notification.save();

      return {
        success: true,
        notification,
        deliveryReport: {
          successCount: response.successCount,
          failureCount: response.failureCount
        }
      };
    } catch (error) {
      console.error('Send to user error:', error);
      throw error;
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendToMultipleUsers(userIds, notificationData, sentBy) {
    const results = [];
    const errors = [];

    for (const userId of userIds) {
      try {
        const result = await this.sendToUser(userId, {
          ...notificationData,
          sentBy
        });
        results.push({ userId, success: true, data: result });
      } catch (error) {
        errors.push({ userId, error: error.message });
      }
    }

    return {
      successCount: results.length,
      failureCount: errors.length,
      results,
      errors
    };
  }

  /**
   * Send notification to all users (broadcast)
   */
  async broadcast(notificationData, sentBy) {
    try {
      const User = require('../models/User');
      const activeUsers = await User.find({ isActive: true }).select('_id');
      const userIds = activeUsers.map(u => u._id);

      return await this.sendToMultipleUsers(userIds, notificationData, sentBy);
    } catch (error) {
      console.error('Broadcast error:', error);
      throw error;
    }
  }

  /**
   * Send notification to users by role
   */
  async sendToRole(role, notificationData, sentBy) {
    try {
      const User = require('../models/User');
      const users = await User.find({ role, isActive: true }).select('_id');
      const userIds = users.map(u => u._id);

      return await this.sendToMultipleUsers(userIds, notificationData, sentBy);
    } catch (error) {
      console.error('Send to role error:', error);
      throw error;
    }
  }

  /**
   * Schedule a notification
   */
  async scheduleNotification(userId, notificationData, scheduledFor) {
    try {
      const { title, body, type = 'general', priority = 'medium', data = {}, imageUrl, sentBy } = notificationData;

      const notification = await Notification.create({
        sentBy,
        recipient: userId,
        title,
        body,
        type,
        priority,
        data: new Map(Object.entries(data)),
        imageUrl,
        scheduledFor,
        isScheduled: true,
        deliveryStatus: 'pending'
      });

      return notification;
    } catch (error) {
      console.error('Schedule notification error:', error);
      throw error;
    }
  }

  /**
   * Process scheduled notifications (to be called by cron job)
   */
  async processScheduledNotifications() {
    try {
      const now = new Date();
      const scheduledNotifications = await Notification.find({
        isScheduled: true,
        scheduledFor: { $lte: now },
        deliveryStatus: 'pending',
        isActive: true
      });

      const results = [];
      for (const notification of scheduledNotifications) {
        try {
          await this.sendToUser(notification.recipient, {
            sentBy: notification.sentBy,
            title: notification.title,
            body: notification.body,
            type: notification.type,
            priority: notification.priority,
            data: Object.fromEntries(notification.data),
            imageUrl: notification.imageUrl
          });

          notification.isScheduled = false;
          await notification.save();
          
          results.push({ notificationId: notification._id, success: true });
        } catch (error) {
          results.push({ notificationId: notification._id, success: false, error: error.message });
        }
      }

      return results;
    } catch (error) {
      console.error('Process scheduled notifications error:', error);
      throw error;
    }
  }

  /**
   * Send notification based on activity type
   */
  async sendActivityNotification(activity) {
    try {
      const { type, sender, recipient, data } = activity;

      let notificationData = {};

      switch (type) {
        case 'like':
          notificationData = {
            title: 'New Like',
            body: `${sender.name} liked your post`,
            type: 'like',
            data: { postId: data.postId }
          };
          break;

        case 'comment':
          notificationData = {
            title: 'New Comment',
            body: `${sender.name} commented on your post`,
            type: 'comment',
            data: { postId: data.postId, commentId: data.commentId }
          };
          break;

        case 'follow':
          notificationData = {
            title: 'New Follower',
            body: `${sender.name} started following you`,
            type: 'follow',
            data: { userId: sender._id.toString() }
          };
          break;

        case 'post':
          notificationData = {
            title: 'New Post',
            body: `${sender.name} created a new post`,
            type: 'post',
            data: { postId: data.postId }
          };
          break;

        default:
          throw new Error(`Unknown activity type: ${type}`);
      }

      return await this.sendToUser(recipient, {
        ...notificationData,
        sentBy: sender._id
      });
    } catch (error) {
      console.error('Send activity notification error:', error);
      throw error;
    }
  }

  /**
   * Helper: Get Android priority level
   */
  _getAndroidPriority(priority) {
    const priorityMap = {
      low: 'min',
      medium: 'default',
      high: 'high',
      urgent: 'max'
    };
    return priorityMap[priority] || 'default';
  }
}

module.exports = new NotificationService();