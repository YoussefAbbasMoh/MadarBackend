const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { asyncHandler } = require('../../utils/asyncHandler');
const course = require('../../controllers/course.controller');

const router = express.Router();

const staffStudent = ['super_admin', 'instructor', 'teacher', 'doctor', 'assistant', 'student'];
const staffOnly = ['super_admin', 'instructor', 'teacher', 'doctor', 'assistant'];
const creators = ['super_admin', 'instructor', 'teacher', 'doctor'];

router.use(authenticate);

router.get('/', authorize(staffStudent), asyncHandler(course.listCourses));
router.get('/:id/assessments', authorize(staffOnly), asyncHandler(course.listAssessmentsForCourse));
router.get('/:id', authorize(staffStudent), asyncHandler(course.getCourse));
router.post('/', authorize(creators), asyncHandler(course.createCourse));
router.patch('/:id', authorize(creators), asyncHandler(course.updateCourse));
router.delete('/:id', authorize(creators), asyncHandler(course.archiveCourse));
router.patch('/:id/status', authorize(creators), asyncHandler(course.setCourseStatus));
router.post('/:id/duplicate', authorize(creators), asyncHandler(course.duplicateCourse));

module.exports = router;
