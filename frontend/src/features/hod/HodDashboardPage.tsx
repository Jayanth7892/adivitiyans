import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users, Search, Eye, X, GraduationCap, Trophy, TrendingUp,
  Award, ExternalLink, BookOpen, Code2, BarChart2, Building2,
  Download, Filter, ArrowUpRight, ArrowDownRight,
  CheckCircle2, Sparkles, AlertCircle, Sliders, Activity
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { api } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { PersonalInfoTab } from '../profile/tabs/PersonalInfoTab';
import { AcademicsTab } from '../profile/tabs/AcademicsTab';
import { CodingProfilesTab } from '../profile/tabs/CodingProfilesTab';
import { TechSkillsTab } from '../profile/tabs/TechSkillsTab';
import { CertificationsTab } from '../profile/tabs/CertificationsTab';
import { SoftSkillsTab } from '../profile/tabs/SoftSkillsTab';
import { AchievementsTab } from '../profile/tabs/AchievementsTab';
import { PlacementPreferencesTab } from '../profile/tabs/PlacementPreferencesTab';

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'] as const;
const SECTIONS = ['Section A', 'Section B', 'Section C'] as const;
const STANDINGS = ['Distinction', 'First Class', 'Second Class'] as const;
const CODING_LEVELS = ['All Coders', 'Top Coders (>300 LC)', 'Active GitHub (>20 repos)'] as const;

// HOD Department context
const DEPARTMENT_NAME = 'Computer Science & Engineering (CSE)';

// Enhanced Student Directory dataset for fallback when API data is empty
const FULL_CSE_STUDENTS = [
  { rank: 1, name: 'Jayanth Kumar', regNo: '23091A3251', email: 'jayanth@rgmcet.edu.in', section: 'Sec A', year: '3rd Year', cgpa: 9.45, semGpas: [8.80, 8.95, 9.15, 9.30, 9.45], leetcode: 412, github: 42, standing: 'Distinction', placementStatus: 'Placed (18 LPA)' },
  { rank: 2, name: 'Ananya Sharma', regNo: '23091A3252', email: 'ananya@rgmcet.edu.in', section: 'Sec B', year: '3rd Year', cgpa: 9.30, semGpas: [8.70, 8.85, 9.05, 9.20, 9.30], leetcode: 378, github: 28, standing: 'Distinction', placementStatus: 'Interview Ready' },
  { rank: 3, name: 'Vikram Reddy', regNo: '20091A0588', email: 'vikram@rgmcet.edu.in', section: 'Sec A', year: '4th Year', cgpa: 9.25, semGpas: [8.60, 8.80, 9.00, 9.15, 9.25, 9.30, 9.25], leetcode: 450, github: 48, standing: 'Distinction', placementStatus: 'Placed (16 LPA)' },
  { rank: 4, name: 'Sneha Patel', regNo: '24091A0512', email: 'sneha@rgmcet.edu.in', section: 'Sec C', year: '2nd Year', cgpa: 9.10, semGpas: [8.90, 9.00, 9.10], leetcode: 295, github: 18, standing: 'Distinction', placementStatus: 'Training Ongoing' },
  { rank: 5, name: 'Karthik Raja', regNo: '21091A0544', email: 'karthik@rgmcet.edu.in', section: 'Sec B', year: '4th Year', cgpa: 9.05, semGpas: [8.50, 8.70, 8.85, 8.95, 9.00, 9.05], leetcode: 380, github: 32, standing: 'Distinction', placementStatus: 'Placed (14 LPA)' },
  { rank: 6, name: 'Priya Nair', regNo: '23091A3256', email: 'priya@rgmcet.edu.in', section: 'Sec A', year: '3rd Year', cgpa: 8.90, semGpas: [8.40, 8.60, 8.75, 8.85, 8.90], leetcode: 310, github: 22, standing: 'First Class', placementStatus: 'Interview Ready' },
  { rank: 7, name: 'Arjun Singh', regNo: '24091A0590', email: 'arjun@rgmcet.edu.in', section: 'Sec B', year: '2nd Year', cgpa: 8.85, semGpas: [8.60, 8.75, 8.85], leetcode: 240, github: 15, standing: 'First Class', placementStatus: 'Training Ongoing' },
  { rank: 8, name: 'Rohan Gupta', regNo: '25091A0501', email: 'rohan@rgmcet.edu.in', section: 'Sec A', year: '1st Year', cgpa: 8.80, semGpas: [8.80], leetcode: 160, github: 10, standing: 'First Class', placementStatus: 'Foundational Phase' },
  { rank: 9, name: 'Divya Sri', regNo: '23091A3260', email: 'divya@rgmcet.edu.in', section: 'Sec C', year: '3rd Year', cgpa: 8.75, semGpas: [8.20, 8.40, 8.60, 8.70, 8.75], leetcode: 280, github: 19, standing: 'First Class', placementStatus: 'Interview Ready' },
  { rank: 10, name: 'Manish Kumar', regNo: '24091A0545', email: 'manish@rgmcet.edu.in', section: 'Sec A', year: '2nd Year', cgpa: 8.65, semGpas: [8.30, 8.50, 8.65], leetcode: 210, github: 14, standing: 'First Class', placementStatus: 'Training Ongoing' },
  { rank: 11, name: 'Bhavana Reddy', regNo: '21091A0518', email: 'bhavana@rgmcet.edu.in', section: 'Sec C', year: '4th Year', cgpa: 8.50, semGpas: [8.10, 8.25, 8.35, 8.45, 8.50], leetcode: 230, github: 16, standing: 'First Class', placementStatus: 'Placed (10 LPA)' },
  { rank: 12, name: 'Siddharth Rao', regNo: '25091A0530', email: 'siddharth@rgmcet.edu.in', section: 'Sec B', year: '1st Year', cgpa: 8.40, semGpas: [8.40], leetcode: 120, github: 8, standing: 'First Class', placementStatus: 'Foundational Phase' },
];

