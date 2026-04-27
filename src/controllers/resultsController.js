const db = require('../config/db');

const toNumberOrNull = (value) => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const getGrade = (value) => {
  const n = toNumberOrNull(value);
  if (n === null) return null;
  if (n >= 9) return 'S';
  if (n >= 8) return 'A';
  if (n >= 7) return 'B';
  if (n >= 6) return 'C';
  return 'F';
};

const getResultStatus = (value) => {
  const n = toNumberOrNull(value);
  if (n === null) return null;
  return n >= 6 ? 'pass' : 'fail';
};

// GET /api/results/:studentId
const getResults = async (req, res) => {
  const { studentId } = req.params;

  const { rows: ownership } = await db.query(
    'SELECT id FROM students WHERE id = $1 AND user_id = $2',
    [studentId, req.user.id]
  );
  if (ownership.length === 0) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  // All semester SGPA/CGPA rows for this student
  const { rows: semResults } = await db.query(
    `SELECT semester, sgpa, cgpa
     FROM semester_results
     WHERE student_id = $1
     ORDER BY semester`,
    [studentId]
  );

  const latestCgpa = semResults.length > 0
    ? semResults[semResults.length - 1].cgpa
    : null;

  // marks.student_course_id → student_courses → semester_courses → courses/semester
  // marks.course_comp_id    → course_components → components
  const { rows: marksRows } = await db.query(
    `SELECT
       sem.semester,
       c.course_code,
       c.name          AS subject,
       c.credits,
       c.course_type,
       comp.comp_name  AS component,
       cc.max_marks,
       m.marks_scored
     FROM marks m
     JOIN student_courses  sc  ON sc.id  = m.student_course_id
     JOIN semester_courses sem ON sem.id = sc.semester_course_id
     JOIN courses           c  ON c.id   = sem.course_id
     JOIN course_components cc ON cc.id  = m.course_comp_id
     JOIN components        comp ON comp.id = cc.comp_id
     WHERE sc.student_id = $1
     ORDER BY sem.semester, c.course_code, comp.comp_name`,
    [studentId]
  );

  // Group: semester → subject → components
  const semMap = {};
  for (const row of marksRows) {
    const sem  = row.semester;
    const subj = row.subject;
    if (!semMap[sem]) semMap[sem] = {};
    if (!semMap[sem][subj]) {
      semMap[sem][subj] = {
        course_code:  row.course_code,
        subject:      subj,
        credits:      row.credits != null ? Number(row.credits) : null,
        course_type:  row.course_type,
        components:   {},
        total:        0,
      };
    }
    semMap[sem][subj].components[row.component] = {
      scored: parseFloat(row.marks_scored) || 0,
      max:    parseFloat(row.max_marks),
    };
    semMap[sem][subj].total += parseFloat(row.marks_scored) || 0;
  }

  const semesters = semResults.map((sr) => {
    const sgpa = toNumberOrNull(sr.sgpa);
    const cgpa = toNumberOrNull(sr.cgpa);

    return {
      semester: sr.semester,
      sgpa,
      sgpa_grade: getGrade(sgpa),
      sgpa_result: getResultStatus(sgpa),
      cgpa,
      cgpa_grade: getGrade(cgpa),
      cgpa_result: getResultStatus(cgpa),
      subjects: Object.values(semMap[sr.semester] || {}),
    };
  });

  const currentCgpa = toNumberOrNull(latestCgpa);

  res.json({
    success: true,
    current_cgpa: currentCgpa,
    current_cgpa_grade: getGrade(currentCgpa),
    current_cgpa_result: getResultStatus(currentCgpa),
    semesters,
  });
};

module.exports = { getResults };