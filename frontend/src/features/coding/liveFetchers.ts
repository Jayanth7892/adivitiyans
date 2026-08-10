import { PlatformId, PlatformStatsSnapshot } from './platformData';

// ─── Real Live API Fetchers ───────────────────────────────────────────────────

/**
 * Fetches real LeetCode stats via public API endpoints.
 * Throws if the user does not exist.
 */
export async function fetchLiveLeetCode(handle: string): Promise<PlatformStatsSnapshot> {
  const cleanHandle = handle.replace(/^@/, '').trim();
  const VERCEL_API = `https://leetcode-api-faisalshohag.vercel.app/${encodeURIComponent(cleanHandle)}`;
  const ALFA_API = `https://alfa-leetcode-api.onrender.com/userProfile/${encodeURIComponent(cleanHandle)}`;

  let profileData: any = null;
  let calendarObj: Record<string, number> = {};
  let contestData: any = {};
  let topicAnalysis: { label: string; count: number }[] = [];
  let recentActivities: any[] = [];

  // Primary: Try Vercel fast LeetCode API endpoint
  try {
    const res = await fetch(VERCEL_API);
    if (res.ok) {
      const data = await res.json();

      // Detect non-existent user — API returns errors array or completely empty object
      if (data?.errors || data?.error) {
        throw new Error(`LeetCode user "${cleanHandle}" not found.`);
      }

      if (data && (data.totalSolved !== undefined || data.matchedUserStats)) {
        let easy = data.easySolved ?? 0;
        let medium = data.mediumSolved ?? 0;
        let hard = data.hardSolved ?? 0;
        let total = data.totalSolved ?? (easy + medium + hard);

        // Extract from matchedUserStats if top-level fields are missing
        if (!total && data.matchedUserStats?.acSubmissionNum) {
          const stats = data.matchedUserStats.acSubmissionNum;
          easy = stats.find((s: any) => s.difficulty === 'Easy')?.count || 0;
          medium = stats.find((s: any) => s.difficulty === 'Medium')?.count || 0;
          hard = stats.find((s: any) => s.difficulty === 'Hard')?.count || 0;
          total = stats.find((s: any) => s.difficulty === 'All')?.count || (easy + medium + hard);
        }

        profileData = {
          totalSolved: total,
          easySolved: easy,
          mediumSolved: medium,
          hardSolved: hard,
          ranking: data.ranking ?? 0,
          acceptanceRate: data.acceptanceRate ?? 0,
          totalEasy: data.totalEasy || 857,
          totalMedium: data.totalMedium || 1756,
          totalHard: data.totalHard || 799,
        };

        // Parse submission calendar (epoch seconds → YYYY-MM-DD)
        const rawCalField = data.submissionCalendar ?? data.submissionCalendarJSON;
        if (rawCalField) {
          try {
            const rawCal = typeof rawCalField === 'string'
              ? JSON.parse(rawCalField)
              : rawCalField;
            Object.entries(rawCal).forEach(([epochStr, count]) => {
              const dateStr = new Date(Number(epochStr) * 1000).toISOString().slice(0, 10);
              calendarObj[dateStr] = (calendarObj[dateStr] || 0) + Number(count);
            });
          } catch {
            // ignore calendar parse errors
          }
        }

        // Recent submissions — vercel API uses recentAcSubmissionNum or recentSubmissions
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
      }
    }
  } catch (e: any) {
    // Re-throw explicit "not found" errors
    if (e.message?.includes('not found')) throw e;
    console.warn('Primary Vercel LeetCode API fallback triggered:', e);
  }

  // Secondary Fallback: Alfa LeetCode API if primary yielded no data
  if (!profileData || (profileData.totalSolved === 0 && profileData.easySolved === 0 && profileData.mediumSolved === 0)) {
    try {
      const [profileRes, contestRes] = await Promise.allSettled([
        fetch(ALFA_API),
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
      } else if (profileRes.status === 'fulfilled' && profileRes.value.status === 404) {
        throw new Error(`LeetCode user "${cleanHandle}" not found.`);
      }

      if (contestRes.status === 'fulfilled' && contestRes.value.ok) {
        const contestJson = await contestRes.value.json();
        contestData = contestJson?.userContestRanking || {};
      }
    } catch (e: any) {
      if (e.message?.includes('not found')) throw e;
      console.warn('Alfa LeetCode API fallback failed:', e);
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
    topicAnalysis: topicAnalysis.length > 0 ? topicAnalysis : [
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
 * Fetches real GitHub user profile & repositories via GitHub REST API.
 * Throws if the user does not exist.
 */
export async function fetchLiveGitHub(handle: string): Promise<PlatformStatsSnapshot> {
  const cleanHandle = handle.replace(/^@/, '').trim();
  const headers = { 'Accept': 'application/vnd.github+json' };

  // Validate user first — throw immediately for non-existent handles
  const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanHandle)}`, { headers });
  if (userRes.status === 404) {
    throw new Error(`GitHub user "${cleanHandle}" not found.`);
  }
  if (!userRes.ok) {
    throw new Error(`GitHub API error: ${userRes.status}`);
  }
  const user = await userRes.json();
  if (!user?.login) {
    throw new Error(`GitHub user "${cleanHandle}" not found.`);
  }

  // Fetch repos and events in parallel
  const [reposRes, eventsRes] = await Promise.allSettled([
    fetch(`https://api.github.com/users/${encodeURIComponent(cleanHandle)}/repos?sort=updated&per_page=100`, { headers }),
    fetch(`https://api.github.com/users/${encodeURIComponent(cleanHandle)}/events/public?per_page=30`, { headers }),
  ]);

  const repos: any[] = reposRes.status === 'fulfilled' && reposRes.value.ok ? await reposRes.value.json() : [];
  const events: any[] = eventsRes.status === 'fulfilled' && eventsRes.value.ok ? await eventsRes.value.json() : [];

  const langCounts: Record<string, number> = {};
  let totalStars = 0;

  repos.forEach((r) => {
    totalStars += r.stargazers_count || 0;
    if (r.language) {
      langCounts[r.language] = (langCounts[r.language] || 0) + 1;
    }
  });

  const heatmap: Record<string, number> = {};
  const activities: any[] = [];

  events.forEach((ev) => {
    if (!ev.created_at) return;
    const dateStr = new Date(ev.created_at).toISOString().slice(0, 10);
    heatmap[dateStr] = (heatmap[dateStr] || 0) + 1;

    if (ev.type === 'PushEvent') {
      const repoName = ev.repo?.name || 'repository';
      const commitCount = ev.payload?.commits?.length || 1;
      activities.push({
        date: dateStr,
        title: `Pushed ${commitCount} commit(s) to ${repoName}`,
        status: `${commitCount} commits`,
        type: 'push',
      });
    } else if (ev.type === 'PullRequestEvent') {
      const action = ev.payload?.action || 'opened';
      const prTitle = ev.payload?.pull_request?.title || 'Pull Request';
      activities.push({
        date: dateStr,
        title: `PR ${action}: ${prTitle}`,
        status: action,
        type: 'pr',
      });
    }
  });

  const topicAnalysis = Object.entries(langCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return {
    platform: 'github',
    handle: cleanHandle,
    profileUrl: user.html_url || `https://github.com/${cleanHandle}`,
    lastRefreshedAt: new Date().toISOString(),
    syncStatus: 'synced',
    kpis: [
      { label: 'Public Repositories', value: user.public_repos ?? repos.length },
      { label: 'Total Stars Earned', value: totalStars },
      { label: 'User name', value: cleanHandle, isLink: true },
    ],
    awards: [
      { title: 'Public Contributor', icon: '🐙' },
      ...(user.followers > 10 ? [{ title: 'Popular Dev (10+ Followers)', icon: '⭐' }] : []),
      ...(user.public_repos >= 10 ? [{ title: 'Active Creator', icon: '🚀' }] : []),
    ],
    topicAnalysis: topicAnalysis.length > 0 ? topicAnalysis : [{ label: 'Repositories', count: repos.length }],
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
      { title: userInfo.rank ? `Title: ${userInfo.rank}` : 'Codeforces Competitor', icon: '🔵' },
      ...(userInfo.maxRating >= 1400 ? [{ title: 'Specialist Achievement', icon: '⭐' }] : []),
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
  const cleanHandle = handle.replace(/^@/, '').trim();

  // Primary unofficial GFG stats API
  const GFG_API = `https://geeks-for-geeks-stats-api.vercel.app/?raw=Y&userName=${encodeURIComponent(cleanHandle)}`;
  // Fallback unofficial GFG API
  const GFG_API_2 = `https://gfgapi.vercel.app/api/${encodeURIComponent(cleanHandle)}`;

  let userData: any = null;

  try {
    const res = await fetch(GFG_API);
    if (res.status === 404) {
      throw new Error(`GeeksforGeeks user "${cleanHandle}" not found.`);
    }
    // GFG returns 400 (not 404) for missing users — read body to check
    if (res.status === 400) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData?.error || '';
      // Only throw "not found" if the API explicitly says so
      if (msg.toLowerCase().includes('does not exist')) {
        throw new Error(`GeeksforGeeks user "${cleanHandle}" not found.`);
      }
      // Otherwise (e.g. 0 problems solved) fall through and show 0 data
    } else if (res.ok) {
      const data = await res.json();
      if (data?.error) {
        throw new Error(`GeeksforGeeks user "${cleanHandle}" not found.`);
      }
      if (data?.info) {
        userData = data;
      }
    }
  } catch (e: any) {
    if (e.message?.includes('not found')) throw e;
    console.warn('GFG primary API failed, trying fallback:', e);
  }

  if (!userData) {
    try {
      const res = await fetch(GFG_API_2);
      if (res.ok) {
        const data = await res.json();
        if (data && !data.error) {
          userData = data;
        }
      }
    } catch (e) {
      console.warn('GFG fallback API also failed:', e);
    }
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
  const monthlyScore = Number(info.monthlyCodingScore) || 0;

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
      { title: 'GFG Coder', icon: '🌿' },
      ...(streak > 0 ? [{ title: `${streak}-Day Streak`, icon: '🔥' }] : []),
      ...(typeof instituteRank === 'number' && instituteRank <= 100
        ? [{ title: `Institute Rank #${instituteRank}`, icon: '🏆' }]
        : []),
      ...(monthlyScore > 0 ? [{ title: `Monthly Score: ${monthlyScore}`, icon: '📅' }] : []),
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

  // CodeChef.com has no CORS headers — browsers cannot fetch it directly.
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
    if (rating >= 2500) return '7★';
    if (rating >= 2200) return '6★';
    if (rating >= 2000) return '5★';
    if (rating >= 1800) return '4★';
    if (rating >= 1600) return '3★';
    if (rating >= 1400) return '2★';
    if (rating >= 1) return '1★';
    return '0★';
  };

  // Try to read stars directly from the HTML profile section
  const starsHtmlMatch = html.match(/>(\d)(?:&#9733;|★)/);
  const stars = starsHtmlMatch ? `${starsHtmlMatch[1]}★` : getStars(currentRating);

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
      { title: `${stars} CodeChef`, icon: '🍴' },
      ...(currentRating >= 1400 ? [{ title: '2★ Achiever', icon: '⭐' }] : []),
      ...(currentRating >= 1600 ? [{ title: '3★ Expert', icon: '🏆' }] : []),
      ...(currentRating >= 1800 ? [{ title: '4★ Master', icon: '💎' }] : []),
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
      // Do NOT throw on 404 — HackerRank's CORS block also returns 404,
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
      { title: 'HackerRank Connected', icon: '🏆' },
      ...badges.slice(0, 4).map((b: any) => ({
        title: b.badge_name || b.name || 'Badge',
        icon: '⭐',
      })),
    ],
    topicAnalysis: topicAnalysis.length > 0 ? topicAnalysis : [{ label: 'Practice', count: 0 }],
    activity: [],
    heatmap: {},
  };
}

/**
 * Universal live fetcher — routes to the correct platform-specific fetcher.
 * All platforms now have real API implementations.
 */
export async function fetchLivePlatformSnapshot(
  platformId: PlatformId,
  handle: string
): Promise<PlatformStatsSnapshot> {
  if (platformId === 'leetcode') return await fetchLiveLeetCode(handle);
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
    awards: [{ title: `${platformId} Connected`, icon: '🏆' }],
    topicAnalysis: [{ label: 'General Practice', count: 0 }],
    activity: [],
    heatmap: {},
  };
}

