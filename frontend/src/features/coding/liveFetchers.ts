import { PlatformId, PlatformStatsSnapshot } from './platformData';

// ─── Real Live API Fetchers ───────────────────────────────────────────────────

const BACKEND_API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://caam6j4dbh.execute-api.ap-south-1.amazonaws.com/prod';

/**
 * Fetches real LeetCode stats.
 *
 * API chain (most-to-least reliable):
 *   1. Backend proxy  /proxy/leetcode/:handle  — server-side LeetCode GraphQL call,
 *      avoids CORS and Cloudflare blocks. Most reliable.
 *   2. alfa-leetcode-api.onrender.com           — public fallback (may 429 under load).
 *
 * Previously used endpoints that are now DEAD:
 *   ✗ leetcode-api-faisalshohag.vercel.app      — 404 DEPLOYMENT_NOT_FOUND
 *   ✗ leetcode-stats-api.herokuapp.com          — 503 Server Unavailable
 */
export async function fetchLiveLeetCode(handle: string, forceRefresh = false): Promise<PlatformStatsSnapshot> {
  const cleanHandle = handle.replace(/^@/, '').trim();

  let profileData: any = null;
  let calendarObj: Record<string, number> = {};
  let contestData: any = {};
  let recentActivities: any[] = [];

  // ── Primary: backend proxy (server-side LeetCode GraphQL) ────────────────
  try {
    const token = sessionStorage.getItem('advitiyans_jwt_token') || '';
    const query = forceRefresh ? '?refresh=true' : '';
    const res = await fetch(`${BACKEND_API_BASE}/proxy/leetcode/${encodeURIComponent(cleanHandle)}${query}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.error && String(data.error).toLowerCase().includes('not found')) {
        throw new Error(`LeetCode user "${cleanHandle}" not found.`);
      }
      if (data && data.totalSolved !== undefined) {
        profileData = {
          totalSolved: data.totalSolved ?? 0,
          easySolved: data.easySolved ?? 0,
          mediumSolved: data.mediumSolved ?? 0,
          hardSolved: data.hardSolved ?? 0,
          ranking: data.ranking ?? 0,
          totalEasy: 857,
          totalMedium: 1756,
          totalHard: 799,
        };
        contestData = {
          attendedContestsCount: data.attendedContestsCount ?? 0,
          rating: data.contestRating ?? 0,
        };

        const rawCalField = data.submissionCalendar ?? data.submissionCalendarJSON;
        if (rawCalField) {
          try {
            const rawCal = typeof rawCalField === 'string' ? JSON.parse(rawCalField) : rawCalField;
            Object.entries(rawCal).forEach(([epochStr, count]) => {
              const d = new Date(Number(epochStr) * 1000);
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              const dateStr = `${year}-${month}-${day}`;
              calendarObj[dateStr] = (calendarObj[dateStr] || 0) + Number(count);
            });
          } catch { /* ignore */ }
        }

        const recentList = data.recentSubmissions ?? data.recentAcSubmissionNum ?? [];
        if (Array.isArray(recentList)) {
          recentActivities = recentList.slice(0, 15).map((sub: any) => {
            const d = sub.timestamp ? new Date(Number(sub.timestamp) * 1000) : new Date();
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return {
              date: dateStr,
              title: sub.title ?? sub.titleSlug ?? 'Problem',
              status: sub.statusDisplay ?? sub.status ?? 'Accepted',
              type: 'submission',
            };
          });
        }
      }
    } else if (res.status === 404) {
      throw new Error(`LeetCode user "${cleanHandle}" not found.`);
    }
  } catch (e: any) {
    if (e.message?.includes('not found')) throw e;
    console.warn('[LeetCode] Backend proxy failed, trying fallback:', e.message);
  }

  // ── Fallback: alfa-leetcode-api (public, may rate-limit) ─────────────────
  if (!profileData) {
    try {
      const [profileRes, contestRes] = await Promise.allSettled([
        fetch(`https://alfa-leetcode-api.onrender.com/userProfile/${encodeURIComponent(cleanHandle)}`),
        fetch(`https://alfa-leetcode-api.onrender.com/userContestRankingInfo/${encodeURIComponent(cleanHandle)}`),
      ]);

      if (profileRes.status === 'fulfilled' && profileRes.value.ok) {
        const data = await profileRes.value.json();
        if (data?.errors || data?.error) {
          throw new Error(`LeetCode user "${cleanHandle}" not found.`);
        }
        profileData = {
          totalSolved: data.totalSolved ?? data.totalQuestions ?? 0,
          easySolved: data.easySolved ?? 0,
          mediumSolved: data.mediumSolved ?? 0,
          hardSolved: data.hardSolved ?? 0,
          ranking: data.ranking ?? 0,
          totalEasy: 857,
          totalMedium: 1756,
          totalHard: 799,
        };

        const rawCalField = data.submissionCalendar ?? data.submissionCalendarJSON;
        if (rawCalField) {
          try {
            const rawCal = typeof rawCalField === 'string' ? JSON.parse(rawCalField) : rawCalField;
            Object.entries(rawCal).forEach(([epochStr, count]) => {
              const dateStr = new Date(Number(epochStr) * 1000).toISOString().slice(0, 10);
              calendarObj[dateStr] = (calendarObj[dateStr] || 0) + Number(count);
            });
          } catch { /* ignore */ }
        }

        const recentList = data.recentSubmissions ?? data.recentAcSubmissionNum ?? [];
        if (Array.isArray(recentList)) {
          recentActivities = recentList.slice(0, 15).map((sub: any) => ({
            date: sub.timestamp
              ? new Date(Number(sub.timestamp) * 1000).toISOString().slice(0, 10)
              : new Date().toISOString().slice(0, 10),
            title: sub.title ?? sub.titleSlug ?? 'Problem',
            status: sub.statusDisplay ?? sub.status ?? 'Accepted',
            type: 'submission',
          }));
        }
      } else if (profileRes.status === 'fulfilled' && profileRes.value.status === 404) {
        throw new Error(`LeetCode user "${cleanHandle}" not found.`);
      }

      if (contestRes.status === 'fulfilled' && contestRes.value.ok) {
        const contestJson = await contestRes.value.json();
        contestData = contestJson?.userContestRanking || contestData;
      }
    } catch (e: any) {
      if (e.message?.includes('not found')) throw e;
      console.warn('[LeetCode] Alfa fallback also failed:', e.message);
    }
  }

  const easySolved = profileData?.easySolved ?? 0;
  const mediumSolved = profileData?.mediumSolved ?? 0;
  const hardSolved = profileData?.hardSolved ?? 0;
  const totalSolved = profileData?.totalSolved ?? (easySolved + mediumSolved + hardSolved);

  return {
    platform: 'leetcode',
    handle: cleanHandle,
    profileUrl: `https://leetcode.com/${cleanHandle}`,
    lastRefreshedAt: new Date().toISOString(),
    syncStatus: 'synced',
    kpis: [
      { label: 'Total Questions Solved', value: totalSolved },
      { label: 'Total Contests Attended', value: contestData?.attendedContestsCount ?? 0 },
      { label: 'User name', value: cleanHandle, isLink: true },
    ],
    breakdown: [
      { label: 'Easy', solved: easySolved, total: profileData?.totalEasy ?? 857, color: '#00b8a3' },
      { label: 'Medium', solved: mediumSolved, total: profileData?.totalMedium ?? 1756, color: '#ffc01e' },
      { label: 'Hard', solved: hardSolved, total: profileData?.totalHard ?? 799, color: '#ff375f' },
    ],
    awards: (profileData?.badges || []).map((b: any) => ({
      title: b.displayName || b.name,
      icon: '🏅',
      earnedAt: b.creationDate ? new Date(b.creationDate).toISOString().slice(0, 10) : undefined,
    })),
    topicAnalysis: [
      { label: 'Arrays (Est.)', count: Math.max(1, Math.round(easySolved * 0.4)) },
      { label: 'Strings (Est.)', count: Math.max(1, Math.round(easySolved * 0.3)) },
      { label: 'DP (Est.)', count: Math.max(1, Math.round(mediumSolved * 0.4)) },
      { label: 'Trees & Graphs (Est.)', count: Math.max(1, Math.round(mediumSolved * 0.3)) },
      { label: 'Math (Est.)', count: Math.max(1, Math.round(easySolved * 0.2)) },
    ],
    activity: recentActivities,
    heatmap: calendarObj,
  };
}
/**
 * Sanitizes a platform handle — strips leading @ and full profile URLs so that
 * users who paste a full URL (e.g. https://github.com/user) get just the username.
 */
