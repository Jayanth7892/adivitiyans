const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.DB_URL });
async function run() {
  const fac = await pool.query("SELECT faculty_id, name, email FROM faculty WHERE LOWER(name) LIKE '%srinath%'");
  console.log('Faculty:', JSON.stringify(fac.rows, null, 2));
  if (fac.rows.length > 0) {
    const facId = fac.rows[0].faculty_id;
    const s = await pool.query('SELECT roll_number, name, year, section FROM students WHERE faculty_mentor_id = \', [facId]);
    console.log('Mentees (' + s.rows.length + '):', JSON.stringify(s.rows, null, 2));
  }
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
