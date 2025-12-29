// src/controllers/adminTrackingController.js
const UserSession = require('../models/UserSession');
const ScreenActivity = require('../models/ScreenActivity');
const User = require('../models/User');
const mongoose = require('mongoose');

/**
 * @desc    Get all active sessions (live users)
 * @route   GET /api/v1/admin/tracking/sessions/active
 * @access  Private/Admin
 */
exports.getActiveSessions = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    // Filters
    const filters = { status: 'active' };
    
    if (req.query.country) filters['location.country'] = req.query.country;
    if (req.query.city) filters['location.city'] = req.query.city;
    if (req.query.deviceType) filters['device.type'] = req.query.deviceType;
    if (req.query.os) filters['device.os'] = new RegExp(req.query.os, 'i');

    const [sessions, total] = await Promise.all([
      UserSession.find(filters)
        .populate('user', 'name email avatar')
        .sort({ lastActivityTime: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      UserSession.countDocuments(filters)
    ]);

    // Get current screen for each session
    const sessionsWithCurrentScreen = await Promise.all(
      sessions.map(async (session) => {
        const currentScreen = await ScreenActivity.findOne({
          session: session._id,
          exitedAt: null
        }).sort({ enteredAt: -1 }).lean();

        return {
          ...session,
          currentScreen: currentScreen ? {
            name: currentScreen.screenName,
            route: currentScreen.screenRoute,
            enteredAt: currentScreen.enteredAt,
            duration: Math.floor((new Date() - currentScreen.enteredAt) / 1000)
          } : null,
          sessionDuration: Math.floor((new Date() - session.startTime) / 1000)
        };
      })
    );

    res.status(200).json({
      status: 'success',
      data: {
        activeSessions: sessionsWithCurrentScreen,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        summary: {
          totalActiveUsers: total,
          timestamp: new Date()
        }
      }
    });
  } catch (error) {
    console.error('Get Active Sessions Error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to fetch active sessions' 
    });
  }
};

/**
 * @desc    Get all sessions with filters
 * @route   GET /api/v1/admin/tracking/sessions
 * @access  Private/Admin
 */
