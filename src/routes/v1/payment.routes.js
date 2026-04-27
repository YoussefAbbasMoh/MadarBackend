const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { asyncHandler } = require('../../utils/asyncHandler');
const ctrl = require('../../controllers/payment.controller');

const router = express.Router();

router.post('/payments/webhook', asyncHandler(ctrl.webhook));

router.use(authenticate, authorize(['student']));
router.post('/payments/initiate', asyncHandler(ctrl.initiate));
router.get('/payments/receipt/:id', asyncHandler(ctrl.receipt));

module.exports = router;
