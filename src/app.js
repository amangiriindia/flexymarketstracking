// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const errorMiddleware = require('./middleware/errorMiddleware');

// Import routes
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const commentRoutes = require('./routes/commentRoutes');
const voiceCallRoutes = require('./routes/voiceCallRoutes');
const followRoutes =  require('./routes/followRoutes');
const adminRoutes =  require('./routes/adminRoutes');
const app = express();

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);

app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Root & Health Routes
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Mobile App Service API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      posts: '/api/v1/posts',
      comments: '/api/v1/comments',
      voiceCalls: '/api/v1/voice-calls',
    },
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/posts', postRoutes);
app.use('/api/v1/comments', commentRoutes);
app.use('/api/v1/voice-calls', voiceCallRoutes);
app.use('/api/v1/follow',followRoutes);
app.use('/api/v1/admin', adminRoutes);

// ──────────────────────────────
// 404 Handler (FIXED & FUTURE-PROOF)
// ──────────────────────────────
// This replaces the broken app.all('*', ...) that crashes with path-to-regexp v7+
app.use((req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Global Error Handling Middleware (must be last)
app.use(errorMiddleware);

module.exports = app;