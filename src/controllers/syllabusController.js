const db = require('../config/db');

// Single handler — three modes:
//
//   GET /api/syllabus/:studentId  → courses the student is enrolled in (all sems)
//   GET /api/syllabus?sem=5       → all courses offered in sem 5
//   GET /api/syllabus             → all courses across all semesters
//
// :studentId requires auth. ?sem and bare route are public.

const getSyllabus = async (req, res) => {
  const { studentId } = req.params;   // present only when route is /syllabus/:studentId
  const { sem }       = req.query;

  // ══════════════════════════════════════════════════════════════
  // MODE 1: /api/syllabus/:studentId
  // Returns courses the student is enrolled in (via student_courses)
  // ══════════════════════════════════════════════════════════════
  if (studentId) {
    // Auth check — only the parent of this student can access
    const { rows: ownership } = await db.query(
      'SELECT id, current_sem FROM students WHERE id = $1 AND user_id = $2',
      [studentId, req.user.id]
    );
    if (ownership.length === 0) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { rows: courses } = await db.query(
      `SELECT
         c.id,
         c.course_code,
         c.name,
         c.course_type,
         c.elective_type,
         c.syllabus_url,
         c.summary,
         sem.semester,
         sem.batch_year,
         sc.id AS student_course_id
       FROM student_courses sc
       JOIN semester_courses sem ON sem.id = sc.semester_course_id
       JOIN courses          c   ON c.id   = sem.course_id
       WHERE sc.student_id = $1
       ORDER BY sem.semester, c.course_code`,
      [studentId]
    );

    return res.json({
      success:     true,
      mode:        'enrolled',
      student_id:  parseInt(studentId),
      current_sem: ownership[0].current_sem,
      courses,
    });
  }

  // ══════════════════════════════════════════════════════════════
  // MODE 2: /api/syllabus?sem=5
  // Returns all courses offered in that semester (no enrollment filter)
  // ══════════════════════════════════════════════════════════════
  if (sem !== undefined) {
    const parsed = parseInt(sem);
    if (isNaN(parsed) || parsed < 1 || parsed > 8) {
      return res.status(400).json({ success: false, message: 'sem must be an integer between 1 and 8' });
    }

    const { rows: courses } = await db.query(
      `SELECT
         c.id,
         c.course_code,
         c.name,
         c.course_type,
         c.elective_type,
         c.syllabus_url,
         c.summary,
         sem.semester,
         sem.batch_year
       FROM semester_courses sem
       JOIN courses c ON c.id = sem.course_id
       WHERE sem.semester = $1
       ORDER BY c.course_code`,
      [parsed]
    );

    return res.json({
      success:  true,
      mode:     'semester',
      semester: parsed,
      courses,
    });
  }

  // ══════════════════════════════════════════════════════════════
  // MODE 3: /api/syllabus
  // Returns all courses across all semesters
  // ══════════════════════════════════════════════════════════════
  const { rows: courses } = await db.query(
    `SELECT
       c.id,
       c.course_code,
       c.name,
       c.course_type,
       c.elective_type,
       c.syllabus_url,
       c.summary,
       sem.semester,
       sem.batch_year
     FROM semester_courses sem
     JOIN courses c ON c.id = sem.course_id
     ORDER BY sem.semester, c.course_code`
  );

  return res.json({
    success: true,
    mode:    'all',
    courses,
  });
};

module.exports = { getSyllabus };