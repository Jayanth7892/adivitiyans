import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

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
  const { data: mentor, isLoading, error } = useQuery({
    queryKey: ['myMentor'],
    queryFn: () => api.getMyMentor(),
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div className="min-h-screen bg-background px-6 py-8 transition-colors duration-200">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-7">
          <h1 className="text-2xl font-extrabold text-textPrimary tracking-tight">My Mentor</h1>
          <p className="mt-1.5 text-sm text-textSecondary">
            Your assigned faculty mentor and academic guidance
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
          <div className="bg-alert-soft border border-alert/30 rounded-2xl p-6 text-alert text-center text-sm font-medium">
            Failed to load mentor details. Please try again later.
          </div>
        )}

        {!isLoading && !error && (
          <div className="flex flex-col gap-5">

            {/* ── Mentor Card ── */}
            {mentor?.assigned ? (
              <div className="bg-surface border border-borderLine rounded-2xl overflow-hidden shadow-sm">
                {/* Purple gradient banner */}
                <div className="h-20 bg-gradient-to-r from-violet-600 to-sky-500" />

                <div className="px-7 pb-7">
                  {/* Avatar overlapping banner */}
                  <div className="-mt-11 mb-4 flex items-end justify-between">
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black text-white border-4 border-surface shadow-md shrink-0"
                      style={{ background: avatarColor(mentor.name || 'M') }}
                    >
                      {getInitials(mentor.name || 'M')}
                    </div>
                    {/* Role badge */}
                    <span
                      className="px-4 py-1.5 rounded-full text-white font-bold text-xs"
                      style={{
                        background: mentor.role === 'hod'
                          ? 'linear-gradient(135deg,#7c3aed,#5b21b6)'
                          : 'linear-gradient(135deg,#0ea5e9,#0369a1)',
                      }}
                    >
                      {mentor.role === 'hod' ? '👑 Head of Department' : '🎓 Faculty Mentor'}
                    </span>
                  </div>

                  {/* Name & details */}
                  <h2 className="text-xl font-extrabold text-textPrimary mb-1">{mentor.name}</h2>
                  <p className="text-sm text-textSecondary mb-5">
                    {mentor.department || 'CSE (Data Science)'}
                  </p>

                  {/* Info grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="bg-surface border-2 border-dashed border-violet-300 dark:border-violet-800 rounded-2xl p-12 text-center shadow-sm">
                <div className="text-5xl mb-4">🎓</div>
                <h3 className="text-lg font-bold text-violet-700 dark:text-violet-400 mb-2">
                  No Mentor Assigned Yet
                </h3>
                <p className="text-sm text-textSecondary leading-relaxed">
                  Your faculty mentor will be assigned by the department admin.<br />
                  Please check back later or contact your HOD.
                </p>
              </div>
            )}

            {/* ── Faculty Remarks ── */}
            <div className="bg-surface border border-borderLine rounded-2xl overflow-hidden shadow-sm">
              <div className="px-7 py-5 border-b border-borderLine bg-background flex items-center gap-3">
                <span className="text-xl">📝</span>
                <div>
                  <h3 className="text-sm font-bold text-textPrimary">Faculty Remarks</h3>
                  <p className="text-xs text-textSecondary mt-0.5">
                    Academic feedback and notes from your mentor
                  </p>
                </div>
              </div>

              <div className="p-7">
                {mentor?.remarks ? (
                  <div className="bg-background rounded-xl p-6 border-l-4 border-violet-500">
                    <p className="text-sm text-textPrimary leading-relaxed mb-4 whitespace-pre-wrap">
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
                      <span className="text-violet-600 font-bold text-sm">
                        — {mentor?.name || 'Your Mentor'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-textSecondary">
                    <div className="text-4xl mb-3">✍️</div>
                    <p className="text-sm font-medium">No remarks added yet</p>
                    <p className="text-xs mt-1.5">Your mentor's feedback and academic notes will appear here</p>
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
    <div className="bg-background border border-borderLine rounded-xl px-4 py-3.5">
      <div className="text-[10px] font-bold text-textSecondary uppercase tracking-wider mb-1.5">
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
