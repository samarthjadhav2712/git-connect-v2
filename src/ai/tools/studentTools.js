/**
 * tools/studentTools.js
 *
 * All tool functions related to fetching student data.
 * Each function is designed to be registered as an AI agent tool.
 */

import { query } from "../db/connection.js";

// ─────────────────────────────────────────────
// STUDENT PROFILE
// ─────────────────────────────────────────────

/**
 * Get a student's full profile by their USN (University Seat Number).
 * @param {string} usn - e.g. "1GI21CS001"
 * @returns {object|null} Student profile or error object
 */
export async function getStudentByUSN(usn) {
  try {
    const { rows } = await query(
      `SELECT s.id, s.name, s.usn, s.current_sem, s.batch_year, s.department, s.scheme,
              u.mobile
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE UPPER(s.usn) = UPPER($1)`,
      [usn]
    );
    return rows[0] ?? null;
  } catch (error) {
    console.error(`[Tool Error] getStudentByUSN(${usn}):`, error.message);
    return { error: `Database error while fetching student by USN: ${error.message}` };
  }
}

/**
 * Get a student's full profile by their internal student ID.
 * @param {number} studentId
 * @returns {object|null}
 */
export async function getStudentById(studentId) {
  try {
    const { rows } = await query(
      `SELECT s.id, s.name, s.usn, s.current_sem, s.batch_year, s.department, s.scheme,
              u.mobile
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [studentId]
    );
    return rows[0] ?? null;
  } catch (error) {
    console.error(`[Tool Error] getStudentById(${studentId}):`, error.message);
    return { error: `Database error while fetching student by ID: ${error.message}` };
  }
}

/**
 * Search students by name (case-insensitive partial match).
 * @param {string} name
 * @returns {Array|object}
 */
export async function searchStudentsByName(name) {
  try {
    const { rows } = await query(
      `SELECT s.id, s.name, s.usn, s.current_sem, s.batch_year, s.department
       FROM students s
       WHERE s.name ILIKE $1
       ORDER BY s.name`,
      [`%${name}%`]
    );
    return rows;
  } catch (error) {
    console.error(`[Tool Error] searchStudentsByName(${name}):`, error.message);
    return { error: `Database error while searching for students: ${error.message}` };
  }
}

/**
 * Get all students in a given department.
 * @param {string} department - e.g. "Computer Science"
 * @returns {Array|object}
 */
export async function getStudentsByDepartment(department) {
  try {
    const { rows } = await query(
      // Cast department to ::text because it is a custom Enum in PostgreSQL
      `SELECT s.id, s.name, s.usn, s.current_sem, s.batch_year, s.scheme
       FROM students s
       WHERE s.department::text ILIKE $1
       ORDER BY s.name`,
      [`%${department}%`]
    );
    return rows;
  } catch (error) {
    console.error(`[Tool Error] getStudentsByDepartment(${department}):`, error.message);
    return { error: `Database error while fetching department students: ${error.message}` };
  }
}

/**
 * Get all students in a given batch year.
 * @param {number} batchYear - e.g. 2021
 * @returns {Array|object}
 */
export async function getStudentsByBatchYear(batchYear) {
  try {
    const { rows } = await query(
      `SELECT s.id, s.name, s.usn, s.current_sem, s.department
       FROM students s
       WHERE s.batch_year = $1
       ORDER BY s.name`,
      [batchYear]
    );
    return rows;
  } catch (error) {
    console.error(`[Tool Error] getStudentsByBatchYear(${batchYear}):`, error.message);
    return { error: `Database error while fetching students by batch: ${error.message}` };
  }
}


// ─────────────────────────────────────────────
// SEMESTER RESULTS
// ─────────────────────────────────────────────

/**
 * Get all semester results (SGPA/CGPA) for a student by USN.
 * @param {string} usn
 * @returns {Array|object} Sorted by semester ascending
 */
export async function getStudentResults(usn) {
  try {
    const { rows } = await query(
      `SELECT sr.semester, sr.sgpa, sr.cgpa
       FROM semester_results sr
       JOIN students s ON s.id = sr.student_id
       WHERE s.usn = $1
       ORDER BY sr.semester ASC`,
      [usn]
    );
    return rows;
  } catch (error) {
    console.error(`[Tool Error] getStudentSemesterResults(${usn}):`, error.message);
    return { error: `Database error while fetching semester results: ${error.message}` };
  }
}

/**
 * Get a student's result for a specific semester by USN.
 * @param {string} usn
 * @param {number} semester
 * @returns {object|null}
 */
export async function getStudentResultBySemester(usn, semester) {
  try {
    const { rows } = await query(
      `SELECT sr.semester, sr.sgpa, sr.cgpa
       FROM semester_results sr
       JOIN students s ON s.id = sr.student_id
       WHERE s.usn = $1 AND sr.semester = $2`,
      [usn, semester]
    );
    return rows[0] ?? null;
  } catch (error) {
    console.error(`[Tool Error] getStudentResultBySemester(${usn}, ${semester}):`, error.message);
    return { error: `Database error while fetching result for semester ${semester}: ${error.message}` };
  }
}

/**
 * Get the latest CGPA of a student by USN (highest semester available).
 * @param {string} usn
 * @returns {object|null} { semester, sgpa, cgpa }
 */
export async function getStudentLatestCGPA(usn) {
  try {
    const { rows } = await query(
      `SELECT sr.semester, sr.sgpa, sr.cgpa
       FROM semester_results sr
       JOIN students s ON s.id = sr.student_id
       WHERE s.usn = $1
       ORDER BY sr.semester DESC
       LIMIT 1`,
      [usn]
    );
    return rows[0] ?? null;
  } catch (error) {
    console.error(`[Tool Error] getStudentLatestCGPA(${usn}):`, error.message);
    return { error: `Database error while fetching latest CGPA: ${error.message}` };
  }
}

// ─────────────────────────────────────────────
// ENROLLED COURSES
// ─────────────────────────────────────────────

/**
 * Get all courses a student is enrolled in for a given semester by USN.
 * @param {string} usn
 * @param {number} semester
 * @returns {Array|object}
 */
export async function getCurrentEnrolledCourses(usn, semester) {
  try {
    const { rows } = await query(
      `SELECT c.id AS course_id, c.course_code, c.name AS course_name,
              c.course_type, c.credits, sc.id AS student_course_id,
              sem_c.semester, sem_c.batch_year
       FROM student_courses sc
       JOIN students s ON s.id = sc.student_id
       JOIN semester_courses sem_c ON sem_c.id = sc.semester_course_id
       JOIN courses c ON c.id = sem_c.course_id
       WHERE s.usn = $1 AND sem_c.semester = $2
       ORDER BY c.course_code`,
      [usn, semester]
    );
    return rows;
  } catch (error) {
    console.error(`[Tool Error] getStudentEnrolledCourses(${usn}, ${semester}):`, error.message);
    return { error: `Database error while fetching enrolled courses: ${error.message}` };
  }
}

/**
 * Get all courses a student has ever enrolled in by USN.
 * @param {string} usn
 * @returns {Array|object}
 */
export async function getAllEnrolledCourses(usn) {
  try {
    const { rows } = await query(
      `SELECT c.id AS course_id, c.course_code, c.name AS course_name,
              c.course_type, c.credits, sc.id AS student_course_id,
              sem_c.semester, sem_c.batch_year
       FROM student_courses sc
       JOIN students s ON s.id = sc.student_id
       JOIN semester_courses sem_c ON sem_c.id = sc.semester_course_id
       JOIN courses c ON c.id = sem_c.course_id
       WHERE s.usn = $1
       ORDER BY sem_c.semester ASC, c.course_code`,
      [usn]
    );
    return rows;
  } catch (error) {
    console.error(`[Tool Error] getAllEnrolledCourses(${usn}):`, error.message);
    return { error: `Database error while fetching all enrolled courses: ${error.message}` };
  }
}

// This needs to be tested

// console.log("getStudentByUSN:", await getStudentByUSN("2GI22CS001"))
// console.log("getStudentById:", await getStudentById(2))
// console.log("searchStudentsByName:", await searchStudentsByName("Sharma"))
// console.log("getStudentsByDepartment:", await getStudentsByDepartment("Computer Science and Engineering"))
// console.log("getStudentsByBatchYear:", await getStudentsByBatchYear(2022))
// console.log("getStudentResults:", await getStudentResults("2GI22CS001"))
// console.log("getStudentResultBySemester:", await getStudentResultBySemester("2GI22CS001", 5))
// console.log("getStudentLatestCGPA:", await getStudentLatestCGPA("2GI22CS001"))
// console.log("getCurrentEnrolledCourses:", await getCurrentEnrolledCourses("2GI22CS001"))
// console.log("getAllEnrolledCourses:", await getAllEnrolledCourses("2GI22CS001"))

// .......