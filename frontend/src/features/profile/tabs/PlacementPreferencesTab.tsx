import React, { useState } from 'react';
import { Target, Sparkles, Building, Check, Edit2, Save, X, BookOpen, Award } from 'lucide-react';
import { PlacementProfile, ScoreBreakdown } from '../../../types';
import { api } from '../../../lib/api';
import { PillButton } from '../../../components/common/PillButton';

interface PlacementPreferencesTabProps {
  placement?: PlacementProfile | null;
  scoreData?: ScoreBreakdown | null;
  onRefresh: () => void;
}

export const PlacementPreferencesTab: React.FC<PlacementPreferencesTabProps> = ({
  placement,
  scoreData,
  onRefresh,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [career, setCareer] = useState(placement?.preferred_career || 'AI & Full Stack Engineer');
  const [specializations, setSpecializations] = useState<string[]>(
    placement?.dream_company || ['Generative AI', 'Cloud Architecture', 'Distributed Systems']
  );
  const [newInput, setNewInput] = useState('');
  const [higherStudies, setHigherStudies] = useState(placement?.higher_studies_interest || false);
  const [needFromDept, setNeedFromDept] = useState(placement?.need_from_department || '');
  const [saving, setSaving] = useState(false);

  const handleAddSpec = () => {
    if (newInput.trim() && !specializations.includes(newInput.trim())) {
      setSpecializations([...specializations, newInput.trim()]);
      setNewInput('');
    }
  };

  const handleRemoveSpec = (item: string) => {
    setSpecializations(specializations.filter((c) => c !== item));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updatePlacementProfile('23091A3251', {
        preferred_career: career,
        dream_company: specializations,
        higher_studies_interest: higherStudies,
        need_from_department: needFromDept,
      });
      setIsEditing(false);
      onRefresh();
    } catch (e: any) {
      alert('Failed to save academic preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Academic Preferences Form */}
      <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-borderLine pb-4 mb-6">
          <div>
            <h3 className="text-base font-bold text-textPrimary">Academic Performance & Specialization Goals</h3>
            <p className="text-xs text-textSecondary">Specify your core technical focus, higher studies plans, and department support needs</p>
          </div>
          {!isEditing ? (
            <PillButton variant="outline" size="sm" onClick={() => setIsEditing(true)} icon={<Edit2 className="w-3.5 h-3.5" />}>
              Edit Goals
            </PillButton>
          ) : (
            <PillButton variant="outline" size="sm" onClick={() => setIsEditing(false)} icon={<X className="w-3.5 h-3.5" />}>
              Cancel
            </PillButton>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1">Preferred Specialization / Career Track</label>
            {isEditing ? (
              <input
                type="text"
                value={career}
                onChange={(e) => setCareer(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background"
              />
            ) : (
              <p className="text-sm font-semibold text-textPrimary">{career}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-2">Key Technical Focus Areas</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {specializations.map((spec) => (
                <span key={spec} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-primary text-white">
                  <BookOpen className="w-3 h-3" />
                  <span>{spec}</span>
                  {isEditing && (
                    <button type="button" onClick={() => handleRemoveSpec(spec)} className="hover:text-red-200 ml-1">
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>

            {isEditing && (
              <div className="flex gap-2 max-w-md">
                <input
                  type="text"
                  value={newInput}
                  onChange={(e) => setNewInput(e.target.value)}
                  placeholder="Add specialization (e.g. Cybersecurity)"
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-borderLine bg-background"
                />
                <PillButton variant="secondary" size="sm" type="button" onClick={handleAddSpec}>
                  Add
                </PillButton>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1">Higher Studies / Research Plans</label>
            {isEditing ? (
              <select
                value={higherStudies ? 'yes' : 'no'}
                onChange={(e) => setHigherStudies(e.target.value === 'yes')}
                className="w-full max-w-xs px-3 py-2 text-sm rounded-lg border border-borderLine bg-background"
              >
                <option value="no">No - Focused on Core Academic Projects</option>
                <option value="yes">Yes - Planning MS / M.Tech / Research</option>
              </select>
            ) : (
              <p className="text-sm font-medium text-textPrimary">
                {higherStudies ? 'Yes - Interested in Higher Studies & Research' : 'No - Focused on Core Academic Projects'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1">Support Needed From Department</label>
            {isEditing ? (
              <textarea
                value={needFromDept}
                onChange={(e) => setNeedFromDept(e.target.value)}
                rows={2}
                placeholder="e.g. Access to advanced cloud labs, research mentorship..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background"
              />
            ) : (
              <p className="text-sm font-medium text-textPrimary">
                {needFromDept || 'Access to advanced cloud labs & research paper guidance.'}
              </p>
            )}
          </div>

          {isEditing && (
            <div className="flex justify-end pt-4 border-t border-borderLine">
              <PillButton variant="primary" size="md" onClick={handleSave} disabled={saving} icon={<Save className="w-4 h-4" />}>
                Save Preferences
              </PillButton>
            </div>
          )}
        </div>
      </div>

      {/* Auto-Calculated Intelligence Card */}
      <div className="bg-surface border border-brand-primary/30 rounded-xl p-6 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-primary" />
            <h3 className="text-base font-bold text-textPrimary">Automated Academic Performance Metrics</h3>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-soft text-brand-primary px-2.5 py-1 rounded-full border border-brand-primary/20">
            Auto-calculated Engine
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-background border border-borderLine">
            <p className="text-xs font-semibold text-textSecondary uppercase">Overall Academic Score</p>
            <p className="text-2xl font-black text-brand-primary mt-1">{scoreData?.overallScore || 92.4} / 100</p>
          </div>
          <div className="p-4 rounded-xl bg-background border border-borderLine">
            <p className="text-xs font-semibold text-textSecondary uppercase">Academic Potential</p>
            <p className="text-2xl font-black text-success mt-1">4.9 / 5.0 ⭐</p>
          </div>
          <div className="p-4 rounded-xl bg-background border border-borderLine">
            <p className="text-xs font-semibold text-textSecondary uppercase">Research & Innovation</p>
            <p className="text-2xl font-black text-indigo-600 mt-1">4.5 / 5.0</p>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Identified Academic Focus Items</h4>
          <ul className="space-y-1.5 text-xs text-textPrimary">
            {(scoreData?.feedback || [
              'Deepen System Design experience with distributed databases',
              'Obtain AWS Certified Developer Associate certification',
              'Increase LeetCode problem count to 400+',
            ]).map((item, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-primary shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
