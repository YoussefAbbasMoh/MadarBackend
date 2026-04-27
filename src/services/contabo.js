const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const env = require('../config/env');

let client;

function getClient() {
  if (!env.contaboEndpoint || !env.contaboAccessKey || !env.contaboSecretKey) return null;
  if (!client) {
    client = new S3Client({
      region: env.contaboRegion || 'eu2',
      endpoint: env.contaboEndpoint,
      credentials: {
        accessKeyId: env.contaboAccessKey,
        secretAccessKey: env.contaboSecretKey,
      },
      forcePathStyle: true,
    });
  }
  return client;
}

async function presignPut({ key, contentType, expiresSeconds = 900 }) {
  const c = getClient();
  if (!c) {
    const e = new Error('Contabo object storage is not configured');
    e.status = 503;
    throw e;
  }
  const cmd = new PutObjectCommand({
    Bucket: env.contaboBucket,
    Key: key,
    ContentType: contentType || 'application/octet-stream',
  });
  const url = await getSignedUrl(c, cmd, { expiresIn: expiresSeconds });
  return { url, key, bucket: env.contaboBucket, expiresIn: expiresSeconds };
}

module.exports = { presignPut, getClient };
