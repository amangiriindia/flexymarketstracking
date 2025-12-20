// src/controllers/postController.js
const Post = require('../models/Post');
const Follow = require('../models/Follow');
const { uploadMedia, deleteMedia } = require('../services/cloudinaryService');

/**
 * @desc    Get ALL posts of the authenticated user (inReview, live, rejected)
 * @route   GET /api/v1/posts/my-posts
 * @access  Private (only own posts)
 */
exports.getMyPosts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(10, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      Post.find({ 
        user: req.user.id, 
        isActive: true 
      })
        .populate('user', 'name avatar email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Post.countDocuments({ user: req.user.id, isActive: true })
    ]);

    // Add status label for frontend
    const postsWithStatus = posts.map(post => ({
      ...post,
      canEdit: post.status === 'inReview' || post.status === 'rejected',
      statusLabel: post.status === 'inReview' ? 'Under Review' :
                   post.status === 'live' ? 'Live' : 'Rejected'
    }));

    res.status(200).json({
      status: 'success',
      data: {
        posts: postsWithStatus,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasMore: skip + posts.length < total
        }
      }
    });
  } catch (error) {
    console.error('Get My Posts Error:', error);
    next(error);
  }
};

/**
 * @desc    Create new post → starts as 'inReview'
 * @route   POST /api/v1/posts
 * @access  Private
 */
exports.createPost = async (req, res, next) => {
  try {
    const { text, postType = 'text', visibility = 'public', poll } = req.body;

    const postData = {
      user: req.user.id,
      postType,
      visibility,
      content: text ? { text: text.trim() } : undefined,
      status: 'inReview',
      sharesCount: 0
    };

    if (postType === 'poll') {
      let pollObj = poll;
      if (typeof poll === 'string') {
        try { pollObj = JSON.parse(poll); } catch {
          return res.status(400).json({ status: 'error', message: 'Invalid poll format' });
        }
      }

      if (!pollObj?.question || !Array.isArray(pollObj.options) || pollObj.options.length < 2) {
        return res.status(400).json({ status: 'error', message: 'Poll needs question + 2+ options' });
      }

      postData.poll = {
        question: pollObj.question.trim(),
        options: pollObj.options.slice(0, 10).map(opt => ({ text: opt.trim(), votes: [] })),
        endsAt: pollObj.endsAt ? new Date(pollObj.endsAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        allowMultipleVotes: !!pollObj.allowMultipleVotes
      };
    }

    if (req.files?.length > 0) {
      try {
        postData.media = await uploadMedia(req.files);
        const hasImage = postData.media.some(m => m.type === 'image');
        const hasVideo = postData.media.some(m => m.type === 'video');
        if (hasImage && hasVideo) postData.postType = 'mixed';
        else if (hasVideo) postData.postType = 'video';
        else if (hasImage) postData.postType = 'image';
      } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Media upload failed' });
      }
    }

    const post = await Post.create(postData);
    await post.populate('user', 'name avatar email role');

    res.status(201).json({
      status: 'success',
      message: 'Post submitted for review!',
      data: { post }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Share a live post
 * @route   POST /api/v1/posts/:id/share
 * @access  Private
 */
exports.sharePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || post.status !== 'live') {
      return res.status(404).json({ status: 'error', message: 'Post not live' });
    }

    post.sharesCount += 1;
    await post.save();

    res.json({ status: 'success', message: 'Shared!', data: { sharesCount: post.sharesCount } });
  } catch (error) { next(error); }
};

/**
 * @desc    Personalized infinite feed (only LIVE posts) - FIXED VERSION
 * @route   GET /api/v1/posts
 * @access  Public
 */
exports.getPosts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(30, Math.max(10, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const userId = req.user?._id;

    let followingIds = [];

    // Get user's following list if authenticated
    if (userId) {
      const follows = await Follow.find({ follower: userId }).select('following').lean();
      followingIds = follows.map(f => f.following.toString());
    }

    // Build query for posts from following + public posts
    const query = {
      status: 'live',
      isActive: true,
      user: { $exists: true, $ne: null } // Ensure user field exists and is not null
    };

    // First, let's debug what's in the database
    const allPosts = await Post.find({ status: 'live', isActive: true })
      .select('_id user')
      .lean();
    
    console.log('=== POST DEBUG ===');
    console.log('Total live posts:', allPosts.length);
    console.log('Posts with null users:', allPosts.filter(p => !p.user).length);
    console.log('Posts with valid users:', allPosts.filter(p => p.user).length);
    console.log('==================');

    // Fetch posts with proper pagination
    const posts = await Post.find(query)
      .populate({
        path: 'user',
        select: 'name avatar email userName',
        match: { isActive: true } // Only populate active users
      })
      .sort({ 
        createdAt: -1 // Most recent first
      })
      .skip(skip)
      .limit(limit + 1) // Fetch one extra to check if there are more
      .lean();

    console.log('Posts fetched after populate:', posts.length);
    console.log('Posts with populated user:', posts.filter(p => p.user).length);

    // Check if there are more posts
    const hasMore = posts.length > limit;
    
    // Remove the extra post if exists
    const finalPosts = hasMore ? posts.slice(0, limit) : posts;

    // Filter out any posts where user is still null (extra safety)
    const validPosts = finalPosts.filter(p => p.user && p.user._id);

    console.log('Valid posts after filtering:', validPosts.length);

    // Prioritize posts from following users
    const sortedPosts = validPosts.sort((a, b) => {
      const aIsFollowing = followingIds.includes(a.user._id.toString());
      const bIsFollowing = followingIds.includes(b.user._id.toString());
      
      // Posts from following users come first
      if (aIsFollowing && !bIsFollowing) return -1;
      if (!aIsFollowing && bIsFollowing) return 1;
      
      // Otherwise maintain chronological order
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Get total count for pagination info (only posts with valid users)
    const totalCount = await Post.countDocuments(query);

    res.json({
      status: 'success',
      data: {
        posts: sortedPosts,
        pagination: {
          page,
          limit,
          total: totalCount,
          hasMore: sortedPosts.length >= limit,
          nextPage: sortedPosts.length >= limit ? page + 1 : null
        }
      }
    });
  } catch (error) {
    console.error('Get Posts Error:', error);
    next(error);
  }
};

/**
 * @desc    Get single post (only if LIVE)
 * @route   GET /api/v1/posts/:id
 * @access  Public
 */
exports.getPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('user', 'name avatar email')
      .populate('likes.user', 'name avatar');

    if (!post || !post.isActive || post.status !== 'live') {
      return res.status(404).json({ status: 'error', message: 'Post not found or not approved' });
    }

    res.json({ status: 'success', data: { post } });
  } catch (error) { next(error); }
};

/**
 * @desc    Update post (only text/visibility)
 * @route   PUT /api/v1/posts/:id
 * @access  Private
 */
exports.updatePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || !post.isActive) return res.status(404).json({ status: 'error', message: 'Post not found' });

    if (post.user.toString() !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ status: 'error', message: 'Not authorized' });
    }

    const { text, visibility } = req.body;
    if (text !== undefined) post.content.text = text.trim();
    if (visibility) post.visibility = visibility;

    await post.save();
    await post.populate('user', 'name avatar email');

    res.json({ status: 'success', message: 'Post updated', data: { post } });
  } catch (error) { next(error); }
};

