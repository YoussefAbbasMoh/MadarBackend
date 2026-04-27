const crypto = require('crypto');
const env = require('../config/env');

function configured() {
  return Boolean(env.paymobApiKey && env.paymobHmacSecret);
}

function buildPaymentKey(orderId, amountCents) {
  if (!configured()) {
    return {
      paymentKey: `dev-payment-key-${orderId}`,
      iframeUrl: 'https://accept.paymob.com/api/acceptance/iframes/1?payment_token=dev',
    };
  }
  return {
    paymentKey: 'configure-paymob',
    iframeUrl: 'https://accept.paymob.com/',
  };
}

function verifyWebhookHmac(body, receivedHmac) {
  if (!env.paymobHmacSecret) return process.env.NODE_ENV !== 'production';
  if (!receivedHmac) return false;
  const serialized = typeof body === 'string' ? body : JSON.stringify(body);
  const hmac = crypto.createHmac('sha512', env.paymobHmacSecret).update(serialized).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac, 'utf8'), Buffer.from(String(receivedHmac), 'utf8'));
  } catch {
    return false;
  }
}

module.exports = { buildPaymentKey, verifyWebhookHmac, configured };
