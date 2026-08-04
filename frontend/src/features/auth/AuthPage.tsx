import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, UserCheck, Lock, CheckCircle2, XCircle, Loader2, Sparkles } from 'lucide-react';
import { studentSignUpSchema, loginSchema, StudentSignUpInput, LoginInput } from '../../lib/validation/auth';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { PillButton } from '../../components/common/PillButton';
import { UserRole } from '../../types';

export const AuthPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<UserRole>('student');
  const [isSignUp, setIsSignUp] = useState(false);
  const [regNoStatus, setRegNoStatus] = useState<{ loading: boolean; available?: boolean; message?: string }>({ loading: false });
  const [emailStatus, setEmailStatus] = useState<{ loading: boolean; available?: boolean; message?: string }>({ loading: false });

  const { login } = useAuth();
  const navigate = useNavigate();

  // Sign Up Form
  const {
    register: registerSignUp,
    handleSubmit: handleSignUpSubmit,
    watch: watchSignUp,
    formState: { errors: signUpErrors, isSubmitting: isSignUpSubmitting },
  } = useForm<StudentSignUpInput>({
    resolver: zodResolver(studentSignUpSchema),
    mode: 'onChange',
  });

  // Login Form
  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    setValue: setLoginValue,
    formState: { errors: loginErrors, isSubmitting: isLoginSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  // Watch fields for live debounce availability check
  const watchedRegNo = watchSignUp('registrationNumber');
  const watchedEmail = watchSignUp('email');

  useEffect(() => {
    if (!watchedRegNo || watchedRegNo.length !== 10) {
      setRegNoStatus({ loading: false });
      return;
    }
    const timer = setTimeout(async () => {
      setRegNoStatus({ loading: true });
      try {
        const res = await api.checkAvailability('regNo', watchedRegNo);
        setRegNoStatus({ loading: false, available: res.available, message: res.message });
      } catch (e) {
        setRegNoStatus({ loading: false, available: true, message: '✓ Format valid' });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [watchedRegNo]);

  useEffect(() => {
    if (!watchedEmail || !watchedEmail.includes('@')) {
      setEmailStatus({ loading: false });
      return;
    }
    const timer = setTimeout(async () => {
      setEmailStatus({ loading: true });
      try {
        const res = await api.checkAvailability('email', watchedEmail);
        setEmailStatus({ loading: false, available: res.available, message: res.message });
      } catch (e) {
        setEmailStatus({ loading: false, available: true, message: '✓ Domain valid' });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [watchedEmail]);

  const onSignUp = async (data: StudentSignUpInput) => {
    try {
      login(data.email, 'student', data.registrationNumber, data.fullName);
      navigate('/dashboard');
    } catch (err: any) {
      alert(err.message || 'Sign up failed');
    }
  };

  const onLogin = async (data: LoginInput) => {
    try {
      let displayName: string | undefined;
      let rollNo: string | undefined;

      if (activeTab === 'student') {
        rollNo = '23091A3251';
        if (data.email.toLowerCase().includes('ananya')) {
          displayName = 'Ananya Sharma';
          rollNo = '23091A3252';
        } else if (data.email.toLowerCase().includes('vikram')) {
          displayName = 'Vikram Reddy';
          rollNo = '20091A0588';
        } else if (data.email.toLowerCase().includes('sneha')) {
          displayName = 'Sneha Patel';
          rollNo = '24091A0512';
        }
      } else if (activeTab === 'hod') {
        displayName = 'Dr. A. Srinivas (HOD CSE)';
      } else if (activeTab === 'faculty') {
        displayName = 'Dr. M. V. Ramana (Faculty)';
      } else if (activeTab === 'admin') {
        displayName = 'System Administrator';
      }

      login(data.email, activeTab, rollNo, displayName);
      if (activeTab === 'admin') {
        navigate('/admin/dashboard');
      } else if (activeTab === 'faculty') {
        navigate('/faculty/dashboard');
      } else if (activeTab === 'hod') {
        navigate('/hod/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      alert(err.message || 'Login failed');
    }
  };

  const handleDemoPreset = (role: UserRole) => {
    setActiveTab(role);
    setIsSignUp(false);
    if (role === 'student') {
      setLoginValue('email', 'jayanth@rgmcet.edu.in');
      setLoginValue('password', 'Password123');
    } else if (role === 'faculty') {
      setLoginValue('email', 'mramesh@rgmcet.edu.in');
      setLoginValue('password', 'FacultyPassword123');
    } else if (role === 'hod') {
      setLoginValue('email', 'hod.cse@rgmcet.edu.in');
      setLoginValue('password', 'HodPassword123');
    } else {
      setLoginValue('email', 'admin@rgmcet.edu.in');
      setLoginValue('password', 'AdminPassword123');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-primary text-white font-black text-2xl shadow-lg shadow-brand-primary/30 mb-4">
          A
        </div>
        <h2 className="text-3xl font-extrabold text-textPrimary tracking-tight">Advitiyans</h2>
        <p className="mt-1.5 text-sm text-textSecondary">Student 360°, Faculty & Placement Cell Platform</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-surface py-8 px-6 shadow-sm border border-borderLine sm:rounded-2xl sm:px-10">
          {/* Quick Demo Access Bar */}
          <div className="mb-6 p-3 rounded-xl bg-brand-soft border border-brand-primary/20">
            <p className="text-[11px] font-bold text-brand-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>One-Click Role Demo Presets</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleDemoPreset('student')}
                className="flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg bg-surface text-textPrimary border border-borderLine hover:border-brand-primary"
              >
                Student Demo
              </button>
              <button
                type="button"
                onClick={() => handleDemoPreset('faculty')}
                className="flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg bg-surface text-textPrimary border border-borderLine hover:border-brand-primary"
              >
                Faculty Demo
              </button>
              <button
                type="button"
                onClick={() => handleDemoPreset('hod')}
                className="flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg bg-surface text-textPrimary border border-borderLine hover:border-brand-primary"
              >
                HOD Demo
              </button>
              <button
                type="button"
                onClick={() => handleDemoPreset('admin')}
                className="flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg bg-surface text-textPrimary border border-borderLine hover:border-brand-primary"
              >
                Admin Demo
              </button>
            </div>
          </div>

          {/* Role Switcher Pill Tabs */}
          <div className="grid grid-cols-4 gap-1 bg-background p-1 rounded-xl border border-borderLine mb-8">
            <button
              onClick={() => { setActiveTab('student'); setIsSignUp(false); }}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'student'
                  ? 'bg-surface text-brand-primary shadow-sm border border-borderLine'
                  : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              Student
            </button>
            <button
              onClick={() => { setActiveTab('faculty'); setIsSignUp(false); }}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'faculty'
                  ? 'bg-surface text-brand-primary shadow-sm border border-borderLine'
                  : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              Faculty
            </button>
            <button
              onClick={() => { setActiveTab('hod'); setIsSignUp(false); }}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'hod'
                  ? 'bg-surface text-brand-primary shadow-sm border border-borderLine'
                  : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              HOD
            </button>
            <button
              onClick={() => { setActiveTab('admin'); setIsSignUp(false); }}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'admin'
                  ? 'bg-surface text-brand-primary shadow-sm border border-borderLine'
                  : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              Admin
            </button>
          </div>

          {/* Student Tab Forms */}
          {activeTab === 'student' ? (
            isSignUp ? (
              /* STUDENT SIGN UP FORM */
              <form onSubmit={handleSignUpSubmit(onSignUp)} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-textPrimary mb-1">Full Name *</label>
                  <input
                    {...registerSignUp('fullName')}
                    type="text"
                    placeholder="e.g. Jayanth Kumar"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                  {signUpErrors.fullName && (
                    <p className="text-xs text-alert mt-1">{signUpErrors.fullName.message}</p>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-textPrimary">Registration Number *</label>
                    <span className="text-[10px] text-textSecondary">Format: 23091A3251</span>
                  </div>
                  <div className="relative">
                    <input
                      {...registerSignUp('registrationNumber')}
                      type="text"
                      maxLength={10}
                      placeholder="e.g. 23091A3251"
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-borderLine bg-background uppercase focus:outline-none focus:ring-2 focus:ring-brand-primary pr-10"
                    />
                    <div className="absolute right-3 top-2.5">
                      {regNoStatus.loading && <Loader2 className="w-4 h-4 text-brand-primary animate-spin" />}
                      {!regNoStatus.loading && regNoStatus.available === true && (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      )}
                      {!regNoStatus.loading && regNoStatus.available === false && (
                        <XCircle className="w-4 h-4 text-alert" />
                      )}
                    </div>
                  </div>
                  {regNoStatus.message && (
                    <p className={`text-xs mt-1 ${regNoStatus.available ? 'text-success' : 'text-alert'}`}>
                      {regNoStatus.message}
                    </p>
                  )}
                  {signUpErrors.registrationNumber && (
                    <p className="text-xs text-alert mt-1">{signUpErrors.registrationNumber.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-textPrimary mb-1">Academic Year *</label>
                  <select
                    {...registerSignUp('year')}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  >
                    <option value="">Select Year</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                  {signUpErrors.year && (
                    <p className="text-xs text-alert mt-1">{signUpErrors.year.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-textPrimary mb-1">College Email (@rgmcet.edu.in) *</label>
                  <div className="relative">
                    <input
                      {...registerSignUp('email')}
                      type="email"
                      placeholder="username@rgmcet.edu.in"
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary pr-10"
                    />
                    <div className="absolute right-3 top-2.5">
                      {emailStatus.loading && <Loader2 className="w-4 h-4 text-brand-primary animate-spin" />}
                      {!emailStatus.loading && emailStatus.available === true && (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      )}
                      {!emailStatus.loading && emailStatus.available === false && (
                        <XCircle className="w-4 h-4 text-alert" />
                      )}
                    </div>
                  </div>
                  {emailStatus.message && (
                    <p className={`text-xs mt-1 ${emailStatus.available ? 'text-success' : 'text-alert'}`}>
                      {emailStatus.message}
                    </p>
                  )}
                  {signUpErrors.email && (
                    <p className="text-xs text-alert mt-1">{signUpErrors.email.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-textPrimary mb-1">Password *</label>
                    <input
                      {...registerSignUp('password')}
                      type="password"
                      placeholder="Min 8 chars, 1 letter, 1 num"
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                    {signUpErrors.password && (
                      <p className="text-xs text-alert mt-1">{signUpErrors.password.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-textPrimary mb-1">Confirm Password *</label>
                    <input
                      {...registerSignUp('confirmPassword')}
                      type="password"
                      placeholder="Re-enter password"
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                    {signUpErrors.confirmPassword && (
                      <p className="text-xs text-alert mt-1">{signUpErrors.confirmPassword.message}</p>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <PillButton
                    variant="primary"
                    size="lg"
                    type="submit"
                    disabled={isSignUpSubmitting}
                    className="w-full"
                  >
                    {isSignUpSubmitting ? 'Creating Account...' : 'Create Student Account'}
                  </PillButton>
                </div>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSignUp(false)}
                    className="text-xs font-semibold text-brand-primary hover:underline"
                  >
                    Already registered? Log in here
                  </button>
                </div>
              </form>
            ) : (
              /* STUDENT LOGIN FORM */
              <form onSubmit={handleLoginSubmit(onLogin)} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-textPrimary mb-1">Student Email</label>
                  <input
                    {...registerLogin('email')}
                    type="email"
                    defaultValue="jayanth@rgmcet.edu.in"
                    placeholder="username@rgmcet.edu.in"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                  {loginErrors.email && (
                    <p className="text-xs text-alert mt-1">{loginErrors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-textPrimary mb-1">Password</label>
                  <input
                    {...registerLogin('password')}
                    type="password"
                    defaultValue="Password123"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                  {loginErrors.password && (
                    <p className="text-xs text-alert mt-1">{loginErrors.password.message}</p>
                  )}
                </div>

                <div className="pt-2">
                  <PillButton
                    variant="primary"
                    size="lg"
                    type="submit"
                    disabled={isLoginSubmitting}
                    className="w-full"
                  >
                    Log In as Student
                  </PillButton>
                </div>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSignUp(true)}
                    className="text-xs font-semibold text-brand-primary hover:underline"
                  >
                    New here? Create a Student Account
                  </button>
                </div>
              </form>
            )
          ) : (
            /* FACULTY & ADMIN LOGIN FORMS */
            <div className="space-y-4">
              <div className="bg-brand-soft border border-brand-primary/20 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-brand-primary">
                <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{activeTab.toUpperCase()} Portal Login</p>
                  <p className="mt-0.5 text-[11px] text-textSecondary">
                    {activeTab === 'faculty'
                      ? 'Access assigned mentees, view student 360° analytics, and update mentor remarks.'
                      : activeTab === 'hod'
                      ? 'Read-only department analytics. View all student records, CGPA rankings, and coding platform history.'
                      : 'Full administrative authority to manage student directory CRUD, placement analytics & CSV export.'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleLoginSubmit(onLogin)} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-textPrimary mb-1">
                    {activeTab === 'faculty' ? 'Faculty Email' : activeTab === 'hod' ? 'HOD Email' : 'Admin Email'}
                  </label>
                  <input
                    {...registerLogin('email')}
                    type="email"
                    defaultValue={activeTab === 'faculty' ? 'mramesh@rgmcet.edu.in' : activeTab === 'hod' ? 'hod.cse@rgmcet.edu.in' : 'admin@rgmcet.edu.in'}
                    placeholder={`${activeTab}@rgmcet.edu.in`}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                  {loginErrors.email && (
                    <p className="text-xs text-alert mt-1">{loginErrors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-textPrimary mb-1">Password</label>
                  <input
                    {...registerLogin('password')}
                    type="password"
                    defaultValue="Password123"
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                </div>

                <div className="pt-2">
                  <PillButton
                    variant="primary"
                    size="lg"
                    type="submit"
                    disabled={isLoginSubmitting}
                    className="w-full"
                  >
                    Log In as {activeTab === 'faculty' ? 'Faculty' : activeTab === 'hod' ? 'HOD' : 'Admin'}
                  </PillButton>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
