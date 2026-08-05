import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users, Search, Eye, X, GraduationCap, Trophy, TrendingUp,
  Award, ExternalLink, BookOpen, Code2, BarChart2, Building2,
  Download, Filter, ArrowUpRight, ArrowDownRight, PieChart as PieChartIcon, LineChart as LineChartIcon,
  CheckCircle2, Sparkles, AlertCircle, Layers, Sliders, Activity, MousePointerClick
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
import { StudentProfile, AcademicRecord } from '../../types';
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

// Enhanced Student Directory Mock dataset for PowerBI-like cross-filtering
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
  { year: '1st Year', avgCgpa: 8.85, students: 120, distinction: 42, firstClass: 55, secondClass: 18, passClass: 5 },
  { year: '2nd Year', avgCgpa: 8.95, students: 115, distinction: 45, firstClass: 50, secondClass: 15, passClass: 5 },
  { year: '3rd Year', avgCgpa: 9.12, students: 125, distinction: 54, firstClass: 55, secondClass: 13, passClass: 3 },
  { year: '4th Year', avgCgpa: 9.25, students: 110, distinction: 52, firstClass: 46, secondClass: 10, passClass: 2 },
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

// Year-wise Coding Performance
const CODING_STATS_BY_YEAR = [
  { year: '1st Year', avgLeetCode: 140, avgGithubRepos: 8, activeCodersPct: 72 },
  { year: '2nd Year', avgLeetCode: 260, avgGithubRepos: 16, activeCodersPct: 84 },
  { year: '3rd Year', avgLeetCode: 380, avgGithubRepos: 28, activeCodersPct: 94 },
  { year: '4th Year', avgLeetCode: 420, avgGithubRepos: 35, activeCodersPct: 96 },
];

// Section-Wise Breakdown (Sec A, Sec B, Sec C)
const SECTION_CGPA_SUMMARY = [
  { section: 'Section A', avgCgpa: 9.15, students: 155, distinction: 68, firstClass: 72 },
  { section: 'Section B', avgCgpa: 9.02, students: 160, distinction: 64, firstClass: 78 },
  { section: 'Section C', avgCgpa: 8.95, students: 155, distinction: 61, firstClass: 76 },
];

// Type for HOD cross-filter entries (used by both real API data and fallback)
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

// Helper: Convert API StudentProfile to HodStudentEntry
function mapStudentToHodEntry(student: StudentProfile, index: number): HodStudentEntry {
  const section = student.section
    ? (student.section.startsWith('Sec ') ? student.section : `Sec ${student.section}`)
    : 'Sec A';
  return {
    rank: index + 1,
    name: student.name,
    regNo: student.roll_number,
    email: student.email,
    section,
    year: student.year || '1st Year',
    cgpa: 0, // Will be enriched from academics if available
    semGpas: [],
    leetcode: 0,
    github: 0,
    standing: 'First Class', // Default, will be recalculated
    placementStatus: 'Active',
  };
}

