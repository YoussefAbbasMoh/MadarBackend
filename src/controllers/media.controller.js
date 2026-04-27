const { buildSignedUploadParams } = require('../services/cloudinary');
const { presignPut } = require('../services/contabo');

async function cloudinarySignedUpload(req, res) {
  try {
    const { folder } = req.body;
    const params = buildSignedUploadParams(folder || 'lms');
    res.json({
      uploadUrl: `https://api.cloudinary.com/v1_1/${params.cloudName}/auto/upload`,
      uploadFields: {
        api_key: params.apiKey,
        folder: params.folder,
        timestamp: params.timestamp,
        signature: params.signature,
      },
    });
  } catch (err) {
    res.status(err.status || 503).json({ error: err.message });
  }
}

async function contaboPresignStub(req, res) {
  try {
    const { key, contentType } = req.body;
    if (!key) {
      res.status(400).json({ error: 'key required (object key/path in bucket)' });
      return;
    }
    const out = await presignPut({ key, contentType });
    res.json(out);
  } catch (err) {
    res.status(err.status || 503).json({ error: err.message });
  }
}

module.exports = { cloudinarySignedUpload, contaboPresignStub };
