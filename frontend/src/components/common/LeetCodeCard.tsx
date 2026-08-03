import React, { useState } from 'react';
import { ExternalLink, Loader2, AlertCircle, RefreshCw, Code2, Trophy, Flame, Target } from 'lucide-react';

// LeetCode stats fetched from the free alfa-leetcode-api proxy
// Fallback: alfaarghya's open API at https://alfa-leetcode-api.onrender.com

const LC_API = 'https://alfa-leetcode-api.onrender.com';

export interface LeetCodeStats {
  username: string;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  totalQuestions: number;
  easyTotal: number;
  mediumTotal: number;
  hardTotal: number;
  ranking: number;
  acceptanceRate: number;
  contestRating: number;
  contributionPoints: number;
  reputation: number;
  submissionCalendar: Record<string, number>; // epoch -> count
}

async function fetchLeetCodeStats(username: string): Promise<LeetCodeStats> {
  const [profileRes, calendarRes] = await Promise.allSettled([
    fetch(`${LC_API}/userProfile/${encodeURIComponent(username)}`),
    fetch(`${LC_API}/${encodeURIComponent(username)}/calendar`),
  ]);

  let profile: any = {};
  let calendarData: Record<string, number> = {};

  if (profileRes.status === 'fulfilled' && profileRes.value.ok) {
    profile = await profileRes.value.json();
  } else {
    throw new Error('Could not fetch LeetCode profile. Check username and try again.');
  }

  if (calendarRes.status === 'fulfilled' && calendarRes.value.ok) {
    const calJson = await calendarRes.value.json();
    calendarData = calJson?.submissionCalendar
      ? typeof calJson.submissionCalendar === 'string'
        ? JSON.parse(calJson.submissionCalendar)
        : calJson.submissionCalendar
      : {};
  }

  return {
    username,
    totalSolved: profile.totalSolved ?? 0,
    easySolved: profile.easySolved ?? 0,
    mediumSolved: profile.mediumSolved ?? 0,
    hardSolved: profile.hardSolved ?? 0,
    totalQuestions: profile.totalQuestions ?? 3000,
    easyTotal: profile.totalEasy ?? 800,
    mediumTotal: profile.totalMedium ?? 1700,
    hardTotal: profile.totalHard ?? 500,
    ranking: profile.ranking ?? 0,
    acceptanceRate: profile.acceptanceRate ?? 0,
    contestRating: profile.contestRating ?? 0,
    contributionPoints: profile.contributionPoints ?? 0,
    reputation: profile.reputation ?? 0,
    submissionCalendar: calendarData,
  };
}

// Circular ring for difficulty breakdown
function DiffRing({ solved, total, color, label }: { solved: number; total: number; color: string; label: string }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(solved / total, 1) : 0;
  const offset = circ * (1 - pct);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="#E5E7EB" strokeWidth="7" />
          <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="7"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-black text-textPrimary leading-none">{solved}</span>
          <span className="text-[9px] text-textSecondary leading-none">/{total}</span>
        </div>
      </div>
      <span className="text-[11px] font-semibold" style={{ color }}>{label}</span>
    </div>
  );
}

