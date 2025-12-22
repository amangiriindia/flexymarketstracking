// src/controllers/notificationController.js
const Notification = require('../models/Notification');
const DeviceToken = require('../models/DeviceToken');
const notificationService = require('../services/notificationService');
const mongoose = require('mongoose');

/**
 * @desc    Register/Update device token
 * @route   POST /api/v1/notifications/register-token
 * @access  Private
 */
exports.registerDeviceToken = async (req, res) => {
  try {
    const { token, deviceType, deviceId, deviceName, deviceModel, osVersion, appVersion } = req.body;

    if (!token || !deviceType) {
      return res.status(400).json({
        status: 'error',
        message: 'Token and deviceType are required'
      });
    }

    const deviceToken = await DeviceToken.registerToken(req.user.id, {
      token,
      deviceType,
      deviceId,
      deviceName,
      deviceModel,
      osVersion,
      appVersion
    });

    res.status(200).json({
      status: 'success',
      message: 'Device token registered successfully',
      data: { deviceToken }
    });
  } catch (error) {
    console.error('Register device token error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to register device token'
    });
  }
};

/**
 * @desc    Deactivate device token (logout/uninstall)
 * @route   POST /api/v1/notifications/deactivate-token
 * @access  Private
 */
exports.deactivateDeviceToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        status: 'error',
        message: 'Token is required'
      });
    }

    await DeviceToken.deactivateToken(token);

    res.status(200).json({
      status: 'success',
      message: 'Device token deactivated successfully'
    });
  } catch (error) {
    console.error('Deactivate token error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to deactivate token'
    });
  }
};

/**
 * @desc    Get user's notifications
 * @route   GET /api/v1/notifications
 * @access  Private
 */
exports.getMyNotifications = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(10, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = {
      recipient: req.user.id,
      isActive: true
    };

    // Filter by type if provided
    if (req.query.type) {
      filter.type = req.query.type;
    }

    // Filter by status if provided
    if (req.query.status) {
      filter.deliveryStatus = req.query.status;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .populate('sentBy', 'name avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      
      Notification.countDocuments(filter),
      
      Notification.getUnreadCount(req.user.id)
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        notifications,
        unreadCount,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch notifications'
    });
  }
};

/**
 * @desc    Get single notification
 * @route   GET /api/v1/notifications/:id
 * @access  Private
 */
exports.getNotificationById = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user.id
    }).populate('sentBy', 'name avatar email');

    if (!notification) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: { notification }
    });
  } catch (error) {
    console.error('Get notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch notification'
    });
  }
};

/**
 * @desc    Mark notification as read
 * @route   PATCH /api/v1/notifications/:id/read
 * @access  Private
 */
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.markAsRead(req.params.id, req.user.id);

    if (!notification) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Notification marked as read',
      data: { notification }
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark notification as read'
    });
  }
};

/**
 * @desc    Mark all notifications as read
 * @route   PATCH /api/v1/notifications/read-all
 * @access  Private
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.markAllAsRead(req.user.id);

    res.status(200).json({
      status: 'success',
      message: 'All notifications marked as read',
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark all notifications as read'
    });
  }
};

/**
 * @desc    Delete notification
 * @route   DELETE /api/v1/notifications/:id
 * @access  Private
 */
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.user.id
      },
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
      message: 'Notification deleted successfully'
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
 * @desc    Get notification statistics
 * @route   GET /api/v1/notifications/stats
 * @access  Private
 */
exports.getNotificationStats = async (req, res) => {
  try {
    const [total, unread, byType, byPriority] = await Promise.all([
      Notification.countDocuments({
        recipient: req.user.id,
        isActive: true
      }),
      
      Notification.getUnreadCount(req.user.id),
      
      Notification.aggregate([
        {
          $match: {
            recipient: new mongoose.Types.ObjectId(req.user.id),
            isActive: true
          }
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 }
          }
        }
      ]),
      
      Notification.aggregate([
        {
          $match: {
            recipient: new mongoose.Types.ObjectId(req.user.id),
            isActive: true
          }
        },
        {
          $group: {
            _id: '$priority',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        total,
        unread,
        read: total - unread,
        byType: byType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byPriority: byPriority.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
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
 * @desc    Get user's device tokens
 * @route   GET /api/v1/notifications/devices
 * @access  Private
 */
exports.getMyDevices = async (req, res) => {
  try {
    const devices = await DeviceToken.find({
      user: req.user.id
    }).sort({ lastUsedAt: -1 });

    res.status(200).json({
      status: 'success',
      data: { devices }
    });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch devices'
    });
  }
};