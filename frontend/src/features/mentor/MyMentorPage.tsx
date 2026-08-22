import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join('');
}

function avatarColor(name: string) {
  const colors = [
    '#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function MyMentorPage() {
  const { user, role } = useAuth();
  const activeRollNo = user?.rollNumber || '';

  const { data: mentor, isLoading, error } = useQuery({
    queryKey: ['myMentor', activeRollNo],
    queryFn: async () => {
      // Step 1: Query backend API with active roll number
      try {
        const res = await api.getMyMentor(activeRollNo);
        if (res && res.assigned) return res;
      } catch { /* proceed to fallback */ }

      // Step 2: Fallback — resolve via student profile and faculty list
      if (activeRollNo) {
        try {
          const profile = await api.getStudentProfile(activeRollNo);
          if (profile?.faculty_mentor_id) {
            const allFaculty = await api.getAllFaculty().catch(() => []);
            const mId = profile.faculty_mentor_id.trim().toUpperCase();
            const matched = allFaculty.find(
              (f: any) =>
                f.faculty_id?.trim().toUpperCase() === mId ||
                f.name?.trim().toLowerCase() === profile.faculty_mentor_id?.trim().toLowerCase() ||
                f.email?.trim().toLowerCase() === profile.faculty_mentor_id?.trim().toLowerCase()
            );
            if (matched) {
              return {
                assigned: true,
                faculty_id: matched.faculty_id,
                name: matched.name,
                email: matched.email && !matched.email.startsWith('pending_') ? matched.email : null,
                department: matched.department || profile.department,
                role: matched.role || 'mentor',
                remarks: null,
              };
            }
          }
        } catch { /* ignore fallback errors */ }
      }

      return { assigned: false, remarks: null };
    },
    staleTime: 1000 * 60 * 5,
  });

  const studentName = user?.name ? user.name.replace(/^Parent of\s*/i, '') : activeRollNo;

  return (
    <div className="bg-background px-4 py-6 sm:px-6 sm:py-8">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-extrabold text-textPrimary tracking-tight">
            {role === 'parent' ? "Ward's Assigned Mentor" : 'My Mentor'}
          </h1>
          <p className="mt-1 text-sm text-textSecondary">
            {role === 'parent'
              ? `Faculty mentor and academic guidance for ${studentName} (${activeRollNo})`
              : 'Your assigned faculty mentor and academic guidance'}
          </p>
        </div>

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="flex flex-col gap-4">
            {[1, 2].map(i => (
              <div key={i} className="bg-surface border border-borderLine rounded-2xl h-28 animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-alert-soft border border-alert/30 rounded-2xl p-6 text-alert text-center text-sm font-semibold">
            Failed to load mentor details. Please try again later.
          </div>
        )}

        {!isLoading && !error && (
          <div className="flex flex-col gap-5">

            {/* ── Mentor Card ── */}
            {mentor?.assigned ? (
              <div className="bg-surface border border-borderLine rounded-2xl overflow-hidden shadow-sm">
                {/* Gradient banner */}
                <div
                  className="h-24 w-full"
                  style={{ background: 'linear-gradient(135deg, var(--color-brand-primary) 0%, #818CF8 100%)' }}
                />

                <div className="px-6 pb-7 -mt-10">
                  {/* Avatar + role badge */}
                  <div className="flex items-end justify-between mb-5">
                    <div
                      className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white border-4 border-surface shadow-md shrink-0"
                      style={{ background: avatarColor(mentor.name || 'M') }}
                    >
                      {getInitials(mentor.name || 'M')}
                    </div>
                    <span
                      className="px-3 py-1.5 rounded-full text-white font-bold text-xs shadow-sm"
                      style={{
                        background: mentor.role === 'hod'
                          ? 'linear-gradient(135deg,#7c3aed,#5b21b6)'
                          : 'linear-gradient(135deg,#0ea5e9,#0369a1)',
                      }}
                    >
                      {mentor.role === 'hod' ? '👑 Head of Department' : '🎓 Faculty Mentor'}
                    </span>
                  </div>

                  {/* Name & dept */}
                  <h2 className="text-xl font-extrabold text-textPrimary mb-0.5">{mentor.name}</h2>
                  <p className="text-xs text-textSecondary mb-5 font-medium">
                    {mentor.department || 'CSE (Data Science)'}
                  </p>

                  {/* Info grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InfoCard icon="🏛️" label="Department" value={mentor.department || 'CSE (Data Science)'} />
                    <InfoCard icon="👤" label="Designation" value={mentor.role === 'hod' ? 'Head of Department' : 'Faculty Mentor'} />
                    {mentor.email && (
                      <InfoCard icon="✉️" label="Email" value={mentor.email} href={`mailto:${mentor.email}`} />
                    )}
                    <InfoCard icon="🆔" label="Faculty ID" value={mentor.faculty_id || '—'} />
                  </div>
                </div>
              </div>
            ) : (
              /* Not assigned state */
              <div className="bg-surface border-2 border-dashed border-brand-primary/30 rounded-2xl p-12 text-center shadow-xs">
                <div className="text-5xl mb-4">🎓</div>
                <h3 className="text-base font-bold text-textPrimary mb-2">
                  No Mentor Assigned Yet
                </h3>
                <p className="text-sm text-textSecondary leading-relaxed max-w-xs mx-auto">
                  Your faculty mentor will be assigned by the department admin.<br />
                  Please check back later or contact your HOD.
                </p>
              </div>
            )}

            {/* ── Faculty Remarks ── */}
            <div className="bg-surface border border-borderLine rounded-2xl overflow-hidden shadow-xs">
              <div className="px-6 py-4 border-b border-borderLine bg-surface-2 flex items-center gap-3">
                <span className="text-xl">📝</span>
                <div>
                  <h3 className="text-sm font-bold text-textPrimary">Faculty Remarks</h3>
                  <p className="text-xs text-textSecondary mt-0.5">
                    Academic feedback and notes from your mentor
                  </p>
                </div>
              </div>

              <div className="p-6">
                {mentor?.remarks ? (
                  <div className="bg-surface-2 rounded-xl p-5 border-l-4 border-brand-primary">
                    <p className="text-sm text-textPrimary leading-relaxed mb-4 whitespace-pre-wrap italic">
                      "{mentor.remarks}"
                    </p>
                    <div className="flex items-center gap-3">
                      {mentor.assigned && mentor.name && (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: avatarColor(mentor.name) }}
                        >
                          {getInitials(mentor.name)}
                        </div>
                      )}
                      <span className="text-brand-primary font-bold text-sm">
                        — {mentor?.name || 'Your Mentor'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-textSecondary">
                    <div className="text-4xl mb-3">✍️</div>
                    <p className="text-sm font-semibold text-textPrimary">No remarks added yet</p>
                    <p className="text-xs text-textSecondary mt-1.5">Your mentor's feedback and academic notes will appear here</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value, href }: {
  icon: string; label: string; value: string; href?: string;
}) {
  return (
    <div className="bg-surface-2 border border-borderLine rounded-xl px-4 py-3.5">
      <div className="text-[10px] font-bold text-textMuted uppercase tracking-widest mb-1.5">
        {icon} {label}
      </div>
      {href ? (
        <a href={href} className="text-sm font-semibold text-brand-primary hover:underline">
          {value}
        </a>
      ) : (
        <div className="text-sm font-semibold text-textPrimary">{value}</div>
      )}
    </div>
  );
}