exports.getAllSessions = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    // Build filters
    const filters = {};
    
    if (req.query.userId) filters.user = req.query.userId;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.country) filters['location.country'] = req.query.country;
    if (req.query.city) filters['location.city'] = req.query.city;
    if (req.query.deviceType) filters['device.type'] = req.query.deviceType;
    if (req.query.os) filters['device.os'] = new RegExp(req.query.os, 'i');
    
    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      filters.startTime = {};
      if (req.query.startDate) {
        filters.startTime.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filters.startTime.$lte = new Date(req.query.endDate);
      }
    }

    const [sessions, total] = await Promise.all([
      UserSession.find(filters)
        .populate('user', 'name email avatar')
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      UserSession.countDocuments(filters)
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        sessions: sessions.map(s => ({
          id: s._id,
          user: s.user,
          device: s.device,
          location: s.location,
          startTime: s.startTime,
          endTime: s.endTime,
          lastActivityTime: s.lastActivityTime,
          status: s.status,
          duration: s.totalDuration || Math.floor((s.lastActivityTime - s.startTime) / 1000),
          totalScreens: s.totalScreens,
          isFirstSession: s.isFirstSession
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
    console.error('Get All Sessions Error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to fetch sessions' 
    });
  }
};

/**
 * @desc    Get detailed session with screen flow
 * @route   GET /api/v1/admin/tracking/sessions/:sessionId
 * @access  Private/Admin
 */
exports.getSessionDetail = async (req, res) => {
  try {
    const session = await UserSession.findById(req.params.sessionId)
      .populate('user', 'name email avatar phone')
      .lean();

    if (!session) {
      return res.status(404).json({
        status: 'error',
        message: 'Session not found'
      });
    }

    // Get all screen activities
    const activities = await ScreenActivity.find({ session: req.params.sessionId })
      .sort({ enteredAt: 1 })
      .lean();

    // Build screen flow with transitions
    const screenFlow = activities.map((act, index) => ({
      step: index + 1,
      screenName: act.screenName,
      screenRoute: act.screenRoute,
      enteredAt: act.enteredAt,
      exitedAt: act.exitedAt,
      duration: act.duration,
      navigationMethod: act.navigationMethod,
      previousScreen: act.previousScreen,
      nextScreen: act.nextScreen || activities[index + 1]?.screenName,
      actions: act.actions?.length || 0,
      scrollDepth: act.scrollDepth,
      loadTime: act.loadTime,
      deviceState: act.deviceState,
      location: act.location
    }));

    // Calculate session metrics
    const metrics = {
      totalScreens: activities.length,
      uniqueScreens: new Set(activities.map(a => a.screenName)).size,
      totalActions: activities.reduce((sum, a) => sum + (a.actions?.length || 0), 0),
      avgScreenDuration: activities.length > 0 
        ? Math.floor(activities.reduce((sum, a) => sum + a.duration, 0) / activities.length)
        : 0,
      totalDuration: session.totalDuration || Math.floor((session.lastActivityTime - session.startTime) / 1000)
    };

    res.status(200).json({
      status: 'success',
      data: {
        session: {
          id: session._id,
          user: session.user,
          device: session.device,
          location: session.location,
          startTime: session.startTime,
          endTime: session.endTime,
          status: session.status,
          isFirstSession: session.isFirstSession,
          ip: session.ip,
          userAgent: session.userAgent
        },
        screenFlow,
        metrics
      }
    });
  } catch (error) {
    console.error('Get Session Detail Error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to fetch session details' 
    });
  }
};

/**
 * @desc    Get screen analytics
 * @route   GET /api/v1/admin/tracking/analytics/screens
 * @access  Private/Admin
 */
exports.getScreenAnalytics = async (req, res) => {
  try {
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate) 
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
    const endDate = req.query.endDate 
      ? new Date(req.query.endDate) 
      : new Date();

    // Screen visit counts
    const screenStats = await ScreenActivity.aggregate([
      {
        $match: {
          enteredAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$screenName',
          totalVisits: { $sum: 1 },
          uniqueUsers: { $addToSet: '$user' },
          avgDuration: { $avg: '$duration' },
          totalDuration: { $sum: '$duration' },
          avgScrollDepth: { $avg: '$scrollDepth' },
          totalActions: { $sum: { $size: { $ifNull: ['$actions', []] } } }
        }
      },
      {
        $project: {
          screenName: '$_id',
          totalVisits: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          avgDuration: { $round: ['$avgDuration', 0] },
          totalDuration: 1,
          avgScrollDepth: { $round: ['$avgScrollDepth', 2] },
          totalActions: 1
        }
      },
      {
        $sort: { totalVisits: -1 }
      }
    ]);

    // Screen transitions (navigation paths)
    const transitions = await ScreenActivity.getPopularTransitions(startDate, endDate);

    res.status(200).json({
      status: 'success',
      data: {
        screenStats,
        popularTransitions: transitions.map(t => ({
          from: t._id.from,
          to: t._id.to,
          count: t.count,
          avgDuration: Math.round(t.avgDuration)
        })),
        dateRange: {
          start: startDate,
          end: endDate
        }
      }
    });
  } catch (error) {
    console.error('Get Screen Analytics Error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to fetch screen analytics' 
    });
  }
};

/**
 * @desc    Get user behavior analytics
 * @route   GET /api/v1/admin/tracking/analytics/users
 * @access  Private/Admin
 */
exports.getUserBehaviorAnalytics = async (req, res) => {
  try {
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate) 
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate 
      ? new Date(req.query.endDate) 
      : new Date();

    const [
      sessionStats,
      deviceStats,
      locationStats,
      activeUsersNow,
      newUsers
    ] = await Promise.all([
      // Session statistics
      UserSession.aggregate([
        {
          $match: {
            startTime: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            uniqueUsers: { $addToSet: '$user' },
            avgSessionDuration: { $avg: '$totalDuration' },
            totalScreensViewed: { $sum: '$totalScreens' },
            firstTimeSessions: {
              $sum: { $cond: ['$isFirstSession', 1, 0] }
            }
          }
        },
        {
          $project: {
            totalSessions: 1,
            uniqueUsers: { $size: '$uniqueUsers' },
            avgSessionDuration: { $round: ['$avgSessionDuration', 0] },
            avgScreensPerSession: { 
              $round: [{ $divide: ['$totalScreensViewed', '$totalSessions'] }, 2] 
            },
            firstTimeSessions: 1
          }
        }
      ]),

      // Device distribution
      UserSession.aggregate([
        {
          $match: {
            startTime: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              type: '$device.type',
              os: '$device.os'
            },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 20
        }
      ]),

      // Location distribution
      UserSession.aggregate([
        {
          $match: {
            startTime: { $gte: startDate, $lte: endDate },
            'location.country': { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: {
              country: '$location.country',
              city: '$location.city'
            },
            sessions: { $sum: 1 },
            uniqueUsers: { $addToSet: '$user' }
          }
        },
        {
          $project: {
            country: '$_id.country',
            city: '$_id.city',
            sessions: 1,
            uniqueUsers: { $size: '$uniqueUsers' }
          }
        },
        {
          $sort: { sessions: -1 }
        },
        {
          $limit: 50
        }
      ]),

      // Active users right now
      UserSession.countDocuments({ status: 'active' }),

      // New users in date range
      User.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate }
      })
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        overview: {
          ...(sessionStats[0] || {}),
          activeUsersNow,
          newUsers
        },
        deviceDistribution: deviceStats.map(d => ({
          deviceType: d._id.type,
          os: d._id.os,
          count: d.count
        })),
        topLocations: locationStats.map(l => ({
          country: l.country,
          city: l.city,
          sessions: l.sessions,
          uniqueUsers: l.uniqueUsers
        })),
        dateRange: {
          start: startDate,
          end: endDate
        }
      }
    });
  } catch (error) {
    console.error('Get User Behavior Analytics Error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to fetch user analytics' 
    });
  }
};

