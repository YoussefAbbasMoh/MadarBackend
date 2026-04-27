const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

/** Single signer for process lifetime so sign/verify always use the same algorithm and secret/keys. */
let signerCache = null;

function createSigner() {
  let priv = env.jwtRsaPrivateKey?.trim();
  let pub = env.jwtRsaPublicKey?.trim();
  if (priv && pub) {
    try {
      const probe = jwt.sign({ sub: 'probe' }, priv, { algorithm: 'RS256', expiresIn: '1m' });
      jwt.verify(probe, pub, { algorithms: ['RS256'] });
    } catch (e) {
      console.warn('[jwt] RSA key pair invalid; falling back to HS256:', e.message);
      priv = '';
      pub = '';
    }
  }
  if (priv && pub) {
    return {
      algorithm: 'RS256',
      sign: (payload) =>
        jwt.sign(payload, priv, { algorithm: 'RS256', expiresIn: env.jwtAccessTtl }),
      verify: (token) => jwt.verify(token, pub, { algorithms: ['RS256'] }),
    };
  }
  const secret = (env.jwtSecret && String(env.jwtSecret).trim()) || 'dev-only-change-me';
  return {
    algorithm: 'HS256',
    sign: (payload) => jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: env.jwtAccessTtl }),
    verify: (token) => jwt.verify(token, secret, { algorithms: ['HS256'] }),
  };
}

function getSigner() {
  if (!signerCache) {
    signerCache = createSigner();
  }
  return signerCache;
}

function signAccessToken(user) {
  const payload = {
    sub: String(user._id),
    role: user.role,
  };
  return getSigner().sign(payload);
}

function verifyAccessToken(token) {
  return getSigner().verify(token);
}

function randomRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

module.exports = { signAccessToken, verifyAccessToken, randomRefreshToken };
