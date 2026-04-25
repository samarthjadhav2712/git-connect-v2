const db = require('../config/db');

// GET /api/calendar?month=YYYY-MM&branch=CSE&sem=5
// Works for both authenticated users and guests
const getCalendar = async (req, res) => {
  const { month, branch, sem } = req.query;

  const conditions = [];
  const params     = [];
  let   idx        = 1;

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    conditions.push(`TO_CHAR(ce.event_date, 'YYYY-MM') = $${idx++}`);
    params.push(month);
  }

  // Build query: left join calendar_branches and calendar_semesters
  // so even if an event has no branch/sem restriction it still shows
  let query = `
    SELECT DISTINCT
      ce.id,
      ce.title,
      ce.event_date,
      ce.event_type,
      COALESCE(
        ARRAY_AGG(DISTINCT cb.branch) FILTER (WHERE cb.branch IS NOT NULL),
        '{}'
      ) AS branches,
      COALESCE(
        ARRAY_AGG(DISTINCT cs.semester) FILTER (WHERE cs.semester IS NOT NULL),
        '{}'
      ) AS semesters
    FROM calendar_events ce
    LEFT JOIN calendar_branches   cb ON cb.cal_id = ce.id
    LEFT JOIN calendar_semesters  cs ON cs.cal_id = ce.id
  `;

  // Scope: only events that have no branch restriction OR match the requested branch
  if (branch) {
    conditions.push(`(cb.branch IS NULL OR cb.branch = $${idx++})`);
    params.push(branch);
  }

  if (sem) {
    conditions.push(`(cs.semester IS NULL OR cs.semester = $${idx++})`);
    params.push(parseInt(sem));
  }

  if (conditions.length) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += `
    GROUP BY ce.id, ce.title, ce.event_date, ce.event_type
    ORDER BY ce.event_date ASC
  `;

  const { rows: events } = await db.query(query, params);
  res.json({ success: true, events });
};

module.exports = { getCalendar };