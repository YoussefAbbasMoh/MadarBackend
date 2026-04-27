const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { asyncHandler } = require('../../utils/asyncHandler');
const staff = require('../../controllers/staff.controller');
const workspace = require('../../controllers/staffWorkspace.controller');

const router = express.Router();
const staffRoles = ['super_admin', 'instructor', 'teacher', 'doctor', 'assistant'];
const workspaceRoles = ['super_admin', 'instructor', 'teacher', 'doctor'];

router.get('/staff/summary', authenticate, authorize(staffRoles), asyncHandler(staff.summary));
router.get('/staff/grading-queue', authenticate, authorize(staffRoles), asyncHandler(staff.gradingQueue));
router.get('/staff/insights', authenticate, authorize(staffRoles), asyncHandler(staff.insights));

router.get('/staff/workspace/profile', authenticate, authorize(workspaceRoles), asyncHandler(workspace.getProfile));
router.patch('/staff/workspace/profile', authenticate, authorize(workspaceRoles), asyncHandler(workspace.patchProfile));
router.get('/staff/workspace/assistants', authenticate, authorize(workspaceRoles), asyncHandler(workspace.listAssistants));
router.post('/staff/workspace/assistants', authenticate, authorize(workspaceRoles), asyncHandler(workspace.createAssistant));

module.exports = router;
