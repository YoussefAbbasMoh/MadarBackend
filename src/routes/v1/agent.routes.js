const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { asyncHandler } = require('../../utils/asyncHandler');
const agent = require('../../controllers/agent.controller');

const router = express.Router();

const studentChain = [authenticate, authorize(['student'])];

router.get('/version', asyncHandler(agent.version));
router.get('/download/:os', ...studentChain, asyncHandler(agent.download));
router.post('/register', ...studentChain, asyncHandler(agent.register));
router.post('/heartbeat', ...studentChain, asyncHandler(agent.heartbeat));
router.post('/event', ...studentChain, asyncHandler(agent.event));
router.delete('/session', ...studentChain, asyncHandler(agent.terminateSession));

module.exports = router;
