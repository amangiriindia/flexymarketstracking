// src/models/Follow.js
const mongoose = require('mongoose');

const followSchema = new mongoose.Schema({
  follower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  following: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted'],
    default: 'accepted' // Change to 'pending' later for private accounts
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicates + fast lookup
followSchema.index({ follower: 1, following: 1 }, { unique: true });

// Index for feed queries
followSchema.index({ following: 1 });

module.exports = mongoose.model('Follow', followSchema);