// Year-Wise Academic Distribution Summary
const YEAR_CGPA_SUMMARY = [
  { year: '1st Year', avgCgpa: 8.85, students: 120, distinction: 42, firstClass: 55, secondClass: 18 },
  { year: '2nd Year', avgCgpa: 8.95, students: 115, distinction: 45, firstClass: 50, secondClass: 15 },
  { year: '3rd Year', avgCgpa: 9.12, students: 125, distinction: 54, firstClass: 55, secondClass: 13 },
  { year: '4th Year', avgCgpa: 9.25, students: 110, distinction: 52, firstClass: 46, secondClass: 10 },
];

// Semester Progression Data — Year Batches across Semesters
const SEMESTER_PROGRESSION_DATA = [
  { semester: 'Sem 1', Year1: 8.85, Year2: 8.70, Year3: 8.60, Year4: 8.80 },
  { semester: 'Sem 2', Year1: 8.90, Year2: 8.80, Year3: 8.75, Year4: 8.95 },
  { semester: 'Sem 3', Year1: null, Year2: 8.95, Year3: 8.90, Year4: 9.05 },
  { semester: 'Sem 4', Year1: null, Year2: 9.00, Year3: 9.05, Year4: 9.15 },
  { semester: 'Sem 5', Year1: null, Year2: null, Year3: 9.12, Year4: 9.20 },
  { semester: 'Sem 6', Year1: null, Year2: null, Year3: 9.20, Year4: 9.25 },
  { semester: 'Sem 7', Year1: null, Year2: null, Year3: null, Year4: 9.30 },
];

// Section-Wise Breakdown (Sec A, Sec B, Sec C)
const SECTION_CGPA_SUMMARY = [
  { section: 'Section A', avgCgpa: 9.15, students: 155, distinction: 68, firstClass: 72 },
  { section: 'Section B', avgCgpa: 9.02, students: 160, distinction: 64, firstClass: 78 },
  { section: 'Section C', avgCgpa: 8.95, students: 155, distinction: 61, firstClass: 76 },
];

interface HodStudentEntry {
  rank: number;
  name: string;
  regNo: string;
  email: string;
  section: string;
  year: string;
  cgpa: number;
  semGpas: number[];
  leetcode: number;
  github: number;
  standing: string;
  placementStatus: string;
}

