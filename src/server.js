// src/server.js
require('dotenv').config(); // ← Must be FIRST

const app = require('./app');
const connectDB = require('./config/database');

// ──────────────────────────────
// Critical: Initialize Cloudinary Config Early
// ──────────────────────────────
require('./config/cloudinary'); // This loads and configures Cloudinary with env vars

const PORT = process.env.PORT || 5001;

// Connect to MongoDB
connectDB().then(() => {
  console.log('MongoDB Connected Successfully');
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

// ──────────────────────────────
// Graceful Shutdown & Error Handling
// ──────────────────────────────
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Optional: Graceful shutdown on SIGTERM (for Docker/K8s)
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});