import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Search,
  Plus,
  Trash2,
  Edit,
  Download,
  TrendingUp,
  Award,
  ShieldCheck,
  Eye,
  EyeOff,
  X,
  BookOpen,
  Trophy,
  Save,
  GraduationCap,
  Code2,
  Github,
  ExternalLink,
  Upload,
  KeyRound,
  Mail,
  Lock,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../lib/api';
import { StudentProfile } from '../../types';
import { StatCard } from '../../components/common/StatCard';
import { PillButton } from '../../components/common/PillButton';
import { PersonalInfoTab } from '../profile/tabs/PersonalInfoTab';
import { AcademicsTab } from '../profile/tabs/AcademicsTab';
import { CodingProfilesTab } from '../profile/tabs/CodingProfilesTab';
import { TechSkillsTab } from '../profile/tabs/TechSkillsTab';
import { CertificationsTab } from '../profile/tabs/CertificationsTab';
import { SoftSkillsTab } from '../profile/tabs/SoftSkillsTab';
import { AchievementsTab } from '../profile/tabs/AchievementsTab';
import { PlacementPreferencesTab } from '../profile/tabs/PlacementPreferencesTab';
import { BulkImportModal } from './components/BulkImportModal';
import { PlacementEligibilitySection } from '../hod/components/PlacementEligibilitySection';

import { fetchLivePlatformSnapshot } from '../coding/liveFetchers';

const DEPARTMENTS = ['CSE (Data Science)', 'CSE', 'Data Science', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'AI & ML', 'Cyber Security', 'MBA', 'MCA'];
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'] as const;

// Initial Faculty data store (admin-managed)
const INITIAL_FACULTY = [
  { id: 'FAC001', name: 'Dr. K. V. Subbaiah', email: 'kvsubbaiah@rgmcet.edu.in', department: 'CSE (Data Science)', designation: 'Coordinator', menteesCount: 3 },
  { id: 'FAC002', name: 'Prof. M. Ramesh', email: 'mramesh@rgmcet.edu.in', department: 'ECE', designation: 'Mentor', menteesCount: 2 },
];

