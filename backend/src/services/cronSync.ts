import { db } from '../db';
import https from 'https';

interface SyncResult {
  totalProcessed: number;
  leetcodeUpdated: number;
  githubUpdated: number;
  timestamp: string;
}

export function cleanLeetCodeHandle(handle: string): string {
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

export function cleanGitHubHandle(handle: string): string {
  if (!handle) return '';
  return handle
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '')
    .trim();
}

// Fetch live LeetCode stats directly via LeetCode GraphQL API
export async function fetchLeetCodeStatsDirect(handle: string): Promise<{ solved: number; easy: number; medium: number; hard: number; ranking?: number; streak?: number } | null> {
  try {
    const cleanHandle = cleanLeetCodeHandle(handle);
    if (!cleanHandle || cleanHandle.toLowerCase() === 'not linked') return null;

    const gql = `
      query userProblemsSolved($username: String!) {
        matchedUser(username: $username) {
          username
          profile { ranking reputation }
          userCalendar { streak }
          submitStats: submitStatsGlobal {
            acSubmissionNum { difficulty count }
          }
        }
      }
    `;

    const postData = JSON.stringify({ query: gql, variables: { username: cleanHandle } });

    return new Promise((resolve) => {
      const opts = {
        hostname: 'leetcode.com',
        path: '/graphql',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
          'Referer': 'https://leetcode.com',
          'Origin': 'https://leetcode.com',
          'Accept': 'application/json',
        },
      };

      const req = https.request(opts, (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              const parsed = JSON.parse(raw);
              const user = parsed?.data?.matchedUser;
              if (user) {
                const stats = user.submitStats?.acSubmissionNum || [];
                const total = stats.find((s: any) => s.difficulty === 'All')?.count || 0;
                const easy = stats.find((s: any) => s.difficulty === 'Easy')?.count || 0;
                const medium = stats.find((s: any) => s.difficulty === 'Medium')?.count || 0;
                const hard = stats.find((s: any) => s.difficulty === 'Hard')?.count || 0;
                resolve({
                  solved: total || (easy + medium + hard),
                  easy,
                  medium,
                  hard,
                  ranking: user.profile?.ranking || 0,
                  streak: user.userCalendar?.streak || 0,
                });
                return;
              }
            }
            resolve(null);
          } catch (_) {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.setTimeout(6000, () => {
        req.destroy();
        resolve(null);
      });
      req.write(postData);
      req.end();
    });
  } catch (_) {
    return null;
  }
}

// Fetch live GitHub stats via GitHub API
export async function fetchGitHubStatsDirect(handle: string): Promise<{ repos: number; followers: number; stars: number; topLanguage: string } | null> {
  try {
    const cleanHandle = cleanGitHubHandle(handle);
    if (!cleanHandle || cleanHandle.toLowerCase() === 'not linked') return null;

    return new Promise((resolve) => {
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Advitiyans-CronSync/1.0',
      };
      if (process.env.GITHUB_PAT) {
        headers['Authorization'] = `Bearer ${process.env.GITHUB_PAT}`;
      }

      const req = https.get(`https://api.github.com/users/${encodeURIComponent(cleanHandle)}`, { headers }, (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', async () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              const user = JSON.parse(raw);
              if (user && typeof user.public_repos === 'number') {
                const repos = user.public_repos;
                const followers = user.followers || 0;

                // Secondary call for repo stats
                let stars = 0;
                let topLanguage = '';
                try {
                  const repoRes: any[] = await new Promise((rRes, rRej) => {
                    const rReq = https.get(
                      `https://api.github.com/users/${encodeURIComponent(cleanHandle)}/repos?per_page=100&sort=pushed`,
                      { headers },
                      (r) => {
                        let d = '';
                        r.on('data', (c) => (d += c));
                        r.on('end', () => {
                          try { rRes(JSON.parse(d)); } catch { rRes([]); }
                        });
                      }
                    );
                    rReq.on('error', () => rRes([]));
                    rReq.setTimeout(4000, () => { rReq.destroy(); rRes([]); });
                  });

                  if (Array.isArray(repoRes)) {
                    stars = repoRes.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
                    const langCounts: Record<string, number> = {};
                    for (const r of repoRes) {
                      if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1;
                    }
                    topLanguage = Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
                  }
                } catch (_) { /* ignore */ }

                resolve({ repos, followers, stars, topLanguage });
                return;
              }
            }
            resolve(null);
          } catch (_) {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.setTimeout(6000, () => {
        req.destroy();
        resolve(null);
      });
    });
  } catch (_) {
    return null;
  }
}

// Batch parallel sync with concurrency limit
export async function runCodingProfileCronSync(limit = 100): Promise<SyncResult> {
  console.log('[CronSync] Starting scheduled coding profile background sync...');
  const result: SyncResult = {
    totalProcessed: 0,
    leetcodeUpdated: 0,
    githubUpdated: 0,
    timestamp: new Date().toISOString(),
  };

  if (db.isMock) {
    console.log('[CronSync] Running in mock mode. Skipped live DB updates.');
    return result;
  }

  try {
    const profilesRes = await db.query(
      `SELECT student_id, platform, handle FROM coding_profiles
       WHERE handle IS NOT NULL AND handle != '' AND handle != 'Not Linked'
       ORDER BY updated_at ASC NULLS FIRST
       LIMIT $1`,
      [limit]
    );

    const rows = profilesRes.rows;
    result.totalProcessed = rows.length;

    // Process in parallel chunks of 8
    const CHUNK_SIZE = 8;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (row) => {
          const { student_id, platform, handle } = row;
          const platLower = String(platform).toLowerCase();

          if (platLower === 'leetcode') {
            const lcData = await fetchLeetCodeStatsDirect(handle);
            if (lcData) {
              await db.query(
                `UPDATE coding_profiles
                 SET score_rating = $1, easy_count = $2, medium_count = $3, hard_count = $4,
                     streak = COALESCE($5, streak), updated_at = CURRENT_TIMESTAMP
                 WHERE student_id = $6 AND LOWER(platform) = 'leetcode'`,
                [lcData.solved, lcData.easy, lcData.medium, lcData.hard, lcData.streak || 0, student_id]
              ).catch(() => {});
              result.leetcodeUpdated++;
            }
          } else if (platLower === 'github') {
            const ghData = await fetchGitHubStatsDirect(handle);
            if (ghData) {
              await db.query(
                `UPDATE coding_profiles
                 SET repositories_count = $1, followers_count = $2, stars_count = $3,
                     top_language = $4, updated_at = CURRENT_TIMESTAMP
                 WHERE student_id = $5 AND LOWER(platform) = 'github'`,
                [ghData.repos, ghData.followers, ghData.stars, ghData.topLanguage, student_id]
              ).catch(() => {});
              result.githubUpdated++;
            }
          }
        })
      );
    }
    console.log(`[CronSync] Completed sync. Total: ${result.totalProcessed}, LeetCode: ${result.leetcodeUpdated}, GitHub: ${result.githubUpdated}`);
  } catch (err: any) {
    console.error('[CronSync] Background sync error:', err.message || err);
  }

  return result;
}
