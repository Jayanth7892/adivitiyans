import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, UserCheck, Lock, CheckCircle2, XCircle, Loader2, Sparkles, Eye, EyeOff } from 'lucide-react';
import { studentSignUpSchema, facultySignUpSchema, loginSchema, StudentSignUpInput, FacultySignUpInput, LoginInput } from '../../lib/validation/auth';
import { api } from '../../lib/api';
import { cognitoSignUp, cognitoSignIn } from '../../lib/cognitoAuth';
import { useAuth } from '../../context/AuthContext';
import { PillButton } from '../../components/common/PillButton';
import { UserRole } from '../../types';

// Note: email constants are used only for display/routing.
// Passwords are NEVER stored here — validated server-side via POST /auth/admin-login.
const HOD_MASTER_EMAIL   = 'hodcseds@rgmcet.edu.in';
const ADMIN_MASTER_EMAIL = 'admin@rgmcet.edu.in';

export const AuthPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<UserRole>('student');
  const [isSignUp, setIsSignUp] = useState(false);
  const [regNoStatus, setRegNoStatus] = useState<{ loading: boolean; available?: boolean; message?: string }>({ loading: false });
  const [emailStatus, setEmailStatus] = useState<{ loading: boolean; available?: boolean; message?: string }>({ loading: false });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { login, registerSession, sessionKickedOut } = useAuth();
  const navigate = useNavigate();

  // Student Sign Up Form
  const {
    register: registerSignUp,
    handleSubmit: handleSignUpSubmit,
    watch: watchSignUp,
    setValue: setValueSignUp,
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
    defaultValues: {
      department: 'Data Science',
    },
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

    // Auto-sync college email with student registration number (e.g. 23091a3205@rgmcet.edu.in)
    const expectedEmail = `${watchedRegNo.toLowerCase()}@rgmcet.edu.in`;
    setValueSignUp('email', expectedEmail, { shouldValidate: true });

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
  }, [watchedRegNo, setValueSignUp]);

  useEffect(() => {
    if (!watchedEmail || !watchedEmail.includes('@')) {
      setEmailStatus({ loading: false });
      return;
    }

    if (watchedRegNo && watchedRegNo.length === 10) {
      const expectedEmail = `${watchedRegNo.toLowerCase()}@rgmcet.edu.in`;
      if (watchedEmail.toLowerCase() !== expectedEmail) {
        setEmailStatus({
          loading: false,
          available: false,
          message: `Email must match registration number (${expectedEmail})`,
        });
        return;
      }
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
  }, [watchedEmail, watchedRegNo]);

  const onSignUp = async (data: StudentSignUpInput) => {
    setErrorMessage(null);
    try {
      const regNo = data.registrationNumber.toUpperCase();
      let jwtToken: string | undefined;

      try {
        await cognitoSignUp({
          email: data.email,
          password: data.password,
          regNo,
          year: data.year,
          role: 'student',
        });
      } catch (cognitoErr: any) {
        const msg = cognitoErr.message || '';
        if (msg.includes('User already exists') || msg.includes('UsernameExistsException')) {
          try {
            const authRes = await cognitoSignIn(data.email, data.password);
            jwtToken = authRes.idToken;
          } catch {
            throw new Error('An account with this email already exists. Please log in using your password.');
          }
        } else {
          throw cognitoErr;
        }
      }

      if (!jwtToken) {
        const authResult = await cognitoSignIn(data.email, data.password);
        jwtToken = authResult.idToken;
      }

      // 2. Create student record in database
      await api.createStudent({
        roll_number: regNo,
        name: data.fullName,
        email: data.email,
        year: data.year,
        department: 'CSE(Data Science)',
        batch: '2023-2027',
        section: 'A',
      }).catch((dbErr: any) => {
        console.warn('[DB Student Create Notice]:', dbErr.message);
      });

      // 3. Log in to app context and navigate immediately (session registration is non-blocking)
      login(data.email, 'student', regNo, data.fullName, jwtToken);
      registerSession(data.email, 'student');
      navigate('/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Sign up failed. Please try again.');
    }
  };

  const FACULTY_SECRET_KEY = 'RGMCET_FACULTY_2026';

  const onFacultySignUp = async (data: FacultySignUpInput) => {
    setErrorMessage(null);
    try {
      if (data.securityKey !== FACULTY_SECRET_KEY) {
        throw new Error(`Invalid Faculty Secret Passcode. Authorized security key is required for ${data.department} Faculty registration.`);
      }

      const generatedFacId = `FAC_${data.email.split('@')[0].toUpperCase()}`;
      let jwtToken: string | undefined;
      await cognitoSignUp({
        email: data.email,
        password: data.password,
        regNo: generatedFacId,
        year: 'Faculty',
        role: 'faculty',
      });
      const authResult = await cognitoSignIn(data.email, data.password);
      jwtToken = authResult.idToken;

      await api.createFaculty({
        faculty_id: generatedFacId,
        name: data.fullName,
        email: data.email,
        department: data.department,
        role: 'mentor',
      }).catch((dbErr: any) => {
        console.warn('[DB Faculty Create Notice]:', dbErr.message);
      });

      login(data.email, 'faculty', generatedFacId, data.fullName, jwtToken);
      registerSession(data.email, 'faculty');
      navigate('/faculty/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Faculty sign up failed. Please try again.');
    }
  };

  const onHodSignUp = async (data: FacultySignUpInput) => {
    setErrorMessage(null);
    try {
      if (data.securityKey !== FACULTY_SECRET_KEY) {
        throw new Error(`Invalid Faculty Secret Passcode. Authorized security key is required for HOD registration.`);
      }

      const generatedHodId = `HOD_${data.email.split('@')[0].toUpperCase()}`;
      let jwtToken: string | undefined;
      await cognitoSignUp({
        email: data.email,
        password: data.password,
        regNo: generatedHodId,
        year: 'HOD',
        role: 'hod',
      });
      const authResult = await cognitoSignIn(data.email, data.password);
      jwtToken = authResult.idToken;

      await api.createFaculty({
        faculty_id: generatedHodId,
        name: data.fullName,
        email: data.email,
        department: data.department,
        role: 'hod',
      }).catch((dbErr: any) => {
        console.warn('[DB HOD Create Notice]:', dbErr.message);
      });

      login(data.email, 'hod', generatedHodId, `${data.fullName} (HOD ${data.department})`, jwtToken);
      registerSession(data.email, 'hod');
      navigate('/hod/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'HOD sign up failed. Please try again.');
    }
  };

  // Helper to decode JWT payload (base64url) for role validation
  const decodeJwtPayload = (token: string): Record<string, any> => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return {};
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(payload));
    } catch {
      return {};
    }
  };

  const onLogin = async (data: LoginInput) => {
    setErrorMessage(null);
    try {
      let displayName: string | undefined;
      let rollNo: string | undefined;
      let jwtToken: string | undefined;

      // ── MASTER ADMIN LOGIN HANDLER ──
      if (activeTab === 'admin' || data.email.toLowerCase() === ADMIN_MASTER_EMAIL) {
        // Validate credentials on the backend — passwords are in Lambda env vars, not this bundle
        const authResult = await api.adminLogin(data.email, data.password);
        if (!authResult.valid) {
          throw new Error(authResult.error || 'Incorrect password. Please enter valid admin credentials.');
        }

        login(ADMIN_MASTER_EMAIL, 'admin', 'ADMIN_MASTER', 'System Administrator', jwtToken);
        registerSession(ADMIN_MASTER_EMAIL, 'admin'); // non-blocking
        navigate('/admin/dashboard');
        return;
      }

      // ── MASTER HOD LOGIN HANDLER ──
      if (activeTab === 'hod' || data.email.toLowerCase() === HOD_MASTER_EMAIL) {
        // Validate credentials on the backend — passwords are in Lambda env vars, not this bundle
        const hodAuthResult = await api.adminLogin(data.email, data.password);
        if (!hodAuthResult.valid || hodAuthResult.role !== 'hod') {
          throw new Error(hodAuthResult.error || 'Incorrect password. Please enter the valid HOD password.');
        }

        // Attempt Cognito sign in for JWT (best-effort; HOD works without JWT if Cognito fails)
        try {
          const cognitoResult = await cognitoSignIn(HOD_MASTER_EMAIL, data.password);
          jwtToken = cognitoResult.idToken;
        } catch (cognitoErr: any) {
          // Cognito sign-in failed — HOD account may not exist in Cognito yet
          console.warn('[HOD Cognito Notice]:', cognitoErr.message);
        }

        // Auto-provision HOD record in Postgres DB using the email they logged in with
        const hodLoginEmail = data.email;
        let hod = await api.getFacultyByEmail(hodLoginEmail).catch(() => null);
        if (!hod) {
          // Also try legacy email in case of first login after credential update
          hod = await api.getFacultyByEmail(HOD_MASTER_EMAIL).catch(() => null);
        }
        if (!hod) {
          await api.createFaculty({
            faculty_id: 'HOD_CSEDS',
            name: 'Dr. HOD (CSE & Data Science)',
            email: hodLoginEmail,
            department: 'Data Science',
            role: 'hod',
          }).catch((dbErr: any) => console.warn('[DB HOD Create Notice]:', dbErr.message));
          hod = await api.getFacultyByEmail(hodLoginEmail).catch(() => null);
        }

        rollNo = 'HOD_CSEDS';
        displayName = hod ? `${hod.name} (HOD ${hod.department})` : 'Dr. HOD (CSE & Data Science)';
        login(hodLoginEmail, 'hod', rollNo, displayName, jwtToken);
        registerSession(hodLoginEmail, 'hod'); // non-blocking
        navigate('/hod/dashboard');
        return;
      }

      // Step 1: Run Cognito authentication & DB profile lookup in parallel for fast response
      const [cognitoRes, dbRes] = await Promise.allSettled([
        cognitoSignIn(data.email, data.password),
        activeTab === 'student'
          ? api.getStudentByEmail(data.email)
          : api.getFacultyByEmail(data.email).catch(() => null),
      ]);

      let preFetchedDbUser = dbRes.status === 'fulfilled' ? dbRes.value : null;

      if (cognitoRes.status === 'fulfilled') {
        jwtToken = cognitoRes.value.idToken;
      } else {
        const cognitoErr: any = cognitoRes.reason;
        const msg = cognitoErr?.message || '';

        if (msg.includes('Incorrect username or password') || msg.includes('NotAuthorizedException')) {
          throw new Error('Incorrect password. Please check your credentials and try again.');
        }

        if (msg.includes('User does not exist') || msg.includes('UserNotFoundException')) {
          let dbUser: any = preFetchedDbUser;

          if (!dbUser) {
            if (activeTab === 'student') {
              dbUser = await api.getStudentByEmail(data.email);
            } else if (activeTab === 'faculty') {
              dbUser = await api.getFacultyByEmail(data.email).catch(() => null);
            }
          }

          if (!dbUser) {
            throw new Error(`No ${activeTab} account found for this email. Please check your email or contact system admin.`);
          }

          try {
            const regNo = dbUser.roll_number || dbUser.faculty_id || data.email.split('@')[0].toUpperCase();
            await cognitoSignUp({
              email: data.email,
              password: data.password,
              regNo,
              year: dbUser.year || (activeTab === 'faculty' ? 'Faculty' : 'student'),
              role: activeTab,
            });
            const authResult = await cognitoSignIn(data.email, data.password);
            jwtToken = authResult.idToken;
          } catch (autoSignUpErr: any) {
            const signMsg = autoSignUpErr.message || '';
            if (signMsg.includes('UsernameExistsException') || signMsg.includes('already exists') || signMsg.includes('User already exists')) {
              throw new Error('Incorrect password. Please check your credentials and try again.');
            }
            if (signMsg.includes('Password') || signMsg.includes('policy')) {
              throw new Error(`Password requirement: ${signMsg}`);
            }
            throw new Error(signMsg || 'Invalid email or password. Please check your credentials and try again.');
          }
        } else {
          throw new Error(msg || 'Authentication failed');
        }
      }

      // Step 2: Validate role from JWT token
      if (jwtToken) {
        const payload = decodeJwtPayload(jwtToken);
        const tokenRole = (payload['custom:role'] || '').toLowerCase();

        if (activeTab === 'student' && tokenRole && tokenRole !== 'student') {
          throw new Error(`This account is registered as "${tokenRole}". Please use the ${tokenRole.charAt(0).toUpperCase() + tokenRole.slice(1)} tab to log in.`);
        }
        if (activeTab === 'faculty' && tokenRole && tokenRole !== 'faculty' && tokenRole !== 'mentor') {
          throw new Error(`This account is registered as "${tokenRole}". Please use the correct tab to log in.`);
        }
      }

      // Step 3: Extract DB profile info (using pre-fetched DB user if available)
      if (activeTab === 'student') {
        let student = preFetchedDbUser;
        if (!student) {
          student = await api.getStudentByEmail(data.email);
        }
        if (!student) {
          const derivedRollNo = data.email.split('@')[0].toUpperCase();
          const derivedName = derivedRollNo.startsWith('23091A')
            ? `Student ${derivedRollNo}`
            : (data.email.split('@')[0].replace(/\./g, ' ').toUpperCase() || 'Student User');

          await api.createStudent({
            roll_number: derivedRollNo,
            name: derivedName,
            email: data.email,
            year: '4th Year',
            department: 'CSE(Data Science)',
            batch: '2023-2027',
            section: 'A',
          }).catch((e) => console.warn('[Self-heal student create error]:', e));

          student = await api.getStudentByEmail(data.email);
        }

        if (student) {
          rollNo = student.roll_number;
          displayName = student.name;
        } else {
          rollNo = data.email.split('@')[0].toUpperCase();
          displayName = `Student ${rollNo}`;
        }
      } else if (activeTab === 'faculty') {
        let faculty = await api.getFacultyByEmail(data.email).catch(() => null);
        if (!faculty) {
          const facId = `FAC_${data.email.split('@')[0].toUpperCase()}`;
          const facName = data.email.split('@')[0].replace(/\./g, ' ').toUpperCase();
          await api.createFaculty({
            faculty_id: facId,
            name: facName,
            email: data.email,
            department: 'CSE(Data Science)',
            role: 'mentor',
          }).catch(() => {});
          faculty = await api.getFacultyByEmail(data.email).catch(() => null);
        }
        rollNo = faculty?.faculty_id || `FAC_${data.email.split('@')[0].toUpperCase()}`;
        displayName = faculty?.name || 'Faculty Member';
      }

      login(data.email, activeTab, rollNo, displayName, jwtToken);
      registerSession(data.email, activeTab); // non-blocking — navigate immediately
      if ((activeTab as string) === 'admin') {
        navigate('/admin/dashboard');
      } else if (activeTab === 'faculty') {
        navigate('/faculty/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please check your credentials and try again.');
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

      {/* ── Session Kicked-Out Banner ── */}
      {sessionKickedOut && (
        <div className="mt-4 sm:mx-auto sm:w-full sm:max-w-lg">
          <div
            style={{
              background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
              border: '1px solid #ef4444',
              borderRadius: '12px',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              boxShadow: '0 4px 20px rgba(239,68,68,0.25)',
            }}
          >
            <span style={{ fontSize: '20px', flexShrink: 0 }}>⚠️</span>
            <div>
              <p style={{ color: '#fecaca', fontWeight: 700, margin: 0, fontSize: '14px' }}>
                Session ended — another device signed in
              </p>
              <p style={{ color: '#fca5a5', margin: '4px 0 0', fontSize: '13px' }}>
                Your account was accessed from a different browser or device. For security, only one active session is allowed. Please log in again.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-surface py-8 px-6 shadow-sm border border-borderLine sm:rounded-2xl sm:px-10">
          {/* Inline Error Banner */}
          {errorMessage && (
            <div className="mb-6 flex items-start gap-3 bg-red-950/60 border border-red-500/50 rounded-xl px-4 py-3 text-sm animate-pulse-once">
              <span className="text-red-400 text-base mt-0.5 flex-shrink-0">✕</span>
              <div>
                <p className="font-semibold text-red-300 leading-snug">{errorMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="ml-auto text-red-400 hover:text-red-200 flex-shrink-0 transition-colors"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          )}
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
                  <label className="block text-xs font-semibold text-textPrimary mb-1">
                    College Email (@rgmcet.edu.in) *
                    {watchedRegNo && watchedRegNo.length === 10 && (
                      <span className="text-[10px] text-brand-primary ml-2 font-normal">(Auto-locked to Registration Number)</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      {...registerSignUp('email')}
                      type="email"
                      readOnly={Boolean(watchedRegNo && watchedRegNo.length === 10)}
                      placeholder="e.g. 23091a3205@rgmcet.edu.in"
                      className={`w-full px-3.5 py-2 text-sm rounded-lg border border-borderLine focus:outline-none focus:ring-2 focus:ring-brand-primary pr-10 ${
                        watchedRegNo && watchedRegNo.length === 10
                          ? 'bg-brand-soft/30 cursor-not-allowed font-bold text-brand-primary border-brand-primary/40'
                          : 'bg-background'
                      }`}
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
                    <div className="relative">
                      <input
                        {...registerSignUp('password')}
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min 8 chars, 1 letter, 1 num"
                        className="w-full px-3.5 py-2 pr-10 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary p-1 rounded-md transition-colors"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4 text-brand-primary" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {signUpErrors.password && (
                      <p className="text-xs text-alert mt-1">{signUpErrors.password.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-textPrimary mb-1">Confirm Password *</label>
                    <div className="relative">
                      <input
                        {...registerSignUp('confirmPassword')}
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Re-enter password"
                        className="w-full px-3.5 py-2 pr-10 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary p-1 rounded-md transition-colors"
                        title={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4 text-brand-primary" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
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
                  <div className="relative">
                    <input
                      {...registerLogin('password')}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter password"
                      className="w-full px-3.5 py-2 pr-10 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary p-1 rounded-md transition-colors"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4 text-brand-primary" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
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
                  <option value="CSE (Data Science)">CSE (Data Science)</option>
                  <option value="CSE">Computer Science & Engineering (CSE)</option>
                  <option value="ECE">Electronics & Communication (ECE)</option>
                  <option value="EEE">Electrical & Electronics (EEE)</option>
                  <option value="ME">Mechanical Engineering (ME)</option>
                  <option value="CE">Civil Engineering (CE)</option>
                </select>
                {facultySignUpErrors.department && (
                  <p className="text-xs text-alert mt-1">{facultySignUpErrors.department.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-textPrimary mb-1">
                  Faculty Secret Security Key *
                  <span className="text-[10px] text-brand-primary font-normal ml-2">(Passcode required for staff account)</span>
                </label>
                <input
                  {...registerFacultySignUp('securityKey')}
                  type="password"
                  placeholder="Enter Secret Security Passcode"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary font-mono text-xs"
                />
                {facultySignUpErrors.securityKey && (
                  <p className="text-xs text-alert mt-1">{facultySignUpErrors.securityKey.message}</p>
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
                  <div className="relative">
                    <input
                      {...registerFacultySignUp('password')}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min 8 chars"
                      className="w-full px-3.5 py-2 pr-10 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary p-1 rounded-md transition-colors"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4 text-brand-primary" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {facultySignUpErrors.password && (
                    <p className="text-xs text-alert mt-1">{facultySignUpErrors.password.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-textPrimary mb-1">Confirm Password *</label>
                  <div className="relative">
                    <input
                      {...registerFacultySignUp('confirmPassword')}
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Re-enter password"
                      className="w-full px-3.5 py-2 pr-10 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary p-1 rounded-md transition-colors"
                      title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4 text-brand-primary" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
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
                      ? 'Official HOD Portal. Fixed Credentials: hodcseds@rgmcet.edu.in'
                      : 'Full administrative authority to manage student directory CRUD, placement analytics & CSV export.'}
                  </p>
                </div>
              </div>


              <form onSubmit={handleLoginSubmit(onLogin)} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-textPrimary mb-1">
                    {activeTab === 'faculty' ? 'Faculty Email' : activeTab === 'hod' ? 'HOD Official Email' : 'Admin Email'}
                  </label>
                  <input
                    {...registerLogin('email')}
                    type="email"
                    placeholder={activeTab === 'hod' ? 'hodcseds@rgmcet.edu.in' : `${activeTab}@rgmcet.edu.in`}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary font-medium"
                  />
                  {loginErrors.email && (
                    <p className="text-xs text-alert mt-1">{loginErrors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-textPrimary mb-1">Password</label>
                  <div className="relative">
                    <input
                      {...registerLogin('password')}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter password"
                      className="w-full px-3.5 py-2 pr-10 text-sm rounded-lg border border-borderLine bg-background focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-textSecondary hover:text-textPrimary p-1 rounded-md transition-colors"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4 text-brand-primary" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
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

                {activeTab === 'faculty' && (
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setIsSignUp(true)}
                      className="text-xs font-semibold text-brand-primary hover:underline"
                    >
                      New Faculty Member? Register Account Here
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
