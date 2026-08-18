import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import {
  X,
  UserPlus,
  Search,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Plus,
  Trash2,
  Users,
  Sparkles,
} from 'lucide-react';

interface FacultyTarget {
  faculty_id: string;
  name: string;
  email?: string;
  mentee_count?: number;
}

interface StagedStudent {
  roll: string;
  name?: string | null;
  year?: string | null;
  section?: string | null;
  currentMentorId?: string | null;
  currentMentorName?: string | null;
}

interface AddMenteeModalProps {
  isOpen: boolean;
  onClose: () => void;
  faculty: FacultyTarget | null;
  onSuccess?: () => void;
}

export const AddMenteeModal: React.FC<AddMenteeModalProps> = ({
  isOpen,
  onClose,
  faculty,
  onSuccess,
}) => {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'search' | 'bulk'>('search');

  // Search tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Bulk paste state
  const [bulkInput, setBulkInput] = useState('');

  // Staged students to assign
  const [staged, setStaged] = useState<StagedStudent[]>([]);

  // Feedback state
  const [successResult, setSuccessResult] = useState<{
    count: number;
    message: string;
    details: any[];
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Debounced search effect
  useEffect(() => {
    if (!isOpen || activeTab !== 'search') return;
    const cleanQ = searchQuery.trim();
    if (cleanQ.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.searchAssignableStudents(cleanQ);
        setSearchResults(Array.isArray(res) ? res : []);
      } catch (err) {
        console.error('Student search error:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, activeTab]);

  // Reset state on open/close
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setBulkInput('');
      setStaged([]);
      setSuccessResult(null);
      setErrorMessage(null);
      setActiveTab('search');
    }
  }, [isOpen]);

  // Parse bulk input into roll numbers
  const parsedBulkRolls = useMemo(() => {
    if (!bulkInput.trim()) return [];
    const tokens = bulkInput
      .split(/[\s,;\n\r\t]+/)
      .map((t) => t.trim().toUpperCase())
      .filter((t) => t.length >= 5 && /^[A-Z0-9]+$/.test(t));
    return [...new Set(tokens)];
  }, [bulkInput]);

  // Stage a student from search
  const handleStageFromSearch = (student: any) => {
    const roll = student.roll_number.toUpperCase();
    if (staged.some((s) => s.roll === roll)) return;

    setStaged((prev) => [
      ...prev,
      {
        roll,
        name: student.name || null,
        year: student.year || null,
        section: student.section || null,
        currentMentorId: student.current_faculty_id || null,
        currentMentorName: student.current_faculty_name || null,
      },
    ]);
  };

  // Stage roll numbers from bulk text
  const handleAddBulkToStaged = () => {
    if (parsedBulkRolls.length === 0) return;
    const existingSet = new Set(staged.map((s) => s.roll));
    const newItems: StagedStudent[] = parsedBulkRolls
      .filter((roll) => !existingSet.has(roll))
      .map((roll) => ({ roll }));

    setStaged((prev) => [...prev, ...newItems]);
    setBulkInput('');
  };

  // Remove staged student
  const handleRemoveStaged = (roll: string) => {
    setStaged((prev) => prev.filter((s) => s.roll !== roll));
  };

  // Assignment mutation
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!faculty) throw new Error('No target faculty selected');
      const rolls = staged.map((s) => s.roll);
      return api.addMenteesToFaculty(faculty.faculty_id, rolls);
    },
    onSuccess: (data) => {
      setSuccessResult({
        count: data.count || staged.length,
        message: data.message || `Successfully assigned ${data.count || staged.length} student(s).`,
        details: data.assigned || [],
      });
      // Invalidate relevant query caches
      qc.invalidateQueries({ queryKey: ['adminFaculty'] });
      if (faculty?.faculty_id) {
        qc.invalidateQueries({ queryKey: ['facultyMenteeDetail', faculty.faculty_id] });
      }
      onSuccess?.();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to assign mentees');
    },
  });

  if (!isOpen || !faculty) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-surface border border-borderLine rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-borderLine bg-surface-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-soft text-brand-primary flex items-center justify-center font-bold">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-textPrimary flex items-center gap-2">
                <span>Assign Mentees</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-brand-soft text-brand-primary border border-brand-primary/20">
                  Admin Only
                </span>
              </h2>
              <p className="text-xs text-textSecondary mt-0.5">
                Target: <span className="font-semibold text-textPrimary">{faculty.name}</span> ({faculty.faculty_id})
                {faculty.mentee_count !== undefined && (
                  <span className="ml-2 text-textMuted">• Currently {faculty.mentee_count} mentees</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-textSecondary hover:text-textPrimary hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success View */}
        {successResult ? (
          <div className="p-8 flex flex-col items-center text-center space-y-4 overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-success-soft text-success flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-textPrimary">Assignment Complete!</h3>
            <p className="text-sm text-textSecondary max-w-md">{successResult.message}</p>

            {/* List of assigned students */}
            <div className="w-full max-h-48 overflow-y-auto border border-borderLine rounded-xl divide-y divide-borderLine text-left bg-background">
              {successResult.details.map((item, idx) => (
                <div key={idx} className="px-4 py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-textPrimary">{item.roll}</span>
                    {item.name && <span className="text-textSecondary ml-2">{item.name}</span>}
                    {item.year && <span className="text-textMuted ml-2">({item.year})</span>}
                  </div>
                  <div>
                    {item.status === 'reassigned' ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        Transferred from {item.reassignedFrom}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
                        Newly Assigned
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex gap-3 w-full justify-end">
              <button
                onClick={() => {
                  setSuccessResult(null);
                  setStaged([]);
                  setBulkInput('');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl border border-borderLine bg-surface text-xs font-semibold text-textSecondary hover:bg-surface-2 transition-colors"
              >
                Assign More Students
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-hover transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Normal Assignment Form */
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-alert-soft border border-alert/30 text-alert text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Mode Switcher Tabs */}
            <div className="flex bg-surface-2 p-1 rounded-xl border border-borderLine">
              <button
                type="button"
                onClick={() => setActiveTab('search')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'search'
                    ? 'bg-surface text-brand-primary shadow-xs border border-borderLine/50'
                    : 'text-textSecondary hover:text-textPrimary'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search & Pick</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('bulk')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'bulk'
                    ? 'bg-surface text-brand-primary shadow-xs border border-borderLine/50'
                    : 'text-textSecondary hover:text-textPrimary'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Bulk Roll Numbers</span>
              </button>
            </div>

            {/* Tab 1: Search & Pick */}
            {activeTab === 'search' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-textMuted absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by student roll number (e.g. 24091A32) or name..."
                    className="w-full pl-10 pr-10 py-2.5 bg-background border border-borderLine rounded-xl text-xs text-textPrimary placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                  />
                  {isSearching && (
                    <Loader2 className="w-4 h-4 text-brand-primary animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
                  )}
                </div>

                {/* Search Results Dropdown/List */}
                {searchQuery.trim().length >= 2 && (
                  <div className="max-h-48 overflow-y-auto border border-borderLine rounded-xl divide-y divide-borderLine bg-background shadow-xs">
                    {isSearching ? (
                      <div className="p-4 text-center text-xs text-textMuted">Searching students...</div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-4 text-center text-xs text-textMuted">
                        No students found matching "{searchQuery}". You can also use the Bulk Paste tab to add by roll number directly.
                      </div>
                    ) : (
                      searchResults.map((st) => {
                        const isAlreadyStaged = staged.some((s) => s.roll === st.roll_number.toUpperCase());
                        const isCurrentTargetMentor =
                          st.current_faculty_id &&
                          st.current_faculty_id.toUpperCase() === faculty.faculty_id.toUpperCase();

                        return (
                          <div
                            key={st.roll_number}
                            className="p-3 flex items-center justify-between hover:bg-surface transition-colors"
                          >
                            <div className="flex-1 min-w-0 pr-3">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-textPrimary">{st.roll_number}</span>
                                {st.name && <span className="text-xs text-textSecondary truncate">{st.name}</span>}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-textMuted flex-wrap">
                                {st.year && <span>{st.year}</span>}
                                {st.section && <span>• Sec {st.section}</span>}
                                {st.cgpa != null && <span>• CGPA {st.cgpa}</span>}
                                <span>•</span>
                                {isCurrentTargetMentor ? (
                                  <span className="text-green-600 dark:text-green-400 font-medium">
                                    Already assigned to {faculty.name}
                                  </span>
                                ) : st.current_faculty_id ? (
                                  <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> Mentor: {st.current_faculty_name || st.current_faculty_id}
                                  </span>
                                ) : (
                                  <span className="text-textSecondary">Unassigned</span>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleStageFromSearch(st)}
                              disabled={isAlreadyStaged || isCurrentTargetMentor}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-all ${
                                isAlreadyStaged
                                  ? 'bg-surface-2 text-textMuted cursor-not-allowed'
                                  : isCurrentTargetMentor
                                  ? 'bg-green-50 text-green-700 border border-green-200 cursor-default'
                                  : 'bg-brand-soft text-brand-primary hover:bg-brand-primary hover:text-white'
                              }`}
                            >
                              {isAlreadyStaged ? (
                                'Added'
                              ) : isCurrentTargetMentor ? (
                                'Assigned'
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" /> Add
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Bulk Roll Numbers */}
            {activeTab === 'bulk' && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-textSecondary">
                  Paste roll numbers (separated by commas, spaces, or newlines):
                </label>
                <textarea
                  rows={4}
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder="e.g. 24091A3201, 24091A3202&#10;24091A3203 24091A3204"
                  className="w-full p-3 bg-background border border-borderLine rounded-xl text-xs font-mono text-textPrimary placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all resize-none"
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-textSecondary">
                    Detected valid rolls:{' '}
                    <span className="font-bold text-brand-primary">{parsedBulkRolls.length}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleAddBulkToStaged}
                    disabled={parsedBulkRolls.length === 0}
                    className="px-4 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-bold hover:bg-brand-hover transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Stage {parsedBulkRolls.length} Students
                  </button>
                </div>
              </div>
            )}

            {/* Staging Area / Selected Students List */}
            <div className="border border-borderLine rounded-xl p-4 bg-surface-2 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-brand-primary" />
                  <span className="text-xs font-bold text-textPrimary uppercase tracking-wider">
                    Students Staged for Assignment ({staged.length})
                  </span>
                </div>
                {staged.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStaged([])}
                    className="text-[11px] text-alert hover:underline font-semibold"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {staged.length === 0 ? (
                <div className="p-6 text-center text-xs text-textMuted border border-dashed border-borderLine rounded-lg bg-background">
                  No students added yet. Use the search bar above or paste roll numbers to build your assignment list.
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {staged.map((item) => (
                    <div
                      key={item.roll}
                      className="px-3 py-2 bg-surface border border-borderLine rounded-lg flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-textPrimary">{item.roll}</span>
                        {item.name && <span className="text-textSecondary truncate">{item.name}</span>}
                        {item.year && <span className="text-textMuted">({item.year})</span>}
                        {item.currentMentorId && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                            Transfer from {item.currentMentorName || item.currentMentorId}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveStaged(item.roll)}
                        className="p-1 rounded-md text-textMuted hover:text-alert hover:bg-alert-soft transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {!successResult && (
          <div className="px-6 py-4 border-t border-borderLine bg-surface-2 flex items-center justify-between">
            <div className="text-xs text-textSecondary">
              {staged.length > 0 ? (
                <span>
                  Ready to assign <strong className="text-textPrimary">{staged.length}</strong> student(s) to{' '}
                  <strong className="text-textPrimary">{faculty.name}</strong>
                </span>
              ) : (
                <span>Add students to begin assignment</span>
              )}
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-borderLine bg-surface text-xs font-semibold text-textSecondary hover:bg-surface-2 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => assignMutation.mutate()}
                disabled={staged.length === 0 || assignMutation.isPending}
                className="px-5 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-hover transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 shadow-xs"
              >
                {assignMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Assigning…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" /> Assign {staged.length} Mentee(s)
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
