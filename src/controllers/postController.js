// src/controllers/postController.js
const Post = require('../models/Post');
const Follow = require('../models/Follow');
const { uploadMedia, deleteMedia } = require('../services/cloudinaryService');


// @desc    Create new post (text, poll, image/video/mixed)
// @route   POST /api/v1/posts
// @access  Private
exports.createPost = async (req, res, next) => {
  try {
    const { text, postType = 'text', visibility = 'public', poll } = req.body;

    const postData = {
      user: req.user.id,
      postType,
      visibility,
      content: text ? { text: text.trim() } : undefined
    };

    // Handle poll data (supports both JSON string and object)
    if (postType === 'poll') {
      let pollObj = poll;
      if (typeof poll === 'string') {
        try {
          pollObj = JSON.parse(poll);
        } catch (e) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid poll JSON format'
          });
        }
      }

      if (!pollObj?.question || !Array.isArray(pollObj?.options) || pollObj.options.length < 2) {
        return res.status(400).json({
          status: 'error',
          message: 'Poll must have a question and at least 2 options'
        });
      }

      postData.poll = {
        question: pollObj.question.trim(),
        options: pollObj.options.slice(0, 10).map(opt => ({ text: opt.trim(), votes: [] })),
        endsAt: pollObj.endsAt ? new Date(pollObj.endsAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        allowMultipleVotes: !!pollObj.allowMultipleVotes
      };
    }

    // Handle media uploads from memory → Cloudinary
    if (req.files && req.files.length > 0) {
      try {
        postData.media = await uploadMedia(req.files);

        // Auto-detect postType based on uploaded media
        const hasImage = postData.media.some(m => m.type === 'image');
        const hasVideo = postData.media.some(m => m.type === 'video');

        if (hasImage && hasVideo) postData.postType = 'mixed';
        else if (hasVideo) postData.postType = 'video';
        else if (hasImage) postData.postType = 'image';
        else if (text && postData.media.length > 0) postData.postType = 'mixed';
      } catch (uploadError) {
        console.error('Cloudinary upload failed:', uploadError);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to upload media. Please try again.'
        });
      }
    }

    const post = await Post.create(postData);
    await post.populate('user', 'name avatar email role');

    res.status(201).json({
      status: 'success',
      message: 'Post created successfully',
      data: { post }
    });
  } catch (error) {
    console.error('Create Post Error:', error);
    next(error);
  }
};



/**
 * @desc    Get personalized infinite feed (Following + Trending + Never-ending)
 * @route   GET /api/v1/posts
 * @access  Public (but personalized if logged in)
 */
exports.getPosts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(30, Math.max(10, parseInt(req.query.limit) || 15));
    const skip = (page - 1) * limit;
    const userId = req.user?._id;

    let posts = [];
    let followingIds = [];

    // Step 1: Get who the user follows (only if authenticated)
    if (userId) {
      const follows = await Follow.find({ follower: userId })
        .select('following')
        .lean();

      followingIds = follows.map(f => f.following);
    }

    // Step 2: Priority 1 → Posts from people I follow (chronological)
    if (followingIds.length > 0) {
      const followedPosts = await Post.find({
        user: { $in: followingIds },
        isActive: true
      })
        .populate('user', 'name avatar email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit * 2)
        .lean();

      posts.push(...followedPosts);
    }

    // Step 3: If less than needed → Fill with trending public posts
    if (posts.length < limit) {
      const needed = limit - posts.length + 10; // Extra buffer

      const trendingPosts = await Post.find({
        visibility: 'public',
        isActive: true,
        user: { 
          $nin: [...followingIds, userId].filter(Boolean) // Exclude self & following
        }
      })
        .populate('user', 'name avatar email')
        .sort({ 
          likesCount: -1,    // Most liked first
          commentsCount: -1,
          createdAt: -1 
        })
        .limit(needed)
        .lean();

      posts.push(...trendingPosts);
    }

    // Step 4: Deduplicate by _id
    const seen = new Set();
    posts = posts.filter(post => {
      const id = post._id.toString();
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    // Step 5: Smart shuffle (80% chronological/trending, 20% variety)
    const shuffled = posts
      .sort((a, b) => {
        // Keep recent followed posts on top
        const aFollowed = followingIds.includes(a.user._id.toString());
        const bFollowed = followingIds.includes(b.user._id.toString());
        if (aFollowed && !bFollowed) return -1;
        if (!aFollowed && bFollowed) return 1;
        return 0;
      })
      .map((post, i) => ({ post, sort: Math.random() + (i * 0.001) }))
      .sort((a, b) => a.sort - b.sort)
      .map(item => item.post);

    // Final slice
    posts = shuffled.slice(0, limit);

    // Step 6: Never-ending feed → If still short, loop top posts
    if (posts.length < limit && page > 5) { // After page 5, start recycling
      const evergreen = await Post.find({
        visibility: 'public',
        isActive: true,
        likesCount: { $gte: 5 }
      })
        .select('_id user content media postType visibility likesCount createdAt')
        .populate('user', 'name avatar')
        .sort({ likesCount: -1, createdAt: -1 })
        .limit(100)
        .lean();

      const filler = evergreen
        .filter(p => !seen.has(p._id.toString()))
        .sort(() => Math.random() - 0.5)
        .slice(0, limit - posts.length);

      posts.push(...filler);
    }

    // Always return full page for infinite scroll
    const finalPosts = posts.slice(0, limit);

    res.status(200).json({
      status: 'success',
      data: {
        posts: finalPosts,
        pagination: {
          page,
          limit,
          hasMore: true, // Infinite scroll = always true
          total: null // Unknown total → true infinite feel
        }
      }
    });
  } catch (error) {
    console.error('Feed Error:', error);
    next(error);
  }
};

// @desc    Get single post
// @route   GET /api/v1/posts/:id
// @access  Public
exports.getPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('user', 'name avatar email')
      .populate('likes.user', 'name avatar');

    if (!post || !post.isActive) {
      return res.status(404).json({ status: 'error', message: 'Post not found' });
    }

    res.status(200).json({ status: 'success', data: { post } });
  } catch (error) {
    next(error);
  }
};

