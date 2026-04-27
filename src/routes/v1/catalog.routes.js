const express = require('express');
const { asyncHandler } = require('../../utils/asyncHandler');
const catalog = require('../../controllers/catalog.controller');

const router = express.Router();

/** Public catalog — no authentication */
router.get('/catalog/instructors', asyncHandler(catalog.listInstructors));
router.get('/catalog/instructors/:id', asyncHandler(catalog.getInstructor));
router.get('/catalog/courses', asyncHandler(catalog.listCourses));
router.get('/catalog/courses/:id', asyncHandler(catalog.getCourse));

module.exports = router;
