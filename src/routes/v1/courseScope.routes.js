const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { asyncHandler } = require('../../utils/asyncHandler');
const ctrl = require('../../controllers/courseScope.controller');

const router = express.Router({ mergeParams: true });

const staff = ['super_admin', 'instructor', 'teacher', 'doctor', 'assistant'];
const enrollRoles = ['super_admin', 'instructor', 'teacher', 'doctor'];

router.use(authenticate);

router.get('/students', authorize(staff), asyncHandler(ctrl.listStudents));
router.post('/students', authorize(enrollRoles), asyncHandler(ctrl.enrollStudent));
router.delete('/students/:userId', authorize(enrollRoles), asyncHandler(ctrl.removeStudent));
router.get('/analytics', authorize(staff), asyncHandler(ctrl.analytics));
router.post('/assistants', authorize(enrollRoles), asyncHandler(ctrl.addAssistant));
router.patch('/assistants/:userId', authorize(enrollRoles), asyncHandler(ctrl.patchAssistant));
router.delete('/assistants/:userId', authorize(enrollRoles), asyncHandler(ctrl.removeAssistant));

module.exports = router;