/**
 * @desc    Get user journey (all sessions and screens for a user)
 * @route   GET /api/v1/admin/tracking/users/:userId/journey
 * @access  Private/Admin
 */
exports.getUserJourney = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      UserSession.find({ user: req.params.userId })
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      UserSession.countDocuments({ user: req.params.userId })
    ]);

    // Get screen activities for each session
    const journeyData = await Promise.all(
      sessions.map(async (session) => {
        const activities = await ScreenActivity.find({ session: session._id })
          .sort({ enteredAt: 1 })
          .select('screenName enteredAt exitedAt duration')
          .lean();

        return {
          sessionId: session._id,
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.totalDuration,
          status: session.status,
          device: session.device,
          location: session.location,
          screenFlow: activities.map(a => a.screenName),
          activities: activities.map((a, index) => ({
            step: index + 1,
            screen: a.screenName,
            enteredAt: a.enteredAt,
            exitedAt: a.exitedAt,
            duration: a.duration
          }))
        };
      })
    );

    res.status(200).json({
      status: 'success',
      data: {
        userId: req.params.userId,
        journey: journeyData,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get User Journey Error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to fetch user journey' 
    });
  }
};

/**
 * @desc    Get screen-specific analytics with filters
 * @route   GET /api/v1/admin/tracking/screens/:screenName/analytics
 * @access  Private/Admin
 */
exports.getScreenSpecificAnalytics = async (req, res) => {
  try {
    const { screenName } = req.params;
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate) 
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate 
      ? new Date(req.query.endDate) 
      : new Date();

    const analytics = await ScreenActivity.aggregate([
      {
        $match: {
          screenName,
          enteredAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                totalVisits: { $sum: 1 },
                uniqueUsers: { $addToSet: '$user' },
                avgDuration: { $avg: '$duration' },
                avgScrollDepth: { $avg: '$scrollDepth' },
                totalActions: { $sum: { $size: { $ifNull: ['$actions', []] } } }
              }
            }
          ],
          entryPoints: [
            {
              $group: {
                _id: '$previousScreen',
                count: { $sum: 1 }
              }
            },
            {
              $sort: { count: -1 }
            },
            {
              $limit: 10
            }
          ],
          exitPoints: [
            {
              $group: {
                _id: '$nextScreen',
                count: { $sum: 1 }
              }
            },
            {
              $sort: { count: -1 }
            },
            {
              $limit: 10
            }
          ],
          hourlyDistribution: [
            {
              $group: {
                _id: { $hour: '$enteredAt' },
                visits: { $sum: 1 }
              }
            },
            {
              $sort: { _id: 1 }
            }
          ]
        }
      }
    ]);

    const result = analytics[0];

    res.status(200).json({
      status: 'success',
      data: {
        screenName,
        overview: result.overview[0] ? {
          totalVisits: result.overview[0].totalVisits,
          uniqueUsers: result.overview[0].uniqueUsers.length,
          avgDuration: Math.round(result.overview[0].avgDuration),
          avgScrollDepth: Math.round(result.overview[0].avgScrollDepth * 100) / 100,
          totalActions: result.overview[0].totalActions
        } : {},
        entryPoints: result.entryPoints,
        exitPoints: result.exitPoints,
        hourlyDistribution: result.hourlyDistribution,
        dateRange: {
          start: startDate,
          end: endDate
        }
      }
    });
  } catch (error) {
    console.error('Get Screen Analytics Error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to fetch screen analytics' 
    });
  }
};


/**
 * @desc    Get comprehensive admin dashboard statistics
 * @route   GET /api/v1/admin/tracking/stats/dashboard
 * @access  Private/Admin
 */
