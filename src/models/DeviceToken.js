// src/models/DeviceToken.js
const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // FCM Token
  token: {
    type: String,
    required: [true, 'Device token is required'],
    unique: true,
    trim: true,
    index: true
  },
  
  // Device Info
  deviceType: {
    type: String,
    enum: ['android', 'ios', 'web'],
    required: true
  },
  
  deviceId: {
    type: String,
    trim: true
  },
  
  deviceName: {
    type: String,
    trim: true
  },
  
  deviceModel: {
    type: String,
    trim: true
  },
  
  osVersion: {
    type: String,
    trim: true
  },
  
  appVersion: {
    type: String,
    trim: true
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Tracking
  lastUsedAt: {
    type: Date,
    default: Date.now
  },
  
  registeredAt: {
    type: Date,
    default: Date.now
  },
  
  // Error tracking
  failureCount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  lastFailureAt: {
    type: Date
  },
  
  lastFailureReason: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// ──────────────────────────────
// Indexes for Performance
// ──────────────────────────────
deviceTokenSchema.index({ user: 1, isActive: 1 });
deviceTokenSchema.index({ token: 1, isActive: 1 });
deviceTokenSchema.index({ lastUsedAt: 1 });

// ──────────────────────────────
// Static Methods
// ──────────────────────────────

// Get active tokens for a user
deviceTokenSchema.statics.getActiveTokens = async function(userId) {
  return await this.find({
    user: userId,
    isActive: true
  }).select('token deviceType');
};

// Register or update token
deviceTokenSchema.statics.registerToken = async function(userId, tokenData) {
  const { token, deviceType, deviceId, deviceName, deviceModel, osVersion, appVersion } = tokenData;
  
  // Check if token already exists
  let deviceToken = await this.findOne({ token });
  
  if (deviceToken) {
    // Update existing token
    deviceToken.user = userId;
    deviceToken.deviceType = deviceType || deviceToken.deviceType;
    deviceToken.deviceId = deviceId || deviceToken.deviceId;
    deviceToken.deviceName = deviceName || deviceToken.deviceName;
    deviceToken.deviceModel = deviceModel || deviceToken.deviceModel;
    deviceToken.osVersion = osVersion || deviceToken.osVersion;
    deviceToken.appVersion = appVersion || deviceToken.appVersion;
    deviceToken.isActive = true;
    deviceToken.lastUsedAt = new Date();
    deviceToken.failureCount = 0;
    deviceToken.lastFailureAt = undefined;
    deviceToken.lastFailureReason = undefined;
  } else {
    // Create new token
    deviceToken = new this({
      user: userId,
      token,
      deviceType,
      deviceId,
      deviceName,
      deviceModel,
      osVersion,
      appVersion
    });
  }
  
  return await deviceToken.save();
};

// Deactivate token (on logout or uninstall)
deviceTokenSchema.statics.deactivateToken = async function(token) {
  return await this.findOneAndUpdate(
    { token },
    { isActive: false },
    { new: true }
  );
};

// Mark token as failed
deviceTokenSchema.statics.markAsFailed = async function(token, reason) {
  const deviceToken = await this.findOne({ token });
  
  if (deviceToken) {
    deviceToken.failureCount += 1;
    deviceToken.lastFailureAt = new Date();
    deviceToken.lastFailureReason = reason;
    
    // Deactivate if too many failures
    if (deviceToken.failureCount >= 5) {
      deviceToken.isActive = false;
    }
    
    return await deviceToken.save();
  }
  
  return null;
};

// Clean up old inactive tokens
deviceTokenSchema.statics.cleanupOldTokens = async function(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return await this.deleteMany({
    isActive: false,
    lastUsedAt: { $lt: cutoffDate }
  });
};

// ──────────────────────────────
// Instance Methods
// ──────────────────────────────

// Update last used timestamp
deviceTokenSchema.methods.updateLastUsed = async function() {
  this.lastUsedAt = new Date();
  return await this.save();
};

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);