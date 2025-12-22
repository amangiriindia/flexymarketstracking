// src/controllers/adminNotificationController.js
const Notification = require('../models/Notification');
const DeviceToken = require('../models/DeviceToken');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const mongoose = require('mongoose');

/**
 * @desc    Send notification to a single user (Admin)
 * @route   POST /api/v1/admin/notifications/send
 * @access  Private (Admin)
 */
exports.sendNotificationToUser = async (req, res) => {
  try {
    const { userId, title, body, type, priority, data, imageUrl, actions } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({
        status: 'error',
        message: 'userId, title, and body are required'
      });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const result = await notificationService.sendToUser(userId, {
      sentBy: req.user.id,
      title,
      body,
      type: type || 'admin',
      priority: priority || 'medium',
      data: data || {},
      imageUrl,
      actions
    });

    res.status(200).json({
      status: 'success',
      message: 'Notification sent successfully',
      data: result
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to send notification'
    });
  }
};

/**
 * @desc    Send notification to multiple users (Admin)
 * @route   POST /api/v1/admin/notifications/send-multiple
 * @access  Private (Admin)
 */
exports.sendNotificationToMultipleUsers = async (req, res) => {
  try {
    const { userIds, title, body, type, priority, data, imageUrl } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'userIds array is required'
      });
    }

    if (!title || !body) {
      return res.status(400).json({
        status: 'error',
        message: 'title and body are required'
      });
    }

    const result = await notificationService.sendToMultipleUsers(
      userIds,
      {
        title,
        body,
        type: type || 'admin',
        priority: priority || 'medium',
        data: data || {},
        imageUrl
      },
      req.user.id
    );

    res.status(200).json({
      status: 'success',
      message: 'Notifications sent',
      data: result
    });
  } catch (error) {
    console.error('Send multiple notifications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send notifications'
    });
  }
};

/**
 * @desc    Broadcast notification to all users (Admin)
 * @route   POST /api/v1/admin/notifications/broadcast
 * @access  Private (Admin)
 */
exports.broadcastNotification = async (req, res) => {
  try {
    const { title, body, type, priority, data, imageUrl } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        status: 'error',
        message: 'title and body are required'
      });
    }

    const result = await notificationService.broadcast(
      {
        title,
        body,
        type: type || 'system',
        priority: priority || 'high',
        data: data || {},
        imageUrl
      },
      req.user.id
    );

    res.status(200).json({
      status: 'success',
      message: 'Broadcast notification sent',
      data: result
    });
  } catch (error) {
    console.error('Broadcast notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to broadcast notification'
    });
  }
};

/**
 * @desc    Send notification to users by role (Admin)
 * @route   POST /api/v1/admin/notifications/send-by-role
 * @access  Private (Admin)
 */
exports.sendNotificationByRole = async (req, res) => {
  try {
    const { role, title, body, type, priority, data, imageUrl } = req.body;

    if (!role || !title || !body) {
      return res.status(400).json({
        status: 'error',
        message: 'role, title, and body are required'
      });
    }

    const result = await notificationService.sendToRole(
      role,
      {
        title,
        body,
        type: type || 'admin',
        priority: priority || 'medium',
        data: data || {},
        imageUrl
      },
      req.user.id
    );

    res.status(200).json({
      status: 'success',
      message: `Notification sent to all ${role} users`,
      data: result
    });
  } catch (error) {
    console.error('Send by role error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send notification'
    });
  }
};

/**
 * @desc    Schedule a notification (Admin)
 * @route   POST /api/v1/admin/notifications/schedule
 * @access  Private (Admin)
 */
exports.scheduleNotification = async (req, res) => {
  try {
    const { userId, title, body, type, priority, data, imageUrl, scheduledFor } = req.body;

    if (!userId || !title || !body || !scheduledFor) {
      return res.status(400).json({
        status: 'error',
        message: 'userId, title, body, and scheduledFor are required'
      });
    }

    const scheduledDate = new Date(scheduledFor);
    if (scheduledDate < new Date()) {
      return res.status(400).json({
        status: 'error',
        message: 'Scheduled time must be in the future'
      });
    }

    const notification = await notificationService.scheduleNotification(
      userId,
      {
        sentBy: req.user.id,
        title,
        body,
        type: type || 'admin',
        priority: priority || 'medium',
        data: data || {},
        imageUrl
      },
      scheduledDate
    );

    res.status(200).json({
      status: 'success',
      message: 'Notification scheduled successfully',
      data: { notification }
    });
  } catch (error) {
    console.error('Schedule notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to schedule notification'
    });
  }
};

