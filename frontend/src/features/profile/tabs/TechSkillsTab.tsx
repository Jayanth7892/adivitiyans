import React, { useState } from 'react';
import { Plus, ShieldCheck, Tag } from 'lucide-react';
import { TechSkill } from '../../../types';
import { api } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { PillButton } from '../../../components/common/PillButton';

interface TechSkillsTabProps {
  skills: TechSkill[];
  readOnly?: boolean;
  onRefresh: () => void;
}

const SKILL_CATEGORIES = [
  'AI/Agentic',
  'Cloud',
  'Cybersecurity',
  'Data Analytics',
  'AR/VR',
  'Quantum',
  'Robotics',
  'Game Dev',
  'Mobile',
  'UI/UX',
  'Product Mgmt',
  'Other',
] as const;

export const TechSkillsTab: React.FC<TechSkillsTabProps> = ({ skills, readOnly = false, onRefresh }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [toolInput, setToolInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<string>('AI/Agentic');
  const [ratingInput, setRatingInput] = useState<number>(4);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const activeRollNo = user?.rollNumber || '23091A3251';

  const handleAddSkill = async () => {
    if (!toolInput.trim() || readOnly) return;
    setSaving(true);
    try {
      await api.saveTechSkill(activeRollNo, {
        skill_category: categoryInput,
        specific_tool: toolInput.trim(),
        self_rating: ratingInput,
        verified: false,
      });
      setShowAddModal(false);
      setToolInput('');
      setRatingInput(4);
      onRefresh();
    } catch (e: any) {
      alert('Failed to add skill: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Group skills by category for display
  const grouped = skills.reduce<Record<string, TechSkill[]>>((acc, skill) => {
    const cat = skill.skill_category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(skill);
    return acc;
  }, {});

  const groupedEntries = Object.entries(grouped);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface border border-borderLine rounded-xl p-5 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-textPrimary">Technical Skills &amp; Tool Matrix</h3>
          <p className="text-xs text-textSecondary mt-0.5">
            {skills.length > 0
              ? `${skills.length} skill${skills.length !== 1 ? 's' : ''} added across ${groupedEntries.length} categor${groupedEntries.length !== 1 ? 'ies' : 'y'}`
              : 'Add the tools, frameworks and technologies you know'}
          </p>
        </div>
        {!readOnly && (
          <PillButton
            variant="primary"
            size="sm"
            onClick={() => setShowAddModal(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Technical Tool
          </PillButton>
        )}
      </div>

      {/* Skills Display */}
      {skills.length === 0 ? (
        /* Empty State — clean, no pre-populated items */
        <div className="bg-surface border border-dashed border-borderLine rounded-xl p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-brand-soft text-brand-primary flex items-center justify-center mx-auto mb-4">
            <Tag className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-textPrimary mb-1">No skills added yet</p>
          <p className="text-xs text-textSecondary mb-4">
            Click &ldquo;Add Technical Tool&rdquo; to add frameworks, tools, and technologies you know.
          </p>
          {!readOnly && (
            <PillButton
              variant="primary"
              size="sm"
              onClick={() => setShowAddModal(true)}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Your First Skill
            </PillButton>
          )}
        </div>
      ) : (
        /* All skills grouped by category — no filter bar */
        <div className="space-y-6">
          {groupedEntries.map(([category, catSkills]) => (
            <div key={category} className="bg-surface border border-borderLine rounded-xl p-5 shadow-sm">
              <h4 className="text-xs font-bold text-textSecondary uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-brand-primary" />
                {category}
                <span className="ml-1 text-[10px] bg-brand-soft text-brand-primary px-1.5 py-0.5 rounded-full font-bold">
                  {catSkills.length}
                </span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {catSkills.map((skill) => (
                  <div
                    key={skill.id || skill.specific_tool}
                    className="p-4 rounded-xl border border-borderLine bg-background flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between">
                      <h5 className="text-sm font-bold text-textPrimary">{skill.specific_tool}</h5>
                      {skill.verified && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-success-soft text-success shrink-0">
                          <ShieldCheck className="w-3 h-3" />
                          Verified
                        </span>
                      )}
                    </div>

                    <div className="mt-3">
                      <div className="flex justify-between items-center text-xs text-textSecondary mb-1">
                        <span>Self Rating</span>
                        <span className="font-bold text-brand-primary">{skill.self_rating} / 5</span>
                      </div>
                      <div className="w-full bg-borderLine h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-brand-primary h-full rounded-full"
                          style={{ width: `${(skill.self_rating / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Skill Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-borderLine rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-base font-bold text-textPrimary mb-4">Add Technical Skill</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-textPrimary mb-1">Category</label>
                <select
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background"
                >
                  {SKILL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-textPrimary mb-1">Tool / Framework / Technology</label>
                <input
                  type="text"
                  value={toolInput}
                  onChange={(e) => setToolInput(e.target.value)}
                  placeholder="e.g. Python, Docker, React, AWS"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-textPrimary mb-1">
                  <span>Self-Rating (1 to 5)</span>
                  <span className="text-brand-primary font-bold">{ratingInput} / 5</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={ratingInput}
                  onChange={(e) => setRatingInput(Number(e.target.value))}
                  className="w-full accent-brand-primary cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <PillButton variant="outline" size="sm" onClick={() => setShowAddModal(false)}>Cancel</PillButton>
                <PillButton variant="primary" size="sm" onClick={handleAddSkill} disabled={saving}>
                  {saving ? 'Adding...' : 'Add Skill'}
                </PillButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
