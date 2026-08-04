import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const DEPARTMENTS = ['CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Data Science', 'AI & ML', 'Cyber Security', 'MBA', 'MCA'];
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
import {
  Users,
  Search,
  Filter,
  Award,
  TrendingUp,
  BookOpen,
  CheckCircle2,
  Edit2,
  FileBarChart,
  Eye,
  ShieldCheck,
  X,
  Plus,
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

export const FacultyDashboardPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const activeTab = searchParams.get('tab') || 'mentees';

  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [selectedMentee, setSelectedMentee] = useState<StudentProfile | null>(null);
  const [inspectMentee, setInspectMentee] = useState<StudentProfile | null>(null);
  const [inspectTab, setInspectTab] = useState('personal-info');
  const [remarkInput, setRemarkInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch all students / mentees for faculty view
  const { data: mentees = [], refetch } = useQuery({
    queryKey: ['facultyMentees'],
    queryFn: () => api.getFacultyMentees('FAC001'),
  });

  const { data: deptReport } = useQuery({
    queryKey: ['deptReport'],
    queryFn: () => api.getDepartmentReport('CSE'),
  });

  // Queries for inspected mentee sub-resources
  const menteeId = inspectMentee?.roll_number || '23091A3251';
  const { data: inspectAcademics = [] } = useQuery({
    queryKey: ['inspectAcademics', menteeId],
    queryFn: () => api.getAcademics(menteeId),
    enabled: Boolean(inspectMentee),
  });

  const { data: inspectCoding = [] } = useQuery({
    queryKey: ['inspectCoding', menteeId],
    queryFn: () => api.getCodingProfiles(menteeId),
    enabled: Boolean(inspectMentee),
  });

  const { data: inspectSkills = [] } = useQuery({
    queryKey: ['inspectSkills', menteeId],
    queryFn: () => api.getTechSkills(menteeId),
    enabled: Boolean(inspectMentee),
  });

  const { data: inspectCerts = [] } = useQuery({
    queryKey: ['inspectCerts', menteeId],
    queryFn: () => api.getCertifications(menteeId),
    enabled: Boolean(inspectMentee),
  });

  const { data: inspectSoft = [] } = useQuery({
    queryKey: ['inspectSoft', menteeId],
    queryFn: () => api.getSoftSkills(menteeId),
    enabled: Boolean(inspectMentee),
  });

  const { data: inspectAchievements = [] } = useQuery({
    queryKey: ['inspectAchievements', menteeId],
    queryFn: () => api.getAchievements(menteeId),
    enabled: Boolean(inspectMentee),
  });

  const filteredMentees = mentees.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || m.name.toLowerCase().includes(q) || m.roll_number.toLowerCase().includes(q);
    const matchesSection = !sectionFilter || m.section === sectionFilter;
    const matchesYear = !yearFilter || m.year === yearFilter;
    return matchesSearch && matchesSection && matchesYear;
  });

  const handleSaveRemark = async () => {
    if (!selectedMentee) return;
    setSaving(true);
    try {
      await api.saveAcademicRecord(selectedMentee.roll_number, {
        semester: 4,
        semester_gpa: 9.2,
        attendance_pct: 95.0,
        remarks: remarkInput || 'Faculty verified performance',
      });
      alert(`Remarks saved for mentee ${selectedMentee.name}`);
      setSelectedMentee(null);
      refetch();
    } catch (e: any) {
      alert('Failed to save remarks');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface border border-borderLine rounded-2xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-soft text-brand-primary text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Faculty & Mentor Portal</span>
          </div>
          <h1 className="text-2xl font-extrabold text-textPrimary">Mentee Directory & Department Overview</h1>
          <p className="text-xs text-textSecondary mt-1">Track student progress, verify skills, and provide academic remarks</p>
        </div>
      </div>

      {/* Sub-Tab Switcher */}
      <div className="flex border-b border-borderLine space-x-4 text-sm font-semibold">
        <button
          onClick={() => setSearchParams({ tab: 'mentees' })}
          className={`pb-3 transition-colors ${
            activeTab === 'mentees' ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-textSecondary hover:text-textPrimary'
          }`}
        >
          Assigned Mentee Directory ({mentees.length})
        </button>
        <button
          onClick={() => setSearchParams({ tab: 'analytics' })}
          className={`pb-3 transition-colors ${
            activeTab === 'analytics' ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-textSecondary hover:text-textPrimary'
          }`}
        >
          Department CGPA Analytics
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          iconBgColor="bg-brand-soft text-brand-primary"
          label="Assigned Mentees"
          value={mentees.length}
          subtext="Under your guidance"
        />
        <StatCard
          icon={<BookOpen className="w-5 h-5" />}
          iconBgColor="bg-indigo-50 text-indigo-600"
          label="Department Avg GPA"
          value={deptReport?.avgGpa || 9.15}
          subtext="Out of 10.0 scale"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          iconBgColor="bg-success-soft text-success"
          label="Avg Academic Score"
          value={`${deptReport?.avgEmployabilityScore || 88.5} / 100`}
          subtext="High performance standing"
        />
        <StatCard
          icon={<Award className="w-5 h-5" />}
          iconBgColor="bg-amber-50 text-amber-600"
          label="Top Standing Mentees"
          value={mentees.length}
          subtext="High academic performance"
        />
      </div>

      {/* Tab 1: Mentee Directory */}
      {activeTab === 'mentees' && (
        <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-base font-bold text-textPrimary">Assigned Mentee Directory</h3>
              <p className="text-xs text-textSecondary">Search and inspect mentee 360° academic progress</p>
            </div>

              <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-borderLine bg-background text-xs w-56">
                <Search className="w-4 h-4 text-textSecondary shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name or reg no..."
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
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Registration No</th>
                  <th className="py-3 px-4">Dept / Batch / Sec</th>
                  <th className="py-3 px-4">Academic Year</th>
                  <th className="py-3 px-4">Hostel / Day</th>
                  <th className="py-3 px-4">Academic Standing</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderLine text-sm">
                {filteredMentees.map((mentee) => (
                  <tr key={mentee.roll_number} className="hover:bg-background/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-primary text-white font-bold flex items-center justify-center text-xs">
                          {mentee.name.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-semibold text-textPrimary leading-tight">{mentee.name}</p>
                          <p className="text-[11px] text-textSecondary">{mentee.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-brand-primary text-xs">{mentee.roll_number}</td>
                    <td className="py-3.5 px-4 text-xs">{mentee.department} • {mentee.batch} • Sec {mentee.section}</td>
                    <td className="py-3.5 px-4 text-xs font-medium text-textPrimary">{mentee.year}</td>
                    <td className="py-3.5 px-4 text-xs text-textSecondary">{mentee.hostel_day_scholar}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-success-soft text-success border border-green-200">
                        High Standing (GPA 9.0+)
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setInspectMentee(mentee)}
                          className="p-1.5 rounded-lg border border-borderLine text-brand-primary hover:bg-brand-soft"
                          title="View 360° Profile"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedMentee(mentee);
                            setRemarkInput('');
                          }}
                          className="p-1.5 rounded-lg border border-borderLine text-textPrimary hover:bg-background"
                          title="Add Faculty Remarks"
                        >
                          <Edit2 className="w-4 h-4" />
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

      {/* Tab 2: Department Skill Analytics */}
      {activeTab === 'analytics' && (
        <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-textPrimary">Department Tech Skill Analytics (CSE)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-background border border-borderLine rounded-xl">
              <h4 className="font-bold text-textPrimary mb-2">Top Verified Tools</h4>
              <ul className="space-y-1 text-textSecondary">
                <li>• Claude Code & CrewAI (5/5 rating)</li>
                <li>• React & TypeScript (5/5 rating)</li>
                <li>• AWS Lambda & S3 (4/5 rating)</li>
              </ul>
            </div>
            <div className="p-4 bg-background border border-borderLine rounded-xl">
              <h4 className="font-bold text-textPrimary mb-2">Academic Grade Breakdown</h4>
              <p className="text-textSecondary">O Grade: 45% students</p>
              <p className="text-textSecondary">A+ Grade: 40% students</p>
              <p className="text-textSecondary">A Grade: 15% students</p>
            </div>
            <div className="p-4 bg-background border border-borderLine rounded-xl">
              <h4 className="font-bold text-textPrimary mb-2">Attendance Average</h4>
              <p className="text-2xl font-black text-success">95.4%</p>
            </div>
          </div>
        </div>
      )}

      {/* Edit Remarks Modal */}
      {selectedMentee && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-borderLine rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-base font-bold text-textPrimary mb-1">Evaluate Mentee: {selectedMentee.name}</h3>
            <p className="text-xs text-textSecondary mb-4">Roll Number: {selectedMentee.roll_number}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-textPrimary mb-1">Faculty / Mentor Remarks</label>
                <textarea
                  value={remarkInput}
                  onChange={(e) => setRemarkInput(e.target.value)}
                  rows={4}
                  placeholder="Enter academic observation, coding feedback, or performance notes..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <PillButton variant="outline" size="sm" onClick={() => setSelectedMentee(null)}>
                  Cancel
                </PillButton>
                <PillButton variant="primary" size="sm" onClick={handleSaveRemark} disabled={saving}>
                  Save Remarks
                </PillButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mentee 360 Inspection Modal */}
      {inspectMentee && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-borderLine rounded-2xl p-6 max-w-4xl w-full shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <button onClick={() => setInspectMentee(null)} className="absolute top-4 right-4 text-textSecondary hover:text-textPrimary p-2 rounded-full hover:bg-background">
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-borderLine pb-4 mb-6">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-brand-soft text-brand-primary">Faculty Mentee Inspection</span>
              <h3 className="text-xl font-bold text-textPrimary mt-1">
                Mentee 360° Profile: {inspectMentee.name} ({inspectMentee.roll_number})
              </h3>
              <p className="text-xs text-textSecondary">{inspectMentee.department} • {inspectMentee.year} • {inspectMentee.email}</p>
            </div>

            {/* Inspect Tabs Selector */}
            <div className="flex space-x-2 border-b border-borderLine pb-px mb-6 overflow-x-auto text-xs font-semibold">
              {['personal-info', 'academics', 'coding-profiles', 'tech-skills', 'certifications', 'soft-skills', 'achievements', 'placement-preferences'].map((t) => (
                <button
                  key={t}
                  onClick={() => setInspectTab(t)}
                  className={`px-3 py-2 rounded-t-lg transition-all capitalize whitespace-nowrap ${
                    inspectTab === t ? 'bg-brand-soft text-brand-primary font-bold border-b-2 border-brand-primary' : 'text-textSecondary hover:text-textPrimary'
                  }`}
                >
                  {t === 'placement-preferences' ? 'Academic Goals' : t.replace('-', ' ')}
                </button>
              ))}
            </div>

            {/* Inspect Tab Body */}
            <div>
              {inspectTab === 'personal-info' && <PersonalInfoTab readOnly={true} student={inspectMentee} onRefresh={refetch} />}
              {inspectTab === 'academics' && <AcademicsTab readOnly={true} academics={inspectAcademics} onRefresh={refetch} />}
              {inspectTab === 'coding-profiles' && (
                <CodingProfilesTab
                  studentName={inspectMentee.name}
                  studentRollNumber={inspectMentee.roll_number}
                  readOnly={true}
                  profiles={inspectCoding}
                  onRefresh={refetch}
                />
              )}
              {inspectTab === 'tech-skills' && <TechSkillsTab readOnly={true} skills={inspectSkills} onRefresh={refetch} />}
              {inspectTab === 'certifications' && <CertificationsTab readOnly={true} certifications={inspectCerts} onRefresh={refetch} />}
              {inspectTab === 'soft-skills' && <SoftSkillsTab readOnly={true} softSkills={inspectSoft} onRefresh={refetch} />}
              {inspectTab === 'achievements' && <AchievementsTab readOnly={true} achievements={inspectAchievements} onRefresh={refetch} />}
              {inspectTab === 'placement-preferences' && <PlacementPreferencesTab readOnly={true} placement={null} scoreData={null} onRefresh={refetch} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
