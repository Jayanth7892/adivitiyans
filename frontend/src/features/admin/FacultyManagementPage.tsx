import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface FacultyRow {
  faculty_id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  mentee_count: number;
}

interface MenteeRow {
  roll_number: string;
  name: string | null;
  email: string | null;
  year: string | null;
  section: string | null;
  cgpa: number | null;
  registered: boolean;
}

interface BlockedEmail {
  email: string;
  blocked_at: string;
  reason: string;
}

export default function FacultyManagementPage() {
  const qc = useQueryClient();
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyRow | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [linkEmailId, setLinkEmailId] = useState<string | null>(null);
  const [linkEmailValue, setLinkEmailValue] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showBlocked, setShowBlocked] = useState(false);
  const [actionError, setActionError] = useState<Record<string, string>>({});

  const { data: faculty = [], isLoading: facLoading } = useQuery<FacultyRow[]>({
    queryKey: ['adminFaculty'],
    queryFn: () => api.getAllFaculty(),
  });

  const { data: mentees = [], isLoading: menteesLoading } = useQuery<MenteeRow[]>({
    queryKey: ['facultyMenteeDetail', selectedFaculty?.faculty_id],
    queryFn: () => api.getFacultyMenteeList(selectedFaculty!.faculty_id),
    enabled: !!selectedFaculty,
  });

  const { data: blocked = [] } = useQuery<BlockedEmail[]>({
    queryKey: ['blockedEmails'],
    queryFn: () => api.getBlockedEmails(),
    enabled: showBlocked,
  });

  const renameMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.patchFacultyName(id, name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['adminFaculty'] }); setRenameId(null); },
    onError: (e: any) => setActionError(p => ({ ...p, rename: e.message })),
  });

  const linkEmailMut = useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) => api.patchFacultyEmail(id, email),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['adminFaculty'] }); setLinkEmailId(null); },
    onError: (e: any) => setActionError(p => ({ ...p, linkEmail: e.message })),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteFaculty(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adminFaculty'] });
      qc.invalidateQueries({ queryKey: ['blockedEmails'] });
      if (selectedFaculty?.faculty_id === deleteConfirm) setSelectedFaculty(null);
      setDeleteConfirm(null);
    },
    onError: (e: any, id: string) => setActionError(p => ({ ...p, [id]: (e as any).message })),
  });

  const unblockMut = useMutation({
    mutationFn: (email: string) => api.unblockFaculty(email),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blockedEmails'] }),
  });

  const unassignMut = useMutation({
    mutationFn: ({ facId, roll }: { facId: string; roll: string }) => api.unassignMentee(facId, roll),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['facultyMenteeDetail', selectedFaculty?.faculty_id] }),
  });

  const filtered = faculty.filter(f =>
    (f.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (f.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (f.faculty_id || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '24px', minHeight: '100vh', background: '#f8f9fb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#1a1a2e' }}>Faculty Management</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>{faculty.length} faculty members — select a row to view their assigned mentees</p>
        </div>
        <button onClick={() => setShowBlocked(p => !p)}
          style={{ padding: '8px 18px', borderRadius: 8, border: '1.5px solid #ef4444', background: showBlocked ? '#ef4444' : 'white', color: showBlocked ? 'white' : '#ef4444', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
          {showBlocked ? 'Hide' : 'Show'} Blocked Emails
        </button>
      </div>

      {showBlocked && (
        <div style={{ background: '#fff5f5', border: '1.5px solid #fecaca', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 12px', color: '#dc2626', fontSize: 15 }}>Blocked Emails ({blocked.length})</h3>
          {blocked.length === 0 ? (
            <p style={{ color: '#64748b', margin: 0, fontSize: 13 }}>No blocked emails.</p>
          ) : blocked.map(b => (
            <div key={b.email} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'white', borderRadius: 8, padding: '10px 14px', border: '1px solid #fecaca', marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, color: '#dc2626', fontSize: 13 }}>{b.email}</span>
                <span style={{ marginLeft: 10, color: '#94a3b8', fontSize: 12 }}>{b.reason}</span>
              </div>
              <button onClick={() => unblockMut.mutate(b.email)}
                style={{ padding: '5px 14px', borderRadius: 6, border: '1.5px solid #22c55e', background: 'white', color: '#16a34a', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* LEFT — Faculty list */}
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '75vh' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
            <input placeholder="Search name, email, ID..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {facLoading ? <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
              : filtered.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No faculty found</div>
              : filtered.map(f => {
                const sel = selectedFaculty?.faculty_id === f.faculty_id;
                const isLinked = f.email && !f.email.startsWith('pending_');
                const isDeleting = deleteConfirm === f.faculty_id;
                return (
                  <div key={f.faculty_id} onClick={() => setSelectedFaculty(f)}
                    style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: sel ? '#faf5ff' : 'white', borderLeft: sel ? '3px solid #7c3aed' : '3px solid transparent' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {renameId === f.faculty_id ? (
                          <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
                            <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                              style={{ flex: 1, padding: '3px 8px', borderRadius: 6, border: '1.5px solid #7c3aed', fontSize: 13, outline: 'none' }}
                              onKeyDown={e => { if (e.key === 'Enter') renameMut.mutate({ id: f.faculty_id, name: renameValue }); if (e.key === 'Escape') setRenameId(null); }} />
                            <button onClick={() => renameMut.mutate({ id: f.faculty_id, name: renameValue })} style={{ padding: '3px 9px', borderRadius: 6, background: '#7c3aed', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12 }}>Save</button>
                            <button onClick={() => setRenameId(null)} style={{ padding: '3px 7px', borderRadius: 6, background: '#f1f5f9', color: '#64748b', border: 'none', cursor: 'pointer', fontSize: 12 }}>✕</button>
                          </div>
                        ) : (
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                        )}
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{f.faculty_id}</div>
                      </div>
                      <span style={{ background: '#f0f9ff', color: '#0369a1', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{f.mentee_count ?? 0} mentees</span>
                    </div>
                    <div style={{ marginTop: 5 }}>
                      {linkEmailId === f.faculty_id ? (
                        <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
                          <input autoFocus value={linkEmailValue} onChange={e => setLinkEmailValue(e.target.value)} placeholder="email@rgmcet.edu.in"
                            style={{ flex: 1, padding: '3px 8px', borderRadius: 6, border: '1.5px solid #0ea5e9', fontSize: 12, outline: 'none' }}
                            onKeyDown={e => { if (e.key === 'Enter') linkEmailMut.mutate({ id: f.faculty_id, email: linkEmailValue }); if (e.key === 'Escape') setLinkEmailId(null); }} />
                          <button onClick={() => linkEmailMut.mutate({ id: f.faculty_id, email: linkEmailValue })} style={{ padding: '3px 9px', borderRadius: 6, background: '#0ea5e9', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12 }}>Link</button>
                          <button onClick={() => setLinkEmailId(null)} style={{ padding: '3px 7px', borderRadius: 6, background: '#f1f5f9', color: '#64748b', border: 'none', cursor: 'pointer', fontSize: 12 }}>✕</button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: isLinked ? '#16a34a' : '#f59e0b' }}>{isLinked ? `✉ ${f.email}` : '⚠ Not linked'}</span>
                      )}
                    </div>
                    {actionError[f.faculty_id] && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>{actionError[f.faculty_id]}</div>}
                    <div style={{ display: 'flex', gap: 5, marginTop: 9, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => { setRenameId(f.faculty_id); setRenameValue(f.name); }}
                        style={{ padding: '3px 10px', borderRadius: 6, border: '1.5px solid #e2e8f0', background: 'white', color: '#475569', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>✏ Rename</button>
                      <button onClick={() => { setLinkEmailId(f.faculty_id); setLinkEmailValue(f.email || ''); }}
                        style={{ padding: '3px 10px', borderRadius: 6, border: '1.5px solid #0ea5e9', background: 'white', color: '#0369a1', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>{isLinked ? '📧 Update Email' : '🔗 Link Email'}</button>
                      {isDeleting ? (
                        <>
                          <button onClick={() => deleteMut.mutate(f.faculty_id)} disabled={deleteMut.isPending}
                            style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: '#dc2626', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                            {deleteMut.isPending ? '...' : '⚠ Confirm Delete'}
                          </button>
                          <button onClick={() => setDeleteConfirm(null)} style={{ padding: '3px 7px', borderRadius: 6, background: '#f1f5f9', color: '#64748b', border: 'none', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                        </>
                      ) : (
                        <button onClick={() => setDeleteConfirm(f.faculty_id)}
                          style={{ padding: '3px 10px', borderRadius: 6, border: '1.5px solid #fca5a5', background: 'white', color: '#dc2626', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>🗑 Delete</button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* RIGHT — Mentee directory */}
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '75vh' }}>
          {!selectedFaculty ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: 12, padding: 40 }}>
              <span style={{ fontSize: 48 }}>👈</span>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 500, textAlign: 'center' }}>Select a faculty member to view their assigned mentees</p>
            </div>
          ) : (
            <>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(135deg,#ede9fe,#f0f9ff)' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{selectedFaculty.name}</h3>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>{selectedFaculty.faculty_id} · {mentees.length} assigned mentees</p>
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {menteesLoading ? <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading mentees...</div>
                  : mentees.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No mentees assigned.</div>
                  : mentees.map(m => (
                    <div key={m.roll_number} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid #f8fafc' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: m.registered ? '#22c55e' : '#f59e0b', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{m.name || m.roll_number}</div>
                        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                          <span>{m.roll_number}</span>
                          {m.year && <span>Y{m.year}</span>}
                          {m.section && <span>Sec {m.section}</span>}
                          {m.cgpa != null && <span>CGPA {m.cgpa}</span>}
                        </div>
                        {!m.registered && <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>Not yet registered</span>}
                      </div>
                      <button onClick={() => unassignMut.mutate({ facId: selectedFaculty.faculty_id, roll: m.roll_number })}
                        disabled={unassignMut.isPending}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1.5px solid #fca5a5', background: 'white', color: '#dc2626', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                        Unassign
                      </button>
                    </div>
                  ))}
              </div>
              <div style={{ padding: '10px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 14, fontSize: 11, color: '#94a3b8' }}>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#22c55e', marginRight: 4 }}/>Registered</span>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', marginRight: 4 }}/>Pending</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
