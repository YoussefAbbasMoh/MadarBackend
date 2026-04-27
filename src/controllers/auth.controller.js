const User = require('../models/User');
const { hashPassword, comparePassword } = require('../utils/password');
const { normalizePhoneE164 } = require('../utils/phone');
const { sendOtp, verifyOtp } = require('../services/beone');
const { signAccessToken, randomRefreshToken } = require('../utils/jwt');
const { storeRefreshToken, consumeRefreshToken, revokeRefreshToken } = require('../utils/refreshTokens');

async function otpSend(req, res) {
  const { phone } = req.body;
  if (!phone) {
    res.status(400).json({ error: 'phone is required' });
    return;
  }
  const phoneNorm = normalizePhoneE164(phone);
  if (!phoneNorm || phoneNorm.length < 8) {
    res.status(400).json({ error: 'Invalid phone number' });
    return;
  }
  const result = await sendOtp(phoneNorm);
  res.json({ ok: true, ...(result.devCode ? { devCode: result.devCode } : {}) });
}

async function otpVerify(req, res) {
  const { phone, code, name } = req.body;
  if (!phone || !code) {
    res.status(400).json({ error: 'phone and code are required' });
    return;
  }
  const phoneNorm = normalizePhoneE164(phone);
  if (!phoneNorm || phoneNorm.length < 8) {
    res.status(400).json({ error: 'Invalid phone number' });
    return;
  }
  const ok = await verifyOtp(phoneNorm, code);
  if (!ok) {
    res.status(400).json({ error: 'Invalid or expired code' });
    return;
  }
  let user = await User.findOne({ phone: phoneNorm });
  if (!user) {
    user = await User.create({ phone: phoneNorm, role: 'student', name: name || 'Student' });
  }
  const access = signAccessToken(user);
  const refresh = randomRefreshToken();
  await storeRefreshToken(refresh, user._id);
  user.lastLogin = new Date();
  await user.save();
  res.json({ accessToken: access, refreshToken: refresh, user: sanitizeUser(user) });
}

/** Email/password auth reads only the `User` collection (not Course / staff KPI queries). */
async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }
  const emailNorm = String(email).trim().toLowerCase();
  const user = await User.findOne({ email: emailNorm });
  if (!user || !user.passwordHash) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const match = await comparePassword(password, user.passwordHash);
  if (!match) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  if (user.role === 'student') {
    res.status(403).json({ error: 'Use phone OTP for students' });
    return;
  }
  const access = signAccessToken(user);
  const refresh = randomRefreshToken();
  await storeRefreshToken(refresh, user._id);
  user.lastLogin = new Date();
  await user.save();
  res.json({ accessToken: access, refreshToken: refresh, user: sanitizeUser(user) });
}

async function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: 'refreshToken is required' });
    return;
  }
  const userId = await consumeRefreshToken(refreshToken);
  if (!userId) {
    res.status(401).json({ error: 'Invalid refresh token' });
    return;
  }
  const user = await User.findById(userId);
  if (!user) {
    res.status(401).json({ error: 'Invalid refresh token' });
    return;
  }
  const access = signAccessToken(user);
  const nextRefresh = randomRefreshToken();
  await storeRefreshToken(nextRefresh, user._id);
  res.json({ accessToken: access, refreshToken: nextRefresh });
}

async function logout(req, res) {
  const { refreshToken } = req.body;
  if (refreshToken) await revokeRefreshToken(refreshToken);
  res.json({ ok: true });
}

async function passwordReset(req, res) {
  const { phone, code, newPassword } = req.body;
  if (!phone || !code || !newPassword) {
    res.status(400).json({ error: 'phone, code, and newPassword are required' });
    return;
  }
  const phoneNorm = normalizePhoneE164(phone);
  if (!phoneNorm || phoneNorm.length < 8) {
    res.status(400).json({ error: 'Invalid phone number' });
    return;
  }
  const ok = await verifyOtp(phoneNorm, code);
  if (!ok) {
    res.status(400).json({ error: 'Invalid or expired code' });
    return;
  }
  const user = await User.findOne({ phone: phoneNorm });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  res.json({ ok: true });
}

function sanitizeUser(user) {
  const o = user.toObject ? user.toObject() : user;
  delete o.passwordHash;
  return o;
}

module.exports = {
  otpSend,
  otpVerify,
  login,
  refresh,
  logout,
  passwordReset,
};
