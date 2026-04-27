const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { asyncHandler } = require('../../utils/asyncHandler');
const ctrl = require('../../controllers/assessment.controller');

const router = express.Router();
const staff = ['super_admin', 'instructor', 'teacher', 'doctor', 'assistant'];

router.use(authenticate);
router.patch('/:id/grade', authorize(staff), asyncHandler(ctrl.gradeSubmission));

module.exports = router;
