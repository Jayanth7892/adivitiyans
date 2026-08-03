import React, { useState } from 'react';
import {
  Trophy, Code2, Github, Search, TrendingUp, Users,
  Award, ExternalLink, BarChart2, Star, GraduationCap,
} from 'lucide-react';
import { StatCard } from '../../components/common/StatCard';

const DEPARTMENTS = ['CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Data Science', 'AI & ML', 'Cyber Security', 'MBA', 'MCA'];
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

// Program-wide leaderboard data incorporating both CGPA and Coding Stats
const MOCK_LEETCODE_LEADERBOARD = [
  { rank: 1, name: 'Jayanth Kumar', regNo: '23091A3251', dept: 'CSE', year: '3rd Year', cgpa: 9.45, handle: 'jayanth_k', totalSolved: 412, easy: 180, medium: 198, hard: 34, contestRating: 1845, streak: 45 },
  { rank: 2, name: 'Ananya Sharma', regNo: '23091A3252', dept: 'CSE', year: '3rd Year', cgpa: 9.30, handle: 'ananya_s', totalSolved: 378, easy: 155, medium: 190, hard: 33, contestRating: 1720, streak: 32 },
  { rank: 3, name: 'Vikram Reddy', regNo: '23091A3253', dept: 'ECE', year: '4th Year', cgpa: 9.10, handle: 'vikramr', totalSolved: 340, easy: 150, medium: 170, hard: 20, contestRating: 1650, streak: 28 },
  { rank: 4, name: 'Sneha Patel', regNo: '23091A3254', dept: 'CSE', year: '2nd Year', cgpa: 8.90, handle: 'sneha_p', totalSolved: 295, easy: 130, medium: 150, hard: 15, contestRating: 1580, streak: 20 },
  { rank: 5, name: 'Rahul Verma', regNo: '23091A3255', dept: 'EEE', year: '4th Year', cgpa: 8.70, handle: 'rahulv', totalSolved: 260, easy: 120, medium: 130, hard: 10, contestRating: 1450, streak: 15 },
  { rank: 6, name: 'Priya Nair', regNo: '23091A3256', dept: 'IT', year: '3rd Year', cgpa: 8.60, handle: 'priya_n', totalSolved: 215, easy: 100, medium: 105, hard: 10, contestRating: 1380, streak: 12 },
  { rank: 7, name: 'Arjun Singh', regNo: '23091A3257', dept: 'CSE', year: '2nd Year', cgpa: 8.45, handle: 'arjun_s', totalSolved: 190, easy: 90, medium: 95, hard: 5, contestRating: 1290, streak: 10 },
  { rank: 8, name: 'Meena Rao', regNo: '23091A3258', dept: 'Data Science', year: '3rd Year', cgpa: 8.20, handle: 'meena_r', totalSolved: 155, easy: 80, medium: 70, hard: 5, contestRating: 1200, streak: 8 },
];

const MOCK_GITHUB_LEADERBOARD = [
  { rank: 1, name: 'Jayanth Kumar', regNo: '23091A3251', dept: 'CSE', year: '3rd Year', cgpa: 9.45, handle: 'jayanth-kumar', repos: 42, stars: 128, topLang: 'TypeScript', followers: 87 },
  { rank: 2, name: 'Vikram Reddy', regNo: '23091A3253', dept: 'ECE', year: '4th Year', cgpa: 9.10, handle: 'vikramr', repos: 35, stars: 94, topLang: 'Python', followers: 65 },
  { rank: 3, name: 'Ananya Sharma', regNo: '23091A3252', dept: 'CSE', year: '3rd Year', cgpa: 9.30, handle: 'ananya-sharma', repos: 28, stars: 72, topLang: 'JavaScript', followers: 52 },
  { rank: 4, name: 'Arjun Singh', regNo: '23091A3257', dept: 'CSE', year: '2nd Year', cgpa: 8.45, handle: 'arjun-singh', repos: 22, stars: 48, topLang: 'C++', followers: 34 },
  { rank: 5, name: 'Meena Rao', regNo: '23091A3258', dept: 'Data Science', year: '3rd Year', cgpa: 8.20, handle: 'meena-rao', repos: 18, stars: 35, topLang: 'Python', followers: 28 },
];

