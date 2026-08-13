import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users, Search, Eye, X, GraduationCap, Trophy, TrendingUp,
  Award, ExternalLink, BookOpen, Code2, BarChart2, Building2,
  Download, Filter, ArrowUpRight, ArrowDownRight,
  CheckCircle2, Sparkles, AlertCircle, Sliders, Activity, RefreshCw, Upload,
  Settings, KeyRound, Mail, Lock, ShieldCheck,
} from 'lucide-react';
import { PlacementEligibilitySection } from './components/PlacementEligibilitySection';
import { BulkImportModal } from '../admin/components/BulkImportModal';
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
import type { AcademicRecord, TechSkill, Certification, SoftSkill, Achievement, PlacementProfile } from '../../types';
import { fetchLivePlatformSnapshot } from '../coding/liveFetchers';
import { StatCard } from '../../components/common/StatCard';
import { PersonalInfoTab } from '../profile/tabs/PersonalInfoTab';
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
const DEPARTMENT_NAME = 'CSE(Data Science)';

// Enhanced Student Directory dataset for fallback when API data is empty
const FULL_CSE_STUDENTS = [
  { rank: 1, name: 'Jayanth Kumar', regNo: '23091A3251', email: 'jayanth@rgmcet.edu.in', section: 'Sec A', year: '3rd Year', cgpa: 9.45, semGpas: [8.80, 8.95, 9.15, 9.30, 9.45], leetcode: 412, isLcLinked: true, github: 42, isGhLinked: true, standing: 'Distinction', placementStatus: 'Placed (18 LPA)' },
  { rank: 2, name: 'Ananya Sharma', regNo: '23091A3252', email: 'ananya@rgmcet.edu.in', section: 'Sec B', year: '3rd Year', cgpa: 9.30, semGpas: [8.70, 8.85, 9.05, 9.20, 9.30], leetcode: 378, isLcLinked: true, github: 28, isGhLinked: true, standing: 'Distinction', placementStatus: 'Interview Ready' },
  { rank: 3, name: 'Vikram Reddy', regNo: '20091A0588', email: 'vikram@rgmcet.edu.in', section: 'Sec A', year: '4th Year', cgpa: 9.25, semGpas: [8.60, 8.80, 9.00, 9.15, 9.25, 9.30, 9.25], leetcode: 450, isLcLinked: true, github: 48, isGhLinked: true, standing: 'Distinction', placementStatus: 'Placed (16 LPA)' },
  { rank: 4, name: 'Sneha Patel', regNo: '24091A0512', email: 'sneha@rgmcet.edu.in', section: 'Sec C', year: '2nd Year', cgpa: 9.10, semGpas: [8.90, 9.00, 9.10], leetcode: 295, isLcLinked: true, github: 18, isGhLinked: true, standing: 'Distinction', placementStatus: 'Training Ongoing' },
  { rank: 5, name: 'Karthik Raja', regNo: '21091A0544', email: 'karthik@rgmcet.edu.in', section: 'Sec B', year: '4th Year', cgpa: 9.05, semGpas: [8.50, 8.70, 8.85, 8.95, 9.00, 9.05], leetcode: 380, isLcLinked: true, github: 32, isGhLinked: true, standing: 'Distinction', placementStatus: 'Placed (14 LPA)' },
  { rank: 6, name: 'Priya Nair', regNo: '23091A3256', email: 'priya@rgmcet.edu.in', section: 'Sec A', year: '3rd Year', cgpa: 8.90, semGpas: [8.40, 8.60, 8.75, 8.85, 8.90], leetcode: 310, isLcLinked: true, github: 22, isGhLinked: true, standing: 'First Class', placementStatus: 'Interview Ready' },
  { rank: 7, name: 'Arjun Singh', regNo: '24091A0590', email: 'arjun@rgmcet.edu.in', section: 'Sec B', year: '2nd Year', cgpa: 8.85, semGpas: [8.60, 8.75, 8.85], leetcode: 240, isLcLinked: true, github: 15, isGhLinked: true, standing: 'First Class', placementStatus: 'Training Ongoing' },
  { rank: 8, name: 'Rohan Gupta', regNo: '25091A0501', email: 'rohan@rgmcet.edu.in', section: 'Sec A', year: '1st Year', cgpa: 8.80, semGpas: [8.80], leetcode: 160, isLcLinked: true, github: 10, isGhLinked: true, standing: 'First Class', placementStatus: 'Foundational Phase' },
  { rank: 9, name: 'Divya Sri', regNo: '23091A3260', email: 'divya@rgmcet.edu.in', section: 'Sec C', year: '3rd Year', cgpa: 8.75, semGpas: [8.20, 8.40, 8.60, 8.70, 8.75], leetcode: 280, isLcLinked: true, github: 19, isGhLinked: true, standing: 'First Class', placementStatus: 'Interview Ready' },
  { rank: 10, name: 'Manish Kumar', regNo: '24091A0545', email: 'manish@rgmcet.edu.in', section: 'Sec A', year: '2nd Year', cgpa: 8.65, semGpas: [8.30, 8.50, 8.65], leetcode: 210, isLcLinked: true, github: 14, isGhLinked: true, standing: 'First Class', placementStatus: 'Training Ongoing' },
  { rank: 11, name: 'Bhavana Reddy', regNo: '21091A0518', email: 'bhavana@rgmcet.edu.in', section: 'Sec C', year: '4th Year', cgpa: 8.50, semGpas: [8.10, 8.25, 8.35, 8.45, 8.50], leetcode: 230, isLcLinked: true, github: 16, isGhLinked: true, standing: 'First Class', placementStatus: 'Placed (10 LPA)' },
  { rank: 12, name: 'Siddharth Rao', regNo: '25091A0530', email: 'siddharth@rgmcet.edu.in', section: 'Sec B', year: '1st Year', cgpa: 8.40, semGpas: [8.40], leetcode: 120, isLcLinked: true, github: 8, isGhLinked: true, standing: 'First Class', placementStatus: 'Foundational Phase' },
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
  leetcodeHandle: string | null;
  isLcLinked: boolean;
  github: number;
  githubHandle: string | null;
  isGhLinked: boolean;
  standing: string;
  placementStatus: string;
}

