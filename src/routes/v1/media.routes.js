const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { asyncHandler } = require('../../utils/asyncHandler');
const media = require('../../controllers/media.controller');

const router = express.Router();

const uploaders = ['super_admin', 'instructor', 'teacher', 'assistant'];

router.use(authenticate, authorize(uploaders));

router.post('/upload', asyncHandler(media.cloudinarySignedUpload));
router.post('/file-upload', asyncHandler(media.contaboPresignStub));

module.exports = router;
