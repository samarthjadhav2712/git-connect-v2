const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const {
  authenticateUser,
  authenticateAdmin,
} = require("../middlewares/authMiddleware");

// Controllers
const auth = require("../controllers/authController");
const attendance = require("../controllers/attendanceController");
const results = require("../controllers/resultsController");
const exams = require("../controllers/examsController");
const syllabus = require("../controllers/syllabusController");
const calendar = require("../controllers/calendarController");
const placement = require("../controllers/placementController");
const admin = require("../controllers/adminController");
const performance = require("../controllers/studPerformanceController");

// ── Rate limiters ────────────────────────────────────────────
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 5,
  message: {
    success: false,
    message: "Too many OTP requests. Try again in 10 minutes.",
  },
});

// ══════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════
router.post("/auth/send-otp", otpLimiter, auth.sendOTP);
router.post("/auth/verify-otp", auth.verifyOTP);
router.post("/auth/admin/login", auth.adminLogin);

// ══════════════════════════════════════════════════════════════
// STUDENT VIEW ROUTES  (authenticateUser — swap in when ready)
// ══════════════════════════════════════════════════════════════
router.get(
  "/attendance/:studentId",
  authenticateUser,
  attendance.getAttendance,
);
router.get("/results/:studentId", authenticateUser, results.getResults);
router.get("/exams/:studentId", authenticateUser, exams.getExams);
router.get("/syllabus/:studentId", authenticateUser, syllabus.getSyllabus); // enrolled courses
router.get("/syllabus", syllabus.getSyllabus); // all or ?sem=N or ?sem=N&scheme=XXXX&department=XXX (public)
router.get("/calendar", calendar.getCalendar);

// ══════════════════════════════════════════════════════════════
// GUEST ROUTES  (no auth)
// ══════════════════════════════════════════════════════════════
router.get("/guest/calendar", calendar.getCalendar);
router.get("/guest/syllabus", syllabus.getSyllabus); // same handler, ?sem=N
router.get("/guest/placements", placement.getPlacementStats);

// ══════════════════════════════════════════════════════════════
//Chatbot route
//=══════════════════════════════════════════════════════════════
router.get("/student/:studentId/performance", performance.getPerformance);

// ══════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ══════════════════════════════════════════════════════════════

// Users (parents)
router.get("/admin/users", admin.listUsers);
router.post("/admin/users", admin.createUser);

// Students
router.get("/admin/students", admin.listStudents);
router.post("/admin/students", admin.createStudent);
router.put("/admin/students/:id", admin.updateStudent);

// Courses
router.get("/admin/courses", admin.listCourses);
router.post("/admin/courses", admin.createCourse);
router.post("/admin/courses/assign-sem", admin.assignCourseToSem);

// Student–Course enrollment (new: student_courses table)
router.get("/admin/student-courses", admin.listStudentCourses);
router.post("/admin/student-courses", admin.enrollStudentCourse);
router.put("/admin/student-courses/:id", admin.updateStudentCourseStatus);

// Components
router.get("/admin/components", admin.listComponents);
router.post("/admin/components/assign", admin.assignComponent);
router.get("/admin/course-components", admin.listCourseComponents);

// Attendance
router.post("/admin/attendance", admin.upsertAttendance);

// Marks & Results
router.post("/admin/marks", admin.upsertMark);
router.post(
  "/admin/results/semester",
  authenticateAdmin,
  admin.upsertSemesterResult,
);

// Exams
router.get("/admin/exams", admin.listExams);
router.post("/admin/exams", admin.createExam);
router.put("/admin/exams/:id", admin.updateExam);
router.delete("/admin/exams/:id", admin.deleteExam);

// Calendar Events
router.post("/admin/events", admin.createEvent);
router.put("/admin/events/:id", admin.updateEvent);
router.delete("/admin/events/:id", admin.deleteEvent);

// Placements
router.post("/admin/placements", admin.upsertPlacementStat);

module.exports = router;
