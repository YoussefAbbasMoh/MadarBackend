const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { asyncHandler } = require('../../utils/asyncHandler');
const ctrl = require('../../controllers/admin.controller');

const router = express.Router();

const superOnly = ['super_admin'];

router.use(authenticate, authorize(superOnly));

router.get('/admin/packages', asyncHandler(ctrl.listPackages));
router.post('/admin/packages', asyncHandler(ctrl.createPackage));
router.patch('/admin/packages/:id', asyncHandler(ctrl.updatePackage));

router.get('/admin/promo-codes', asyncHandler(ctrl.listPromos));
router.post('/admin/promo-codes', asyncHandler(ctrl.createPromo));
router.patch('/admin/promo-codes/:id', asyncHandler(ctrl.updatePromo));

router.get('/admin/transactions', asyncHandler(ctrl.listTransactions));
router.get('/admin/users', asyncHandler(ctrl.listUsers));
router.post('/admin/users/teacher', asyncHandler(ctrl.createTeacher));
router.post('/admin/users/assistant', asyncHandler(ctrl.createAssistant));
router.patch('/admin/users/:id/deactivate', asyncHandler(ctrl.deactivateUser));
router.get('/admin/revenue', asyncHandler(ctrl.revenue));

module.exports = router;
