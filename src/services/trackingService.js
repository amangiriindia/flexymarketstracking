// src/services/trackingService.js
const UserSession = require('../models/UserSession');
const ScreenActivity = require('../models/ScreenActivity');

/**
 * Utility service for tracking operations
 */
class TrackingService {
  /**
   * Get or create active session for user
   */
  static async getOrCreateSession(userId, deviceInfo, location, ip, userAgent) {
    let session = await UserSession.findOne({
      user: userId,
      status: 'active'
    });

    if (!session) {
      const crypto = require('crypto');
      const sessionToken = crypto.randomBytes(32).toString('hex');
      
      const sessionCount = await UserSession.countDocuments({ user: userId });

      session = await UserSession.create({
        user: userId,
        sessionToken,
        device: deviceInfo,
        ip,
        userAgent,
        location,
        isFirstSession: sessionCount === 0
      });
    }

    return session;
  }

  /**
   * Track screen visit automatically
   */
  static async autoTrackScreen(userId, sessionId, screenName, options = {}) {
    const {
      screenRoute,
      previousScreen,
      deviceState,
      location
    } = options;

    // Exit previous screen if exists
    if (previousScreen) {
      const prevActivity = await ScreenActivity.findOne({
        session: sessionId,
        user: userId,
        screenName: previousScreen,
        exitedAt: null
      }).sort({ enteredAt: -1 });

      if (prevActivity) {
        await prevActivity.exitScreen(screenName);
      }
    }

    // Create new activity
    const activity = await ScreenActivity.create({
      session: sessionId,
      user: userId,
      screenName,
      screenRoute,
      previousScreen,
      deviceState,
      location
    });

    // Update session
    await UserSession.findByIdAndUpdate(
      sessionId,
      {
        $inc: { totalScreens: 1 },
        $set: { 
          lastActivityTime: new Date(),
          status: 'active'
        }
      }
    );

    return activity;
  }

  /**
   * Expire old sessions
   */
  static async expireIdleSessions(inactivityMinutes = 30) {
    const cutoffTime = new Date(Date.now() - inactivityMinutes * 60 * 1000);

    const sessions = await UserSession.find({
      status: 'active',
      lastActivityTime: { $lt: cutoffTime }
    });

    for (const session of sessions) {
      await session.checkExpiry();
    }

    return sessions.length;
  }