const MOCK_CGPA_LEADERBOARD = [
  { rank: 1, name: 'Jayanth Kumar', regNo: '23091A3251', dept: 'CSE', year: '3rd Year', cgpa: 9.45, standing: 'First Class with Distinction', leetcodeSolved: 412, githubRepos: 42 },
  { rank: 2, name: 'Ananya Sharma', regNo: '23091A3252', dept: 'CSE', year: '3rd Year', cgpa: 9.30, standing: 'First Class with Distinction', leetcodeSolved: 378, githubRepos: 28 },
  { rank: 3, name: 'Vikram Reddy', regNo: '23091A3253', dept: 'ECE', year: '4th Year', cgpa: 9.10, standing: 'First Class with Distinction', leetcodeSolved: 340, githubRepos: 35 },
  { rank: 4, name: 'Sneha Patel', regNo: '23091A3254', dept: 'CSE', year: '2nd Year', cgpa: 8.90, standing: 'First Class', leetcodeSolved: 295, githubRepos: 15 },
  { rank: 5, name: 'Rahul Verma', regNo: '23091A3255', dept: 'EEE', year: '4th Year', cgpa: 8.70, standing: 'First Class', leetcodeSolved: 260, githubRepos: 12 },
  { rank: 6, name: 'Priya Nair', regNo: '23091A3256', dept: 'IT', year: '3rd Year', cgpa: 8.60, standing: 'First Class', leetcodeSolved: 215, githubRepos: 10 },
  { rank: 7, name: 'Arjun Singh', regNo: '23091A3257', dept: 'CSE', year: '2nd Year', cgpa: 8.45, standing: 'First Class', leetcodeSolved: 190, githubRepos: 22 },
  { rank: 8, name: 'Meena Rao', regNo: '23091A3258', dept: 'Data Science', year: '3rd Year', cgpa: 8.20, standing: 'First Class', leetcodeSolved: 155, githubRepos: 18 },
];

function DifficultyPill({ count, color }: { count: number; color: string }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded-md text-[11px] font-bold"
      style={{ backgroundColor: `${color}22`, color }}>
      {count}
    </span>
  );
}

