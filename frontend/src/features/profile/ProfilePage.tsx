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

  const currentTab = searchParams.get('tab') || 'personal-info';

  const setTab = (slug: string) => {
    setSearchParams({ tab: slug });
  };

  // Queries for profile sections
  const { data: student, refetch: refetchStudent } = useQuery({ queryKey: ['studentProfile'], queryFn: () => api.getStudentProfile() });
  const { data: academics = [], refetch: refetchAcademics } = useQuery({ queryKey: ['academics'], queryFn: () => api.getAcademics() });
  const { data: codingProfiles = [], refetch: refetchCoding } = useQuery({ queryKey: ['codingProfiles'], queryFn: () => api.getCodingProfiles() });
  const { data: techSkills = [], refetch: refetchSkills } = useQuery({ queryKey: ['techSkills'], queryFn: () => api.getTechSkills() });
  const { data: certifications = [], refetch: refetchCerts } = useQuery({ queryKey: ['certifications'], queryFn: () => api.getCertifications() });
  const { data: softSkills = [], refetch: refetchSoft } = useQuery({ queryKey: ['softSkills'], queryFn: () => api.getSoftSkills() });
  const { data: achievements = [], refetch: refetchAchievements } = useQuery({ queryKey: ['achievements'], queryFn: () => api.getAchievements() });
  const { data: placement, refetch: refetchPlacement } = useQuery({ queryKey: ['placementProfile'], queryFn: () => api.getPlacementProfile() });
  const { data: scoreData, refetch: refetchScore } = useQuery({ queryKey: ['employabilityScore'], queryFn: () => api.getEmployabilityScore() });

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

  // If currentTab is 'coding-profiles', render standalone matching BytsOne layout
  if (currentTab === 'coding-profiles') {
    return <CodingProfilesTab profiles={codingProfiles} onRefresh={handleRefreshAll} />;
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-surface border border-borderLine rounded-2xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-center gap-6">
        <div className="relative group">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-brand-primary text-white font-black text-2xl flex items-center justify-center shadow-md border-4 border-surface ring-2 ring-brand-soft">
            {student?.name
              ?.split(' ')
              .map((n) => n[0])
              .join('') || 'JK'}
          </div>
          <button className="absolute bottom-0 right-0 p-2 rounded-full bg-surface border border-borderLine text-textPrimary shadow-sm hover:bg-background transition-all">
            <Camera className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-center md:text-left flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
            <h1 className="text-xl md:text-2xl font-extrabold text-textPrimary">{student?.name || 'Jayanth Kumar'}</h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-soft text-brand-primary border border-brand-primary/20">
              {student?.roll_number || '23091A3251'}
            </span>
          </div>
          <p className="text-xs text-textSecondary mt-1.5 font-medium">
            {student?.department || 'CSE'} • Batch {student?.batch || '2023-2027'} • Section {student?.section || 'A'} • {student?.year || '3rd Year'}
          </p>
          <p className="text-xs text-textSecondary mt-0.5">{student?.email || 'jayanth@rgmcet.edu.in'}</p>
        </div>
      </div>

      {/* 8 Deep-Linkable Tabs */}
      <div className="border-b border-borderLine overflow-x-auto">
        <nav className="flex space-x-2 pb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.slug;
            return (
              <button
                key={tab.slug}
                onClick={() => setTab(tab.slug)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
                  isActive
                    ? 'border-brand-primary text-brand-primary bg-brand-soft/40 rounded-t-lg'
                    : 'border-transparent text-textSecondary hover:text-textPrimary hover:border-borderLine'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Render Active Tab Content */}
      <div className="pt-2">
        {currentTab === 'personal-info' && <PersonalInfoTab student={student} onRefresh={handleRefreshAll} />}
        {currentTab === 'academics' && <AcademicsTab academics={academics} onRefresh={handleRefreshAll} />}
        {currentTab === 'tech-skills' && <TechSkillsTab skills={techSkills} onRefresh={handleRefreshAll} />}
        {currentTab === 'certifications' && <CertificationsTab certifications={certifications} onRefresh={handleRefreshAll} />}
        {currentTab === 'soft-skills' && <SoftSkillsTab softSkills={softSkills} onRefresh={handleRefreshAll} />}
        {currentTab === 'achievements' && <AchievementsTab achievements={achievements} onRefresh={handleRefreshAll} />}
        {currentTab === 'placement-preferences' && (
          <PlacementPreferencesTab placement={placement} scoreData={scoreData} onRefresh={handleRefreshAll} />
        )}
      </div>
    </div>
  );
};
