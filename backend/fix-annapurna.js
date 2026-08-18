/**
 * fix-annapurna.js
 * Diagnostic + fix script for Annapurna mentor over-assignment.
 * Run from: d:\dept\new\adivitiyans\backend\
 * node ../../../Users/Dineshkumar/.gemini/antigravity-ide/brain/70c9f2d3-f5cf-4126-aa5c-333a0cbd8fa4/scratch/fix-annapurna.js
 */

const { Pool } = require('pg');

const DB_HOST    = process.env.DB_HOST     || 'advitiyans-rds-proxy.proxy-chu8eggw0kny.ap-south-1.rds.amazonaws.com';
const DB_PORT    = parseInt(process.env.DB_PORT || '5432');
const DB_USER    = process.env.DB_USER     || 'postgres';
const DB_NAME    = process.env.DB_NAME     || 'advitiyans';
const DB_SSL     = process.env.DB_SSL !== 'false';
const SECRET_ARN = process.env.DB_SECRET_ARN || 'arn:aws:secretsmanager:ap-south-1:071340280897:secret:advitiyans-db-credentials-s51wBK';

async function getPassword() {
  if (process.env.DB_PASSWORD) return process.env.DB_PASSWORD;
  try {
    const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
    const client = new SecretsManagerClient({ region: 'ap-south-1' });
    const resp = await client.send(new GetSecretValueCommand({ SecretId: SECRET_ARN }));
    if (resp.SecretString) {
      const s = JSON.parse(resp.SecretString);
      return s.password || s.DB_PASSWORD;
    }
  } catch (e) {
    console.error('Could not fetch secret:', e.message);
  }
  return 'postgres';
}

