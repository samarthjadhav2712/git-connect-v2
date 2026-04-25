const express    = require('express');
const router     = express.Router();
const rateLimit  = require('express-rate-limit');

const { authenticateUser, authenticateAdmin } = require('../middlewares/authMiddleware');

// Controllers
const auth       = require('../controllers/authController');
const attendance = require('../controllers/attendanceController');
const results    = require('../controllers/resultsController');
const exams      = require('../controllers/examsController');
const syllabus   = require('../controllers/syllabusController');
const calendar   = require('../controllers/calendarController');
const placement  = require('../controllers/placementController');
const admin      = require('../controllers/adminController');

// ── Rate limiters ────────────────────────────────────────────
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 5,
  message: { success: false, message: 'Too many OTP requests. Try again in 10 minutes.' },
});

// ══════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════
router.post('/auth/send-otp',    otpLimiter, auth.sendOTP);
router.post('/auth/verify-otp',             auth.verifyOTP);
router.post('/auth/admin/login',            auth.adminLogin);

// ══════════════════════════════════════════════════════════════
// STUDENT VIEW ROUTES  (authenticateUser — swap in when ready)
// ══════════════════════════════════════════════════════════════
router.get('/attendance/:studentId', authenticateUser, attendance.getAttendance);
router.get('/results/:studentId',    authenticateUser, results.getResults);
router.get('/exams/:studentId',      authenticateUser, exams.getExams);
router.get('/syllabus/:studentId',   authenticateUser, syllabus.getSyllabusForStudent);
router.get('/calendar',              calendar.getCalendar);

// ══════════════════════════════════════════════════════════════
// GUEST ROUTES  (no auth)
// ══════════════════════════════════════════════════════════════
router.get('/guest/calendar',   calendar.getCalendar);
router.get('/guest/syllabus',   syllabus.getSyllabusBySem);
router.get('/guest/placements', placement.getPlacementStats);

// ══════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ══════════════════════════════════════════════════════════════

// Users (parents)
router.get('/admin/users',  authenticateAdmin, admin.listUsers);
router.post('/admin/users', authenticateAdmin, admin.createUser);

// Students
router.get('/admin/students',      authenticateAdmin, admin.listStudents);
router.post('/admin/students',     authenticateAdmin, admin.createStudent);
router.put('/admin/students/:id',  authenticateAdmin, admin.updateStudent);

// Courses
router.get('/admin/courses',               authenticateAdmin, admin.listCourses);
router.post('/admin/courses',              authenticateAdmin, admin.createCourse);
router.post('/admin/courses/assign-sem',   authenticateAdmin, admin.assignCourseToSem);

// Student–Course enrollment (new: student_courses table)
router.get('/admin/student-courses',          authenticateAdmin, admin.listStudentCourses);
router.post('/admin/student-courses',         authenticateAdmin, admin.enrollStudentCourse);
router.put('/admin/student-courses/:id',      authenticateAdmin, admin.updateStudentCourseStatus);

// Components
router.get('/admin/components',           authenticateAdmin, admin.listComponents);
router.post('/admin/components/assign',   authenticateAdmin, admin.assignComponent);
router.get('/admin/course-components',    authenticateAdmin, admin.listCourseComponents);

// Attendance
router.post('/admin/attendance', authenticateAdmin, admin.upsertAttendance);

// Marks & Results
router.post('/admin/marks',             authenticateAdmin, admin.upsertMark);
router.post('/admin/results/semester',  authenticateAdmin, admin.upsertSemesterResult);

// Exams
router.get('/admin/exams',         authenticateAdmin, admin.listExams);
router.post('/admin/exams',        authenticateAdmin, admin.createExam);
router.put('/admin/exams/:id',     authenticateAdmin, admin.updateExam);
router.delete('/admin/exams/:id',  authenticateAdmin, admin.deleteExam);

// Calendar Events
router.post('/admin/events',       authenticateAdmin, admin.createEvent);
router.put('/admin/events/:id',    authenticateAdmin, admin.updateEvent);
router.delete('/admin/events/:id', authenticateAdmin, admin.deleteEvent);

// Placements
router.post('/admin/placements', authenticateAdmin, admin.upsertPlacementStat);

module.exports = router;