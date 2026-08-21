import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
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
  Crown,
  UserPlus,
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
import { FacultyRecordsTable } from './components/FacultyRecordsTable';
import { PlacementEligibilitySection } from '../hod/components/PlacementEligibilitySection';

import { VALID_DEPARTMENT_NAMES } from '../../lib/validation/auth';

const DEPARTMENTS = VALID_DEPARTMENT_NAMES;
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'] as const;

// Initial Faculty data store (admin-managed)
const INITIAL_FACULTY = [
  { id: 'FAC001', name: 'Dr. K. V. Subbaiah', email: 'kvsubbaiah@rgmcet.edu.in', department: 'CSE (Data Science)', designation: 'Coordinator', menteesCount: 3 },
  { id: 'FAC002', name: 'Prof. M. Ramesh', email: 'mramesh@rgmcet.edu.in', department: 'ECE', designation: 'Mentor', menteesCount: 2 },
];

// The 3 fixed super admin emails — used to derive isSuperAdmin flag from user.email
const SUPER_ADMIN_EMAILS = [
  'jayakrushna1622@gmail.com',
  'dineshkumarpathipati@gmail.com',
  'jayanthkumarnaidu777@gmail.com',
];

export const AdminDashboardPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const activeTab = searchParams.get('tab') || 'students';
  const { user } = useAuth();

  // Detect super admin from user email — zero AuthContext changes needed
  const isSuperAdmin = user?.role === 'admin' && SUPER_ADMIN_EMAILS.includes(user?.email ?? '');

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
  const [departmentFilter, setDepartmentFilter] = useState<string>(
    user?.isSuperAdmin ? 'All' : (user?.department || 'CSE (Data Science)')
  );
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

  // Admin Management panel state (super admin only)
  type AdminRow = { email: string; name: string; password: string; created_by: string; created_at: string };
  const [adminList, setAdminList] = useState<AdminRow[]>([]);
  const [adminListLoading, setAdminListLoading] = useState(false);
  const [showAdminPwdMap, setShowAdminPwdMap] = useState<Record<string, boolean>>({});
  const [adminPwdEditId, setAdminPwdEditId] = useState<string | null>(null);
  const [adminPwdEditValue, setAdminPwdEditValue] = useState('');
  const [adminPwdSaving, setAdminPwdSaving] = useState(false);
  const [adminMsg, setAdminMsg] = useState<{ key: string; type: 'success' | 'error'; text: string } | null>(null);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminSaving, setNewAdminSaving] = useState(false);
  // Change my password (super admin self-service)
  const [myNewPwd, setMyNewPwd] = useState('');
  const [myNewPwdConfirm, setMyNewPwdConfirm] = useState('');
  const [myPwdSaving, setMyPwdSaving] = useState(false);
  const [myPwdMsg, setMyPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  // CSV Mentor Assignment state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ rolls: string[]; facultyName: string }[]>([]);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState<any | null>(null);
  const [csvError, setCsvError] = useState('');
  const [csvDragOver, setCsvDragOver] = useState(false);

  // Email link modal state
  const [linkEmailFacId, setLinkEmailFacId] = useState<string | null>(null);
  const [linkEmailValue, setLinkEmailValue] = useState('');
  const [linkEmailSaving, setLinkEmailSaving] = useState(false);
  const [linkEmailMsg, setLinkEmailMsg] = useState('');

  // Queries
  const { data: students = [], refetch } = useQuery({
    queryKey: ['adminStudents', departmentFilter],
    queryFn: () => api.getAllStudents({ department: departmentFilter === 'All' ? undefined : departmentFilter }),
    staleTime: 0,
    refetchOnMount: 'always',
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

  // Top performers data dynamically mapped from real API students (using database stored stats)
  const performersData = [...students]
    .map((s, idx) => {
      const cgpa = (s as any).cgpa !== undefined ? Number((s as any).cgpa) : 0;
      const leetcodePts = (s as any).leetcode_solved !== undefined ? Number((s as any).leetcode_solved) : 0;
      const status = (s as any).standing || (
        cgpa >= 8.0 ? 'Distinction' :
        (cgpa >= 6.5 && cgpa < 8.0) ? 'First Class' :
        (cgpa >= 5.5 && cgpa < 6.5) ? 'Second Class' :
        (cgpa > 4.5 && cgpa < 5.5) ? 'Pass' :
        (cgpa > 0 ? 'Pass' : 'N/A')
      );
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

  // CGPA band counts — computed from real student data for the performance tab stat cards
  const total = students.length || 1; // avoid division by zero
  const cgpaAbove8  = students.filter(s => Number((s as any).cgpa ?? 0) >= 8.0).length;
  const cgpa65to8   = students.filter(s => { const c = Number((s as any).cgpa ?? 0); return c >= 6.5 && c < 8.0; }).length;
  const cgpa55to65  = students.filter(s => { const c = Number((s as any).cgpa ?? 0); return c >= 5.5 && c < 6.5; }).length;
  const cgpaPass    = students.filter(s => { const c = Number((s as any).cgpa ?? 0); return c > 4.5 && c < 5.5; }).length;

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

  // CSV Mentor Assignment handlers
  const parseCSV = (text: string): { rolls: string[]; facultyName: string }[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const parsed: { rolls: string[]; facultyName: string }[] = [];

    /**
     * Matches RGMCET-style roll numbers in any reasonable format:
     *   24091A32A3  24091A32E9  24091A32J7  23091A3251  20091A0588
     * Pattern: 5 digits + 1 letter + rest (2-5 alphanumeric chars), total 8-11 chars.
     */
    const isRollNo = (val: string) =>
      /^\d{5}[A-Za-z][A-Za-z0-9]{2,5}$/.test(val.trim());

    /**
     * Auto-detect column separator:
     *   1. Comma  -> standard CSV
     *   2. Tab    -> TSV / Excel "Save as Tab"
     *   3. 2+ spaces -> Excel copy-paste space-padded table
     */
    const splitLine = (line: string): string[] => {
      if (line.includes(',')) return line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      if (line.includes('\t')) return line.split('\t').map(c => c.trim().replace(/^"|"$/g, ''));
      return line.split(/\s{2,}/).map(c => c.trim());
    };

    // Recognise any common column header label so header rows are skipped
    const isHeaderLabel = (v: string) =>
      /^(regd?\s*no\.?|reg\s*no\.?|roll(\s*(no\.?|number))?|s\.?\s*no\.?|mentor[s]?|faculty|name)$/i.test(v.trim());

    for (const line of lines) {
      const cols = splitLine(line);
      if (cols.length < 2) continue;

      const rolls: string[] = [];
      let facultyName = '';

      for (const col of cols) {
        const v = col.trim();
        if (!v) continue;
        if (isRollNo(v)) {
          rolls.push(v.toUpperCase());
        } else if (!/^\d+$/.test(v)) {
          // Non-numeric, non-roll text -> faculty name candidate (last one wins)
          facultyName = v;
        }
      }

      // Skip rows with no rolls, no name, or where the "name" is actually a header label
      if (rolls.length === 0 || !facultyName) continue;
      if (isHeaderLabel(facultyName)) continue;

      parsed.push({ rolls, facultyName });
    }
    return parsed;
  };

  const handleCSVFile = (file: File) => {
    setCsvFile(file); setCsvResult(null); setCsvError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        setCsvError('No valid rows found. Format: S.No | Roll 1 | Roll 2 (opt) | Faculty Name | PS No (opt)');
        setCsvPreview([]); return;
      }
      setCsvPreview(parsed);
    };
    reader.readAsText(file);
  };

  const handleCSVUpload = async () => {
    if (csvPreview.length === 0) return;
    setCsvUploading(true); setCsvError('');
    try {
      const result = await api.uploadMentorAssignments(csvPreview);
      setCsvResult(result); setCsvPreview([]); setCsvFile(null);
      queryClient.invalidateQueries({ queryKey: ['adminFaculty'] });
    } catch (e: any) {
      setCsvError(e.message || 'Upload failed. Please try again.');
    } finally { setCsvUploading(false); }
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
      <div className="bg-surface border border-borderLine rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <nav className="flex px-2 pt-2 pb-0 gap-1 border-b border-borderLine">
            {[
              { key: 'students', label: 'Student Directory (CRUD)' },
              { key: 'performance', label: 'CGPA & Coding Rankings' },
              { key: 'faculty', label: 'Faculty & Mentor Assignments' },
              { key: 'hod-credentials', label: '🔑 HOD Credentials' },
              { key: 'student-passwords', label: '🔒 Student Passwords' },
              ...(isSuperAdmin ? [{ key: 'admin-management', label: '👑 Admin Management' }] : []),
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setSearchParams({ tab: t.key });
                  if (t.key === 'hod-credentials' && !hodCreds) {
                    setHodCredsLoading(true);
                    api.getHodCredentials().then((data) => {
                      setHodCreds(data);
                      setHodCredsLoading(false);
                    }).catch(() => setHodCredsLoading(false));
                  }
                  if (t.key === 'student-passwords' && pwdStudents.length === 0) {
                    setPwdLoading(true);
                    api.getStudentPasswords().then((rows) => {
                      setPwdStudents(rows);
                      setPwdLoading(false);
                    }).catch(() => setPwdLoading(false));
                  }
                  if (t.key === 'admin-management' && isSuperAdmin && user?.email && adminList.length === 0) {
                    setAdminListLoading(true);
                    api.getSuperAdminAdmins(user.email).then((rows) => {
                      setAdminList(rows);
                      setAdminListLoading(false);
                    }).catch(() => setAdminListLoading(false));
                  }
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all rounded-t-lg ${
                  activeTab === t.key
                    ? 'border-brand-primary text-brand-primary bg-brand-soft'
                    : 'border-transparent text-textSecondary hover:text-textPrimary hover:bg-surface-2'
                }`}
              >
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Stat Cards — always visible */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users className="w-5 h-5" />} iconBgColor="bg-brand-soft text-brand-primary"
          accentColor="brand" label="Total Students" value={students.length} subtext="Active in platform" />
        <StatCard icon={<GraduationCap className="w-5 h-5" />} iconBgColor="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          accentColor="amber" label="CGPA ≥ 8.0 (Distinction)" value={`${cgpaAbove8} Students`} subtext="Academic distinction (≥ 75%)" />
        <StatCard icon={<BookOpen className="w-5 h-5" />} iconBgColor="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
          accentColor="indigo" label="Avg Institution CGPA" value="9.09 / 10" subtext="High academic standing" />
        <StatCard icon={<Code2 className="w-5 h-5" />} iconBgColor="bg-[#FFA116]/10 text-[#FFA116]"
          accentColor="brand" label="LeetCode Profiles" value="Active Sync" subtext="Real-time platform stats" />
      </div>

      {/* ── TAB 1: Student Directory ── */}
      {activeTab === 'students' && (
        <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-xs">
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
              {isSuperAdmin ? (
                <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-borderLine bg-background text-textPrimary font-medium">
                  <option value="All">All Departments</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              ) : (
                <span className="px-3 py-1.5 text-xs rounded-lg border border-brand-primary/30 bg-brand-soft text-brand-primary font-bold">
                  {departmentFilter}
                </span>
              )}
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
                      {(s as any).cgpa !== undefined && (s as any).cgpa !== null
                        ? `${Number((s as any).cgpa).toFixed(2)} / 10.0`
                        : <span className="text-textSecondary font-normal text-xs">N/A</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(s as any).leetcode_handle && (s as any).leetcode_handle !== 'Not Linked' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFA116]/10 text-[#FFA116]">LeetCode</span>
                        )}
                        {(s as any).github_handle && (s as any).github_handle !== 'Not Linked' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-borderLine text-textPrimary">GitHub</span>
                        )}
                        {(s as any).codeforces_handle && (s as any).codeforces_handle !== 'Not Linked' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600">Codeforces</span>
                        )}
                        {!(s as any).leetcode_handle && !(s as any).github_handle && !(s as any).codeforces_handle && (
                          <span className="text-xs text-textSecondary italic">None linked</span>
                        )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'CGPA ≥ 8.0 (Distinction)',      count: cgpaAbove8,  color: 'text-emerald-600',   pct: `${Math.round((cgpaAbove8  / total) * 100)}%` },
              { label: 'CGPA 6.5–7.99 (First Class)',   count: cgpa65to8,   color: 'text-brand-primary', pct: `${Math.round((cgpa65to8   / total) * 100)}%` },
              { label: 'CGPA 5.5–6.49 (Second Class)',  count: cgpa55to65,  color: 'text-amber-600',     pct: `${Math.round((cgpa55to65  / total) * 100)}%` },
              { label: 'CGPA 4.51–5.49 (Pass Class)',   count: cgpaPass,    color: 'text-sky-600',       pct: `${Math.round((cgpaPass    / total) * 100)}%` },
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
                      <td className="py-3.5 px-4 font-black text-green-600">{p.cgpa > 0 ? p.cgpa : '—'}</td>
                      <td className="py-3.5 px-4">
                        <a href={`https://leetcode.com/${p.leetcode}`} target="_blank" rel="noreferrer"
                          className="text-xs font-semibold text-[#FFA116] hover:underline flex items-center gap-0.5">
                          @{p.leetcode} <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-textPrimary text-xs">{p.leetcodePts} solved</td>
                      <td className="py-3.5 px-4">
                        <a href={`https://github.com/${p.github}`} target="_blank" rel="noreferrer"
                          className="text-xs font-semibold text-textPrimary hover:underline flex items-center gap-0.5">
                          @{p.github} <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          p.status === 'Distinction' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' :
                          p.status === 'First Class' ? 'bg-brand-soft text-brand-primary dark:bg-indigo-950/40 dark:text-indigo-400 border border-brand-primary/20' :
                          p.status === 'Second Class' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800' :
                          p.status === 'Pass' ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-200 dark:border-sky-800' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}>
                          {p.status}
                        </span>
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
        <div className="space-y-6">
          {/* CSV Upload Card */}
          <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-base font-bold text-textPrimary">Upload Mentor Assignment CSV</h3>
              <p className="text-xs text-textSecondary mt-0.5">
                Format: <span className="font-mono bg-background px-1 rounded">S.No | Regd No.1 | Regd No.2 | Regd No.3 (If present) | Mentor Name</span>
                &nbsp;— any number of reg. number columns, tab or comma separated
              </p>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setCsvDragOver(true); }}
              onDragLeave={() => setCsvDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setCsvDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleCSVFile(f); }}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                csvDragOver ? 'border-brand-primary bg-brand-soft/20' : 'border-borderLine hover:border-brand-primary/50 hover:bg-background'
              }`}
              onClick={() => document.getElementById('mentor-csv-input')?.click()}
            >
              <Upload className="w-8 h-8 text-brand-primary mx-auto mb-2" />
              <p className="text-sm font-semibold text-textPrimary">
                {csvFile ? csvFile.name : 'Drop CSV here or click to browse'}
              </p>
              <p className="text-xs text-textSecondary mt-1">Accepts .csv files</p>
              <input id="mentor-csv-input" type="file" accept=".csv,.txt" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCSVFile(f); e.target.value = ''; }}
              />
            </div>

            {csvError && (
              <div className="mt-3 flex items-center gap-2 text-xs text-alert bg-alert-soft px-3 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />{csvError}
              </div>
            )}

            {/* Preview table */}
            {csvPreview.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <p className="text-xs font-semibold text-textPrimary">
                    {csvPreview.length} rows parsed &nbsp;·&nbsp;
                    {csvPreview.reduce((sum, r) => sum + r.rolls.length, 0)} students total
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[...new Set(csvPreview.map(r => r.facultyName))].map(name => (
                      <span key={name} className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                        {name} → {csvPreview.filter(r => r.facultyName === name).reduce((s, r) => s + r.rolls.length, 0)} students
                      </span>
                    ))}
                  </div>
                </div>
                <div className="max-h-52 overflow-y-auto border border-borderLine rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-background border-b border-borderLine sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">#</th>
                        <th className="px-3 py-2 text-left font-semibold">Registration Numbers</th>
                        <th className="px-3 py-2 text-left font-semibold">Mentor Name</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borderLine">
                      {csvPreview.slice(0, 20).map((row, i) => (
                        <tr key={i} className="hover:bg-background/50">
                          <td className="px-3 py-1.5 text-textSecondary">{i + 1}</td>
                          <td className="px-3 py-1.5">
                            <div className="flex flex-wrap gap-1">
                              {row.rolls.map((roll, ri) => (
                                <span key={ri} className="font-mono font-bold text-brand-primary bg-brand-soft px-1.5 py-0.5 rounded text-[10px]">
                                  {roll}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-textPrimary font-medium">{row.facultyName}</td>
                        </tr>
                      ))}
                      {csvPreview.length > 20 && (
                        <tr><td colSpan={3} className="px-3 py-1.5 text-center text-textSecondary">+ {csvPreview.length - 20} more rows</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <PillButton variant="outline" size="sm" onClick={() => { setCsvPreview([]); setCsvFile(null); }}>Cancel</PillButton>
                  <PillButton variant="primary" size="sm" onClick={handleCSVUpload} disabled={csvUploading}
                    icon={csvUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}>
                    {csvUploading ? 'Uploading…' : 'Upload & Assign'}
                  </PillButton>
                </div>
              </div>
            )}

            {/* Upload result */}
            {csvResult && (
              <div className="mt-4 p-4 bg-background border border-borderLine rounded-lg space-y-1.5 text-xs">
                <p className="flex items-center gap-2 text-success font-semibold">
                  <CheckCircle2 className="w-4 h-4" /> {csvResult.updated} students assigned successfully
                </p>
                {csvResult.autoCreatedFaculty?.length > 0 && (
                  <p className="text-indigo-600">🆕 New faculty auto-created: {csvResult.autoCreatedFaculty.join(', ')}</p>
                )}
                {csvResult.alreadyExistedFaculty?.length > 0 && (
                  <p className="text-textSecondary">✅ Existing faculty matched: {csvResult.alreadyExistedFaculty.join(', ')}</p>
                )}
                {csvResult.notFoundRolls?.length > 0 && (
                  <p className="text-amber-600">⚠️ Roll numbers not found: {csvResult.notFoundRolls.join(', ')}</p>
                )}
                <button onClick={() => setCsvResult(null)} className="text-brand-primary underline text-[11px]">Dismiss</button>
              </div>
            )}
          </div>

          {/* Live Faculty Records Table */}
          <FacultyRecordsTable
            onLinkEmail={(facId) => { setLinkEmailFacId(facId); setLinkEmailValue(''); setLinkEmailMsg(''); }}
          />
        </div>
      )}

      {/* ── Email Link Modal ── */}
      {linkEmailFacId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-borderLine rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-base font-bold text-textPrimary mb-1">Link Email to Faculty</h3>
            <p className="text-xs text-textSecondary mb-4">Faculty ID: <span className="font-mono font-bold">{linkEmailFacId}</span></p>
            <input
              type="email"
              value={linkEmailValue}
              onChange={(e) => setLinkEmailValue(e.target.value)}
              placeholder="e.g. hcseds@rgmcet.edu.in"
              className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary mb-3"
            />
            {linkEmailMsg && (
              <p className={`text-xs mb-3 ${linkEmailMsg.startsWith('Error') ? 'text-alert' : 'text-success'}`}>{linkEmailMsg}</p>
            )}
            <div className="flex justify-end gap-2">
              <PillButton variant="outline" size="sm" onClick={() => setLinkEmailFacId(null)}>Cancel</PillButton>
              <PillButton variant="primary" size="sm" disabled={linkEmailSaving || !linkEmailValue.trim()}
                onClick={async () => {
                  setLinkEmailSaving(true);
                  try {
                    await api.patchFacultyEmail(linkEmailFacId, linkEmailValue.trim());
                    setLinkEmailMsg('Email linked successfully!');
                    queryClient.invalidateQueries({ queryKey: ['adminFaculty'] });
                    setTimeout(() => setLinkEmailFacId(null), 1500);
                  } catch (e: any) {
                    setLinkEmailMsg(`Error: ${e.message}`);
                  } finally { setLinkEmailSaving(false); }
                }}
              >
                {linkEmailSaving ? 'Saving…' : 'Save'}
              </PillButton>
            </div>
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

      {/* ── TAB 6: Admin Management (super admin only) ── */}
      {activeTab === 'admin-management' && isSuperAdmin && user?.email && (
        <div className="space-y-6">
          {/* ——— Section A: Regular Admin List ——— */}
          <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-textPrimary flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-500" /> Admin Account Management
                </h3>
                <p className="text-xs text-textSecondary mt-0.5">
                  Add, delete or reset passwords of regular admins. Super admin accounts cannot be deleted.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setAdminListLoading(true);
                    api.getSuperAdminAdmins(user!.email).then((rows) => { setAdminList(rows); setAdminListLoading(false); }).catch(() => setAdminListLoading(false));
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-borderLine hover:bg-background transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${adminListLoading ? 'animate-spin' : ''}`} /> Refresh
                </button>
                <button
                  onClick={() => {
                    // Clear any stale toast from previous Add Admin session
                    if (!showAddAdmin) setAdminMsg(null);
                    setShowAddAdmin((v) => !v);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 transition-all"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Add Admin
                </button>
              </div>
            </div>

            {/* Add Admin Inline Form */}
            {showAddAdmin && (
              <div className="mb-5 p-4 rounded-xl border border-brand-primary/30 bg-brand-soft/10 space-y-3">
                <p className="text-xs font-bold text-brand-primary">New Regular Admin</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input type="text" placeholder="Full name" value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)}
                    className="px-3 py-2 text-xs rounded-lg border border-borderLine bg-background focus:outline-none focus:border-brand-primary" />
                  <input type="email" placeholder="Email address" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="px-3 py-2 text-xs rounded-lg border border-borderLine bg-background focus:outline-none focus:border-brand-primary" />
                  <input type="text" placeholder="Password (min 4 chars)" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)}
                    className="px-3 py-2 text-xs rounded-lg border border-borderLine bg-background focus:outline-none focus:border-brand-primary font-mono" />
                </div>
                {adminMsg?.key === 'add' && (
                  <p className={`text-[10px] font-semibold ${adminMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>{adminMsg.text}</p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (!newAdminName || !newAdminEmail || !newAdminPassword) { setAdminMsg({ key: 'add', type: 'error', text: 'All fields required.' }); return; }
                      if (newAdminPassword.length < 4) { setAdminMsg({ key: 'add', type: 'error', text: 'Password min 4 chars.' }); return; }
                      setNewAdminSaving(true);
                      try {
                        await api.createAdmin(user!.email, newAdminName, newAdminEmail, newAdminPassword);
                        const rows = await api.getSuperAdminAdmins(user!.email);
                        setAdminList(rows);
                        setNewAdminName(''); setNewAdminEmail(''); setNewAdminPassword('');
                        setShowAddAdmin(false);
                        setAdminMsg({ key: 'add', type: 'success', text: '✓ Admin created!' });
                        setTimeout(() => setAdminMsg(null), 3000);
                      } catch (e: any) {
                        setAdminMsg({ key: 'add', type: 'error', text: e.message || 'Failed to create admin.' });
                      } finally { setNewAdminSaving(false); }
                    }}
                    disabled={newAdminSaving}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-50 flex items-center gap-1"
                  >
                    {newAdminSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Create
                  </button>
                  <button onClick={() => { setShowAddAdmin(false); setNewAdminName(''); setNewAdminEmail(''); setNewAdminPassword(''); }}
                    className="px-3 py-1.5 text-xs rounded-lg border border-borderLine text-textSecondary hover:text-textPrimary">Cancel</button>
                </div>
              </div>
            )}

            {/* Admin Table */}
            {adminListLoading ? (
              <div className="flex items-center justify-center py-10 gap-2 text-textSecondary text-xs">
                <RefreshCw className="w-4 h-4 animate-spin" /> Loading admins…
              </div>
            ) : adminList.length === 0 ? (
              <div className="text-center py-10 text-textSecondary text-xs">
                No regular admins yet. Click “Add Admin” to create one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-borderLine text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Name</th>
                      <th className="py-3 px-4">Password</th>
                      <th className="py-3 px-4">Created By</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borderLine text-sm">
                    {adminList.map((row) => {
                      const isVisible = showAdminPwdMap[row.email] ?? false;
                      const isEditing = adminPwdEditId === row.email;
                      const rowMsg = adminMsg?.key === row.email ? adminMsg : null;
                      return (
                        <tr key={row.email} className="hover:bg-background/50 transition-colors">
                          <td className="py-3.5 px-4 text-xs font-bold text-brand-primary">{row.email}</td>
                          <td className="py-3.5 px-4 text-sm font-medium text-textPrimary">{row.name}</td>
                          <td className="py-3.5 px-4">
                            {isEditing ? (
                              <input type="text" value={adminPwdEditValue} onChange={(e) => setAdminPwdEditValue(e.target.value)} autoFocus
                                className="px-3 py-1.5 text-xs rounded-lg border border-brand-primary bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary w-44 font-mono" />
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-textPrimary">{isVisible ? (row.password || '(not set)') : '••••••••'}</span>
                                <button onClick={() => setShowAdminPwdMap((p) => ({ ...p, [row.email]: !isVisible }))}
                                  className="p-1 text-textSecondary hover:text-textPrimary" title={isVisible ? 'Hide' : 'Show'}>
                                  {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            )}
                            {rowMsg && (
                              <p className={`text-[10px] font-semibold mt-1 ${rowMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>{rowMsg.text}</p>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-textSecondary">{row.created_by || '—'}</td>
                          <td className="py-3.5 px-4 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={async () => {
                                    if (!adminPwdEditValue || adminPwdEditValue.length < 4) {
                                      setAdminMsg({ key: row.email, type: 'error', text: 'Min 4 chars required.' });
                                      setTimeout(() => setAdminMsg(null), 3000); return;
                                    }
                                    setAdminPwdSaving(true);
                                    try {
                                      await api.setAdminPassword(user!.email, row.email, adminPwdEditValue);
                                      setAdminList((prev) => prev.map((r) => r.email === row.email ? { ...r, password: adminPwdEditValue } : r));
                                      setAdminPwdEditId(null); setAdminPwdEditValue('');
                                      setAdminMsg({ key: row.email, type: 'success', text: '✓ Password updated!' });
                                      setTimeout(() => setAdminMsg(null), 3000);
                                    } catch (e: any) {
                                      setAdminMsg({ key: row.email, type: 'error', text: e.message || 'Save failed.' });
                                      setTimeout(() => setAdminMsg(null), 4000);
                                    } finally { setAdminPwdSaving(false); }
                                  }}
                                  disabled={adminPwdSaving}
                                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-50 flex items-center gap-1"
                                >
                                  {adminPwdSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Save
                                </button>
                                <button onClick={() => { setAdminPwdEditId(null); setAdminPwdEditValue(''); }}
                                  className="p-1.5 rounded-lg border border-borderLine text-textSecondary hover:text-textPrimary"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                <button onClick={() => { setAdminPwdEditId(row.email); setAdminPwdEditValue(row.password || ''); }}
                                  className="p-1.5 rounded-lg border border-borderLine text-textPrimary hover:bg-background" title="Change password">
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm(`Delete admin ${row.email}? This cannot be undone.`)) return;
                                    try {
                                      await api.deleteAdmin(user!.email, row.email);
                                      setAdminList((prev) => prev.filter((r) => r.email !== row.email));
                                    } catch (e: any) {
                                      setAdminMsg({ key: row.email, type: 'error', text: e.message || 'Delete failed.' });
                                      setTimeout(() => setAdminMsg(null), 4000);
                                    }
                                  }}
                                  className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors" title="Delete admin">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
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

          {/* ——— Section B: Change My Password (super admin self-service) ——— */}
          <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-textPrimary flex items-center gap-2 mb-1">
              <Lock className="w-5 h-5 text-brand-primary" /> Change My Super Admin Password
            </h3>
            <p className="text-xs text-textSecondary mb-5">
              Changing <span className="font-semibold text-textPrimary">{user.email}</span>'s password only. You cannot change another super admin's password.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 max-w-lg">
              <input type="password" placeholder="New password (min 4 chars)" value={myNewPwd} onChange={(e) => setMyNewPwd(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-borderLine bg-background focus:outline-none focus:border-brand-primary flex-1 font-mono" />
              <input type="password" placeholder="Confirm new password" value={myNewPwdConfirm} onChange={(e) => setMyNewPwdConfirm(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-borderLine bg-background focus:outline-none focus:border-brand-primary flex-1 font-mono" />
              <button
                onClick={async () => {
                  if (!myNewPwd || myNewPwd.length < 4) { setMyPwdMsg({ type: 'error', text: 'Min 4 characters required.' }); return; }
                  if (myNewPwd !== myNewPwdConfirm) { setMyPwdMsg({ type: 'error', text: 'Passwords do not match.' }); return; }
                  setMyPwdSaving(true);
                  try {
                    await api.changeSuperAdminMyPassword(user!.email, myNewPwd);
                    setMyNewPwd(''); setMyNewPwdConfirm('');
                    setMyPwdMsg({ type: 'success', text: '✓ Password updated! Use the new password on next login.' });
                    setTimeout(() => setMyPwdMsg(null), 5000);
                  } catch (e: any) {
                    setMyPwdMsg({ type: 'error', text: e.message || 'Failed to update password.' });
                  } finally { setMyPwdSaving(false); }
                }}
                disabled={myPwdSaving}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
              >
                {myPwdSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Update Password
              </button>
            </div>
            {myPwdMsg && (
              <p className={`text-xs font-semibold mt-3 ${myPwdMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>{myPwdMsg.text}</p>
            )}
          </div>
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
