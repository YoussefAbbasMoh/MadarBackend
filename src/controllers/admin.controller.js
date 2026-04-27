const Package = require('../models/Package');
const { hashPassword } = require('../utils/password');
const PromoCode = require('../models/PromoCode');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

async function listPackages(req, res) {
  const items = await Package.find().sort({ createdAt: -1 }).lean();
  res.json({ items });
}

async function createPackage(req, res) {
  const p = await Package.create(req.body);
  res.status(201).json({ package: p });
}

async function updatePackage(req, res) {
  const p = await Package.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ package: p });
}

async function listPromos(req, res) {
  const items = await PromoCode.find().sort({ createdAt: -1 }).lean();
  res.json({ items });
}

async function createPromo(req, res) {
  const p = await PromoCode.create(req.body);
  res.status(201).json({ promoCode: p });
}

async function updatePromo(req, res) {
  const p = await PromoCode.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ promoCode: p });
}

async function listTransactions(req, res) {
  const items = await Transaction.find().sort({ createdAt: -1 }).limit(500).lean();
  res.json({ items });
}

async function listUsers(req, res) {
  const roles = ['instructor', 'teacher', 'doctor', 'assistant'];
  const items = await User.find({ role: { $in: roles } }).sort({ createdAt: -1 }).lean();
  res.json({ items });
}

async function createTeacher(req, res) {
  const { name, email, phone, password, role } = req.body;
  if (!email || !password || !name) {
    res.status(400).json({ error: 'name, email, password required' });
    return;
  }
  const r = ['instructor', 'teacher', 'doctor'].includes(role) ? role : 'doctor';
  const user = await User.create({
    name,
    email,
    phone,
    role: r,
    passwordHash: await hashPassword(password),
  });
  res.status(201).json({ user: { ...user.toObject(), passwordHash: undefined } });
}

async function createAssistant(req, res) {
  const { name, email, phone, password, ownedBy } = req.body;
  if (!email || !password || !name) {
    res.status(400).json({ error: 'name, email, password required' });
    return;
  }
  const user = await User.create({
    name,
    email,
    phone,
    role: 'assistant',
    ownedBy: ownedBy || req.user._id,
    passwordHash: await hashPassword(password),
  });
  res.status(201).json({ user: { ...user.toObject(), passwordHash: undefined } });
}

async function deactivateUser(req, res) {
  await User.findByIdAndUpdate(req.params.id, { $set: { email: `inactive_${req.params.id}@invalid.local` } });
  res.json({ ok: true });
}

async function revenue(req, res) {
  const paid = await Transaction.aggregate([
    { $match: { status: 'paid' } },
    { $group: { _id: { $month: '$createdAt' }, total: { $sum: '$amount' } } },
  ]);
  res.json({ summary: paid });
}

module.exports = {
  listPackages,
  createPackage,
  updatePackage,
  listPromos,
  createPromo,
  updatePromo,
  listTransactions,
  listUsers,
  createTeacher,
  createAssistant,
  deactivateUser,
  revenue,
};
