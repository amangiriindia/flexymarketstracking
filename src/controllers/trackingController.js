// src/controllers/trackingController.js
const UserSession = require('../models/UserSession');
const ScreenActivity = require('../models/ScreenActivity');
const crypto = require('crypto');

/**
 * @desc    Create a new user session (called after login)
 * @route   POST /api/v1/tracking/session/start
 * @access  Private
 */
exports.startSession = async (req, res) => {
  try {
    const {
      device,
      location,
      fcmToken,
      language,
      referrer
    } = req.body;

    // Check if user has any active session
    const existingSession = await UserSession.findOne({
      user: req.user.id,
      status: 'active'
    });

    // If exists, mark it as expired
    if (existingSession) {
      await existingSession.endSession();
    }

    // Check if this is user's first session
    const sessionCount = await UserSession.countDocuments({ user: req.user.id });

    // Generate unique session token
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // Create new session
    const session = await UserSession.create({
      user: req.user.id,
      sessionToken,
      device: {
        type: device?.type || 'unknown',
        name: device?.name,
        os: device?.os,
        osVersion: device?.osVersion,
        browser: device?.browser,
        browserVersion: device?.browserVersion,
        model: device?.model,
        manufacturer: device?.manufacturer,
        appVersion: device?.appVersion
      },
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      location: location ? {
        country: location.country,
        countryCode: location.countryCode,
        state: location.state,
        city: location.city,
        pincode: location.pincode,
        formattedAddress: location.formattedAddress,
        timezone: location.timezone,
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy
      } : null,
      fcmToken,
      language: language || 'en',
      referrer,
      isFirstSession: sessionCount === 0
    });

    // Create initial screen activity (login screen)
    await ScreenActivity.create({
      session: session._id,
      user: req.user.id,
      screenName: 'login',
      screenRoute: '/login',
      screenTitle: 'Login',
      location: location ? {
        country: location.country,
        state: location.state,
        city: location.city,
        lat: location.lat,
        lng: location.lng
      } : null
    });

    await session.updateActivity();

    res.status(201).json({
      status: 'success',
      message: 'Session started successfully',
      data: {
        sessionId: session._id,
        sessionToken: session.sessionToken,
        isFirstSession: session.isFirstSession
      }
    });
  } catch (error) {
    console.error('Start Session Error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to start session',
      error: error.message 
    });
  }
};

/**
 * @desc    Track screen visit
 * @route   POST /api/v1/tracking/screen
 * @access  Private
 */
exports.trackScreen = async (req, res) => {
  try {
    const {
      sessionId,
      screenName,
      screenRoute,
      screenTitle,
      previousScreen,
      navigationMethod,
      deviceState,
      location,
      loadTime,
      referrer,
      metadata
    } = req.body;

    // Verify session exists and is active
    const session = await UserSession.findOne({
      _id: sessionId,
      user: req.user.id,
      status: 'active'
    });

    if (!session) {
      return res.status(404).json({
        status: 'error',
        message: 'Active session not found'
      });
    }

    // Exit previous screen if exists
    if (previousScreen) {
      const prevActivity = await ScreenActivity.findOne({
        session: sessionId,
        user: req.user.id,
        screenName: previousScreen,
        exitedAt: null
      }).sort({ enteredAt: -1 });

      if (prevActivity) {
        await prevActivity.exitScreen(screenName);
      }
    }

    // Create new screen activity
    const activity = await ScreenActivity.create({
      session: sessionId,
      user: req.user.id,
      screenName,
      screenRoute,
      screenTitle,
      previousScreen,
      navigationMethod: navigationMethod || 'tap',
      deviceState: deviceState ? {
        batteryLevel: deviceState.batteryLevel,
        networkType: deviceState.networkType,
        orientation: deviceState.orientation,
        screenBrightness: deviceState.screenBrightness
      } : null,
      location: location ? {
        country: location.country,
        state: location.state,
        city: location.city,
        lat: location.lat,
        lng: location.lng
      } : null,
      loadTime,
      referrer,
      metadata
    });

    // Update session
    session.totalScreens += 1;
    await session.updateActivity();

    res.status(201).json({
      status: 'success',
      message: 'Screen tracked successfully',
      data: {
        activityId: activity._id,
        screenName: activity.screenName
      }
    });
  } catch (error) {
    console.error('Track Screen Error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to track screen',
      error: error.message 
    });
  }
};

