import { db } from '../db';
import https from 'https';

interface SyncResult {
  totalProcessed: number;
  leetcodeUpdated: number;
  githubUpdated: number;
  timestamp: string;
}

// Helper to fetch JSON from HTTPS
function fetchHttpsJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Advitiyans-CronSync', ...headers } }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Fetch live LeetCode stats via public API
async function fetchLeetCodeStats(handle: string): Promise<{ solved: number; easy: number; medium: number; hard: number } | null> {
  try {
    const cleanHandle = handle.replace(/^@/, '').trim();
    if (!cleanHandle || cleanHandle === 'Not Linked') return null;

    const data = await fetchHttpsJson(`https://leetcode-stats-api.herokuapp.com/${cleanHandle}`);
    if (data && data.status === 'success') {
      return {
        solved: data.totalSolved || 0,
        easy: data.easySolved || 0,
        medium: data.mediumSolved || 0,
        hard: data.hardSolved || 0,
      };
    }
  } catch (e) {
    // Fallback if proxy rate-limited
  }
  return null;
}

// Fetch live GitHub repos via GitHub API
async function fetchGitHubStats(handle: string): Promise<{ repos: number } | null> {
  try {
    const cleanHandle = handle.replace(/^@/, '').trim();
    if (!cleanHandle || cleanHandle === 'Not Linked') return null;

    const data = await fetchHttpsJson(`https://api.github.com/users/${cleanHandle}`);
    if (data && typeof data.public_repos === 'number') {
      return { repos: data.public_repos };
    }
  } catch (e) {
    // Fallback
  }
  return null;
}

export async function runCodingProfileCronSync(): Promise<SyncResult> {
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
      `SELECT student_id, platform, handle FROM coding_profiles WHERE handle IS NOT NULL AND handle != '' AND handle != 'Not Linked'`
    );

    result.totalProcessed = profilesRes.rows.length;

    for (const row of profilesRes.rows) {
      const { student_id, platform, handle } = row;
      if (platform.toLowerCase() === 'leetcode') {
        const lcData = await fetchLeetCodeStats(handle);
        if (lcData) {
          await db.query(
            `UPDATE coding_profiles SET score_rating = $1, easy_count = $2, medium_count = $3, hard_count = $4, updated_at = CURRENT_TIMESTAMP WHERE student_id = $5 AND LOWER(platform) = 'leetcode'`,
            [lcData.solved, lcData.easy, lcData.medium, lcData.hard, student_id]
          ).catch(() => {});
          result.leetcodeUpdated++;
        }
      } else if (platform.toLowerCase() === 'github') {
        const ghData = await fetchGitHubStats(handle);
        if (ghData) {
          await db.query(
            `UPDATE coding_profiles SET repositories_count = $1, updated_at = CURRENT_TIMESTAMP WHERE student_id = $2 AND LOWER(platform) = 'github'`,
            [ghData.repos, student_id]
          ).catch(() => {});
          result.githubUpdated++;
        }
      }
    }
    console.log(`[CronSync] Completed sync. LeetCode: ${result.leetcodeUpdated}, GitHub: ${result.githubUpdated}`);
  } catch (err: any) {
    console.error('[CronSync] Background sync error:', err.message || err);
  }

  return result;
}
