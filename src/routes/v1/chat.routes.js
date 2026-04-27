const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { asyncHandler } = require('../../utils/asyncHandler');
const ctrl = require('../../controllers/chat.controller');

const router = express.Router();

const roles = ['super_admin', 'instructor', 'teacher', 'doctor', 'assistant', 'student'];
const staffRoles = ['super_admin', 'instructor', 'teacher', 'doctor', 'assistant'];

router.use(authenticate, authorize(roles));
router.get('/chat/inbox', authorize(staffRoles), asyncHandler(ctrl.staffInbox));
router.patch('/chat/:courseId/read', authorize(staffRoles), asyncHandler(ctrl.markRead));
router.get('/chat/:courseId', asyncHandler(ctrl.history));
router.post('/chat/:courseId', asyncHandler(ctrl.send));

module.exports = router;
