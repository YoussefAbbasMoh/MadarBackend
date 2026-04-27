const cloudinary = require('cloudinary').v2;
const env = require('../config/env');

let configured = false;

function ensureConfigured() {
  if (configured) return;
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    const e = new Error('Cloudinary is not configured');
    e.status = 503;
    throw e;
  }
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });
  configured = true;
}

function buildSignedUploadParams(folder = 'lms') {
  ensureConfigured();
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { folder, timestamp };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, env.cloudinaryApiSecret);
  return {
    cloudName: env.cloudinaryCloudName,
    apiKey: env.cloudinaryApiKey,
    timestamp,
    signature,
    folder,
  };
}

function signedVideoUrl(publicId, { expiresSeconds = 600 } = {}) {
  ensureConfigured();
  return cloudinary.url(publicId, {
    resource_type: 'video',
    sign_url: true,
    secure: true,
    type: 'upload',
    expires_at: Math.floor(Date.now() / 1000) + expiresSeconds,
  });
}

module.exports = { buildSignedUploadParams, signedVideoUrl };