/**
 * @desc    Get all notifications (Admin view with filters)
 * @route   GET /api/v1/admin/notifications
 * @access  Private (Admin)
 */
exports.getAllNotifications = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = { isActive: true };

    // Filter by type
    if (req.query.type) {
      filter.type = req.query.type;
    }

    // Filter by status
    if (req.query.status) {
      filter.deliveryStatus = req.query.status;
    }

    // Filter by priority
    if (req.query.priority) {
      filter.priority = req.query.priority;
    }

    // Filter by sender
    if (req.query.sentBy) {
      filter.sentBy = req.query.sentBy;
    }

    // Filter by recipient
    if (req.query.recipient) {
      filter.recipient = req.query.recipient;
    }

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) {
        filter.createdAt.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.createdAt.$lte = new Date(req.query.endDate);
      }
    }

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .populate('sentBy', 'name email avatar')
        .populate('recipient', 'name email avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      
      Notification.countDocuments(filter)
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all notifications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch notifications'
    });
  }
};

/**
 * @desc    Get notification statistics (Admin)
 * @route   GET /api/v1/admin/notifications/stats
 * @access  Private (Admin)
 */
exports.getNotificationStats = async (req, res) => {
  try {
    const [
      totalNotifications,
      sentCount,
      deliveredCount,
      failedCount,
      scheduledCount,
      byType,
      byPriority,
      recentActivity
    ] = await Promise.all([
      Notification.countDocuments({ isActive: true }),
      
      Notification.countDocuments({ deliveryStatus: 'sent' }),
      
      Notification.countDocuments({ deliveryStatus: 'delivered' }),
      
      Notification.countDocuments({ deliveryStatus: 'failed' }),
      
      Notification.countDocuments({ isScheduled: true, deliveryStatus: 'pending' }),
      
      Notification.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]),
      
      Notification.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]),
      
      Notification.aggregate([
        { $match: { isActive: true } },
        { $sort: { createdAt: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: 'recipient',
            foreignField: '_id',
            as: 'recipientInfo'
          }
        },
        {
          $project: {
            title: 1,
            type: 1,
            deliveryStatus: 1,
            createdAt: 1,
            'recipientInfo.name': 1,
            'recipientInfo.email': 1
          }
        }
      ])
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        overview: {
          total: totalNotifications,
          sent: sentCount,
          delivered: deliveredCount,
          failed: failedCount,
          scheduled: scheduledCount,
          successRate: totalNotifications > 0 
            ? Math.round(((sentCount + deliveredCount) / totalNotifications) * 100) 
            : 0
        },
        byType: byType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byPriority: byPriority.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        recentActivity
      }
    });
  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch notification stats'
    });
  }
};

/**
 * @desc    Get all device tokens (Admin)
 * @route   GET /api/v1/admin/notifications/devices
 * @access  Private (Admin)
 */
exports.getAllDeviceTokens = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    if (req.query.deviceType) {
      filter.deviceType = req.query.deviceType;
    }

    const [devices, total, activeCount, byDeviceType] = await Promise.all([
      DeviceToken.find(filter)
        .populate('user', 'name email avatar')
        .sort({ lastUsedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      
      DeviceToken.countDocuments(filter),
      
      DeviceToken.countDocuments({ isActive: true }),
      
      DeviceToken.aggregate([
        { $group: { _id: '$deviceType', count: { $sum: 1 } } }
      ])
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        devices,
        stats: {
          total,
          active: activeCount,
          inactive: total - activeCount,
          byDeviceType: byDeviceType.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {})
        },
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all device tokens error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch device tokens'
    });
  }
};

/**
 * @desc    Delete/Cancel scheduled notification (Admin)
 * @route   DELETE /api/v1/admin/notifications/:id
 * @access  Private (Admin)
 */
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Notification deleted successfully',
      data: { notification }
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete notification'
    });
  }
};

/**
 * @desc    Retry failed notification (Admin)
 * @route   POST /api/v1/admin/notifications/:id/retry
 * @access  Private (Admin)
 */
exports.retryFailedNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found'
      });
    }

    if (notification.deliveryStatus !== 'failed') {
      return res.status(400).json({
        status: 'error',
        message: 'Only failed notifications can be retried'
      });
    }

    await notification.retry();

    const result = await notificationService.sendToUser(notification.recipient, {
      sentBy: notification.sentBy,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      priority: notification.priority,
      data: Object.fromEntries(notification.data),
      imageUrl: notification.imageUrl
    });

    res.status(200).json({
      status: 'success',
      message: 'Notification retry initiated',
      data: result
    });
  } catch (error) {
    console.error('Retry notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retry notification'
    });
  }
};