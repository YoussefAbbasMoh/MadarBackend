const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { asyncHandler } = require('../../utils/asyncHandler');
const ctrl = require('../../controllers/notification.controller');

const router = express.Router();

const staff = ['super_admin', 'instructor', 'teacher', 'doctor', 'assistant'];
const historyRoles = ['super_admin', 'instructor', 'teacher', 'doctor'];

router.use(authenticate);
router.post('/notifications/broadcast', authorize(staff), asyncHandler(ctrl.broadcast));
router.get('/notifications/unread-count', authorize(['student', ...staff]), asyncHandler(ctrl.unreadCount));
router.get('/notifications', authorize(['student', ...staff]), asyncHandler(ctrl.listMine));
router.patch('/notifications/read-all', authorize(['student', ...staff]), asyncHandler(ctrl.readAll));
router.patch('/notifications/:id/read', authorize(['student', ...staff]), asyncHandler(ctrl.readOne));
router.get('/notifications/history', authorize(historyRoles), asyncHandler(ctrl.history));

module.exports = router;
