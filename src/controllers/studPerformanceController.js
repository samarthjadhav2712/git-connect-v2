const db = require("../config/db");

const getStatus = (pct) => {
  if (pct >= 85) return "good";
  if (pct >= 75) return "average";
  return "critical";
};

const fetchPerformanceData = async (studentId, sem, res) => {
  const queryParams = sem ? [studentId, sem] : [studentId];
  const semFilter = sem ? 'AND sem.semester = $2' : '';
  const resultSemFilter = sem ? 'AND semester = $2' : '';

  const [attendanceRows, marksRows, semResults] = await Promise.all([
    // Attendance query
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
       WHERE sc.student_id = $1 ${semFilter}
       ORDER BY c.course_code`,
      queryParams,
    ),

    // Marks query
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
       WHERE sc.student_id = $1 ${semFilter}
       ORDER BY sem.semester, c.course_code, comp.comp_name`,
      queryParams,
    ),

    // Semester SGPA/CGPA query
    db.query(
      `SELECT semester, sgpa, cgpa
       FROM semester_results
       WHERE student_id = $1 ${resultSemFilter}
       ORDER BY semester`,
      queryParams,
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
    const semRow = row.semester;
    const subj = row.subject;
    if (!semMap[semRow]) semMap[semRow] = {};
    if (!semMap[semRow][subj]) {
      semMap[semRow][subj] = {
        course_code: row.course_code,
        subject: subj,
        course_type: row.course_type,
        components: {},
        total: 0,
      };
    }
    semMap[semRow][subj].components[row.component] = {
      scored: parseFloat(row.marks_scored) || 0,
      max: parseFloat(row.max_marks),
    };
    semMap[semRow][subj].total += parseFloat(row.marks_scored) || 0;
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

// GET /api/student/:studentId/performance
const getPerformance = async (req, res) => {
  return fetchPerformanceData(req.params.studentId, null, res);
};

// GET /api/student/:studentId/performance/:sem
const getPerformanceBySem = async (req, res) => {
  const sem = req.params.sem || req.query.sem;
  const intent = req.params.intent || req.query.intent;

  // Intercept the response to filter based on intent
  if (intent) {
    const originalJson = res.json;
    res.json = (data) => {
      if (intent === 'results') {
        delete data.attendance;
      } else if (intent === 'attendance') {
        delete data.results;
      }
      return originalJson.call(res, data);
    };
  }

  return fetchPerformanceData(req.params.studentId, sem, res);
};

module.exports = { getPerformance, getPerformanceBySem };