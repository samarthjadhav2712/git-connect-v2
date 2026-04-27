const db = require("../config/db");

// Single handler — three modes:
//
//   GET /api/syllabus/:studentId  → courses the student is enrolled in (all sems)
//   GET /api/syllabus?sem=5       → all courses offered in sem 5
//   GET /api/syllabus             → all courses across all semesters
//
// :studentId requires auth. ?sem and bare route are public.

const getSyllabus = async (req, res) => {
  const { studentId } = req.params;
  const { sem, batch_year, department, lang_code } = req.query;

  // ══════════════════════════════════════════════════════════════
  // MODE 1: GET /api/syllabus/:studentId?lang_code=hi
  // Returns courses the student is enrolled in
  // ══════════════════════════════════════════════════════════════
  if (studentId) {
    const { rows: ownership } = await db.query(
      "SELECT id, current_sem FROM students WHERE id = $1 AND user_id = $2",
      [studentId, req.user.id],
    );
    if (ownership.length === 0) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { rows: courses } = await db.query(
      `SELECT
         c.id,
         c.course_code,
         COALESCE(ct.name,    c.name)    AS name,
         COALESCE(ct.summary, c.summary) AS summary,
         c.course_type,
         c.elective_type,
         c.syllabus_url,
         c.credits,
         c.department,
         sem.semester,
         sem.batch_year,
         sc.id AS student_course_id
       FROM student_courses sc
       JOIN semester_courses sem ON sem.id = sc.semester_course_id
       JOIN courses          c   ON c.id   = sem.course_id
       LEFT JOIN course_translations ct
              ON ct.course_id = c.id
             AND ct.lang_code = $2
       WHERE sc.student_id = $1
       ORDER BY sem.semester, c.course_code`,
      [studentId, lang_code ?? null],
    );

    return res.json({
      success: true,
      mode: "enrolled",
      student_id: parseInt(studentId),
      current_sem: ownership[0].current_sem,
      lang_code: lang_code ?? null,
      courses,
    });
  }

  // ══════════════════════════════════════════════════════════════
  // MODE 2: GET /api/syllabus?sem=5&batch_year=2021&department=CSE&lang_code=hi
  // Returns all courses for that semester filtered by batch_year and department
  // ══════════════════════════════════════════════════════════════
  if (sem !== undefined) {
    const parsed = parseInt(sem);
    if (isNaN(parsed) || parsed < 1 || parsed > 8) {
      return res.status(400).json({
        success: false,
        message: "sem must be an integer between 1 and 8",
      });
    }

    const conditions = ["sem.semester = $1"];
    const values = [parsed];

    if (batch_year !== undefined) {
      const parsedYear = parseInt(batch_year);
      if (isNaN(parsedYear)) {
        return res.status(400).json({
          success: false,
          message: "batch_year must be a valid integer",
        });
      }
      values.push(parsedYear);
      conditions.push(`sem.batch_year = $${values.length}`);
    }

    if (department !== undefined) {
      values.push(department); // pass as-is, must match enum exactly
      conditions.push(`c.department = $${values.length}`);
    }

    values.push(lang_code ?? null);
    const langParam = `$${values.length}`;
    const whereClause = conditions.join(" AND ");

    const { rows: courses } = await db.query(
      `SELECT
         c.id,
         c.course_code,
         COALESCE(ct.name,    c.name)    AS name,
         COALESCE(ct.summary, c.summary) AS summary,
         c.course_type,
         c.elective_type,
         c.syllabus_url,
         c.credits,
         c.department,
         sem.semester,
         sem.batch_year
       FROM semester_courses sem
       JOIN courses c ON c.id = sem.course_id
       LEFT JOIN course_translations ct
              ON ct.course_id = c.id
             AND ct.lang_code = ${langParam}
       WHERE ${whereClause}
       ORDER BY c.course_code`,
      values,
    );

    return res.json({
      success: true,
      mode: "semester",
      semester: parsed,
      batch_year: batch_year ? parseInt(batch_year) : null,
      department: department ?? null,
      lang_code: lang_code ?? null,
      courses,
    });
  }

  // ══════════════════════════════════════════════════════════════
  // MODE 3: GET /api/syllabus?lang_code=hi
  // Returns all courses across all semesters
  // ══════════════════════════════════════════════════════════════
  const { rows: courses } = await db.query(
    `SELECT
       c.id,
       c.course_code,
       COALESCE(ct.name,    c.name)    AS name,
       COALESCE(ct.summary, c.summary) AS summary,
       c.course_type,
       c.elective_type,
       c.syllabus_url,
       c.credits,
       c.department,
       sem.semester,
       sem.batch_year
     FROM semester_courses sem
     JOIN courses c ON c.id = sem.course_id
     LEFT JOIN course_translations ct
            ON ct.course_id = c.id
           AND ct.lang_code = $1
     ORDER BY sem.semester, c.course_code`,
    [lang_code ?? null],
  );

  return res.json({
    success: true,
    mode: "all",
    lang_code: lang_code ?? null,
    courses,
  });
};

module.exports = { getSyllabus };
