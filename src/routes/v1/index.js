const express = require('express');
const authRoutes = require('./auth.routes');
const courseScopeRoutes = require('./courseScope.routes');
const courseRoutes = require('./course.routes');
const lessonRoutes = require('./lesson.routes');
const mediaRoutes = require('./media.routes');
const assessmentRoutes = require('./assessment.routes');
const submissionRoutes = require('./submission.routes');
const liveSessionRoutes = require('./liveSession.routes');
const chatRoutes = require('./chat.routes');
const notificationRoutes = require('./notification.routes');
const paymentRoutes = require('./payment.routes');
const adminRoutes = require('./admin.routes');
const studentRoutes = require('./student.routes');
const agentRoutes = require('./agent.routes');
const catalogRoutes = require('./catalog.routes');
const staffSummaryRoutes = require('./staff.routes');
const platformRoutes = require('./platform.routes');

const router = express.Router();

router.use('/platform', platformRoutes);
router.use('/', catalogRoutes);
router.use('/auth', authRoutes);
router.use('/', staffSummaryRoutes);
// Course CRUD (GET/PATCH/DELETE/:id, POST /:id/duplicate) must mount before `/courses/:courseId` scope routes,
// otherwise DELETE /courses/:id and POST /courses/:id/duplicate are swallowed by the scope router and 404.
router.use('/courses', courseRoutes);
router.use('/courses/:courseId', courseScopeRoutes);
router.use('/', lessonRoutes);
router.use('/media', mediaRoutes);
router.use('/assessments', assessmentRoutes);
router.use('/submissions', submissionRoutes);
router.use('/', liveSessionRoutes);
router.use('/', chatRoutes);
router.use('/', notificationRoutes);
router.use('/', paymentRoutes);
router.use('/', adminRoutes);
router.use('/', studentRoutes);
router.use('/agent', agentRoutes);

module.exports = router;
