// src/models/LoginHistory.js
const mongoose = require('mongoose');

const loginHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ip: String,
  device: String,
  location: {
    country: String,
    state: String,
    city: String,
    pincode: String,
    formattedAddress: String,
    lat: Number,
    lng: Number
  },
  userAgent: String,
  loginAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('LoginHistory', loginHistorySchema);