/**
 * backfill-coding-stats.js
 * Comprehensive script to fetch live stats directly from LeetCode GraphQL
 * and GitHub API for all registered students and update the database.
 *
 * Run:
 *   node backend/src/scripts/backfill-coding-stats.js
 */

const https = require('https');

const API_BASE    = 'https://caam6j4dbh.execute-api.ap-south-1.amazonaws.com/prod';
const ADMIN_EMAIL = 'admin@rgmcet.edu.in';
const ADMIN_TOKEN = `demo_token_admin_${Date.now()}`;

// ── API Helper ─────────────────────────────────────────────────────────────
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
      res.on('data', (c) => (raw += c));
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

function cleanLeetCodeHandle(handle) {
  if (!handle) return '';
  return handle
    .trim()
    .replace(/^https?:\/\/(www\.)?leetcode\.com\/(u\/|profile\/)?/i, '')
    .replace(/^https?:\/\/(www\.)?leetcode\.cn\/(u\/|profile\/)?/i, '')
    .replace(/^u\//i, '')
    .replace(/^profile\//i, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '')
    .trim();
}

function cleanGitHubHandle(handle) {
  if (!handle) return '';
  return handle
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '')
    .trim();
}

async function fetchLeetCodeStats(rawHandle) {
  const clean = cleanLeetCodeHandle(rawHandle);
  if (!clean || clean.toLowerCase() === 'not linked' || clean.length < 2) return null;

  const gql = `
    query userProblemsSolved($username: String!) {
      matchedUser(username: $username) {
        username
        userCalendar { streak }
        submitStats: submitStatsGlobal {
          acSubmissionNum { difficulty count }
        }
      }
    }
  `;

  return new Promise((resolve) => {
    const postData = JSON.stringify({ query: gql, variables: { username: clean } });
    const req = https.request(
      {
        hostname: 'leetcode.com',
        path: '/graphql',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
          'Referer': 'https://leetcode.com',
          'Origin': 'https://leetcode.com',
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            const user = data?.data?.matchedUser;
            if (user) {
              const stats = user.submitStats?.acSubmissionNum || [];
              const total = stats.find((s) => s.difficulty === 'All')?.count || 0;
              const easy = stats.find((s) => s.difficulty === 'Easy')?.count || 0;
              const medium = stats.find((s) => s.difficulty === 'Medium')?.count || 0;
              const hard = stats.find((s) => s.difficulty === 'Hard')?.count || 0;
              resolve({
                handle: clean,
                solved: total || (easy + medium + hard),
                easy,
                medium,
                hard,
                streak: user.userCalendar?.streak || 0,
              });
            } else {
              resolve(null);
            }
          } catch (_) {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
    req.write(postData);
    req.end();
  });
}

async function fetchGitHubStats(rawHandle) {
  const clean = cleanGitHubHandle(rawHandle);
  if (!clean || clean.toLowerCase() === 'not linked' || clean.length < 2) return null;

  return new Promise((resolve) => {
    const headers = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Advitiyans-Backfill/1.0',
    };
    const req = https.get(`https://api.github.com/users/${encodeURIComponent(clean)}`, { headers }, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try {
          const user = JSON.parse(raw);
          if (user && typeof user.public_repos === 'number') {
            resolve({
              handle: clean,
              repos: user.public_repos,
              followers: user.followers || 0,
            });
            return;
          }
          resolve(null);
        } catch (_) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
  });
}

// ── Main Backfill Process ──────────────────────────────────────────────────
async function main() {
  console.log('🚀 Starting Coding Profile Backfill...');
  console.log(`📡 Connecting to API: ${API_BASE}`);

  const res = await apiReq('GET', '/students');
  if (!Array.isArray(res.body)) {
    console.error('❌ Failed to fetch students:', res.body);
    process.exit(1);
  }

  const students = res.body;
  console.log(`✅ Loaded ${students.length} students from database.`);

  let lcSuccess = 0;
  let lcNotFound = 0;
  let ghSuccess = 0;
  let ghNotFound = 0;

  // Process students with concurrency limit
  const CONCURRENCY = 6;
  const queue = [...students];
  let processed = 0;

  async function worker(workerId) {
    while (queue.length > 0) {
      const s = queue.shift();
      processed++;
      const roll = s.roll_number;
      const lcHandle = s.leetcode_handle || s.leetcode;
      const ghHandle = s.github_handle || s.github;

      // 1. LeetCode sync
      if (lcHandle && lcHandle !== 'Not Linked') {
        const lcData = await fetchLeetCodeStats(lcHandle);
        if (lcData) {
          await apiReq('POST', `/students/${roll}/coding-profiles`, {
            platform: 'LeetCode',
            handle: lcData.handle,
            score_rating: lcData.solved,
            easy_count: lcData.easy,
            medium_count: lcData.medium,
            hard_count: lcData.hard,
            streak: lcData.streak,
          });
          lcSuccess++;
          console.log(`[${processed}/${students.length}] 🟢 LC ${roll} (${lcData.handle}): ${lcData.solved} solved (E:${lcData.easy}, M:${lcData.medium}, H:${lcData.hard})`);
        } else {
          lcNotFound++;
        }
      }

      // 2. GitHub sync
      if (ghHandle && ghHandle !== 'Not Linked') {
        const ghData = await fetchGitHubStats(ghHandle);
        if (ghData) {
          await apiReq('POST', `/students/${roll}/coding-profiles`, {
            platform: 'GitHub',
            handle: ghData.handle,
            repositories_count: ghData.repos,
            followers_count: ghData.followers,
          });
          ghSuccess++;
        } else {
          ghNotFound++;
        }
      }

      // Small throttle between requests per worker
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, idx) => worker(idx + 1));
  await Promise.all(workers);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🎉 Backfill Completed Successfully!');
  console.log(`📊 LeetCode: ${lcSuccess} updated, ${lcNotFound} not found / invalid`);
  console.log(`📊 GitHub:   ${ghSuccess} updated, ${ghNotFound} not found / invalid`);
  console.log('═══════════════════════════════════════════════════════');
}

main().catch(console.error);
