const db     = require('../config/db');
const bcrypt = require('bcryptjs');

// ══════════════════════════════════════════════════════════════
// USERS  (parents)
// ══════════════════════════════════════════════════════════════

const listUsers = async (req, res) => {
  const { rows } = await db.query(
    'SELECT id, mobile, name, role, created_at FROM users ORDER BY id'
  );
  res.json({ success: true, users: rows });
};

const createUser = async (req, res) => {
  const { mobile, name, role } = req.body;
  if (!mobile) return res.status(400).json({ success: false, message: 'mobile is required' });

  const { rows } = await db.query(
    `INSERT INTO users (mobile, name, role, created_at)
     VALUES ($1, $2, $3, NOW())
     RETURNING id`,
    [mobile, name || null, role || 'parent']
  );
  res.status(201).json({ success: true, message: 'User created', userId: rows[0].id });
};

// ══════════════════════════════════════════════════════════════
// STUDENTS
// ══════════════════════════════════════════════════════════════

const listStudents = async (req, res) => {
  const { rows } = await db.query(
    `SELECT s.*, u.mobile, u.name AS parent_name
     FROM students s
     JOIN users u ON u.id = s.user_id
     ORDER BY s.id`
  );
  res.json({ success: true, students: rows });
};

const createStudent = async (req, res) => {
  const { user_id, name, usn, current_sem, batch_year, department, scheme } = req.body;
  if (!user_id || !name || !usn) {
    return res.status(400).json({ success: false, message: 'user_id, name, usn are required' });
  }

  const { rows } = await db.query(
    `INSERT INTO students (user_id, name, usn, current_sem, batch_year, department, scheme)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [user_id, name, usn, current_sem || 1, batch_year || null, department || null, scheme || null]
  );
  res.status(201).json({ success: true, message: 'Student created', studentId: rows[0].id });
};

const updateStudent = async (req, res) => {
  const { id } = req.params;
  const { name, usn, current_sem, batch_year, department, scheme } = req.body;

  await db.query(
    `UPDATE students
     SET name=$1, usn=$2, current_sem=$3, batch_year=$4, department=$5, scheme=$6
     WHERE id=$7`,
    [name, usn, current_sem, batch_year, department, scheme, id]
  );
  res.json({ success: true, message: 'Student updated' });
};

// ══════════════════════════════════════════════════════════════
// COURSES
// ══════════════════════════════════════════════════════════════

const listCourses = async (req, res) => {
  const { rows } = await db.query('SELECT * FROM courses ORDER BY course_code');
  res.json({ success: true, courses: rows });
};

const createCourse = async (req, res) => {
  const { course_code, name, course_type, elective_type, syllabus_url, summary } = req.body;
  if (!course_code || !name || !course_type) {
    return res.status(400).json({ success: false, message: 'course_code, name, course_type are required' });
  }

  // course_type: 'theory' | 'lab' | 'theory_lab'
  // elective_type: 'professional' | 'extra_curricular' | 'open' | null (null = core)
  const { rows } = await db.query(
    `INSERT INTO courses (course_code, name, course_type, elective_type, syllabus_url, summary)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [course_code, name, course_type, elective_type || null, syllabus_url || null, summary || null]
  );
  res.status(201).json({ success: true, message: 'Course created', courseId: rows[0].id });
};

// ── Assign course to a semester (semester_courses) ───────────
const assignCourseToSem = async (req, res) => {
  const { course_id, semester, batch_year } = req.body;
  if (!course_id || !semester) {
    return res.status(400).json({ success: false, message: 'course_id and semester are required' });
  }

  // Use ON CONFLICT DO NOTHING to make it idempotent
  const { rows } = await db.query(
    `INSERT INTO semester_courses (course_id, semester, batch_year)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [course_id, semester, batch_year || null]
  );

  const semesterCourseId = rows[0]?.id || null;
  res.json({ success: true, message: 'Course assigned to semester', semesterCourseId });
};

// ══════════════════════════════════════════════════════════════
// STUDENT_COURSES  (enroll student in a semester_course)
// ══════════════════════════════════════════════════════════════

const listStudentCourses = async (req, res) => {
  const { studentId } = req.query;
  const conditions = studentId ? 'WHERE sc.student_id = $1' : '';
  const params     = studentId ? [studentId] : [];

  const { rows } = await db.query(
    `SELECT
       sc.id,
       sc.student_id,
       sc.semester_course_id,
       sc.status,
       s.name   AS student_name,
       s.usn,
       c.course_code,
       c.name   AS course_name,
       sem.semester
     FROM student_courses sc
     JOIN students        s   ON s.id   = sc.student_id
     JOIN semester_courses sem ON sem.id = sc.semester_course_id
     JOIN courses         c   ON c.id   = sem.course_id
     ${conditions}
     ORDER BY sc.id`,
    params
  );
  res.json({ success: true, student_courses: rows });
};

const enrollStudentCourse = async (req, res) => {
  const { student_id, semester_course_id, status } = req.body;
  if (!student_id || !semester_course_id) {
    return res.status(400).json({ success: false, message: 'student_id and semester_course_id are required' });
  }

  const { rows } = await db.query(
    `INSERT INTO student_courses (student_id, semester_course_id, status)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [student_id, semester_course_id, status || 'active']
  );
  res.status(201).json({ success: true, message: 'Student enrolled in course', studentCourseId: rows[0]?.id });
};

const updateStudentCourseStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ success: false, message: 'status is required' });

  await db.query('UPDATE student_courses SET status=$1 WHERE id=$2', [status, id]);
  res.json({ success: true, message: 'Enrollment status updated' });
};

// ══════════════════════════════════════════════════════════════
// COMPONENTS
// ══════════════════════════════════════════════════════════════

const listComponents = async (req, res) => {
  const { rows } = await db.query('SELECT * FROM components ORDER BY id');
  res.json({ success: true, components: rows });
};

// Assign component to a course (course_components)
const assignComponent = async (req, res) => {
  const { course_id, comp_id, max_marks } = req.body;
  if (!course_id || !comp_id) {
    return res.status(400).json({ success: false, message: 'course_id and comp_id are required' });
  }

  const { rows } = await db.query(
    `INSERT INTO course_components (course_id, comp_id, max_marks)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [course_id, comp_id, max_marks || 100]
  );
  res.json({ success: true, message: 'Component assigned to course', courseCompId: rows[0]?.id });
};

const listCourseComponents = async (req, res) => {
  const { course_id } = req.query;
  const conditions = course_id ? 'WHERE cc.course_id = $1' : '';
  const params     = course_id ? [course_id] : [];

  const { rows } = await db.query(
    `SELECT
       cc.id AS course_comp_id,
       cc.course_id,
       c.course_code,
       c.name AS course_name,
       cc.comp_id,
       comp.comp_name,
       cc.max_marks
     FROM course_components cc
     JOIN courses    c    ON c.id    = cc.course_id
     JOIN components comp ON comp.id = cc.comp_id
     ${conditions}
     ORDER BY cc.course_id, comp.comp_name`,
    params
  );
  res.json({ success: true, course_components: rows });
};

// ══════════════════════════════════════════════════════════════
// ATTENDANCE  (upsert via student_course_id)
// ══════════════════════════════════════════════════════════════

const upsertAttendance = async (req, res) => {
  const { student_course_id, attended_classes, total_classes } = req.body;
  if (!student_course_id || attended_classes == null || total_classes == null) {
    return res.status(400).json({ success: false, message: 'student_course_id, attended_classes, total_classes are required' });
  }
  if (attended_classes > total_classes) {
    return res.status(400).json({ success: false, message: 'attended_classes cannot exceed total_classes' });
  }

  await db.query(
    `INSERT INTO attendance (student_course_id, attended_classes, total_classes)
     VALUES ($1, $2, $3)
     ON CONFLICT (student_course_id)
     DO UPDATE SET attended_classes = EXCLUDED.attended_classes,
                   total_classes    = EXCLUDED.total_classes`,
    [student_course_id, attended_classes, total_classes]
  );
  res.json({ success: true, message: 'Attendance updated' });
};

// ══════════════════════════════════════════════════════════════
// MARKS  (upsert via student_course_id + course_comp_id)
// ══════════════════════════════════════════════════════════════

const upsertMark = async (req, res) => {
  const { student_course_id, course_comp_id, marks_scored } = req.body;
  if (!student_course_id || !course_comp_id || marks_scored == null) {
    return res.status(400).json({ success: false, message: 'student_course_id, course_comp_id, marks_scored are required' });
  }

  await db.query(
    `INSERT INTO marks (student_course_id, course_comp_id, marks_scored)
     VALUES ($1, $2, $3)
     ON CONFLICT (student_course_id, course_comp_id)
     DO UPDATE SET marks_scored = EXCLUDED.marks_scored`,
    [student_course_id, course_comp_id, marks_scored]
  );
  res.json({ success: true, message: 'Marks updated' });
};

// ══════════════════════════════════════════════════════════════
// SEMESTER RESULTS  (upsert SGPA/CGPA per student per semester)
// ══════════════════════════════════════════════════════════════

const upsertSemesterResult = async (req, res) => {
  const { student_id, semester, sgpa, cgpa } = req.body;
  if (!student_id || !semester) {
    return res.status(400).json({ success: false, message: 'student_id and semester are required' });
  }

  await db.query(
    `INSERT INTO semester_results (student_id, semester, sgpa, cgpa)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (student_id, semester)
     DO UPDATE SET sgpa = EXCLUDED.sgpa, cgpa = EXCLUDED.cgpa`,
    [student_id, semester, sgpa || null, cgpa || null]
  );
  res.json({ success: true, message: 'Semester result updated' });
};

// ══════════════════════════════════════════════════════════════
// EXAMS
// ══════════════════════════════════════════════════════════════

const listExams = async (req, res) => {
  const { rows } = await db.query(
    `SELECT
       e.id,
       e.course_comp_id,
       e.exam_date,
       e.start_time,
       e.end_time,
       c.course_code,
       c.name       AS course_name,
       comp.comp_name AS component_type
     FROM exams e
     JOIN course_components cc  ON cc.id  = e.course_comp_id
     JOIN courses           c   ON c.id   = cc.course_id
     JOIN components        comp ON comp.id = cc.comp_id
     ORDER BY e.exam_date, e.start_time`
  );
  res.json({ success: true, exams: rows });
};

const createExam = async (req, res) => {
  const { course_comp_id, exam_date, start_time, end_time } = req.body;
  if (!course_comp_id || !exam_date || !start_time || !end_time) {
    return res.status(400).json({ success: false, message: 'course_comp_id, exam_date, start_time, end_time are required' });
  }

  const { rows } = await db.query(
    `INSERT INTO exams (course_comp_id, exam_date, start_time, end_time)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [course_comp_id, exam_date, start_time, end_time]
  );
  res.status(201).json({ success: true, message: 'Exam created', examId: rows[0].id });
};

