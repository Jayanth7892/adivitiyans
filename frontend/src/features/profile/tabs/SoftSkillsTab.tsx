import React, { useState } from 'react';
import { Zap, Plus, Award } from 'lucide-react';
import { SoftSkill, Extracurricular } from '../../../types';
import { api } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { PillButton } from '../../../components/common/PillButton';

interface SoftSkillsTabProps {
  softSkills: SoftSkill[];
  readOnly?: boolean;
  onRefresh: () => void;
}

const CORE_SOFT_SKILLS = [
  'Leadership',
  'Communication',
  'Teamwork',
  'Time Management',
  'Public Speaking',
  'Learning Ability',
  'Professionalism',
] as const;

export const SoftSkillsTab: React.FC<SoftSkillsTabProps> = ({ softSkills, readOnly = false, onRefresh }) => {
  const [savingSkill, setSavingSkill] = useState<string | null>(null);
  const { user } = useAuth();
  const activeRollNo = user?.rollNumber || '23091A3251';

  const handleRatingChange = async (skillName: any, ratingValue: number) => {
    if (readOnly) return;
    setSavingSkill(skillName);
    try {
      await api.saveSoftSkill(activeRollNo, {
        skill: skillName,
        rating: ratingValue,
        rated_by: 'self',
      });
      onRefresh();
    } catch (e: any) {
      alert('Failed to save soft skill rating');
    } finally {
      setSavingSkill(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-textPrimary">Soft Skills & Professional Evaluation</h3>
        <p className="text-xs text-textSecondary mb-6">Self-evaluate your core interpersonal skills (1 to 5 scale)</p>

        <div className="space-y-5">
          {CORE_SOFT_SKILLS.map((skillName) => {
            const selfRating = softSkills.find((s) => s.skill === skillName && s.rated_by === 'self')?.rating || 4;
            const facultyRating = softSkills.find((s) => s.skill === skillName && s.rated_by === 'faculty')?.rating;

            return (
              <div key={skillName} className="p-4 rounded-xl border border-borderLine bg-background flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-brand-soft text-brand-primary">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-textPrimary">{skillName}</h4>
                    {facultyRating && (
                      <span className="text-[10px] font-semibold text-success bg-success-soft px-2 py-0.5 rounded">
                        Faculty Rated: {facultyRating}/5
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => handleRatingChange(skillName, star)}
                        className={`w-8 h-8 rounded-lg font-bold text-xs transition-all ${
                          selfRating >= star
                            ? 'bg-brand-primary text-white shadow-sm'
                            : 'bg-surface border border-borderLine text-textSecondary hover:bg-background'
                        }`}
                      >
                        {star}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-bold text-brand-primary w-12 text-right">{selfRating} / 5</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
