// src/controllers/authController.js
const User = require('../models/User');
const LoginHistory = require('../models/LoginHistory');
const { validationResult } = require('express-validator');
const { getClientIp } = require('../services/ipAuthService');
const { getDeviceInfo } = require('../services/deviceService');
const { getLocationFromIp } = require('../services/locationService');

// Helper: Format login info for response
const formatLoginInfo = (ip, device) => `${ip} · ${device.substring(0, 50)}${device.length > 50 ? '...' : ''}`;




/**
 * @desc    Flexible Registration (with optional role parameter)
 * @route   POST /api/v1/auth/register-with-role
 * @access  Public (but role assignment should be protected in production)
 * @note    In production, add authorization check for role assignment
 */
exports.registerWithRole = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ status: 'error', errors: errors.array() });
  }

  try {
    const { name, email, phone, password, role } = req.body;

    // Validate role (optional, defaults to 'user')
    const allowedRoles = ['user', 'admin'];
    const userRole = role && allowedRoles.includes(role) ? role : 'user';

    // SECURITY WARNING: In production, you should verify authorization 
    // before allowing 'admin' role assignment. Example:
    // if (userRole === 'admin' && req.body.adminSecret !== process.env.ADMIN_SECRET) {
    //   return res.status(403).json({ status: 'error', message: 'Unauthorized admin creation' });
    // }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User already exists with this email or phone'
      });
    }

    // Capture client data for tracking
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const device = getDeviceInfo(userAgent);
    const location = await getLocationFromIp(ip);

    // Create user with specified role
    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: userRole,
      registeredIp: ip,
      registeredDevice: device,
      ...(location && {
        location: {
          country: location.country || null,
          state: location.state || null,
          city: location.city || null,
          pincode: location.pincode || null,
          formattedAddress: location.formattedAddress || null,
          lat: location.lat || null,
          lng: location.lng || null
        }
      })
    });

    // Save registration as first login history
    await LoginHistory.create({
      user: user._id,
      ip,
      device,
      userAgent,
      location: location ? {
        country: location.country,
        state: location.state,
        city: location.city,
        pincode: location.pincode,
        formattedAddress: location.formattedAddress,
        lat: location.lat,
        lng: location.lng
      } : null,
      loginAt: new Date()
    });

    const token = user.generateAuthToken();

    res.status(201).json({
      status: 'success',
      message: `${userRole === 'admin' ? 'Admin' : 'User'} account created successfully!`,
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
    console.error('Register With Role Error:', error);
    next(error);
  }
};



/**
 * @desc    Register new user + track IP, Device & Location
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
exports.register = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ status: 'error', errors: errors.array() });
  }

  try {
    const { name, email, phone, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User already exists with this email or phone'
      });
    }

    // Capture client data
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const device = getDeviceInfo(userAgent);
    const location = await getLocationFromIp(ip);

    // Create user with tracking
    const user = await User.create({
      name,
      email,
      phone,
      password,
      registeredIp: ip,
      registeredDevice: device,
      ...(location && {
        location: {
          country: location.country || null,
          state: location.state || null,
          city: location.city || null,
          pincode: location.pincode || null,
          formattedAddress: location.formattedAddress || null,
          lat: location.lat || null,
          lng: location.lng || null
        }
      })
    });

    // Save registration as first login
    await LoginHistory.create({
      user: user._id,
      ip,
      device,
      userAgent,
      location: location ? {
        country: location.country,
        state: location.state,
        city: location.city,
        pincode: location.pincode,
        formattedAddress: location.formattedAddress,
        lat: location.lat,
        lng: location.lng
      } : null,
      loginAt: new Date()
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
    console.error('Register Error:', error);
    next(error);
  }
};

/**
 * @desc    Login user + update last login + save full history
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ status: 'error', errors: errors.array() });
  }

  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password)) || !user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials or account deactivated'
      });
    }

    // Capture login data
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const device = getDeviceInfo(userAgent);
    const location = await getLocationFromIp(ip);

    // Update user's last login
    user.lastIp = ip;
    user.lastDevice = device;
    user.lastLoginAt = new Date();
    if (location) {
      user.lastLocation = {
        country: location.country || null,
        state: location.state || null,
        city: location.city || null,
        pincode: location.pincode || null,
        formattedAddress: location.formattedAddress || null,
        lat: location.lat || null,
        lng: location.lng || null
      };
    }
    await user.save({ validateBeforeSave: false });

    // Save full login history
    await LoginHistory.create({
      user: user._id,
      ip,
      device,
      userAgent,
      location: location ? {
        country: location.country,
        state: location.state,
        city: location.city,
        pincode: location.pincode,
        formattedAddress: location.formattedAddress,
        lat: location.lat,
        lng: location.lng
      } : null
    });

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
    console.error('Login Error:', error);
    next(error);
  }
};

/**
 * @desc    Get current user profile with tracking info
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      status: 'success',
      message: 'Profile fetched',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          registeredIp: user.registeredIp || 'Unknown',
          registeredDevice: user.registeredDevice || 'Unknown',
          lastLoginAt: user.lastLoginAt || null,
          lastLoginFrom: user.lastIp
            ? formatLoginInfo(user.lastIp, user.lastDevice || 'Unknown')
            : 'Never logged in',
          lastLocation: user.lastLocation || null
        }
      }
    });
  } catch (error) {
    console.error('Get Me Error:', error);
    next(error);
  }
};

/**
 * @desc    Update profile
 * @route   PUT /api/v1/auth/update-profile
 * @access  Private
 */
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

/**
 * @desc    Register Admin (protected by secret)
 * @route   POST /api/v1/auth/register-admin
 * @access  Public (with secret)
 */
exports.registerAdmin = async (req, res, next) => {
  try {
    const { name, email, phone, password, secret } = req.body;

    if (secret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({
        status: 'error',
        message: 'Invalid admin secret key'
      });
    }

    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      return res.status(400).json({ status: 'error', message: 'Admin already exists' });
    }

    const admin = await User.create({
      name, email, phone, password, role: 'admin',
      registeredIp: getClientIp(req),
      registeredDevice: getDeviceInfo(req.headers['user-agent'] || '')
    });

    const token = admin.generateAuthToken();

    res.status(201).json({
      status: 'success',
      message: 'Admin created successfully',
      data: { admin: { id: admin._id, name: admin.name, role: 'admin' }, token }
    });
  } catch (error) {
    next(error);
  }
};