// src/controllers/adminController.js
const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');   // ← THIS WAS MISSING!

/**
 * @desc    Admin: Get dashboard stats
 * @route   GET /api/v1/admin/stats
 */
exports.getStats = async (req, res) => {
  try {
    const [totalUsers, totalPosts, totalComments, pendingPosts] = await Promise.all([
      User.countDocuments(),
      Post.countDocuments({ isActive: true }),
      Comment.countDocuments({ isActive: true }),     // ← Now works!
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
      status = 'inReview',   // default = inReview
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
    // status=all or not provided → show all statuses
    // → query remains {} → all posts

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