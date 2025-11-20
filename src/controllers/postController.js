// src/controllers/postController.js
const Post = require('../models/Post');
const cloudinary = require('../config/cloudinary');

// @desc    Create new post (text, poll, image/video)
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

    // Handle poll
    if (postType === 'poll' && poll) {
      postData.poll = {
        question: poll.question.trim(),
        options: poll.options.map(opt => ({ text: opt.trim(), votes: [] })),
        endsAt: poll.endsAt ? new Date(poll.endsAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        allowMultipleVotes: !!poll.allowMultipleVotes
      };
    }

    // Handle file uploads
    if (req.files?.length > 0) {
      const uploadPromises = req.files.map(file =>
        cloudinary.uploader.upload(file.path, {
          folder: 'posts',
          resource_type: 'auto'
        })
      );

      const results = await Promise.all(uploadPromises);

      postData.media = results.map(result => ({
        type: result.resource_type === 'image' ? 'image' : 'video',
        url: result.secure_url,
        publicId: result.public_id,
        thumbnail: result.thumbnail_url || result.secure_url
      }));
    }

    const post = await Post.create(postData);
    await post.populate('user', 'name avatar email role');

    res.status(201).json({
      status: 'success',
      message: 'Post created successfully',
      data: { post }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get public feed
// @route   GET /api/v1/posts
// @access  Public
exports.getPosts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      Post.find({ visibility: 'public', isActive: true })
        .populate('user', 'name avatar email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Post.countDocuments({ visibility: 'public', isActive: true })
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

// @desc    Get single post by ID
// @route   GET /api/v1/posts/:id
// @access  Public
exports.getPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('user', 'name avatar email')
      .populate('likes.user', 'name avatar');

    if (!post || !post.isActive) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: { post }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update post text or visibility
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
      message: 'Post updated',
      data: { post }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete post + media cleanup
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

    // Delete from Cloudinary
    if (post.media?.length > 0) {
      const deletePromises = post.media.map(m => cloudinary.uploader.destroy(m.publicId));
      await Promise.all(deletePromises);
    }

    await Post.findByIdAndDelete(req.params.id);

    res.status(200).json({
      status: 'success',
      message: 'Post deleted permanently'
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
    const post = await Post.findById(req.params.id);

    if (!post || post.postType !== 'poll' || !post.isActive) {
      return res.status(404).json({ status: 'error', message: 'Poll not found' });
    }

    if (new Date() > new Date(post.poll.endsAt)) {
      return res.status(400).json({ status: 'error', message: 'Poll has ended' });
    }

    const userIdStr = req.user.id.toString();
    const alreadyVoted = post.poll.options.some(opt =>
      opt.votes.some(v => v.user.toString() === userIdStr)
    );

    if (alreadyVoted && !post.poll.allowMultipleVotes) {
      return res.status(400).json({ status: 'error', message: 'Already voted' });
    }

    post.poll.options[optionIndex].votes.push({ user: req.user.id });
    await post.save();

    res.status(200).json({
      status: 'success',
      message: 'Vote recorded',
      data: { poll: post.poll }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get posts by user
// @route   GET /api/v1/posts/user/:userId
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