import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, Award, GraduationCap, TrendingUp, ArrowUpRight, ArrowDownRight, Edit2, CheckCircle2, Lock } from 'lucide-react';
import { AcademicRecord } from '../../../types';
import { api } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { PillButton } from '../../../components/common/PillButton';

interface AcademicsTabProps {
  academics: AcademicRecord[];
  readOnly?: boolean;
  studentYear?: string;  // e.g. '2nd Year' — drives semester unlock check
  onRefresh: () => void;
}

export const AcademicsTab: React.FC<AcademicsTabProps> = ({ academics, readOnly = false, studentYear, onRefresh }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSemester, setEditingSemester] = useState<AcademicRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [maxAllowedSemester, setMaxAllowedSemester] = useState<number>(8); // default open (fail-safe)
  const [unlockLoading, setUnlockLoading] = useState(true);
  const { user } = useAuth();
  const activeRollNo = user?.rollNumber || '';

  // Fetch semester unlock settings for this student's year
  useEffect(() => {
    if (readOnly) { setUnlockLoading(false); return; }
    const yr = studentYear || '3rd Year';
    api.getSemesterUnlockSettings()
      .then((settings) => {
        const match = settings.find((s) => s.year_label === yr);
        setMaxAllowedSemester(match !== undefined ? match.max_semester : 8);
      })
      .catch(() => setMaxAllowedSemester(8))
      .finally(() => setUnlockLoading(false));
  }, [studentYear, readOnly]);


  // Sort academics by semester number ascending
  const sortedAcademics = [...academics].sort((a, b) => a.semester - b.semester);

  // Form handling
  const { register, handleSubmit, reset, setValue } = useForm<AcademicRecord>({
    defaultValues: {
      semester: (sortedAcademics.length || 0) + 1,
      semester_gpa: 9.0,
      programming_grade: 'O',
      attendance_pct: 95.0,
      theory_grade: 'A+',
      remarks: 'Good progress',
    },
  });

  // Calculate improvement metrics
  const chartData = sortedAcademics.map((a, idx) => {
    const prevGpa = idx > 0 ? Number(sortedAcademics[idx - 1].semester_gpa) : null;
    const currGpa = Number(a.semester_gpa);
    const delta = prevGpa !== null ? Number((currGpa - prevGpa).toFixed(2)) : 0;

    return {
      name: `Sem ${a.semester}`,
      semester: a.semester,
      gpa: currGpa,
      delta,
      attendance: Number(a.attendance_pct),
    };
  });

  const overallCgpaVal =
    sortedAcademics.length > 0
      ? (sortedAcademics.reduce((sum, a) => sum + Number(a.semester_gpa), 0) / sortedAcademics.length).toFixed(2)
      : '0.00';

  const firstSemGpa = sortedAcademics.length > 0 ? Number(sortedAcademics[0].semester_gpa) : 0;
  const latestSemGpa = sortedAcademics.length > 0 ? Number(sortedAcademics[sortedAcademics.length - 1].semester_gpa) : 0;
  const totalImprovement = Number((latestSemGpa - firstSemGpa).toFixed(2));
  const highestSemGpa = sortedAcademics.length > 0 ? Math.max(...sortedAcademics.map((a) => Number(a.semester_gpa))) : 0;

  const onSaveSemester = async (data: AcademicRecord) => {
    // BUG-02 fix: reject if the semester number exceeds what HOD has unlocked
    if (!readOnly && !editingSemester && Number(data.semester) > maxAllowedSemester) {
      alert(`Semester ${data.semester} is not yet unlocked. HOD has unlocked up to Semester ${maxAllowedSemester}.`);
      return;
    }
    setSaving(true);
    try {
      await api.saveAcademicRecord(activeRollNo, {
        ...data,
        semester: Number(data.semester),
        semester_gpa: Number(data.semester_gpa),
        attendance_pct: Number(data.attendance_pct),
      });
      setShowAddModal(false);
      setEditingSemester(null);
      reset();
      onRefresh();
    } catch (e: any) {
      alert('Failed to save semester record: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (record: AcademicRecord) => {
    setEditingSemester(record);
    setValue('semester', record.semester);
    setValue('semester_gpa', record.semester_gpa);
    setValue('programming_grade', record.programming_grade);
    setValue('attendance_pct', record.attendance_pct);
    setValue('theory_grade', record.theory_grade);
    setValue('remarks', record.remarks);
    setShowAddModal(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. Overall CGPA & Semester Improvement Summary Banner */}
      <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#5B4FE9]/10 text-[#5B4FE9] flex items-center justify-center shrink-0">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs font-semibold text-textSecondary uppercase tracking-wider">Overall CGPA</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <h2 className="text-3xl font-black text-textPrimary">{overallCgpaVal}</h2>
                <span className="text-xs font-semibold text-textSecondary">/ 10.00 Cumulative</span>
              </div>
            </div>
          </div>

          {/* Add Semester button — gated by HOD unlock settings */}
          {!readOnly && !unlockLoading && (
            sortedAcademics.length < maxAllowedSemester ? (
              <div>
                <PillButton
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setEditingSemester(null);
                    reset({
                      semester: (sortedAcademics.length || 0) + 1,
                      semester_gpa: 9.0,
                      programming_grade: 'O',
                      attendance_pct: 95.0,
                      theory_grade: 'A+',
                      remarks: 'Good progress',
                    });
                    setShowAddModal(true);
                  }}
                  icon={<Plus className="w-4 h-4" />}
                >
                  + Enter Semester {sortedAcademics.length + 1} GPA
                </PillButton>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
                <Lock className="w-4 h-4 shrink-0" />
                <span className="text-xs font-semibold">
                  {maxAllowedSemester === 0
                    ? 'No semesters open yet — HOD will unlock when your first semester begins.'
                    : `Sem ${sortedAcademics.length + 1} entry not yet unlocked by HOD.`}
                </span>
              </div>
            )
          )}
        </div>

        {/* Improvement KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-borderLine">
          <div className="p-3.5 rounded-xl bg-background border border-borderLine flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-textSecondary uppercase">Total Improvement</p>
              <p className={`text-base font-extrabold mt-0.5 ${totalImprovement >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {totalImprovement >= 0 ? `+${totalImprovement}` : totalImprovement} GPA
              </p>
              <p className="text-[10px] text-textSecondary mt-0.5">Sem 1 ➔ Sem {sortedAcademics.length}</p>
            </div>
            <div className={`p-2 rounded-lg ${totalImprovement >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
              {totalImprovement >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-background border border-borderLine flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-textSecondary uppercase">Peak Semester GPA</p>
              <p className="text-base font-extrabold text-[#5B4FE9] mt-0.5">{highestSemGpa.toFixed(2)}</p>
              <p className="text-[10px] text-textSecondary mt-0.5">Highest score achieved</p>
            </div>
            <div className="p-2 rounded-lg bg-indigo-50 text-[#5B4FE9]">
              <Award className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-background border border-borderLine flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-textSecondary uppercase">Completed Semesters</p>
              <p className="text-base font-extrabold text-textPrimary mt-0.5">{sortedAcademics.length} / 8</p>
              <p className="text-[10px] text-textSecondary mt-0.5">Tracked records</p>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Semester-by-Semester Improvement Trend Chart */}
      <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-borderLine pb-4">
          <div>
            <h3 className="text-base font-bold text-textPrimary flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#5B4FE9]" />
              Semester-by-Semester Improvement Trajectory
            </h3>
            <p className="text-xs text-textSecondary">Visualizing semester GPA progression and growth deltas</p>
          </div>
        </div>

        {chartData.length > 0 ? (
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorGpa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5B4FE9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#5B4FE9" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" stroke="#6B7280" fontSize={11} tickLine={false} />
                <YAxis domain={[0, 10]} stroke="#6B7280" fontSize={11} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-gray-900 text-white p-3 rounded-xl shadow-lg text-xs space-y-1">
                          <p className="font-bold">{data.name}</p>
                          <p className="text-brand-primary font-extrabold text-sm">GPA: {data.gpa} / 10.0</p>
                          {data.semester > 1 && (
                            <p className={`text-[11px] font-bold ${data.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {data.delta >= 0 ? `+${data.delta}` : data.delta} change vs previous sem
                            </p>
                          )}
                          <p className="text-gray-300 text-[10px]">Attendance: {data.attendance}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="gpa" stroke="#5B4FE9" strokeWidth={3} fillOpacity={1} fill="url(#colorGpa)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-textSecondary text-center py-8">No semester records added yet. Click "+ Enter Semester GPA" above.</p>
        )}
      </div>

      {/* 3. Semester Cards Grid (Sem 1 to Sem 8) */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-textPrimary">
          Semester Performance Breakdown{!readOnly && ' (Click any semester to enter/edit)'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((semNum) => {
            const record = sortedAcademics.find((a) => Number(a.semester) === semNum);
            const prevRecord = sortedAcademics.find((a) => Number(a.semester) === semNum - 1);

            const currGpa = record ? Number(record.semester_gpa) : null;
            const prevGpa = prevRecord ? Number(prevRecord.semester_gpa) : null;
            const delta = currGpa !== null && prevGpa !== null ? Number((currGpa - prevGpa).toFixed(2)) : null;

            if (!record) {
              // BUG-01 fix: check HOD lock before showing the enter button
              const isLocked = !readOnly && !unlockLoading && semNum > maxAllowedSemester;
              return (
                <div key={semNum} className={`bg-surface border border-dashed rounded-2xl p-5 text-center flex flex-col justify-between space-y-3 transition-all ${isLocked ? 'border-amber-200 opacity-70' : 'border-borderLine hover:border-[#5B4FE9]'}`}>
                  <div className="flex items-center justify-between text-xs text-textSecondary">
                    <span className="font-bold text-textPrimary">Semester {semNum}</span>
                    <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded font-semibold">
                      {isLocked ? 'Locked' : 'Not Entered'}
                    </span>
                  </div>
                  <p className="text-xs text-textSecondary italic py-2">
                    {isLocked ? 'HOD has not yet unlocked this semester.' : `Click below to enter Sem ${semNum} GPA`}
                  </p>
                  {isLocked ? (
                    <div className="w-full py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 text-xs font-semibold flex items-center justify-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" /> Locked by HOD
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingSemester(null);
                        reset({
                          semester: semNum,
                          semester_gpa: 9.0,
                          programming_grade: 'O',
                          attendance_pct: 95.0,
                          theory_grade: 'A+',
                          remarks: '',
                        });
                        setShowAddModal(true);
                      }}
                      className="w-full py-2 rounded-xl bg-[#5B4FE9]/10 text-[#5B4FE9] text-xs font-bold hover:bg-[#5B4FE9] hover:text-white transition-all flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Enter Sem {semNum} GPA
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div key={semNum} className="bg-surface border border-borderLine rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-textPrimary">Semester {semNum}</span>
                  <div className="flex items-center gap-1">
                    {delta !== null && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${delta >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                        {delta >= 0 ? `+${delta}` : delta}
                      </span>
                    )}
                    <button onClick={() => openEdit(record)} className="p-1 text-textSecondary hover:text-brand-primary">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-2xl font-black text-brand-primary">{record.semester_gpa}</p>
                  <p className="text-[10px] text-textSecondary">GPA out of 10.0</p>
                </div>

                <div className="pt-2 border-t border-borderLine grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-textSecondary block text-[10px]">Prog. Grade</span>
                    <span className="font-bold text-textPrimary">{record.programming_grade || 'O'}</span>
                  </div>
                  <div>
                    <span className="text-textSecondary block text-[10px]">Attendance</span>
                    <span className="font-bold text-green-600">{record.attendance_pct}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add / Edit Semester Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface border border-borderLine rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-textPrimary">
              {editingSemester ? `Edit Semester ${editingSemester.semester} GPA` : 'Enter Semester Academic Record'}
            </h3>
            <form onSubmit={handleSubmit(onSaveSemester)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-textPrimary mb-1">Semester Number</label>
                {/* readOnly — pre-filled from card; prevents bypass via manual edit (BUG-02) */}
                <input {...register('semester')} type="number" min={1} max={8} readOnly className="w-full px-3 py-2 text-sm rounded-xl border border-borderLine bg-background/50 font-bold text-textPrimary cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-textPrimary mb-1">Semester GPA (0.00 - 10.00) *</label>
                <input {...register('semester_gpa')} type="number" step="0.01" min={0} max={10} placeholder="e.g. 9.15" className="w-full px-3 py-2 text-sm font-black text-brand-primary rounded-xl border border-borderLine bg-background" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-textPrimary mb-1">Programming Grade</label>
                  <input {...register('programming_grade')} placeholder="O / A+ / A" className="w-full px-3 py-2 text-sm rounded-xl border border-borderLine bg-background" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-textPrimary mb-1">Attendance %</label>
                  <input {...register('attendance_pct')} type="number" step="0.1" min={0} max={100} className="w-full px-3 py-2 text-sm rounded-xl border border-borderLine bg-background" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-textPrimary mb-1">Faculty Remarks</label>
                <input {...register('remarks')} placeholder="Comments on semester progress" className="w-full px-3 py-2 text-sm rounded-xl border border-borderLine bg-background" />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-borderLine">
                <PillButton variant="outline" size="sm" type="button" onClick={() => setShowAddModal(false)}>Cancel</PillButton>
                <PillButton variant="primary" size="sm" type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Semester GPA'}
                </PillButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
