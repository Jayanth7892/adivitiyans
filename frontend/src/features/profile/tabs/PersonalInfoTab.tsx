import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Edit2, Save, X, ExternalLink, GraduationCap } from 'lucide-react';
import { StudentProfile } from '../../../types';
import { api } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { PillButton } from '../../../components/common/PillButton';

interface PersonalInfoTabProps {
  student?: StudentProfile | null;
  readOnly?: boolean;
  onRefresh: () => void;
}

const DEPARTMENTS = [
  'CSE',
  'IT',
  'ECE',
  'EEE',
  'Mechanical',
  'Civil',
  'Chemical',
  'Data Science',
  'AI & ML',
  'Cyber Security',
  'MBA',
  'MCA',
];

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

const FINANCIAL_BACKGROUNDS = [
  'Below Poverty Line',
  'Lower Class',
  'Middle Class',
  'Upper Middle Class',
  'Upper Class',
];

export const PersonalInfoTab: React.FC<PersonalInfoTabProps> = ({ student, readOnly = false, onRefresh }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const activeRoll = student?.roll_number || user?.rollNumber || '23091A3251';
  const activeName = student?.name || user?.name || 'Student';
  const activeEmail = student?.email || user?.email || 'student@rgmcet.edu.in';

  const { register, handleSubmit } = useForm<StudentProfile & { cgpa?: number }>({
    defaultValues: {
      ...student,
      name: activeName,
      roll_number: activeRoll,
      email: activeEmail,
      year: student?.year || '3rd Year',
      phone: student?.phone || '9876543210',
      address: student?.address || 'Nandyal, Andhra Pradesh',
      native_place: student?.native_place || 'Nandyal',
      department: student?.department || 'CSE',
      batch: student?.batch || '2023-2027',
      section: student?.section || 'A',
      hostel_day_scholar: student?.hostel_day_scholar || 'Day Scholar',
      driving_license: student?.driving_license ?? true,
      passport: student?.passport ?? true,
      relocation_willingness: student?.relocation_willingness ?? true,
      family_business: student?.family_business || 'Agriculture',
      financial_background: student?.financial_background || 'Middle Class',
      linkedin_url: student?.linkedin_url || `https://linkedin.com/in/${activeName.toLowerCase().replace(/\s+/g, '-')}`,
      cgpa: 9.16,
    },
  });

  const onSubmit = async (data: any) => {
    setSaving(true);
    try {
      await api.updateStudentProfile(data.roll_number || activeRoll, data);
      setIsEditing(false);
      onRefresh();
    } catch (e: any) {
      alert('Failed to save profile: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const s = student;

  return (
    <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-borderLine pb-4 mb-6">
        <div>
          <h3 className="text-base font-bold text-textPrimary">Personal & Academic Information</h3>
          <p className="text-xs text-textSecondary">Manage your demographic details, CGPA, contact info, and academic standings</p>
        </div>
        {!readOnly && (
          !isEditing ? (
            <PillButton variant="outline" size="sm" onClick={() => setIsEditing(true)} icon={<Edit2 className="w-3.5 h-3.5" />}>
              Edit Section
            </PillButton>
          ) : (
            <PillButton variant="outline" size="sm" onClick={() => setIsEditing(false)} icon={<X className="w-3.5 h-3.5" />}>
              Cancel
            </PillButton>
          )
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1">Full Name</label>
            {isEditing ? (
              <input {...register('name')} className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background" />
            ) : (
              <p className="text-sm font-semibold text-textPrimary">{s?.name || activeName}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1">Registration Number (Locked)</label>
            <p className="text-sm font-bold text-brand-primary bg-brand-soft px-3 py-1.5 rounded-lg inline-block">
              {s?.roll_number || activeRoll}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1">Overall CGPA (0.00 – 10.00)</label>
            {isEditing ? (
              <input
                {...register('cgpa')}
                type="number"
                step="0.01"
                min={0}
                max={10}
                placeholder="e.g. 9.16"
                className="w-full px-3 py-2 text-sm font-bold text-green-600 rounded-lg border border-borderLine bg-background"
              />
            ) : (
              <div className="flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-green-600 shrink-0" />
                <p className="text-sm font-black text-green-600">9.16 / 10.00 CGPA</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1">College Email (Locked)</label>
            <p className="text-sm font-medium text-textPrimary">{s?.email || 'jayanth@rgmcet.edu.in'}</p>
          </div>

          {/* Year */}
          <div>
            <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1">Year</label>
            {isEditing ? (
              <select {...register('year')} className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background">
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            ) : (
              <p className="text-sm font-medium text-textPrimary">{s?.year || '3rd Year'}</p>
            )}
          </div>

          {/* Department */}
          <div>
            <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1">Department</label>
            {isEditing ? (
              <select {...register('department')} className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background">
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            ) : (
              <p className="text-sm font-medium text-textPrimary">{s?.department || 'CSE'}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1">Batch</label>
            {isEditing ? (
              <input {...register('batch')} className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background" />
            ) : (
              <p className="text-sm font-medium text-textPrimary">{s?.batch || '2023-2027'}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1">Section</label>
            {isEditing ? (
              <input {...register('section')} className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background" />
            ) : (
              <p className="text-sm font-medium text-textPrimary">Sec {s?.section || 'A'}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1">Mobile Phone</label>
            {isEditing ? (
              <input {...register('phone')} className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background" />
            ) : (
              <p className="text-sm font-medium text-textPrimary">{s?.phone || '9876543210'}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1">Hostel / Day Scholar</label>
            {isEditing ? (
              <select {...register('hostel_day_scholar')} className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background">
                <option value="Day Scholar">Day Scholar</option>
                <option value="Hostel">Hostel</option>
              </select>
            ) : (
              <p className="text-sm font-medium text-textPrimary">{s?.hostel_day_scholar || 'Day Scholar'}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1">Native Place</label>
            {isEditing ? (
              <input {...register('native_place')} className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background" />
            ) : (
              <p className="text-sm font-medium text-textPrimary">{s?.native_place || 'Nandyal'}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1">Financial Background</label>
            {isEditing ? (
              <select {...register('financial_background')} className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background">
                {FINANCIAL_BACKGROUNDS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            ) : (
              <p className="text-sm font-medium text-textPrimary">{s?.financial_background || 'Middle Class'}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1">Family Business</label>
            {isEditing ? (
              <input {...register('family_business')} className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background" />
            ) : (
              <p className="text-sm font-medium text-textPrimary">{s?.family_business || '—'}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1">Driving License</label>
            {isEditing ? (
              <select {...register('driving_license', { setValueAs: (v) => v === 'true' })} className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : (
              <p className="text-sm font-medium text-textPrimary">{s?.driving_license ? 'Yes' : 'No'}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1">Passport</label>
            {isEditing ? (
              <select {...register('passport', { setValueAs: (v) => v === 'true' })} className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : (
              <p className="text-sm font-medium text-textPrimary">{s?.passport ? 'Yes' : 'No'}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1">Relocation Willingness</label>
            {isEditing ? (
              <select {...register('relocation_willingness', { setValueAs: (v) => v === 'true' })} className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background">
                <option value="true">Yes, willing to relocate</option>
                <option value="false">No, prefer local</option>
              </select>
            ) : (
              <p className="text-sm font-medium text-textPrimary">{s?.relocation_willingness ? 'Yes, willing to relocate' : 'No, prefer local'}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1">LinkedIn Profile</label>
            {isEditing ? (
              <input {...register('linkedin_url')} className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background" />
            ) : (
              s?.linkedin_url ? (
                <a href={s.linkedin_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-primary hover:underline flex items-center gap-1">
                  <span className="truncate">{s.linkedin_url}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              ) : (
                <p className="text-sm text-alert italic">Not linked yet</p>
              )
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-1">Residential Address</label>
          {isEditing ? (
            <textarea {...register('address')} rows={2} className="w-full px-3 py-2 text-sm rounded-lg border border-borderLine bg-background" />
          ) : (
            <p className="text-sm font-medium text-textPrimary">{s?.address || 'Nandyal, Andhra Pradesh'}</p>
          )}
        </div>

        {isEditing && (
          <div className="flex justify-end pt-4 border-t border-borderLine">
            <PillButton variant="primary" size="md" type="submit" disabled={saving} icon={<Save className="w-4 h-4" />}>
              {saving ? 'Saving...' : 'Save Personal & Academic Info'}
            </PillButton>
          </div>
        )}
      </form>
    </div>
  );
};
