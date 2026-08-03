export interface EmployabilityData {
  academics: { semester_gpa: number | string }[];
  codingProfiles: { platform: string; score_rating: number | string; commits_count: number; streak: number }[];
  techSkills: { self_rating: number }[];
  certifications: { suggested?: boolean }[];
  softSkills: { rating: number }[];
  achievements: { type: string }[];
}

export interface ScoreBreakdown {
  overallScore: number;
  academicsScore: number; // Max 25
  codingScore: number;    // Max 20
  techSkillsScore: number;// Max 20
  certsScore: number;     // Max 15
  softSkillsScore: number;// Max 10
  achievementsScore: number;// Max 10
  feedback: string[];
}

export function calculateEmployabilityScore(data: EmployabilityData): ScoreBreakdown {
  const feedback: string[] = [];

  // 1. Academics (25%): Average GPA scaled out of 10 -> score out of 25
  let academicsScore = 0;
  if (data.academics && data.academics.length > 0) {
    const totalGpa = data.academics.reduce((sum, a) => sum + Number(a.semester_gpa || 0), 0);
    const avgGpa = totalGpa / data.academics.length;
    academicsScore = Math.min(25, (avgGpa / 10) * 25);
  } else {
    feedback.push("Add semester GPA data under Academics to boost your score.");
  }

  // 2. Coding Profiles (20%)
  let codingScore = 0;
  if (data.codingProfiles && data.codingProfiles.length > 0) {
    const linkedPlatforms = data.codingProfiles.length;
    const platformPoints = Math.min(8, linkedPlatforms * 2.5); // Up to 8 pts for profiles
    const totalRating = data.codingProfiles.reduce((sum, c) => sum + Number(c.score_rating || 0), 0);
    const ratingPoints = Math.min(8, (totalRating / 1500) * 8); // Up to 8 pts for rating
    const totalCommits = data.codingProfiles.reduce((sum, c) => sum + (c.commits_count || 0), 0);
    const commitPoints = Math.min(4, (totalCommits / 200) * 4); // Up to 4 pts for activity
    codingScore = Math.min(20, platformPoints + ratingPoints + commitPoints);
  } else {
    feedback.push("Link GitHub & LeetCode coding profiles to demonstrate technical activity.");
  }

  // 3. Tech Skills (20%)
  let techSkillsScore = 0;
  if (data.techSkills && data.techSkills.length > 0) {
    const countPoints = Math.min(10, data.techSkills.length * 2); // 2 pts per skill up to 10
    const avgRating = data.techSkills.reduce((sum, s) => sum + Number(s.self_rating || 0), 0) / data.techSkills.length;
    const ratingPoints = (avgRating / 5) * 10; // Up to 10 pts for ratings
    techSkillsScore = Math.min(20, countPoints + ratingPoints);
  } else {
    feedback.push("Add key technical skills & tools with self-ratings.");
  }

  // 4. Certifications (15%)
  let certsScore = 0;
  if (data.certifications && data.certifications.length > 0) {
    const completedCerts = data.certifications.filter(c => !c.suggested);
    certsScore = Math.min(15, completedCerts.length * 5); // 5 pts per cert up to 15
  } else {
    feedback.push("Upload industry certifications (AWS, Coursera, NPTEL) to validate expertise.");
  }

  // 5. Soft Skills (10%)
  let softSkillsScore = 0;
  if (data.softSkills && data.softSkills.length > 0) {
    const avgSoft = data.softSkills.reduce((sum, s) => sum + Number(s.rating || 0), 0) / data.softSkills.length;
    softSkillsScore = Math.min(10, (avgSoft / 5) * 10);
  } else {
    feedback.push("Rate your soft skills to complete your professional evaluation.");
  }

  // 6. Achievements (10%)
  let achievementsScore = 0;
  if (data.achievements && data.achievements.length > 0) {
    achievementsScore = Math.min(10, data.achievements.length * 3.34); // ~3.34 pts per achievement up to 10
  } else {
    feedback.push("Add hackathons, capstone projects, or conference presentations.");
  }

  const overallScore = Math.round(
    (academicsScore + codingScore + techSkillsScore + certsScore + softSkillsScore + achievementsScore) * 10
  ) / 10;

  return {
    overallScore: Math.min(100, overallScore),
    academicsScore: Math.round(academicsScore * 10) / 10,
    codingScore: Math.round(codingScore * 10) / 10,
    techSkillsScore: Math.round(techSkillsScore * 10) / 10,
    certsScore: Math.round(certsScore * 10) / 10,
    softSkillsScore: Math.round(softSkillsScore * 10) / 10,
    achievementsScore: Math.round(achievementsScore * 10) / 10,
    feedback,
  };
}
