// src/services/cloudinaryService.js
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

const uploadFromBuffer = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'posts',
        resource_type: 'auto',
        ...options
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

exports.uploadMedia = async (files) => {
  if (!files || files.length === 0) return [];

  const uploadPromises = files.map(async (file) => {
    const result = await uploadFromBuffer(file.buffer);

    return {
      type: file.mimetype.startsWith('image/') ? 'image' : 'video',
      url: result.secure_url,
      publicId: result.public_id,
      thumbnail: result.thumbnail_url || result.secure_url
    };
  });

  return Promise.all(uploadPromises);
};

exports.deleteMedia = async (publicIds) => {
  if (!publicIds || publicIds.length === 0) return;
  const promises = publicIds.map(id => cloudinary.uploader.destroy(id));
  await Promise.all(promises);
};