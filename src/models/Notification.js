// src/models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Sender Info
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Recipient Info
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Notification Content
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  
  body: {
    type: String,
    required: [true, 'Notification body is required'],
    trim: true,
    maxlength: [500, 'Body cannot exceed 500 characters']
  },
  
  // Notification Type
  type: {
    type: String,
    enum: ['general', 'post', 'comment', 'like', 'follow', 'admin', 'system'],
    default: 'general',
    required: true
  },
  
  // Priority Level
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Additional Data (for deep linking)
  data: {
    type: Map,
    of: String,
    default: {}
  },
  
  // Image/Icon URL (optional)
  imageUrl: {
    type: String,
    trim: true
  },
  
  // Delivery Status
  deliveryStatus: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed', 'read'],
    default: 'pending',
    index: true
  },
  
  // Firebase Response
  firebaseMessageId: {
    type: String,
    trim: true
  },
  
  firebaseResponse: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Error Tracking
  errorMessage: {
    type: String,
    trim: true
  },
  
  retryCount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Timestamps
  sentAt: {
    type: Date
  },
  
  deliveredAt: {
    type: Date
  },
  
  readAt: {
    type: Date
  },
  
  // Scheduling
  scheduledFor: {
    type: Date,
    index: true
  },
  
  isScheduled: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Expiration
  expiresAt: {
    type: Date
  },
  
  // Action Buttons (optional)
  actions: [{
    label: {
      type: String,
      required: true,
      maxlength: 30
    },
    action: {
      type: String,
      required: true
    },
    data: {
      type: Map,
      of: String
    }
  }],
  
  // Tracking
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// ──────────────────────────────
// Indexes for Performance
// ──────────────────────────────
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ sentBy: 1, createdAt: -1 });
notificationSchema.index({ deliveryStatus: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ scheduledFor: 1, isScheduled: 1 });
notificationSchema.index({ expiresAt: 1 });

// ──────────────────────────────
// Pre-save Middleware
// ──────────────────────────────
notificationSchema.pre('save', function(next) {
  // Auto-set sentAt when status changes to sent
  if (this.isModified('deliveryStatus') && this.deliveryStatus === 'sent' && !this.sentAt) {
    this.sentAt = new Date();
  }
  
  // Auto-set deliveredAt when status changes to delivered
  if (this.isModified('deliveryStatus') && this.deliveryStatus === 'delivered' && !this.deliveredAt) {
    this.deliveredAt = new Date();
  }
  
  // Auto-set readAt when status changes to read
  if (this.isModified('deliveryStatus') && this.deliveryStatus === 'read' && !this.readAt) {
    this.readAt = new Date();
  }
  
  next();
});

// ──────────────────────────────
// Static Methods
// ──────────────────────────────

// Get unread count for a user
notificationSchema.statics.getUnreadCount = async function(userId) {
  return await this.countDocuments({
    recipient: userId,
    deliveryStatus: { $in: ['sent', 'delivered'] },
    isActive: true
  });
};

// Mark notification as read
notificationSchema.statics.markAsRead = async function(notificationId, userId) {
  return await this.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { 
      deliveryStatus: 'read',
      readAt: new Date()
    },
    { new: true }
  );
};

// Mark all as read for a user
notificationSchema.statics.markAllAsRead = async function(userId) {
  return await this.updateMany(
    { 
      recipient: userId, 
      deliveryStatus: { $in: ['sent', 'delivered'] },
      isActive: true
    },
    { 
      deliveryStatus: 'read',
      readAt: new Date()
    }
  );
};

// Clean up expired notifications
notificationSchema.statics.cleanupExpired = async function() {
  return await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
};

// ──────────────────────────────
// Instance Methods
// ──────────────────────────────

// Retry sending failed notification
notificationSchema.methods.retry = async function() {
  this.retryCount += 1;
  this.deliveryStatus = 'pending';
  this.errorMessage = undefined;
  return await this.save();
};

// ──────────────────────────────
// Virtuals
// ──────────────────────────────
notificationSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return this.expiresAt < new Date();
});

notificationSchema.virtual('isRead').get(function() {
  return this.deliveryStatus === 'read';
});

// ──────────────────────────────
// JSON Output Settings
// ──────────────────────────────
notificationSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    // Convert Map to Object for JSON serialization
    if (ret.data && ret.data instanceof Map) {
      ret.data = Object.fromEntries(ret.data);
    }
    // Also handle the actions array if it contains Maps
    if (ret.actions && Array.isArray(ret.actions)) {
      ret.actions = ret.actions.map(action => {
        if (action.data && action.data instanceof Map) {
          return {
            ...action,
            data: Object.fromEntries(action.data)
          };
        }
        return action;
      });
    }
    return ret;
  }
});
notificationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Notification', notificationSchema);