const db = require('../config/db');

// ── Table detection helpers ──────────────────────────────────
// calendar_departments.department = NULL  → event is for ALL departments
// calendar_semesters.semester     = NULL  → event is for ALL semesters
// No row in mapping table at all          → also global

const tableExists = async (tableName) => {
  const { rows } = await db.query(
    `SELECT to_regclass($1) AS regclass_name`,
    [tableName]
  );
  return Boolean(rows[0]?.regclass_name);
};

const resolveCalendarMappingTable = async () => {
  if (await tableExists('public.calendar_department')) {
    return { tableName: 'calendar_department', fieldName: 'department', labelName: 'departments' };
  }
  if (await tableExists('public.calendar_department')) {
    return { tableName: 'calendar_department', fieldName: 'department', labelName: 'departments' };
  }
  if (await tableExists('public.calendar_branches')) {
    return { tableName: 'calendar_branches', fieldName: 'branch', labelName: 'branches' };
  }
  return null;
};

const resolveCalendarSemesterTable = async () => {
  if (await tableExists('public.calendar_semesters')) return 'calendar_semesters';
  return null;
};

// ── GET /api/calendar?month=YYYY-MM&department=CSE&sem=5 ─────
// GET /api/guest/calendar — same handler, no auth needed
// Accepts both ?department= and ?branch= interchangeably
const getCalendar = async (req, res) => {
  const { month, branch, department, sem } = req.query;
  const selectedDepartment = department || branch || null;
  const selectedSemester =
    sem === undefined || sem === null || sem === '' ? null : Number(sem);

  if (sem !== undefined && sem !== null && sem !== '' && Number.isNaN(selectedSemester)) {
    return res.status(400).json({ success: false, message: 'sem must be a valid integer' });
  }

  const mappingTable  = await resolveCalendarMappingTable();
  const semesterTable = await resolveCalendarSemesterTable();

  // ── SELECT parts ────────────────────────────────────────────
  const selectParts = ['ce.id', 'ce.title', 'ce.event_date', 'ce.event_type'];

  if (mappingTable) {
    // Cast enum column to text explicitly so COALESCE types align
    selectParts.push(`COALESCE((
      SELECT ARRAY_AGG(DISTINCT cm.${mappingTable.fieldName}::text ORDER BY cm.${mappingTable.fieldName}::text)
      FROM ${mappingTable.tableName} cm
      WHERE cm.cal_id = ce.id
    ), '{}'::text[]) AS departments`);

  } else {
    selectParts.push(`'{}'::text[] AS departments`);
  }

  if (semesterTable) {
    selectParts.push(`COALESCE((
      SELECT ARRAY_AGG(DISTINCT cs.semester ORDER BY cs.semester)
      FROM ${semesterTable} cs
      WHERE cs.cal_id = ce.id AND cs.semester IS NOT NULL
    ), '{}'::smallint[]) AS semesters`);
  } else {
    selectParts.push(`'{}'::smallint[] AS semesters`);
  }

  // ── WHERE conditions ────────────────────────────────────────
  const conditions = [];
  const params     = [];
  let   idx        = 1;

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    conditions.push(`TO_CHAR(ce.event_date, 'YYYY-MM') = $${idx++}`);
    params.push(month);
  }

  // Department filter logic:
  // Show the event when EITHER:
  //   (a) zero department rows exist for it  → it's a global event
  //   (b) a row exists where department matches OR department IS NULL (all-dept marker)
  //       AND semester also matches or is NULL
  if (mappingTable && selectedDepartment) {
    conditions.push(`(
      NOT EXISTS (
        SELECT 1 FROM ${mappingTable.tableName} cm0 WHERE cm0.cal_id = ce.id
      )
      OR EXISTS (
        SELECT 1 FROM ${mappingTable.tableName} cm
        WHERE cm.cal_id = ce.id
          AND (cm.${mappingTable.fieldName}::text = $${idx} OR cm.${mappingTable.fieldName} IS NULL)
      )
    )`);
    params.push(selectedDepartment);
    idx += 1;
  }

  // Semester filter logic (via calendar_semesters):
  // Show event when EITHER:
  //   (a) zero semester rows exist for it  → global
  //   (b) a row exists where semester matches OR semester IS NULL
  if (semesterTable && selectedSemester !== null) {
    conditions.push(`(
      NOT EXISTS (
        SELECT 1 FROM ${semesterTable} cs0 WHERE cs0.cal_id = ce.id
      )
      OR EXISTS (
        SELECT 1 FROM ${semesterTable} cs
        WHERE cs.cal_id = ce.id
          AND (cs.semester IS NULL OR cs.semester = $${idx++})
      )
    )`);
    params.push(selectedSemester);
  }

  const query = `
    SELECT DISTINCT
      ${selectParts.join(',\n      ')}
    FROM calendar_events ce
    ${conditions.length ? `WHERE ${conditions.join('\n    AND ')}` : ''}
    ORDER BY ce.event_date ASC, ce.id ASC
  `;

  const { rows } = await db.query(query, params);

  const ALL_DEPARTMENTS = ['CSE', 'ECE', 'ISE', 'EEE', 'MECH', 'CIVIL'];
  const ALL_SEMESTERS   = [1, 2, 3, 4, 5, 6, 7, 8];

  // NULL in departments array  → event is for ALL departments → expand to full list
  // NULL in semesters array    → event is for ALL semesters   → expand to full list
  // Empty array                → also global                  → expand to full list
  const expandDepartments = (arr) => {
    if (!arr || arr.length === 0 || arr.includes(null)) return ALL_DEPARTMENTS;
    return arr;
  };

  const expandSemesters = (arr) => {
    if (!arr || arr.length === 0 || arr.includes(null)) return ALL_SEMESTERS;
    return arr;
  };

  const events = rows.map((row) => {
    const departments = expandDepartments(row.departments);
    const semesters   = expandSemesters(row.semesters);
    return {
      id:           row.id,
      title:        row.title,
      event_date:   row.event_date,
      event_type:   row.event_type,
      departments,
      semesters,
      branches: departments,   // backwards-compat alias
    };
  });

  res.json({ success: true, events });
};

module.exports = { getCalendar };