import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Mail, Users, Pencil, Check, X } from 'lucide-react';

interface Props {
  onLinkEmail: (facultyId: string) => void;
}

export const FacultyRecordsTable: React.FC<Props> = ({ onLinkEmail }) => {
  const queryClient = useQueryClient();
  const { data: faculty = [], isLoading } = useQuery({
    queryKey: ['adminFaculty'],
    queryFn: () => api.getAllFaculty(),
  });

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState('');

  const startRename = (fac: any) => { setRenamingId(fac.faculty_id); setRenameValue(fac.name); setRenameError(''); };
  const cancelRename = () => { setRenamingId(null); setRenameValue(''); setRenameError(''); };
  const saveRename = async (facultyId: string) => {
    if (!renameValue.trim()) { setRenameError('Name cannot be empty'); return; }
    setRenameSaving(true); setRenameError('');
    try {
      await api.patchFacultyName(facultyId, renameValue.trim());
      await queryClient.invalidateQueries({ queryKey: ['adminFaculty'] });
      setRenamingId(null);
    } catch (e: any) { setRenameError(e.message || 'Failed to update name'); }
    finally { setRenameSaving(false); }
  };

  if (isLoading) {
    return (
      <div className="bg-surface border border-borderLine rounded-xl p-6 text-center text-xs text-textSecondary">
        Loading faculty records...
      </div>
    );
  }

  return (
    <div className="bg-surface border border-borderLine rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-textPrimary">Faculty Records</h3>
          <p className="text-xs text-textSecondary mt-0.5">{faculty.length} faculty member{faculty.length !== 1 ? 's' : ''} in system</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-borderLine bg-background text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Mentees</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borderLine text-sm">
            {faculty.length === 0 && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-textSecondary text-xs">
                  No faculty records yet. Upload a CSV to auto-create faculty.
                </td>
              </tr>
            )}
            {faculty.map((fac: any) => {
              const isLinked = fac.email && !fac.email.startsWith('pending_');
              const isRenaming = renamingId === fac.faculty_id;
              return (
                <tr key={fac.faculty_id} className="hover:bg-background/50 transition-colors">
                  <td className="py-3.5 px-4">
                    {isRenaming ? (
                      <div className="space-y-1">
                        <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveRename(fac.faculty_id); if (e.key === 'Escape') cancelRename(); }}
                          className="w-full text-sm font-semibold border border-brand-primary rounded-lg px-2 py-1 bg-background focus:outline-none text-textPrimary" />
                        {renameError && <p className="text-[11px] text-red-500">{renameError}</p>}
                      </div>
                    ) : (
                      <>
                        <p className="font-semibold text-textPrimary text-sm">{fac.name}</p>
                        <p className="text-[11px] text-textSecondary">{fac.faculty_id}</p>
                      </>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    {isLinked ? (
                      <span className="flex items-center gap-1.5 text-xs text-success">
                        <Mail className="w-3.5 h-3.5" />{fac.email}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 font-medium">⚠️ Not linked</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-textPrimary">
                      <Users className="w-3.5 h-3.5 text-brand-primary" />{fac.mentee_count ?? 0} mentees
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isRenaming ? (
                        <>
                          <button onClick={() => saveRename(fac.faculty_id)} disabled={renameSaving}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                            <Check className="w-3 h-3" />{renameSaving ? 'Saving...' : 'Save'}
                          </button>
                          <button onClick={cancelRename}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-borderLine hover:bg-background transition-colors text-textSecondary">
                            <X className="w-3 h-3" />Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startRename(fac)}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-borderLine hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 transition-colors">
                            <Pencil className="w-3 h-3" />Rename
                          </button>
                          <button onClick={() => onLinkEmail(fac.faculty_id)}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-borderLine hover:bg-brand-soft hover:text-brand-primary hover:border-brand-primary transition-colors">
                            ✏️ {isLinked ? 'Update Email' : 'Link Email'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
