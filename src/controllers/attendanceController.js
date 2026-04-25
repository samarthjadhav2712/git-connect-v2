const db = require('../config/db');

const getStatus = (pct) => {
  if (pct >= 85) return 'good';
  if (pct >= 75) return 'average';
  return 'critical';
};

// GET /api/attendance/:studentId
const getAttendance = async (req, res) => {
  const { studentId } = req.params;

  if (!req.user || !req.user.id) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  // Verify student belongs to logged-in parent
  const { rows: ownership } = await db.query(
    'SELECT id FROM students WHERE id = $1 AND user_id = $2',
    [studentId, req.user.id]
  );
  if (ownership.length === 0) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  // New schema: attendance → student_courses → semester_courses → courses
  // Also filter by student's current semester so we only show active courses
  const { rows } = await db.query(
    `SELECT
       a.id,
       c.course_code,
       c.name            AS subject,
       c.course_type,
       a.attended_classes,
       a.total_classes,
       ROUND(
         (a.attended_classes::NUMERIC / NULLIF(a.total_classes, 0)) * 100,
         2
       ) AS attendance_pct
     FROM attendance a
     JOIN student_courses  sc  ON sc.id  = a.student_course_id
     JOIN semester_courses sem ON sem.id = sc.semester_course_id
     JOIN courses           c  ON c.id   = sem.course_id
     WHERE sc.student_id = $1
     ORDER BY c.course_code`,
    [studentId]
  );

  if (rows.length === 0) {
    return res.json({ success: true, overall_pct: 0, overall_status: 'critical', subjects: [] });
  }

  const subjects = rows.map(r => ({
    ...r,
    attendance_pct: parseFloat(r.attendance_pct) || 0,
    status: getStatus(parseFloat(r.attendance_pct) || 0),
  }));

  const totalAttended = subjects.reduce((s, r) => s + r.attended_classes, 0);
  const totalClasses  = subjects.reduce((s, r) => s + r.total_classes, 0);
  const overallPct    = totalClasses > 0
    ? parseFloat(((totalAttended / totalClasses) * 100).toFixed(2))
    : 0;

  res.json({
    success: true,
    overall_pct: overallPct,
    overall_status: getStatus(overallPct),
    subjects,
  });
};

module.exports = { getAttendance };