// src/models/VoiceCall.js
const mongoose = require('mongoose');

const voiceCallSchema = new mongoose.Schema({
  callId: {
    type: String,
    required: true
  },
  channelName: {
    type: String,
    required: true
  },
  caller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  callerPhone: {
    type: String,
    required: true
  },
  receiverPhone: {
    type: String,
    required: true
  },
  callType: {
    type: String,
    enum: ['admin_to_user', 'user_to_user'],
    default: 'user_to_user'
  },
  status: {
    type: String,
    enum: ['initiated', 'ringing', 'answered', 'ended', 'missed', 'rejected', 'failed'],
    default: 'initiated'
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },
  agoraToken: {
    type: String
  },
  recordingUrl: {
    type: String
  }
}, {
  timestamps: true
});

// Calculate duration before saving
voiceCallSchema.pre('save', function(next) {
  if (this.endTime && this.startTime) {
    this.duration = Math.floor((this.endTime - this.startTime) / 1000);
  }
  next();
});

// Indexes
voiceCallSchema.index({ caller: 1, createdAt: -1 });
voiceCallSchema.index({ receiver: 1, createdAt: -1 });
voiceCallSchema.index({ status: 1 });

module.exports = mongoose.model('VoiceCall', voiceCallSchema);