function mapStudentToHodEntry(student: any, index: number, liveSolved?: number): HodStudentEntry {
  const section = student.section
    ? (student.section.startsWith('Sec ') ? student.section : `Sec ${student.section}`)
    : 'Sec A';

  // Strictly use real CGPA recorded in DB, 0 if not present
  const cgpa = student.cgpa !== undefined && student.cgpa !== null ? Number(student.cgpa) : 0;

  // Real LeetCode profile linking check
  const rawLcHandle = (student.leetcode_handle || student.leetcode || '').toString().trim();
  const isLcLinked = Boolean(rawLcHandle) && rawLcHandle !== 'Not Linked' && rawLcHandle !== '';
  const dbLeetcode = student.leetcode_solved !== undefined && student.leetcode_solved !== null ? Number(student.leetcode_solved) : 0;
  const leetcode = liveSolved !== undefined ? liveSolved : (isLcLinked ? dbLeetcode : 0);

  // Real GitHub profile linking check
  const rawGhHandle = (student.github_handle || student.github || '').toString().trim();
  const isGhLinked = Boolean(rawGhHandle) && rawGhHandle !== 'Not Linked' && rawGhHandle !== '';
  const github = isGhLinked ? Number(student.github_repos || 0) : 0;

  const standing = student.standing || (cgpa >= 9.0 ? 'Distinction' : (cgpa >= 6.5 ? 'First Class' : (cgpa > 0 ? 'Pass' : 'N/A')));

  return {
    rank: index + 1,
    name: student.name,
    regNo: student.roll_number,
    email: student.email,
    section,
    year: student.year || '3rd Year',
    cgpa,
    semGpas: [cgpa, cgpa, cgpa, cgpa, cgpa],
    leetcode,
    leetcodeHandle: isLcLinked ? rawLcHandle : null,
    isLcLinked: isLcLinked || leetcode > 0,
    github,
    githubHandle: isGhLinked ? rawGhHandle : null,
    isGhLinked: isGhLinked || github > 0,
    standing,
    placementStatus: 'Active',
  };
}