function sanitizeHandle(handle: string, patterns: RegExp[]): string {
  let h = handle.replace(/^@/, '').trim();
  for (const pattern of patterns) {
    h = h.replace(pattern, '');
  }
  return h.replace(/\/$/, '').trim();
}

/**
 * Fetches real GitHub user profile & repositories.
 *
 * API chain:
 *   1. Backend proxy /proxy/github/:handle — server-side, uses GITHUB_PAT env var (5000 req/hr).
 *   2. Direct GitHub REST API — 60 req/hr unauthenticated; 403/429 treated as rate-limited
 *      (graceful degradation, NOT an error thrown to the user).
 *
 * Handle sanitization: strips full GitHub URLs if pasted instead of just the username.
 */
export async function fetchLiveGitHub(handle: string): Promise<PlatformStatsSnapshot> {
  const cleanHandle = sanitizeHandle(handle, [/^https?:\/\/(www\.)?github\.com\//i]);

  let user: any = null;
  let repos: any[] = [];
  let events: any[] = [];
  let isRateLimited = false;

  // Primary: backend proxy (server-side, optionally authenticated via GITHUB_PAT)
  try {
    const token = sessionStorage.getItem('advitiyans_jwt_token') || '';
    const res = await fetch(`${BACKEND_API_BASE}/proxy/github/${encodeURIComponent(cleanHandle)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.error && String(data.error).toLowerCase().includes('not found')) {
        throw new Error(`GitHub user "${cleanHandle}" not found.`);
      }
      if (data?.login || data?.public_repos !== undefined) {
        user = data;
        repos = data.repos || [];
        events = data.events || [];
      }
    } else if (res.status === 404) {
      throw new Error(`GitHub user "${cleanHandle}" not found.`);
    }
  } catch (e: any) {
    if (e.message?.includes('not found')) throw e;
    console.warn('[GitHub] Backend proxy failed, trying direct API:', e.message);
  }

  // Fallback: direct GitHub REST API (unauthenticated, 60 req/hr limit)
  if (!user) {
    try {
      const headers = { 'Accept': 'application/vnd.github+json' };
      const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanHandle)}`, { headers });
      if (userRes.status === 404) {
        throw new Error(`GitHub user "${cleanHandle}" not found.`);
      }
      if (userRes.status === 403 || userRes.status === 429) {
        // Rate limited — degrade gracefully instead of throwing to avoid noisy error UI
        console.warn(`[GitHub] Rate limited (${userRes.status}) for ${cleanHandle}`);
        isRateLimited = true;
      } else if (userRes.ok) {
        user = await userRes.json();
        if (!user?.login) throw new Error(`GitHub user "${cleanHandle}" not found.`);
        const [reposRes, eventsRes] = await Promise.allSettled([
          fetch(`https://api.github.com/users/${encodeURIComponent(cleanHandle)}/repos?sort=updated&per_page=100`, { headers }),
          fetch(`https://api.github.com/users/${encodeURIComponent(cleanHandle)}/events/public?per_page=30`, { headers }),
        ]);
        repos = reposRes.status === 'fulfilled' && reposRes.value.ok ? await reposRes.value.json() : [];
        events = eventsRes.status === 'fulfilled' && eventsRes.value.ok ? await eventsRes.value.json() : [];
      }
    } catch (e: any) {
      if (e.message?.includes('not found')) throw e;
      console.warn('[GitHub] Direct API also failed:', e.message);
    }
  }

  const langCounts: Record<string, number> = {};
  let totalStars = 0;
  const heatmap: Record<string, number> = {};
  const activities: any[] = [];

  repos.forEach((r: any) => {
    totalStars += r.stargazers_count || 0;
    if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1;
  });

  events.forEach((ev: any) => {
    if (!ev.created_at) return;
    const dateStr = new Date(ev.created_at).toISOString().slice(0, 10);
    heatmap[dateStr] = (heatmap[dateStr] || 0) + 1;
    if (ev.type === 'PushEvent') {
      const repoName = ev.repo?.name || 'repository';
      const commitCount = ev.payload?.commits?.length || 1;
      activities.push({ date: dateStr, title: `Pushed ${commitCount} commit(s) to ${repoName}`, status: `${commitCount} commits`, type: 'push' });
    } else if (ev.type === 'PullRequestEvent') {
      const action = ev.payload?.action || 'opened';
      activities.push({ date: dateStr, title: `PR ${action}: ${ev.payload?.pull_request?.title || 'Pull Request'}`, status: action, type: 'pr' });
    }
  });

  const topicAnalysis = Object.entries(langCounts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  const publicRepos = user?.public_repos ?? repos.length;
  const followers = user?.followers ?? 0;

  return {
    platform: 'github',
    handle: cleanHandle,
    profileUrl: user?.html_url || `https://github.com/${cleanHandle}`,
    lastRefreshedAt: new Date().toISOString(),
    syncStatus: isRateLimited ? 'rate_limited' : 'synced',
    kpis: [
      { label: 'Public Repositories', value: publicRepos },
      { label: 'Total Stars Earned', value: totalStars },
      { label: 'Followers', value: followers },
      { label: 'User name', value: cleanHandle, isLink: true },
    ],
    awards: [
      { title: isRateLimited ? 'GitHub (Rate Limited — Retry Later)' : 'Public Contributor', icon: '🙌' },
      ...(followers > 10 ? [{ title: 'Popular Dev (10+ Followers)', icon: '⭐' }] : []),
      ...(publicRepos >= 10 ? [{ title: 'Active Creator', icon: '🚀' }] : []),
    ],
    topicAnalysis: topicAnalysis.length > 0 ? topicAnalysis : [{ label: 'Repositories', count: publicRepos }],
    activity: activities,
    heatmap,
  };
}

/**
 * Fetches real Codeforces profile & rating history via Codeforces API.
 * Throws if the user does not exist.
 */
export async function fetchLiveCodeforces(handle: string): Promise<PlatformStatsSnapshot> {
  const cleanHandle = handle.replace(/^@/, '').trim();

  const [infoRes, ratingRes, statusRes] = await Promise.allSettled([
    fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(cleanHandle)}`),
    fetch(`https://codeforces.com/api/user.rating?handle=${encodeURIComponent(cleanHandle)}`),
    fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(cleanHandle)}&from=1&count=100`),
  ]);

  let userInfo: any = null;
  if (infoRes.status === 'fulfilled' && infoRes.value.ok) {
    const infoJson = await infoRes.value.json();
    if (infoJson.status === 'OK' && infoJson.result?.[0]) {
      userInfo = infoJson.result[0];
    } else {
      throw new Error(`Codeforces user "${cleanHandle}" not found.`);
    }
  } else {
    throw new Error(`Could not reach Codeforces API. Please try again.`);
  }

  let ratingHistory: any[] = [];
  if (ratingRes.status === 'fulfilled' && ratingRes.value.ok) {
    const ratingJson = await ratingRes.value.json();
    if (ratingJson.status === 'OK' && Array.isArray(ratingJson.result)) {
      ratingHistory = ratingJson.result.map((r: any) => ({
        date: new Date(r.ratingUpdateTimeSeconds * 1000).toISOString().slice(0, 10),
        rating: r.newRating,
        contestName: r.contestName,
      }));
    }
  }

  const heatmap: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};
  const activities: any[] = [];

  if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
    const statusJson = await statusRes.value.json();
    if (statusJson.status === 'OK' && Array.isArray(statusJson.result)) {
      statusJson.result.forEach((sub: any) => {
        const dateStr = new Date(sub.creationTimeSeconds * 1000).toISOString().slice(0, 10);
        heatmap[dateStr] = (heatmap[dateStr] || 0) + 1;

        if (sub.verdict === 'OK') {
          (sub.problem?.tags || []).forEach((t: string) => {
            tagCounts[t] = (tagCounts[t] || 0) + 1;
          });
        }

        if (activities.length < 15) {
          activities.push({
            date: dateStr,
            title: `${sub.problem?.index || ''} ${sub.problem?.name || 'Problem'}`.trim(),
            status: sub.verdict === 'OK' ? 'Accepted' : sub.verdict || 'Submitted',
            type: 'submission',
          });
        }
      });
    }
  }

  const topicAnalysis = Object.entries(tagCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return {
    platform: 'codeforces',
    handle: cleanHandle,
    profileUrl: `https://codeforces.com/profile/${cleanHandle}`,
    lastRefreshedAt: new Date().toISOString(),
    syncStatus: 'synced',
    kpis: [
      { label: 'Current Rating', value: userInfo.rating ?? 'Unrated' },
      { label: 'Max Rating', value: userInfo.maxRating ?? 'Unrated' },
      { label: 'User name', value: cleanHandle, isLink: true },
    ],
    ratingHistory,
    awards: [
      { title: userInfo.rank ? `Title: ${userInfo.rank}` : 'Codeforces Competitor', icon: 'ðŸ”µ' },
      ...(userInfo.maxRating >= 1400 ? [{ title: 'Specialist Achievement', icon: 'â­' }] : []),
    ],
    topicAnalysis,
    activity: activities,
    heatmap,
  };
}

/**
 * Fetches GeeksforGeeks profile via unofficial stats API.
 * Returns real solved counts per difficulty, coding score, streak, and institute rank.
 * Gracefully degrades to profile link if API is unreachable.
 */
export async function fetchLiveGeeksforGeeks(handle: string): Promise<PlatformStatsSnapshot> {
  // Strip full GFG profile URLs — users sometimes paste the full URL as their handle
  // e.g. 'https://www.geeksforgeeks.org/profile/dineshkumarvyyp' -> 'dineshkumarvyyp'
  const cleanHandle = sanitizeHandle(handle, [
    /^https?:\/\/(www\.)?geeksforgeeks\.org\/profile\//i,
    /^https?:\/\/(www\.)?geeksforgeeks\.org\/user\//i,
    /^https?:\/\/auth\.geeksforgeeks\.org\/user\//i,
  ]).replace(/\?.*$/, ''); // strip query params like ?from=explore


  let userData: any = null;

  // ── Primary: backend proxy (server-side, avoids browser rate limits) ─────────
  try {
    const token = sessionStorage.getItem('advitiyans_jwt_token') || '';
    const res = await fetch(`${BACKEND_API_BASE}/proxy/gfg/${encodeURIComponent(cleanHandle)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.error && String(data.error).toLowerCase().includes('not found')) {
        throw new Error(`GeeksforGeeks user "${cleanHandle}" not found.`);
      }
      if (data?.info) userData = data;
    } else if (res.status === 404) {
      throw new Error(`GeeksforGeeks user "${cleanHandle}" not found.`);
    }
  } catch (e: any) {
    if (e.message?.includes('not found')) throw e;
    console.warn('[GFG] Backend proxy failed, trying direct API:', e.message);
  }

  // ── Backend proxy scrapes GFG profile page directly (no broken 3rd-party APIs) ──
  try {
    const token = sessionStorage.getItem('advitiyans_jwt_token') || '';
    const res = await fetch(`${BACKEND_API_BASE}/proxy/gfg/${encodeURIComponent(cleanHandle)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.error && String(data.error).toLowerCase().includes('not found')) {
        throw new Error(`GeeksforGeeks user "${cleanHandle}" not found.`);
      }
      if (data?.info) userData = data;
    } else if (res.status === 404) {
      throw new Error(`GeeksforGeeks user "${cleanHandle}" not found.`);
    } else if (res.status === 503) {
      throw new Error(`GFG profile timed out. Try again shortly.`);
    }
  } catch (e: any) {
    if (e.message?.includes('not found') || e.message?.includes('timed out')) throw e;
    console.warn('[GFG] Backend proxy failed:', e.message);
  }

  const info = userData?.info || {};
  const solvedStats = userData?.solvedStats || {};

  const school = Number(solvedStats.school?.count) || 0;
  const basic = Number(solvedStats.basic?.count) || 0;
  const easy = Number(solvedStats.easy?.count) || 0;
  const medium = Number(solvedStats.medium?.count) || 0;
  const hard = Number(solvedStats.hard?.count) || 0;
  const totalSolved = Number(info.totalProblemsSolved) || (school + basic + easy + medium + hard);
  const codingScore = Number(info.codingScore) || 0;
  const streak = Number(info.streak) || 0;
  const instituteRank = info.instituteRank ?? 'N/A';
  // Backend returns monthlyScore; old 3rd-party API used monthlyCodingScore — handle both
  const monthlyScore = Number(info.monthlyScore) || Number(info.monthlyCodingScore) || 0;

  const topicList = [
    { label: 'School', count: school },
    { label: 'Basic', count: basic },
    { label: 'Easy', count: easy },
    { label: 'Medium', count: medium },
    { label: 'Hard', count: hard },
  ].filter((t) => t.count > 0);

  return {
    platform: 'geeksforgeeks',
    handle: cleanHandle,
    profileUrl: `https://auth.geeksforgeeks.org/user/${cleanHandle}`,
    lastRefreshedAt: new Date().toISOString(),
    syncStatus: 'synced',
    kpis: [
      { label: 'Total Problems Solved', value: totalSolved },
      { label: 'Coding Score', value: codingScore },
      { label: 'User name', value: cleanHandle, isLink: true },
    ],
    breakdown: [
      { label: 'School', solved: school, total: Math.max(school + 10, 50), color: '#86efac' },
      { label: 'Basic', solved: basic, total: Math.max(basic + 10, 100), color: '#4ade80' },
      { label: 'Easy', solved: easy, total: Math.max(easy + 10, 200), color: '#22c55e' },
      { label: 'Medium', solved: medium, total: Math.max(medium + 10, 150), color: '#16a34a' },
      { label: 'Hard', solved: hard, total: Math.max(hard + 10, 80), color: '#15803d' },
    ],
    awards: [
      { title: 'GFG Coder', icon: 'ðŸŒ¿' },
      ...(streak > 0 ? [{ title: `${streak}-Day Streak`, icon: 'ðŸ”¥' }] : []),
      ...(typeof instituteRank === 'number' && instituteRank <= 100
        ? [{ title: `Institute Rank #${instituteRank}`, icon: 'ðŸ†' }]
        : []),
      ...(monthlyScore > 0 ? [{ title: `Monthly Score: ${monthlyScore}`, icon: 'ðŸ“…' }] : []),
    ],
    topicAnalysis: topicList.length > 0 ? topicList : [{ label: 'Practice', count: 0 }],
    activity: [],
    heatmap: {},
  };
}

/**
 * Fetches CodeChef profile by scraping the user page directly.
 * Parses the Drupal.settings JSON embedded in every CodeChef profile page
 * to extract the full contest rating history, current rating, and highest rating.
 * Stars are inferred from CodeChef's official rating tier thresholds.
 * Throws if user not found.
 */
export async function fetchLiveCodeChef(handle: string): Promise<PlatformStatsSnapshot> {
  const cleanHandle = handle.replace(/^@/, '').trim();

  // CodeChef.com has no CORS headers â€” browsers cannot fetch it directly.
  // Route through corsproxy.io which adds the required CORS headers.
  // Note: User-Agent is a forbidden browser header and cannot be set manually.
  const CC_DIRECT = `https://www.codechef.com/users/${encodeURIComponent(cleanHandle)}`;
  const CC_URL = `https://corsproxy.io/?${encodeURIComponent(CC_DIRECT)}`;

  let html = '';
  try {
    const res = await fetch(CC_URL);
    if (res.status === 404) {
      throw new Error(`CodeChef user "${cleanHandle}" not found.`);
    }
    if (!res.ok) {
      throw new Error(`CodeChef page returned HTTP ${res.status}`);
    }
    html = await res.text();
  } catch (e: any) {
    if (e.message?.includes('not found')) throw e;
    console.warn('CodeChef fetch failed:', e);
  }

  // Extract contest rating history from Drupal.settings embedded JSON
  const ratingHistory: { date: string; rating: number; contestName?: string }[] = [];
  if (html) {
    try {
      const drupalMatch = html.match(/jQuery\.extend\(Drupal\.settings,\s*({.+?})\);/s);
      if (drupalMatch) {
        const settings = JSON.parse(drupalMatch[1]);
        const allEntries: any[] = settings?.date_versus_rating?.all || [];
        allEntries.forEach((entry: any) => {
          const dateStr = entry.end_date
            ? String(entry.end_date).slice(0, 10)
            : `${entry.getyear}-${String(entry.getmonth).padStart(2, '0')}-${String(entry.getday).padStart(2, '0')}`;
          ratingHistory.push({
            date: dateStr,
            rating: Number(entry.rating) || 0,
            contestName: entry.name || undefined,
          });
        });
      }
    } catch (e) {
      console.warn('CodeChef Drupal settings parse failed:', e);
    }
  }

  // Derive current and highest rating from history
  const currentRating = ratingHistory.length > 0
    ? ratingHistory[ratingHistory.length - 1].rating
    : 0;
  // Use reduce instead of Math.max(...array) to avoid stack overflow on large arrays
  const highestRating = ratingHistory.length > 0
    ? ratingHistory.reduce((max, r) => (r.rating > max ? r.rating : max), 0)
    : 0;

  // Stars follow CodeChef's official rating tier thresholds
  const getStars = (rating: number) => {
    if (rating >= 2500) return '7â˜…';
    if (rating >= 2200) return '6â˜…';
    if (rating >= 2000) return '5â˜…';
    if (rating >= 1800) return '4â˜…';
    if (rating >= 1600) return '3â˜…';
    if (rating >= 1400) return '2â˜…';
    if (rating >= 1) return '1â˜…';
    return '0â˜…';
  };

  // Try to read stars directly from the HTML profile section
  const starsHtmlMatch = html.match(/>(\d)(?:&#9733;|â˜…)/);
  const stars = starsHtmlMatch ? `${starsHtmlMatch[1]}â˜…` : getStars(currentRating);

  return {
    platform: 'codechef',
    handle: cleanHandle,
    profileUrl: `https://www.codechef.com/users/${cleanHandle}`,
    lastRefreshedAt: new Date().toISOString(),
    syncStatus: 'synced',
    kpis: [
      { label: 'Current Rating', value: currentRating || 'Unrated' },
      { label: 'Highest Rating', value: highestRating || 'Unrated' },
      { label: 'User name', value: cleanHandle, isLink: true },
    ],
    ratingHistory,
    awards: [
      { title: `${stars} CodeChef`, icon: 'ðŸ´' },
      ...(currentRating >= 1400 ? [{ title: '2â˜… Achiever', icon: 'â­' }] : []),
      ...(currentRating >= 1600 ? [{ title: '3â˜… Expert', icon: 'ðŸ†' }] : []),
      ...(currentRating >= 1800 ? [{ title: '4â˜… Master', icon: 'ðŸ’Ž' }] : []),
    ],
    topicAnalysis: [
      { label: 'Current Rating', count: currentRating },
      { label: 'Highest Rating', count: highestRating },
    ].filter((t) => t.count > 0),
    activity: [],
    heatmap: {},
  };
}

/**
 * Fetches HackerRank profile and badges via public REST endpoints.
 * Returns total stars, score, and badge list.
 * Gracefully degrades if CORS or API limits are hit.
 */
export async function fetchLiveHackerRank(handle: string): Promise<PlatformStatsSnapshot> {
  const cleanHandle = handle.replace(/^@/, '').trim();

  const HR_PROFILE = `https://www.hackerrank.com/rest/hackers/${encodeURIComponent(cleanHandle)}/profile`;
  const HR_BADGES = `https://www.hackerrank.com/rest/hackers/${encodeURIComponent(cleanHandle)}/badges`;

  let profileData: any = null;
  let badges: any[] = [];

  try {
    const [profileRes, badgesRes] = await Promise.allSettled([
      fetch(HR_PROFILE, { headers: { Accept: 'application/json' } }),
      fetch(HR_BADGES, { headers: { Accept: 'application/json' } }),
    ]);

    if (profileRes.status === 'fulfilled') {
      // Do NOT throw on 404 â€” HackerRank's CORS block also returns 404,
      // so we cannot distinguish "user not found" from "CORS blocked".
      // Gracefully degrade to 0 data instead.
      if (profileRes.value.ok) {
        const data = await profileRes.value.json();
        profileData = data?.model || null;
      }
    }

    if (badgesRes.status === 'fulfilled' && badgesRes.value.ok) {
      const data = await badgesRes.value.json();
      badges = data?.models || [];
    }
  } catch (e: any) {
    if (e.message?.includes('not found')) throw e;
    console.warn('HackerRank API failed (likely CORS):', e);
  }

  const totalStars = badges.reduce((acc: number, b: any) => acc + (Number(b.stars) || 0), 0);
  const score = Number(profileData?.score) || 0;

  const topicAnalysis = badges
    .filter((b: any) => b.badge_name || b.name)
    .map((b: any) => ({
      label: b.badge_name || b.name || 'Badge',
      count: Number(b.stars) || 1,
    }));

  return {
    platform: 'hackerrank',
    handle: cleanHandle,
    profileUrl: `https://www.hackerrank.com/profile/${cleanHandle}`,
    lastRefreshedAt: new Date().toISOString(),
    syncStatus: 'synced',
    kpis: [
      { label: 'Total Stars', value: totalStars },
      { label: 'Score', value: score },
      { label: 'User name', value: cleanHandle, isLink: true },
    ],
    breakdown: [],
    awards: [
      { title: 'HackerRank Connected', icon: 'ðŸ†' },
      ...badges.slice(0, 4).map((b: any) => ({
        title: b.badge_name || b.name || 'Badge',
        icon: 'â­',
      })),
    ],
    topicAnalysis: topicAnalysis.length > 0 ? topicAnalysis : [{ label: 'Practice', count: 0 }],
    activity: [],
    heatmap: {},
  };
}

/**
 * Universal live fetcher â€” routes to the correct platform-specific fetcher.
 * All platforms now have real API implementations.
 */
export async function fetchLivePlatformSnapshot(
  platformId: PlatformId,
  handle: string,
  forceRefresh = false
): Promise<PlatformStatsSnapshot> {
  if (platformId === 'leetcode') return await fetchLiveLeetCode(handle, forceRefresh);
  if (platformId === 'github') return await fetchLiveGitHub(handle);
  if (platformId === 'codeforces') return await fetchLiveCodeforces(handle);
  if (platformId === 'geeksforgeeks') return await fetchLiveGeeksforGeeks(handle);
  if (platformId === 'codechef') return await fetchLiveCodeChef(handle);
  if (platformId === 'hackerrank') return await fetchLiveHackerRank(handle);

  // Final safety fallback for any unrecognised platform IDs
  const cleanHandle = handle.replace(/^@/, '').trim();
  return {
    platform: platformId,
    handle: cleanHandle,
    profileUrl: '',
    lastRefreshedAt: new Date().toISOString(),
    syncStatus: 'synced',
    kpis: [
      { label: 'Total Solved', value: 0 },
      { label: 'Platform Rating', value: 'N/A' },
      { label: 'User name', value: cleanHandle, isLink: true },
    ],
    breakdown: [],
    awards: [{ title: `${platformId} Connected`, icon: 'ðŸ†' }],
    topicAnalysis: [{ label: 'General Practice', count: 0 }],
    activity: [],
    heatmap: {},
  };
}