exports.getAdminDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      // USER STATISTICS
      totalUsers,
      activeUsersNow,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      
      // SESSION STATISTICS
      totalSessions,
      activeSessionsNow,
      sessionsToday,
      sessionsThisWeek,
      sessionsThisMonth,
      avgSessionDuration,
      
      // SCREEN STATISTICS
      totalScreenViews,
      screenViewsToday,
      uniqueScreens,
      mostViewedScreens,
      
      // DEVICE STATISTICS
      deviceDistribution,
      
      // LOCATION STATISTICS
      topCountries,
      topCities,
      
      // ENGAGEMENT METRICS
      engagementMetrics,
      
      // REAL-TIME STATS
      liveUserDetails
    ] = await Promise.all([
      // Total registered users
      User.countDocuments(),
      
      // Currently active users
      UserSession.countDocuments({ status: 'active' }),
      
      // New users registered today
      User.countDocuments({ createdAt: { $gte: today } }),
      
      // New users this week
      User.countDocuments({ createdAt: { $gte: thisWeekStart } }),
      
      // New users this month
      User.countDocuments({ createdAt: { $gte: thisMonthStart } }),
      
      // Total sessions ever
      UserSession.countDocuments(),
      
      // Active sessions right now
      UserSession.countDocuments({ status: 'active' }),
      
      // Sessions today
      UserSession.countDocuments({ startTime: { $gte: today } }),
      
      // Sessions this week
      UserSession.countDocuments({ startTime: { $gte: thisWeekStart } }),
      
      // Sessions this month
      UserSession.countDocuments({ startTime: { $gte: thisMonthStart } }),
      
      // Average session duration (last 30 days)
      UserSession.aggregate([
        {
          $match: {
            startTime: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
            totalDuration: { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: null,
            avgDuration: { $avg: '$totalDuration' }
          }
        }
      ]),
      
      // Total screen views
      ScreenActivity.countDocuments(),
      
      // Screen views today
      ScreenActivity.countDocuments({ enteredAt: { $gte: today } }),
      
      // Unique screens visited
      ScreenActivity.distinct('screenName'),
      
      // Most viewed screens (last 7 days)
      ScreenActivity.aggregate([
        {
          $match: {
            enteredAt: { $gte: thisWeekStart }
          }
        },
        {
          $group: {
            _id: '$screenName',
            views: { $sum: 1 },
            uniqueUsers: { $addToSet: '$user' }
          }
        },
        {
          $project: {
            screenName: '$_id',
            views: 1,
            uniqueUsers: { $size: '$uniqueUsers' }
          }
        },
        {
          $sort: { views: -1 }
        },
        {
          $limit: 10
        }
      ]),
      
      // Device type distribution (last 30 days)
      UserSession.aggregate([
        {
          $match: {
            startTime: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: '$device.type',
            count: { $sum: 1 },
            percentage: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]),
      
      // Top countries (last 30 days)
      UserSession.aggregate([
        {
          $match: {
            startTime: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
            'location.country': { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: '$location.country',
            sessions: { $sum: 1 },
            uniqueUsers: { $addToSet: '$user' }
          }
        },
        {
          $project: {
            country: '$_id',
            sessions: 1,
            uniqueUsers: { $size: '$uniqueUsers' }
          }
        },
        {
          $sort: { sessions: -1 }
        },
        {
          $limit: 10
        }
      ]),
      
      // Top cities (last 30 days)
      UserSession.aggregate([
        {
          $match: {
            startTime: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
            'location.city': { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: {
              city: '$location.city',
              country: '$location.country'
            },
            sessions: { $sum: 1 },
            uniqueUsers: { $addToSet: '$user' }
          }
        },
        {
          $project: {
            city: '$_id.city',
            country: '$_id.country',
            sessions: 1,
            uniqueUsers: { $size: '$uniqueUsers' }
          }
        },
        {
          $sort: { sessions: -1 }
        },
        {
          $limit: 10
        }
      ]),
      
      // Engagement metrics
      UserSession.aggregate([
        {
          $match: {
            startTime: { $gte: thisWeekStart }
          }
        },
        {
          $group: {
            _id: null,
            totalScreensViewed: { $sum: '$totalScreens' },
            totalSessions: { $sum: 1 },
            returningUsers: {
              $sum: { $cond: [{ $eq: ['$isFirstSession', false] }, 1, 0] }
            },
            firstTimeUsers: {
              $sum: { $cond: [{ $eq: ['$isFirstSession', true] }, 1, 0] }
            }
          }
        },
        {
          $project: {
            avgScreensPerSession: {
              $round: [{ $divide: ['$totalScreensViewed', '$totalSessions'] }, 2]
            },
            returningUsers: 1,
            firstTimeUsers: 1,
            returnRate: {
              $round: [
                {
                  $multiply: [
                    { $divide: ['$returningUsers', '$totalSessions'] },
                    100
                  ]
                },
                2
              ]
            }
          }
        }
      ]),
      
      // Live user details (currently active)
      UserSession.find({ status: 'active' })
        .populate('user', 'name email avatar')
        .select('user device location lastActivityTime startTime')
        .sort({ lastActivityTime: -1 })
        .limit(20)
        .lean()
    ]);

    // Calculate device percentages
    const totalDeviceSessions = deviceDistribution.reduce((sum, d) => sum + d.count, 0);
    const devicesWithPercentage = deviceDistribution.map(d => ({
      type: d._id || 'Unknown',
      count: d.count,
      percentage: Math.round((d.count / totalDeviceSessions) * 100 * 100) / 100
    }));

    // Get current screen for live users
    const liveUsersWithCurrentScreen = await Promise.all(
      liveUserDetails.map(async (session) => {
        const currentScreen = await ScreenActivity.findOne({
          session: session._id,
          exitedAt: null
        }).sort({ enteredAt: -1 }).select('screenName enteredAt').lean();

        return {
          user: session.user,
          device: session.device?.type,
          location: {
            city: session.location?.city,
            country: session.location?.country
          },
          currentScreen: currentScreen?.screenName || 'Unknown',
          timeOnScreen: currentScreen 
            ? Math.floor((now - currentScreen.enteredAt) / 1000) 
            : 0,
          sessionDuration: Math.floor((now - session.startTime) / 1000),
          lastActivity: session.lastActivityTime
        };
      })
    );

    // Calculate growth rates
    const userGrowthRate = newUsersThisWeek > 0 && totalUsers > 0
      ? Math.round((newUsersThisWeek / Math.max(totalUsers - newUsersThisWeek, 1)) * 100 * 100) / 100
      : 0;

    const sessionGrowthRate = sessionsThisWeek > 0 && totalSessions > 0
      ? Math.round((sessionsThisWeek / Math.max(totalSessions - sessionsThisWeek, 1)) * 100 * 100) / 100
      : 0;

    res.status(200).json({
      status: 'success',
      data: {
        // OVERVIEW STATS
        overview: {
          totalUsers,
          activeUsersNow,
          totalSessions,
          activeSessionsNow,
          totalScreenViews,
          uniqueScreens: uniqueScreens.length,
          avgSessionDuration: avgSessionDuration[0]?.avgDuration 
            ? Math.round(avgSessionDuration[0].avgDuration) 
            : 0
        },

        // USER METRICS
        users: {
          total: totalUsers,
          active: activeUsersNow,
          newToday: newUsersToday,
          newThisWeek: newUsersThisWeek,
          newThisMonth: newUsersThisMonth,
          growthRate: `${userGrowthRate}%`
        },

        // SESSION METRICS
        sessions: {
          total: totalSessions,
          active: activeSessionsNow,
          today: sessionsToday,
          thisWeek: sessionsThisWeek,
          thisMonth: sessionsThisMonth,
          growthRate: `${sessionGrowthRate}%`,
          avgDuration: avgSessionDuration[0]?.avgDuration 
            ? Math.round(avgSessionDuration[0].avgDuration) 
            : 0
        },

        // SCREEN METRICS
        screens: {
          totalViews: totalScreenViews,
          viewsToday: screenViewsToday,
          uniqueScreens: uniqueScreens.length,
          mostViewed: mostViewedScreens.map(s => ({
            screenName: s.screenName,
            views: s.views,
            uniqueUsers: s.uniqueUsers
          }))
        },

        // ENGAGEMENT
        engagement: engagementMetrics[0] || {
          avgScreensPerSession: 0,
          returningUsers: 0,
          firstTimeUsers: 0,
          returnRate: 0
        },

        // DEVICE DISTRIBUTION
        devices: devicesWithPercentage,

        // LOCATION STATISTICS
        locations: {
          topCountries: topCountries.map(l => ({
            country: l.country,
            sessions: l.sessions,
            uniqueUsers: l.uniqueUsers
          })),
          topCities: topCities.map(l => ({
            city: l.city,
            country: l.country,
            sessions: l.sessions,
            uniqueUsers: l.uniqueUsers
          }))
        },

        // LIVE USERS (Real-time)
        liveUsers: {
          count: activeUsersNow,
          users: liveUsersWithCurrentScreen
        },

        // METADATA
        generatedAt: now,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    });
  } catch (error) {
    console.error('Get Admin Dashboard Stats Error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to fetch dashboard statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};