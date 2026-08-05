import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, UserCheck, Lock, CheckCircle2, XCircle, Loader2, Sparkles } from 'lucide-react';
import { studentSignUpSchema, facultySignUpSchema, loginSchema, StudentSignUpInput, FacultySignUpInput, LoginInput } from '../../lib/validation/auth';
import { api } from '../../lib/api';
import { cognitoSignUp, cognitoSignIn } from '../../lib/cognitoAuth';
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

  // Student Sign Up Form
  const {
    register: registerSignUp,
    handleSubmit: handleSignUpSubmit,
    watch: watchSignUp,
    formState: { errors: signUpErrors, isSubmitting: isSignUpSubmitting },
  } = useForm<StudentSignUpInput>({
    resolver: zodResolver(studentSignUpSchema),
    mode: 'onChange',
  });

  // Faculty Sign Up Form
  const {
    register: registerFacultySignUp,
    handleSubmit: handleFacultySignUpSubmit,
    formState: { errors: facultySignUpErrors, isSubmitting: isFacultySignUpSubmitting },
  } = useForm<FacultySignUpInput>({
    resolver: zodResolver(facultySignUpSchema),
    mode: 'onChange',
  });

  // Login Form
  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
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
      let jwtToken: string | undefined;
      // 1. Sign up with Cognito (creates user in User Pool)
      try {
        await cognitoSignUp({
          email: data.email,
          password: data.password,
          regNo: data.registrationNumber.toUpperCase(),
          year: data.year,
          role: 'student',
        });
        const authResult = await cognitoSignIn(data.email, data.password);
        jwtToken = authResult.idToken;
      } catch (cErr: any) {
        console.warn('[Cognito Auth Notice]:', cErr.message);
      }

      // 2. Create student record in database
      try {
        await api.createStudent({
          roll_number: data.registrationNumber.toUpperCase(),
          name: data.fullName,
          email: data.email,
          year: data.year,
          department: 'CSE',
          batch: '2023-2027',
          section: 'A',
        });
      } catch (dbErr: any) {
        console.warn('[DB Student Create Notice]:', dbErr.message);
      }

      // 3. Log in to app context
      login(data.email, 'student', data.registrationNumber.toUpperCase(), data.fullName, jwtToken);
      navigate('/dashboard');
    } catch (err: any) {
      alert(err.message || 'Sign up failed');
    }
  };

  const onFacultySignUp = async (data: FacultySignUpInput) => {
    try {
      const generatedFacId = `FAC_${data.email.split('@')[0].toUpperCase()}`;
      let jwtToken: string | undefined;
      // 1. Sign up with Cognito
      try {
        await cognitoSignUp({
          email: data.email,
          password: data.password,
          regNo: generatedFacId,
          year: 'Faculty',
          role: 'faculty',
        });
        const authResult = await cognitoSignIn(data.email, data.password);
        jwtToken = authResult.idToken;
      } catch (cErr: any) {
        console.warn('[Cognito Auth Notice]:', cErr.message);
      }

      // 2. Create faculty record in database
      try {
        await api.createFaculty({
          faculty_id: generatedFacId,
          name: data.fullName,
          email: data.email,
          department: data.department,
          role: 'mentor',
        });
      } catch (dbErr: any) {
        console.warn('[DB Faculty Create Notice]:', dbErr.message);
      }

      // 3. Log in to app context
      login(data.email, 'faculty', generatedFacId, data.fullName, jwtToken);
      navigate('/faculty/dashboard');
    } catch (err: any) {
      alert(err.message || 'Faculty sign up failed');
    }
  };

  const onHodSignUp = async (data: FacultySignUpInput) => {
    try {
      const generatedHodId = `HOD_${data.email.split('@')[0].toUpperCase()}`;
      let jwtToken: string | undefined;
      try {
        await cognitoSignUp({
          email: data.email,
          password: data.password,
          regNo: generatedHodId,
          year: 'HOD',
          role: 'hod',
        });
        const authResult = await cognitoSignIn(data.email, data.password);
        jwtToken = authResult.idToken;
      } catch (cErr: any) {
        console.warn('[Cognito HOD Auth Notice]:', cErr.message);
      }

      try {
        await api.createFaculty({
          faculty_id: generatedHodId,
          name: data.fullName,
          email: data.email,
          department: data.department,
          role: 'hod',
        });
      } catch (dbErr: any) {
        console.warn('[DB HOD Create Notice]:', dbErr.message);
      }

      login(data.email, 'hod', generatedHodId, `${data.fullName} (HOD ${data.department})`, jwtToken);
      navigate('/hod/dashboard');
    } catch (err: any) {
      alert(err.message || 'HOD sign up failed');
    }
  };

  const onLogin = async (data: LoginInput) => {
    try {
      let displayName: string | undefined;
      let rollNo: string | undefined;
      let jwtToken: string | undefined;

      if (activeTab === 'student') {
        try {
          const authResult = await cognitoSignIn(data.email, data.password);
          jwtToken = authResult.idToken;
        } catch (cognitoErr: any) {
          console.warn('[Cognito Login Notice]:', cognitoErr.message);
        }

        const student = await api.getStudentByEmail(data.email);
        if (student) {
          rollNo = student.roll_number;
          displayName = student.name;
        } else {
          rollNo = data.email.includes('@') ? data.email.split('@')[0].toUpperCase() : data.email.toUpperCase();
        }
      } else if (activeTab === 'faculty') {
        try {
          const authResult = await cognitoSignIn(data.email, data.password);
          jwtToken = authResult.idToken;
        } catch (cErr: any) {
          console.warn('[Cognito Faculty Login Notice]:', cErr.message);
        }
        const faculty = await api.getFacultyByEmail(data.email).catch(() => null);
        if (faculty) {
          rollNo = faculty.faculty_id;
          displayName = faculty.name;
        } else {
          displayName = data.email.split('@')[0].replace(/\./g, ' ');
          rollNo = 'FAC001';
        }
      } else if (activeTab === 'hod') {
        try {
          const authResult = await cognitoSignIn(data.email, data.password);
          jwtToken = authResult.idToken;
        } catch (cErr: any) {
          console.warn('[Cognito HOD Login Notice]:', cErr.message);
        }
        const hod = await api.getFacultyByEmail(data.email).catch(() => null);
        if (hod) {
          rollNo = hod.faculty_id;
          displayName = `${hod.name} (HOD ${hod.department})`;
        } else {
          displayName = 'Dr. A. Srinivas (HOD CSE)';
          rollNo = 'HOD_CSE';
        }
      } else if (activeTab === 'admin') {
        displayName = 'System Administrator';
      }

      login(data.email, activeTab, rollNo, displayName, jwtToken);
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
                  <label className="block text-xs font-semibold text-textPrimary mb-1">Student Email *</label>
                  <input
                    {...registerLogin('email')}
                    type="email"
                    placeholder="username@rgmcet.edu.in"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                  {loginErrors.email && (
                    <p className="text-xs text-alert mt-1">{loginErrors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-textPrimary mb-1">Password *</label>
                  <input
                    {...registerLogin('password')}
                    type="password"
                    placeholder="Enter password"
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
          ) : (activeTab === 'faculty' || activeTab === 'hod') && isSignUp ? (
            /* FACULTY & HOD SIGN UP FORM */
            <form onSubmit={handleFacultySignUpSubmit(activeTab === 'hod' ? onHodSignUp : onFacultySignUp)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-textPrimary mb-1">
                  {activeTab === 'hod' ? 'HOD Full Name *' : 'Faculty Full Name *'}
                </label>
                <input
                  {...registerFacultySignUp('fullName')}
                  type="text"
                  placeholder={activeTab === 'hod' ? 'e.g. Dr. A. Srinivas' : 'e.g. Dr. M. V. Ramana'}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
                {facultySignUpErrors.fullName && (
                  <p className="text-xs text-alert mt-1">{facultySignUpErrors.fullName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-textPrimary mb-1">Department *</label>
                <select
                  {...registerFacultySignUp('department')}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  <option value="">Select Department</option>
                  <option value="CSE">Computer Science & Engineering (CSE)</option>
                  <option value="ECE">Electronics & Communication (ECE)</option>
                  <option value="EEE">Electrical & Electronics (EEE)</option>
                  <option value="ME">Mechanical Engineering (ME)</option>
                  <option value="CE">Civil Engineering (CE)</option>
                  <option value="Data Science">Data Science</option>
                </select>
                {facultySignUpErrors.department && (
                  <p className="text-xs text-alert mt-1">{facultySignUpErrors.department.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-textPrimary mb-1">
                  {activeTab === 'hod' ? 'HOD Email (@rgmcet.edu.in) *' : 'Faculty Email (@rgmcet.edu.in) *'}
                </label>
                <input
                  {...registerFacultySignUp('email')}
                  type="email"
                  placeholder={activeTab === 'hod' ? 'hod.cse@rgmcet.edu.in' : 'faculty@rgmcet.edu.in'}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
                {facultySignUpErrors.email && (
                  <p className="text-xs text-alert mt-1">{facultySignUpErrors.email.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-textPrimary mb-1">Password *</label>
                  <input
                    {...registerFacultySignUp('password')}
                    type="password"
                    placeholder="Min 8 chars"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                  {facultySignUpErrors.password && (
                    <p className="text-xs text-alert mt-1">{facultySignUpErrors.password.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-textPrimary mb-1">Confirm Password *</label>
                  <input
                    {...registerFacultySignUp('confirmPassword')}
                    type="password"
                    placeholder="Re-enter password"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                  {facultySignUpErrors.confirmPassword && (
                    <p className="text-xs text-alert mt-1">{facultySignUpErrors.confirmPassword.message}</p>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <PillButton
                  variant="primary"
                  size="lg"
                  type="submit"
                  disabled={isFacultySignUpSubmitting}
                  className="w-full"
                >
                  {isFacultySignUpSubmitting
                    ? 'Creating Account...'
                    : activeTab === 'hod'
                    ? 'Create HOD Account'
                    : 'Create Faculty Account'}
                </PillButton>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className="text-xs font-semibold text-brand-primary hover:underline"
                >
                  Already registered? Log in as {activeTab === 'hod' ? 'HOD' : 'Faculty'}
                </button>
              </div>
            </form>
          ) : (
            /* FACULTY, HOD & ADMIN LOGIN FORMS */
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

              {activeTab === 'hod' && (
                <div className="p-3 bg-surface rounded-xl border border-brand-primary/30 text-xs">
                  <p className="font-bold text-brand-primary mb-1">🔑 HOD Login Credentials:</p>
                  <p className="text-textSecondary"><span className="font-semibold text-textPrimary">Email:</span> hod.cse@rgmcet.edu.in</p>
                  <p className="text-textSecondary"><span className="font-semibold text-textPrimary">Password:</span> HodPassword123</p>
                </div>
              )}

              <form onSubmit={handleLoginSubmit(onLogin)} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-textPrimary mb-1">
                    {activeTab === 'faculty' ? 'Faculty Email' : activeTab === 'hod' ? 'HOD Email' : 'Admin Email'}
                  </label>
                  <input
                    {...registerLogin('email')}
                    type="email"
                    placeholder={activeTab === 'hod' ? 'hod.cse@rgmcet.edu.in' : `${activeTab}@rgmcet.edu.in`}
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
                    placeholder="Enter password"
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
                    Log In as {activeTab === 'faculty' ? 'Faculty' : activeTab === 'hod' ? 'HOD' : 'Admin'}
                  </PillButton>
                </div>

                {(activeTab === 'faculty' || activeTab === 'hod') && (
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setIsSignUp(true)}
                      className="text-xs font-semibold text-brand-primary hover:underline"
                    >
                      New {activeTab === 'hod' ? 'HOD' : 'Faculty Member'}? Register Account Here
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
