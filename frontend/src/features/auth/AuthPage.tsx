import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, Loader2, Eye, EyeOff, Lock, AlertCircle } from 'lucide-react';
import { studentSignUpSchema, facultySignUpSchema, loginSchema, StudentSignUpInput, FacultySignUpInput, LoginInput, REGISTRATION_NUMBER_REGEX } from '../../lib/validation/auth';
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

  // Track blur states so errors don't bother the user mid-typing
  const [regNoBlurred, setRegNoBlurred] = useState(false);
  const [emailBlurred, setEmailBlurred] = useState(false);

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showFacPassword, setShowFacPassword] = useState(false);
  const [showFacConfirmPassword, setShowFacConfirmPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  // Student Sign Up Form - mode: 'onChange' for INSTANT password length detection
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
    watch: watchFacultySignUp,
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

  // Watch fields
  const watchedFullName = (watchSignUp('fullName') || '').trim();
  const watchedRegNo = (watchSignUp('registrationNumber') || '').trim().toUpperCase();
  const watchedEmail = (watchSignUp('email') || '').trim().toLowerCase();
  const watchedPassword = watchSignUp('password') || '';
  const watchedConfirmPassword = watchSignUp('confirmPassword') || '';

  const watchedFacPassword = watchFacultySignUp('password') || '';
  const watchedFacConfirmPassword = watchFacultySignUp('confirmPassword') || '';

  /* ──────── Check Name Validity ──────── */
  const isNameValid = watchedFullName.length >= 2;

  /* ──────── Registration Number Validation ──────── */
  const isRegNoValid = useMemo(() => {
    return REGISTRATION_NUMBER_REGEX.test(watchedRegNo);
  }, [watchedRegNo]);

  /* ──────── Email Validation ──────── */
  const isEmailValidAndMatched = useMemo(() => {
    if (!watchedEmail || !isRegNoValid) return false;
    const parts = watchedEmail.split('@');
    if (parts.length !== 2 || parts[1] !== 'rgmcet.edu.in') return false;
    return parts[0].toLowerCase() === watchedRegNo.toLowerCase();
  }, [watchedEmail, watchedRegNo, isRegNoValid]);

  /* ──────── UNLOCK PASSWORD COLUMN ONLY WHEN NAME + REG NO + EMAIL ARE ALL VERIFIED ──────── */
  const showStudentPasswordFields = useMemo(() => {
    return isNameValid && isRegNoValid && isEmailValidAndMatched;
  }, [isNameValid, isRegNoValid, isEmailValidAndMatched]);

  // Live Password Validations
  const isPasswordValid = watchedPassword.length >= 8;
  const passwordsMatch = watchedConfirmPassword.length > 0 && watchedPassword === watchedConfirmPassword;

  // Faculty live password validations
  const isFacPasswordValid = watchedFacPassword.length >= 8;
  const facPasswordsMatch = watchedFacConfirmPassword.length > 0 && watchedFacPassword === watchedFacConfirmPassword;

  // Debounced availability check for regNo
  useEffect(() => {
    if (!watchedRegNo || !isRegNoValid) {
      setRegNoStatus({ loading: false });
      return;
    }
    const timer = setTimeout(async () => {
      setRegNoStatus({ loading: true });
      try {
        const res = await api.checkAvailability('regNo', watchedRegNo);
        setRegNoStatus({ loading: false, available: res.available, message: res.message });
      } catch {
        setRegNoStatus({ loading: false, available: true });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [watchedRegNo, isRegNoValid]);

  // Handlers
  const onSignUp = async (data: StudentSignUpInput) => {
    try {
      let jwtToken: string | undefined;
      const regNo = data.registrationNumber.toUpperCase();
      const yr = parseInt(regNo.substring(0, 2), 10);
      const currentYear = new Date().getFullYear() % 100;
      const diff = currentYear - yr;
      const yearLabels = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
      const year = (diff >= 0 && diff <= 3) ? yearLabels[diff] : '4th Year';

      try {
        await cognitoSignUp({
          email: data.email,
          password: data.password,
          regNo: regNo,
          year: year,
          role: 'student',
        });
        const authResult = await cognitoSignIn(data.email, data.password);
        jwtToken = authResult.idToken;
      } catch (cErr: any) {
        console.warn('[Cognito Auth Notice]:', cErr.message);
      }

      try {
        await api.createStudent({
          roll_number: regNo,
          name: data.fullName,
          email: data.email,
          year: year as any,
          department: 'Data Science',
          batch: `20${regNo.substring(0, 2)}-20${parseInt(regNo.substring(0, 2), 10) + 4}`,
          section: 'A',
        });
      } catch (dbErr: any) {
        console.warn('[DB Student Create Notice]:', dbErr.message);
      }

      login(data.email, 'student', regNo, data.fullName, jwtToken);
      navigate('/dashboard');
    } catch (err: any) {
      alert(err.message || 'Sign up failed');
    }
  };

  const onFacultySignUp = async (data: FacultySignUpInput) => {
    try {
      const generatedFacId = `FAC_${data.email.split('@')[0].toUpperCase()}`;
      let jwtToken: string | undefined;
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

  /* Input styles — compact and clean to guarantee NO SCROLLING */
  const inputCls = "w-full px-3.5 py-2 text-sm rounded-xl border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all";
  const labelCls = "block text-xs font-bold text-textPrimary mb-1";
  const errorCls = "text-xs font-semibold text-alert mt-1 flex items-center gap-1";

  // Reset tab state
  const handleTabSwitch = (role: UserRole) => {
    setActiveTab(role);
    setIsSignUp(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setRegNoBlurred(false);
    setEmailBlurred(false);
  };

  return (
    /* Outer container: 100vh height, overflow-hidden (NO SCROLLBAR EVER) */
    <div className="h-screen w-screen bg-background flex flex-col items-center justify-center overflow-hidden p-4">
      {/* Header */}
      <div className="text-center mb-3 flex-shrink-0">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-primary text-white font-black text-xl shadow-md shadow-brand-primary/20 mb-1">
          A
        </div>
        <h1 className="text-2xl font-extrabold text-textPrimary tracking-tight">Advitiyans</h1>
        <p className="text-xs font-medium text-textSecondary mt-0.5">Student 360°, Faculty & Placement Cell Platform</p>
      </div>

      {/* Card: 50vw width (25% margin left & 25% margin right), max 540px, NO OVERFLOW / SCROLLBAR EVER */}
      <div className="w-[50vw] max-w-[540px] min-w-[320px] bg-surface py-5 px-7 shadow-md border border-borderLine rounded-3xl flex-shrink-0 overflow-hidden">
        {/* Role Switcher */}
        <div className="grid grid-cols-4 gap-1 bg-background p-1 rounded-2xl border border-borderLine mb-3.5">
          {(['student', 'faculty', 'hod', 'admin'] as UserRole[]).map((role) => (
            <button
              key={role}
              onClick={() => handleTabSwitch(role)}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === role
                  ? 'bg-surface text-brand-primary shadow-sm border border-borderLine'
                  : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              {role === 'hod' ? 'HOD' : role.charAt(0).toUpperCase() + role.slice(1)}
            </button>
          ))}
        </div>

        {/* STUDENT TAB */}
        {activeTab === 'student' ? (
          isSignUp ? (
            /* Student Sign Up Form */
            <form onSubmit={handleSignUpSubmit(onSignUp)} className="space-y-2.5">
              {/* Full Name */}
              <div>
                <label className={labelCls}>Full Name *</label>
                <input
                  {...registerSignUp('fullName')}
                  type="text"
                  placeholder="e.g. Jayanth Kumar"
                  className={inputCls}
                  autoComplete="name"
                />
                {signUpErrors.fullName && <p className={errorCls}><AlertCircle className="w-3.5 h-3.5 shrink-0" />{signUpErrors.fullName.message}</p>}
              </div>

              {/* Registration Number */}
              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <label className={labelCls} style={{ marginBottom: 0 }}>Registration Number *</label>
                  <span className="text-[10px] text-textSecondary font-mono font-semibold">Format: 23091A32A5</span>
                </div>
                <div className="relative">
                  <input
                    {...registerSignUp('registrationNumber')}
                    type="text"
                    maxLength={10}
                    placeholder="e.g. 23091A32A5"
                    className={`${inputCls} uppercase pr-8 font-mono tracking-wider`}
                    autoComplete="off"
                    onBlur={() => setRegNoBlurred(true)}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {regNoStatus.loading && <Loader2 className="w-4 h-4 text-brand-primary animate-spin" />}
                  </div>
                </div>

                {/* Show "Invalid Registration Number" ONLY after blur or when 10 chars entered and format fails */}
                {(regNoBlurred || watchedRegNo.length === 10) && !isRegNoValid && watchedRegNo.length > 0 && (
                  <p className={errorCls}>
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Invalid Registration Number
                  </p>
                )}
              </div>

              {/* College Email */}
              <div>
                <label className={labelCls}>College Email (@rgmcet.edu.in) *</label>
                <div className="relative">
                  <input
                    {...registerSignUp('email')}
                    type="email"
                    placeholder={isRegNoValid ? `${watchedRegNo.toLowerCase()}@rgmcet.edu.in` : '23091a32a5@rgmcet.edu.in'}
                    className={`${inputCls} lowercase pr-10`}
                    autoComplete="email"
                    onBlur={() => setEmailBlurred(true)}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {emailStatus.loading && <Loader2 className="w-4 h-4 text-brand-primary animate-spin" />}
                    {/* GREEN TICK MARK ONLY FOR GMAIL WHEN VERIFIED */}
                    {!emailStatus.loading && isEmailValidAndMatched && (
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    )}
                  </div>
                </div>

                {/* Show "Invalid Email" ONLY after blur or when typing finished and format fails */}
                {(emailBlurred || watchedEmail.length >= expectedEmailLength(watchedRegNo)) && !isEmailValidAndMatched && watchedEmail.length > 0 && (
                  <p className={errorCls}>
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Invalid Email
                  </p>
                )}
              </div>

              {/* Password Columns — UNLOCKED ONLY AFTER NAME + REG NO + EMAIL ARE ALL VERIFIED */}
              {showStudentPasswordFields ? (
                <>
                  <div className="grid grid-cols-2 gap-3 pt-0.5">
                    {/* Password */}
                    <div>
                      <label className={labelCls}>Password *</label>
                      <div className="relative">
                        <input
                          {...registerSignUp('password')}
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Min 8 chars"
                          className={`${inputCls} pr-9`}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {/* Live Password Length Check (Instantly disappears when 8 chars entered) */}
                      {watchedPassword.length > 0 && !isPasswordValid && (
                        <p className={errorCls}><AlertCircle className="w-3.5 h-3.5 shrink-0" />Password must be at least 8 characters</p>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className={labelCls}>Confirm Password *</label>
                      <div className="relative">
                        <input
                          {...registerSignUp('confirmPassword')}
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Re-enter password"
                          className={`${inputCls} pr-9 ${
                            watchedConfirmPassword
                              ? passwordsMatch ? 'border-success ring-1 ring-success/20' : 'border-alert ring-1 ring-alert/20'
                              : ''
                          }`}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary transition-colors"
                          tabIndex={-1}
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {watchedConfirmPassword.length > 0 && !passwordsMatch && (
                        <p className={errorCls}>Passwords do not match</p>
                      )}
                    </div>
                  </div>

                  <PillButton
                    variant="primary"
                    size="md"
                    type="submit"
                    disabled={isSignUpSubmitting || !isPasswordValid || !passwordsMatch}
                    className="w-full mt-1.5 py-2.5 text-sm"
                  >
                    {isSignUpSubmitting ? 'Creating Account...' : 'Create Student Account'}
                  </PillButton>
                </>
              ) : (
                /* Locked hint banner when password fields not unlocked */
                <div className="flex items-center gap-2 px-3 py-2 bg-background rounded-xl border border-borderLine text-xs font-medium text-textSecondary">
                  <Lock className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                  <span>
                    {!isNameValid
                      ? 'Enter Full Name to proceed'
                      : !isRegNoValid
                      ? 'Enter valid 10-character Registration Number'
                      : 'Enter matching college email to unlock password option'}
                  </span>
                </div>
              )}

              <div className="text-center pt-0.5">
                <button
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className="text-xs font-bold text-brand-primary hover:underline"
                >
                  Already registered? Log in here
                </button>
              </div>
            </form>
          ) : (
            /* Student Login Form */
            <form onSubmit={handleLoginSubmit(onLogin)} className="space-y-3.5">
              <div>
                <label className={labelCls}>Student Email *</label>
                <input
                  {...registerLogin('email')}
                  type="email"
                  placeholder="23091a32a5@rgmcet.edu.in"
                  className={inputCls}
                  autoComplete="email"
                />
                {loginErrors.email && <p className={errorCls}><AlertCircle className="w-3.5 h-3.5 shrink-0" />{loginErrors.email.message}</p>}
              </div>

              <div>
                <label className={labelCls}>Password *</label>
                <div className="relative">
                  <input
                    {...registerLogin('password')}
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder="Enter password"
                    className={`${inputCls} pr-9`}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary transition-colors"
                    tabIndex={-1}
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {loginErrors.password && <p className={errorCls}><AlertCircle className="w-3.5 h-3.5 shrink-0" />{loginErrors.password.message}</p>}
              </div>

              <PillButton variant="primary" size="md" type="submit" disabled={isLoginSubmitting} className="w-full py-2.5 text-sm">
                Log In as Student
              </PillButton>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setIsSignUp(true)}
                  className="text-xs font-bold text-brand-primary hover:underline"
                >
                  New here? Create a Student Account
                </button>
              </div>
            </form>
          )
        ) : (activeTab === 'faculty' || activeTab === 'hod') && isSignUp ? (
          /* Faculty / HOD Sign Up Form */
          <form onSubmit={handleFacultySignUpSubmit(activeTab === 'hod' ? onHodSignUp : onFacultySignUp)} className="space-y-3">
            <div>
              <label className={labelCls}>{activeTab === 'hod' ? 'HOD Full Name *' : 'Faculty Full Name *'}</label>
              <input
                {...registerFacultySignUp('fullName')}
                type="text"
                placeholder={activeTab === 'hod' ? 'e.g. Dr. A. Srinivas' : 'e.g. Dr. M. V. Ramana'}
                className={inputCls}
                autoComplete="name"
              />
              {facultySignUpErrors.fullName && <p className={errorCls}><AlertCircle className="w-3.5 h-3.5 shrink-0" />{facultySignUpErrors.fullName.message}</p>}
            </div>

            <div>
              <label className={labelCls}>Department *</label>
              <select
                {...registerFacultySignUp('department')}
                className={inputCls}
              >
                <option value="">Select Department</option>
                <option value="CSE">Computer Science & Engineering (CSE)</option>
                <option value="ECE">Electronics & Communication (ECE)</option>
                <option value="EEE">Electrical & Electronics (EEE)</option>
                <option value="ME">Mechanical Engineering (ME)</option>
                <option value="CE">Civil Engineering (CE)</option>
                <option value="Data Science">Data Science</option>
              </select>
              {facultySignUpErrors.department && <p className={errorCls}><AlertCircle className="w-3.5 h-3.5 shrink-0" />{facultySignUpErrors.department.message}</p>}
            </div>

            <div>
              <label className={labelCls}>
                {activeTab === 'hod' ? 'HOD Email (@rgmcet.edu.in) *' : 'Faculty Email (@rgmcet.edu.in) *'}
              </label>
              <input
                {...registerFacultySignUp('email')}
                type="email"
                placeholder={activeTab === 'hod' ? 'hod.cse@rgmcet.edu.in' : 'faculty@rgmcet.edu.in'}
                className={inputCls}
                autoComplete="email"
              />
              {facultySignUpErrors.email && <p className={errorCls}><AlertCircle className="w-3.5 h-3.5 shrink-0" />{facultySignUpErrors.email.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Password *</label>
                <div className="relative">
                  <input
                    {...registerFacultySignUp('password')}
                    type={showFacPassword ? 'text' : 'password'}
                    placeholder="Min 8 chars"
                    className={`${inputCls} pr-9`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFacPassword(!showFacPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary transition-colors"
                    tabIndex={-1}
                  >
                    {showFacPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {watchedFacPassword.length > 0 && !isFacPasswordValid && (
                  <p className={errorCls}><AlertCircle className="w-3.5 h-3.5 shrink-0" />Password must be at least 8 characters</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Confirm Password *</label>
                <div className="relative">
                  <input
                    {...registerFacultySignUp('confirmPassword')}
                    type={showFacConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    className={`${inputCls} pr-9 ${
                      watchedFacConfirmPassword
                        ? facPasswordsMatch ? 'border-success ring-1 ring-success/20' : 'border-alert ring-1 ring-alert/20'
                        : ''
                    }`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFacConfirmPassword(!showFacConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary transition-colors"
                    tabIndex={-1}
                  >
                    {showFacConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {watchedFacConfirmPassword.length > 0 && !facPasswordsMatch && <p className={errorCls}>Passwords do not match</p>}
              </div>
            </div>

            <PillButton
              variant="primary"
              size="md"
              type="submit"
              disabled={isFacultySignUpSubmitting || !isFacPasswordValid || !facPasswordsMatch}
              className="w-full mt-1 py-2.5 text-sm"
            >
              {isFacultySignUpSubmitting
                ? 'Creating Account...'
                : activeTab === 'hod'
                ? 'Create HOD Account'
                : 'Create Faculty Account'}
            </PillButton>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className="text-xs font-bold text-brand-primary hover:underline"
              >
                Already registered? Log in as {activeTab === 'hod' ? 'HOD' : 'Faculty'}
              </button>
            </div>
          </form>
        ) : (
          /* Faculty / HOD / Admin Login Form */
          <div className="space-y-3.5">
            <div className="bg-brand-soft border border-brand-primary/20 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-brand-primary">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{activeTab.toUpperCase()} Portal Login</p>
                <p className="mt-0.5 text-[11px] text-textSecondary">
                  {activeTab === 'faculty'
                    ? 'Access assigned mentees, view student 360° analytics, and update mentor remarks.'
                    : activeTab === 'hod'
                    ? 'Read-only department analytics. View all student records, CGPA rankings, and coding platform history.'
                    : 'Full administrative authority to manage student directory CRUD, placement analytics & CSV export.'}
                </p>
              </div>
            </div>

            <form onSubmit={handleLoginSubmit(onLogin)} className="space-y-3.5">
              <div>
                <label className={labelCls}>
                  {activeTab === 'faculty' ? 'Faculty Email' : activeTab === 'hod' ? 'HOD Email' : 'Admin Email'}
                </label>
                <input
                  {...registerLogin('email')}
                  type="email"
                  placeholder={activeTab === 'hod' ? 'hod.cse@rgmcet.edu.in' : `${activeTab}@rgmcet.edu.in`}
                  className={inputCls}
                  autoComplete="email"
                />
                {loginErrors.email && <p className={errorCls}><AlertCircle className="w-3.5 h-3.5 shrink-0" />{loginErrors.email.message}</p>}
              </div>

              <div>
                <label className={labelCls}>Password</label>
                <div className="relative">
                  <input
                    {...registerLogin('password')}
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder="Enter password"
                    className={`${inputCls} pr-9`}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary transition-colors"
                    tabIndex={-1}
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {loginErrors.password && <p className={errorCls}><AlertCircle className="w-3.5 h-3.5 shrink-0" />{loginErrors.password.message}</p>}
              </div>

              <PillButton variant="primary" size="md" type="submit" disabled={isLoginSubmitting} className="w-full py-2.5 text-sm">
                Log In as {activeTab === 'faculty' ? 'Faculty' : activeTab === 'hod' ? 'HOD' : 'Admin'}
              </PillButton>

              {(activeTab === 'faculty' || activeTab === 'hod') && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setIsSignUp(true)}
                    className="text-xs font-bold text-brand-primary hover:underline"
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
  );
};

function expectedEmailLength(regNo: string): number {
  return (regNo || '').length + '@rgmcet.edu.in'.length;
}
