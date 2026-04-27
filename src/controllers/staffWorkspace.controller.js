const User = require('../models/User');
const { hashPassword } = require('../utils/password');
const { normalizePhoneE164 } = require('../utils/phone');
const { publicPortfolioFromDoc, sanitizePortfolioPatch } = require('../utils/instructorPortfolio');

const CAN_MANAGE_PORTFOLIO = ['super_admin', 'instructor', 'teacher', 'doctor'];
const CAN_CREATE_ASSISTANT = ['super_admin', 'instructor', 'teacher', 'doctor'];

function assertRole(user, allowed, res) {
  if (!allowed.includes(user.role)) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

/**
 * GET /staff/workspace/profile — current user + portfolio (for settings UI).
 */
async function getProfile(req, res) {
  if (!assertRole(req.user, CAN_MANAGE_PORTFOLIO, res)) return;
  const user = await User.findById(req.user._id).select('-passwordHash').lean();
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({
    user: {
      ...user,
      instructorPortfolio: publicPortfolioFromDoc(user.instructorPortfolio),
    },
  });
}

/**
 * PATCH /staff/workspace/profile — merge `instructorPortfolio` fields from body.
 */
async function patchProfile(req, res) {
  if (!assertRole(req.user, CAN_MANAGE_PORTFOLIO, res)) return;
  const patch = sanitizePortfolioPatch(req.body);
  if (!Object.keys(patch).length) {
    res.status(400).json({ error: 'No valid portfolio fields to update' });
    return;
  }
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const prev =
    user.instructorPortfolio && typeof user.instructorPortfolio.toObject === 'function'
      ? user.instructorPortfolio.toObject()
      : { ...(user.instructorPortfolio || {}) };
  user.set('instructorPortfolio', { ...prev, ...patch });
  await user.save();
  res.json({
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      instructorPortfolio: publicPortfolioFromDoc(user.instructorPortfolio),
    },
  });
}

/**
 * GET /staff/workspace/assistants — assistants owned by the current user.
 */
async function listAssistants(req, res) {
  if (!assertRole(req.user, CAN_CREATE_ASSISTANT, res)) return;
  const items = await User.find({ role: 'assistant', ownedBy: req.user._id })
    .select('name email phone createdAt')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ items });
}

/**
 * POST /staff/workspace/assistants — create assistant account (login: email + password), owned by you.
 */
async function createAssistant(req, res) {
  if (!assertRole(req.user, CAN_CREATE_ASSISTANT, res)) return;
  const { name, email, phone, password } = req.body;
  if (!email || !password || !name) {
    res.status(400).json({ error: 'name, email, and password are required' });
    return;
  }
  if (String(password).length < 6) {
    res.status(400).json({ error: 'password must be at least 6 characters' });
    return;
  }
  const emailNorm = String(email).trim().toLowerCase();
  const dup = await User.findOne({ email: emailNorm }).select('_id').lean();
  if (dup) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }
  let phoneNorm;
  if (phone && String(phone).trim()) {
    phoneNorm = normalizePhoneE164(phone);
    if (!phoneNorm) {
      res.status(400).json({ error: 'Invalid phone number' });
      return;
    }
    const phoneDup = await User.findOne({ phone: phoneNorm }).select('_id').lean();
    if (phoneDup) {
      res.status(409).json({ error: 'An account with this phone already exists' });
      return;
    }
  }
  const payload = {
    name: String(name).trim(),
    email: emailNorm,
    role: 'assistant',
    ownedBy: req.user._id,
    passwordHash: await hashPassword(String(password)),
  };
  if (phoneNorm) payload.phone = phoneNorm;
  const user = await User.create(payload);
  const o = user.toObject();
  delete o.passwordHash;
  res.status(201).json({ user: o });
}

module.exports = {
  getProfile,
  patchProfile,
  listAssistants,
  createAssistant,
};
