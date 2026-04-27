const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { asyncHandler } = require('../../utils/asyncHandler');
const ctrl = require('../../controllers/assessment.controller');

const router = express.Router();

const staff = ['super_admin', 'instructor', 'teacher', 'doctor', 'assistant'];
const student = ['student'];

router.use(authenticate);

router.post('/', authorize(staff), asyncHandler(ctrl.create));
router.patch('/:id', authorize(staff), asyncHandler(ctrl.update));
router.delete('/:id', authorize(staff), asyncHandler(ctrl.remove));
router.post('/:id/submit', authorize(student), asyncHandler(ctrl.submit));
router.get('/:id/student-view', authorize(student), asyncHandler(ctrl.studentView));
router.get('/:id/result', authorize(student), asyncHandler(ctrl.result));
router.get('/:id/submissions/export', authorize(staff), asyncHandler(ctrl.exportSubmissions));
router.get('/:id/submissions', authorize(staff), asyncHandler(ctrl.listSubmissions));
router.get('/:id', authorize(staff), asyncHandler(ctrl.getOne));

module.exports = router;
