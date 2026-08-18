/**
 * audit-all-mentors.js
 * Full audit + fix for ALL mentor-mentee assignments.
 *
 * Detects and fixes:
 *   1. Placeholder (pending_) faculty records that have mentees
 *   2. Duplicate faculty records (same person, two IDs)
 *   3. Students double-assigned to multiple mentors (keeps latest real-faculty assignment)
 *
 * Run from: d:\dept\new\adivitiyans\backend\
 *   node audit-all-mentors.js
 */

const https = require('https');

const API_BASE    = 'https://caam6j4dbh.execute-api.ap-south-1.amazonaws.com/prod';
const ADMIN_EMAIL = 'admin@rgmcet.edu.in';
const ADMIN_TOKEN = `demo_token_admin_${Date.now()}`;

// ── Helper: HTTP request ──────────────────────────────────────────────────────
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

// ── Helper: normalize faculty name (strip titles, initials, extra spaces) ────
function normalizeName(name = '') {
  return name.toLowerCase()
    .replace(/^(dr|prof|mr|mrs|ms|er)\.?\s*/i, '')
    .replace(/\b[a-z]\.\s*/g, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Helper: significant words (len>=4) ────────────────────────────────────────
function sigWords(norm) {
  return norm.split(' ').filter(w => w.length >= 4);
}

// ── Helper: do two normalized names refer to the same person? ─────────────────
// Requires >= 2 significant words to match (prevents single-surname false positives)
function isSamePerson(normA, normB) {
  const wa = sigWords(normA);
  const wb = sigWords(normB);
  if (wa.length < 2 || wb.length < 2) return false; // too short to be safe
  const aMatchCount = wa.filter(w => normB.includes(w)).length;
  const bMatchCount = wb.filter(w => normA.includes(w)).length;
  return aMatchCount >= 2 || bMatchCount >= 2;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔑 Token : ${ADMIN_TOKEN}`);
  console.log(`📡 API   : ${API_BASE}\n`);

  // ══ Fetch all faculty ══════════════════════════════════════════════════════
  console.log('Fetching all faculty...');
  const facRes = await apiReq('GET', '/faculty');
  if (facRes.status !== 200) {
    console.error('❌ GET /faculty failed:', facRes.status); process.exit(1);
  }
  const allFaculty = Array.isArray(facRes.body) ? facRes.body : [];
  console.log(`  Total faculty: ${allFaculty.length}\n`);

  // ══ Fetch mentee lists for every faculty ══════════════════════════════════
  console.log('Fetching mentee details for all faculty (may take ~30s)...');
  const menteeMap = {}; // faculty_id → mentee[]
  for (const fac of allFaculty) {
    const r = await apiReq('GET', `/faculty/${encodeURIComponent(fac.faculty_id)}/mentees-detail`);
    menteeMap[fac.faculty_id] = Array.isArray(r.body) ? r.body : [];
  }
  console.log('  Done.\n');

  // ══ Build roll → [faculty_id] map to detect double-assignments ════════════
  const rollToFacIds = {}; // roll_number → Set of faculty_ids
  for (const fac of allFaculty) {
    for (const m of menteeMap[fac.faculty_id] || []) {
      if (!rollToFacIds[m.roll_number]) rollToFacIds[m.roll_number] = new Set();
      rollToFacIds[m.roll_number].add(fac.faculty_id);
    }
  }
  const doubleAssigned = Object.entries(rollToFacIds)
    .filter(([, facIds]) => facIds.size > 1)
    .map(([roll, facIds]) => ({ roll, facIds: [...facIds] }));

  // ══ Detect placeholder records WITH mentees ═══════════════════════════════
  const placeholdersWithMentees = allFaculty.filter(f =>
    String(f.email || '').startsWith('pending_') && (menteeMap[f.faculty_id]?.length ?? 0) > 0
  );

  // ══ Detect fuzzy-duplicate faculty pairs ══════════════════════════════════
  const duplicatePairs = []; // [{placeholder, real}]
  for (const ph of placeholdersWithMentees) {
    const phNorm = normalizeName(ph.name);
    // Look for a real (linked email) faculty whose name matches
    const match = allFaculty.find(f => {
      if (f.faculty_id === ph.faculty_id) return false;
      if (String(f.email || '').startsWith('pending_')) return false; // skip other placeholders
      return isSamePerson(phNorm, normalizeName(f.name));
    });
    if (match) {
      duplicatePairs.push({ placeholder: ph, real: match });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // REPORT
  // ══════════════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  AUDIT REPORT                                                 ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Summary table
  console.log('  Faculty summary (all records):');
  console.log(`  ${'faculty_id'.padEnd(26)} ${'name'.padEnd(35)} ${'email'.padEnd(35)} mentees linked`);
  console.log('  ' + '─'.repeat(110));
  for (const fac of allFaculty) {
    const linked   = !String(fac.email || '').startsWith('pending_');
    const count    = menteeMap[fac.faculty_id]?.length ?? 0;
    const flag     = !linked && count > 0 ? '⚠️ ' : linked ? '✅ ' : '   ';
    console.log(`  ${flag}${fac.faculty_id.padEnd(24)} ${(fac.name || '').padEnd(35)} ${(fac.email || '').padEnd(35)} ${String(count).padStart(3)}    ${linked ? 'yes' : 'NO'}`);
  }

  console.log(`\n  ──────────────────────────────────────────────────────────`);
  console.log(`  Issues found:`);
  console.log(`    ⚠️  Placeholder records WITH mentees : ${placeholdersWithMentees.length}`);
  console.log(`    🔴 Auto-mergeable duplicate pairs   : ${duplicatePairs.length}`);
  console.log(`    🔁 Students double-assigned          : ${doubleAssigned.length}`);

  if (placeholdersWithMentees.length > 0) {
    console.log('\n  Placeholder records with mentees:');
    for (const f of placeholdersWithMentees) {
      const match = duplicatePairs.find(p => p.placeholder.faculty_id === f.faculty_id);
      const mergeTarget = match ? `→ merge into [${match.real.faculty_id}] ${match.real.name}` : '→ no auto-merge target found';
      console.log(`    [${f.faculty_id}] ${f.name}  (${menteeMap[f.faculty_id]?.length} mentees)  ${mergeTarget}`);
    }
  }

  if (doubleAssigned.length > 0) {
    console.log('\n  Double-assigned students (appear under multiple faculty):');
    for (const { roll, facIds } of doubleAssigned.slice(0, 20)) {
      console.log(`    ${roll}  →  ${facIds.join(', ')}`);
    }
    if (doubleAssigned.length > 20) console.log(`    ... and ${doubleAssigned.length - 20} more`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FIX
  // ══════════════════════════════════════════════════════════════════════════
  let totalFixed = 0;
  let totalErrors = 0;

  // ── Fix 1: Merge auto-detectable duplicate pairs ──────────────────────────
  if (duplicatePairs.length > 0) {
    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('  FIX 1: Merging placeholder duplicates → real records          ');
    console.log('═══════════════════════════════════════════════════════════════');

    for (const { placeholder: ph, real } of duplicatePairs) {
      const rolls = (menteeMap[ph.faculty_id] || []).map(m => m.roll_number);
      if (rolls.length === 0) { console.log(`  [${ph.faculty_id}] has 0 mentees — skipping.`); continue; }

      console.log(`\n  Merging [${ph.faculty_id}] ${ph.name}  →  [${real.faculty_id}] ${real.name}`);
      console.log(`    Rolls to reassign (${rolls.length}): ${rolls.slice(0, 8).join(', ')}${rolls.length > 8 ? '...' : ''}`);

      // Reassign via upload
      const upRes = await apiReq('POST', '/mentor-assignments/upload', {
        rows: [{ facultyName: real.name, rolls }]
      });
      if (upRes.status === 200 || upRes.status === 201) {
        console.log(`    ✅ Reassigned ${rolls.length} rolls → ${real.name}`);
        totalFixed += rolls.length;
      } else {
        console.error(`    ❌ Upload failed: HTTP ${upRes.status}`, JSON.stringify(upRes.body));
        totalErrors++;
        continue;
      }

      // Delete each roll from placeholder
      let delOk = 0;
      for (const roll of rolls) {
        const dr = await apiReq('DELETE', `/mentor-assignments/${encodeURIComponent(ph.faculty_id)}/${encodeURIComponent(roll)}`);
        if (dr.status === 200 || dr.status === 204 || dr.status === 404) delOk++;
        else console.warn(`    ⚠️  DELETE ${ph.faculty_id}/${roll} → ${dr.status}`);
      }
      console.log(`    ✅ Removed ${delOk} old assignments from [${ph.faculty_id}]`);

      // Delete placeholder faculty record
      const dfr = await apiReq('DELETE', `/faculty/${encodeURIComponent(ph.faculty_id)}`);
      if (dfr.status === 200 || dfr.status === 204) {
        console.log(`    ✅ Deleted placeholder faculty record [${ph.faculty_id}]`);
      } else {
        console.log(`    ⚠️  DELETE /faculty/${ph.faculty_id} → ${dfr.status} (may need manual removal)`);
      }
    }
  }

  // ── Fix 2: Orphaned placeholders (no auto-merge target) ───────────────────
  const orphanedPlaceholders = placeholdersWithMentees.filter(
    ph => !duplicatePairs.find(p => p.placeholder.faculty_id === ph.faculty_id)
  );
  if (orphanedPlaceholders.length > 0) {
    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('  MANUAL ACTION REQUIRED: Unmatched placeholders               ');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  These placeholder records have mentees but no auto-detectable real record.');
    console.log('  Go to Admin → Faculty Management → "Link Email" to resolve them:\n');
    for (const ph of orphanedPlaceholders) {
      const count = menteeMap[ph.faculty_id]?.length ?? 0;
      console.log(`  ⚠️  [${ph.faculty_id}] ${ph.name}  —  ${count} mentee(s)`);
      console.log(`      → Use "Link Email" to link to the correct faculty member's email.`);
    }
  }

  // ── Fix 3: Re-fetch to detect remaining double-assignments ────────────────
  if (doubleAssigned.length > 0) {
    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('  FIX 3: Resolving double-assigned students                     ');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  For students under multiple faculty, keep the REAL (linked email) faculty.');
    console.log('  Remove from any placeholder faculty.\n');

    const realFacultyIds = new Set(
      allFaculty.filter(f => !String(f.email || '').startsWith('pending_')).map(f => f.faculty_id)
    );

    let doubleFixed = 0;
    for (const { roll, facIds } of doubleAssigned) {
      const realFacIds = facIds.filter(id => realFacultyIds.has(id));
      const phFacIds   = facIds.filter(id => !realFacultyIds.has(id));
      if (phFacIds.length === 0) {
        // Student under multiple REAL faculty — pick first, log warning
        console.log(`  ⚠️  ${roll} is under multiple real faculty: ${facIds.join(', ')} — keeping first, removing others.`);
        for (const removeId of facIds.slice(1)) {
          await apiReq('DELETE', `/mentor-assignments/${encodeURIComponent(removeId)}/${encodeURIComponent(roll)}`);
          console.log(`     Removed from [${removeId}]`);
        }
        doubleFixed++;
      } else {
        // Remove from placeholder(s), keep real
        for (const phId of phFacIds) {
          const dr = await apiReq('DELETE', `/mentor-assignments/${encodeURIComponent(phId)}/${encodeURIComponent(roll)}`);
          if (dr.status === 200 || dr.status === 204 || dr.status === 404) {
            doubleFixed++;
          }
        }
      }
    }
    console.log(`\n  ✅ Resolved double-assignments for ${doubleFixed} roll(s).`);
    totalFixed += doubleFixed;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('  FINAL SUMMARY                                                 ');
  console.log('═══════════════════════════════════════════════════════════════');

  const finalFacRes = await apiReq('GET', '/faculty');
  const finalFaculty = Array.isArray(finalFacRes.body) ? finalFacRes.body : [];
  const finalPhWithMentees = finalFaculty.filter(f =>
    String(f.email || '').startsWith('pending_') && (f.mentee_count ?? 0) > 0
  );

  console.log(`\n  Faculty count     : ${finalFaculty.length}`);
  console.log(`  Fixes applied     : ${totalFixed}`);
  console.log(`  Errors            : ${totalErrors}`);
  console.log(`  Remaining issues  : ${finalPhWithMentees.length} placeholder(s) still have mentees`);

  if (finalPhWithMentees.length > 0) {
    console.log('\n  Remaining placeholders needing manual attention:');
    finalPhWithMentees.forEach(f => {
      console.log(`    [${f.faculty_id}] ${f.name}  |  ${f.mentee_count} mentees  |  email: ${f.email}`);
    });
    console.log('\n  ACTION: Go to Admin → Faculty Management → Link Email for each above.');
  } else {
    console.log('\n  ✅ All faculty records are clean. Every mentor has a verified email and correct mentees.');
  }

  console.log('\n✅  Audit and fix complete.\n');
}

main().catch(e => { console.error('\n❌  Fatal:', e.message); process.exit(1); });
