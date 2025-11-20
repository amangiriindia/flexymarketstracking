// src/middleware/uploadMiddleware.js
const multer = require('multer');

// Use memory storage — NO DISK, NO LOCAL FILES
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',  // .mov
    'video/x-matroska', // .mkv
    'video/webm'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images (JPEG, PNG, GIF, WebP) and videos (MP4, MOV, WebM) are allowed.'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max per file
    files: 10                    // Max 10 files
  },
  fileFilter
});

// Export configurations
exports.uploadMultiple = upload.array('files', 10);     // For creating posts
exports.uploadSingle   = upload.single('file');         // For avatar, etc.
exports.uploadFields   = upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'videos', maxCount: 3 }
]);

// Multer error handler
exports.handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        message: 'File too large. Maximum size allowed is 20MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        status: 'error',
        message: 'Too many files. Maximum 10 files allowed.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        status: 'error',
        message: 'Unexpected field name. Use "files" for multiple uploads.'
      });
    }
  }

  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.message || 'File upload error'
    });
  }

  next();
};