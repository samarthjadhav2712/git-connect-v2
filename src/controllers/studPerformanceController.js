const db = require("../config/db");

const getStatus = (pct) => {
  if (pct >= 85) return "good";
  if (pct >= 75) return "average";
  return "critical";
};

// GET /api/student/:studentId/performance
const getPerformance = async (req, res) => {
  const { studentId } = req.params;

  const [attendanceRows, marksRows, semResults] = await Promise.all([
    // Attendance query (from your attendance controller)
    db.query(
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
      [studentId],
    ),

    // Marks query (from your results controller)
    db.query(
      `SELECT
         sem.semester,
         c.course_code,
         c.name          AS subject,
         c.course_type,
         comp.comp_name  AS component,
         cc.max_marks,
         m.marks_scored
       FROM marks m
       JOIN student_courses  sc   ON sc.id   = m.student_course_id
       JOIN semester_courses sem  ON sem.id  = sc.semester_course_id
       JOIN courses           c   ON c.id    = sem.course_id
       JOIN course_components cc  ON cc.id   = m.course_comp_id
       JOIN components        comp ON comp.id = cc.comp_id
       WHERE sc.student_id = $1
       ORDER BY sem.semester, c.course_code, comp.comp_name`,
      [studentId],
    ),

    // Semester SGPA/CGPA query (from your results controller)
    db.query(
      `SELECT semester, sgpa, cgpa
       FROM semester_results
       WHERE student_id = $1
       ORDER BY semester`,
      [studentId],
    ),
  ]);

  // ── Attendance processing ──────────────────────────────────────
  const subjects = attendanceRows.rows.map((r) => ({
    ...r,
    attendance_pct: parseFloat(r.attendance_pct) || 0,
    status: getStatus(parseFloat(r.attendance_pct) || 0),
  }));

  const totalAttended = subjects.reduce((s, r) => s + r.attended_classes, 0);
  const totalClasses = subjects.reduce((s, r) => s + r.total_classes, 0);
  const overallPct =
    totalClasses > 0
      ? parseFloat(((totalAttended / totalClasses) * 100).toFixed(2))
      : 0;

  const attendance = {
    overall_pct: overallPct,
    overall_status: getStatus(overallPct),
    subjects: subjects.length > 0 ? subjects : [],
  };

  // ── Results processing ─────────────────────────────────────────
  const semMap = {};
  for (const row of marksRows.rows) {
    const sem = row.semester;
    const subj = row.subject;
    if (!semMap[sem]) semMap[sem] = {};
    if (!semMap[sem][subj]) {
      semMap[sem][subj] = {
        course_code: row.course_code,
        subject: subj,
        course_type: row.course_type,
        components: {},
        total: 0,
      };
    }
    semMap[sem][subj].components[row.component] = {
      scored: parseFloat(row.marks_scored) || 0,
      max: parseFloat(row.max_marks),
    };
    semMap[sem][subj].total += parseFloat(row.marks_scored) || 0;
  }

  const latestCgpa =
    semResults.rows.length > 0
      ? semResults.rows[semResults.rows.length - 1].cgpa
      : null;

  const semesters = semResults.rows.map((sr) => ({
    semester: sr.semester,
    sgpa: sr.sgpa,
    cgpa: sr.cgpa,
    subjects: Object.values(semMap[sr.semester] || {}),
  }));

  const results = {
    current_cgpa: latestCgpa,
    semesters,
  };

  // ── Combined response ──────────────────────────────────────────
  return res.json({
    success: true,
    student_id: parseInt(studentId),
    attendance,
    results,
  });
};

module.exports = { getPerformance };
