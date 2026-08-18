/**
 * fix-annapurna-api.js
 * Uses the demo_token_admin_<timestamp> pattern matching authMiddleware.ts
 * Run from: d:\dept\new\adivitiyans\backend\
 */

const https = require('https');

const API_BASE    = 'https://caam6j4dbh.execute-api.ap-south-1.amazonaws.com/prod';
const ADMIN_EMAIL = 'admin@rgmcet.edu.in';

// Build demo token — format: demo_token_admin_<timestamp>
const ADMIN_TOKEN = `demo_token_admin_${Date.now()}`;

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const url  = new URL(API_BASE + path);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type':    'application/json',
        'Authorization':   `Bearer ${ADMIN_TOKEN}`,
        'x-caller-email':  ADMIN_EMAIL,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = https.request(opts, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  console.log(`\n🔑 Using admin token: ${ADMIN_TOKEN}`);
  console.log(`📡 API: ${API_BASE}\n`);

  // ── STEP 1: Fetch all faculty & find Annapurna records ────────────────────
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  STEP 1: Faculty records matching "annapurna"             ');
  console.log('═══════════════════════════════════════════════════════════');
  const facRes = await req('GET', '/faculty');
  if (facRes.status !== 200) {
    console.error('❌  GET /faculty failed:', facRes.status, JSON.stringify(facRes.body));
    process.exit(1);
  }

  const allFaculty = Array.isArray(facRes.body) ? facRes.body : [];
  const annapurna  = allFaculty.filter(f => (f.name || '').toLowerCase().includes('annapurna'));

  console.log(`  Total faculty: ${allFaculty.length}`);
  console.log(`  Matching "annapurna": ${annapurna.length}\n`);

  if (annapurna.length === 0) {
    console.log('✅  No Annapurna records found — nothing to fix.\n');
    return;
  }

  annapurna.forEach(f => {
    const linked = !(f.email || '').startsWith('pending_');
    console.log(`  [${f.faculty_id}]  ${f.name}`);
    console.log(`         email   : ${f.email}`);
    console.log(`         mentees : ${f.mentee_count ?? '?'}`);
    console.log(`         status  : ${linked ? '✅ Real linked record' : '⚠️  Placeholder (pending_email)'}\n`);
  });

  // ── STEP 2: Mentees per Annapurna record ──────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  STEP 2: Mentees under each Annapurna record              ');
  console.log('═══════════════════════════════════════════════════════════');
  for (const fac of annapurna) {
    const mRes = await req('GET', `/faculty/${encodeURIComponent(fac.faculty_id)}/mentees-detail`);
    const mentees = Array.isArray(mRes.body) ? mRes.body : [];
    console.log(`\n  [${fac.faculty_id}] ${fac.name}  —  ${mentees.length} mentee(s):`);
    if (mentees.length === 0) {
      console.log('    (none in mentor_assignments)');
    } else {
      mentees.forEach(m => {
        console.log(`    ${m.roll_number}  ${(m.name || '(unregistered)').padEnd(30)}  ${(m.year || '').padEnd(12)}  Sec:${m.section || '-'}  registered:${m.registered}`);
      });
    }
  }

  // ── STEP 3: Run Sync (reconcile mentor_assignments ↔ students) ───────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  STEP 3: Sync mentor_assignments → students table         ');
  console.log('═══════════════════════════════════════════════════════════');
  const syncRes = await req('POST', '/mentor-assignments/sync');
  if (syncRes.status === 200) {
    console.log(`  ✅  ${syncRes.body?.message}`);
    console.log(`      Synced : ${syncRes.body?.synced ?? 0} student(s)`);
    console.log(`      Cleared: ${syncRes.body?.cleared ?? 0} stale assignment(s)`);
  } else {
    console.log(`  ⚠️  Sync returned ${syncRes.status}: ${JSON.stringify(syncRes.body)}`);
    console.log('      (The /mentor-assignments/sync endpoint may not be deployed yet — deploy first)');
  }

  // ── STEP 4: Guidance on placeholder records ───────────────────────────────
  const realRec = annapurna.find(f => !(f.email || '').startsWith('pending_'));
  const phRecs  = annapurna.filter(f => (f.email || '').startsWith('pending_'));

  if (phRecs.length > 0) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  STEP 4: Placeholder records detected                     ');
    console.log('═══════════════════════════════════════════════════════════');
    if (realRec) {
      console.log(`\n  ℹ️  Real record : [${realRec.faculty_id}] ${realRec.name} <${realRec.email}>`);
      for (const ph of phRecs) {
        console.log(`  ⚠️  Placeholder  : [${ph.faculty_id}] ${ph.name} <${ph.email}> — ${ph.mentee_count ?? 0} mentees`);
        console.log(`\n  📌 ACTION REQUIRED: In Admin → Faculty Management:`);
        console.log(`     1. Find "[${ph.faculty_id}] ${ph.name}"`);
        console.log(`     2. Click "Link Email"`);
        console.log(`     3. Enter: ${realRec.email}`);
        console.log(`     → This will trigger auto-merge on next faculty login.\n`);
        console.log(`  OR: DELETE the placeholder and ensure all its mentees are under [${realRec.faculty_id}]`);
        console.log(`      The API fix code (already committed) will merge them automatically on Annapurna's next login.\n`);
      }
    } else {
      console.log('\n  ⚠️  All Annapurna records are placeholders. Link an email to activate one.\n');
    }
  }

  // ── STEP 5: Final state ───────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  STEP 5: Final state                                      ');
  console.log('═══════════════════════════════════════════════════════════');
  const finalFacRes = await req('GET', '/faculty');
  const finalAnna   = (Array.isArray(finalFacRes.body) ? finalFacRes.body : [])
    .filter(f => (f.name || '').toLowerCase().includes('annapurna'));

  finalAnna.forEach(f => {
    const linked = !(f.email || '').startsWith('pending_');
    console.log(`  [${f.faculty_id}]  ${f.name}  |  ${f.email}  |  ${f.mentee_count ?? '?'} mentees  |  ${linked ? '✅ Linked' : '⚠️  Placeholder'}`);
  });

  console.log('\n✅  Diagnostic complete.\n');
}

main().catch(e => { console.error('\n❌  Error:', e.message); process.exit(1); });
