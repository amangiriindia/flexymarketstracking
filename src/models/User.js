// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Please provide a phone number'],
    unique: true,
    match: [/^[0-9]{10,15}$/, 'Please provide a valid phone number']
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  avatar: {
    type: String,
    default: 'https://via.placeholder.com/150'
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  agoraUid: {
    type: Number,
    unique: true,
    sparse: true
  },

  // ──────────────────────────────
  // IP & Device Tracking (Added Here)
  // ──────────────────────────────
  registeredIp: {
    type: String,
    trim: true
  },
  registeredDevice: {
    type: String,
    trim: true
  },
  lastIp: {
    type: String,
    trim: true
  },
  lastDevice: {
    type: String,
    trim: true
  },
  lastLoginAt: {
    type: Date
  }
}, {
  timestamps: true
});

// ──────────────────────────────
// Password Hashing
// ──────────────────────────────
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ──────────────────────────────
// Instance Methods
// ──────────────────────────────
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Generate Agora UID
userSchema.pre('save', async function(next) {
  if (!this.agoraUid) {
    this.agoraUid = Math.floor(Math.random() * 1000000) + 1;
  }
  next();
});

// ──────────────────────────────
// Virtuals: Follow System
// ──────────────────────────────
userSchema.virtual('followersCount', {
  ref: 'Follow',
  localField: '_id',
  foreignField: 'following',
  count: true
});

userSchema.virtual('followingCount', {
  ref: 'Follow',
  localField: '_id',
  foreignField: 'follower',
  count: true
});

userSchema.virtual('followers', {
  ref: 'Follow',
  localField: '_id',
  foreignField: 'following'
});

userSchema.virtual('following', {
  ref: 'Follow',
  localField: '_id',
  foreignField: 'follower'
});

// ──────────────────────────────
// JSON Settings
// ──────────────────────────────
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);