export const CodingAnalyticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'leetcode' | 'github' | 'cgpa'>('leetcode');
  const [deptFilter, setDeptFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [search, setSearch] = useState('');

  const lcFiltered = MOCK_LEETCODE_LEADERBOARD.filter((s) => {
    const q = search.toLowerCase();
    return (
      (!q || s.name.toLowerCase().includes(q) || s.handle.toLowerCase().includes(q) || s.regNo.toLowerCase().includes(q)) &&
      (!deptFilter || s.dept === deptFilter) &&
      (!yearFilter || s.year === yearFilter)
    );
  });

  const ghFiltered = MOCK_GITHUB_LEADERBOARD.filter((s) => {
    const q = search.toLowerCase();
    return (
      (!q || s.name.toLowerCase().includes(q) || s.handle.toLowerCase().includes(q) || s.regNo.toLowerCase().includes(q)) &&
      (!deptFilter || s.dept === deptFilter) &&
      (!yearFilter || s.year === yearFilter)
    );
  });

  const cgpaFiltered = MOCK_CGPA_LEADERBOARD.filter((s) => {
    const q = search.toLowerCase();
    return (
      (!q || s.name.toLowerCase().includes(q) || s.regNo.toLowerCase().includes(q)) &&
      (!deptFilter || s.dept === deptFilter) &&
      (!yearFilter || s.year === yearFilter)
    );
  });

  const totalSolvedAvg = Math.round(MOCK_LEETCODE_LEADERBOARD.reduce((a, s) => a + s.totalSolved, 0) / MOCK_LEETCODE_LEADERBOARD.length);
  const avgCgpa = (MOCK_CGPA_LEADERBOARD.reduce((a, s) => a + s.cgpa, 0) / MOCK_CGPA_LEADERBOARD.length).toFixed(2);
  const topRating = Math.max(...MOCK_LEETCODE_LEADERBOARD.map((s) => s.contestRating));

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-surface border border-borderLine rounded-2xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-soft text-brand-primary text-xs font-semibold mb-2">
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Program-Wide Academic & Coding Analytics</span>
          </div>
          <h1 className="text-2xl font-extrabold text-textPrimary">Program Leaderboard</h1>
          <p className="text-xs text-textSecondary mt-1">
            Live student rankings by CGPA, LeetCode competitive metrics, and GitHub open-source activity
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<GraduationCap className="w-5 h-5" />} iconBgColor="bg-brand-soft text-brand-primary"
          label="Average CGPA" value={`${avgCgpa} / 10`} subtext="Institution wide" />
        <StatCard icon={<Trophy className="w-5 h-5" />} iconBgColor="bg-amber-50 text-amber-600"
          label="Top Contest Rating" value={topRating} subtext="Highest in batch" />
        <StatCard icon={<Code2 className="w-5 h-5" />} iconBgColor="bg-green-50 text-green-600"
          label="Avg Problems Solved" value={totalSolvedAvg} subtext="Per connected student" />
        <StatCard icon={<Users className="w-5 h-5" />} iconBgColor="bg-indigo-50 text-indigo-600"
          label="Top Distinction" value="3 Students" subtext="CGPA > 9.00" />
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-borderLine gap-6 text-sm font-semibold">
        <button onClick={() => setActiveTab('leetcode')}
          className={`pb-3 flex items-center gap-2 transition-colors ${activeTab === 'leetcode' ? 'border-b-2 border-[#FFA116] text-[#FFA116]' : 'text-textSecondary hover:text-textPrimary'}`}>
          <span>⚡</span> LeetCode Rankings
        </button>
        <button onClick={() => setActiveTab('github')}
          className={`pb-3 flex items-center gap-2 transition-colors ${activeTab === 'github' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-textSecondary hover:text-textPrimary'}`}>
          <Github className="w-4 h-4" /> GitHub Rankings
        </button>
        <button onClick={() => setActiveTab('cgpa')}
          className={`pb-3 flex items-center gap-2 transition-colors ${activeTab === 'cgpa' ? 'border-b-2 border-[#5B4FE9] text-[#5B4FE9]' : 'text-textSecondary hover:text-textPrimary'}`}>
          <GraduationCap className="w-4 h-4" /> Academic CGPA Rankings
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-borderLine bg-surface text-xs w-56">
          <Search className="w-4 h-4 text-textSecondary shrink-0" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student or handle..."
            className="w-full bg-transparent focus:outline-none text-textPrimary" />
        </div>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-borderLine bg-surface text-textPrimary font-medium">
          <option value="">All Departments</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-borderLine bg-surface text-textPrimary font-medium">
          <option value="">All Years</option>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* ── LeetCode Table ── */}
      {activeTab === 'leetcode' && (
        <div className="bg-surface border border-borderLine rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-borderLine flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#FFA116' }}>
              <span className="text-white font-black text-xs">LC</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-textPrimary">LeetCode & CGPA Rankings</h3>
              <p className="text-xs text-textSecondary">Ranked by total problems solved alongside academic CGPA</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background text-[11px] font-semibold text-textSecondary uppercase tracking-wider border-b border-borderLine">
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Handle</th>
                  <th className="py-3 px-4">Dept / Year</th>
                  <th className="py-3 px-4">CGPA 🎓</th>
                  <th className="py-3 px-4">🟢 Easy</th>
                  <th className="py-3 px-4">🟡 Medium</th>
                  <th className="py-3 px-4">🔴 Hard</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Contest ⚡</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderLine text-sm">
                {lcFiltered.length === 0 && (
                  <tr><td colSpan={10} className="py-10 text-center text-textSecondary text-xs">No students match the current filter.</td></tr>
                )}
                {lcFiltered.map((s) => (
                  <tr key={s.rank} className="hover:bg-background/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className={`font-extrabold text-sm ${s.rank === 1 ? 'text-amber-500' : s.rank === 2 ? 'text-gray-400' : s.rank === 3 ? 'text-amber-700' : 'text-textSecondary'}`}>
                        {s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : `#${s.rank}`}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-textPrimary text-xs">{s.name}</p>
                      <p className="text-[10px] text-textSecondary">{s.regNo}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <a href={`https://leetcode.com/${s.handle}`} target="_blank" rel="noreferrer"
                        className="text-xs font-semibold text-[#FFA116] hover:underline flex items-center gap-0.5">
                        @{s.handle} <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <p className="font-medium text-textPrimary">{s.dept}</p>
                      <p className="text-textSecondary">{s.year}</p>
                    </td>
                    <td className="py-3.5 px-4 font-black text-green-600 text-xs">{s.cgpa}</td>
                    <td className="py-3.5 px-4"><DifficultyPill count={s.easy} color="#00b8a3" /></td>
                    <td className="py-3.5 px-4"><DifficultyPill count={s.medium} color="#ffc01e" /></td>
                    <td className="py-3.5 px-4"><DifficultyPill count={s.hard} color="#ff375f" /></td>
                    <td className="py-3.5 px-4 font-extrabold text-textPrimary">{s.totalSolved}</td>
                    <td className="py-3.5 px-4 font-bold text-xs" style={{ color: '#FFA116' }}>{s.contestRating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── GitHub Table ── */}
      {activeTab === 'github' && (
        <div className="bg-surface border border-borderLine rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-borderLine flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
              <Github className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-textPrimary">GitHub Open Source & CGPA Rankings</h3>
              <p className="text-xs text-textSecondary">Ranked by total GitHub stars earned across public repositories</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background text-[11px] font-semibold text-textSecondary uppercase tracking-wider border-b border-borderLine">
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">GitHub Handle</th>
                  <th className="py-3 px-4">Dept / Year</th>
                  <th className="py-3 px-4">CGPA 🎓</th>
                  <th className="py-3 px-4">Repos</th>
                  <th className="py-3 px-4">⭐ Stars</th>
                  <th className="py-3 px-4">Top Language</th>
                  <th className="py-3 px-4">Followers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderLine text-sm">
                {ghFiltered.length === 0 && (
                  <tr><td colSpan={9} className="py-10 text-center text-textSecondary text-xs">No students match the current filter.</td></tr>
                )}
                {ghFiltered.map((s) => (
                  <tr key={s.rank} className="hover:bg-background/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className={`font-extrabold text-sm ${s.rank === 1 ? 'text-amber-500' : s.rank === 2 ? 'text-gray-400' : s.rank === 3 ? 'text-amber-700' : 'text-textSecondary'}`}>
                        {s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : `#${s.rank}`}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-textPrimary text-xs">{s.name}</p>
                      <p className="text-[10px] text-textSecondary">{s.regNo}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <a href={`https://github.com/${s.handle}`} target="_blank" rel="noreferrer"
                        className="text-xs font-semibold text-gray-800 hover:underline flex items-center gap-0.5">
                        @{s.handle} <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <p className="font-medium text-textPrimary">{s.dept}</p>
                      <p className="text-textSecondary">{s.year}</p>
                    </td>
                    <td className="py-3.5 px-4 font-black text-green-600 text-xs">{s.cgpa}</td>
                    <td className="py-3.5 px-4 font-semibold text-textPrimary text-xs">{s.repos}</td>
                    <td className="py-3.5 px-4 font-extrabold text-amber-500 text-xs">{s.stars} ⭐</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700">{s.topLang}</span>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-textPrimary">{s.followers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CGPA Academic Table ── */}
      {activeTab === 'cgpa' && (
        <div className="bg-surface border border-borderLine rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-borderLine flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#5B4FE9] flex items-center justify-center text-white font-bold">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-textPrimary">Academic CGPA Rankings</h3>
              <p className="text-xs text-textSecondary">Ranked by Cumulative Grade Point Average (CGPA) with coding profile metrics</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background text-[11px] font-semibold text-textSecondary uppercase tracking-wider border-b border-borderLine">
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Reg No</th>
                  <th className="py-3 px-4">Dept / Year</th>
                  <th className="py-3 px-4">Overall CGPA</th>
                  <th className="py-3 px-4">Academic Standing</th>
                  <th className="py-3 px-4">LeetCode Solved</th>
                  <th className="py-3 px-4">GitHub Repos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderLine text-sm">
                {cgpaFiltered.length === 0 && (
                  <tr><td colSpan={8} className="py-10 text-center text-textSecondary text-xs">No students match the current filter.</td></tr>
                )}
                {cgpaFiltered.map((s) => (
                  <tr key={s.rank} className="hover:bg-background/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className={`font-extrabold text-sm ${s.rank === 1 ? 'text-amber-500' : s.rank === 2 ? 'text-gray-400' : s.rank === 3 ? 'text-amber-700' : 'text-textSecondary'}`}>
                        {s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : `#${s.rank}`}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-textPrimary text-xs">{s.name}</td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-textSecondary">{s.regNo}</td>
                    <td className="py-3.5 px-4 text-xs">
                      <p className="font-medium text-textPrimary">{s.dept}</p>
                      <p className="text-textSecondary">{s.year}</p>
                    </td>
                    <td className="py-3.5 px-4 font-black text-brand-primary text-sm">{s.cgpa} / 10.0</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-soft text-brand-primary">
                        {s.standing}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-textPrimary text-xs">{s.leetcodeSolved} solved</td>
                    <td className="py-3.5 px-4 font-semibold text-textPrimary text-xs">{s.githubRepos} repos</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
