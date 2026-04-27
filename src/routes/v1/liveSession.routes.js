const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { asyncHandler } = require('../../utils/asyncHandler');
const ctrl = require('../../controllers/liveSession.controller');

const router = express.Router();

const staffStudent = ['super_admin', 'instructor', 'teacher', 'doctor', 'assistant', 'student'];
const hosts = ['super_admin', 'instructor', 'teacher', 'doctor', 'assistant'];

router.post('/live/recording-ready', asyncHandler(ctrl.recordingWebhook));

router.use(authenticate);
router.get('/live-sessions', authorize(staffStudent), asyncHandler(ctrl.list));
router.post('/live-sessions', authorize(hosts), asyncHandler(ctrl.create));
router.get('/live-sessions/:id', authorize(staffStudent), asyncHandler(ctrl.getOne));
router.patch('/live-sessions/:id', authorize(hosts), asyncHandler(ctrl.update));
router.delete('/live-sessions/:id', authorize(hosts), asyncHandler(ctrl.remove));
router.post('/live-sessions/:id/join', authorize(staffStudent), asyncHandler(ctrl.join));

module.exports = router;
