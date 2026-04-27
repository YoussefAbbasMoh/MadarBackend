const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { asyncHandler } = require('../../utils/asyncHandler');
const ctrl = require('../../controllers/student.controller');

const router = express.Router();

const profileRoles = ['super_admin', 'instructor', 'teacher', 'doctor', 'assistant'];

router.use(authenticate);
router.get('/students/:id/profile', authorize(profileRoles), asyncHandler(ctrl.profile));
router.get('/students/:id/report', authorize(profileRoles), asyncHandler(ctrl.report));
router.post('/students/:id/report/whatsapp', authorize(['super_admin', 'instructor']), asyncHandler(ctrl.reportWhatsapp));

module.exports = router;
