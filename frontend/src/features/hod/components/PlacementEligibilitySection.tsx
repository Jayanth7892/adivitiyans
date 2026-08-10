import React, { useState, useMemo } from 'react';
import { Target, Download, CheckCircle2, Filter, Award, Sparkles } from 'lucide-react';

interface StudentCandidate {
  rank: number;
  name: string;
  regNo: string;
  email: string;
  phone: string;
  year: string;
  section: string;
  cgpa: number;
  leetcode: number;
  github: number;
  standing: string;
}

interface PlacementEligibilityProps {
  students: any[];
}

export const PlacementEligibilitySection: React.FC<PlacementEligibilityProps> = ({ students }) => {
  const [minCgpa, setMinCgpa] = useState<number>(7.5);
  const [minLeetCode, setMinLeetCode] = useState<number>(200);
  const [minGitHub, setMinGitHub] = useState<number>(5);
  const [targetYear, setTargetYear] = useState<string>('All');
  const [preset, setPreset] = useState<string>('custom');

  const applyPreset = (presetName: string) => {
    setPreset(presetName);
    if (presetName === 'tier1') {
      setMinCgpa(8.5);
      setMinLeetCode(350);
      setMinGitHub(15);
    } else if (presetName === 'tier2') {
      setMinCgpa(7.5);
      setMinLeetCode(200);
      setMinGitHub(10);
    } else if (presetName === 'mass') {
      setMinCgpa(6.5);
      setMinLeetCode(100);
      setMinGitHub(5);
    }
  };

  const candidateDataset: StudentCandidate[] = useMemo(() => {
    return students.map((s, idx) => {
      const cgpa = (s as any).cgpa !== undefined && (s as any).cgpa !== null ? Number((s as any).cgpa) : 0;
      const lcHandle = (s as any).leetcode_handle || (s as any).leetcode;
      const isLcLinked = Boolean(lcHandle) && lcHandle !== 'Not Linked';
      const leetcode = isLcLinked ? Number((s as any).leetcode_solved || (s as any).leetcode || 0) : 0;
      const ghHandle = (s as any).github_handle || (s as any).github;
      const isGhLinked = Boolean(ghHandle) && ghHandle !== 'Not Linked';
      const github = isGhLinked ? Number((s as any).github_repos || (s as any).github || 0) : 0;

      return {
        rank: idx + 1,
        name: s.name,
        regNo: s.roll_number || s.regNo,
        email: s.email || `${(s.roll_number || s.regNo || '').toLowerCase()}@rgmcet.edu.in`,
        phone: s.phone || 'N/A',
        year: s.year || '3rd Year',
        section: s.section ? (s.section.startsWith('Sec ') ? s.section : `Sec ${s.section}`) : 'Sec A',
        cgpa,
        leetcode,
        github,
        standing: cgpa >= 9.0 ? 'Distinction' : cgpa >= 6.5 ? 'First Class' : 'Pass',
      };
    });
  }, [students]);

  const eligibleStudents = useMemo(() => {
    return candidateDataset.filter((s) => {
      const matchesCgpa = s.cgpa >= minCgpa;
      const matchesLc = s.leetcode >= minLeetCode;
      const matchesGh = s.github >= minGitHub;
      const matchesYear = targetYear === 'All' || s.year === targetYear;
      return matchesCgpa && matchesLc && matchesGh && matchesYear;
    });
  }, [candidateDataset, minCgpa, minLeetCode, minGitHub, targetYear]);

  const exportPlacementEligibleCSV = () => {
    const headers = ['Rank', 'Name', 'Reg Number', 'Email', 'Phone', 'Year', 'Section', 'CGPA', 'LeetCode Solved', 'GitHub Repos', 'Standing', 'Eligibility Status'];
    const rows = eligibleStudents.map((s, idx) => [
      idx + 1,
      `"${s.name}"`,
      s.regNo,
      s.email,
      s.phone,
      s.year,
      s.section,
      s.cgpa,
      s.leetcode,
      s.github,
      s.standing,
      '"ELIGIBLE FOR RECRUITMENT DRIVE"',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Placement_Eligible_Students_MinCGPA_${minCgpa}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalCount = candidateDataset.length || 1;
  const ratioPct = Math.round((eligibleStudents.length / totalCount) * 100);

  return (
    <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-borderLine pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-primary mb-0.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Placement & Training (T&P) Engine</span>
            </div>
            <h3 className="text-lg font-bold text-textPrimary">Automated Placement Eligibility Criteria Builder</h3>
          </div>
        </div>

        <button
          onClick={exportPlacementEligibleCSV}
          disabled={eligibleStudents.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-all shrink-0 self-start md:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Export Eligible Candidates CSV ({eligibleStudents.length})</span>
        </button>
      </div>

      {/* Preset Buttons */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider">Recruitment Drive Presets</label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => applyPreset('tier1')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              preset === 'tier1' ? 'bg-brand-primary text-white border-brand-primary' : 'bg-background text-textSecondary border-borderLine hover:text-textPrimary'
            }`}
          >
            🏆 Tier-1 Product Drive (CGPA ≥ 8.5, LC ≥ 350, GH ≥ 15)
          </button>
          <button
            onClick={() => applyPreset('tier2')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              preset === 'tier2' ? 'bg-brand-primary text-white border-brand-primary' : 'bg-background text-textSecondary border-borderLine hover:text-textPrimary'
            }`}
          >
            ⚡ High-Growth Core Drive (CGPA ≥ 7.5, LC ≥ 200, GH ≥ 10)
          </button>
          <button
            onClick={() => applyPreset('mass')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              preset === 'mass' ? 'bg-brand-primary text-white border-brand-primary' : 'bg-background text-textSecondary border-borderLine hover:text-textPrimary'
            }`}
          >
            🏢 IT Major Mass Drive (CGPA ≥ 6.5, LC ≥ 100, GH ≥ 5)
          </button>
        </div>
      </div>

      {/* Threshold Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-background/50 p-4 rounded-xl border border-borderLine">
        <div>
          <label className="block text-xs font-semibold text-textSecondary mb-1">Min CGPA Cutoff</label>
          <input
            type="number"
            step="0.1"
            min={0}
            max={10}
            value={minCgpa}
            onChange={(e) => {
              setMinCgpa(parseFloat(e.target.value) || 0);
              setPreset('custom');
            }}
            className="w-full px-3 py-2 text-xs font-bold text-brand-primary rounded-lg border border-borderLine bg-background"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-textSecondary mb-1">Min LeetCode Solved</label>
          <input
            type="number"
            step="10"
            min={0}
            value={minLeetCode}
            onChange={(e) => {
              setMinLeetCode(parseInt(e.target.value) || 0);
              setPreset('custom');
            }}
            className="w-full px-3 py-2 text-xs font-bold text-green-600 rounded-lg border border-borderLine bg-background"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-textSecondary mb-1">Min GitHub Repos</label>
          <input
            type="number"
            step="1"
            min={0}
            value={minGitHub}
            onChange={(e) => {
              setMinGitHub(parseInt(e.target.value) || 0);
              setPreset('custom');
            }}
            className="w-full px-3 py-2 text-xs font-bold text-purple-600 rounded-lg border border-borderLine bg-background"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-textSecondary mb-1">Target Academic Year</label>
          <select
            value={targetYear}
            onChange={(e) => setTargetYear(e.target.value)}
            className="w-full px-3 py-2 text-xs font-bold text-textPrimary rounded-lg border border-borderLine bg-background"
          >
            <option value="All">All Years</option>
            <option value="3rd Year">3rd Year</option>
            <option value="4th Year">4th Year (Graduating Batch)</option>
          </select>
        </div>
      </div>

      {/* Eligibility Status Banner */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-bold">{eligibleStudents.length} Students Qualified for Placement Drive</p>
            <p className="text-xs text-emerald-700">Satisfies: CGPA ≥ {minCgpa}, LeetCode ≥ {minLeetCode}, GitHub Repos ≥ {minGitHub}</p>
          </div>
        </div>
        <span className="text-lg font-black text-emerald-700 bg-white px-3 py-1 rounded-lg border border-emerald-300">
          {ratioPct}% Qualified
        </span>
      </div>

      {/* Eligible Candidates Table */}
      <div className="overflow-x-auto border border-borderLine rounded-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-background border-b border-borderLine text-textSecondary uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-3">Rank</th>
              <th className="py-2.5 px-3">Student Name</th>
              <th className="py-2.5 px-3">Reg Number</th>
              <th className="py-2.5 px-3">Year / Sec</th>
              <th className="py-2.5 px-3">CGPA</th>
              <th className="py-2.5 px-3">LeetCode</th>
              <th className="py-2.5 px-3">GitHub</th>
              <th className="py-2.5 px-3">Standing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borderLine">
            {eligibleStudents.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-textSecondary text-xs">
                  No students meet the specified placement criteria. Try lowering the CGPA or coding thresholds.
                </td>
              </tr>
            ) : (
              eligibleStudents.slice(0, 15).map((s) => (
                <tr key={s.regNo} className="hover:bg-background/50 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-textSecondary">#{s.rank}</td>
                  <td className="py-2.5 px-3 font-bold text-textPrimary">{s.name}</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-brand-primary">{s.regNo}</td>
                  <td className="py-2.5 px-3 text-textSecondary">{s.year} • {s.section}</td>
                  <td className="py-2.5 px-3 font-black text-brand-primary">{s.cgpa.toFixed(2)}</td>
                  <td className="py-2.5 px-3 font-bold text-green-600">{s.leetcode} Solved</td>
                  <td className="py-2.5 px-3 font-medium text-textPrimary">{s.github} Repos</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {s.standing}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {eligibleStudents.length > 15 && (
          <div className="p-2 text-center text-xs text-textSecondary bg-background border-t border-borderLine">
            + {eligibleStudents.length - 15} more candidates included in CSV export
          </div>
        )}
      </div>
    </div>
  );
};
