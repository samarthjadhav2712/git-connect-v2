import { query } from "../db/connection.js";

// ─────────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────────

/**
 * Get attendance for all courses of a student in a specific semester.
 * Returns attended_classes, total_classes, and percentage for each course.
 * @param {string} usn - The student's University Seat Number
 * @param {number} semester - The semester number
 * @returns {Promise<Array>}
 */
export async function getStudentAttendanceBySemester(usn, semester) {
  const { rows } = await query(
    `SELECT c.course_code, c.name AS course_name,
            a.attended_classes, a.total_classes,
            ROUND((a.attended_classes::decimal / NULLIF(a.total_classes, 0)) * 100, 2) AS percentage
     FROM attendance a
     JOIN student_courses sc ON sc.id = a.student_course_id
     JOIN students s ON s.id = sc.student_id
     JOIN semester_courses sem_c ON sem_c.id = sc.semester_course_id
     JOIN courses c ON c.id = sem_c.course_id
     WHERE s.usn = $1 AND sem_c.semester = $2
     ORDER BY c.course_code`,
    [usn, semester]
  );
  return rows;
}

/**
 * Get attendance for a specific course of a student by USN.
 * (Replaced getAttendanceByStudentCourseId to use USN as requested)
 * @param {string} usn - The student's University Seat Number
 * @param {string} courseCode - The official course code (e.g., CS101)
 * @param {number} semester - The semester number
 * @returns {Promise<object|null>}
 */
export async function getStudentAttendanceForCourse(usn, courseCode, semester) {
  const { rows } = await query(
    `SELECT c.course_code, c.name AS course_name,
            a.attended_classes, a.total_classes,
            ROUND((a.attended_classes::decimal / NULLIF(a.total_classes, 0)) * 100, 2) AS percentage
     FROM attendance a
     JOIN student_courses sc ON sc.id = a.student_course_id
     JOIN students s ON s.id = sc.student_id
     JOIN semester_courses sem_c ON sem_c.id = sc.semester_course_id
     JOIN courses c ON c.id = sem_c.course_id
     WHERE s.usn = $1 AND c.course_code = $2 AND sem_c.semester = $3`,
    [usn, courseCode, semester]
  );
  return rows[0] ?? null;
}

/**
 * Get courses where a student's attendance is below a given threshold.
 * Useful for detecting shortage warnings.
 * @param {string} usn - The student's University Seat Number
 * @param {number} semester - The semester number
 * @param {number} threshold - Percentage, e.g. 75
 * @returns {Promise<Array>}
 */
export async function getCoursesWithLowAttendance(usn, semester, threshold = 75) {
  const { rows } = await query(
    `SELECT c.course_code, c.name AS course_name,
            a.attended_classes, a.total_classes,
            ROUND((a.attended_classes::decimal / NULLIF(a.total_classes, 0)) * 100, 2) AS percentage
     FROM attendance a
     JOIN student_courses sc ON sc.id = a.student_course_id
     JOIN students s ON s.id = sc.student_id
     JOIN semester_courses sem_c ON sem_c.id = sc.semester_course_id
     JOIN courses c ON c.id = sem_c.course_id
     WHERE s.usn = $1 AND sem_c.semester = $2
       AND (a.attended_classes::decimal / NULLIF(a.total_classes, 0)) * 100 < $3
     ORDER BY percentage ASC`,
    [usn, semester, threshold]
  );
  return rows;
}

/**
 * Get overall/average attendance percentage for a student in a semester.
 * @param {string} usn - The student's University Seat Number
 * @param {number} semester - The semester number
 * @returns {Promise<object|null>} { total_attended, total_classes, overall_percentage }
 */
export async function getOverallAttendance(usn, semester) {
  const { rows } = await query(
    `SELECT SUM(a.attended_classes)::integer AS total_attended,
            SUM(a.total_classes)::integer AS total_classes,
            ROUND(
              SUM(a.attended_classes)::decimal / NULLIF(SUM(a.total_classes), 0) * 100,
              2
            ) AS overall_percentage
     FROM attendance a
     JOIN student_courses sc ON sc.id = a.student_course_id
     JOIN students s ON s.id = sc.student_id
     JOIN semester_courses sem_c ON sem_c.id = sc.semester_course_id
     WHERE s.usn = $1 AND sem_c.semester = $2`,
    [usn, semester]
  );
  return rows[0] ?? null;
}

// console.log("getStudentAttendanceBySemester:", await getStudentAttendanceBySemester("2GI22CS001", 5))
// console.log("getStudentAttendanceForCourse:", await getStudentAttendanceForCourse("2GI22CS001", '22CS51',  5))
// console.log("getCoursesWithLowAttendance:", await getCoursesWithLowAttendance("2GI22CS001", 5,85))
// console.log("getOverallAttendance:", await getOverallAttendance("2GI22CS001", 5))
