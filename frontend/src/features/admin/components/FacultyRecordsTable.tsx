import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Mail, Users } from 'lucide-react';

interface Props {
  onLinkEmail: (facultyId: string) => void;
}

export const FacultyRecordsTable: React.FC<Props> = ({ onLinkEmail }) => {
  const { data: faculty = [], isLoading } = useQuery({
    queryKey: ['adminFaculty'],
    queryFn: () => api.getAllFaculty(),
  });

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
              <th className="py-3 px-4 text-right">Action</th>
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
              return (
                <tr key={fac.faculty_id} className="hover:bg-background/50 transition-colors">
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-textPrimary text-sm">{fac.name}</p>
                    <p className="text-[11px] text-textSecondary">{fac.faculty_id}</p>
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
                    <button onClick={() => onLinkEmail(fac.faculty_id)}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-borderLine hover:bg-brand-soft hover:text-brand-primary hover:border-brand-primary transition-colors">
                      ✏️ {isLinked ? 'Update Email' : 'Link Email'}
                    </button>
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
