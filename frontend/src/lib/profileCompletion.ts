import {
  StudentProfile,
  AcademicRecord,
  CodingProfile,
  TechSkill,
  Certification,
  SoftSkill,
  Achievement,
  PlacementProfile,
} from '../types';

export interface ProfileNudge {
  id: string;
  title: string;
  message: string;
  tabSlug: string;
  ctaText: string;
}

export interface ProfileCompletionStatus {
  totalPercentage: number;
  sectionsCompleteCount: number;
  totalSectionsCount: number;
  nudges: ProfileNudge[];
  missingSections: string[];
}

export function calculateProfileCompletion(
  student?: StudentProfile | null,
  academics: AcademicRecord[] = [],
  codingProfiles: CodingProfile[] = [],
  techSkills: TechSkill[] = [],
  certifications: Certification[] = [],
  softSkills: SoftSkill[] = [],
  achievements: Achievement[] = [],
  placement?: PlacementProfile | null
): ProfileCompletionStatus {
  let score = 0;
  const total = 100;
  const nudges: ProfileNudge[] = [];
  const missingSections: string[] = [];
  let completeSections = 0;

  // Section 1: Personal Info (weight: 15%)
  const hasPhone = Boolean(student?.phone);
  const hasLinkedIn = Boolean(student?.linkedin_url);
  const hasResume = Boolean(student?.resume_url);
  
  if (student && hasPhone && hasLinkedIn) {
    score += 15;
    completeSections++;
  } else {
    score += student ? 8 : 0;
    missingSections.push('Personal Info');
    if (!hasLinkedIn) {
      nudges.push({
        id: 'nudge-linkedin',
        title: 'Add External Profile',
        message: "You haven't linked your LinkedIn profile yet.",
        tabSlug: 'personal-info',
        ctaText: 'Add LinkedIn URL',
      });
    }
    if (!hasResume) {
      nudges.push({
        id: 'nudge-resume',
        title: 'Upload Resume',
        message: "You haven't uploaded a professional resume PDF.",
        tabSlug: 'certifications',
        ctaText: 'Upload Resume',
      });
    }
  }

  // Section 2: Academics (weight: 15%)
  if (academics.length > 0) {
    score += 15;
    completeSections++;
  } else {
    missingSections.push('Academics');
    nudges.push({
      id: 'nudge-academics',
      title: 'Add Academic Record',
      message: 'No semester GPA or attendance records found.',
      tabSlug: 'academics',
      ctaText: 'Add Semester Data',
    });
  }

  // Section 3: Coding Profiles (weight: 15%)
  const hasGithub = codingProfiles.some(p => p.platform === 'GitHub');
  const hasLeetcode = codingProfiles.some(p => p.platform === 'LeetCode');
  
  if (hasGithub && hasLeetcode) {
    score += 15;
    completeSections++;
  } else {
    score += codingProfiles.length > 0 ? 8 : 0;
    missingSections.push('Coding Profiles');
    if (!hasGithub) {
      nudges.push({
        id: 'nudge-github',
        title: 'Link GitHub Account',
        message: "You haven't linked your GitHub developer profile.",
        tabSlug: 'coding-profiles',
        ctaText: 'Add GitHub Handle',
      });
    }
    if (!hasLeetcode) {
      nudges.push({
        id: 'nudge-leetcode',
        title: 'Link LeetCode Profile',
        message: "You haven't linked your LeetCode problem solving profile.",
        tabSlug: 'coding-profiles',
        ctaText: 'Add LeetCode Handle',
      });
    }
  }

  // Section 4: Tech Skills (weight: 15%)
  if (techSkills.length >= 3) {
    score += 15;
    completeSections++;
  } else {
    score += Math.min(10, techSkills.length * 3);
    missingSections.push('Tech Skills');
    nudges.push({
      id: 'nudge-skills',
      title: 'Track Tech Skills',
      message: 'Add at least 3 technical skills (e.g. Claude Code, React, AWS).',
      tabSlug: 'tech-skills',
      ctaText: 'Add Technical Skills',
    });
  }

  // Section 5: Certifications (weight: 10%)
  const completedCerts = certifications.filter(c => !c.suggested);
  if (completedCerts.length > 0) {
    score += 10;
    completeSections++;
  } else {
    missingSections.push('Certifications');
    nudges.push({
      id: 'nudge-certs',
      title: 'Add Certifications',
      message: 'Upload your verified Coursera, NPTEL or AWS certificates.',
      tabSlug: 'certifications',
      ctaText: 'Add Certifications',
    });
  }

  // Section 6: Soft Skills & Activities (weight: 10%)
  if (softSkills.length >= 5) {
    score += 10;
    completeSections++;
  } else {
    score += Math.min(6, softSkills.length * 1.2);
    missingSections.push('Soft Skills');
    nudges.push({
      id: 'nudge-soft-skills',
      title: 'Rate Soft Skills',
      message: 'Rate your leadership, communication, and teamwork skills.',
      tabSlug: 'soft-skills',
      ctaText: 'Complete Soft Skills',
    });
  }

  // Section 7: Achievements (weight: 10%)
  if (achievements.length > 0) {
    score += 10;
    completeSections++;
  } else {
    missingSections.push('Achievements');
    nudges.push({
      id: 'nudge-achievements',
      title: 'Add Achievements',
      message: 'Record your hackathons, capstone projects, or events.',
      tabSlug: 'achievements',
      ctaText: 'Add Achievement',
    });
  }

  // Section 8: Placement Preferences (weight: 10%)
  if (placement && placement.preferred_career && placement.dream_company?.length > 0) {
    score += 10;
    completeSections++;
  } else {
    missingSections.push('Placement Preferences');
    nudges.push({
      id: 'nudge-placement',
      title: 'Placement Preferences',
      message: 'Set your dream companies and preferred career roles.',
      tabSlug: 'placement-preferences',
      ctaText: 'Set Placement Goals',
    });
  }

  return {
    totalPercentage: Math.min(100, Math.round(score)),
    sectionsCompleteCount: completeSections,
    totalSectionsCount: 8,
    nudges,
    missingSections,
  };
}