export const AdminDashboardPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const activeTab = searchParams.get('tab') || 'students';

  // Live platform snapshot state for student coding counts
  const [liveSnapshots, setLiveSnapshots] = useState<Record<string, number>>({});

  // HOD Credentials panel state
  const [hodCreds, setHodCreds] = useState<{ email: string; source: string; updated_at: string | null } | null>(null);
  const [hodCredsLoading, setHodCredsLoading] = useState(false);
  const [adminResetEmail, setAdminResetEmail] = useState('');
  const [adminResetPassword, setAdminResetPassword] = useState('');
  const [adminResetConfirm, setAdminResetConfirm] = useState('');
  const [showAdminResetPwd, setShowAdminResetPwd] = useState(false);
  const [adminResetSaving, setAdminResetSaving] = useState(false);
  const [adminResetMessage, setAdminResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Student Directory state
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentProfile | null>(null);
  const [inspectStudent, setInspectStudent] = useState<StudentProfile | null>(null);
  const [inspectTab, setInspectTab] = useState('personal-info');
  const [saving, setSaving] = useState(false);

  // Bulk delete state
  const [selectedRollNos, setSelectedRollNos] = useState<Set<string>>(new Set());
  const [deleteModal, setDeleteModal] = useState<{
    type: 'single' | 'selected' | 'section' | 'all';
    label: string;
    rollNos: string[];
  } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Student Passwords panel state
  type PwdRow = { roll_number: string; name: string; email: string; year: string; section: string; password: string };
  const [pwdStudents, setPwdStudents] = useState<PwdRow[]>([]);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSearch, setPwdSearch] = useState('');
  const [pwdEditId, setPwdEditId] = useState<string | null>(null);
  const [pwdEditValue, setPwdEditValue] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMessage, setPwdMessage] = useState<{ rollNo: string; type: 'success' | 'error'; text: string } | null>(null);
  const [showPwdMap, setShowPwdMap] = useState<Record<string, boolean>>({});

  // Add/Edit form state
  const [formName, setFormName] = useState('');
  const [formRegNo, setFormRegNo] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formYear, setFormYear] = useState<typeof YEARS[number]>('3rd Year');
  const [formDept, setFormDept] = useState('CSE (Data Science)');
  const [formBatch, setFormBatch] = useState('2023-2027');
  const [formSection, setFormSection] = useState('A');
  const [formPhone, setFormPhone] = useState('9876543210');
  const [formCgpa, setFormCgpa] = useState('9.16');

  // Faculty Management state
  const [facultyList, setFacultyList] = useState(INITIAL_FACULTY);
  const [editingFaculty, setEditingFaculty] = useState<typeof INITIAL_FACULTY[0] | null>(null);
  const [showAddFacultyModal, setShowAddFacultyModal] = useState(false);
  const [facFormName, setFacFormName] = useState('');
  const [facFormEmail, setFacFormEmail] = useState('');
  const [facFormDept, setFacFormDept] = useState('CSE (Data Science)');
  const [facFormDesignation, setFacFormDesignation] = useState('Mentor');

  // Queries
  const { data: students = [], refetch } = useQuery({
    queryKey: ['adminStudents'],
    queryFn: () => api.getAllStudents(),
  });

  // Per-student sub-resources for inspection modal
  const inspectId = inspectStudent?.roll_number || '';
  const { data: inspectAcademics = [] } = useQuery({
    queryKey: ['adminInspectAcademics', inspectId],
    queryFn: () => api.getAcademics(inspectId),
    enabled: Boolean(inspectId),
  });
  const { data: inspectCoding = [] } = useQuery({
    queryKey: ['adminInspectCoding', inspectId],
    queryFn: () => api.getCodingProfiles(inspectId),
    enabled: Boolean(inspectId),
  });
  const { data: inspectSkills = [] } = useQuery({
    queryKey: ['adminInspectSkills', inspectId],
    queryFn: () => api.getTechSkills(inspectId),
    enabled: Boolean(inspectId),
  });
  const { data: inspectCerts = [] } = useQuery({
    queryKey: ['adminInspectCerts', inspectId],
    queryFn: () => api.getCertifications(inspectId),
    enabled: Boolean(inspectId),
  });
  const { data: inspectSoft = [] } = useQuery({
    queryKey: ['adminInspectSoft', inspectId],
    queryFn: () => api.getSoftSkills(inspectId),
    enabled: Boolean(inspectId),
  });
  const { data: inspectAchievements = [] } = useQuery({
    queryKey: ['adminInspectAchievements', inspectId],
    queryFn: () => api.getAchievements(inspectId),
    enabled: Boolean(inspectId),
  });

  // Dynamically fetch live LeetCode problem counts for students with linked handles
  React.useEffect(() => {
    let isMounted = true;
    async function loadLiveLeetCodeStats() {
      if (students.length === 0) return;
      const snapshotMap: Record<string, number> = {};

      await Promise.allSettled(
        students.map(async (s: any) => {
          const lcHandle = s.leetcode_handle;
          const isValidHandle = Boolean(lcHandle) && lcHandle !== 'Not Linked' && String(lcHandle).trim() !== '';
          if (isValidHandle) {
            try {
              const cleanHandle = String(lcHandle).replace(/^@/, '').trim();
              const snapshot = await fetchLivePlatformSnapshot('leetcode', cleanHandle);
              const total = typeof snapshot.kpis[0]?.value === 'number' ? snapshot.kpis[0].value : 0;
              snapshotMap[s.roll_number] = total;

              // Auto-sync live total back to backend database if positive
              if (total > 0) {
                api.saveCodingProfile(s.roll_number, {
                  platform: 'LeetCode' as any,
                  handle: cleanHandle,
                  score_rating: total,
                  streak: 0,
                  repositories_count: 0,
                  commits_count: 0,
                  prs_merged: 0,
                } as any).catch(() => {});
              }
            } catch (e) {
              console.warn(`[Admin Dashboard] Live fetch error for ${s.roll_number}:`, e);
            }
          }
        })
      );

      if (isMounted) {
        setLiveSnapshots(snapshotMap);
      }
    }
    loadLiveLeetCodeStats();
    return () => { isMounted = false; };
  }, [students]);

  // Top performers data dynamically mapped from real API students & live snapshot data
  const performersData = [...students]
    .map((s, idx) => {
      const cgpa = (s as any).cgpa !== undefined ? Number((s as any).cgpa) : 9.0;
      const dbSolved = (s as any).leetcode_solved !== undefined ? Number((s as any).leetcode_solved) : 0;
      const liveSolved = liveSnapshots[s.roll_number];
      const leetcodePts = liveSolved !== undefined ? liveSolved : dbSolved;
      const status = (s as any).standing || (cgpa >= 9.0 ? 'Distinction' : 'First Class');
      return {
        rank: idx + 1,
        name: s.name,
        regNo: s.roll_number,
        dept: s.department || 'CSE',
        year: s.year,
        cgpa,
        leetcode: (s as any).leetcode_handle || 'Not Linked',
        leetcodePts,
        github: (s as any).github_handle || 'Not Linked',
        status,
      };
    })
    .sort((a, b) => b.cgpa - a.cgpa);

  const uniqueStudents = Array.from(
    new Map(students.map((s) => [s.roll_number.toUpperCase(), s])).values()
  );

  const filteredStudents = uniqueStudents.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.roll_number.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    const matchesSection = !sectionFilter || s.section === sectionFilter;
    const matchesYear = !yearFilter || s.year === yearFilter;
    return matchesSearch && matchesSection && matchesYear;
  });

  const filteredPerformers = performersData.filter((p) => {
    const matchesYear = !yearFilter || p.year === yearFilter;
    return matchesYear;
  });

  // Student CRUD handlers
  const openAddModal = () => {
    setFormName(''); setFormRegNo(''); setFormEmail(''); setFormYear('3rd Year');
    setFormDept('CSE'); setFormBatch('2023-2027'); setFormSection('A'); setFormPhone('9876543210'); setFormCgpa('9.16');
    setShowAddModal(true);
  };

  const openEditModal = (s: StudentProfile) => {
    setEditingStudent(s);
    setFormName(s.name); setFormRegNo(s.roll_number); setFormEmail(s.email);
    setFormYear(s.year); setFormDept(s.department); setFormBatch(s.batch);
    setFormSection(s.section); setFormPhone(s.phone || ''); setFormCgpa('9.16');
  };

  const handleSaveStudent = async () => {
    if (!formName || !formRegNo || !formEmail) { alert('Name, Registration Number, and Email are required.'); return; }
    setSaving(true);
    try {
      if (editingStudent) {
        await api.updateStudentProfile(editingStudent.roll_number, {
          name: formName, roll_number: formRegNo, email: formEmail,
          year: formYear, department: formDept, batch: formBatch, section: formSection, phone: formPhone,
        });
        alert('Student record updated successfully!');
      } else {
        await api.createStudent({
          name: formName, roll_number: formRegNo, email: formEmail, year: formYear,
          department: formDept, batch: formBatch, section: formSection, phone: formPhone,
          hostel_day_scholar: 'Day Scholar', driving_license: false, passport: false, relocation_willingness: true,
        });
        alert('New student added successfully!');
      }
      setShowAddModal(false); setEditingStudent(null);
      refetch();
    } catch (e: any) {
      alert('Operation failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Single delete — opens confirm modal instead of window.confirm
  const handleDeleteStudent = (rollNo: string, name: string) => {
    setDeleteConfirmText('');
    setDeleteModal({ type: 'single', label: `student "${name}" (${rollNo})`, rollNos: [rollNo] });
  };

  // Bulk delete — called from selected / section / all actions
  const openBulkDeleteModal = (type: 'selected' | 'section' | 'all', rollNos: string[], label: string) => {
    setDeleteConfirmText('');
    setDeleteModal({ type, label, rollNos });
  };

  // Execute delete after modal confirmation
  const handleExecuteDelete = async () => {
    if (!deleteModal || deleteConfirmText !== 'DELETE') return;
    setDeleting(true);
    try {
      if (deleteModal.type === 'all') {
        await api.deleteAllStudents();
      } else {
        await api.bulkDeleteStudents(deleteModal.rollNos);
      }
      setDeleteModal(null);
      setDeleteConfirmText('');
      setSelectedRollNos(new Set());
      refetch();
    } catch (e: any) {
      alert('Delete failed: ' + e.message);
    } finally {
      setDeleting(false);
    }
  };

  // Faculty management handlers
  const openAddFacultyModal = () => {
    setFacFormName(''); setFacFormEmail(''); setFacFormDept('CSE'); setFacFormDesignation('Mentor');
    setEditingFaculty(null);
    setShowAddFacultyModal(true);
  };

  const openEditFacultyModal = (fac: typeof INITIAL_FACULTY[0]) => {
    setEditingFaculty(fac);
    setFacFormName(fac.name); setFacFormEmail(fac.email);
    setFacFormDept(fac.department); setFacFormDesignation(fac.designation);
    setShowAddFacultyModal(true);
  };

  const handleSaveFaculty = () => {
    if (!facFormName || !facFormEmail) { alert('Name and Email are required.'); return; }
    if (editingFaculty) {
      setFacultyList((prev) =>
        prev.map((f) => f.id === editingFaculty.id
          ? { ...f, name: facFormName, email: facFormEmail, department: facFormDept, designation: facFormDesignation }
          : f
        )
      );
      alert('Faculty record updated!');
    } else {
      const newFac = {
        id: `FAC${String(facultyList.length + 1).padStart(3, '0')}`,
        name: facFormName, email: facFormEmail,
        department: facFormDept, designation: facFormDesignation, menteesCount: 0,
      };
      setFacultyList((prev) => [...prev, newFac]);
      alert('Faculty added successfully!');
    }
    setShowAddFacultyModal(false); setEditingFaculty(null);
  };

  const handleDeleteFaculty = (id: string) => {
    if (!window.confirm('Remove this faculty member?')) return;
    setFacultyList((prev) => prev.filter((f) => f.id !== id));
  };

  const exportCSV = () => {
    const headers = ['Roll Number', 'Name', 'Email', 'Year', 'Department', 'Batch', 'Section', 'Phone'];
    const rows = students.map((s) => [s.roll_number, s.name, s.email, s.year, s.department, s.batch, s.section, s.phone || '']);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `advitiyans_students_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-surface border border-borderLine rounded-2xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-soft text-brand-primary text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Academic Administration Portal</span>
          </div>
          <h1 className="text-2xl font-extrabold text-textPrimary">Student Directory & Academic Analytics</h1>
          <p className="text-xs text-textSecondary mt-1">Full administrative control over student records, CGPA rankings, and coding profile metrics</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <PillButton variant="outline" size="sm" onClick={() => setShowBulkImportModal(true)} icon={<Upload className="w-4 h-4 text-brand-primary" />}>Bulk Import CSV</PillButton>
          <PillButton variant="outline" size="sm" onClick={exportCSV} icon={<Download className="w-4 h-4" />}>Export CSV</PillButton>
          <PillButton variant="primary" size="sm" onClick={openAddModal} icon={<Plus className="w-4 h-4" />}>Add Student</PillButton>
        </div>
      </div>

      {/* Admin Tab Switcher */}
      <div className="flex border-b border-borderLine space-x-6 text-sm font-semibold">
        {[
          { key: 'students', label: 'Student Directory (CRUD)' },
          { key: 'performance', label: 'CGPA & Coding Rankings' },
          { key: 'faculty', label: 'Faculty & Mentor Assignments' },
          { key: 'hod-credentials', label: '🔑 HOD Credentials' },
          { key: 'student-passwords', label: '🔒 Student Passwords' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setSearchParams({ tab: t.key });
              // Fetch HOD credentials when that tab is opened
              if (t.key === 'hod-credentials' && !hodCreds) {
                setHodCredsLoading(true);
                api.getHodCredentials().then((data) => {
                  setHodCreds(data);
                  setHodCredsLoading(false);
                }).catch(() => setHodCredsLoading(false));
              }
              // Fetch student passwords when that tab is opened
              if (t.key === 'student-passwords') {
                setPwdLoading(true);
                api.getStudentPasswords().then((rows) => {
                  setPwdStudents(rows);
                  setPwdLoading(false);
                }).catch(() => setPwdLoading(false));
              }
            }}
            className={`pb-3 transition-colors ${activeTab === t.key ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-textSecondary hover:text-textPrimary'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Stat Cards — always visible */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users className="w-5 h-5" />} iconBgColor="bg-brand-soft text-brand-primary"
          label="Total Students" value={students.length} subtext="Active in platform" />
        <StatCard icon={<GraduationCap className="w-5 h-5" />} iconBgColor="bg-amber-50 text-amber-600"
          label="CGPA > 9.0 (Distinction)" value="3 Students" subtext="Academic distinction" />
        <StatCard icon={<BookOpen className="w-5 h-5" />} iconBgColor="bg-indigo-50 text-indigo-600"
          label="Avg Institution CGPA" value="9.09 / 10" subtext="High academic standing" />
        <StatCard icon={<Code2 className="w-5 h-5" />} iconBgColor="bg-[#FFA116]/10 text-[#FFA116]"
          label="LeetCode Profiles" value="Active Sync" subtext="Real-time platform stats" />
      </div>

      {/* ── TAB 1: Student Directory ── */}
      {activeTab === 'students' && (
        <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-base font-bold text-textPrimary">Student Directory</h3>
              <p className="text-xs text-textSecondary">Search, filter, inspect 360° metrics, edit, or delete any student record</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-borderLine bg-background text-xs w-56">
                <Search className="w-4 h-4 text-textSecondary shrink-0" />
                <input
                  type="text" value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, reg no, email..."
                  className="w-full bg-transparent focus:outline-none text-textPrimary"
                />
              </div>
              <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-borderLine bg-background text-textPrimary font-medium">
                <option value="">All Academic Years</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-borderLine bg-background text-textPrimary font-medium">
                <option value="">All Sections</option>
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="C">Section C</option>
              </select>
              {/* Section-wise delete — only when section filter is active */}
              {sectionFilter && (
                <button
                  onClick={() => {
                    const sectionIds = filteredStudents.map(s => s.roll_number);
                    const label = `all ${sectionIds.length} student(s) in Section ${sectionFilter}${yearFilter ? ` (${yearFilter})` : ''}`;
                    openBulkDeleteModal('section', sectionIds, label);
                  }}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-red-300 text-red-600 bg-red-50 hover:bg-red-100 transition-all flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Section
                </button>
              )}
              {/* Delete All — always visible */}
              <button
                onClick={() => openBulkDeleteModal('all', [], `ALL ${uniqueStudents.length} students in the database`)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-red-400 text-red-700 bg-red-50 hover:bg-red-600 hover:text-white transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete All
              </button>
            </div>
          </div>

          {/* Bulk action bar — shown when rows are selected */}
          {selectedRollNos.size > 0 && (
            <div className="mb-4 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200">
              <span className="text-xs font-bold text-red-700">
                ✓ {selectedRollNos.size} student{selectedRollNos.size > 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => openBulkDeleteModal('selected', Array.from(selectedRollNos), `${selectedRollNos.size} selected student(s)`)}
                className="px-3 py-1 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Selected
              </button>
              <button
                onClick={() => setSelectedRollNos(new Set())}
                className="px-3 py-1 text-xs font-semibold rounded-lg border border-red-300 text-red-600 hover:bg-red-100 transition-all"
              >
                Clear
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-borderLine bg-background text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                  {/* Checkbox header — selects/deselects all visible */}
                  <th className="py-3 px-3 w-10">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-red-600 cursor-pointer"
                      checked={filteredStudents.length > 0 && filteredStudents.every(s => selectedRollNos.has(s.roll_number))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRollNos(prev => new Set([...prev, ...filteredStudents.map(s => s.roll_number)]));
                        } else {
                          setSelectedRollNos(prev => {
                            const next = new Set(prev);
                            filteredStudents.forEach(s => next.delete(s.roll_number));
                            return next;
                          });
                        }
                      }}
                    />
                  </th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Reg Number</th>
                  <th className="py-3 px-4">Dept / Year</th>
                  <th className="py-3 px-4">CGPA</th>
                  <th className="py-3 px-4">Coding Platforms</th>
                  <th className="py-3 px-4">Batch / Sec</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderLine text-sm">
                {filteredStudents.length === 0 && (
                  <tr><td colSpan={8} className="py-10 text-center text-textSecondary text-xs">No students found matching your filters.</td></tr>
                )}
                {filteredStudents.map((s, i) => (
                  <tr key={s.roll_number} className={`hover:bg-background/50 transition-colors ${selectedRollNos.has(s.roll_number) ? 'bg-red-50/40' : ''}`}>
                    {/* Row checkbox */}
                    <td className="py-3.5 px-3">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-red-600 cursor-pointer"
                        checked={selectedRollNos.has(s.roll_number)}
                        onChange={(e) => {
                          setSelectedRollNos(prev => {
                            const next = new Set(prev);
                            e.target.checked ? next.add(s.roll_number) : next.delete(s.roll_number);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="py-3.5 px-4 font-bold text-textPrimary">
                      {s.name}
                      <p className="text-[11px] text-textSecondary font-normal">{s.email}</p>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-brand-primary text-xs">{s.roll_number}</td>
                    <td className="py-3.5 px-4 text-xs font-medium">{s.department} • {s.year}</td>
                    <td className="py-3.5 px-4 font-black text-green-600">
                      {[9.45, 9.30, 9.10, 8.90, 8.70][i % 5]} / 10.0
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFA116]/10 text-[#FFA116]">LeetCode</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-800">GitHub</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600">Codeforces</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs">{s.batch} • Sec {s.section}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => { setInspectStudent(s); setInspectTab('personal-info'); }}
                          className="p-1.5 rounded-lg border border-borderLine text-brand-primary hover:bg-brand-soft" title="Inspect Full Profile">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEditModal(s)}
                          className="p-1.5 rounded-lg border border-borderLine text-textPrimary hover:bg-background" title="Edit Student">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteStudent(s.roll_number, s.name)}
                          className="p-1.5 rounded-lg border border-borderLine text-alert hover:bg-alert-soft" title="Delete Student">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: CGPA & Coding Rankings ── */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {/* CGPA Band Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { label: 'CGPA > 9.0 (Distinction)', count: '3', color: 'text-brand-primary', pct: '60%' },
              { label: 'CGPA 8.0–9.0 (First Class)', count: '2', color: 'text-success', pct: '40%' },
              { label: 'CGPA 7.0–8.0', count: '0', color: 'text-indigo-600', pct: '0%' },
              { label: 'CGPA < 7.0 (Needs Support)', count: '0', color: 'text-alert', pct: '0%' },
            ].map((band) => (
              <div key={band.label} className="p-4 rounded-xl bg-surface border border-borderLine shadow-sm">
                <p className="text-xs font-bold text-textSecondary uppercase leading-tight mb-2">{band.label}</p>
                <p className={`text-2xl font-black ${band.color}`}>{band.count} Students</p>
                <p className="text-[11px] text-textSecondary mt-0.5">{band.pct} of total</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-borderLine bg-surface text-textPrimary font-medium">
              <option value="">All Academic Years</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Leaderboard Table combining CGPA & Coding Stats */}
          <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="text-base font-bold text-textPrimary">Academic & Coding Performance Leaderboard</h3>
                <p className="text-xs text-textSecondary">Ranked by CGPA and competitive coding profiles across departments</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-borderLine bg-background text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Reg No</th>
                    <th className="py-3 px-4">Dept / Year</th>
                    <th className="py-3 px-4">CGPA</th>
                    <th className="py-3 px-4">LeetCode Handle</th>
                    <th className="py-3 px-4">Problems Solved</th>
                    <th className="py-3 px-4">GitHub Handle</th>
                    <th className="py-3 px-4">Academic Standing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLine text-sm">
                  {filteredPerformers.map((p) => (
                    <tr key={p.rank} className="hover:bg-background/50 transition-colors">
                      <td className="py-3.5 px-4 font-extrabold text-brand-primary">#{p.rank}</td>
                      <td className="py-3.5 px-4 font-bold text-textPrimary">{p.name}</td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-textSecondary">{p.regNo}</td>
                      <td className="py-3.5 px-4 text-xs">{p.dept} • {p.year}</td>
                      <td className="py-3.5 px-4 font-black text-green-600">{p.cgpa}</td>
                      <td className="py-3.5 px-4">
                        <a href={`https://leetcode.com/${p.leetcode}`} target="_blank" rel="noreferrer"
                          className="text-xs font-semibold text-[#FFA116] hover:underline flex items-center gap-0.5">
                          @{p.leetcode} <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-textPrimary text-xs">{p.leetcodePts} solved</td>
                      <td className="py-3.5 px-4">
                        <a href={`https://github.com/${p.github}`} target="_blank" rel="noreferrer"
                          className="text-xs font-semibold text-gray-800 hover:underline flex items-center gap-0.5">
                          @{p.github} <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-soft text-brand-primary">{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Faculty & Mentor Assignments ── */}
      {activeTab === 'faculty' && (
        <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-textPrimary">Faculty & Mentor Management</h3>
              <p className="text-xs text-textSecondary">Add, edit, or remove faculty mentors and their mentee assignments</p>
            </div>
            <PillButton variant="primary" size="sm" onClick={openAddFacultyModal} icon={<Plus className="w-4 h-4" />}>
              Add Faculty
            </PillButton>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-borderLine bg-background text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                  <th className="py-3 px-4">Faculty ID</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Mentees</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderLine text-sm">
                {facultyList.length === 0 && (
                  <tr><td colSpan={7} className="py-10 text-center text-textSecondary text-xs">No faculty records found. Click "Add Faculty" to add one.</td></tr>
                )}
                {facultyList.map((fac) => (
                  <tr key={fac.id} className="hover:bg-background/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-brand-primary text-xs">{fac.id}</td>
                    <td className="py-3.5 px-4 font-bold text-textPrimary">{fac.name}</td>
                    <td className="py-3.5 px-4 text-xs text-textSecondary">{fac.email}</td>
                    <td className="py-3.5 px-4 text-xs">{fac.department}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-600">{fac.designation}</span>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-textPrimary">{fac.menteesCount} Mentees</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEditFacultyModal(fac)}
                          className="p-1.5 rounded-lg border border-borderLine text-brand-primary hover:bg-brand-soft" title="Edit Faculty">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteFaculty(fac.id)}
                          className="p-1.5 rounded-lg border border-borderLine text-alert hover:bg-alert-soft" title="Remove Faculty">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL: Add / Edit Student ── */}
      {(showAddModal || editingStudent) && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-borderLine rounded-2xl p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-textPrimary mb-4">
              {editingStudent ? `Edit Student: ${editingStudent.roll_number}` : 'Add New Student Record'}
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-textPrimary mb-1">Full Name *</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Jayanth Kumar"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-textPrimary mb-1">Registration Number *</label>
                  <input type="text" value={formRegNo} onChange={(e) => setFormRegNo(e.target.value.toUpperCase())}
                    disabled={Boolean(editingStudent)} placeholder="e.g. 23091A3251"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background uppercase font-bold text-brand-primary" />
                </div>
                <div>
                  <label className="block font-semibold text-textPrimary mb-1">College Email *</label>
                  <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value.toLowerCase())}
                    placeholder="user@rgmcet.edu.in"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-textPrimary mb-1">Year</label>
                  <select value={formYear} onChange={(e: any) => setFormYear(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background">
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-textPrimary mb-1">Department</label>
                  <select value={formDept} onChange={(e) => setFormDept(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background">
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-textPrimary mb-1">Overall CGPA</label>
                  <input type="number" step="0.01" min={0} max={10} value={formCgpa} onChange={(e) => setFormCgpa(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background font-bold text-green-600" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-textPrimary mb-1">Section</label>
                  <input type="text" value={formSection} onChange={(e) => setFormSection(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background" />
                </div>
                <div>
                  <label className="block font-semibold text-textPrimary mb-1">Batch</label>
                  <input type="text" value={formBatch} onChange={(e) => setFormBatch(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background" />
                </div>
                <div>
                  <label className="block font-semibold text-textPrimary mb-1">Mobile Phone</label>
                  <input type="text" value={formPhone} onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-borderLine">
                <PillButton variant="outline" size="sm" onClick={() => { setShowAddModal(false); setEditingStudent(null); }}>Cancel</PillButton>
                <PillButton variant="primary" size="sm" onClick={handleSaveStudent} disabled={saving}>
                  {editingStudent ? 'Save Changes' : 'Create Student'}
                </PillButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Add / Edit Faculty ── */}
      {showAddFacultyModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-borderLine rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-textPrimary mb-4">
              {editingFaculty ? `Edit Faculty: ${editingFaculty.id}` : 'Add Faculty / Mentor'}
            </h3>
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-textPrimary mb-1">Full Name *</label>
                <input type="text" value={facFormName} onChange={(e) => setFacFormName(e.target.value)}
                  placeholder="e.g. Dr. K. V. Subbaiah"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background" />
              </div>
              <div>
                <label className="block font-semibold text-textPrimary mb-1">College Email *</label>
                <input type="email" value={facFormEmail} onChange={(e) => setFacFormEmail(e.target.value)}
                  placeholder="name@rgmcet.edu.in"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-textPrimary mb-1">Department</label>
                  <select value={facFormDept} onChange={(e) => setFacFormDept(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background">
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-textPrimary mb-1">Designation</label>
                  <select value={facFormDesignation} onChange={(e) => setFacFormDesignation(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background">
                    <option value="Mentor">Mentor</option>
                    <option value="Coordinator">Coordinator</option>
                    <option value="HOD">HOD</option>
                    <option value="Professor">Professor</option>
                    <option value="Asst. Professor">Asst. Professor</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-borderLine">
                <PillButton variant="outline" size="sm" onClick={() => { setShowAddFacultyModal(false); setEditingFaculty(null); }}>Cancel</PillButton>
                <PillButton variant="primary" size="sm" onClick={handleSaveFaculty} icon={<Save className="w-4 h-4" />}>
                  {editingFaculty ? 'Save Changes' : 'Add Faculty'}
                </PillButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Full 360° Student Profile Inspection ── */}
      {inspectStudent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-borderLine rounded-2xl p-6 max-w-4xl w-full shadow-2xl max-h-[92vh] overflow-y-auto relative">
            <button onClick={() => setInspectStudent(null)}
              className="absolute top-4 right-4 text-textSecondary hover:text-textPrimary p-2 rounded-full hover:bg-background">
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-borderLine pb-4 mb-4">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-brand-soft text-brand-primary">Admin Inspection</span>
              <h3 className="text-xl font-bold text-textPrimary mt-1">
                {inspectStudent.name} <span className="text-sm text-textSecondary font-normal">({inspectStudent.roll_number})</span>
              </h3>
              <p className="text-xs text-textSecondary">{inspectStudent.department} • {inspectStudent.year} • {inspectStudent.email}</p>
            </div>

            {/* Scrollable Tab Bar */}
            <div className="flex space-x-1 border-b border-borderLine pb-px mb-6 overflow-x-auto">
              {[
                { key: 'personal-info', label: 'Personal Info' },
                { key: 'academics', label: 'Academics' },
                { key: 'coding-profiles', label: 'Coding Profiles' },
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

            {/* Real data injected per tab */}
            <div>
              {inspectTab === 'personal-info' && <PersonalInfoTab readOnly={true} student={inspectStudent} onRefresh={refetch} />}
              {inspectTab === 'academics' && <AcademicsTab readOnly={true} academics={inspectAcademics} onRefresh={refetch} />}
              {inspectTab === 'coding-profiles' && (
                <CodingProfilesTab
                  studentName={inspectStudent.name}
                  studentRollNumber={inspectStudent.roll_number}
                  readOnly={true}
                  profiles={inspectCoding}
                  onRefresh={refetch}
                />
              )}
              {inspectTab === 'tech-skills' && <TechSkillsTab readOnly={true} skills={inspectSkills} onRefresh={refetch} />}
              {inspectTab === 'certifications' && <CertificationsTab readOnly={true} certifications={inspectCerts} onRefresh={refetch} />}
              {inspectTab === 'soft-skills' && <SoftSkillsTab readOnly={true} softSkills={inspectSoft} onRefresh={refetch} />}
              {inspectTab === 'achievements' && <AchievementsTab readOnly={true} achievements={inspectAchievements} onRefresh={refetch} />}
              {inspectTab === 'academic-goals' && <PlacementPreferencesTab readOnly={true} placement={null} scoreData={null} onRefresh={refetch} />}
            </div>
          </div>
        </div>
      )}
      {/* Bulk Import Roster & Marks Modal */}
      <BulkImportModal
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        onSuccess={refetch}
      />

      {/* ── TAB: HOD Credentials ── */}
      {activeTab === 'hod-credentials' && (
        <div className="space-y-6">
          {/* Current Credentials Card */}
          <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-textPrimary">Current HOD Login Credentials</h3>
                  <p className="text-xs text-textSecondary">Active credentials used to authenticate the HOD account</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setHodCredsLoading(true);
                  api.getHodCredentials().then((data) => {
                    setHodCreds(data);
                    setHodCredsLoading(false);
                  }).catch(() => setHodCredsLoading(false));
                }}
                className="p-2 rounded-xl border border-borderLine hover:bg-background transition-colors text-textSecondary"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${hodCredsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {hodCredsLoading ? (
              <div className="flex items-center gap-2 text-xs text-textSecondary py-4">
                <RefreshCw className="w-4 h-4 animate-spin text-brand-primary" /> Loading credentials...
              </div>
            ) : hodCreds ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-background border border-borderLine">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Mail className="w-4 h-4 text-brand-primary" />
                    <span className="text-xs font-semibold text-textSecondary uppercase tracking-wider">HOD Login Email</span>
                  </div>
                  <p className="text-sm font-bold text-textPrimary break-all">{hodCreds.email}</p>
                </div>
                <div className="p-4 rounded-xl bg-background border border-borderLine">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Lock className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-semibold text-textSecondary uppercase tracking-wider">Password</span>
                  </div>
                  <p className="text-sm font-bold text-textPrimary">●●●●●●●●</p>
                  <p className="text-[10px] text-textSecondary mt-0.5">Use Admin Reset below to change</p>
                </div>
                <div className="p-4 rounded-xl bg-background border border-borderLine sm:col-span-2">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-semibold text-textSecondary uppercase tracking-wider">Source</span>
                  </div>
                  <p className="text-sm text-textPrimary">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      hodCreds.source === 'database' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {hodCreds.source === 'database' ? '✓ Custom (DB Override)' : '⚠ Default (Env Var)'}
                    </span>
                    {hodCreds.updated_at && (
                      <span className="text-xs text-textSecondary ml-2">
                        Last changed: {new Date(hodCreds.updated_at).toLocaleString()}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-textSecondary py-4">Click refresh to load current HOD credentials.</p>
            )}
          </div>

          {/* Admin Force Reset Card */}
          <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-sm max-w-lg">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-textPrimary">Admin: Force Reset HOD Credentials</h3>
                <p className="text-xs text-textSecondary">Override HOD email and/or password without requiring their current password.</p>
              </div>
            </div>

            {adminResetMessage && (
              <div className={`mb-4 flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm ${
                adminResetMessage.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {adminResetMessage.type === 'success'
                  ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                }
                <span className="font-medium">{adminResetMessage.text}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-textPrimary mb-1.5">
                  <Mail className="w-3.5 h-3.5 inline mr-1 text-brand-primary" />
                  New HOD Email <span className="text-textSecondary font-normal">(leave blank to keep current)</span>
                </label>
                <input
                  type="email"
                  value={adminResetEmail}
                  onChange={(e) => setAdminResetEmail(e.target.value)}
                  placeholder="e.g. newhod@rgmcet.edu.in"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-textPrimary mb-1.5">
                  <Lock className="w-3.5 h-3.5 inline mr-1 text-brand-primary" />
                  New HOD Password <span className="text-textSecondary font-normal">(leave blank to keep current)</span>
                </label>
                <div className="relative">
                  <input
                    type={showAdminResetPwd ? 'text' : 'password'}
                    value={adminResetPassword}
                    onChange={(e) => setAdminResetPassword(e.target.value)}
                    placeholder="Set a new password for the HOD"
                    className="w-full px-3.5 py-2 pr-10 text-sm rounded-xl border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                  <button type="button" onClick={() => setShowAdminResetPwd(!showAdminResetPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary">
                    {showAdminResetPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {adminResetPassword && (
                <div>
                  <label className="block text-xs font-semibold text-textPrimary mb-1.5">Confirm New Password</label>
                  <input
                    type="password"
                    value={adminResetConfirm}
                    onChange={(e) => setAdminResetConfirm(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                  {adminResetConfirm && adminResetPassword !== adminResetConfirm && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>
              )}

              <button
                onClick={async () => {
                  setAdminResetMessage(null);
                  if (!adminResetEmail && !adminResetPassword) {
                    setAdminResetMessage({ type: 'error', text: 'Enter a new email or new password to reset.' });
                    return;
                  }
                  if (adminResetPassword && adminResetPassword !== adminResetConfirm) {
                    setAdminResetMessage({ type: 'error', text: 'Passwords do not match.' });
                    return;
                  }
                  if (!window.confirm('Are you sure you want to override the HOD credentials? The HOD will need to use the new email/password to log in.')) return;
                  setAdminResetSaving(true);
                  try {
                    const result = await api.adminResetHodCredentials(
                      adminResetEmail || undefined,
                      adminResetPassword || undefined,
                    );
                    setAdminResetMessage({ type: 'success', text: `HOD credentials reset! New email: ${result.email}` });
                    setAdminResetEmail('');
                    setAdminResetPassword('');
                    setAdminResetConfirm('');
                    // Refresh credentials display
                    const updated = await api.getHodCredentials().catch(() => null);
                    if (updated) setHodCreds(updated);
                  } catch (err: any) {
                    setAdminResetMessage({ type: 'error', text: err.message || 'Reset failed.' });
                  } finally {
                    setAdminResetSaving(false);
                  }
                }}
                disabled={adminResetSaving}
                className="w-full py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
              >
                {adminResetSaving ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Resetting...</>
                ) : (
                  <><KeyRound className="w-4 h-4" /> Force Reset HOD Credentials</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 5: Student Passwords ── */}
      {activeTab === 'student-passwords' && (
        <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-base font-bold text-textPrimary flex items-center gap-2">
                <Lock className="w-5 h-5 text-brand-primary" />
                Student Password Management
              </h3>
              <p className="text-xs text-textSecondary mt-0.5">
                View or reset any student's plain-text login password.
              </p>
            </div>
            <button
              onClick={() => {
                setPwdLoading(true);
                api.getStudentPasswords().then((rows) => { setPwdStudents(rows); setPwdLoading(false); }).catch(() => setPwdLoading(false));
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-borderLine hover:bg-background transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${pwdLoading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-borderLine bg-background text-xs w-full sm:w-72 mb-4">
            <Search className="w-4 h-4 text-textSecondary shrink-0" />
            <input
              type="text" value={pwdSearch} onChange={(e) => setPwdSearch(e.target.value)}
              placeholder="Search by name or roll number…"
              className="bg-transparent border-none outline-none text-textPrimary flex-1 text-xs"
            />
          </div>

          {/* Table */}
          {pwdLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-textSecondary text-xs">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading passwords…
            </div>
          ) : pwdStudents.length === 0 ? (
            <div className="text-center py-12 text-textSecondary text-xs">
              No students found. Students appear here once registered.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-borderLine text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                    <th className="py-3 px-4">Roll No</th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Year / Sec</th>
                    <th className="py-3 px-4">Password</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLine text-sm">
                  {pwdStudents
                    .filter((r) =>
                      !pwdSearch ||
                      r.name.toLowerCase().includes(pwdSearch.toLowerCase()) ||
                      r.roll_number.toLowerCase().includes(pwdSearch.toLowerCase())
                    )
                    .map((row) => {
                      const isEditing = pwdEditId === row.roll_number;
                      const isVisible = showPwdMap[row.roll_number] ?? false;
                      const rowMsg = pwdMessage?.rollNo === row.roll_number ? pwdMessage : null;

                      return (
                        <tr key={row.roll_number} className="hover:bg-background/50 transition-colors">
                          {/* Roll No */}
                          <td className="py-3.5 px-4 font-bold text-brand-primary text-xs">{row.roll_number}</td>

                          {/* Name + Email */}
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-textPrimary text-sm">{row.name}</p>
                            <p className="text-[11px] text-textSecondary">{row.email}</p>
                          </td>

                          {/* Year / Section */}
                          <td className="py-3.5 px-4 text-xs font-medium text-textPrimary">
                            {row.year} • Sec {row.section}
                          </td>

                          {/* Password cell */}
                          <td className="py-3.5 px-4">
                            {isEditing ? (
                              <input
                                type="text"
                                value={pwdEditValue}
                                onChange={(e) => setPwdEditValue(e.target.value)}
                                autoFocus
                                placeholder="New password (min 4 chars)"
                                className="px-3 py-1.5 text-xs rounded-lg border border-brand-primary bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary w-48 font-mono"
                              />
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-textPrimary">
                                  {isVisible
                                    ? (row.password || <span className="italic text-textSecondary">not set</span>)
                                    : '••••••••'}
                                </span>
                                <button
                                  onClick={() => setShowPwdMap((prev) => ({ ...prev, [row.roll_number]: !isVisible }))}
                                  className="p-1 text-textSecondary hover:text-textPrimary transition-colors"
                                  title={isVisible ? 'Hide' : 'Show password'}
                                >
                                  {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            )}
                            {/* Inline toast */}
                            {rowMsg && (
                              <p className={`text-[10px] font-semibold mt-1 ${rowMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                                {rowMsg.text}
                              </p>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={async () => {
                                    if (!pwdEditValue || pwdEditValue.length < 4) {
                                      setPwdMessage({ rollNo: row.roll_number, type: 'error', text: 'Min 4 characters required.' });
                                      setTimeout(() => setPwdMessage(null), 3000);
                                      return;
                                    }
                                    setPwdSaving(true);
                                    try {
                                      await api.setStudentPassword(row.roll_number, pwdEditValue);
                                      // Update local list
                                      setPwdStudents((prev) => prev.map((r) => r.roll_number === row.roll_number ? { ...r, password: pwdEditValue } : r));
                                      setPwdEditId(null);
                                      setPwdEditValue('');
                                      setPwdMessage({ rollNo: row.roll_number, type: 'success', text: '✓ Password updated!' });
                                      setTimeout(() => setPwdMessage(null), 3000);
                                    } catch (err: any) {
                                      setPwdMessage({ rollNo: row.roll_number, type: 'error', text: err.message || 'Save failed.' });
                                      setTimeout(() => setPwdMessage(null), 4000);
                                    } finally {
                                      setPwdSaving(false);
                                    }
                                  }}
                                  disabled={pwdSaving}
                                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-50 flex items-center gap-1"
                                >
                                  {pwdSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Save
                                </button>
                                <button
                                  onClick={() => { setPwdEditId(null); setPwdEditValue(''); }}
                                  className="p-1.5 rounded-lg border border-borderLine text-textSecondary hover:text-textPrimary transition-colors"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setPwdEditId(row.roll_number); setPwdEditValue(row.password || ''); }}
                                className="p-1.5 rounded-lg border border-borderLine text-textPrimary hover:bg-background transition-colors"
                                title="Change password"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface border border-borderLine rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-textPrimary">Confirm Permanent Delete</h3>
                <p className="text-xs text-textSecondary mt-0.5">This action cannot be undone.</p>
              </div>
            </div>

            {/* What will be deleted */}
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <p className="font-semibold mb-0.5">You are about to delete:</p>
              <p className="font-bold">{deleteModal.label}</p>
              <p className="text-xs mt-1.5 text-red-600">
                All academic records, coding profiles, certificates, skills and achievements for these students will also be permanently removed.
              </p>
            </div>

            {/* Type to confirm */}
            <div>
              <label className="block text-xs font-semibold text-textPrimary mb-1.5">
                Type <span className="font-black text-red-600 tracking-widest">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE here"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-red-400 font-mono tracking-widest"
                autoFocus
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteModal(null); setDeleteConfirmText(''); }}
                className="flex-1 py-2.5 rounded-xl border border-borderLine text-textPrimary text-sm font-semibold hover:bg-background transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteDelete}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Deleting...</>
                ) : (
                  <><Trash2 className="w-4 h-4" /> Delete Forever</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