export const HodDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'students' | 'rankings' | 'placement' | 'settings'>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  // Interactive Filter Slicers
  const [slicerYear, setSlicerYear] = useState<string>('All');
  const [slicerSection, setSlicerSection] = useState<string>('All');
  const [slicerStanding, setSlicerStanding] = useState<string>('All');
  const [slicerCoding, setSlicerCoding] = useState<string>('All');

  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [syncingCron, setSyncingCron] = useState(false);

  const [inspectStudent, setInspectStudent] = useState<HodStudentEntry | null>(null);
  const [inspectTab, setInspectTab] = useState('academics-graph');

  // Full student data fetched from API whenever the HOD opens a student for inspection
  const [inspectStudentFullProfile, setInspectStudentFullProfile] = useState<any>(null);
  const [inspectProfileLoading, setInspectProfileLoading] = useState(false);
  const [inspectStudentAcademics, setInspectStudentAcademics] = useState<AcademicRecord[]>([]);
  const [inspectStudentTechSkills, setInspectStudentTechSkills] = useState<TechSkill[]>([]);
  const [inspectStudentCerts, setInspectStudentCerts] = useState<Certification[]>([]);
  const [inspectStudentSoftSkills, setInspectStudentSoftSkills] = useState<SoftSkill[]>([]);
  const [inspectStudentAchievements, setInspectStudentAchievements] = useState<Achievement[]>([]);
  const [inspectStudentPlacement, setInspectStudentPlacement] = useState<PlacementProfile | null>(null);

  // Analytics Tab — real semester-wise CGPA progression per selected year batch
  const [progressionYear, setProgressionYear] = useState('3rd Year');
  const [progressionCache, setProgressionCache] = useState<Record<string, { semester: string; avg: number }[]>>({});
  const [progressionLoading, setProgressionLoading] = useState(false);

  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'overview' || tab === 'analytics' || tab === 'students' || tab === 'rankings' || tab === 'placement' || tab === 'settings') {
      setActiveTab(tab as any);
    }
  }, [location.search]);

  // HOD Account Settings state
  const [settingsCurrentPassword, setSettingsCurrentPassword] = useState('');
  const [settingsNewEmail, setSettingsNewEmail] = useState('');
  const [settingsNewPassword, setSettingsNewPassword] = useState('');
  const [settingsConfirmPassword, setSettingsConfirmPassword] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showSettingsPwd, setShowSettingsPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  // Semester Unlock Control state
  const [unlockSettings, setUnlockSettings] = useState<{ year_label: string; max_semester: number }[]>([
    { year_label: '1st Year', max_semester: 0 },
    { year_label: '2nd Year', max_semester: 2 },
    { year_label: '3rd Year', max_semester: 4 },
    { year_label: '4th Year', max_semester: 6 },
  ]);
  const [unlockSavingYear, setUnlockSavingYear] = useState<string | null>(null);

  // Fetch ALL student sub-data in parallel whenever a student is opened for inspection
  useEffect(() => {
    if (!inspectStudent) {
      setInspectStudentFullProfile(null);
      setInspectStudentAcademics([]);
      setInspectStudentTechSkills([]);
      setInspectStudentCerts([]);
      setInspectStudentSoftSkills([]);
      setInspectStudentAchievements([]);
      setInspectStudentPlacement(null);
      return;
    }
    let cancelled = false;
    const regNo = inspectStudent.regNo;
    setInspectProfileLoading(true);

    Promise.allSettled([
      api.getStudentProfile(regNo),
      api.getAcademics(regNo),
      api.getTechSkills(regNo),
      api.getCertifications(regNo),
      api.getSoftSkills(regNo),
      api.getAchievements(regNo),
      api.getPlacementProfile(regNo),
    ]).then(([profileRes, academicsRes, techRes, certsRes, softRes, achRes, placementRes]) => {
      if (cancelled) return;
      setInspectStudentFullProfile(profileRes.status === 'fulfilled' ? profileRes.value : null);
      setInspectStudentAcademics(academicsRes.status === 'fulfilled' ? academicsRes.value : []);
      setInspectStudentTechSkills(techRes.status === 'fulfilled' ? techRes.value : []);
      setInspectStudentCerts(certsRes.status === 'fulfilled' ? certsRes.value : []);
      setInspectStudentSoftSkills(softRes.status === 'fulfilled' ? softRes.value : []);
      setInspectStudentAchievements(achRes.status === 'fulfilled' ? achRes.value : []);
      setInspectStudentPlacement(placementRes.status === 'fulfilled' ? placementRes.value : null);
      setInspectProfileLoading(false);
    });

    return () => { cancelled = true; };
  }, [inspectStudent]);

  const { data: students = [], refetch } = useQuery({
    queryKey: ['hodStudents'],
    queryFn: () => api.getAllStudents(),
  });

  const handleForceCronSync = async () => {
    setSyncingCron(true);
    try {
      const res = await api.triggerCronSync();
      alert(`Background Coding Sync Completed!\nProcessed: ${res.result?.totalProcessed || 0} handles.\nLeetCode Updated: ${res.result?.leetcodeUpdated || 0}\nGitHub Updated: ${res.result?.githubUpdated || 0}`);
      refetch();
    } catch (e: any) {
      alert('Sync failed: ' + e.message);
    } finally {
      setSyncingCron(false);
    }
  };

  // Fetch real semester unlock settings from backend
  useEffect(() => {
    api.getSemesterUnlockSettings()
      .then(setUnlockSettings)
      .catch(() => {}); // silently keep defaults on error
  }, []);

  const [liveSnapshots, setLiveSnapshots] = useState<Record<string, number>>({});

  useEffect(() => {
    let mounted = true;
    async function loadLiveStats() {
      if (students.length === 0) return;
      const snapshotMap: Record<string, number> = {};

      await Promise.all(
        students.map(async (s: any) => {
          const lcHandle = s.leetcode_handle;
          const isValidHandle = Boolean(lcHandle) && lcHandle !== 'Not Linked' && String(lcHandle).trim() !== '';
          if (isValidHandle) {
            try {
              const cleanHandle = lcHandle.replace(/^@/, '').trim();
              const snapshot = await fetchLivePlatformSnapshot('leetcode', cleanHandle);
              const total = typeof snapshot.kpis[0]?.value === 'number' ? snapshot.kpis[0].value : 0;
              snapshotMap[s.roll_number] = total;
            } catch (e) {
              console.warn(`[HOD Dashboard] Live fetch failed for ${s.roll_number}:`, e);
            }
          }
        })
      );

      if (mounted) {
        setLiveSnapshots(snapshotMap);
      }
    }
    loadLiveStats();
    return () => { mounted = false; };
  }, [students]);

  const mergedStudentDataset: HodStudentEntry[] = useMemo(() => {
    let dataset: HodStudentEntry[];
    if (students.length > 0) {
      const uniqueStudents = Array.from(
        new Map(students.map((s) => [s.roll_number.toUpperCase(), s])).values()
      );
      dataset = uniqueStudents.map((s, idx) => {
        const liveSolved = liveSnapshots[s.roll_number];
        return mapStudentToHodEntry(s, idx, liveSolved);
      });
    } else {
      dataset = FULL_CSE_STUDENTS.map((s, idx) => ({
        ...s,
        leetcodeHandle: 'demo',
        isLcLinked: true,
        githubHandle: 'demo',
        isGhLinked: true,
      }));
    }
    return dataset.map((s, idx) => ({ ...s, rank: idx + 1 }));
  }, [students, liveSnapshots]);

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

    const cgpaStudents = filteredDataset.filter((p) => p.cgpa > 0);
    const avgCgpa = cgpaStudents.length > 0
      ? (cgpaStudents.reduce((s, p) => s + p.cgpa, 0) / cgpaStudents.length).toFixed(2)
      : '0.00';

    const lcStudents = filteredDataset.filter((p) => p.isLcLinked && p.leetcode > 0);
    const avgLeetCode = lcStudents.length > 0
      ? Math.round(lcStudents.reduce((s, p) => s + p.leetcode, 0) / lcStudents.length)
      : 0;

    const distinctions = filteredDataset.filter((p) => p.standing.includes('Distinction')).length;
    const distinctionRatio = `${Math.round((distinctions / total) * 100)}%`;

    return { count: total, avgCgpa, avgLeetCode, distinctionRatio };
  }, [filteredDataset]);

  const yearCgpaSummary = useMemo(() => {
    const yearsList = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
    return yearsList.map((yr) => {
      const yrDigit = yr.slice(0, 1);
      const yearStudents = mergedStudentDataset.filter(
        (s) => s.year === yr || s.year?.startsWith(yrDigit)
      );
      const totalStudents = yearStudents.length;
      const validCgpaStudents = yearStudents.filter((s) => s.cgpa > 0);
      const avgCgpaVal = validCgpaStudents.length > 0
        ? (validCgpaStudents.reduce((sum, s) => sum + s.cgpa, 0) / validCgpaStudents.length)
        : 0;

      const distinction = yearStudents.filter(
        (s) => s.cgpa >= 9.0 || s.standing?.includes('Distinction')
      ).length;

      const firstClass = yearStudents.filter(
        (s) => (s.cgpa >= 8.0 && s.cgpa < 9.0) || s.standing?.includes('First')
      ).length;

      const secondClass = yearStudents.filter(
        (s) => (s.cgpa >= 7.0 && s.cgpa < 8.0) || s.standing?.includes('Second') || (s.cgpa > 0 && s.cgpa < 8.0)
      ).length;

      return {
        year: yr,
        students: totalStudents,
        avgCgpa: avgCgpaVal > 0 ? avgCgpaVal.toFixed(2) : '0.00',
        distinction,
        firstClass,
        secondClass,
      };
    });
  }, [mergedStudentDataset]);

  const sectionCgpaSummary = useMemo(() => {
    const sectionsList = ['Section A', 'Section B', 'Section C'];
    return sectionsList.map((sec) => {
      const secLetter = sec.slice(-1);
      const secStudents = mergedStudentDataset.filter(
        (s) => s.section.includes(secLetter) || s.section === sec
      );
      const totalStudents = secStudents.length;
      const validCgpaStudents = secStudents.filter((s) => s.cgpa > 0);
      const avgCgpaVal = validCgpaStudents.length > 0
        ? Number((validCgpaStudents.reduce((sum, s) => sum + s.cgpa, 0) / validCgpaStudents.length).toFixed(2))
        : 0;

      const distinction = secStudents.filter(
        (s) => s.cgpa >= 9.0 || s.standing?.includes('Distinction')
      ).length;

      const firstClass = secStudents.filter(
        (s) => (s.cgpa >= 8.0 && s.cgpa < 9.0) || s.standing?.includes('First')
      ).length;

      return {
        section: sec,
        avgCgpa: avgCgpaVal,
        students: totalStudents,
        distinction,
        firstClass,
      };
    });
  }, [mergedStudentDataset]);

  // Year-Wise LeetCode Problems Solved — avg and top solver per year batch
  const yearLeetCodeData = useMemo(() => {
    const yearsList = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
    return yearsList.map((yr) => {
      const yrDigit = yr.slice(0, 1);
      const yearStudents = mergedStudentDataset.filter(
        (s) => s.year === yr || s.year?.startsWith(yrDigit)
      );
      const linked = yearStudents.filter((s) => s.isLcLinked && s.leetcode > 0);
      const avgSolved = linked.length > 0
        ? Math.round(linked.reduce((sum, s) => sum + s.leetcode, 0) / linked.length)
        : 0;
      const topSolver = linked.length > 0
        ? linked.reduce((best, s) => s.leetcode > best.leetcode ? s : best, linked[0]).leetcode
        : 0;
      return {
        year: yr.replace(' Year', ''),
        avgSolved,
        topSolver,
        linked: linked.length,
        total: yearStudents.length,
      };
    });
  }, [mergedStudentDataset]);

  const semesterProgressionData = useMemo(() => {
    const semesters = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7'];
    const yearsList = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

    return semesters.map((sem, sIdx) => {
      const entry: Record<string, any> = { semester: sem };
      yearsList.forEach((yr, yIdx) => {
        const key = `Year${4 - yIdx}`;
        const yrDigit = yr.slice(0, 1);
        const yearStuds = mergedStudentDataset.filter(
          (s) => (s.year === yr || s.year?.startsWith(yrDigit)) && s.semGpas && s.semGpas[sIdx] !== undefined
        );
        if (yearStuds.length > 0) {
          const avg = yearStuds.reduce((acc, curr) => acc + (curr.semGpas[sIdx] || curr.cgpa || 0), 0) / yearStuds.length;
          entry[key] = Number(avg.toFixed(2));
        } else {
          entry[key] = null;
        }
      });
      return entry;
    });
  }, [mergedStudentDataset]);

  // Fetch real academic records for the selected year batch (Analytics tab)
  useEffect(() => {
    if (activeTab !== 'analytics') return;
    if (progressionCache[progressionYear] !== undefined) return; // already fetched
    if (mergedStudentDataset.length === 0) return; // wait for student list

    const yr = progressionYear; // capture for async closure
    const yrDigit = yr.slice(0, 1);
    const studentsInYear = mergedStudentDataset
      .filter((s) => s.year === yr || s.year?.startsWith(yrDigit))
      .slice(0, 60); // cap at 60 to avoid overwhelming the API

    // Set sentinel immediately to block concurrent fetches
    setProgressionCache((prev) => ({ ...prev, [yr]: [] }));
    setProgressionLoading(true);

    if (studentsInYear.length === 0) {
      setProgressionLoading(false);
      return;
    }

    Promise.allSettled(studentsInYear.map((s) => api.getAcademics(s.regNo)))
      .then((results) => {
        const allRecords: AcademicRecord[] = [];
        results.forEach((r) => {
          if (r.status === 'fulfilled') allRecords.push(...r.value);
        });

        // Average GPA per semester number
        const semMap: Record<number, number[]> = {};
        allRecords.forEach((rec) => {
          if (!semMap[rec.semester]) semMap[rec.semester] = [];
          semMap[rec.semester].push(Number(rec.semester_gpa));
        });

        const data = Object.entries(semMap)
          .sort(([a], [b]) => Number(a) - Number(b))
          .filter(([sem]) => {
            // Only show semesters valid for the selected year
            const maxSemByYear: Record<string, number> = {
              '1st Year': 2,
              '2nd Year': 4,
              '3rd Year': 6,
              '4th Year': 8,
            };
            return Number(sem) <= (maxSemByYear[yr] ?? 8);
          })
          .map(([sem, gpas]) => ({
            semester: `Sem ${sem}`,
            avg: Number((gpas.reduce((s, g) => s + g, 0) / gpas.length).toFixed(2)),
          }));

        setProgressionCache((prev) => ({ ...prev, [yr]: data }));
        setProgressionLoading(false);
      });
  }, [progressionYear, activeTab, mergedStudentDataset]);

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
    // Use real academic records sorted by semester number
    if (inspectStudentAcademics.length > 0) {
      const sorted = [...inspectStudentAcademics].sort((a, b) => a.semester - b.semester);
      return sorted.map((rec, idx) => {
        const prevGpa = idx > 0 ? sorted[idx - 1].semester_gpa : null;
        const delta = prevGpa !== null ? Number((rec.semester_gpa - prevGpa).toFixed(2)) : 0;
        return {
          semester: `Sem ${rec.semester}`,
          gpa: Number(rec.semester_gpa),
          delta,
          attendance: Number(rec.attendance_pct ?? 0),
        };
      });
    }
    // No academic records saved yet — show empty chart
    const fallbackGpa = inspectStudent.cgpa > 0 ? inspectStudent.cgpa : 0;
    return fallbackGpa > 0
      ? [{ semester: 'Sem 1', gpa: fallbackGpa, delta: 0, attendance: 0 }]
      : [];
  }, [inspectStudent, inspectStudentAcademics]);

  const studentGrowthMetrics = useMemo(() => {
    if (!inspectStudent || studentGraphData.length === 0) return { firstSem: 0, latestSem: 0, growth: 0 };
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
      'CSE(Data Science)',
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
            <h1 className="text-xl font-bold text-textPrimary tracking-tight">HOD CSE(Data Science) Executive Dashboard</h1>
            <p className="text-xs text-textSecondary">Real-time academic performance, student growth analytics, and directory</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 shrink-0 self-start md:self-auto">
          <button
            onClick={handleForceCronSync}
            disabled={syncingCron}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-background border border-borderLine text-textPrimary text-xs font-bold shadow-sm hover:bg-surface transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-brand-primary ${syncingCron ? 'animate-spin' : ''}`} />
            <span>{syncingCron ? 'Syncing...' : 'Sync Live Stats'}</span>
          </button>

          <button
            onClick={() => setShowBulkImportModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-background border border-borderLine text-textPrimary text-xs font-bold shadow-sm hover:bg-surface transition-all"
          >
            <Upload className="w-3.5 h-3.5 text-brand-primary" />
            <span>Bulk Import CSV</span>
          </button>

          <button
            onClick={exportAnalyticsReport}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold shadow-sm hover:bg-brand-primary/90 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Export Department Report (CSV)</span>
          </button>
        </div>
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
          { key: 'placement', label: '🎯 Placement Eligibility Engine (T&P)' },
          { key: 'students', label: '👨‍🎓 Student Directory & Inspection' },
          { key: 'rankings', label: '🏆 Department Leaderboard' },
          { key: 'settings', label: '⚙️ Account Settings' },
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

      {/* ── TAB: Placement Eligibility Engine ── */}
      {activeTab === 'placement' && (
        <PlacementEligibilitySection students={mergedStudentDataset} />
      )}

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
                  {yearCgpaSummary.map((y) => (
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
            {/* Semester-Wise CGPA Progression — Year Selector */}
            <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-sm">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-textPrimary">Semester-Wise CGPA Progression</h3>
                    <p className="text-xs text-textSecondary">Avg GPA per semester for the selected year batch</p>
                  </div>
                  {progressionLoading && (
                    <RefreshCw className="w-4 h-4 text-brand-primary animate-spin shrink-0" />
                  )}
                </div>
                {/* Year Tab Pills */}
                <div className="flex gap-1.5 flex-wrap">
                  {['1st Year', '2nd Year', '3rd Year', '4th Year'].map((yr) => (
                    <button
                      key={yr}
                      onClick={() => setProgressionYear(yr)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                        progressionYear === yr
                          ? 'bg-brand-primary text-white shadow-sm'
                          : 'bg-background border border-borderLine text-textSecondary hover:text-textPrimary'
                      }`}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-52 w-full">
                {progressionLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-textSecondary">Fetching academic records for {progressionYear}...</p>
                    </div>
                  </div>
                ) : (progressionCache[progressionYear]?.length ?? 0) === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-xs text-textSecondary">No academic records found for {progressionYear}. Students can add semester GPAs in their Academic profile.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={progressionCache[progressionYear]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="progGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="semester" stroke="#6b7280" fontSize={11} />
                      <YAxis domain={['auto', 'auto']} stroke="#6b7280" fontSize={11} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                        formatter={(value: any) => [`${value} GPA`, `${progressionYear} Avg`]}
                      />
                      <Area
                        type="monotone"
                        dataKey="avg"
                        name="Avg GPA"
                        stroke="#4F46E5"
                        strokeWidth={2.5}
                        fill="url(#progGradient)"
                        dot={{ r: 5, fill: '#4F46E5', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Year-Wise LeetCode Problems Solved */}
            <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-textPrimary">Year-Wise LeetCode Problems Solved</h3>
                <p className="text-xs text-textSecondary">Average solved vs top solver per academic year (linked students only)</p>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearLeetCodeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="year" stroke="#6b7280" fontSize={11} />
                    <YAxis stroke="#6b7280" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                      formatter={(value: any, name: string) => [value + ' problems', name]}
                      labelFormatter={(label) => `${label} Year`}
                    />
                    <Legend />
                    <Bar dataKey="avgSolved" name="Avg Solved" fill="#FFA116" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="topSolver" name="Top Solver" fill="#4F46E5" radius={[6, 6, 0, 0]} />
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
                      <td className="py-3 px-4 font-black text-brand-primary">{s.cgpa > 0 ? `${s.cgpa} CGPA` : <span className="text-textSecondary italic text-xs font-normal">N/A</span>}</td>
                      <td className="py-3 px-4 text-xs font-bold text-[#FFA116]">
                        {s.isLcLinked ? (
                          s.leetcode > 0 ? `${s.leetcode} Solved` : `Linked`
                        ) : (
                          <span className="text-textSecondary font-semibold px-2 py-0.5 rounded-md bg-background border border-borderLine">Not Linked</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-textSecondary font-medium">
                        {s.isGhLinked ? (
                          s.github > 0 ? `${s.github} Repos` : `Linked`
                        ) : (
                          <span className="text-textSecondary font-semibold px-2 py-0.5 rounded-md bg-background border border-borderLine">Not Linked</span>
                        )}
                      </td>
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
              {filteredDataset.filter((s) => s.cgpa > 0).length === 0 ? (
                <div className="p-4 text-center text-xs text-textSecondary bg-background rounded-xl border border-borderLine">
                  No academic CGPA records published yet.
                </div>
              ) : (
                [...filteredDataset]
                  .filter((s) => s.cgpa > 0)
                  .sort((a, b) => b.cgpa - a.cgpa)
                  .slice(0, 5)
                  .map((s, idx) => (
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
                  ))
              )}
            </div>
          </div>

          {/* Coding Leaderboard */}
          <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-[#FFA116]" />
              <h3 className="text-base font-bold text-textPrimary">Top Coding Rankers (LeetCode)</h3>
            </div>
            <div className="space-y-3">
              {[...filteredDataset]
                .sort((a, b) => {
                  if (a.isLcLinked && !b.isLcLinked) return -1;
                  if (!a.isLcLinked && b.isLcLinked) return 1;
                  return b.leetcode - a.leetcode;
                })
                .slice(0, 5)
                .map((s, idx) => (
                  <div key={s.regNo} className="p-3.5 rounded-xl bg-background border border-borderLine flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full font-black text-xs flex items-center justify-center ${
                        idx === 0 && s.isLcLinked ? 'bg-amber-100 text-amber-700' : 'bg-brand-soft text-brand-primary'
                      }`}>
                        #{idx + 1}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-textPrimary">{s.name}</p>
                        <p className="text-[11px] text-textSecondary">{s.regNo} • {s.section}</p>
                      </div>
                    </div>
                    {s.isLcLinked && s.leetcode > 0 ? (
                      <span className="text-sm font-black text-[#FFA116]">{s.leetcode} Solved</span>
                    ) : (
                      <span className="text-xs font-semibold text-textSecondary bg-surface border border-borderLine px-2.5 py-1 rounded-lg">
                        Not Linked
                      </span>
                    )}
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
                <span className={`text-xs font-bold flex items-center gap-1 ${studentGrowthMetrics.growth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {studentGrowthMetrics.growth >= 0
                    ? <ArrowUpRight className="w-4 h-4" />
                    : <ArrowDownRight className="w-4 h-4" />
                  }
                  {studentGrowthMetrics.growth >= 0 ? '+' : ''}{studentGrowthMetrics.growth} GPA
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
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.gpa >= 5.0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                                {row.gpa >= 5.0 ? 'Passed' : 'Failed'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {inspectTab === 'personal-info' && (
                inspectProfileLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-textSecondary">Loading profile data...</p>
                    </div>
                  </div>
                ) : (
                  <PersonalInfoTab
                    readOnly={true}
                    student={inspectStudentFullProfile || {
                      roll_number: inspectStudent.regNo,
                      name: inspectStudent.name,
                      email: inspectStudent.email,
                      year: inspectStudent.year as any,
                      department: 'CSE(Data Science)',
                      batch: '',
                      section: inspectStudent.section,
                      hostel_day_scholar: 'Day Scholar' as any,
                      driving_license: false,
                      passport: false,
                      relocation_willingness: false,
                    }}
                    onRefresh={() => {}}
                  />
                )
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

              {inspectTab === 'tech-skills' && <TechSkillsTab readOnly={true} skills={inspectStudentTechSkills} onRefresh={() => {}} />}
              {inspectTab === 'certifications' && <CertificationsTab readOnly={true} certifications={inspectStudentCerts} onRefresh={() => {}} />}
              {inspectTab === 'soft-skills' && <SoftSkillsTab readOnly={true} softSkills={inspectStudentSoftSkills} onRefresh={() => {}} />}
              {inspectTab === 'achievements' && <AchievementsTab readOnly={true} achievements={inspectStudentAchievements} onRefresh={() => {}} />}
              {inspectTab === 'academic-goals' && <PlacementPreferencesTab readOnly={true} placement={inspectStudentPlacement} scoreData={null} onRefresh={() => {}} />}
            </div>
          </div>
        </div>
      )}
      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        onSuccess={refetch}
      />

      {/* ── TAB: Account Settings ── */}
      {activeTab === 'settings' && (
        <div className="space-y-6">

          {/* ── Semester Entry Control Panel ── */}
          <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-textPrimary">Semester Entry Control</h3>
                <p className="text-xs text-textSecondary">Control which semesters students can fill their SGPA for. Click +1 or +2 to unlock the next semester(s).</p>
              </div>
            </div>
            <div className="space-y-3">
              {([
                { year: '1st Year', color: 'bg-purple-100 text-purple-700 border-purple-200', max: 2 },
                { year: '2nd Year', color: 'bg-amber-100 text-amber-700 border-amber-200', max: 4 },
                { year: '3rd Year', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', max: 6 },
                { year: '4th Year', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', max: 8 },
              ] as const).map(({ year, color, max }) => {
                const setting = unlockSettings.find(s => s.year_label === year);
                const current = setting?.max_semester ?? 0;
                const isSaving = unlockSavingYear === year;
                const handleUnlock = async (delta: 1 | 2) => {
                  const newMax = Math.min(current + delta, 8);
                  if (newMax === current) return;
                  setUnlockSavingYear(year);
                  try {
                    const updated = await api.updateSemesterUnlock(year, newMax);
                    setUnlockSettings(prev => prev.map(s =>
                      s.year_label === year ? { ...s, max_semester: updated.max_semester } : s
                    ));
                  } catch (e: any) {
                    alert('Failed to update: ' + e.message);
                  } finally {
                    setUnlockSavingYear(null);
                  }
                };
                return (
                  <div key={year} className="flex items-center justify-between p-3.5 rounded-xl bg-background border border-borderLine">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${color}`}>{year}</span>
                      <span className="text-sm text-textPrimary">
                        {current === 0 ? (
                          <span className="text-textSecondary italic">No semesters open</span>
                        ) : (
                          <>Sem 1 – Sem <span className="font-bold text-brand-primary">{current}</span> unlocked</>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSaving ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-brand-primary" />
                      ) : (
                        <>
                          <button
                            onClick={() => handleUnlock(1)}
                            disabled={current >= 8}
                            className="px-3 py-1 text-xs font-bold rounded-lg bg-brand-primary/10 text-brand-primary border border-brand-primary/20 hover:bg-brand-primary hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            +1 Sem
                          </button>
                          <button
                            onClick={() => handleUnlock(2)}
                            disabled={current >= 8}
                            className="px-3 py-1 text-xs font-bold rounded-lg bg-brand-primary/10 text-brand-primary border border-brand-primary/20 hover:bg-brand-primary hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            +2 Sem
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-sm max-w-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-textPrimary">HOD Account Settings</h3>
                <p className="text-xs text-textSecondary">Update your login email and/or password. Your current password is required to save changes.</p>
              </div>
            </div>

            {/* Inline feedback */}
            {settingsMessage && (
              <div className={`mb-5 flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm ${
                settingsMessage.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {settingsMessage.type === 'success'
                  ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                }
                <span className="font-medium">{settingsMessage.text}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* New Email */}
              <div>
                <label className="block text-xs font-semibold text-textPrimary mb-1.5">
                  <Mail className="w-3.5 h-3.5 inline mr-1 text-brand-primary" />
                  New Login Email <span className="text-textSecondary font-normal">(leave blank to keep current)</span>
                </label>
                <input
                  type="email"
                  value={settingsNewEmail}
                  onChange={(e) => setSettingsNewEmail(e.target.value)}
                  placeholder="e.g. newhod@rgmcet.edu.in"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-textPrimary mb-1.5">
                  <Lock className="w-3.5 h-3.5 inline mr-1 text-brand-primary" />
                  New Password <span className="text-textSecondary font-normal">(leave blank to keep current)</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPwd ? 'text' : 'password'}
                    value={settingsNewPassword}
                    onChange={(e) => setSettingsNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full px-3.5 py-2 pr-10 text-sm rounded-xl border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                  <button type="button" onClick={() => setShowNewPwd(!showNewPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary">
                    {showNewPwd ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              {settingsNewPassword && (
                <div>
                  <label className="block text-xs font-semibold text-textPrimary mb-1.5">Confirm New Password</label>
                  <input
                    type="password"
                    value={settingsConfirmPassword}
                    onChange={(e) => setSettingsConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                  {settingsConfirmPassword && settingsNewPassword !== settingsConfirmPassword && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>
              )}

              {/* Divider */}
              <div className="border-t border-borderLine pt-4">
                <label className="block text-xs font-semibold text-textPrimary mb-1.5">
                  <KeyRound className="w-3.5 h-3.5 inline mr-1 text-amber-500" />
                  Current Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showSettingsPwd ? 'text' : 'password'}
                    value={settingsCurrentPassword}
                    onChange={(e) => setSettingsCurrentPassword(e.target.value)}
                    placeholder="Enter your current password to confirm"
                    className="w-full px-3.5 py-2 pr-10 text-sm rounded-xl border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                  <button type="button" onClick={() => setShowSettingsPwd(!showSettingsPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary">
                    {showSettingsPwd ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={async () => {
                  setSettingsMessage(null);
                  if (!settingsCurrentPassword) {
                    setSettingsMessage({ type: 'error', text: 'Current password is required.' });
                    return;
                  }
                  if (!settingsNewEmail && !settingsNewPassword) {
                    setSettingsMessage({ type: 'error', text: 'Please enter a new email or new password to update.' });
                    return;
                  }
                  if (settingsNewPassword && settingsNewPassword !== settingsConfirmPassword) {
                    setSettingsMessage({ type: 'error', text: 'New passwords do not match.' });
                    return;
                  }
                  if (settingsNewPassword && settingsNewPassword.length < 6) {
                    setSettingsMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
                    return;
                  }
                  setSettingsSaving(true);
                  try {
                    const result = await api.updateHodCredentials(
                      settingsCurrentPassword,
                      settingsNewEmail || undefined,
                      settingsNewPassword || undefined,
                    );
                    setSettingsMessage({ type: 'success', text: `Credentials updated! New login email: ${result.email}` });
                    setSettingsCurrentPassword('');
                    setSettingsNewEmail('');
                    setSettingsNewPassword('');
                    setSettingsConfirmPassword('');
                  } catch (err: any) {
                    setSettingsMessage({ type: 'error', text: err.message || 'Failed to update credentials.' });
                  } finally {
                    setSettingsSaving(false);
                  }
                }}
                disabled={settingsSaving}
                className="w-full py-2.5 rounded-xl bg-brand-primary text-white text-sm font-bold hover:bg-brand-primary/90 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
              >
                {settingsSaving ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <><Settings className="w-4 h-4" /> Save Credential Changes</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
