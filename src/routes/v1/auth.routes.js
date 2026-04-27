const express = require('express');
const rateLimit = require('express-rate-limit');
const { asyncHandler } = require('../../utils/asyncHandler');
const auth = require('../../controllers/auth.controller');

const router = express.Router();

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/otp/send', otpLimiter, asyncHandler(auth.otpSend));
router.post('/otp/verify', asyncHandler(auth.otpVerify));
router.post('/login', asyncHandler(auth.login));
router.post('/refresh', asyncHandler(auth.refresh));
router.post('/logout', asyncHandler(auth.logout));
router.post('/password/reset', asyncHandler(auth.passwordReset));

module.exports = router;