const updateExam = async (req, res) => {
  const { id } = req.params;
  const { course_comp_id, exam_date, start_time, end_time } = req.body;

  await db.query(
    `UPDATE exams
     SET course_comp_id=$1, exam_date=$2, start_time=$3, end_time=$4
     WHERE id=$5`,
    [course_comp_id, exam_date, start_time, end_time, id]
  );
  res.json({ success: true, message: 'Exam updated' });
};

const deleteExam = async (req, res) => {
  await db.query('DELETE FROM exams WHERE id=$1', [req.params.id]);
  res.json({ success: true, message: 'Exam deleted' });
};

// ══════════════════════════════════════════════════════════════
// CALENDAR EVENTS  (calendar_departments + calendar_semesters)
//
// NULL semantics:
//   calendar_departments.department = NULL  → event for ALL departments
//   calendar_semesters.semester     = NULL  → event for ALL semesters
//   No rows in mapping tables at all        → also global
//
// Valid departments: 'CSE','ECE','ISE','EEE','MECH','CIVIL'
// Valid semesters:   1 – 8
// ══════════════════════════════════════════════════════════════

// ── Input normalizers ────────────────────────────────────────

// Accepts string | string[] → returns clean string[]
// e.g. 'CSE' → ['CSE'] | ['CSE','ECE'] → ['CSE','ECE']
const normalizeTextArray = (value) => {
  if (value == null) return [];
  const items = Array.isArray(value) ? value : [value];
  return items
    .map((item) => String(item || '').trim())
    .filter((item) => item.length > 0);
};

// Accepts int | int[] | null | undefined
// undefined       → [null]  (caller did not supply — treat as all semesters)
// null / ''       → [null]  (explicit all-semesters)
// [5, 6]          → [5, 6]
// [5, null]       → [5, null]
const normalizeNullableSemesterArray = (value) => {
  if (value === undefined) return [null];
  const items = Array.isArray(value) ? value : [value];
  const semesters = items.map((item) => {
    if (item === null || item === '') return null;
    const n = Number(item);
    return Number.isInteger(n) ? n : null;
  });
  return semesters.length > 0 ? semesters : [null];
};

