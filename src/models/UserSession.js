// src/models/UserSession.js
const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sessionToken: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Device Information
  device: {
    type: {
      type: String, // 'mobile', 'tablet', 'desktop', 'unknown'
      default: 'unknown'
    },
    name: String, // 'iPhone 13', 'Samsung Galaxy S21', etc.
    os: String, // 'iOS 15.0', 'Android 12', 'Windows 11'
    osVersion: String,
    browser: String, // 'Chrome', 'Safari', 'App'
    browserVersion: String,
    model: String,
    manufacturer: String,
    appVersion: String // Your app version
  },
  
  // Network & Connection
  ip: {
    type: String,
    required: true
  },
  userAgent: String,
  
  // Location Information
  location: {
    country: String,
    countryCode: String, // 'IN', 'US'
    state: String,
    city: String,
    pincode: String,
    formattedAddress: String,
    timezone: String,
    lat: Number,
    lng: Number,
    accuracy: Number // GPS accuracy in meters
  },
  
  // Session Timing
  startTime: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastActivityTime: {
    type: Date,
    default: Date.now
  },
  endTime: Date,
  
  // Session Status
  status: {
    type: String,
    enum: ['active', 'idle', 'expired', 'logged_out'],
    default: 'active',
    index: true
  },
  
  // Session Metrics
  totalScreens: {
    type: Number,
    default: 0
  },
  totalDuration: {
    type: Number, // in seconds
    default: 0
  },
  
  // Additional Metadata
  fcmToken: String, // For push notifications
  language: String,
  referrer: String,
  
  // Flags
  isFirstSession: {
    type: Boolean,
    default: false
  },
  
}, {
  timestamps: true
});

// Indexes for better query performance
userSessionSchema.index({ user: 1, startTime: -1 });
userSessionSchema.index({ status: 1, lastActivityTime: -1 });
userSessionSchema.index({ 'location.country': 1, 'location.city': 1 });
userSessionSchema.index({ 'device.type': 1, 'device.os': 1 });

// Virtual for session duration
userSessionSchema.virtual('duration').get(function() {
  if (this.endTime) {
    return Math.floor((this.endTime - this.startTime) / 1000); // seconds
  }
  return Math.floor((this.lastActivityTime - this.startTime) / 1000);
});

// Method to update last activity
userSessionSchema.methods.updateActivity = async function() {
  this.lastActivityTime = new Date();
  this.status = 'active';
  await this.save();
};

// Method to end session
userSessionSchema.methods.endSession = async function() {
  this.endTime = new Date();
  this.status = 'logged_out';
  this.totalDuration = Math.floor((this.endTime - this.startTime) / 1000);
  await this.save();
};

// Auto-expire idle sessions (30 minutes of inactivity)
userSessionSchema.methods.checkExpiry = async function() {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  if (this.status === 'active' && this.lastActivityTime < thirtyMinutesAgo) {
    this.status = 'expired';
    this.endTime = this.lastActivityTime;
    this.totalDuration = Math.floor((this.endTime - this.startTime) / 1000);
    await this.save();
  }
};

userSessionSchema.set('toJSON', { virtuals: true });
userSessionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('UserSession', userSessionSchema);