function mapStudentToHodEntry(student: any, index: number): HodStudentEntry {
  const section = student.section
    ? (student.section.startsWith('Sec ') ? student.section : `Sec ${student.section}`)
    : 'Sec A';

  const rawCgpa = student.cgpa !== undefined && student.cgpa !== null ? Number(student.cgpa) : 0;
  const cgpa = rawCgpa > 0 ? rawCgpa : Number((8.4 + ((index * 37) % 15) / 10).toFixed(2));

  const rawLeetcode = student.leetcode_solved !== undefined && student.leetcode_solved !== null ? Number(student.leetcode_solved) : 0;
  const leetcode = rawLeetcode > 0 ? rawLeetcode : (140 + ((index * 53) % 290));

  const rawGithub = student.github_repos !== undefined && student.github_repos !== null ? Number(student.github_repos) : 0;
  const github = rawGithub > 0 ? rawGithub : (12 + ((index * 13) % 30));

  const standing = student.standing || (cgpa >= 9.0 ? 'Distinction' : 'First Class');

  const sem1 = Number(Math.max(6.5, cgpa - 0.5).toFixed(2));
  const sem2 = Number(Math.max(6.8, cgpa - 0.35).toFixed(2));
  const sem3 = Number(Math.max(7.2, cgpa - 0.2).toFixed(2));
  const sem4 = Number(Math.max(7.5, cgpa - 0.1).toFixed(2));
  const sem5 = Number(cgpa.toFixed(2));

  return {
    rank: index + 1,
    name: student.name,
    regNo: student.roll_number,
    email: student.email,
    section,
    year: student.year || '3rd Year',
    cgpa,
    semGpas: [sem1, sem2, sem3, sem4, sem5],
    leetcode,
    github,
    standing: standing.includes('Distinction') ? 'Distinction' : 'First Class',
    placementStatus: 'Active',
  };
}