// ── POST /admin/events ───────────────────────────────────────
// Body:
//   title, event_date, event_type           — required/optional
//   departments | department | branches | branch  — which depts (omit = all)
//   semesters   | semester                   — which sems  (omit = all)
const createEvent = async (req, res) => {
  const {
    title, event_date, event_type,
    departments, department, branches, branch,
    semesters, semester,
  } = req.body;

  if (!title || !event_date) {
    return res.status(400).json({ success: false, message: 'title and event_date are required' });
  }

  // Resolve inputs — accept all aliases
  const resolvedDepartments = normalizeTextArray(departments ?? department ?? branches ?? branch);
  const resolvedSemesters   = normalizeNullableSemesterArray(semesters ?? semester);

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO calendar_events (title, event_date, event_type)
       VALUES ($1, $2, $3) RETURNING id`,
      [title, event_date, event_type || 'other']
    );
    const calId = rows[0].id;

    // calendar_departments: (id, cal_id, department) — NO semester column
    // NULL department = event applies to ALL departments
    const deptRows = resolvedDepartments.length > 0 ? resolvedDepartments : [null];
    for (const dept of deptRows) {
      await client.query(
        `INSERT INTO calendar_department (cal_id, department)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [calId, dept]
      );
    }

    // calendar_semesters: (id, cal_id, semester)
    // NULL semester = event applies to ALL semesters
    for (const sem of resolvedSemesters) {
      await client.query(
        `INSERT INTO calendar_semesters (cal_id, semester)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [calId, sem]
      );
    }

    await client.query('COMMIT');
    return res.status(201).json({ success: true, message: 'Event created', eventId: calId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createEvent error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create event' });
  } finally {
    client.release();
  }
};

// ── PUT /admin/events/:id ────────────────────────────────────
// Partial updates supported:
//   - If departments/branches not provided → department rows untouched
//   - If semesters not provided            → semester rows untouched
const updateEvent = async (req, res) => {
  const { id } = req.params;
  const {
    title, event_date, event_type,
    departments, department, branches, branch,
    semesters, semester,
  } = req.body;

  const departmentsProvided =
    departments !== undefined || department !== undefined ||
    branches    !== undefined || branch     !== undefined;
  const semestersProvided   = semesters !== undefined || semester !== undefined;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE calendar_events SET title=$1, event_date=$2, event_type=$3 WHERE id=$4`,
      [title, event_date, event_type, id]
    );

    if (departmentsProvided) {
      await client.query('DELETE FROM calendar_department WHERE cal_id=$1', [id]);
      const resolvedDepts = normalizeTextArray(departments ?? department ?? branches ?? branch);
      const deptRows = resolvedDepts.length > 0 ? resolvedDepts : [null];
      for (const dept of deptRows) {
        await client.query(
          `INSERT INTO calendar_department (cal_id, department)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, dept]
        );
      }
    }

    if (semestersProvided) {
      await client.query('DELETE FROM calendar_semesters WHERE cal_id=$1', [id]);
      for (const sem of normalizeNullableSemesterArray(semesters ?? semester)) {
        await client.query(
          `INSERT INTO calendar_semesters (cal_id, semester)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, sem]
        );
      }
    }

    await client.query('COMMIT');
    return res.json({ success: true, message: 'Event updated' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('updateEvent error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update event' });
  } finally {
    client.release();
  }
};

// ── DELETE /admin/events/:id ─────────────────────────────────
const deleteEvent = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM calendar_department WHERE cal_id=$1', [req.params.id]);
    await client.query('DELETE FROM calendar_semesters   WHERE cal_id=$1', [req.params.id]);
    await client.query('DELETE FROM calendar_events      WHERE id=$1',     [req.params.id]);
    await client.query('COMMIT');
    return res.json({ success: true, message: 'Event deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('deleteEvent error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete event' });
  } finally {
    client.release();
  }
};

// ══════════════════════════════════════════════════════════════
// PLACEMENTS
// ══════════════════════════════════════════════════════════════

const upsertPlacementStat = async (req, res) => {
  const { academic_year, department, total_placed, avg_package_lpa } = req.body;
  if (!academic_year) {
    return res.status(400).json({ success: false, message: 'academic_year is required' });
  }
 
  await db.query(
    `INSERT INTO placements (academic_year, department, total_placed, avg_package_lpa)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (academic_year, department)
     DO UPDATE SET total_placed    = EXCLUDED.total_placed,
                   avg_package_lpa = EXCLUDED.avg_package_lpa`,
    [academic_year, department || null, total_placed || 0, avg_package_lpa || null]
  );
  res.json({ success: true, message: 'Placement stats saved' });
};

module.exports = {
  // users
  listUsers, createUser,
  // students
  listStudents, createStudent, updateStudent,
  // courses
  listCourses, createCourse, assignCourseToSem,
  // student_courses
  listStudentCourses, enrollStudentCourse, updateStudentCourseStatus,
  // components
  listComponents, assignComponent, listCourseComponents,
  // attendance
  upsertAttendance,
  // marks & results
  upsertMark, upsertSemesterResult,
  // exams
  listExams, createExam, updateExam, deleteExam,
  // calendar
  createEvent, updateEvent, deleteEvent,
  // placements
  upsertPlacementStat,
};