/**
 * @desc    Update screen activity (scroll, actions, etc.)
 * @route   PUT /api/v1/tracking/screen/:activityId
 * @access  Private
 */
exports.updateScreenActivity = async (req, res) => {
  try {
    const { activityId } = req.params;
    const { scrollDepth, action, apiCalls } = req.body;

    const activity = await ScreenActivity.findOne({
      _id: activityId,
      user: req.user.id
    });

    if (!activity) {
      return res.status(404).json({
        status: 'error',
        message: 'Activity not found'
      });
    }

    // Update scroll depth
    if (scrollDepth !== undefined) {
      activity.scrollDepth = Math.max(activity.scrollDepth, scrollDepth);
    }

    // Add action
    if (action) {
      await activity.addAction(
        action.type,
        action.target,
        action.metadata
      );
    }

    // Update API calls count
    if (apiCalls !== undefined) {
      activity.apiCalls = (activity.apiCalls || 0) + apiCalls;
    }

    await activity.save();

    res.status(200).json({
      status: 'success',
      message: 'Activity updated'
    });
  } catch (error) {
    console.error('Update Activity Error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to update activity' 
    });
  }
};

/**
 * @desc    End current session
 * @route   POST /api/v1/tracking/session/end
 * @access  Private
 */
exports.endSession = async (req, res) => {
  try {
    const { sessionId } = req.body;

    const session = await UserSession.findOne({
      _id: sessionId,
      user: req.user.id,
      status: 'active'
    });

    if (!session) {
      return res.status(404).json({
        status: 'error',
        message: 'Active session not found'
      });
    }

    // Exit all open screens
    await ScreenActivity.updateMany(
      {
        session: sessionId,
        exitedAt: null
      },
      {
        $set: {
          exitedAt: new Date()
        }
      }
    );

    // Calculate durations for activities
    const activities = await ScreenActivity.find({
      session: sessionId,
      duration: 0
    });

    for (const activity of activities) {
      if (activity.exitedAt) {
        activity.duration = Math.floor((activity.exitedAt - activity.enteredAt) / 1000);
        await activity.save();
      }
    }

    // End session
    await session.endSession();

    res.status(200).json({
      status: 'success',
      message: 'Session ended successfully',
      data: {
        duration: session.totalDuration,
        screensVisited: session.totalScreens
      }
    });
  } catch (error) {
    console.error('End Session Error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to end session' 
    });
  }
};

/**
 * @desc    Get my current active session
 * @route   GET /api/v1/tracking/session/current
 * @access  Private
 */
exports.getCurrentSession = async (req, res) => {
  try {
    const session = await UserSession.findOne({
      user: req.user.id,
      status: 'active'
    }).lean();

    if (!session) {
      return res.status(404).json({
        status: 'error',
        message: 'No active session found'
      });
    }

    // Get current screen flow
    const screenFlow = await ScreenActivity.getScreenFlow(session._id);

    res.status(200).json({
      status: 'success',
      data: {
        session: {
          id: session._id,
          startTime: session.startTime,
          lastActivity: session.lastActivityTime,
          duration: Math.floor((new Date() - session.startTime) / 1000),
          totalScreens: session.totalScreens,
          device: session.device,
          location: session.location
        },
        screenFlow
      }
    });
  } catch (error) {
    console.error('Get Current Session Error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to fetch session' 
    });
  }
};

/**
 * @desc    Get my session history
 * @route   GET /api/v1/tracking/sessions
 * @access  Private
 */
exports.getMySessions = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(10, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      UserSession.find({ user: req.user.id })
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      UserSession.countDocuments({ user: req.user.id })
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        sessions: sessions.map(s => ({
          id: s._id,
          startTime: s.startTime,
          endTime: s.endTime,
          duration: s.totalDuration || Math.floor((s.lastActivityTime - s.startTime) / 1000),
          status: s.status,
          device: s.device,
          location: s.location,
          totalScreens: s.totalScreens
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get Sessions Error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to fetch sessions' 
    });
  }
};