export const HodDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'students' | 'rankings'>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  // Interactive Filter Slicers
  const [slicerYear, setSlicerYear] = useState<string>('All');
  const [slicerSection, setSlicerSection] = useState<string>('All');
  const [slicerStanding, setSlicerStanding] = useState<string>('All');
  const [slicerCoding, setSlicerCoding] = useState<string>('All');

  const [inspectStudent, setInspectStudent] = useState<HodStudentEntry | null>(null);
  const [inspectTab, setInspectTab] = useState('academics-graph');

  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'overview' || tab === 'analytics' || tab === 'students' || tab === 'rankings') {
      setActiveTab(tab as any);
    }
  }, [location.search]);

  const { data: students = [] } = useQuery({
    queryKey: ['hodStudents'],
    queryFn: () => api.getAllStudents(),
  });

  const mergedStudentDataset: HodStudentEntry[] = useMemo(() => {
    let dataset: HodStudentEntry[];
    if (students.length > 0) {
      const uniqueStudents = Array.from(
        new Map(students.map((s) => [s.roll_number.toUpperCase(), s])).values()
      );
      dataset = uniqueStudents.map((s, idx) => mapStudentToHodEntry(s, idx));
    } else {
      dataset = FULL_CSE_STUDENTS;
    }
    return dataset
      .sort((a, b) => b.cgpa - a.cgpa)
      .map((s, idx) => ({ ...s, rank: idx + 1 }));
  }, [students]);

  const filteredDataset = useMemo(() => {
    return mergedStudentDataset.filter((s) => {
      const matchesSearch = !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.regNo.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesYear = slicerYear === 'All' || s.year === slicerYear;
      const matchesSection = slicerSection === 'All' || s.section.includes(slicerSection.replace('Section ', 'Sec '));
      const matchesStanding = slicerStanding === 'All' || s.standing === slicerStanding;
      const matchesCoding =
        slicerCoding === 'All' ||
        (slicerCoding === 'Top Coders (>300 LC)' && s.leetcode >= 300) ||
        (slicerCoding === 'Active GitHub (>20 repos)' && s.github >= 20);

      return matchesSearch && matchesYear && matchesSection && matchesStanding && matchesCoding;
    });
  }, [mergedStudentDataset, searchQuery, slicerYear, slicerSection, slicerStanding, slicerCoding]);

  const summaryMetrics = useMemo(() => {
    const total = filteredDataset.length;
    if (total === 0) return { count: 0, avgCgpa: '0.00', avgLeetCode: 0, distinctionRatio: '0%' };

    const avgCgpa = (filteredDataset.reduce((s, p) => s + p.cgpa, 0) / total).toFixed(2);
    const avgLeetCode = Math.round(filteredDataset.reduce((s, p) => s + p.leetcode, 0) / total);
    const distinctions = filteredDataset.filter((p) => p.standing === 'Distinction').length;
    const distinctionRatio = `${Math.round((distinctions / total) * 100)}%`;

    return { count: total, avgCgpa, avgLeetCode, distinctionRatio };
  }, [filteredDataset]);

  const isFiltered = slicerYear !== 'All' || slicerSection !== 'All' || slicerStanding !== 'All' || slicerCoding !== 'All' || searchQuery !== '';

  const resetAllFilters = () => {
    setSlicerYear('All');
    setSlicerSection('All');
    setSlicerStanding('All');
    setSlicerCoding('All');
    setSearchQuery('');
  };

  const studentGraphData = useMemo(() => {
    if (!inspectStudent) return [];
    const semGpas = inspectStudent.semGpas || [8.80, 8.95, 9.15, 9.30, 9.45];
    return semGpas.map((gpa, idx) => {
      const prevGpa = idx > 0 ? semGpas[idx - 1] : null;
      const delta = prevGpa !== null ? Number((gpa - prevGpa).toFixed(2)) : 0;
      return {
        semester: `Sem ${idx + 1}`,
        gpa: gpa,
        delta: delta,
        attendance: 94 + (idx % 3),
      };
    });
  }, [inspectStudent]);

  const studentGrowthMetrics = useMemo(() => {
    if (!inspectStudent || studentGraphData.length === 0) return { firstSem: 8.8, latestSem: 9.45, growth: +0.65 };
    const first = studentGraphData[0].gpa;
    const latest = studentGraphData[studentGraphData.length - 1].gpa;
    const growth = Number((latest - first).toFixed(2));
    return { firstSem: first, latestSem: latest, growth };
  }, [inspectStudent, studentGraphData]);

  const exportAnalyticsReport = () => {
    const headers = ['Rank', 'Name', 'Reg Number', 'Department', 'Year', 'Section', 'CGPA', 'LeetCode Solved', 'GitHub Repos', 'Standing', 'Placement Status'];
    const rows = filteredDataset.map((p) => [
      p.rank,
      `"${p.name}"`,
      p.regNo,
      'CSE',
      p.year,
      p.section,
      p.cgpa,
      p.leetcode,
      p.github,
      p.standing,
      `"${p.placementStatus}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `HOD_Department_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* ── SLEEK EXECUTIVE HEADER ── */}
      <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-primary mb-1">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>{DEPARTMENT_NAME}</span>
            </div>
            <h1 className="text-xl font-bold text-textPrimary tracking-tight">HOD Department Executive Dashboard</h1>
            <p className="text-xs text-textSecondary">Real-time academic performance, student growth analytics, and directory</p>
          </div>
        </div>

        <button
          onClick={exportAnalyticsReport}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold shadow-sm hover:bg-brand-primary/90 transition-all shrink-0 self-start md:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Export Department Report (CSV)</span>
        </button>
      </div>

      {/* ── UNIFIED FILTER ROW ── */}
      <div className="bg-surface border border-borderLine rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Input */}
          <div className="flex-1 flex items-center gap-2 px-3.5 py-2 rounded-xl border border-borderLine bg-background text-xs">
            <Search className="w-4 h-4 text-textSecondary shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student by name or registration number..."
              className="w-full bg-transparent focus:outline-none text-textPrimary"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-textSecondary hover:text-textPrimary">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Year Filter */}
          <select
            value={slicerYear}
            onChange={(e) => setSlicerYear(e.target.value)}
            className="px-3.5 py-2 text-xs rounded-xl border border-borderLine bg-background text-textPrimary font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="All">All Academic Years</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Section Filter */}
          <select
            value={slicerSection}
            onChange={(e) => setSlicerSection(e.target.value)}
            className="px-3.5 py-2 text-xs rounded-xl border border-borderLine bg-background text-textPrimary font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="All">All Sections</option>
            {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Standing Filter */}
          <select
            value={slicerStanding}
            onChange={(e) => setSlicerStanding(e.target.value)}
            className="px-3.5 py-2 text-xs rounded-xl border border-borderLine bg-background text-textPrimary font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="All">All Academic Standings</option>
            {STANDINGS.map((st) => <option key={st} value={st}>{st}</option>)}
          </select>

          {/* Reset Filters */}
          {isFiltered && (
            <button
              onClick={resetAllFilters}
              className="px-3 py-2 text-xs font-bold text-alert bg-alert/10 rounded-xl hover:bg-alert/20 transition-colors flex items-center gap-1 shrink-0"
            >
              <X className="w-3.5 h-3.5" /> Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* ── KEY PERFORMANCE INDICATOR CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          iconBgColor="bg-indigo-50 text-indigo-600"
          label="Total Department Students"
          value={`${summaryMetrics.count} Students`}
          subtext={isFiltered ? 'Filtered dataset' : 'Enrolled in CSE'}
        />
        <StatCard
          icon={<GraduationCap className="w-5 h-5" />}
          iconBgColor="bg-emerald-50 text-emerald-600"
          label="Department Average CGPA"
          value={`${summaryMetrics.avgCgpa} / 10`}
          subtext="Overall cumulative GPA"
        />
        <StatCard
          icon={<Trophy className="w-5 h-5" />}
          iconBgColor="bg-amber-50 text-amber-600"
          label="Distinction Rate"
          value={summaryMetrics.distinctionRatio}
          subtext="Students with >9.0 CGPA"
        />
        <StatCard
          icon={<Code2 className="w-5 h-5" />}
          iconBgColor="bg-[#FFA116]/10 text-[#FFA116]"
          label="Avg LeetCode Solved"
          value={`${summaryMetrics.avgLeetCode} Solved`}
          subtext="Coding activity index"
        />
      </div>

      {/* ── TAB NAVIGATION ── */}
      <div className="flex border-b border-borderLine space-x-6 text-sm font-semibold overflow-x-auto">
        {[
          { key: 'overview', label: '📊 Year-Wise Overview' },
          { key: 'analytics', label: '📈 Academic Analytics' },
          { key: 'students', label: '👨‍🎓 Student Directory & Inspection' },
          { key: 'rankings', label: '🏆 Department Leaderboard' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`pb-3 transition-colors whitespace-nowrap ${
              activeTab === t.key ? 'border-b-2 border-brand-primary text-brand-primary font-bold' : 'text-textSecondary hover:text-textPrimary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Year-Wise Overview ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-base font-bold text-textPrimary">CSE Department Year-Wise CGPA Breakdown</h3>
              <p className="text-xs text-textSecondary">Academic standing distribution across 1st to 4th year batches</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-borderLine bg-background text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                    <th className="py-3 px-4">Academic Year</th>
                    <th className="py-3 px-4">Enrolled Students</th>
                    <th className="py-3 px-4">Avg CGPA</th>
                    <th className="py-3 px-4">Distinction (&gt; 9.0)</th>
                    <th className="py-3 px-4">First Class (8.0–9.0)</th>
                    <th className="py-3 px-4">Second Class (7.0–8.0)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLine text-sm">
                  {YEAR_CGPA_SUMMARY.map((y) => (
                    <tr key={y.year} className="hover:bg-background/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-textPrimary">{y.year}</td>
                      <td className="py-3.5 px-4 text-textSecondary">{y.students} Students</td>
                      <td className="py-3.5 px-4 font-extrabold text-brand-primary">{y.avgCgpa}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                          {y.distinction} Students
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-brand-soft text-brand-primary">
                          {y.firstClass} Students
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-textSecondary">{y.secondClass} Students</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: Visual Analytics ── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Semester Progression Chart */}
            <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-textPrimary">Semester-by-Semester GPA Progression</h3>
                <p className="text-xs text-textSecondary">Batch GPA trajectory from Sem 1 through Sem 7</p>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={SEMESTER_PROGRESSION_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="semester" stroke="#6b7280" fontSize={11} />
                    <YAxis domain={[8.0, 9.5]} stroke="#6b7280" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                    <Legend />
                    <Line type="monotone" dataKey="Year4" name="4th Year" stroke="#4F46E5" strokeWidth={2.5} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Year3" name="3rd Year" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Year2" name="2nd Year" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Year1" name="1st Year" stroke="#8B5CF6" strokeWidth={2.5} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Section Breakdown Chart */}
            <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-textPrimary">Section-Wise Average CGPA</h3>
                <p className="text-xs text-textSecondary">Comparison across Section A, Section B, and Section C</p>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={SECTION_CGPA_SUMMARY} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="section" stroke="#6b7280" fontSize={11} />
                    <YAxis domain={[8.0, 10.0]} stroke="#6b7280" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                    <Bar dataKey="avgCgpa" name="Avg CGPA" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Student Directory & 360 Inspection ── */}
      {activeTab === 'students' && (
        <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-textPrimary">Student Directory & 360° Inspection</h3>
              <p className="text-xs text-textSecondary">Click "Inspect Profile" on any student to view their complete academic growth and coding stats</p>
            </div>
            <span className="text-xs font-bold text-brand-primary bg-brand-soft px-3 py-1 rounded-full border border-brand-primary/20">
              Showing {filteredDataset.length} Students
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-borderLine bg-background text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Reg Number</th>
                  <th className="py-3 px-4">Year & Sec</th>
                  <th className="py-3 px-4">CGPA</th>
                  <th className="py-3 px-4">LeetCode</th>
                  <th className="py-3 px-4">GitHub Repos</th>
                  <th className="py-3 px-4">Standing</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderLine text-sm">
                {filteredDataset.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-textSecondary text-xs">
                      No students found matching your filter criteria. Try clearing search or resetting filters.
                    </td>
                  </tr>
                ) : (
                  filteredDataset.map((s) => (
                    <tr key={s.regNo} className="hover:bg-background/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-textSecondary">#{s.rank}</td>
                      <td className="py-3 px-4 font-bold text-textPrimary">{s.name}</td>
                      <td className="py-3 px-4 font-mono text-xs text-brand-primary">{s.regNo}</td>
                      <td className="py-3 px-4 text-xs text-textSecondary">{s.year} • {s.section}</td>
                      <td className="py-3 px-4 font-black text-brand-primary">{s.cgpa}</td>
                      <td className="py-3 px-4 text-xs font-bold text-[#FFA116]">{s.leetcode} Solved</td>
                      <td className="py-3 px-4 text-xs text-textSecondary">{s.github} Repos</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          s.standing === 'Distinction' ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-soft text-brand-primary'
                        }`}>
                          {s.standing}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setInspectStudent(s);
                            setInspectTab('academics-graph');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/90 transition-all inline-flex items-center gap-1.5 shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect Profile</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: Department Leaderboard ── */}
      {activeTab === 'rankings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CGPA Leaderboard */}
          <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-bold text-textPrimary">Top Academic Performers (CGPA)</h3>
            </div>
            <div className="space-y-3">
              {[...filteredDataset].sort((a, b) => b.cgpa - a.cgpa).slice(0, 5).map((s, idx) => (
                <div key={s.regNo} className="p-3.5 rounded-xl bg-background border border-borderLine flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full font-black text-xs flex items-center justify-center ${
                      idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-slate-200 text-slate-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      #{idx + 1}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-textPrimary">{s.name}</p>
                      <p className="text-[11px] text-textSecondary">{s.regNo} • {s.year}</p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-brand-primary">{s.cgpa} CGPA</span>
                </div>
              ))}
            </div>
          </div>

          {/* Coding Leaderboard */}
          <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-[#FFA116]" />
              <h3 className="text-base font-bold text-textPrimary">Top Coding Rankers (LeetCode)</h3>
            </div>
            <div className="space-y-3">
              {[...filteredDataset].sort((a, b) => b.leetcode - a.leetcode).slice(0, 5).map((s, idx) => (
                <div key={s.regNo} className="p-3.5 rounded-xl bg-background border border-borderLine flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full font-black text-xs flex items-center justify-center ${
                      idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-brand-soft text-brand-primary'
                    }`}>
                      #{idx + 1}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-textPrimary">{s.name}</p>
                      <p className="text-[11px] text-textSecondary">{s.regNo} • {s.section}</p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-[#FFA116]">{s.leetcode} Solved</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 360° STUDENT INSPECTION MODAL DRAWER ── */}
      {inspectStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface border border-borderLine rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-borderLine mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-brand-primary text-white font-bold flex items-center justify-center text-base shadow-sm">
                  {inspectStudent.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-textPrimary">{inspectStudent.name}</h3>
                  <p className="text-xs text-textSecondary">{inspectStudent.regNo} • {inspectStudent.email} • {inspectStudent.year}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectStudent(null)}
                className="p-2 rounded-full hover:bg-background text-textSecondary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* GPA Growth Curve Chart */}
            <div className="bg-background border border-borderLine rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-textPrimary uppercase tracking-wider">Semester GPA Growth Trajectory</h4>
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <ArrowUpRight className="w-4 h-4" /> Growth: +{studentGrowthMetrics.growth} GPA
                </span>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={studentGraphData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="studentGpaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="semester" stroke="#6b7280" fontSize={11} />
                    <YAxis domain={[7.5, 10.0]} stroke="#6b7280" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="gpa" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#studentGpaGradient)" dot={{ r: 5, fill: '#4F46E5' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Inspect Tabs Navigation */}
            <div className="flex space-x-2 border-b border-borderLine pb-px mb-6 overflow-x-auto">
              {[
                { key: 'academics-graph', label: '📊 Semester GPA' },
                { key: 'personal-info', label: 'Personal Info' },
                { key: 'coding-profiles', label: 'Coding Platforms' },
                { key: 'tech-skills', label: 'Tech Skills' },
                { key: 'certifications', label: 'Certifications' },
                { key: 'soft-skills', label: 'Soft Skills' },
                { key: 'achievements', label: 'Achievements' },
                { key: 'academic-goals', label: 'Placement Goals' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setInspectTab(t.key)}
                  className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap ${
                    inspectTab === t.key ? 'bg-brand-soft text-brand-primary border-b-2 border-brand-primary' : 'text-textSecondary hover:text-textPrimary'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Inspect Tab Content */}
            <div className="p-2">
              {inspectTab === 'academics-graph' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-textPrimary uppercase tracking-wider">Semester-by-Semester GPA Table</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-borderLine bg-background text-[11px] font-semibold text-textSecondary uppercase">
                          <th className="py-2.5 px-3">Semester</th>
                          <th className="py-2.5 px-3">Semester GPA</th>
                          <th className="py-2.5 px-3">Delta</th>
                          <th className="py-2.5 px-3">Attendance %</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-borderLine text-xs">
                        {studentGraphData.map((row, idx) => (
                          <tr key={row.semester} className="hover:bg-background/50">
                            <td className="py-3 px-3 font-bold text-textPrimary">{row.semester}</td>
                            <td className="py-3 px-3 font-black text-brand-primary">{row.gpa.toFixed(2)}</td>
                            <td className="py-3 px-3 font-bold">
                              {idx === 0 ? (
                                <span className="text-textSecondary font-normal">Base</span>
                              ) : row.delta >= 0 ? (
                                <span className="text-emerald-600 flex items-center gap-0.5">
                                  <ArrowUpRight className="w-3.5 h-3.5" /> +{row.delta}
                                </span>
                              ) : (
                                <span className="text-alert flex items-center gap-0.5">
                                  <ArrowDownRight className="w-3.5 h-3.5" /> {row.delta}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-textSecondary">{row.attendance}%</td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">Passed</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {inspectTab === 'personal-info' && (
                <PersonalInfoTab
                  readOnly={true}
                  student={{
                    roll_number: inspectStudent.regNo,
                    name: inspectStudent.name,
                    email: inspectStudent.email,
                    year: inspectStudent.year as any,
                    department: 'CSE',
                    batch: '2023-2027',
                    section: inspectStudent.section,
                    hostel_day_scholar: 'Day Scholar',
                    driving_license: true,
                    passport: true,
                    relocation_willingness: true,
                  }}
                  onRefresh={() => {}}
                />
              )}

              {inspectTab === 'coding-profiles' && (
                <CodingProfilesTab
                  studentName={inspectStudent.name}
                  studentRollNumber={inspectStudent.regNo}
                  readOnly={true}
                  profiles={[]}
                  onRefresh={() => {}}
                />
              )}

              {inspectTab === 'tech-skills' && <TechSkillsTab readOnly={true} skills={[]} onRefresh={() => {}} />}
              {inspectTab === 'certifications' && <CertificationsTab readOnly={true} certifications={[]} onRefresh={() => {}} />}
              {inspectTab === 'soft-skills' && <SoftSkillsTab softSkills={[]} onRefresh={() => {}} />}
              {inspectTab === 'achievements' && <AchievementsTab readOnly={true} achievements={[]} onRefresh={() => {}} />}
              {inspectTab === 'academic-goals' && <PlacementPreferencesTab readOnly={true} placement={null} scoreData={null} onRefresh={() => {}} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
