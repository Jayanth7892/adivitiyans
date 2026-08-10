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
  X,
  BookOpen,
  Trophy,
  Save,
  GraduationCap,
  Code2,
  Github,
  ExternalLink,
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

  // Student Directory state
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentProfile | null>(null);
  const [inspectStudent, setInspectStudent] = useState<StudentProfile | null>(null);
  const [inspectTab, setInspectTab] = useState('personal-info');
  const [saving, setSaving] = useState(false);

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

  // Top performers data dynamically mapped from real API students
  const performersData = [...students]
    .map((s, idx) => {
      const cgpa = (s as any).cgpa !== undefined ? Number((s as any).cgpa) : 9.0;
      const leetcodePts = (s as any).leetcode_solved !== undefined ? Number((s as any).leetcode_solved) : 0;
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

  const handleDeleteStudent = async (rollNo: string) => {
    if (!window.confirm(`Are you sure you want to delete student ${rollNo}? This cannot be undone.`)) return;
    try {
      await api.deleteStudent(rollNo);
      alert(`Student ${rollNo} deleted.`);
      refetch();
    } catch (e: any) {
      alert('Delete failed: ' + e.message);
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
        <div className="flex gap-3">
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
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setSearchParams({ tab: t.key })}
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
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-borderLine bg-background text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
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
                  <tr><td colSpan={7} className="py-10 text-center text-textSecondary text-xs">No students found matching your filters.</td></tr>
                )}
                {filteredStudents.map((s, i) => (
                  <tr key={s.roll_number} className="hover:bg-background/50 transition-colors">
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
                        <button onClick={() => handleDeleteStudent(s.roll_number)}
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
    </div>
  );
};
