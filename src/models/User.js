
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: [true, 'Please provide a username'],

  },
  name: {
    type: String,
    required: false, 
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
  },
  phone: {
    type: String,
  
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    select: false
  },
  avatar: {
    type: String,
    default: 'https://via.placeholder.com/150'
  },
  role: {
    type: String,
    enum: ['USER', 'ADMIN'],
    default: 'USER'
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
  registeredIp: { type: String, trim: true },
  registeredDevice: { type: String, trim: true },
  lastIp: { type: String, trim: true },
  lastDevice: { type: String, trim: true },
  lastLoginAt: { type: Date },
  location: {
    country: String,
    state: String,
    city: String,
    pincode: String,
    formattedAddress: String,
    lat: Number,
    lng: Number
  },
  lastLocation: {
    country: String,
    state: String,
    city: String,
    pincode: String,
    formattedAddress: String,
    lat: Number,
    lng: Number
  }
}, {
  timestamps: true
});

// Password Hashing
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance Methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { 
      id: this._id, 
      role: this.role,
      userData: {
        email: this.email,
        name: this.name,
        phone: this.phone
      }
    },
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

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);