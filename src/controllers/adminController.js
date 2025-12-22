// src/controllers/adminController.js
const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');

/**
 * @desc    Admin: Get dashboard stats
 * @route   GET /api/v1/admin/stats
 */
exports.getStats = async (req, res) => {
  try {
    const [totalUsers, totalPosts, totalComments, pendingPosts] = await Promise.all([
      User.countDocuments(),
      Post.countDocuments({ isActive: true }),
      Comment.countDocuments({ isActive: true }),
      Post.countDocuments({ status: 'inReview' })
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        totalUsers,
        totalPosts,
        totalComments,
        pendingPosts,
        livePosts: await Post.countDocuments({ status: 'live', isActive: true }),
        rejectedPosts: await Post.countDocuments({ status: 'rejected' })
      }
    });
  } catch (error) {
    console.error('Admin Stats Error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * @desc    Admin: Get posts with filter (inReview/live/rejected/all)
 * @route   GET /api/v1/admin/posts?status=inReview&status=live&page=1&limit=20
 */
exports.getAdminPosts = async (req, res) => {
  try {
    const { 
      status = 'inReview',
      page = 1, 
      limit = 20 
    } = req.query;

    let query = {};

    // Handle multiple status filters: ?status=live&status=rejected
    if (Array.isArray(status)) {
      query.status = { $in: status };
    } 
    // Single status: ?status=live
    else if (status && status !== 'all') {
      query.status = status;
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [posts, total] = await Promise.all([
      Post.find(query)
        .populate('user', 'name avatar email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),

      Post.countDocuments(query)
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        posts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        },
        filters: {
          currentStatus: Array.isArray(status) ? status : (status === 'all' ? 'all' : status),
          applied: Array.isArray(status) ? status : status === 'all' ? 'all' : [status]
        }
      }
    });
  } catch (error) {
    console.error('Get Admin Posts Error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * @desc    Admin: Approve post → make it live
 * @route   PUT /api/v1/admin/posts/:id/approve
 */
exports.approvePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ status: 'error', message: 'Post not found' });

    post.status = 'live';
    post.reviewedBy = req.user.id;
    post.reviewedAt = new Date();
    await post.save();

    res.status(200).json({
      status: 'success',
      message: 'Post approved and now LIVE in feed!'
    });
  } catch (error) {
    console.error('Approve Post Error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * @desc    Admin: Reject post
 * @route   PUT /api/v1/admin/posts/:id/reject
 */
exports.rejectPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ status: 'error', message: 'Post not found' });

    post.status = 'rejected';
    post.reviewedBy = req.user.id;
    post.reviewedAt = new Date();
    await post.save();

    res.status(200).json({
      status: 'success',
      message: 'Post rejected'
    });
  } catch (error) {
    console.error('Reject Post Error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * @desc    Admin: Get all users with filters
 * @route   GET /api/v1/admin/users?role=USER&isActive=true&page=1&limit=20&search=john
 */
exports.getAllUsers = async (req, res) => {
  try {
    const { 
      role,
      isActive,
      search,
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    let query = {};

    // Filter by role
    if (role && ['USER', 'ADMIN'].includes(role.toUpperCase())) {
      query.role = role.toUpperCase();
    }

    // Filter by active status
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Search by name, email, or username
    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } },
        { userName: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [users, total, activeCount, adminCount] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),

      User.countDocuments(query),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'ADMIN' })
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        users,
        stats: {
          total,
          active: activeCount,
          inactive: total - activeCount,
          admins: adminCount,
          regularUsers: total - adminCount
        },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        },
        filters: {
          role: role || 'all',
          isActive: isActive !== undefined ? isActive === 'true' : 'all',
          search: search || null,
          sortBy,
          sortOrder
        }
      }
    });
  } catch (error) {
    console.error('Get All Users Error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * @desc    Admin: Get single user details
 * @route   GET /api/v1/admin/users/:id
 */
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .lean();

    if (!user) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'User not found' 
      });
    }

    // Get user's post count
    const postCount = await Post.countDocuments({ 
      user: req.params.id, 
      isActive: true 
    });

    // Get user's comment count
    const commentCount = await Comment.countDocuments({ 
      user: req.params.id, 
      isActive: true 
    });

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          ...user,
          postCount,
          commentCount
        }
      }
    });
  } catch (error) {
    console.error('Get User By ID Error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * @desc    Admin: Update user status (activate/deactivate)
 * @route   PUT /api/v1/admin/users/:id/status
 */
exports.updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    if (isActive === undefined) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'isActive field is required' 
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'User not found' 
      });
    }

    res.status(200).json({
      status: 'success',
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: { user }
    });
  } catch (error) {
    console.error('Update User Status Error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * @desc    Admin: Update user role
 * @route   PUT /api/v1/admin/users/:id/role
 */
exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;

    if (!role || !['USER', 'ADMIN'].includes(role.toUpperCase())) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Valid role (USER or ADMIN) is required' 
      });
    }

    // Prevent admin from demoting themselves
    if (req.params.id === req.user.id && role.toUpperCase() !== 'ADMIN') {
      return res.status(403).json({ 
        status: 'error', 
        message: 'You cannot change your own role' 
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role: role.toUpperCase() },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'User not found' 
      });
    }

    res.status(200).json({
      status: 'success',
      message: `User role updated to ${role.toUpperCase()}`,
      data: { user }
    });
  } catch (error) {
    console.error('Update User Role Error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

/**
 * @desc    Admin: Delete user (soft delete)
 * @route   DELETE /api/v1/admin/users/:id
 */
exports.deleteUser = async (req, res) => {
  try {
    // Prevent admin from deleting themselves
    if (req.params.id === req.user.id) {
      return res.status(403).json({ 
        status: 'error', 
        message: 'You cannot delete your own account' 
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'User not found' 
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'User deleted successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Delete User Error:', error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};