// 52-week submission heatmap
function SubmissionHeatmap({ calendar }: { calendar: Record<string, number> }) {
  const now = Math.floor(Date.now() / 1000);
  const oneYear = 52 * 7 * 24 * 3600;
  const start = now - oneYear;

  // Build week grid: 52 cols x 7 rows
  const weeks: Array<Array<{ epoch: number; count: number }>> = [];
  let cur = start - ((new Date(start * 1000).getDay()) * 86400);

  for (let w = 0; w < 53; w++) {
    const week: Array<{ epoch: number; count: number }> = [];
    for (let d = 0; d < 7; d++) {
      const epoch = cur + (w * 7 + d) * 86400;
      const dayStr = String(epoch);
      week.push({ epoch, count: calendar[dayStr] || 0 });
    }
    weeks.push(week);
  }

  const max = Math.max(1, ...Object.values(calendar));

  const getColor = (count: number) => {
    if (count === 0) return '#F3F4F6';
    const pct = count / max;
    if (pct < 0.25) return '#C6F6D5';
    if (pct < 0.5) return '#68D391';
    if (pct < 0.75) return '#38A169';
    return '#276749';
  };

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="flex gap-[3px]" style={{ minWidth: 'max-content' }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day, di) => (
                <div
                  key={di}
                  title={`${new Date(day.epoch * 1000).toLocaleDateString()}: ${day.count} submissions`}
                  className="w-[10px] h-[10px] rounded-[2px] cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: getColor(day.count) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-textSecondary">
        <span>Less</span>
        {['#F3F4F6', '#C6F6D5', '#68D391', '#38A169', '#276749'].map((c) => (
          <div key={c} className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: c }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

interface LeetCodeCardProps {
  initialUsername?: string;
  onUsernameChange?: (username: string) => void;
}

export const LeetCodeCard: React.FC<LeetCodeCardProps> = ({ initialUsername = '', onUsernameChange }) => {
  const [username, setUsername] = useState(initialUsername);
  const [inputVal, setInputVal] = useState(initialUsername);
  const [stats, setStats] = useState<LeetCodeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    const u = inputVal.trim();
    if (!u) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchLeetCodeStats(u);
      setStats(data);
      setUsername(u);
      onUsernameChange?.(u);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch LeetCode data. The API may be temporarily unavailable.');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!username) return;
    setInputVal(username);
    setLoading(true);
    setError('');
    try {
      const data = await fetchLeetCodeStats(username);
      setStats(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-borderLine rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-borderLine bg-[#FFA116]/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#FFA116' }}>
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-textPrimary">LeetCode Analytics</h3>
            {stats && <p className="text-[11px] text-textSecondary">@{stats.username}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stats && (
            <button onClick={handleRefresh} disabled={loading}
              className="p-1.5 rounded-lg text-textSecondary hover:text-brand-primary hover:bg-brand-soft transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          {stats && (
            <a href={`https://leetcode.com/${stats.username}`} target="_blank" rel="noreferrer"
              className="p-1.5 rounded-lg text-textSecondary hover:text-brand-primary hover:bg-brand-soft transition-colors">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Username connect form */}
        <div className="flex gap-2">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            placeholder="Enter LeetCode username..."
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-[#FFA116]/40"
          />
          <button
            onClick={handleConnect}
            disabled={loading || !inputVal.trim()}
            className="px-4 py-2 text-sm font-bold rounded-xl text-white transition-all disabled:opacity-50"
            style={{ background: '#FFA116' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs">{error}</p>
          </div>
        )}

        {loading && !stats && (
          <div className="flex items-center justify-center py-8 gap-2 text-textSecondary">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Fetching LeetCode stats...</span>
          </div>
        )}

        {stats && (
          <>
            {/* Top Stats Row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-background border border-borderLine text-center">
                <p className="text-[10px] font-semibold text-textSecondary uppercase">Total Solved</p>
                <p className="text-2xl font-black text-textPrimary mt-0.5">{stats.totalSolved}</p>
              </div>
              <div className="p-3 rounded-xl bg-background border border-borderLine text-center">
                <p className="text-[10px] font-semibold text-textSecondary uppercase">Contest Rating</p>
                <p className="text-2xl font-black" style={{ color: '#FFA116' }}>{stats.contestRating || '—'}</p>
              </div>
              <div className="p-3 rounded-xl bg-background border border-borderLine text-center">
                <p className="text-[10px] font-semibold text-textSecondary uppercase">Global Rank</p>
                <p className="text-2xl font-black text-textPrimary">{stats.ranking ? `#${stats.ranking.toLocaleString()}` : '—'}</p>
              </div>
            </div>

            {/* Difficulty Rings */}
            <div className="p-4 rounded-xl bg-background border border-borderLine">
              <p className="text-xs font-bold text-textPrimary mb-4">Problem Difficulty Breakdown</p>
              <div className="flex items-center justify-around">
                <DiffRing solved={stats.easySolved} total={stats.easyTotal} color="#00b8a3" label="Easy" />
                <DiffRing solved={stats.mediumSolved} total={stats.mediumTotal} color="#ffc01e" label="Medium" />
                <DiffRing solved={stats.hardSolved} total={stats.hardTotal} color="#ff375f" label="Hard" />
                {/* Total ring */}
                <div className="flex flex-col items-center gap-1">
                  <div className="relative w-16 h-16">
                    <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
                      <circle cx="32" cy="32" r="26" fill="none" stroke="#E5E7EB" strokeWidth="7" />
                      <circle cx="32" cy="32" r="26" fill="none" stroke="#5B4FE9" strokeWidth="7"
                        strokeDasharray={2 * Math.PI * 26}
                        strokeDashoffset={2 * Math.PI * 26 * (1 - Math.min(stats.totalSolved / stats.totalQuestions, 1))}
                        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xs font-black text-textPrimary leading-none">{stats.totalSolved}</span>
                      <span className="text-[9px] text-textSecondary leading-none">/{stats.totalQuestions}</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-brand-primary">All</span>
                </div>
              </div>
              {/* Acceptance rate bar */}
              <div className="mt-4">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-textSecondary">Acceptance Rate</span>
                  <span className="font-bold text-textPrimary">{stats.acceptanceRate.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-borderLine rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all duration-700"
                    style={{ width: `${stats.acceptanceRate}%` }} />
                </div>
              </div>
            </div>

            {/* Heatmap */}
            {Object.keys(stats.submissionCalendar).length > 0 && (
              <div className="p-4 rounded-xl bg-background border border-borderLine">
                <p className="text-xs font-bold text-textPrimary mb-3">Submission Activity (Past Year)</p>
                <SubmissionHeatmap calendar={stats.submissionCalendar} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
