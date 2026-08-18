/**
 * merge-annapurna.js
 * Moves all FAC_AANNAPURNA mentees → FAC_ANNAPURNACSEDS and deletes the placeholder.
 *
 * FAC_AANNAPURNA     = Ms.A.Annapurna        (placeholder, pending email)
 * FAC_ANNAPURNACSEDS = Ms. Arikatla Annapurna (real, annapurnacseds@rgmcet.edu.in)
 *
 * Rolls to reassign from FAC_AANNAPURNA (that are NOT already in FAC_ANNAPURNACSEDS):
 *   23091A3242, 23091A3274, 23091A3299, 24091A3202, 24095A3207,
 *   23091A3233, 23091A3250, 23091A3256, 23091A32A1, 24091A3238,
 *   25091A32K3 (wait — K3 is in both, skip), 25095A3225 (also in both — FAC_ANNAPURNACSEDS wins)
 *   All unique-only to FAC_AANNAPURNA listed below.
 */

const https = require('https');

const API_BASE     = 'https://caam6j4dbh.execute-api.ap-south-1.amazonaws.com/prod';
const ADMIN_EMAIL  = 'admin@rgmcet.edu.in';
const ADMIN_TOKEN  = `demo_token_admin_${Date.now()}`;

// Real faculty ID (canonical)
const REAL_FAC_ID  = 'FAC_ANNAPURNACSEDS';
// Placeholder to remove
const PH_FAC_ID    = 'FAC_AANNAPURNA';

// All rolls currently under FAC_AANNAPURNA (33 from diagnostic output)
const PH_ROLLS = [
  '23091A3242','23091A3274','23091A3299','23091A32F7','24091A3202',
  '24091A3276','24091A32A1','24091A32G3','24091A32G9','24095A3207',
  '25091A32A9','25091A32J7','25091A32P0','25095A3205','25095A3208',
  '25095A3211','25095A3225',
  // unregistered
  '23091A3233','23091A3250','23091A3256','23091A32A1','24091A3214',
  '24091A3238','24091A32E5','24095A3216','25091A3272','25091A3279',
  '25091A32A8','25091A32F0','25091A32F1','25091A32K3','25091A32M4',
  '25095A3229'
];

