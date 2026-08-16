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
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-soft text-brand-primary text-xs font-semibold mb-2">
            <span>Faculty Portal</span>
          </div>
          <h1 className="text-xl font-extrabold text-textPrimary">Faculty Management</h1>
          <p className="mt-0.5 text-xs text-textSecondary">
            {faculty.length} faculty members — select a row to view assigned mentees
          </p>
        </div>
        <button
          onClick={() => setShowBlocked(p => !p)}
          className={`px-4 py-2 rounded-xl border text-xs font-bold transition-colors ${
            showBlocked
              ? 'bg-alert border-alert text-white'
              : 'bg-surface border-alert/50 text-alert hover:bg-alert-soft'
          }`}
        >
          {showBlocked ? 'Hide' : 'Show'} Blocked Emails
        </button>
      </div>

      {/* Blocked Emails panel */}
      {showBlocked && (
        <div className="bg-alert-soft border border-alert/30 rounded-2xl p-5 shadow-xs">
          <h3 className="text-xs font-bold text-alert uppercase tracking-widest mb-3">Blocked Emails ({blocked.length})</h3>
          {blocked.length === 0 ? (
            <p className="text-sm text-textSecondary">No blocked emails.</p>
          ) : blocked.map(b => (
            <div key={b.email} className="flex items-center gap-3 bg-surface border border-alert/20 rounded-xl px-4 py-3 mb-2">
              <div className="flex-1 min-w-0">
                <span className="font-bold text-alert text-xs">{b.email}</span>
                <span className="ml-2.5 text-textMuted text-[11px]">{b.reason}</span>
              </div>
              <button
                onClick={() => unblockMut.mutate(b.email)}
                className="px-3.5 py-1.5 rounded-lg border border-success/50 bg-surface text-success font-bold text-xs hover:bg-success-soft transition-colors"
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* LEFT — Faculty list */}
        <div className="bg-surface border border-borderLine rounded-2xl overflow-hidden flex flex-col max-h-[75vh]">
          <div className="px-4 py-3.5 border-b border-borderLine">
            <input
              placeholder="Search name, email, ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-borderLine bg-background text-sm text-textPrimary placeholder:text-textSecondary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {facLoading
              ? <div className="p-10 text-center text-textSecondary text-sm">Loading...</div>
              : filtered.length === 0
              ? <div className="p-10 text-center text-textSecondary text-sm">No faculty found</div>
              : filtered.map(f => {
                const sel = selectedFaculty?.faculty_id === f.faculty_id;
                const isLinked = f.email && !f.email.startsWith('pending_');
                const isDeleting = deleteConfirm === f.faculty_id;
                return (
                  <div
                    key={f.faculty_id}
                    onClick={() => setSelectedFaculty(f)}
                    className={`px-4 py-3.5 border-b border-borderLine cursor-pointer transition-all border-l-[3px] ${
                      sel ? 'bg-brand-soft border-l-brand-primary' : 'bg-surface border-l-transparent hover:bg-surface-2'
                    }`}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex-1 min-w-0">
                        {renameId === f.faculty_id ? (
                          <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              className="flex-1 px-2 py-1 rounded-md border border-brand-primary bg-background text-sm text-textPrimary focus:outline-none"
                              onKeyDown={e => {
                                if (e.key === 'Enter') renameMut.mutate({ id: f.faculty_id, name: renameValue });
                                if (e.key === 'Escape') setRenameId(null);
                              }}
                            />
                            <button
                              onClick={() => renameMut.mutate({ id: f.faculty_id, name: renameValue })}
                              className="px-2.5 py-1 rounded-md bg-brand-primary text-white text-xs font-semibold"
                            >Save</button>
                            <button
                              onClick={() => setRenameId(null)}
                              className="px-2 py-1 rounded-md bg-background text-textSecondary text-xs border border-borderLine"
                            >✕</button>
                          </div>
                        ) : (
                          <div className="font-semibold text-sm text-textPrimary truncate">{f.name}</div>
                        )}
                        <div className="text-[11px] text-textSecondary mt-0.5">{f.faculty_id}</div>
                      </div>
                      <span className="bg-brand-soft text-brand-primary rounded-full px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap">
                        {f.mentee_count ?? 0} mentees
                      </span>
                    </div>

                    <div className="mt-1.5">
                      {linkEmailId === f.faculty_id ? (
                        <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                          <input
                            autoFocus
                            value={linkEmailValue}
                            onChange={e => setLinkEmailValue(e.target.value)}
                            placeholder="email@rgmcet.edu.in"
                            className="flex-1 px-2 py-1 rounded-md border border-sky-400 bg-background text-xs text-textPrimary focus:outline-none"
                            onKeyDown={e => {
                              if (e.key === 'Enter') linkEmailMut.mutate({ id: f.faculty_id, email: linkEmailValue });
                              if (e.key === 'Escape') setLinkEmailId(null);
                            }}
                          />
                          <button
                            onClick={() => linkEmailMut.mutate({ id: f.faculty_id, email: linkEmailValue })}
                            className="px-2.5 py-1 rounded-md bg-sky-500 text-white text-xs font-semibold"
                          >Link</button>
                          <button
                            onClick={() => setLinkEmailId(null)}
                            className="px-2 py-1 rounded-md bg-background text-textSecondary text-xs border border-borderLine"
                          >✕</button>
                        </div>
                      ) : (
                        <span className={`text-xs font-medium ${isLinked ? 'text-green-600' : 'text-amber-500'}`}>
                          {isLinked ? `✉ ${f.email}` : '⚠ Not linked'}
                        </span>
                      )}
                    </div>

                    {actionError[f.faculty_id] && (
                      <div className="text-[11px] text-alert mt-1">{actionError[f.faculty_id]}</div>
                    )}

                    <div className="flex gap-1.5 mt-2.5 flex-wrap" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => { setRenameId(f.faculty_id); setRenameValue(f.name); }}
                        className="px-2.5 py-1 rounded-md border border-borderLine bg-surface text-textSecondary text-xs font-semibold hover:bg-background transition-colors"
                      >✏ Rename</button>
                      <button
                        onClick={() => { setLinkEmailId(f.faculty_id); setLinkEmailValue(f.email || ''); }}
                        className="px-2.5 py-1 rounded-md border border-sky-400 bg-surface text-sky-600 text-xs font-semibold hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
                      >{isLinked ? '📧 Update Email' : '🔗 Link Email'}</button>
                      {isDeleting ? (
                        <>
                          <button
                            onClick={() => deleteMut.mutate(f.faculty_id)}
                            disabled={deleteMut.isPending}
                            className="px-2.5 py-1 rounded-md bg-alert text-white text-xs font-bold disabled:opacity-60"
                          >{deleteMut.isPending ? '...' : '⚠ Confirm Delete'}</button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 rounded-md bg-background text-textSecondary text-xs border border-borderLine"
                          >Cancel</button>
                        </>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(f.faculty_id)}
                          className="px-2.5 py-1 rounded-md border border-alert/40 bg-surface text-alert text-xs font-semibold hover:bg-alert-soft transition-colors"
                        >🗑 Delete</button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* RIGHT — Mentee directory */}
        <div className="bg-surface border border-borderLine rounded-2xl overflow-hidden flex flex-col max-h-[75vh]">
          {!selectedFaculty ? (
            <div className="flex-1 flex flex-col items-center justify-center text-textSecondary gap-3 p-10 text-center">
              <span className="text-5xl">👈</span>
              <p className="text-sm font-medium">Select a faculty member to view their assigned mentees</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-borderLine bg-surface-2">
                <h3 className="text-sm font-bold text-textPrimary">{selectedFaculty.name}</h3>
                <p className="text-xs text-textMuted mt-0.5">
                  {selectedFaculty.faculty_id} &middot; {mentees.length} assigned mentees
                </p>
              </div>
              <div className="overflow-y-auto flex-1">
                {menteesLoading
                  ? <div className="p-10 text-center text-textSecondary text-sm">Loading mentees...</div>
                  : mentees.length === 0
                  ? <div className="p-10 text-center text-textSecondary text-sm">No mentees assigned.</div>
                  : mentees.map(m => (
                    <div key={m.roll_number} className="flex items-center gap-3 px-4 py-3 border-b border-borderLine">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${m.registered ? 'bg-green-500' : 'bg-amber-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-textPrimary">{m.name || m.roll_number}</div>
                        <div className="text-xs text-textSecondary flex gap-2 flex-wrap mt-0.5">
                          <span>{m.roll_number}</span>
                          {m.year && <span>Y{m.year}</span>}
                          {m.section && <span>Sec {m.section}</span>}
                          {m.cgpa != null && <span>CGPA {m.cgpa}</span>}
                        </div>
                        {!m.registered && (
                          <span className="text-[11px] text-amber-500 font-semibold">Not yet registered</span>
                        )}
                      </div>
                      <button
                        onClick={() => unassignMut.mutate({ facId: selectedFaculty.faculty_id, roll: m.roll_number })}
                        disabled={unassignMut.isPending}
                        className="px-2.5 py-1.5 rounded-lg border border-alert/40 bg-surface text-alert text-[11px] font-bold hover:bg-alert-soft transition-colors disabled:opacity-50"
                      >Unassign</button>
                    </div>
                  ))}
              </div>
              <div className="px-4 py-2.5 border-t border-borderLine flex gap-4 text-[11px] text-textSecondary">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Registered
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Pending
                </span>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
