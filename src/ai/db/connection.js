// import pool from "../../config"


// // const { Pool } = pg;

// // const pool = new Pool({
// //   connectionString: process.env.DATABASE_URL,
// //   ssl:
// //     process.env.NODE_ENV === "production"
// //       ? { rejectUnauthorized: false }
// //       : false,
// // });

// pool.on("error", (err) => {
//   console.error("Unexpected error on idle client", err);
//   process.exit(-1);
// });

// /**
//  * Execute a parameterized query
//  * @param {string} text - SQL query string
//  * @param {Array} params - Query parameters
//  * @returns {Promise<pg.QueryResult>}
//  */
// export async function query(text, params = []) {
//   const start = Date.now();
//   try {
//     const res = await pool.query(text, params);
//     const duration = Date.now() - start;
//     console.log("Executed query", { text, duration, rows: res.rowCount });
//     return res;
//   } catch (error) {
//     console.error("Database query error:", { text, error: error.message });
//     throw error;
//   }
// }

// export default pool;




import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

/**
 * Execute a parameterized query
 * @param {string} text - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params = []) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    // console.log("Executed query", { text, duration, rows: res.rowCount });
    // console.log(res.rows)
    return res;
  } catch (error) {
    console.error("Database query error:", { text, error: error.message });
    throw error;
  }
}

export default pool;