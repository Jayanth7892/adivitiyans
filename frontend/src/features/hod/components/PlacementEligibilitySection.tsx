import React, { useState, useMemo } from 'react';
import { Target, Download, CheckCircle2, Search, Sparkles, SlidersHorizontal, RefreshCw, GraduationCap, Trophy, Building, Users } from 'lucide-react';

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
  // Filter States
  const [minCgpa, setMinCgpa] = useState<number>(7.5);
  const [enableCgpa, setEnableCgpa] = useState<boolean>(true);

  const [minLeetCode, setMinLeetCode] = useState<number>(50);
  const [enableLeetCode, setEnableLeetCode] = useState<boolean>(false);

  const [minGitHub, setMinGitHub] = useState<number>(5);
  const [enableGitHub, setEnableGitHub] = useState<boolean>(false);

  const [targetYear, setTargetYear] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activePreset, setActivePreset] = useState<string>('custom');

  const applyPreset = (presetName: string) => {
    setActivePreset(presetName);
    if (presetName === 'all') {
      setMinCgpa(0);
      setEnableCgpa(true);
      setMinLeetCode(0);
      setEnableLeetCode(false);
      setMinGitHub(0);
      setEnableGitHub(false);
      setTargetYear('All');
    } else if (presetName === 'academic') {
      setMinCgpa(7.5);
      setEnableCgpa(true);
      setEnableLeetCode(false);
      setEnableGitHub(false);
    } else if (presetName === 'tier1') {
      setMinCgpa(8.0);
      setEnableCgpa(true);
      setMinLeetCode(200);
      setEnableLeetCode(true);
      setMinGitHub(5);
      setEnableGitHub(true);
    } else if (presetName === 'mass') {
      setMinCgpa(6.0);
      setEnableCgpa(true);
      setMinLeetCode(50);
      setEnableLeetCode(true);
      setEnableGitHub(false);
    }
  };

  // Robustly normalize candidate dataset
  const candidateDataset: StudentCandidate[] = useMemo(() => {
    if (!Array.isArray(students) || students.length === 0) return [];

    return students.map((s, idx) => {
      // 1. CGPA Extraction
      let cgpa = 0;
      if (typeof s.cgpa === 'number') cgpa = s.cgpa;
      else if (s.cgpa !== undefined && s.cgpa !== null && s.cgpa !== '') cgpa = Number(s.cgpa) || 0;
      else if (typeof s.avg_gpa === 'number') cgpa = s.avg_gpa;
      else if (typeof s.semester_gpa === 'number') cgpa = s.semester_gpa;

      // 2. LeetCode Solved Extraction
      let leetcode = 0;
      if (typeof s.leetcode === 'number') leetcode = s.leetcode;
      else if (typeof s.leetcode_solved === 'number') leetcode = s.leetcode_solved;
      else if (s.leetcode_solved) leetcode = Number(s.leetcode_solved) || 0;
      else if (s.leetcode) leetcode = Number(s.leetcode) || 0;

      // 3. GitHub Repos Extraction
      let github = 0;
      if (typeof s.github === 'number') github = s.github;
      else if (typeof s.github_repos === 'number') github = s.github_repos;
      else if (s.github_repos) github = Number(s.github_repos) || 0;
      else if (s.github) github = Number(s.github) || 0;

      const regNo = (s.roll_number || s.regNo || s.registrationNumber || `STUDENT_${idx + 1}`).toString().toUpperCase();
      const name = s.name || `Student ${regNo}`;
      const email = s.email || `${regNo.toLowerCase()}@rgmcet.edu.in`;
      const phone = s.phone || 'N/A';
      const year = s.year || '3rd Year';
      const section = s.section ? (s.section.startsWith('Sec ') ? s.section : `Sec ${s.section}`) : 'Sec A';
      const standing = s.standing || (
        cgpa >= 8.0 ? 'Distinction' :
        (cgpa >= 6.5 && cgpa < 8.0) ? 'First Class' :
        (cgpa >= 5.5 && cgpa < 6.5) ? 'Second Class' :
        (cgpa > 4.5 && cgpa < 5.5) ? 'Pass' :
        (cgpa > 0 ? 'Pass' : 'Enrolled')
      );

      return {
        rank: idx + 1,
        name,
        regNo,
        email,
        phone,
        year,
        section,
        cgpa,
        leetcode,
        github,
        standing,
      };
    });
  }, [students]);

  // Apply filters
  const eligibleStudents = useMemo(() => {
    return candidateDataset.filter((s) => {
      // 1. Search Query Filter
      const matchesSearch =
        !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.regNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Academic Year Filter
      const normalizedTarget = targetYear.toLowerCase().trim();
      const normalizedStudentYear = s.year.toLowerCase().trim();
      const matchesYear =
        normalizedTarget === 'all' ||
        normalizedTarget === 'all years' ||
        normalizedTarget === '' ||
        normalizedStudentYear.includes(normalizedTarget) ||
        normalizedTarget.includes(normalizedStudentYear);

      // 3. Cutoff Filters
      const matchesCgpa = !enableCgpa || s.cgpa >= minCgpa;
      const matchesLc = !enableLeetCode || s.leetcode >= minLeetCode;
      const matchesGh = !enableGitHub || s.github >= minGitHub;

      return matchesSearch && matchesYear && matchesCgpa && matchesLc && matchesGh;
    });
  }, [candidateDataset, searchQuery, targetYear, enableCgpa, minCgpa, enableLeetCode, minLeetCode, enableGitHub, minGitHub]);

  const exportPlacementEligibleCSV = () => {
    const headers = ['Rank', 'Name', 'Reg Number', 'Email', 'Phone', 'Year', 'Section', 'CGPA', 'LeetCode Solved', 'GitHub Repos', 'Standing', 'Eligibility Status'];
    const rows = eligibleStudents.map((s, idx) => [
      idx + 1,
      `"${(s.name || '').replace(/"/g, '""')}"`,
      s.regNo,
      s.email,
      s.phone,
      s.year,
      s.section,
      s.cgpa > 0 ? s.cgpa.toFixed(2) : 'N/A',
      s.leetcode,
      s.github,
      s.standing,
      '"ELIGIBLE FOR RECRUITMENT DRIVE"',
    ]);

    const csvString = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Placement_Eligible_Candidates_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-all shrink-0 self-start md:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Export Eligible Candidates CSV ({eligibleStudents.length})</span>
        </button>
      </div>

      {/* Recruitment Drive Presets */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider">Recruitment Drive Presets</label>
          <button
            onClick={() => applyPreset('all')}
            className="text-xs text-brand-primary font-semibold hover:underline flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Show All Students ({candidateDataset.length})
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => applyPreset('academic')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
              activePreset === 'academic' ? 'bg-brand-primary text-white border-brand-primary shadow-sm' : 'bg-background text-textPrimary border-borderLine hover:border-brand-primary'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Core Academic Drive (CGPA ≥ 7.5)</span>
          </button>
          <button
            onClick={() => applyPreset('tier1')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
              activePreset === 'tier1' ? 'bg-brand-primary text-white border-brand-primary shadow-sm' : 'bg-background text-textPrimary border-borderLine hover:border-brand-primary'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Tier-1 Product Drive (CGPA ≥ 8.0, LC ≥ 200, GH ≥ 5)</span>
          </button>
          <button
            onClick={() => applyPreset('mass')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
              activePreset === 'mass' ? 'bg-brand-primary text-white border-brand-primary shadow-sm' : 'bg-background text-textPrimary border-borderLine hover:border-brand-primary'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>IT Major Mass Drive (CGPA ≥ 6.0, LC ≥ 50)</span>
          </button>
          <button
            onClick={() => applyPreset('all')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
              activePreset === 'all' ? 'bg-brand-primary text-white border-brand-primary shadow-sm' : 'bg-background text-textPrimary border-borderLine hover:border-brand-primary'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>All Students (No Cutoffs)</span>
          </button>
        </div>
      </div>

      {/* Threshold Controls */}
      <div className="bg-background/80 border border-borderLine p-4 rounded-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-borderLine pb-2">
          <SlidersHorizontal className="w-4 h-4 text-brand-primary" />
          <span className="text-xs font-bold text-textPrimary uppercase tracking-wider">Custom Eligibility Criteria Filters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CGPA Filter */}
          <div className="space-y-1.5 p-3 rounded-lg border border-borderLine bg-surface">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-textPrimary flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={enableCgpa}
                  onChange={(e) => {
                    setEnableCgpa(e.target.checked);
                    setActivePreset('custom');
                  }}
                  className="rounded text-brand-primary focus:ring-brand-primary"
                />
                Min CGPA Cutoff
              </label>
              <span className={`text-[11px] font-bold ${enableCgpa ? 'text-brand-primary' : 'text-textSecondary'}`}>
                {enableCgpa ? `≥ ${minCgpa}` : 'Disabled'}
              </span>
            </div>
            <input
              type="number"
              step="0.1"
              min={0}
              max={10}
              disabled={!enableCgpa}
              value={minCgpa}
              onChange={(e) => {
                setMinCgpa(parseFloat(e.target.value) || 0);
                setActivePreset('custom');
              }}
              className="w-full px-3 py-1.5 text-xs font-bold text-brand-primary rounded-lg border border-borderLine bg-background disabled:opacity-40"
            />
          </div>

          {/* LeetCode Filter */}
          <div className="space-y-1.5 p-3 rounded-lg border border-borderLine bg-surface">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-textPrimary flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={enableLeetCode}
                  onChange={(e) => {
                    setEnableLeetCode(e.target.checked);
                    setActivePreset('custom');
                  }}
                  className="rounded text-brand-primary focus:ring-brand-primary"
                />
                Min LeetCode Solved
              </label>
              <span className={`text-[11px] font-bold ${enableLeetCode ? 'text-green-600' : 'text-textSecondary'}`}>
                {enableLeetCode ? `≥ ${minLeetCode}` : 'Disabled'}
              </span>
            </div>
            <input
              type="number"
              step="10"
              min={0}
              disabled={!enableLeetCode}
              value={minLeetCode}
              onChange={(e) => {
                setMinLeetCode(parseInt(e.target.value) || 0);
                setActivePreset('custom');
              }}
              className="w-full px-3 py-1.5 text-xs font-bold text-green-600 rounded-lg border border-borderLine bg-background disabled:opacity-40"
            />
          </div>

          {/* GitHub Repos Filter */}
          <div className="space-y-1.5 p-3 rounded-lg border border-borderLine bg-surface">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-textPrimary flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={enableGitHub}
                  onChange={(e) => {
                    setEnableGitHub(e.target.checked);
                    setActivePreset('custom');
                  }}
                  className="rounded text-brand-primary focus:ring-brand-primary"
                />
                Min GitHub Repos
              </label>
              <span className={`text-[11px] font-bold ${enableGitHub ? 'text-purple-600' : 'text-textSecondary'}`}>
                {enableGitHub ? `≥ ${minGitHub}` : 'Disabled'}
              </span>
            </div>
            <input
              type="number"
              step="1"
              min={0}
              disabled={!enableGitHub}
              value={minGitHub}
              onChange={(e) => {
                setMinGitHub(parseInt(e.target.value) || 0);
                setActivePreset('custom');
              }}
              className="w-full px-3 py-1.5 text-xs font-bold text-purple-600 rounded-lg border border-borderLine bg-background disabled:opacity-40"
            />
          </div>

          {/* Academic Year Filter */}
          <div className="space-y-1.5 p-3 rounded-lg border border-borderLine bg-surface">
            <label className="block text-xs font-bold text-textPrimary">Target Academic Year</label>
            <select
              value={targetYear}
              onChange={(e) => setTargetYear(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-bold text-textPrimary rounded-lg border border-borderLine bg-background"
            >
              <option value="All">All Batches & Years</option>
              <option value="3rd Year">3rd Year</option>
              <option value="4th Year">4th Year (Graduating Batch)</option>
              <option value="2nd Year">2nd Year</option>
              <option value="1st Year">1st Year</option>
            </select>
          </div>
        </div>

        {/* Live Search Input */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-borderLine bg-surface text-xs">
          <Search className="w-3.5 h-3.5 text-textSecondary shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate by name, roll number (e.g. 23091A3251) or email..."
            className="w-full bg-transparent focus:outline-none text-textPrimary"
          />
        </div>
      </div>

      {/* Summary Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 gap-3">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-bold">{eligibleStudents.length} Students Qualified for Placement Drive</p>
            <p className="text-xs text-emerald-700">
              Active Criteria:{' '}
              {enableCgpa ? `CGPA ≥ ${minCgpa}` : 'CGPA (Any)'}
              {enableLeetCode ? `, LeetCode ≥ ${minLeetCode}` : ''}
              {enableGitHub ? `, GitHub ≥ ${minGitHub}` : ''}
              {targetYear !== 'All' ? `, Year = ${targetYear}` : ''}
            </p>
          </div>
        </div>
        <span className="text-lg font-black text-emerald-700 bg-surface px-3 py-1 rounded-lg border border-emerald-300 self-start sm:self-auto">
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
                <td colSpan={8} className="py-8 text-center text-textSecondary text-xs">
                  <p className="font-bold text-textPrimary mb-1">No candidates match current eligibility criteria</p>
                  <p className="text-textSecondary mb-3">Try unchecking LeetCode / GitHub requirements or click below to view all students.</p>
                  <button
                    onClick={() => applyPreset('all')}
                    className="px-3 py-1.5 rounded-lg bg-brand-primary text-white font-bold text-xs shadow-sm hover:bg-brand-primary/90"
                  >
                    View All {candidateDataset.length} Students
                  </button>
                </td>
              </tr>
            ) : (
              eligibleStudents.map((s, idx) => (
                <tr key={s.regNo + idx} className="hover:bg-background/50 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-textSecondary">#{idx + 1}</td>
                  <td className="py-2.5 px-3 font-bold text-textPrimary">{s.name}</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-brand-primary">{s.regNo}</td>
                  <td className="py-2.5 px-3 text-textSecondary">{s.year} • {s.section}</td>
                  <td className="py-2.5 px-3 font-black text-brand-primary">{s.cgpa > 0 ? s.cgpa.toFixed(2) : 'N/A'}</td>
                  <td className="py-2.5 px-3 font-bold text-green-600">{s.leetcode > 0 ? `${s.leetcode} Solved` : '0'}</td>
                  <td className="py-2.5 px-3 font-medium text-textPrimary">{s.github > 0 ? `${s.github} Repos` : '0'}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      s.standing === 'Distinction' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' :
                      s.standing === 'First Class' ? 'bg-brand-soft text-brand-primary dark:bg-indigo-950/40 dark:text-indigo-400 border border-brand-primary/20' :
                      s.standing === 'Second Class' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800' :
                      s.standing === 'Pass' ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-200 dark:border-sky-800' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}>
                      {s.standing}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
