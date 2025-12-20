// src/models/ScreenActivity.js
const mongoose = require('mongoose');

const screenActivitySchema = new mongoose.Schema({
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserSession',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  

  screenName: {
  type: String,
  required: true,
  index: true,
  trim: true
},
  
  screenRoute: String, 
  screenTitle: String,
  
  // Navigation Flow
  previousScreen: String,
  nextScreen: String,
  navigationMethod: {
    type: String,
  },
  
  // Timing
  enteredAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  exitedAt: Date,
  duration: {
    type: Number, // in seconds
    default: 0
  },
  
  // User Actions on Screen
  actions: [{
    actionType: {
      type: String,
      
    },
    actionTarget: String, // button_name, element_id
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: mongoose.Schema.Types.Mixed
  }],
  
  // Scroll Depth (for feed/list screens)
  scrollDepth: {
    type: Number, // percentage (0-100)
    default: 0
  },
  
  // Device State During Visit
  deviceState: {
    batteryLevel: Number,
    networkType: String, // 'wifi', '4g', '5g', '3g', 'offline'
    orientation: String, // 'portrait', 'landscape'
    screenBrightness: Number
  },
  
  // Location (can change during session)
  location: {
    country: String,
    state: String,
    city: String,
    lat: Number,
    lng: Number
  },
  
  // Error Tracking
  errors: [{
    errorType: String,
    errorMessage: String,
    timestamp: Date
  }],
  
  // Performance Metrics
  loadTime: Number, // Screen load time in ms
  apiCalls: Number, // Number of API calls made
  
  // Additional Context
  referrer: String,
  metadata: mongoose.Schema.Types.Mixed // Any additional data
  
}, {
  timestamps: true
});

// Compound indexes for common queries
screenActivitySchema.index({ user: 1, enteredAt: -1 });
screenActivitySchema.index({ session: 1, enteredAt: 1 });
screenActivitySchema.index({ screenName: 1, enteredAt: -1 });
screenActivitySchema.index({ user: 1, screenName: 1, enteredAt: -1 });

// Method to calculate and update duration
screenActivitySchema.methods.exitScreen = async function(nextScreen) {
  this.exitedAt = new Date();
  this.duration = Math.floor((this.exitedAt - this.enteredAt) / 1000);
  this.nextScreen = nextScreen;
  await this.save();
};

// Method to add action
screenActivitySchema.methods.addAction = async function(actionType, actionTarget, metadata = {}) {
  this.actions.push({
    actionType,
    actionTarget,
    timestamp: new Date(),
    metadata
  });
  await this.save();
};

// Static method to get screen flow (navigation path)
screenActivitySchema.statics.getScreenFlow = async function(sessionId) {
  const activities = await this.find({ session: sessionId })
    .sort({ enteredAt: 1 })
    .select('screenName enteredAt exitedAt duration')
    .lean();
  
  return activities.map((act, index) => ({
    step: index + 1,
    screen: act.screenName,
    enteredAt: act.enteredAt,
    exitedAt: act.exitedAt,
    duration: act.duration,
    nextScreen: activities[index + 1]?.screenName || null
  }));
};

// Static method to get popular screen transitions
screenActivitySchema.statics.getPopularTransitions = async function(fromDate, toDate) {
  return this.aggregate([
    {
      $match: {
        enteredAt: { $gte: fromDate, $lte: toDate },
        nextScreen: { $ne: null }
      }
    },
    {
      $group: {
        _id: {
          from: '$screenName',
          to: '$nextScreen'
        },
        count: { $sum: 1 },
        avgDuration: { $avg: '$duration' }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: 50
    }
  ]);
};

module.exports = mongoose.model('ScreenActivity', screenActivitySchema);