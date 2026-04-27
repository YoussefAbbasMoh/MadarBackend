const User = require('../models/User');
const Progress = require('../models/Progress');
const Submission = require('../models/Submission');
const Course = require('../models/Course');
const { PLATFORM_STUDENT_VIEWERS, isDoctorLike } = require('../constants/roles');
const P = require('../constants/assistantPermissions');
const { toObjectId } = require('../utils/courseListQuery');

async function assertCanViewStudent(req, studentId) {
  if (req.user.role === 'super_admin' || req.user.role === 'instructor') return true;
  const staffId = toObjectId(req.user._id);
  if (!staffId) return false;
  if (isDoctorLike(req.user.role)) {
    const count = await Course.countDocuments({ ownerId: staffId, enrolledStudentIds: studentId });
    return count > 0;
  }
  if (req.user.role === 'assistant') {
    const rows = await Course.find({
      'assistants.userId': staffId,
      enrolledStudentIds: studentId,
    })
      .select('assistants')
      .limit(20)
      .lean();
    return rows.some((c) => {
      const entry = (c.assistants || []).find((a) => String(a.userId) === String(staffId));
      const set = new Set(entry?.permissions || []);
      return set.has(P.STUDENTS) || set.has(P.GRADING);
    });
  }
  return false;
}

async function profile(req, res) {
  const ok = await assertCanViewStudent(req, req.params.id);
  if (!ok) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const user = await User.findById(req.params.id).lean();
  const progress = await Progress.find({ studentId: req.params.id }).lean();
  const submissions = await Submission.find({ studentId: req.params.id }).sort({ submittedAt: -1 }).limit(50).lean();
  res.json({ user, progress, submissions });
}

async function report(req, res) {
  const ok = await assertCanViewStudent(req, req.params.id);
  if (!ok) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  res.type('application/pdf');
  res.send(Buffer.from(`%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF`));
}

async function reportWhatsapp(req, res) {
  if (!['super_admin', 'instructor'].includes(req.user.role)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  res.json({ ok: true, queued: true });
}

module.exports = { profile, report, reportWhatsapp };