/**
 * @desc    Delete post + cleanup media
 * @route   DELETE /api/v1/posts/:id
 * @access  Private
 */
exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ status: 'error', message: 'Post not found' });

    if (post.user.toString() !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ status: 'error', message: 'Not authorized' });
    }

    if (post.media?.length > 0) {
      await deleteMedia(post.media.map(m => m.publicId));
    }

    await Post.findByIdAndDelete(req.params.id);
    res.json({ status: 'success', message: 'Post deleted' });
  } catch (error) { next(error); }
};

/**
 * @desc    Like / Unlike post (only LIVE posts)
 * @route   POST /api/v1/posts/:id/like
 * @access  Private
 */
exports.likePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || post.status !== 'live') {
      return res.status(404).json({ status: 'error', message: 'Post not live' });
    }

    const userIdStr = req.user.id.toString();
    const index = post.likes.findIndex(l => l.user.toString() === userIdStr);

    if (index > -1) {
      post.likes.splice(index, 1);
      await post.save();
      return res.json({ status: 'success', message: 'Unliked', data: { likesCount: post.likes.length, liked: false } });
    }

    post.likes.push({ user: req.user.id });
    await post.save();

    res.json({ status: 'success', message: 'Liked', data: { likesCount: post.likes.length, liked: true } });
  } catch (error) { next(error); }
};

/**
 * @desc    Vote on poll (only LIVE polls)
 * @route   POST /api/v1/posts/:id/vote
 * @access  Private
 */
exports.voteOnPoll = async (req, res, next) => {
  try {
    const { optionIndex } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post || post.postType !== 'poll' || post.status !== 'live') {
      return res.status(404).json({ status: 'error', message: 'Poll not live' });
    }

    if (new Date() > post.poll.endsAt) return res.status(400).json({ status: 'error', message: 'Poll ended' });
    if (optionIndex >= post.poll.options.length) return res.status(400).json({ status: 'error', message: 'Invalid option' });

    const alreadyVoted = post.poll.options.some(o => o.votes.some(v => v.user.toString() === req.user.id.toString()));
    if (alreadyVoted && !post.poll.allowMultipleVotes) {
      return res.status(400).json({ status: 'error', message: 'Already voted' });
    }

    post.poll.options[optionIndex].votes.push({ user: req.user.id });
    await post.save();

    res.json({ status: 'success', message: 'Voted!', data: { poll: post.poll } });
  } catch (error) { next(error); }
};

/**
 * @desc    Get user's posts (all statuses visible to owner)
 * @route   GET /api/v1/posts/user/:userId
 * @access  Public
 */
exports.getUserPosts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const query = req.user && req.user.id === req.params.userId
      ? { user: req.params.userId, isActive: true }
      : { user: req.params.userId, status: 'live', isActive: true };

    const [posts, total] = await Promise.all([
      Post.find(query)
        .populate('user', 'name avatar email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Post.countDocuments(query)
    ]);

    res.json({
      status: 'success',
      data: { posts, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }
    });
  } catch (error) { next(error); }
};