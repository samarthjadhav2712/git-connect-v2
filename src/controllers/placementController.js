const db = require('../config/db');

// GET /api/guest/placements?year=2023-24&department=CSE
const getPlacementStats = async (req, res) => {
  const { year, department } = req.query;

  const conditions = [];
  const params     = [];
  let   idx        = 1;

  if (year) {
    conditions.push(`academic_year = $${idx++}`);
    params.push(year);
  }
  if (department) {
    conditions.push(`department ILIKE $${idx++}`);
    params.push(department);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const { rows } = await db.query(
    `SELECT
       id,
       academic_year,
       department,
       total_placed,
       avg_package_lpa,
       ROUND(
         (total_placed::NUMERIC / NULLIF(total_placed, 0)) * 100,
         2
       ) AS placement_pct
     FROM placements
     ${where}
     ORDER BY academic_year DESC, department`,
    params
  );

  res.json({ success: true, data: rows });
};

module.exports = { getPlacementStats };