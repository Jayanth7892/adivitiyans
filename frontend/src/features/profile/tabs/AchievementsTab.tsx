import React, { useState } from 'react';
import { Award, Plus, Calendar, Building2 } from 'lucide-react';
import { Achievement } from '../../../types';
import { api } from '../../../lib/api';
import { PillButton } from '../../../components/common/PillButton';

interface AchievementsTabProps {
  achievements: Achievement[];
  onRefresh: () => void;
}

const ACHIEVEMENT_TYPES = [
  'Hackathon',
  'Capstone Project',
  'Conference',
  'Achievement',
  'Failure-Learning',
  'Challenge Overcome',
  'Meetup',
  'Startup',
  'Industry Project',
  'Department Event',
  'Club',
] as const;

export const AchievementsTab: React.FC<AchievementsTabProps> = ({ achievements, onRefresh }) => {
  const [showModal, setShowModal] = useState(false);
  const [type, setType] = useState<any>('Hackathon');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('2024-04-10');
  const [organization, setOrganization] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await api.saveAchievement('23091A3251', {
        type,
        title: title.trim(),
        description: description.trim(),
        achievement_date: date,
        organization: organization.trim() || undefined,
      });
      setShowModal(false);
      setTitle('');
      setDescription('');
      onRefresh();
    } catch (e: any) {
      alert('Failed to save achievement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-textPrimary">Achievements & Milestone Timeline</h3>
          <p className="text-xs text-textSecondary">Record hackathons, projects, paper presentations, and leadership roles</p>
        </div>
        <PillButton variant="primary" size="sm" onClick={() => setShowModal(true)} icon={<Plus className="w-3.5 h-3.5" />}>
          Add Achievement
        </PillButton>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-3 before:bottom-3 before:w-0.5 before:bg-borderLine">
        {achievements.map((item) => (
          <div key={item.id || item.title} className="relative bg-surface border border-borderLine rounded-xl p-5 shadow-sm">
            <div className="absolute -left-[27px] top-5 w-3.5 h-3.5 rounded-full bg-brand-primary ring-4 ring-brand-soft" />

            <div className="flex items-center justify-between gap-3">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-soft text-brand-primary">
                {item.type}
              </span>
              <div className="flex items-center gap-2 text-xs text-textSecondary">
                <Calendar className="w-3.5 h-3.5" />
                <span>{item.achievement_date || '2024'}</span>
              </div>
            </div>

            <h4 className="text-base font-bold text-textPrimary mt-2">{item.title}</h4>
            <p className="text-xs text-textSecondary mt-1 leading-relaxed">{item.description}</p>

            {item.organization && (
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-textSecondary bg-background px-2.5 py-1 rounded-md border border-borderLine">
                <Building2 className="w-3.5 h-3.5 text-brand-primary" />
                <span>{item.organization}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-borderLine rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-base font-bold text-textPrimary mb-4">Add Achievement / Milestone</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-textPrimary mb-1">Type</label>
                <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background">
                  {ACHIEVEMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-textPrimary mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 1st Place in Smart India Hackathon"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-textPrimary mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe your role, technology used, and impact"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-textPrimary mb-1">Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-textPrimary mb-1">Organization</label>
                  <input type="text" value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="e.g. AICTE / IEEE" className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <PillButton variant="outline" size="sm" onClick={() => setShowModal(false)}>Cancel</PillButton>
                <PillButton variant="primary" size="sm" onClick={handleSave} disabled={saving}>Save Milestone</PillButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