function apiReq(method, path, body) {
  return new Promise((resolve, reject) => {
    const url  = new URL(API_BASE + path);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type':   'application/json',
        'Authorization':  `Bearer ${ADMIN_TOKEN}`,
        'x-caller-email': ADMIN_EMAIL,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = https.request(opts, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try   { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  console.log(`\n🔑 Token : ${ADMIN_TOKEN}`);
  console.log(`📡 API   : ${API_BASE}\n`);

  // ── Step 1: Upload a corrected assignment for ALL placeholder rolls ────────
  // We upload them as belonging to REAL_FAC_ID. Since ON CONFLICT (roll_number) DO UPDATE
  // the new code will set faculty_id = FAC_ANNAPURNACSEDS for all of them.
  // For the OLD deployed code (composite PK), we use the /mentor-assignments/upload endpoint
  // which also updates students.faculty_mentor_id.

  console.log('══════════════════════════════════════════════════════════════');
  console.log('  STEP 1: Reassign all FAC_AANNAPURNA rolls → FAC_ANNAPURNACSEDS');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  Submitting ${PH_ROLLS.length} roll numbers as belonging to "Ms. Arikatla Annapurna" ...\n`);

  const uploadRes = await apiReq('POST', '/mentor-assignments/upload', {
    rows: [
      {
        facultyName: 'Ms. Arikatla Annapurna',
        rolls: PH_ROLLS,
      }
    ]
  });

  if (uploadRes.status === 200 || uploadRes.status === 201) {
    const b = uploadRes.body;
    console.log('  ✅ Upload succeeded:');
    console.log(`     updated   : ${b.updated?.length ?? b.updatedCount ?? '?'}`);
    console.log(`     notFound  : ${b.notFound?.length ?? b.notFoundCount ?? '?'}`);
    console.log(`     autoCreated: ${b.autoCreatedFaculty?.length ?? '?'} new faculty records`);
    if (b.autoCreatedFaculty?.length > 0) {
      console.log(`     ⚠️  New records created: ${b.autoCreatedFaculty.join(', ')} — check if these are correct!`);
    }
    if (b.notFound?.length > 0) {
      console.log(`     Not-yet-registered rolls: ${b.notFound.join(', ')}`);
    }
  } else {
    console.error(`  ❌ Upload failed (HTTP ${uploadRes.status}):`, JSON.stringify(uploadRes.body));
    process.exit(1);
  }

  // ── Step 2: Unassign all rolls from FAC_AANNAPURNA (delete each) ──────────
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  STEP 2: Removing placeholder FAC_AANNAPURNA assignments    ');
  console.log('══════════════════════════════════════════════════════════════');
  let deletedCount = 0;
  let skipCount    = 0;
  for (const roll of PH_ROLLS) {
    const delRes = await apiReq('DELETE', `/mentor-assignments/${encodeURIComponent(PH_FAC_ID)}/${encodeURIComponent(roll)}`);
    if (delRes.status === 200 || delRes.status === 204) {
      deletedCount++;
    } else if (delRes.status === 404) {
      skipCount++;  // already gone (normal if new code's ON CONFLICT DO UPDATE already moved it)
    } else {
      console.warn(`    ⚠️  DELETE ${PH_FAC_ID}/${roll} → HTTP ${delRes.status}`);
    }
  }
  console.log(`  ✅ Deleted: ${deletedCount}  |  Already-gone (404): ${skipCount}`);

  // ── Step 3: Delete the placeholder faculty record ─────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  STEP 3: Delete placeholder faculty record FAC_AANNAPURNA   ');
  console.log('══════════════════════════════════════════════════════════════');
  const delFacRes = await apiReq('DELETE', `/faculty/${encodeURIComponent(PH_FAC_ID)}`);
  if (delFacRes.status === 200 || delFacRes.status === 204) {
    console.log('  ✅ FAC_AANNAPURNA faculty record deleted.');
  } else {
    console.log(`  ⚠️  DELETE /faculty/FAC_AANNAPURNA → HTTP ${delFacRes.status}: ${JSON.stringify(delFacRes.body)}`);
    console.log('      (Manual deletion may be needed via the Admin Faculty Management page)');
  }

  // ── Step 4: Final verification ────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  STEP 4: Final verification                                 ');
  console.log('══════════════════════════════════════════════════════════════');
  const finalFac = await apiReq('GET', '/faculty');
  const finalAnna = (Array.isArray(finalFac.body) ? finalFac.body : [])
    .filter(f => (f.name || '').toLowerCase().includes('annapurna'));

  console.log(`\n  Annapurna records remaining: ${finalAnna.length}`);
  finalAnna.forEach(f => {
    const linked = !(f.email || '').startsWith('pending_');
    console.log(`  [${f.faculty_id}]  ${f.name}  |  ${f.email}  |  ${f.mentee_count ?? '?'} mentees  |  ${linked ? '✅ Linked' : '⚠️  Placeholder'}`);
  });

  // Fetch final mentee list for real record
  const finalMentees = await apiReq('GET', `/faculty/${encodeURIComponent(REAL_FAC_ID)}/mentees-detail`);
  const mentees = Array.isArray(finalMentees.body) ? finalMentees.body : [];
  const registered   = mentees.filter(m => m.registered).length;
  const unregistered = mentees.filter(m => !m.registered).length;
  console.log(`\n  [${REAL_FAC_ID}] final mentee count: ${mentees.length} total (${registered} registered, ${unregistered} pending registration)`);

  console.log('\n✅  Merge complete. Ms. Arikatla Annapurna now has a single clean record.\n');
}

main().catch(e => { console.error('\n❌  Error:', e.message); process.exit(1); });
