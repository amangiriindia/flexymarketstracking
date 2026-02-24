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
const userRoutes =  require('./routes/userRoutes');
const trackingRoutes = require('./routes/trackingRoutes');
const adminTrackingRoutes = require('./routes/adminTrackingRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminNotificationRoutes = require('./routes/adminNotificationRoutes');
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

  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Achiver Fx - Mobile App Service</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Inter', sans-serif;
          min-height: 100vh;
          background: #0a0e1a;
          color: #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .bg-glow {
          position: fixed;
          width: 600px; height: 600px;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.15;
          pointer-events: none;
        }
        .glow-1 { top: -200px; left: -100px; background: #3b82f6; }
        .glow-2 { bottom: -200px; right: -100px; background: #8b5cf6; }
        .container {
          position: relative;
          z-index: 1;
          text-align: center;
          max-width: 520px;
          padding: 48px 40px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          backdrop-filter: blur(20px);
        }
        .logo {
          font-size: 40px;
          font-weight: 700;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 6px;
        }
        .subtitle {
          font-size: 14px;
          color: #64748b;
          font-weight: 400;
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-bottom: 32px;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 20px;
          background: rgba(34,197,94,0.1);
          border: 1px solid rgba(34,197,94,0.25);
          border-radius: 100px;
          font-size: 13px;
          font-weight: 500;
          color: #4ade80;
          margin-bottom: 32px;
        }
        .status-dot {
          width: 8px; height: 8px;
          background: #4ade80;
          border-radius: 50%;
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }

        .endpoints {
          text-align: left;
          padding: 20px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
        }
        .endpoints-title {
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 12px;
        }
        .endpoint {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 0;
          font-size: 13px;
        }
        .method {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.5px;
          min-width: 36px;
          text-align: center;
        }
        .method-base { background: rgba(59,130,246,0.15); color: #60a5fa; }
        .endpoint-path { color: #94a3b8; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; }
        .footer {
          margin-top: 28px;
          font-size: 12px;
          color: #475569;
        }
      </style>
    </head>
    <body>
      <div class="bg-glow glow-1"></div>
      <div class="bg-glow glow-2"></div>
      <div class="container">
        <div class="logo">Flexy Markets</div>
        <div class="subtitle">Mobile App Service</div>
        <div class="status-badge">
          <span class="status-dot"></span>
          All Systems Operational
        </div>

        <div class="endpoints">
          <div class="endpoints-title">API Endpoints</div>
          <div class="endpoint"><span class="method method-base">API</span><span class="endpoint-path">/api/v1/auth</span></div>
          <div class="endpoint"><span class="method method-base">API</span><span class="endpoint-path">/api/v1/posts</span></div>
          <div class="endpoint"><span class="method method-base">API</span><span class="endpoint-path">/api/v1/tracking</span></div>
          <div class="endpoint"><span class="method method-base">API</span><span class="endpoint-path">/api/v1/notifications</span></div>
          <div class="endpoint"><span class="method method-base">API</span><span class="endpoint-path">/api/v1/users</span></div>
        </div>
        <div class="footer">&copy; ${new Date().getFullYear()} Flexy Markets. All rights reserved.</div>
      </div>
    </body>
    </html>
  `);
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
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/tracking', trackingRoutes);
app.use('/api/v1/admin/tracking', adminTrackingRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/admin/notifications', adminNotificationRoutes);

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