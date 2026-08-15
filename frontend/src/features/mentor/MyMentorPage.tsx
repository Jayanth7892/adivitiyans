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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#f8f9fb 0%,#f0f4ff 100%)', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-0.5px' }}>
            My Mentor
          </h1>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 15 }}>
            Your assigned faculty mentor and academic guidance
          </p>
        </div>

        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[1, 2].map(i => (
              <div key={i} style={{ background: 'white', borderRadius: 16, height: 120, border: '1.5px solid #e2e8f0', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        )}

        {error && (
          <div style={{ background: '#fff5f5', border: '1.5px solid #fecaca', borderRadius: 16, padding: 24, color: '#dc2626', textAlign: 'center' }}>
            Failed to load mentor details. Please try again later.
          </div>
        )}

        {!isLoading && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Mentor Card ── */}
            {mentor?.assigned ? (
              <div style={{
                background: 'white',
                borderRadius: 20,
                border: '1.5px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 4px 24px rgba(124,58,237,0.07)',
              }}>
                {/* Purple gradient banner */}
                <div style={{ height: 80, background: 'linear-gradient(135deg,#7c3aed,#0ea5e9)', position: 'relative' }} />

                <div style={{ padding: '0 28px 28px' }}>
                  {/* Avatar overlapping banner */}
                  <div style={{ marginTop: -44, marginBottom: 16, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <div style={{
                      width: 80, height: 80, borderRadius: '50%',
                      background: avatarColor(mentor.name || 'M'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 28, fontWeight: 800, color: 'white',
                      border: '4px solid white',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                      flexShrink: 0,
                    }}>
                      {getInitials(mentor.name || 'M')}
                    </div>
                    {/* Role badge */}
                    <span style={{
                      padding: '6px 16px', borderRadius: 20,
                      background: mentor.role === 'hod' ? 'linear-gradient(135deg,#7c3aed,#5b21b6)' : 'linear-gradient(135deg,#0ea5e9,#0369a1)',
                      color: 'white', fontWeight: 700, fontSize: 13,
                    }}>
                      {mentor.role === 'hod' ? '👑 Head of Department' : '🎓 Faculty Mentor'}
                    </span>
                  </div>

                  {/* Name & details */}
                  <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: '#1e293b' }}>
                    {mentor.name}
                  </h2>
                  <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 14 }}>
                    {mentor.department || 'CSE (Data Science)'}
                  </p>

                  {/* Info grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <InfoCard
                      icon="🏛️"
                      label="Department"
                      value={mentor.department || 'CSE (Data Science)'}
                    />
                    <InfoCard
                      icon="👤"
                      label="Designation"
                      value={mentor.role === 'hod' ? 'Head of Department' : 'Faculty Mentor'}
                    />
                    {mentor.email && (
                      <InfoCard
                        icon="✉️"
                        label="Email"
                        value={mentor.email}
                        href={`mailto:${mentor.email}`}
                      />
                    )}
                    <InfoCard
                      icon="🆔"
                      label="Faculty ID"
                      value={mentor.faculty_id || '—'}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Not assigned state */
              <div style={{
                background: 'white', borderRadius: 20, border: '1.5px dashed #c4b5fd',
                padding: 48, textAlign: 'center',
                boxShadow: '0 4px 24px rgba(124,58,237,0.05)',
              }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>🎓</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#4c1d95' }}>
                  No Mentor Assigned Yet
                </h3>
                <p style={{ margin: 0, color: '#64748b', fontSize: 15, lineHeight: 1.6 }}>
                  Your faculty mentor will be assigned by the department admin.<br />
                  Please check back later or contact your HOD.
                </p>
              </div>
            )}

            {/* ── Faculty Remarks ── */}
            <div style={{
              background: 'white', borderRadius: 20, border: '1.5px solid #e2e8f0',
              overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
            }}>
              <div style={{
                padding: '20px 28px', borderBottom: '1px solid #f1f5f9',
                background: 'linear-gradient(135deg,#faf5ff,#f0f9ff)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 20 }}>📝</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
                    Faculty Remarks
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                    Academic feedback and notes from your mentor
                  </p>
                </div>
              </div>

              <div style={{ padding: 28 }}>
                {mentor?.remarks ? (
                  <div style={{
                    background: 'linear-gradient(135deg,#faf5ff,#f0f9ff)',
                    borderRadius: 12, padding: 24,
                    borderLeft: '4px solid #7c3aed',
                  }}>
                    <p style={{ margin: '0 0 16px', fontSize: 15, color: '#1e293b', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      "{mentor.remarks}"
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {mentor.assigned && mentor.name && (
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: avatarColor(mentor.name),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 700, color: 'white',
                        }}>
                          {getInitials(mentor.name)}
                        </div>
                      )}
                      <span style={{ color: '#7c3aed', fontWeight: 700, fontSize: 14 }}>
                        — {mentor?.name || 'Your Mentor'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>✍️</div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
                      No remarks added yet
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: 13 }}>
                      Your mentor's feedback and academic notes will appear here
                    </p>
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
    <div style={{
      background: '#f8fafc', borderRadius: 12, padding: '14px 16px',
      border: '1.5px solid #f1f5f9',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        {icon} {label}
      </div>
      {href ? (
        <a href={href} style={{ fontSize: 14, fontWeight: 600, color: '#7c3aed', textDecoration: 'none' }}>
          {value}
        </a>
      ) : (
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{value}</div>
      )}
    </div>
  );
}
