/**
 * tools/courseTools.js
 *
 * All tool functions related to courses, semester offerings, marks, and exams.
 * Updated to use natural identifiers (USN, courseCode) to match the DB Schema.
 */

import { query } from "../db/connection.js";

// ─────────────────────────────────────────────
// COURSES
// ─────────────────────────────────────────────

/**
 * Get a course by its course code.
 * @param {string} courseCode - e.g. "21CS51"
 * @returns {object|null}
 */
export async function getCourseByCode(courseCode) {
  const { rows } = await query(
    `SELECT course_code, name, course_type, elective_type, syllabus_url, summary, credits, department
     FROM courses
     WHERE UPPER(course_code) = UPPER($1)`,
    [courseCode]
  );
  return rows[0] ?? null;
}

/**
 * Search courses by name (partial, case-insensitive).
 * @param {string} name
 * @returns {Array}
 */
export async function searchCoursesByName(name) {
  const { rows } = await query(
    `SELECT course_code, name, course_type, elective_type, credits, department
     FROM courses
     WHERE name ILIKE $1
     ORDER BY name`,
    [`%${name}%`]
  );
  return rows;
}

/**
 * Get all courses offered in a specific semester and batch year.
 * @param {number} semester
 * @param {number} batchYear
 * @returns {Array}
 */
export async function getCoursesBySemesterAndBatch(semester, batchYear) {
  const { rows } = await query(
    `SELECT c.course_code, c.name, c.course_type, c.elective_type, c.credits, c.department
     FROM semester_courses sem_c
     JOIN courses c ON c.id = sem_c.course_id
     WHERE sem_c.semester = $1 AND sem_c.batch_year = $2
     ORDER BY c.course_code`,
    [semester, batchYear]
  );
  return rows;
}

/**
 * Get all components (Internal Assessment, End Exam, etc.) for a course.
 * @param {string} courseCode
 * @returns {Array}
 */
export async function getCourseComponents(courseCode) {
  const { rows } = await query(
    `SELECT comp.comp_name, cc.max_marks
     FROM course_components cc
     JOIN components comp ON comp.id = cc.comp_id
     JOIN courses c ON c.id = cc.course_id
     WHERE UPPER(c.course_code) = UPPER($1)
     ORDER BY comp.comp_name`,
    [courseCode]
  );
  return rows;
}

// ─────────────────────────────────────────────
// MARKS
// ─────────────────────────────────────────────

/**
 * Get all marks for a student in a specific semester.
 * Returns marks per component per course.
 * @param {string} usn - Student's USN (e.g. "1RV21CS001")
 * @param {number} semester
 * @returns {Array}
 */
export async function getStudentMarksBySemester(usn, semester) {
  const { rows } = await query(
    `SELECT c.course_code, c.name AS course_name,
            comp.comp_name, cc.max_marks, m.marks_scored,
            ROUND((m.marks_scored / NULLIF(cc.max_marks, 0)) * 100, 2) AS marks_percentage
     FROM marks m
     JOIN student_courses sc ON sc.id = m.student_course_id
     JOIN students s ON s.id = sc.student_id
     JOIN semester_courses sem_c ON sem_c.id = sc.semester_course_id
     JOIN courses c ON c.id = sem_c.course_id
     JOIN course_components cc ON cc.id = m.course_comp_id
     JOIN components comp ON comp.id = cc.comp_id
     WHERE UPPER(s.usn) = UPPER($1) AND sem_c.semester = $2
     ORDER BY c.course_code, comp.comp_name`,
    [usn, semester]
  );
  return rows;
}

/**
 * Get marks for a specific student and a specific course.
 * @param {string} usn
 * @param {string} courseCode
 * @returns {Array}
 */
export async function getStudentMarksByCourse(usn, courseCode) {
  const { rows } = await query(
    `SELECT comp.comp_name, cc.max_marks, m.marks_scored,
            ROUND((m.marks_scored / NULLIF(cc.max_marks, 0)) * 100, 2) AS marks_percentage
     FROM marks m
     JOIN student_courses sc ON sc.id = m.student_course_id
     JOIN students s ON s.id = sc.student_id
     JOIN semester_courses sem_c ON sem_c.id = sc.semester_course_id
     JOIN courses c ON c.id = sem_c.course_id
     JOIN course_components cc ON cc.id = m.course_comp_id
     JOIN components comp ON comp.id = cc.comp_id
     WHERE UPPER(s.usn) = UPPER($1) AND UPPER(c.course_code) = UPPER($2)
     ORDER BY comp.comp_name`,
    [usn, courseCode]
  );
  return rows;
}

