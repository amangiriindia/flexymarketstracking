// src/models/Post.js
const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  content: {
    text: {
      type: String,
      trim: true,
      maxlength: [5000, 'Post text cannot exceed 5000 characters']
    }
  },
  postType: {
    type: String,
    enum: ['text', 'image', 'video', 'poll', 'mixed'],
    default: 'text'
  },
  media: [{
    type: {
      type: String,
      enum: ['image', 'video'],
      required: true
    },
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    },
    thumbnail: {
      type: String
    }
  }],
  poll: {
    question: {
      type: String,
      trim: true
    },
    options: [{
      text: {
        type: String,
        required: true,
        trim: true
      },
      votes: [{
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        votedAt: {
          type: Date,
          default: Date.now
        }
      }]
    }],
    endsAt: {
      type: Date
    },
    allowMultipleVotes: {
      type: Boolean,
      default: false
    }
  },
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  sharesCount: {
    type: Number,
    default: 0,
    min: 0
  },
  commentsCount: {
    type: Number,
    default: 0,
    min: 0
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'followers'],
    default: 'public'
  },
  status: {
    type: String,
    enum: ['inReview', 'live', 'rejected'],
    default: 'inReview',  // All new posts go to admin review
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// ──────────────────────────────
// Indexes for Performance
// ──────────────────────────────
postSchema.index({ user: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ status: 1, createdAt: -1 });        // For admin dashboard
postSchema.index({ status: 1, visibility: 1 });       // For feed queries
postSchema.index({ 'likes.user': 1 });
postSchema.index({ 'poll.options.votes.user': 1 });

// ──────────────────────────────
// Virtuals
// ──────────────────────────────
postSchema.virtual('likesCount').get(function () {
  return this.likes.length;
});

postSchema.virtual('totalVotes').get(function () {
  if (!this.poll) return 0;
  return this.poll.options.reduce((total, opt) => total + opt.votes.length, 0);
});

// ──────────────────────────────
// Pre-save hook: Auto-set reviewedAt when status changes to live/rejected
// ──────────────────────────────
postSchema.pre('save', function (next) {
  if (this.isModified('status') && (this.status === 'live' || this.status === 'rejected')) {
    this.reviewedAt = new Date();
  }
  next();
});

// ──────────────────────────────
// JSON Output Settings
// ──────────────────────────────
postSchema.set('toJSON', { virtuals: true });
postSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Post', postSchema);