const { isValidDbId } = require('../lib/idCompat');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Course = require('../models/Course');
const Progress = require('../models/Progress');
const paymob = require('../services/paymob');

async function initiate(req, res) {
  const { packageId, courseId, amount, promoCode } = req.body;

  if (courseId) {
    if (!isValidDbId(courseId)) {
      res.status(400).json({ error: 'Invalid courseId' });
      return;
    }
    const course = await Course.findById(courseId);
    if (!course || course.status !== 'active') {
      res.status(404).json({ error: 'Course not found or not available for purchase' });
      return;
    }
    const enrolled = (course.enrolledStudentIds || []).some((id) => String(id) === String(req.user._id));
    if (enrolled) {
      res.status(400).json({ error: 'Already enrolled in this course' });
      return;
    }
    const finalAmount = Number(course.price);
    if (!Number.isFinite(finalAmount) || finalAmount < 0) {
      res.status(400).json({ error: 'Invalid course price' });
      return;
    }
    if (finalAmount === 0) {
      await Course.findByIdAndUpdate(course._id, { $addToSet: { enrolledStudentIds: req.user._id } });
      await User.findByIdAndUpdate(req.user._id, { $addToSet: { assignedCourses: course._id } });
      await Progress.findOneAndUpdate(
        { studentId: req.user._id, courseId: course._id },
        { $setOnInsert: { completedSubLessons: [], overallPercent: 0 } },
        { upsert: true },
      );
      res.json({ enrolled: true, message: 'Free course — enrolled without checkout.' });
      return;
    }
    const tx = await Transaction.create({
      studentId: req.user._id,
      courseId: course._id,
      amount: finalAmount,
      promoCode,
      status: 'pending',
    });
    const keys = paymob.buildPaymentKey(String(tx._id), Math.round(Number(finalAmount) * 100));
    res.json({ transactionId: tx._id, paymentKey: keys.paymentKey, iframeUrl: keys.iframeUrl });
    return;
  }

  if (!packageId || amount === undefined || amount === null) {
    res.status(400).json({ error: 'courseId or (packageId and amount) required' });
    return;
  }
  const tx = await Transaction.create({
    studentId: req.user._id,
    packageId,
    amount,
    promoCode,
    status: 'pending',
  });
  const keys = paymob.buildPaymentKey(String(tx._id), Math.round(Number(amount) * 100));
  res.json({ transactionId: tx._id, paymentKey: keys.paymentKey, iframeUrl: keys.iframeUrl });
}

async function webhook(req, res) {
  const hmac = req.headers['hmac'] || req.body?.hmac;
  if (!paymob.verifyWebhookHmac(req.body, hmac)) {
    res.status(400).end();
    return;
  }
  const success = req.body?.success === true || req.body?.success === 'true';
  const orderId = req.body?.order?.id || req.body?.merchant_order_id;
  if (!orderId) {
    res.status(400).end();
    return;
  }
  const tx = await Transaction.findById(orderId);
  if (!tx) {
    res.status(404).end();
    return;
  }
  tx.status = success ? 'paid' : 'failed';
  tx.paymobRef = req.body?.id || tx.paymobRef;
  await tx.save();
  if (success) {
    if (tx.courseId) {
      await Course.findByIdAndUpdate(tx.courseId, { $addToSet: { enrolledStudentIds: tx.studentId } });
      await User.findByIdAndUpdate(tx.studentId, { $addToSet: { assignedCourses: tx.courseId } });
      await Progress.findOneAndUpdate(
        { studentId: tx.studentId, courseId: tx.courseId },
        { $setOnInsert: { completedSubLessons: [], overallPercent: 0 } },
        { upsert: true },
      );
    } else if (tx.packageId) {
      await User.findByIdAndUpdate(tx.studentId, { packageId: tx.packageId });
    }
  }
  res.json({ ok: true });
}

async function receipt(req, res) {
  const tx = await Transaction.findById(req.params.id);
  if (!tx || String(tx.studentId) !== String(req.user._id)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.type('application/pdf');
  res.send(Buffer.from(`%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF`));
}

module.exports = { initiate, webhook, receipt };
