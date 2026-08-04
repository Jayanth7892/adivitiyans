import React, { useState } from 'react';
import { Plus, CheckCircle2, ShieldCheck, X } from 'lucide-react';
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
] as const;

export const TechSkillsTab: React.FC<TechSkillsTabProps> = ({ skills, readOnly = false, onRefresh }) => {
  const [activeCategory, setActiveCategory] = useState<string>('AI/Agentic');
  const [showAddModal, setShowAddModal] = useState(false);
  const [toolInput, setToolInput] = useState('');
  const [ratingInput, setRatingInput] = useState<number>(4);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const activeRollNo = user?.rollNumber || '23091A3251';

  const filteredSkills = skills.filter((s) => s.skill_category === activeCategory);

  const handleAddSkill = async () => {
    if (!toolInput.trim() || readOnly) return;
    setSaving(true);
    try {
      await api.saveTechSkill(activeRollNo, {
        skill_category: activeCategory,
        specific_tool: toolInput.trim(),
        self_rating: ratingInput,
        verified: true,
      });
      setShowAddModal(false);
      setToolInput('');
      onRefresh();
    } catch (e: any) {
      alert('Failed to add skill: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Category Chips Bar */}
      <div className="bg-surface border border-borderLine rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-textPrimary">Technical Skills & Tool Matrix</h3>
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

        <div className="flex flex-wrap gap-2 pt-2 border-t border-borderLine">
          {SKILL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeCategory === cat
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'bg-background text-textSecondary hover:text-textPrimary border border-borderLine'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Category Tool Chips List */}
      <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm">
        <h4 className="text-sm font-bold text-textPrimary mb-4">
          Category: <span className="text-brand-primary">{activeCategory}</span>
        </h4>

        {filteredSkills.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredSkills.map((skill) => (
              <div
                key={skill.id || skill.specific_tool}
                className="p-4 rounded-xl border border-borderLine bg-background flex flex-col justify-between"
              >
                <div className="flex items-start justify-between">
                  <h5 className="text-sm font-bold text-textPrimary">{skill.specific_tool}</h5>
                  {skill.verified && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-success-soft text-success">
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
        ) : (
          <p className="text-xs text-textSecondary italic py-4">
            No tools added under {activeCategory} yet. Click "Add Technical Tool" to add tools like Claude Code, Cursor, AWS, etc.
          </p>
        )}
      </div>

      {/* Add Skill Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-borderLine rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-base font-bold text-textPrimary mb-4">Add Tool to {activeCategory}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-textPrimary mb-1">Specific Tool / Framework Name</label>
                <input
                  type="text"
                  value={toolInput}
                  onChange={(e) => setToolInput(e.target.value)}
                  placeholder="e.g. Claude Code, Cursor, CrewAI, Docker"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background"
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
                <PillButton variant="primary" size="sm" onClick={handleAddSkill} disabled={saving}>Add Skill</PillButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