  /**
   * Get popular screen paths (most common user flows)
   */
  static async getPopularPaths(limit = 10) {
    const paths = await ScreenActivity.aggregate([
      {
        $match: {
          previousScreen: { $ne: null },
          screenName: { $ne: 'logout' }
        }
      },
      {
        $group: {
          _id: {
            from: '$previousScreen',
            to: '$screenName'
          },
          count: { $sum: 1 },
          avgDuration: { $avg: '$duration' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: limit
      }
    ]);

    return paths.map(p => ({
      from: p._id.from,
      to: p._id.to,
      count: p.count,
      avgDuration: Math.round(p.avgDuration)
    }));
  }

  /**
   * Get drop-off points (screens where users exit most)
   */
  static async getDropOffPoints() {
    const dropOffs = await ScreenActivity.aggregate([
      {
        $match: {
          nextScreen: null,
          screenName: { $ne: 'logout' }
        }
      },
      {
        $group: {
          _id: '$screenName',
          count: { $sum: 1 },
          avgDuration: { $avg: '$duration' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);

    return dropOffs.map(d => ({
      screen: d._id,
      dropOffCount: d.count,
      avgTimeBeforeExit: Math.round(d.avgDuration)
    }));
  }

  /**
   * Get real-time active users count
   */
  static async getActiveUsersCount() {
    return await UserSession.countDocuments({ status: 'active' });
  }

  /**
   * Get active users by screen
   */
  static async getActiveUsersByScreen() {
    const activities = await ScreenActivity.aggregate([
      {
        $lookup: {
          from: 'usersessions',
          localField: 'session',
          foreignField: '_id',
          as: 'sessionData'
        }
      },
      {
        $unwind: '$sessionData'
      },
      {
        $match: {
          'sessionData.status': 'active',
          exitedAt: null
        }
      },
      {
        $group: {
          _id: '$screenName',
          activeUsers: { $sum: 1 }
        }
      },
      {
        $sort: { activeUsers: -1 }
      }
    ]);

    return activities.map(a => ({
      screen: a._id,
      activeUsers: a.activeUsers
    }));
  }

  /**
   * Get session summary for a user
   */
  static async getUserSessionSummary(userId, days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [sessions, activities] = await Promise.all([
      UserSession.find({
        user: userId,
        startTime: { $gte: startDate }
      }).lean(),

      ScreenActivity.aggregate([
        {
          $match: {
            user: userId,
            enteredAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            totalScreens: { $sum: 1 },
            uniqueScreens: { $addToSet: '$screenName' },
            totalActions: { $sum: { $size: { $ifNull: ['$actions', []] } } },
            totalDuration: { $sum: '$duration' }
          }
        }
      ])
    ]);

    const activityData = activities[0] || {};

    return {
      totalSessions: sessions.length,
      totalDuration: sessions.reduce((sum, s) => sum + (s.totalDuration || 0), 0),
      avgSessionDuration: sessions.length > 0 
        ? Math.round(sessions.reduce((sum, s) => sum + (s.totalDuration || 0), 0) / sessions.length)
        : 0,
      totalScreensVisited: activityData.totalScreens || 0,
      uniqueScreensVisited: activityData.uniqueScreens?.length || 0,
      totalActions: activityData.totalActions || 0,
      devices: [...new Set(sessions.map(s => s.device?.type))],
      locations: [...new Set(sessions.map(s => s.location?.city).filter(Boolean))]
    };
  }

  /**
   * Track API call from screen
   */
  static async trackAPICall(activityId) {
    await ScreenActivity.findByIdAndUpdate(
      activityId,
      { $inc: { apiCalls: 1 } }
    );
  }

  /**
   * Track error on screen
   */
  static async trackError(activityId, errorType, errorMessage) {
    await ScreenActivity.findByIdAndUpdate(
      activityId,
      {
        $push: {
          errors: {
            errorType,
            errorMessage,
            timestamp: new Date()
          }
        }
      }
    );
  }

  /**
   * Get heat map data (most visited screens by time of day)
   */
  static async getHeatMapData(days = 7) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const heatMap = await ScreenActivity.aggregate([
      {
        $match: {
          enteredAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            screen: '$screenName',
            hour: { $hour: '$enteredAt' },
            dayOfWeek: { $dayOfWeek: '$enteredAt' }
          },
          visits: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.screen': 1, '_id.hour': 1 }
      }
    ]);

    return heatMap.map(h => ({
      screen: h._id.screen,
      hour: h._id.hour,
      dayOfWeek: h._id.dayOfWeek,
      visits: h.visits
    }));
  }

  /**
   * Get funnel analysis (conversion through screen flow)
   */
  static async getFunnelAnalysis(screenFlow = ['home', 'trading', 'wallet']) {
    const funnel = [];

    for (let i = 0; i < screenFlow.length; i++) {
      const screen = screenFlow[i];
      const count = await ScreenActivity.countDocuments({ screenName: screen });
      
      let nextScreenCount = 0;
      if (i < screenFlow.length - 1) {
        nextScreenCount = await ScreenActivity.countDocuments({
          screenName: screen,
          nextScreen: screenFlow[i + 1]
        });
      }

      funnel.push({
        step: i + 1,
        screen,
        users: count,
        dropOff: i < screenFlow.length - 1 ? count - nextScreenCount : 0,
        conversionRate: i > 0 
          ? Math.round((count / funnel[0].users) * 100)
          : 100
      });
    }

    return funnel;
  }

  /**
   * Get cohort analysis (user retention over time)
   */
  static async getCohortAnalysis(cohortDate) {
    const cohortStart = new Date(cohortDate);
    const cohortEnd = new Date(cohortStart);
    cohortEnd.setDate(cohortEnd.getDate() + 1);

    // Users who had first session in cohort period
    const cohortUsers = await UserSession.find({
      isFirstSession: true,
      startTime: { $gte: cohortStart, $lt: cohortEnd }
    }).distinct('user');

    // Track their activity over next 30 days
    const retention = [];
    for (let day = 0; day < 30; day++) {
      const dayStart = new Date(cohortStart);
      dayStart.setDate(dayStart.getDate() + day);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const activeUsers = await UserSession.countDocuments({
        user: { $in: cohortUsers },
        startTime: { $gte: dayStart, $lt: dayEnd }
      });

      retention.push({
        day,
        activeUsers,
        retentionRate: cohortUsers.length > 0 
          ? Math.round((activeUsers / cohortUsers.length) * 100)
          : 0
      });
    }

    return {
      cohortDate: cohortStart,
      cohortSize: cohortUsers.length,
      retention
    };
  }
}

module.exports = TrackingService;