const db = require('../config/db');

// GET /api/syllabus/:studentId  (authenticated parent)
// Shows courses this student is enrolled in for their current semester
const getSyllabusForStudent = async (req, res) => {
  const { studentId } = req.params;

  const { rows: ownership } = await db.query(
    'SELECT id, current_sem FROM students WHERE id = $1 AND user_id = $2',
    [studentId, req.user.id]
  );
  if (ownership.length === 0) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const currentSem = ownership[0].current_sem;

  const { rows: courses } = await db.query(
    `SELECT
       c.id,
       c.course_code,
       c.name,
       c.course_type,
       c.elective_type,
       c.syllabus_url,
       c.summary,
       sc.id AS student_course_id,
       'enrolled' AS enrollment_status
     FROM student_courses sc2
     JOIN semester_courses  sem ON sem.id = sc2.semester_course_id
     JOIN courses           c   ON c.id   = sem.course_id
     JOIN semester_courses  sc  ON sc.id  = sem.id
     WHERE sc2.student_id = $1 AND sem.semester = $2
     ORDER BY c.course_code`,
    [studentId, currentSem]
  );

  res.json({ success: true, semester: currentSem, courses });
};

// GET /api/guest/syllabus?sem=3  (no auth)
// Shows all courses offered in a given semester
const getSyllabusBySem = async (req, res) => {
  const sem = parseInt(req.query.sem);
  if (!sem || sem < 1 || sem > 8) {
    return res.status(400).json({ success: false, message: 'sem query param (1-8) is required' });
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
    [sem]
  );

  res.json({ success: true, semester: sem, courses });
};

module.exports = { getSyllabusForStudent, getSyllabusBySem };