const express = require('express');
const { getContext } = require('../../controllers/platform.controller');

const router = express.Router();

router.get('/context', getContext);

module.exports = router;
