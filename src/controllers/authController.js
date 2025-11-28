// src/controllers/authController.js
const User = require('../models/User');
const { validationResult } = require('express-validator');
const {
  getClientIp,
  getDeviceInfo,
  formatLoginInfo
} = require('../services/ipAuthService');

// Register new user + track IP & device
exports.register = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ status: 'error', errors: errors.array() });
  }

  try {
    const { name, email, phone, password } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User already exists with this email or phone'
      });
    }

    const ip = getClientIp(req);
    const device = getDeviceInfo(req);

    const user = await User.create({
      name,
      email,
      phone,
      password,
      registeredIp: ip,
      registeredDevice: device
    });

    const token = user.generateAuthToken();

    res.status(201).json({
      status: 'success',
      message: 'Account created successfully!',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          role: user.role,
          registeredFrom: formatLoginInfo(ip, device)
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

// Login user + update last login
exports.login = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ status: 'error', errors: errors.array() });

  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password)) || !user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials or account deactivated'
      });
    }

    const ip = getClientIp(req);
    const device = getDeviceInfo(req);

    // Update login tracking
    user.lastIp = ip;
    user.lastDevice = device;
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const token = user.generateAuthToken();

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          role: user.role,
          lastLogin: user.lastLoginAt,
          lastLoginFrom: formatLoginInfo(ip, device)
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get logged-in user profile
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          role: user.role,
          registeredIp: user.registeredIp || 'Unknown',
          registeredDevice: user.registeredDevice || 'Unknown',
          lastLoginAt: user.lastLoginAt || null,
          lastLoginFrom: user.lastIp 
            ? formatLoginInfo(user.lastIp, user.lastDevice || 'Unknown Device')
            : 'Never logged in'
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update profile
exports.updateProfile = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ status: 'error', errors: errors.array() });

  try {
    const updates = (({ name, phone, avatar }) => ({ name, phone, avatar }))(req.body);

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

// src/controllers/authController.js → Add
exports.registerAdmin = async (req, res) => {
  // Only allow from trusted source or secret key
  const { secret } = req.body;
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ status: 'error', message: 'Invalid admin secret' });
  }

  const user = await User.create({ ...req.body, role: 'admin' });
  const token = user.generateAuthToken();

  res.status(201).json({
    status: 'success',
    message: 'Admin created',
    data: { user: { id: user._id, name: user.name, role: 'admin' }, token }
  });
};