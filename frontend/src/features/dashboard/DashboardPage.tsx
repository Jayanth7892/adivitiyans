import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import {
  Award,
  Code2,
  CheckCircle2,
  TrendingUp,
  Bell,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Github,
  BarChart2,
} from 'lucide-react';
import { api } from '../../lib/api';
import { calculateProfileCompletion } from '../../lib/profileCompletion';
import { GreetingHero } from '../../components/common/GreetingHero';
import { StatCard } from '../../components/common/StatCard';
import { NudgeCard } from '../../components/common/NudgeCard';
import { useAuth } from '../../context/AuthContext';
import { EmptyState } from '../../components/common/EmptyState';
import { ProgressRing } from '../../components/common/ProgressRing';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const activeRollNo = user?.rollNumber || '23091A3251';

  // Queries for real data
  const { data: student } = useQuery({ queryKey: ['studentProfile', activeRollNo], queryFn: () => api.getStudentProfile(activeRollNo) });
  const { data: academics = [] } = useQuery({ queryKey: ['academics', activeRollNo], queryFn: () => api.getAcademics(activeRollNo) });
  const { data: codingProfiles = [] } = useQuery({ queryKey: ['codingProfiles', activeRollNo], queryFn: () => api.getCodingProfiles(activeRollNo) });
  const { data: techSkills = [] } = useQuery({ queryKey: ['techSkills', activeRollNo], queryFn: () => api.getTechSkills(activeRollNo) });
  const { data: certifications = [] } = useQuery({ queryKey: ['certifications', activeRollNo], queryFn: () => api.getCertifications(activeRollNo) });
  const { data: softSkills = [] } = useQuery({ queryKey: ['softSkills', activeRollNo], queryFn: () => api.getSoftSkills(activeRollNo) });
  const { data: achievements = [] } = useQuery({ queryKey: ['achievements', activeRollNo], queryFn: () => api.getAchievements(activeRollNo) });
  const { data: placement } = useQuery({ queryKey: ['placementProfile', activeRollNo], queryFn: () => api.getPlacementProfile(activeRollNo) });
  const { data: scoreData } = useQuery({ queryKey: ['academicScore', activeRollNo], queryFn: () => api.getEmployabilityScore(activeRollNo) });

  // Calculate live completion % & signature nudge cards using shared util
  const completionStatus = calculateProfileCompletion(
    student,
    academics,
    codingProfiles,
    techSkills,
    certifications,
    softSkills,
    achievements,
    placement
  );

  // Radar chart data from tech skills
  const radarData = techSkills.slice(0, 6).map((skill) => ({
    subject: skill.specific_tool,
    A: skill.self_rating,
    fullMark: 5,
  }));

  const handleNudgeClick = (tabSlug: string) => {
    navigate(`/profile?tab=${tabSlug}`);
  };

  const displayName = user?.name || student?.name || 'Student';

  return (
    <div className="space-y-6">
      {/* 1. Greeting Hero */}
      <GreetingHero
        name={displayName}
        completionPercentage={completionStatus.totalPercentage}
        onEditProfile={() => navigate('/profile')}
      />

      {/* 60/40 Split Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Column (60% ~ 7 cols in 12 grid) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Stat Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard
              icon={<TrendingUp className="w-5 h-5" />}
              iconBgColor="bg-brand-soft text-brand-primary"
              label="Academic Performance Score"
              value={`${scoreData?.overallScore || 92.4}/100`}
              subtext="Computed from GPA & coding activity"
              onClick={() => navigate('/profile?tab=placement-preferences')}
            />
            <StatCard
              icon={<CheckCircle2 className="w-5 h-5" />}
              iconBgColor="bg-success-soft text-success"
              label="Certifications Earned"
              value={certifications.filter((c) => !c.suggested).length}
              subtext={`${certifications.filter((c) => c.suggested).length} recommended certs`}
              onClick={() => navigate('/profile?tab=certifications')}
            />
            <StatCard
              icon={<Code2 className="w-5 h-5" />}
              iconBgColor="bg-indigo-50 text-indigo-600"
              label="Coding Profiles"
              value={`${codingProfiles.length} / 6`}
              subtext="Linked technical handles"
              onClick={() => navigate('/profile?tab=coding-profiles')}
            />
            <StatCard
              icon={<Award className="w-5 h-5" />}
              iconBgColor="bg-amber-50 text-amber-600"
              label="Tech Skills Tracked"
              value={techSkills.length}
              subtext="Self & faculty verified skills"
              onClick={() => navigate('/profile?tab=tech-skills')}
            />
          </div>

          {/* Skill Snapshot Radar Chart Card */}
          <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-textPrimary">Skill Snapshot</h3>
                <p className="text-xs text-textSecondary">Radar representation of top technical self-ratings</p>
              </div>
              <button
                onClick={() => navigate('/profile?tab=tech-skills')}
                className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {radarData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke="#EAECEF" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#4B5563', fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 5]} stroke="#CBD5E1" />
                    <Radar
                      name="Rating"
                      dataKey="A"
                      stroke="#5B4FE9"
                      fill="#5B4FE9"
                      fillOpacity={0.4}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                icon={<Code2 className="w-6 h-6" />}
                title="No Skills Added"
                description="Add your technical skills and tools in your profile to render the radar chart snapshot."
                action={
                  <button
                    onClick={() => navigate('/profile?tab=tech-skills')}
                    className="px-4 py-2 text-xs font-semibold rounded-full bg-brand-primary text-white"
                  >
                    Add Skills Now
                  </button>
                }
              />
            )}
          </div>

          {/* Recent Achievements Card */}
          <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-textPrimary">Recent Achievements</h3>
                <p className="text-xs text-textSecondary">Hackathons, capstone projects, and industry events</p>
              </div>
              <button
                onClick={() => navigate('/profile?tab=achievements')}
                className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1"
              >
                <span>View Timeline</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {achievements.length > 0 ? (
              <div className="space-y-3">
                {achievements.slice(0, 3).map((item) => (
                  <div key={item.id || item.title} className="p-3.5 rounded-lg border border-borderLine bg-background flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-soft text-brand-primary">
                          {item.type}
                        </span>
                        <span className="text-xs text-textSecondary">{item.achievement_date || '2024'}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-textPrimary mt-1">{item.title}</h4>
                      <p className="text-xs text-textSecondary line-clamp-1 mt-0.5">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Award className="w-6 h-6" />}
                title="No Achievements Yet"
                description="Document your hackathons, conferences, and capstone projects to showcase your growth."
              />
            )}
          </div>
        </div>

        {/* Right Column (40% ~ 5 cols in 12 grid) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Completion Ring Card */}
          <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm text-center">
            <h3 className="text-sm font-bold text-textPrimary mb-1">Profile Completion Status</h3>
            <p className="text-xs text-textSecondary mb-4">Complete all 8 sections to maximize academic evaluation</p>

            <div className="py-2">
              <ProgressRing percentage={completionStatus.totalPercentage} size={110} strokeWidth={10} />
            </div>

            <p className="text-xs font-medium text-textSecondary mt-3">
              <span className="font-bold text-textPrimary">{completionStatus.sectionsCompleteCount}</span> of {completionStatus.totalSectionsCount} profile sections completed
            </p>
          </div>

          {/* Coding Snapshot Widget */}
          <div className="bg-surface border border-borderLine rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-textPrimary flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#FFA116]" />
                Coding Snapshot
              </h3>
              <button onClick={() => navigate('/profile?tab=coding-profiles')}
                className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-3">
              {codingProfiles.find((p) => p.platform === 'LeetCode') ? (
                <div className="p-3 rounded-xl bg-background border border-borderLine flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-[11px]" style={{ background: '#FFA116' }}>LC</div>
                    <div>
                      <p className="text-xs font-bold text-textPrimary">LeetCode</p>
                      <p className="text-[11px] text-textSecondary">@{codingProfiles.find((p) => p.platform === 'LeetCode')?.handle}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-extrabold" style={{ color: '#FFA116' }}>{codingProfiles.find((p) => p.platform === 'LeetCode')?.score_rating}</p>
                    <p className="text-[10px] text-textSecondary">Rating</p>
                  </div>
                </div>
              ) : (
                <button onClick={() => navigate('/profile?tab=coding-profiles')}
                  className="w-full p-3 rounded-xl border border-dashed border-borderLine text-xs text-textSecondary hover:border-[#FFA116] hover:text-[#FFA116] transition-all text-left flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#FFA116]/10 flex items-center justify-center text-[#FFA116] font-black text-[10px]">LC</div>
                  Connect LeetCode →
                </button>
              )}
              {codingProfiles.find((p) => p.platform === 'GitHub') ? (
                <div className="p-3 rounded-xl bg-background border border-borderLine flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
                      <Github className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-textPrimary">GitHub</p>
                      <p className="text-[11px] text-textSecondary">@{codingProfiles.find((p) => p.platform === 'GitHub')?.handle}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-extrabold text-textPrimary">{codingProfiles.find((p) => p.platform === 'GitHub')?.repositories_count}</p>
                    <p className="text-[10px] text-textSecondary">Repos</p>
                  </div>
                </div>
              ) : (
                <button onClick={() => navigate('/profile?tab=coding-profiles')}
                  className="w-full p-3 rounded-xl border border-dashed border-borderLine text-xs text-textSecondary hover:border-gray-900 hover:text-gray-900 transition-all text-left flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Github className="w-3.5 h-3.5 text-gray-700" />
                  </div>
                  Connect GitHub →
                </button>
              )}
              <button onClick={() => navigate('/coding-analytics')}
                className="w-full py-2 text-xs font-bold text-brand-primary hover:underline flex items-center justify-center gap-1">
                <BarChart2 className="w-3.5 h-3.5" /> View Program Leaderboard
              </button>
            </div>
          </div>

          {/* Signature Interaction: Complete Your Profile (Nudge Cards Column) */}
          <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-textPrimary flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-primary" />
                <span>Complete Your Profile</span>
              </h3>
              <span className="text-xs font-semibold text-alert bg-alert-soft px-2 py-0.5 rounded-full">
                {completionStatus.nudges.length} Prompts
              </span>
            </div>

            {completionStatus.nudges.length > 0 ? (
              <div className="space-y-3">
                {completionStatus.nudges.map((nudge) => (
                  <NudgeCard
                    key={nudge.id}
                    title={nudge.title}
                    message={nudge.message}
                    ctaText={nudge.ctaText}
                    onClick={() => handleNudgeClick(nudge.tabSlug)}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-success-soft border border-green-200 rounded-xl p-6 text-center">
                <CheckCircle className="w-8 h-8 text-success mx-auto mb-2" />
                <h4 className="text-sm font-bold text-textPrimary">Your profile is 100% complete! 🎉</h4>
                <p className="text-xs text-textSecondary mt-1">Great job! All technical profiles, certifications, and academic data are updated.</p>
              </div>
            )}
          </div>

          {/* Announcements Card */}
          <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-brand-primary" />
              <h3 className="text-sm font-bold text-textPrimary">Announcements</h3>
            </div>
            <EmptyState
              icon={<Bell className="w-5 h-5" />}
              title="No Announcements"
              description="Check back later for important department notices, exam schedules, and university news."
            />
          </div>
        </div>
      </div>
    </div>
  );
};