// @desc    Update post (text or visibility only)
// @route   PUT /api/v1/posts/:id
// @access  Private
exports.updatePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || !post.isActive) {
      return res.status(404).json({ status: 'error', message: 'Post not found' });
    }

    if (post.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ status: 'error', message: 'Not authorized' });
    }

    const { text, visibility } = req.body;
    if (text !== undefined) post.content.text = text.trim();
    if (visibility) post.visibility = visibility;

    await post.save();
    await post.populate('user', 'name avatar email');

    res.status(200).json({
      status: 'success',
      message: 'Post updated successfully',
      data: { post }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete post + clean up Cloudinary media
// @route   DELETE /api/v1/posts/:id
// @access  Private
exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ status: 'error', message: 'Post not found' });
    }

    if (post.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ status: 'error', message: 'Not authorized' });
    }

    // Delete all associated media from Cloudinary
    if (post.media && post.media.length > 0) {
      const publicIds = post.media.map(m => m.publicId);
      await deleteMedia(publicIds); // Uses bulk delete via service
    }

    await Post.findByIdAndDelete(req.params.id);

    res.status(200).json({
      status: 'success',
      message: 'Post and media deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Like / Unlike post
// @route   POST /api/v1/posts/:id/like
// @access  Private
exports.likePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || !post.isActive) {
      return res.status(404).json({ status: 'error', message: 'Post not found' });
    }

    const userIdStr = req.user.id.toString();
    const likedIndex = post.likes.findIndex(l => l.user.toString() === userIdStr);

    if (likedIndex > -1) {
      post.likes.splice(likedIndex, 1);
      await post.save();
      return res.status(200).json({
        status: 'success',
        message: 'Post unliked',
        data: { likesCount: post.likes.length, liked: false }
      });
    }

    post.likes.push({ user: req.user.id });
    await post.save();

    res.status(200).json({
      status: 'success',
      message: 'Post liked',
      data: { likesCount: post.likes.length, liked: true }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Vote on poll
// @route   POST /api/v1/posts/:id/vote
// @access  Private
exports.voteOnPoll = async (req, res, next) => {
  try {
    const { optionIndex } = req.body;
    if (optionIndex === undefined || optionIndex < 0) {
      return res.status(400).json({ status: 'error', message: 'Valid optionIndex is required' });
    }

    const post = await Post.findById(req.params.id);
    if (!post || post.postType !== 'poll' || !post.isActive) {
      return res.status(404).json({ status: 'error', message: 'Poll not found' });
    }

    if (new Date() > new Date(post.poll.endsAt)) {
      return res.status(400).json({ status: 'error', message: 'This poll has ended' });
    }

    if (optionIndex >= post.poll.options.length) {
      return res.status(400).json({ status: 'error', message: 'Invalid option selected' });
    }

    const userIdStr = req.user.id.toString();
    const alreadyVoted = post.poll.options.some(opt =>
      opt.votes.some(v => v.user.toString() === userIdStr)
    );

    if (alreadyVoted && !post.poll.allowMultipleVotes) {
      return res.status(400).json({ status: 'error', message: 'You have already voted' });
    }

    post.poll.options[optionIndex].votes.push({ user: req.user.id });
    await post.save();

    res.status(200).json({
      status: 'success',
      message: 'Vote recorded successfully',
      data: { poll: post.poll }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get posts by user
// @route   GET /api/v1 Routes: /api/v1/posts/user/:userId
// @access  Public
exports.getUserPosts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      Post.find({ user: req.params.userId, isActive: true })
        .populate('user', 'name avatar email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Post.countDocuments({ user: req.params.userId, isActive: true })
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        posts,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    next(error);
  }
};