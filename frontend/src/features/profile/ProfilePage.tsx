import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  User,
  BookOpen,
  Code2,
  Cpu,
  CheckCircle2,
  Zap,
  Award,
  Target,
  Camera,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { PersonalInfoTab } from './tabs/PersonalInfoTab';
import { AcademicsTab } from './tabs/AcademicsTab';
import { CodingProfilesTab } from './tabs/CodingProfilesTab';
import { TechSkillsTab } from './tabs/TechSkillsTab';
import { CertificationsTab } from './tabs/CertificationsTab';
import { SoftSkillsTab } from './tabs/SoftSkillsTab';
import { AchievementsTab } from './tabs/AchievementsTab';
import { PlacementPreferencesTab } from './tabs/PlacementPreferencesTab';

export const ProfilePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // ?id=ROLLNO means admin/HOD is viewing a specific student's profile from search.
  // Fall back to the logged-in user's own roll number for students on their own profile.
  const viewId = searchParams.get('id') || '';
  const activeRollNo = viewId || user?.rollNumber || '';
  const isViewingOther = Boolean(viewId && viewId !== user?.rollNumber);

  const currentTab = searchParams.get('tab') || 'personal-info';

  const setTab = (slug: string) => {
    // Preserve ?id= param while switching tabs
    const params: Record<string, string> = { tab: slug };
    if (viewId) params.id = viewId;
    setSearchParams(params);
  };

  // Queries for profile sections — all keyed by activeRollNo so switching students busts cache
  const { data: student, refetch: refetchStudent } = useQuery({ queryKey: ['studentProfile', activeRollNo], queryFn: () => api.getStudentProfile(activeRollNo), enabled: Boolean(activeRollNo) });
  const { data: academics = [], refetch: refetchAcademics } = useQuery({ queryKey: ['academics', activeRollNo], queryFn: () => api.getAcademics(activeRollNo), enabled: Boolean(activeRollNo) });
  const { data: codingProfiles = [], refetch: refetchCoding } = useQuery({ queryKey: ['codingProfiles', activeRollNo], queryFn: () => api.getCodingProfiles(activeRollNo), enabled: Boolean(activeRollNo) });
  const { data: techSkills = [], refetch: refetchSkills } = useQuery({ queryKey: ['techSkills', activeRollNo], queryFn: () => api.getTechSkills(activeRollNo), enabled: Boolean(activeRollNo) });
  const { data: certifications = [], refetch: refetchCerts } = useQuery({ queryKey: ['certifications', activeRollNo], queryFn: () => api.getCertifications(activeRollNo), enabled: Boolean(activeRollNo) });
  const { data: softSkills = [], refetch: refetchSoft } = useQuery({ queryKey: ['softSkills', activeRollNo], queryFn: () => api.getSoftSkills(activeRollNo), enabled: Boolean(activeRollNo) });
  const { data: achievements = [], refetch: refetchAchievements } = useQuery({ queryKey: ['achievements', activeRollNo], queryFn: () => api.getAchievements(activeRollNo), enabled: Boolean(activeRollNo) });
  const { data: placement, refetch: refetchPlacement } = useQuery({ queryKey: ['placementProfile', activeRollNo], queryFn: () => api.getPlacementProfile(activeRollNo), enabled: Boolean(activeRollNo) });
  const { data: scoreData, refetch: refetchScore } = useQuery({ queryKey: ['employabilityScore', activeRollNo], queryFn: () => api.getEmployabilityScore(activeRollNo), enabled: Boolean(activeRollNo), staleTime: 0, refetchOnMount: 'always' });

  // Guard: no roll number at all (admin/HOD on /profile with no ?id= param)
  if (!activeRollNo) {
    return (
      <div className="flex items-center justify-center h-64 text-textSecondary text-sm">
        <p>No student profile linked to this account.</p>
      </div>
    );
  }


  const handleRefreshAll = () => {
    refetchStudent();
    refetchAcademics();
    refetchCoding();
    refetchSkills();
    refetchCerts();
    refetchSoft();
    refetchAchievements();
    refetchPlacement();
    refetchScore();
    queryClient.invalidateQueries();
  };

  const tabs = [
    { slug: 'personal-info', label: 'Personal Info', icon: User },
    { slug: 'academics', label: 'Academics', icon: BookOpen },
    { slug: 'coding-profiles', label: 'Coding Profiles', icon: Code2 },
    { slug: 'tech-skills', label: 'Tech Skills', icon: Cpu },
    { slug: 'certifications', label: 'Certifications', icon: CheckCircle2 },
    { slug: 'soft-skills', label: 'Soft Skills & Extracurriculars', icon: Zap },
    { slug: 'achievements', label: 'Achievements', icon: Award },
    { slug: 'placement-preferences', label: 'Academic Growth Target', icon: Target },
  ];

  const displayName = student?.name || user?.name || 'Student Profile';
  const displayRollNo = student?.roll_number || user?.rollNumber || '';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'S';

  // Coding-profiles tab: render standalone full-page layout.
  // IMPORTANT: always pass the target studentRollNumber so the section fetches
  // the viewed student's handles — not the logged-in user's (HOD/admin has no handles).
  if (currentTab === 'coding-profiles') {
    return (
      <CodingProfilesTab
        onRefresh={handleRefreshAll}
        studentRollNumber={activeRollNo}
        studentName={student?.name || displayName}
        readOnly={isViewingOther}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Read-only banner */}
      {isViewingOther && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-warning-soft border border-warning/30 text-warning text-xs font-semibold">
          <span>👁️ Viewing read-only profile of <span className="font-extrabold">{displayName}</span> ({displayRollNo}). Changes are disabled.</span>
        </div>
      )}

      {/* Profile Header Card */}
      <div className="relative bg-surface border border-borderLine rounded-2xl overflow-hidden shadow-sm">
        {/* Gradient strip */}
        <div className="h-20 w-full" style={{ background: 'linear-gradient(135deg, var(--color-brand-primary) 0%, #818CF8 100%)' }} />
        <div className="px-6 pb-6 md:px-8 md:pb-8 -mt-10">
          <div className="flex flex-col md:flex-row md:items-end gap-5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-brand-primary text-white font-black text-2xl flex items-center justify-center shadow-lg border-4 border-surface ring-2 ring-brand-soft">
                {initials}
              </div>
              <button className="absolute -bottom-1 -right-1 p-1.5 rounded-xl bg-surface border border-borderLine text-textSecondary shadow-sm hover:text-textPrimary transition-all">
                <Camera className="w-3 h-3" />
              </button>
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0 pt-2 md:pb-1">
              <div className="flex flex-wrap items-center gap-2.5 mb-1">
                <h1 className="text-xl md:text-2xl font-extrabold text-textPrimary">{displayName}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-soft text-brand-primary border border-brand-primary/20">
                  {displayRollNo}
                </span>
              </div>
              <p className="text-xs text-textSecondary font-medium">
                {(!student?.department || student.department === 'CSE' || student.department === 'Data Science' || student.department === 'CSE (Data Science)') ? 'CSE(Data Science)' : student.department}{student?.batch ? ` • Batch ${student.batch}` : ''}{student?.section ? ` • Sec ${student.section}` : ''}{student?.year ? ` • ${student.year}` : ''}
              </p>
              <p className="text-xs text-textMuted mt-0.5">{student?.email || user?.email || 'No email'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 8 Deep-Linkable Tabs */}
      <div className="bg-surface border border-borderLine rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <nav className="flex px-2 pt-2 pb-0 gap-1 border-b border-borderLine">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.slug;
              return (
                <button
                  key={tab.slug}
                  onClick={() => setTab(tab.slug)}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-all rounded-t-lg ${
                    isActive
                      ? 'border-brand-primary text-brand-primary bg-brand-soft'
                      : 'border-transparent text-textSecondary hover:text-textPrimary hover:bg-surface-2'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        {/* Tab content */}
        <div className="p-6">
          {currentTab === 'personal-info' && <PersonalInfoTab student={student} academics={academics} onRefresh={handleRefreshAll} readOnly={isViewingOther} />}
          {currentTab === 'academics' && <AcademicsTab academics={academics} studentYear={student?.year} onRefresh={handleRefreshAll} readOnly={isViewingOther} />}
          {currentTab === 'tech-skills' && <TechSkillsTab skills={techSkills} onRefresh={handleRefreshAll} readOnly={isViewingOther} />}
          {currentTab === 'certifications' && <CertificationsTab certifications={certifications} onRefresh={handleRefreshAll} readOnly={isViewingOther} />}
          {currentTab === 'soft-skills' && <SoftSkillsTab softSkills={softSkills} onRefresh={handleRefreshAll} readOnly={isViewingOther} />}
          {currentTab === 'achievements' && <AchievementsTab achievements={achievements} onRefresh={handleRefreshAll} readOnly={isViewingOther} />}
          {currentTab === 'placement-preferences' && (
            <PlacementPreferencesTab placement={placement} scoreData={scoreData} onRefresh={handleRefreshAll} />
          )}
        </div>
      </div>
    </div>
  );
};

