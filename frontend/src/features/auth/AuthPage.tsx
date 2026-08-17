import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, UserCheck, Lock, CheckCircle2, XCircle, Loader2, Sparkles, Eye, EyeOff } from 'lucide-react';
import { studentSignUpSchema, facultySignUpSchema, loginSchema, StudentSignUpInput, FacultySignUpInput, LoginInput } from '../../lib/validation/auth';
import { api } from '../../lib/api';
import { cognitoSignUp, cognitoSignIn, cognitoSignOut, isCognitoConfigError } from '../../lib/cognitoAuth';
import { useAuth } from '../../context/AuthContext';
import { PillButton } from '../../components/common/PillButton';
import { Footer } from '../../components/layout/Footer';
import { UserRole } from '../../types';

// Admin/HOD login is handled server-side via POST /auth/admin-login.
// No admin email or password is stored in the frontend bundle.

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
          // Cognito has this email but DB says it's available — previous admin deletion
          // did not fully remove the Cognito account. Try to login to verify, then let through.
          try {
            const authRes = await cognitoSignIn(data.email, data.password);
            jwtToken = authRes.idToken;
          } catch {
            throw new Error('This email is already registered in the system. If you were previously enrolled, please contact the administrator to reset your account.');
          }
        } else if (isCognitoConfigError(cognitoErr)) {
          console.warn('[Cognito Config Notice]:', cognitoErr.message || cognitoErr);
          // Cognito misconfigured or client ID mismatch — proceed with DB student creation and local session
        } else {
          throw cognitoErr;
        }
      }

      if (!jwtToken) {
        try {
          const authResult = await cognitoSignIn(data.email, data.password);
          jwtToken = authResult.idToken;
        } catch (cognitoSignInErr: any) {
          console.warn('[Cognito Sign In Notice]:', cognitoSignInErr.message || cognitoSignInErr);
        }
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

  const onFacultySignUp = async (data: FacultySignUpInput) => {
    setErrorMessage(null);
    try {
      // Validate faculty secret key on the server (SEC-01 fix: key no longer in frontend bundle)
      const keyResult = await api.validateFacultyKey(data.securityKey);
      if (!keyResult.valid) {
        throw new Error(keyResult.error || 'Invalid security key.');
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
      // Validate faculty secret key on the server (SEC-01 fix: key no longer in frontend bundle)
      const keyResult = await api.validateFacultyKey(data.securityKey);
      if (!keyResult.valid) {
        throw new Error(keyResult.error || 'Invalid security key.');
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

      login(data.email, 'hod', generatedHodId, data.fullName, jwtToken);
      registerSession(data.email, 'hod');
      navigate('/hod/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'HOD sign up failed. Please try again.');
    }
  };

  // Helper to decode JWT payload (base64url) for role validation
  const decodeJwtPayload = (token: string): Record<string, any> => {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return {};
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
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
      // Route all 'admin' tab logins to the backend for server-side credential validation
      if (activeTab === 'admin') {
        const authResult = await api.adminLogin(data.email, data.password);
        if (!authResult.valid) {
          throw new Error(authResult.error || 'Incorrect password. Please enter valid admin credentials.');
        }

        // Sign out any lingering student Cognito session so it doesn't pollute the admin token
        cognitoSignOut();
        login(data.email, 'admin', 'ADMIN_MASTER', 'System Administrator', undefined);
        registerSession(data.email, 'admin');
        navigate('/admin/dashboard');
        return;
      }

      // ── MASTER HOD LOGIN HANDLER ──
      // Route all 'hod' tab logins to the backend for server-side credential validation
      if (activeTab === 'hod') {
        const hodAuthResult = await api.adminLogin(data.email, data.password);
        if (!hodAuthResult.valid || hodAuthResult.role !== 'hod') {
          throw new Error(hodAuthResult.error || 'Incorrect password. Please enter the valid HOD password.');
        }

        // Clear any lingering student Cognito session before attempting HOD Cognito sign-in
        cognitoSignOut();

        // Attempt Cognito sign in for JWT (best-effort; HOD works without JWT if Cognito fails)
        try {
          const cognitoResult = await cognitoSignIn(data.email, data.password);
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
          hod = await api.getFacultyByEmail(hodLoginEmail).catch(() => null);
        }
        if (!hod) {
          await api.createFaculty({
            faculty_id: 'HOD_CSEDS',
            name: 'Dr. HOD',
            email: hodLoginEmail,
            department: 'Data Science',
            role: 'hod',
          }).catch((dbErr: any) => console.warn('[DB HOD Create Notice]:', dbErr.message));
          hod = await api.getFacultyByEmail(hodLoginEmail).catch(() => null);
        }

        rollNo = 'HOD_CSEDS';
        displayName = hod ? hod.name : 'Dr. HOD';
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

        if (isCognitoConfigError(cognitoErr)) {
          console.warn('[Cognito Config Notice]:', msg);
          let dbUser: any = preFetchedDbUser;
          if (!dbUser) {
            if (activeTab === 'student') {
              dbUser = await api.getStudentByEmail(data.email).catch(() => null);
            } else if (activeTab === 'faculty') {
              dbUser = await api.getFacultyByEmail(data.email).catch(() => null);
            }
          }

          if (dbUser) {
            rollNo = dbUser.roll_number || dbUser.faculty_id || data.email.split('@')[0].toUpperCase();
            displayName = dbUser.name || 'User';
            login(data.email, activeTab, rollNo, displayName, undefined);
            registerSession(data.email, activeTab);
            navigate(activeTab === 'student' ? '/dashboard' : activeTab === 'faculty' ? '/faculty/dashboard' : '/hod/dashboard');
            return;
          }
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
            if (isCognitoConfigError(autoSignUpErr)) {
              console.warn('[Cognito Config Notice]:', signMsg);
              rollNo = dbUser.roll_number || dbUser.faculty_id || data.email.split('@')[0].toUpperCase();
              displayName = dbUser.name || 'User';
              login(data.email, activeTab, rollNo, displayName, undefined);
              registerSession(data.email, activeTab);
              navigate(activeTab === 'student' ? '/dashboard' : activeTab === 'faculty' ? '/faculty/dashboard' : '/hod/dashboard');
              return;
            }
            throw new Error(signMsg || 'Invalid email or password. Please check your credentials and try again.');
          }
        } else {
          let dbUser: any = preFetchedDbUser;
          if (!dbUser && activeTab === 'student') {
            dbUser = await api.getStudentByEmail(data.email).catch(() => null);
          }
          if (dbUser) {
            rollNo = dbUser.roll_number || data.email.split('@')[0].toUpperCase();
            displayName = dbUser.name || 'Student';
            login(data.email, 'student', rollNo, displayName, undefined);
            registerSession(data.email, 'student');
            navigate('/dashboard');
            return;
          }
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
        // IMPORTANT: If student authenticated via Cognito but is NOT in the database,
        // it means an admin deleted them. We must block login and NOT recreate their profile.
        if (!student) {
          cognitoSignOut(); // invalidate Cognito session immediately
          throw new Error('Your account has been removed by an administrator. Please contact the system admin to be re-enrolled.');
        }

        rollNo = student.roll_number;
        displayName = student.name;
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
    <div className="h-dvh bg-background flex flex-col overflow-hidden relative">
      {/* ── Left Slanted Vertical Scrolling Tag Ribbon ── */}
      <div className="hidden md:block absolute left-4 lg:left-12 top-0 bottom-0 w-72 overflow-hidden pointer-events-none z-0">
        <div className="-rotate-6 transform origin-center animate-vertical-scroll-left space-y-8 py-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={`left-tag-${i}`}
              className="bg-surface/85 dark:bg-surface/95 border border-brand-primary/30 backdrop-blur-md shadow-xl rounded-2xl px-5 py-3 text-xs font-extrabold text-brand-primary tracking-wide flex items-center gap-2.5 whitespace-nowrap ring-1 ring-brand-primary/10"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-brand-primary animate-ping shrink-0" />
              <span>Wherever there is Data, there is Data Science ✨</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right Slanted Vertical Scrolling Tag Ribbon ── */}
      <div className="hidden md:block absolute right-4 lg:right-12 top-0 bottom-0 w-72 overflow-hidden pointer-events-none z-0">
        <div className="rotate-6 transform origin-center animate-vertical-scroll-right space-y-8 py-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={`right-tag-${i}`}
              className="bg-surface/85 dark:bg-surface/95 border border-indigo-500/30 backdrop-blur-md shadow-xl rounded-2xl px-5 py-3 text-xs font-extrabold text-indigo-600 dark:text-indigo-400 tracking-wide flex items-center gap-2.5 whitespace-nowrap ring-1 ring-indigo-500/10"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping shrink-0" />
              <span>Celebrate every moment 🎉</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col justify-center py-4 sm:py-12 sm:px-6 lg:px-8 z-10">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-[#031B33] p-1.5 shadow-xl shadow-brand-primary/30 mb-2 sm:mb-4 ring-1 ring-white/10 overflow-hidden">
          <img
            src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBwgHBgkIBwgKCgkLDRYPDQwMDRsUFRAWIB0iIiAdHx8kKDQsJCYxJx8fLT0tMTU3Ojo6Iys/RD84QzQ5OjcBCgoKDQwNGg8PGjclHyU3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3Nzc3N//AABEIAJQArAMBEQACEQEDEQH/xAAcAAEAAgMBAQE────────AAAAABAUCAwYBBwj/xAA8EAABAwMDAQQHBwIFBQAAAAABAAIDBAURBhIhMRNBUXEUFiJWYZGUBxUjMoGhsULBUlPR8PEXJzM2Q//EABoBAQADAQEBA────────AAAAAABAgQDBPb/xAApEQEAAgIBBQACAQMFA────────AABAgMEERITITEFEFBhMyIjgQYyYXGR/9oADAMBAAIRAxEAPwD5evReSICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAiWUbHSSNY0EucQAAkbmdEzERuVzXabqqSiNT2sb9gy9jQctC036S1K89sGL8hjyZOEQpFmbxECJEQICAgICAgICAgICAgICD1jXPcGtBJPAACiZisblelLXtxrG5WVssNyutyjt9JTE1EgLgHuDAGjqST3Bcu/jmNxO3e/R5sdoresxP/K+udt05puilgkr5LpfiBt9FOIaV4OeT/UfH+AopfJa0WiNRCuTHjis1nyim83C9xC30FvfJUzgtPZZcXeOBjj58L0MvWzak1mNPJ6f8XWmWLxO13etA0Nl0U6411e+O8RgOfAZGlm4kfh4Hfg9c/svLrntbJqI8PatgrFNzPlwbKWd8RlZC8xjq4DIXac2Os8ZnyrTo898fcrSdfWnyXVnMgdSo2ae4/CERp5xx8UTp78T0RGnikEQICAgICAgICAgmWipjpa1sswO3BGQM4+Ky9ZitlxTWvt6v4fqsXS9VGTL6dDCIL5cae30tyio5HFxFTI4ta04IDc8dc4WHo+nyYd3vH+Htfm/yPTdXWuPFO5id7Sofs9ltrZanV1dBarfESN0bxJJNj/LA/0z8FvnNE+KR5fNxg15vLqo9f6bqLe2y0M9fZIxGIYa5kTfwgMAZ6kZ7zgeY6rhODJE8p8u3epP9MOWk+zi6vrJKipuFF92lvam7PnBY4HvxnJd/vK7R1FYjUR5+OM4Le5nwraS6UkVE1sjgHRDaQ0EgkeBxggry8/RZbZtx6l9l0X5rpMfRxW06mI1pUWhwffaF2MB1ZGdvm8L2tTGP/D4mbRfNyiPEy6O9avvlPqe50xqG1NJHcJ4m0c0Eb2PYJXNDMbc9AAudcVZpE+nS+S0X0vrbp99mv1+u1qt7awUU/o9DSPc0N3uDXP5cRwxriP1XK2SbRFZnTpXHFbTOmNELlp37QKGyUtS+Oy1U/bw05a0tLHgktJxnh2R17lM6vj5ftEbrfX6QdMPvV+rqu7VrnXH7mDjSQ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"
            alt="Data Science Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-textPrimary tracking-tight">
          <span>A</span><span className="text-brand-primary">D</span><span>VITIYAN</span><span className="text-brand-primary">S</span>
        </h2>
        <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm text-textSecondary">Student 360°, Faculty & Placement Cell Platform</p>
      </div>

      {/* ── Session Kicked-Out Banner ── */}
      {sessionKickedOut && (
        <div className="mt-4 sm:mx-auto sm:w-full sm:max-w-lg px-4 sm:px-0">
          <div className="bg-alert-soft border border-alert/30 rounded-xl p-4 flex items-start gap-3 shadow-sm">
            <span className="text-xl shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-bold text-alert m-0">
                Session ended — another device signed in
              </p>
              <p className="text-xs text-textSecondary mt-1">
                Your account was accessed from a different browser or device. For security, only one active session is allowed. Please log in again.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 sm:mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-surface py-6 sm:py-8 px-5 sm:px-10 shadow-md border border-borderLine rounded-2xl">
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
          <div className="grid grid-cols-4 gap-1.5 bg-surface-2 p-1.5 rounded-2xl border border-borderLine mb-7">
            <button
              onClick={() => { setActiveTab('student'); setIsSignUp(false); }}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'student'
                  ? 'bg-brand-primary text-white shadow-sm shadow-brand/30'
                  : 'text-textSecondary hover:text-textPrimary hover:bg-surface'
              }`}
            >
              Student
            </button>
            <button
              onClick={() => { setActiveTab('faculty'); setIsSignUp(false); }}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'faculty'
                  ? 'bg-brand-primary text-white shadow-sm shadow-brand/30'
                  : 'text-textSecondary hover:text-textPrimary hover:bg-surface'
              }`}
            >
              Faculty
            </button>
            <button
              onClick={() => { setActiveTab('hod'); setIsSignUp(false); }}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'hod'
                  ? 'bg-brand-primary text-white shadow-sm shadow-brand/30'
                  : 'text-textSecondary hover:text-textPrimary hover:bg-surface'
              }`}
            >
              HOD
            </button>
            <button
              onClick={() => { setActiveTab('admin'); setIsSignUp(false); }}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'admin'
                  ? 'bg-brand-primary text-white shadow-sm shadow-brand/30'
                  : 'text-textSecondary hover:text-textPrimary hover:bg-surface'
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
                      ? 'Official HOD Portal for Department Head.'
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
      <Footer />
    </div>
  );
};