async function main() {
  const password = await getPassword();
  const pool = new Pool({
    host: DB_HOST, port: DB_PORT, user: DB_USER, password,
    database: DB_NAME,
    ssl: DB_SSL ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  });

  console.log(`\n🔌 Connecting to ${DB_HOST}:${DB_PORT}/${DB_NAME}...\n`);

  // STEP 1: Diagnostic
  console.log('═══════════════════════════════════════════════');
  console.log('  STEP 1: Faculty records matching "annapurna"  ');
  console.log('═══════════════════════════════════════════════');
  const facRes = await pool.query(`
    SELECT f.faculty_id, f.name, f.email,
           COUNT(ma.roll_number)::int AS mentor_assignment_count,
           COUNT(s.roll_number)::int  AS students_fk_count
    FROM faculty f
    LEFT JOIN mentor_assignments ma ON UPPER(ma.faculty_id) = UPPER(f.faculty_id)
    LEFT JOIN students s ON UPPER(s.faculty_mentor_id) = UPPER(f.faculty_id)
    WHERE LOWER(f.name) LIKE '%annapurna%'
    GROUP BY f.faculty_id, f.name, f.email
    ORDER BY mentor_assignment_count DESC
  `);
  console.table(facRes.rows);

  if (facRes.rows.length === 0) {
    console.log('✅ No faculty records found matching "annapurna". Nothing to fix.');
    await pool.end(); return;
  }

  // STEP 2: Show mentees per record
  console.log('\n═══════════════════════════════════════════════');
  console.log('  STEP 2: Mentees under each Annapurna record   ');
  console.log('═══════════════════════════════════════════════');
  for (const fac of facRes.rows) {
    const mRes = await pool.query(`
      SELECT ma.roll_number, s.name, s.year, s.section, s.faculty_mentor_id
      FROM mentor_assignments ma
      LEFT JOIN students s ON UPPER(s.roll_number) = UPPER(ma.roll_number)
      WHERE UPPER(ma.faculty_id) = $1
      ORDER BY ma.roll_number
    `, [fac.faculty_id.toUpperCase()]);
    console.log(`\n  📋 [${fac.faculty_id}] ${fac.name} (${fac.email}) — ${mRes.rows.length} mentees:`);
    if (mRes.rows.length > 0) console.table(mRes.rows); else console.log('     (none)');
  }

  // STEP 3: Identify canonical vs placeholder records
  const realFac = facRes.rows.find(f => !String(f.email).startsWith('pending_'));
  const placeholders = facRes.rows.filter(f => String(f.email).startsWith('pending_'));
  console.log('\n═══════════════════════════════════════════════');
  console.log('  STEP 3: Canonical vs Placeholder records       ');
  console.log('═══════════════════════════════════════════════');
  if (realFac) console.log(`  ✅ Real linked faculty: [${realFac.faculty_id}] ${realFac.name} <${realFac.email}>`);
  else console.log('  ⚠️  No real-email record found — all are placeholders.');
  if (placeholders.length > 0) console.log(`  🔶 Placeholder(s): ${placeholders.map(f => `[${f.faculty_id}] ${f.name}`).join(', ')}`);

  // STEP 4: Merge placeholders into real record
  if (realFac && placeholders.length > 0) {
    console.log('\n═══════════════════════════════════════════════');
    console.log('  STEP 4: Merging placeholder → real record     ');
    console.log('═══════════════════════════════════════════════');
    for (const ph of placeholders) {
      console.log(`\n  Merging [${ph.faculty_id}] → [${realFac.faculty_id}] ...`);
      const migRes = await pool.query(`
        INSERT INTO mentor_assignments (roll_number, faculty_id, assigned_at)
        SELECT roll_number, $1, assigned_at FROM mentor_assignments WHERE UPPER(faculty_id) = $2
        ON CONFLICT (roll_number) DO UPDATE SET faculty_id = EXCLUDED.faculty_id, assigned_at = NOW()
      `, [realFac.faculty_id, ph.faculty_id.toUpperCase()]);
      console.log(`    ↳ Migrated ${migRes.rowCount ?? '?'} mentor_assignment rows → [${realFac.faculty_id}]`);
      await pool.query(`DELETE FROM mentor_assignments WHERE UPPER(faculty_id) = $1`, [ph.faculty_id.toUpperCase()]);
      const updRes = await pool.query(`UPDATE students SET faculty_mentor_id = $1, updated_at = NOW() WHERE UPPER(faculty_mentor_id) = $2`, [realFac.faculty_id, ph.faculty_id.toUpperCase()]);
      console.log(`    ↳ Updated ${updRes.rowCount ?? '?'} students.faculty_mentor_id → [${realFac.faculty_id}]`);
      await pool.query(`DELETE FROM faculty WHERE UPPER(faculty_id) = $1`, [ph.faculty_id.toUpperCase()]);
      console.log(`    ↳ Deleted placeholder faculty record [${ph.faculty_id}]`);
    }
  } else {
    console.log('\n  ℹ️  No placeholder merge needed.');
  }

  // STEP 5: Full sync
  console.log('\n═══════════════════════════════════════════════');
  console.log('  STEP 5: Sync mentor_assignments → students     ');
  console.log('═══════════════════════════════════════════════');
  const syncRes = await pool.query(`
    UPDATE students s SET faculty_mentor_id = ma.faculty_id, updated_at = NOW()
    FROM mentor_assignments ma
    WHERE UPPER(s.roll_number) = UPPER(ma.roll_number)
      AND s.faculty_mentor_id IS DISTINCT FROM ma.faculty_id
    RETURNING s.roll_number, ma.faculty_id
  `);
  console.log(`  ✅ Synced ${syncRes.rowCount ?? 0} stale student row(s).`);

  // STEP 6: Final state
  console.log('\n═══════════════════════════════════════════════');
  console.log('  STEP 6: Final verification                    ');
  console.log('═══════════════════════════════════════════════');
  const finalRes = await pool.query(`
    SELECT f.faculty_id, f.name, f.email,
           COUNT(ma.roll_number)::int AS mentor_assignment_count,
           COUNT(s.roll_number)::int  AS students_fk_count
    FROM faculty f
    LEFT JOIN mentor_assignments ma ON UPPER(ma.faculty_id) = UPPER(f.faculty_id)
    LEFT JOIN students s ON UPPER(s.faculty_mentor_id) = UPPER(f.faculty_id)
    WHERE LOWER(f.name) LIKE '%annapurna%'
    GROUP BY f.faculty_id, f.name, f.email
    ORDER BY mentor_assignment_count DESC
  `);
  console.log('\n  Annapurna AFTER fix:'); console.table(finalRes.rows);
  const finalMentees = await pool.query(`
    SELECT ma.roll_number, s.name, s.year, s.section
    FROM mentor_assignments ma
    LEFT JOIN students s ON UPPER(s.roll_number) = UPPER(ma.roll_number)
    JOIN faculty f ON UPPER(ma.faculty_id) = UPPER(f.faculty_id)
    WHERE LOWER(f.name) LIKE '%annapurna%'
    ORDER BY s.year, ma.roll_number
  `);
  console.log(`\n  Final mentee list (${finalMentees.rows.length} total):`);
  if (finalMentees.rows.length > 0) console.table(finalMentees.rows);

  await pool.end();
  console.log('\n✅ Done. All Annapurna mentee records are now clean.\n');
}

main().catch(e => { console.error('\n❌ Error:', e.message); process.exit(1); });