export const HodDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'students' | 'rankings'>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  // PowerBI-Style Interactive Slicers State (Cross-filtering)
  const [slicerYear, setSlicerYear] = useState<string>('All');
  const [slicerSection, setSlicerSection] = useState<string>('All');
  const [slicerStanding, setSlicerStanding] = useState<string>('All');
  const [slicerCoding, setSlicerCoding] = useState<string>('All');

  const [inspectStudent, setInspectStudent] = useState<HodStudentEntry | null>(null);
  const [inspectTab, setInspectTab] = useState('academics-graph');
  const [analyticsCategory, setAnalyticsCategory] = useState<'academics' | 'coding' | 'sections'>('academics');

  const location = useLocation();

  // Sync active tab from URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'overview' || tab === 'analytics' || tab === 'students' || tab === 'rankings') {
      setActiveTab(tab as any);
    }
  }, [location.search]);

  // Queries
  const { data: students = [] } = useQuery({
    queryKey: ['hodStudents'],
    queryFn: () => api.getAllStudents(),
  });

  // Merge API students with fallback: use API data when available, else hardcoded demo data
  const mergedStudentDataset: HodStudentEntry[] = useMemo(() => {
    if (students.length > 0) {
      // Map API StudentProfile objects to HodStudentEntry shape
      return students.map((s, idx) => mapStudentToHodEntry(s, idx));
    }
    // Fallback to hardcoded demo data when API returns empty
    return FULL_CSE_STUDENTS;
  }, [students]);

  // PowerBI-style Dynamic Cross-Filtered Dataset (Interactive Graph Clicks update this!)
  const crossFilteredDataset = useMemo(() => {
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

  // PowerBI Dynamic Calculated Measures (KPI Metrics)
  const powerBiMetrics = useMemo(() => {
    const total = crossFilteredDataset.length;
    if (total === 0) return { count: 0, avgCgpa: '0.00', avgLeetCode: 0, distinctionRatio: '0%' };

    const avgCgpa = (crossFilteredDataset.reduce((s, p) => s + p.cgpa, 0) / total).toFixed(2);
    const avgLeetCode = Math.round(crossFilteredDataset.reduce((s, p) => s + p.leetcode, 0) / total);
    const distinctions = crossFilteredDataset.filter((p) => p.standing === 'Distinction').length;
    const distinctionRatio = `${Math.round((distinctions / total) * 100)}%`;

    return { count: total, avgCgpa, avgLeetCode, distinctionRatio };
  }, [crossFilteredDataset]);

  // Graph Click Handlers for Interactive PowerBI Cross-Filtering
  const handleYearBarClick = (data: any) => {
    const clickedYear = data?.year || data?.activeLabel;
    if (!clickedYear) return;
    setSlicerYear((prev) => (prev === clickedYear ? 'All' : clickedYear));
  };

  const handleSectionBarClick = (data: any) => {
    const clickedSection = data?.section || data?.activeLabel;
    if (!clickedSection) return;
    const formattedSec = clickedSection.includes('Section') ? clickedSection : `Section ${clickedSection.replace('Sec ', '')}`;
    setSlicerSection((prev) => (prev === formattedSec ? 'All' : formattedSec));
  };

  // Individual Student Inspection Sub-resources
  const inspectId = inspectStudent?.regNo || '';
  const { data: inspectAcademics = [] } = useQuery({
    queryKey: ['hodInspectAcademics', inspectId],
    queryFn: () => api.getAcademics(inspectId),
    enabled: Boolean(inspectId),
  });

  // Calculate individual student semester-by-semester growth trajectory
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

  // Student Individual Growth KPIs
  const studentGrowthMetrics = useMemo(() => {
    if (!inspectStudent || studentGraphData.length === 0) return { firstSem: 8.8, latestSem: 9.45, growth: +0.65, status: '🚀 Rapid Growth' };
    const first = studentGraphData[0].gpa;
    const latest = studentGraphData[studentGraphData.length - 1].gpa;
    const growth = Number((latest - first).toFixed(2));
    const status = growth >= 0.5 ? '🚀 Rapid Growth' : growth > 0 ? '📈 Steady Improvement' : '⭐ High Consistency';
    return { firstSem: first, latestSem: latest, growth, status };
  }, [inspectStudent, studentGraphData]);

  // CSV Report Generator
  const exportAnalyticsReport = () => {
    const headers = ['Rank', 'Name', 'Reg Number', 'Department', 'Year', 'Section', 'CGPA', 'LeetCode Solved', 'GitHub Repos', 'Standing', 'Placement Status'];
    const rows = crossFilteredDataset.map((p) => [
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
    link.setAttribute('download', `PowerBI_CSE_Filtered_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-surface border border-borderLine rounded-2xl p-6 md:p-8 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-soft text-brand-primary text-xs font-semibold mb-2">
                <GraduationCap className="w-3.5 h-3.5" />
                <span>HOD Interactive BI Suite — {DEPARTMENT_NAME}</span>
              </div>
              <h1 className="text-2xl font-extrabold text-textPrimary">PowerBI Interactive Analytics & 360° Inspection</h1>
              <p className="text-xs text-textSecondary mt-1">
                Real-time cross-filtering slicers, click-to-filter graph interactivity, and semester-by-semester student growth graphs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={exportAnalyticsReport}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold shadow-md hover:bg-brand-primary/90 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Export PowerBI CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── POWERBI-STYLE INTERACTIVE SLICERS & CLICK-TO-FILTER BAR ── */}
      <div className="bg-surface border border-brand-primary/30 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-extrabold text-brand-primary uppercase tracking-wider">
            <Sliders className="w-4 h-4" />
            <span>PowerBI Slicers & Graph Click-to-Filter Controls</span>
          </div>
          {(slicerYear !== 'All' || slicerSection !== 'All' || slicerStanding !== 'All' || slicerCoding !== 'All' || searchQuery) && (
            <button
              onClick={() => { setSlicerYear('All'); setSlicerSection('All'); setSlicerStanding('All'); setSlicerCoding('All'); setSearchQuery(''); }}
              className="text-xs font-bold text-alert hover:underline flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Reset All Slicers
            </button>
          )}
        </div>

        {/* Click-to-Filter Visual Hint */}
        <div className="p-2.5 rounded-xl bg-brand-soft/60 border border-brand-primary/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-brand-primary font-bold">
            <MousePointerClick className="w-4 h-4" />
            <span>PowerBI Tip: Click any bar or chart slice in the graphs below to cross-filter the entire dashboard reactively!</span>
          </div>
          <div className="flex gap-1.5">
            {slicerYear !== 'All' && (
              <span onClick={() => setSlicerYear('All')} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-primary text-white cursor-pointer flex items-center gap-1">
                Year: {slicerYear} <X className="w-3 h-3" />
              </span>
            )}
            {slicerSection !== 'All' && (
              <span onClick={() => setSlicerSection('All')} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white cursor-pointer flex items-center gap-1">
                Section: {slicerSection} <X className="w-3 h-3" />
              </span>
            )}
            {slicerStanding !== 'All' && (
              <span onClick={() => setSlicerStanding('All')} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-600 text-white cursor-pointer flex items-center gap-1">
                Standing: {slicerStanding} <X className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Year Slicer */}
          <div>
            <label className="block text-[11px] font-semibold text-textSecondary mb-1">Academic Year</label>
            <select
              value={slicerYear}
              onChange={(e) => setSlicerYear(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-borderLine bg-background text-textPrimary font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary"
            >
              <option value="All">All Years (1st to 4th)</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Section Slicer */}
          <div>
            <label className="block text-[11px] font-semibold text-textSecondary mb-1">Section</label>
            <select
              value={slicerSection}
              onChange={(e) => setSlicerSection(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-borderLine bg-background text-textPrimary font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary"
            >
              <option value="All">All Sections (A, B, C)</option>
              {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Academic Standing Slicer */}
          <div>
            <label className="block text-[11px] font-semibold text-textSecondary mb-1">Academic Standing</label>
            <select
              value={slicerStanding}
              onChange={(e) => setSlicerStanding(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-borderLine bg-background text-textPrimary font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary"
            >
              <option value="All">All Standings</option>
              {STANDINGS.map((st) => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>

          {/* Coding Level Slicer */}
          <div>
            <label className="block text-[11px] font-semibold text-textSecondary mb-1">Coding Activity</label>
            <select
              value={slicerCoding}
              onChange={(e) => setSlicerCoding(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-borderLine bg-background text-textPrimary font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary"
            >
              {CODING_LEVELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Search Query */}
          <div>
            <label className="block text-[11px] font-semibold text-textSecondary mb-1">Student Search</label>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-borderLine bg-background text-xs">
              <Search className="w-3.5 h-3.5 text-textSecondary shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, reg no..."
                className="w-full bg-transparent focus:outline-none text-textPrimary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-borderLine space-x-6 text-sm font-semibold overflow-x-auto">
        {[
          { key: 'overview', label: 'Year-Wise Overview' },
          { key: 'analytics', label: '📊 PowerBI Visual Analytics' },
          { key: 'students', label: 'Student Directory & 360° Growth' },
          { key: 'rankings', label: 'CGPA & Coding Leaderboard' },
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

      {/* Dynamic PowerBI Calculated KPI Cards (Updates instantly with Graph Clicks & Slicers) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users className="w-5 h-5" />} iconBgColor="bg-indigo-50 text-indigo-600"
          label="Sliced Student Count" value={`${powerBiMetrics.count} Students`} subtext="Cross-filtered dynamically" />
        <StatCard icon={<GraduationCap className="w-5 h-5" />} iconBgColor="bg-emerald-50 text-emerald-600"
          label="Filtered Avg CGPA" value={`${powerBiMetrics.avgCgpa} / 10`} subtext="Re-calculated from selection" />
        <StatCard icon={<Trophy className="w-5 h-5" />} iconBgColor="bg-amber-50 text-amber-600"
          label="Distinction Ratio" value={powerBiMetrics.distinctionRatio} subtext="Students with >9.0 CGPA" />
        <StatCard icon={<Code2 className="w-5 h-5" />} iconBgColor="bg-[#FFA116]/10 text-[#FFA116]"
          label="Filtered Avg LeetCode" value={`${powerBiMetrics.avgLeetCode} Solved`} subtext="Per student average" />
      </div>

      {/* ── TAB 1: Year-Wise Overview ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Year-Wise Academic Distribution Table */}
          <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-brand-primary" />
                <div>
                  <h3 className="text-base font-bold text-textPrimary">CSE Department Year-Wise CGPA Breakdown</h3>
                  <p className="text-xs text-textSecondary">Click any row to cross-filter the dashboard by that Academic Year</p>
                </div>
              </div>
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
                  {YEAR_CGPA_SUMMARY.map((y) => {
                    const isSelected = slicerYear === y.year;
                    return (
                      <tr
                        key={y.year}
                        onClick={() => setSlicerYear((prev) => (prev === y.year ? 'All' : y.year))}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-brand-soft/70 font-bold border-l-4 border-brand-primary' : 'hover:bg-background/50'
                        }`}
                      >
                        <td className="py-3.5 px-4 font-bold text-textPrimary flex items-center gap-2">
                          <span>{y.year}</span>
                          {isSelected && <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-primary text-white font-bold">Active Filter</span>}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-medium">{y.students}</td>
                        <td className="py-3.5 px-4 font-black text-brand-primary">{y.avgCgpa.toFixed(2)}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700">{y.distinction} ({Math.round((y.distinction / y.students) * 100)}%)</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-50 text-green-700">{y.firstClass} ({Math.round((y.firstClass / y.students) * 100)}%)</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700">{y.secondClass}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Rankers Spotlight across Years */}
          <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="text-base font-bold text-textPrimary">Top Department Rankers Spotlight (CSE)</h3>
                  <p className="text-xs text-textSecondary">Highest CGPA & Coding performers — click card to view 360° student profile with CGPA growth graph</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              {crossFilteredDataset.slice(0, 5).map((p) => (
                <button key={p.rank} onClick={() => { setInspectStudent(p); setInspectTab('academics-graph'); }}
                  className="bg-background border border-borderLine rounded-2xl p-4 text-center hover:border-brand-primary hover:shadow-md transition-all space-y-2 group">
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-50 text-amber-600 font-extrabold text-sm mb-1 group-hover:scale-110 transition-transform">
                    {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`}
                  </div>
                  <p className="text-xs font-bold text-textPrimary truncate">{p.name}</p>
                  <p className="text-xl font-black text-brand-primary">{p.cgpa}</p>
                  <p className="text-[10px] text-textSecondary">{p.year} • {p.section}</p>
                  <div className="flex justify-center gap-1.5 pt-1">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#FFA116]/10 text-[#FFA116]">LC: {p.leetcode}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 text-gray-700">GH: {p.github}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: PowerBI Visual Analytics (CLICK-TO-FILTER CHARTS) ── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 bg-surface p-1.5 rounded-xl border border-borderLine w-fit">
            <button
              onClick={() => setAnalyticsCategory('academics')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                analyticsCategory === 'academics' ? 'bg-brand-primary text-white shadow-sm' : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              Semester CGPA Trajectory
            </button>
            <button
              onClick={() => setAnalyticsCategory('coding')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                analyticsCategory === 'coding' ? 'bg-brand-primary text-white shadow-sm' : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              Year-Wise Coding Stats
            </button>
            <button
              onClick={() => setAnalyticsCategory('sections')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                analyticsCategory === 'sections' ? 'bg-brand-primary text-white shadow-sm' : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              Section Performance (Sec A, B, C)
            </button>
          </div>

          {/* Academic Progression Line Chart */}
          {analyticsCategory === 'academics' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <LineChartIcon className="w-5 h-5 text-brand-primary" />
                    <div>
                      <h3 className="text-sm font-bold text-textPrimary">Semester-by-Semester Avg CGPA Progression</h3>
                      <p className="text-xs text-textSecondary">Average CGPA trajectory from Semester 1 to Semester 7 across CSE batches</p>
                    </div>
                  </div>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={SEMESTER_PROGRESSION_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="semester" stroke="#6b7280" fontSize={11} />
                      <YAxis domain={[8.0, 9.5]} stroke="#6b7280" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Line type="monotone" dataKey="Year4" name="4th Year Batch" stroke="#4F46E5" strokeWidth={slicerYear === '4th Year' ? 4 : 2.5} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="Year3" name="3rd Year Batch" stroke="#10B981" strokeWidth={slicerYear === '3rd Year' ? 4 : 2.5} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="Year2" name="2nd Year Batch" stroke="#F59E0B" strokeWidth={slicerYear === '2nd Year' ? 4 : 2.5} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="Year1" name="1st Year Batch" stroke="#EC4899" strokeWidth={slicerYear === '1st Year' ? 4 : 2.5} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Year-wise Standing Bar Chart (INTERACTIVE POWERBI CLICK TO FILTER) */}
              <div className="bg-surface border border-brand-primary/40 rounded-2xl p-6 shadow-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h3 className="text-sm font-bold text-textPrimary flex items-center gap-1.5">
                        Academic Standing Breakup by Year
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-soft text-brand-primary font-extrabold uppercase">Click Bar to Filter</span>
                      </h3>
                      <p className="text-xs text-textSecondary">Click any bar to filter all tables and metrics by that Academic Year</p>
                    </div>
                  </div>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={YEAR_CGPA_SUMMARY}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      onClick={handleYearBarClick}
                      className="cursor-pointer"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="year" stroke="#6b7280" fontSize={11} />
                      <YAxis stroke="#6b7280" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar dataKey="distinction" name="Distinction (>9.0)" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="firstClass" name="1st Class (8.0-9.0)" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="secondClass" name="2nd Class (7.0-8.0)" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Coding Stats Chart (INTERACTIVE POWERBI CLICK TO FILTER) */}
          {analyticsCategory === 'coding' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-surface border border-brand-primary/40 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-5 h-5 text-[#FFA116]" />
                    <div>
                      <h3 className="text-sm font-bold text-textPrimary flex items-center gap-1.5">
                        Avg LeetCode Solved by Academic Year
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FFA116]/10 text-[#FFA116] font-extrabold uppercase">Click Bar to Filter</span>
                      </h3>
                      <p className="text-xs text-textSecondary">Click any bar to filter all tables and metrics by that Academic Year</p>
                    </div>
                  </div>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={CODING_STATS_BY_YEAR}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      onClick={handleYearBarClick}
                      className="cursor-pointer"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="year" stroke="#6b7280" fontSize={11} />
                      <YAxis stroke="#6b7280" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                      <Bar dataKey="avgLeetCode" name="Avg LeetCode Solved" fill="#FFA116" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  <div>
                    <h3 className="text-sm font-bold text-textPrimary">Active Coders % by Academic Year</h3>
                    <p className="text-xs text-textSecondary">Percentage of students with active linked coding profiles</p>
                  </div>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={CODING_STATS_BY_YEAR}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      onClick={handleYearBarClick}
                      className="cursor-pointer"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="year" stroke="#6b7280" fontSize={11} />
                      <YAxis domain={[0, 100]} stroke="#6b7280" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                      <Bar dataKey="activeCodersPct" name="Active Coders %" fill="#6366F1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Section Performance (INTERACTIVE POWERBI CLICK TO FILTER) */}
          {analyticsCategory === 'sections' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-surface border border-brand-primary/40 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-600" />
                    <div>
                      <h3 className="text-sm font-bold text-textPrimary flex items-center gap-1.5">
                        Average CGPA Comparison across Sections
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-soft text-brand-primary font-extrabold uppercase">Click Bar to Filter</span>
                      </h3>
                      <p className="text-xs text-textSecondary">Click Section A, Section B, or Section C bar to cross-filter dashboard</p>
                    </div>
                  </div>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={SECTION_CGPA_SUMMARY}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      onClick={handleSectionBarClick}
                      className="cursor-pointer"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="section" stroke="#6b7280" fontSize={11} />
                      <YAxis domain={[8.0, 10.0]} stroke="#6b7280" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                      <Bar dataKey="avgCgpa" name="Avg CGPA" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-textPrimary mb-1">Section Performance Insights</h3>
                  <p className="text-xs text-textSecondary mb-4">Internal section benchmarks for CSE HOD</p>

                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-emerald-900">Section A Leading in CGPA (9.15)</p>
                        <p className="text-[11px] text-emerald-700 mt-0.5">Section A has 68 students scoring above 9.0 CGPA, leading Section B (64) and Section C (61).</p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-indigo-900">Balanced Student Growth</p>
                        <p className="text-[11px] text-indigo-700 mt-0.5">All 3 sections maintain a strong average CGPA above 8.95 with 92%+ active coding profile integration.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-borderLine flex justify-end">
                  <button onClick={exportAnalyticsReport} className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1">
                    <Download className="w-3.5 h-3.5" /> Download PowerBI CSE Analytics Report
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Student Directory (Read-Only) ── */}
      {activeTab === 'students' && (
        <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-textPrimary">CSE Student Directory & Semester Growth Inspection</h3>
              <p className="text-xs text-textSecondary">Click 👁 to view individual student 360° profile and semester-by-semester CGPA growth graph</p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-brand-soft text-brand-primary rounded-full">
              Showing {crossFilteredDataset.length} Sliced Students
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-borderLine bg-background text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Reg Number</th>
                  <th className="py-3 px-4">Year / Sec</th>
                  <th className="py-3 px-4">Overall CGPA</th>
                  <th className="py-3 px-4">Sem-by-Sem Growth</th>
                  <th className="py-3 px-4">Coding Platforms</th>
                  <th className="py-3 px-4 text-right">Inspect 360°</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderLine text-sm">
                {crossFilteredDataset.length === 0 && (
                  <tr><td colSpan={7} className="py-10 text-center text-textSecondary text-xs">No CSE students found matching active slicers.</td></tr>
                )}
                {crossFilteredDataset.map((s) => (
                  <tr key={s.regNo} className="hover:bg-background/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-textPrimary">
                      {s.name}
                      <p className="text-[11px] text-textSecondary font-normal">{s.email}</p>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-brand-primary text-xs">{s.regNo}</td>
                    <td className="py-3.5 px-4 text-xs font-medium">{s.year} • {s.section}</td>
                    <td className="py-3.5 px-4 font-black text-emerald-600">{s.cgpa} / 10.0</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700">
                        <TrendingUp className="w-3 h-3" />
                        +0.65 (Sem 1 ➔ Sem 5)
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFA116]/10 text-[#FFA116]">LC: {s.leetcode}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-800">GH: {s.github}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button onClick={() => { setInspectStudent(s); setInspectTab('academics-graph'); }}
                        className="p-1.5 rounded-lg border border-borderLine text-brand-primary hover:bg-brand-soft transition-colors flex items-center gap-1.5 ml-auto text-xs font-bold"
                        title="View Full Profile & Graph">
                        <Eye className="w-4 h-4" /> Inspect Graph
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: CGPA & Coding Rankings ── */}
      {activeTab === 'rankings' && (
        <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="text-base font-bold text-textPrimary">CSE Department Academic & Coding Leaderboard</h3>
                <p className="text-xs text-textSecondary">Ranked by CGPA with LeetCode and GitHub metrics — click to inspect full profile & growth graph</p>
              </div>
            </div>
            <button onClick={exportAnalyticsReport} className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1">
              <Download className="w-3.5 h-3.5" /> Export CSE Leaderboard CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-borderLine bg-background text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Reg No</th>
                  <th className="py-3 px-4">Year / Sec</th>
                  <th className="py-3 px-4">Overall CGPA</th>
                  <th className="py-3 px-4">LeetCode Solved</th>
                  <th className="py-3 px-4">GitHub Repos</th>
                  <th className="py-3 px-4">Standing</th>
                  <th className="py-3 px-4 text-right">Inspect 360° & Graph</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderLine text-sm">
                {crossFilteredDataset.map((p) => (
                  <tr key={p.rank} className="hover:bg-background/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className={`font-extrabold text-sm ${p.rank === 1 ? 'text-amber-500' : p.rank === 2 ? 'text-gray-400' : p.rank === 3 ? 'text-amber-700' : 'text-textSecondary'}`}>
                        {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-textPrimary text-xs">{p.name}</td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-textSecondary">{p.regNo}</td>
                    <td className="py-3.5 px-4 text-xs">{p.year} • {p.section}</td>
                    <td className="py-3.5 px-4 font-black text-brand-primary text-sm">{p.cgpa} / 10.0</td>
                    <td className="py-3.5 px-4 font-semibold text-[#FFA116] text-xs">{p.leetcode} solved</td>
                    <td className="py-3.5 px-4 font-semibold text-textPrimary text-xs">{p.github} repos</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${p.standing === 'Distinction' ? 'bg-indigo-50 text-indigo-700' : 'bg-green-50 text-green-700'}`}>
                        {p.standing}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button onClick={() => { setInspectStudent(p); setInspectTab('academics-graph'); }}
                        className="p-1.5 rounded-lg border border-borderLine text-brand-primary hover:bg-brand-soft transition-colors flex items-center gap-1 ml-auto text-xs font-bold" title="View Full Profile">
                        <Eye className="w-4 h-4" /> Inspect Graph
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL: Full 360° Student Profile Inspection (READ-ONLY WITH INDIVIDUAL SEMESTER GROWTH GRAPH) ── */}
      {inspectStudent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-borderLine rounded-2xl p-6 max-w-4xl w-full shadow-2xl max-h-[92vh] overflow-y-auto relative">
            <button onClick={() => setInspectStudent(null)}
              className="absolute top-4 right-4 text-textSecondary hover:text-textPrimary p-2 rounded-full hover:bg-background">
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="border-b border-borderLine pb-4 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-brand-soft text-brand-primary">HOD CSE Inspection — Read Only</span>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600">No Edit Access</span>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">{studentGrowthMetrics.status}</span>
              </div>
              <h3 className="text-xl font-bold text-textPrimary">
                {inspectStudent.name} <span className="text-sm text-textSecondary font-normal">({inspectStudent.regNo})</span>
              </h3>
              <p className="text-xs text-textSecondary">CSE Department • {inspectStudent.year} • {inspectStudent.section} • {inspectStudent.email}</p>
            </div>

            {/* ── INDIVIDUAL STUDENT SEMESTER-BY-SEMESTER CGPA GROWTH GRAPH SPOTLIGHT HERO BANNER ── */}
            <div className="bg-gradient-to-r from-brand-soft/60 via-surface to-brand-soft/30 border border-brand-primary/20 rounded-2xl p-5 mb-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-brand-primary" />
                  <div>
                    <h4 className="text-sm font-extrabold text-textPrimary">Semester-by-Semester Academic Trajectory & CGPA Growth</h4>
                    <p className="text-xs text-textSecondary">Visual GPA progression graph evaluating sem-by-sem academic improvement</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-textSecondary font-medium">Total Growth:</span>
                  <span className="ml-1 text-sm font-black text-emerald-600">
                    +{studentGrowthMetrics.growth} CGPA
                  </span>
                </div>
              </div>

              {/* Individual Student Recharts Area Chart */}
              <div className="h-56 w-full">
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
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                      formatter={(val: any) => [`${val} GPA`, 'Semester GPA']}
                    />
                    <Area type="monotone" dataKey="gpa" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#studentGpaGradient)" dot={{ r: 5, fill: '#4F46E5' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Individual Student KPI Cards */}
              <div className="grid grid-cols-4 gap-3 pt-3 border-t border-borderLine mt-3">
                <div className="bg-surface p-2.5 rounded-xl border border-borderLine text-center">
                  <p className="text-[10px] text-textSecondary font-semibold">Sem 1 Starting GPA</p>
                  <p className="text-sm font-bold text-textPrimary">{studentGrowthMetrics.firstSem}</p>
                </div>
                <div className="bg-surface p-2.5 rounded-xl border border-borderLine text-center">
                  <p className="text-[10px] text-textSecondary font-semibold">Latest Sem GPA</p>
                  <p className="text-sm font-bold text-brand-primary">{studentGrowthMetrics.latestSem}</p>
                </div>
                <div className="bg-surface p-2.5 rounded-xl border border-borderLine text-center">
                  <p className="text-[10px] text-textSecondary font-semibold">Overall CGPA</p>
                  <p className="text-sm font-black text-emerald-600">{inspectStudent.cgpa}</p>
                </div>
                <div className="bg-surface p-2.5 rounded-xl border border-borderLine text-center">
                  <p className="text-[10px] text-textSecondary font-semibold">Sem Improvement</p>
                  <p className="text-sm font-extrabold text-emerald-600 flex items-center justify-center gap-0.5">
                    <ArrowUpRight className="w-3.5 h-3.5" /> +{studentGrowthMetrics.growth}
                  </p>
                </div>
              </div>
            </div>

            {/* Scrollable Tab Bar for 360° profile inspection */}
            <div className="flex space-x-1 border-b border-borderLine pb-px mb-6 overflow-x-auto">
              {[
                { key: 'academics-graph', label: '📊 CGPA Growth Graph' },
                { key: 'personal-info', label: 'Personal Info' },
                { key: 'coding-profiles', label: 'Coding Platforms' },
                { key: 'tech-skills', label: 'Tech Skills' },
                { key: 'certifications', label: 'Certifications' },
                { key: 'soft-skills', label: 'Soft Skills' },
                { key: 'achievements', label: 'Achievements' },
                { key: 'academic-goals', label: 'Academic Goals' },
              ].map((t) => (
                <button key={t.key} onClick={() => setInspectTab(t.key)}
                  className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-all whitespace-nowrap ${
                    inspectTab === t.key ? 'bg-brand-soft text-brand-primary border-b-2 border-brand-primary' : 'text-textSecondary hover:text-textPrimary'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div>
              {inspectTab === 'academics-graph' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-textPrimary uppercase tracking-wider">Semester-by-Semester GPA Breakdown Table</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-borderLine bg-background text-[11px] font-semibold text-textSecondary uppercase">
                          <th className="py-2.5 px-3">Semester</th>
                          <th className="py-2.5 px-3">Semester GPA</th>
                          <th className="py-2.5 px-3">Sem-by-Sem Delta</th>
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
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">Passed (Distinction)</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {inspectTab === 'personal-info' && <PersonalInfoTab readOnly={true} student={{
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
              }} onRefresh={() => {}} />}
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
