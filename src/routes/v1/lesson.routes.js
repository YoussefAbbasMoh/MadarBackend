const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { authorize } = require('../../middleware/rbac');
const { asyncHandler } = require('../../utils/asyncHandler');
const lesson = require('../../controllers/lesson.controller');

const router = express.Router();

const staffStudent = ['super_admin', 'instructor', 'teacher', 'doctor', 'assistant', 'student'];
const contentRoles = ['super_admin', 'instructor', 'teacher', 'doctor', 'assistant'];

router.use(authenticate);

router.get('/courses/:id/lessons', authorize(staffStudent), asyncHandler(lesson.listLessons));
router.post('/courses/:id/lessons', authorize(contentRoles), asyncHandler(lesson.createLesson));
router.patch('/lessons/:id', authorize(contentRoles), asyncHandler(lesson.updateLesson));
router.delete('/lessons/:id', authorize(contentRoles), asyncHandler(lesson.deleteLesson));
router.post('/lessons/:id/reorder', authorize(contentRoles), asyncHandler(lesson.reorderLessons));
router.post('/lessons/:id/sublessons', authorize(contentRoles), asyncHandler(lesson.createSubLesson));
router.patch('/sublessons/:id', authorize(contentRoles), asyncHandler(lesson.updateSubLesson));
router.delete('/sublessons/:id', authorize(contentRoles), asyncHandler(lesson.deleteSubLesson));
router.get('/sublessons/:id/video', authorize(staffStudent), asyncHandler(lesson.getSubLessonVideo));

module.exports = router;