/**
 * Get marks summary (total scored vs total max) for a student in a semester.
 * @param {string} usn
 * @param {number} semester
 * @returns {Array} Per course totals
 */
export async function getStudentMarksSummary(usn, semester) {
  const { rows } = await query(
    `SELECT c.course_code, c.name AS course_name,
            SUM(m.marks_scored) AS total_scored,
            SUM(cc.max_marks) AS total_max,
            ROUND(SUM(m.marks_scored) / NULLIF(SUM(cc.max_marks), 0) * 100, 2) AS overall_percentage
     FROM marks m
     JOIN student_courses sc ON sc.id = m.student_course_id
     JOIN students s ON s.id = sc.student_id
     JOIN semester_courses sem_c ON sem_c.id = sc.semester_course_id
     JOIN courses c ON c.id = sem_c.course_id
     JOIN course_components cc ON cc.id = m.course_comp_id
     WHERE UPPER(s.usn) = UPPER($1) AND sem_c.semester = $2
     GROUP BY c.course_code, c.name
     ORDER BY c.course_code`,
    [usn, semester]
  );
  return rows;
}

// ─────────────────────────────────────────────
// EXAMS
// ─────────────────────────────────────────────

/**
 * Get all scheduled exams for a student in a given semester.
 * @param {string} usn
 * @param {number} semester
 * @returns {Array} Sorted by exam_date ASC
 */
export async function getStudentExams(usn, semester) {
  const { rows } = await query(
    `SELECT c.course_code, c.name AS course_name,
            comp.comp_name, e.exam_date, e.start_time, e.end_time
     FROM exams e
     JOIN course_components cc ON cc.id = e.course_comp_id
     JOIN components comp ON comp.id = cc.comp_id
     JOIN semester_courses sem_c ON sem_c.course_id = cc.course_id AND sem_c.semester = $2
     JOIN student_courses sc ON sc.semester_course_id = sem_c.id
     JOIN students s ON s.id = sc.student_id
     JOIN courses c ON c.id = cc.course_id
     WHERE UPPER(s.usn) = UPPER($1)
     ORDER BY e.exam_date ASC, e.start_time ASC`,
    [usn, semester]
  );
  return rows;
}

/**
 * Get all scheduled exams for a specific course code.
 * @param {string} courseCode
 * @returns {Array}
 */
export async function getExamsByCourse(courseCode) {
  const { rows } = await query(
    `SELECT comp.comp_name, e.exam_date, e.start_time, e.end_time
     FROM exams e
     JOIN course_components cc ON cc.id = e.course_comp_id
     JOIN components comp ON comp.id = cc.comp_id
     JOIN courses c ON c.id = cc.course_id
     WHERE UPPER(c.course_code) = UPPER($1)
     ORDER BY e.exam_date ASC`,
    [courseCode]
  );
  return rows;
}

/**
 * Get upcoming exams from today onwards for a student.
 * @param {string} usn
 * @param {number} semester
 * @returns {Array}
 */
export async function getUpcomingExams(usn, semester) {
  const { rows } = await query(
    `SELECT c.course_code, c.name AS course_name,
            comp.comp_name, e.exam_date, e.start_time, e.end_time
     FROM exams e
     JOIN course_components cc ON cc.id = e.course_comp_id
     JOIN components comp ON comp.id = cc.comp_id
     JOIN semester_courses sem_c ON sem_c.course_id = cc.course_id AND sem_c.semester = $2
     JOIN student_courses sc ON sc.semester_course_id = sem_c.id
     JOIN students s ON s.id = sc.student_id
     JOIN courses c ON c.id = cc.course_id
     WHERE UPPER(s.usn) = UPPER($1) AND e.exam_date >= CURRENT_DATE
     ORDER BY e.exam_date ASC, e.start_time ASC`,
    [usn, semester]
  );
  return rows;
}

// console.log("getCourseByCode:", await getCourseByCode("22CS51"))
// console.log("searchCoursesByName:", await searchCoursesByName("Computer"))
// console.log("getCoursesBySemesterAndBatch:", await getCoursesBySemesterAndBatch(5, 2022))
// console.log("getCourseComponents:", await getCourseComponents("22CS51"))
// console.log("getStudentMarksBySemester:", await getStudentMarksBySemester("2GI22CS001", 5))
// console.log("getStudentMarksByCourse:", await getStudentMarksByCourse("2GI22CS001", "22CS51"))
// console.log("getStudentMarksSummary:", await getStudentMarksSummary("2GI22CS001", 5))
// console.log("getStudentExams:", await getStudentExams("2GI22CS001", 5))
// console.log("getExamsByCourse:", await getExamsByCourse("22CS51"))
// console.log("getUpcomingExams:", await getUpcomingExams("2GI22CS001", 5))