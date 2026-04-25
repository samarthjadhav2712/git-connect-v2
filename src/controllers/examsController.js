const db = require('../config/db');

// GET /api/exams/:studentId
const getExams = async (req, res) => {
  const { studentId } = req.params;

  const { rows: ownership } = await db.query(
    'SELECT id, current_sem FROM students WHERE id = $1 AND user_id = $2',
    [studentId, req.user.id]
  );
  if (ownership.length === 0) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const currentSem = ownership[0].current_sem;

  // Find all exams for courses this student is enrolled in this semester
  // Path: student_courses → semester_courses (semester filter) → course_components → exams
  const { rows: exams } = await db.query(
    `SELECT
       e.id,
       c.course_code,
       c.name       AS course_name,
       comp.comp_name AS component_type,
       e.exam_date,
       e.start_time,
       e.end_time
     FROM exams e
     JOIN course_components cc  ON cc.id  = e.course_comp_id
     JOIN courses           c   ON c.id   = cc.course_id
     JOIN components        comp ON comp.id = cc.comp_id
     JOIN semester_courses  sem ON sem.course_id = c.id AND sem.semester = $1
     JOIN student_courses   sc  ON sc.semester_course_id = sem.id AND sc.student_id = $2
     ORDER BY e.exam_date, e.start_time`,
    [currentSem, studentId]
  );

  res.json({ success: true, semester: currentSem, exams });
};

module.exports = { getExams };