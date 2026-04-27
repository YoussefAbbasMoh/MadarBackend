const crypto = require('crypto');
const env = require('../config/env');

function canonicalString(body) {
  const copy = { ...body };
  delete copy.signature;
  const keys = Object.keys(copy).sort();
  return keys.map((k) => `${k}=${JSON.stringify(copy[k] === undefined ? null : copy[k])}`).join('&');
}

function signAgentPayload(body) {
  return crypto.createHmac('sha256', env.agentHmacSecret).update(canonicalString(body)).digest('hex');
}

function verifyAgentPayload(body, signature) {
  if (!signature) return false;
  const expected = signAgentPayload(body);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(String(signature), 'utf8'));
  } catch {
    return false;
  }
}

module.exports = { signAgentPayload, verifyAgentPayload, canonicalString };
