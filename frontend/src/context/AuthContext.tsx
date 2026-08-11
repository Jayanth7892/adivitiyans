import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { User, UserRole } from '../types';
import { getCurrentSession, cognitoSignOut } from '../lib/cognitoAuth';
import { api } from '../lib/api';

// How often to check if our session is still the active one (ms)
const SESSION_POLL_INTERVAL_MS = 30_000; // 30 seconds

const SESSION_TOKEN_KEY = 'advitiyans_session_token';
const AUTH_USER_KEY = 'advitiyans_auth_user';
const JWT_TOKEN_KEY = 'advitiyans_jwt_token';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionKickedOut: boolean;          // true when another device stole the session
  login: (email: string, role: UserRole, rollNumber?: string, name?: string, jwtToken?: string) => void;
  logout: () => void;
  registerSession: (email: string, role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<UserRole>('student');
  const [sessionKickedOut, setSessionKickedOut] = useState(false);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Stop background poll ──────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // ── Force-logout (called when session is stolen) ──────────────────────────
  const forceLogout = useCallback((reason: string) => {
    stopPolling();
    try { cognitoSignOut(); } catch { /* ignore */ }
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(JWT_TOKEN_KEY);
    localStorage.removeItem(SESSION_TOKEN_KEY);
    setUser(null);
    if (reason === 'session_superseded') {
      setSessionKickedOut(true);
    }
  }, [stopPolling]);

  // ── Start background session-validity poll ────────────────────────────────
  const startPolling = useCallback((email: string, token: string) => {
    stopPolling();
    pollTimerRef.current = setInterval(async () => {
      const result = await api.validateSession(email, token);
      if (!result.valid) {
        forceLogout(result.reason || 'invalid');
      }
    }, SESSION_POLL_INTERVAL_MS);
  }, [stopPolling, forceLogout]);

  // ── Register this login as the active session with the backend ────────────
  const registerSession = useCallback(async (email: string, userRole: UserRole) => {
    const token = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(SESSION_TOKEN_KEY, token);
    await api.registerSession(email, token, userRole);
    startPolling(email, token);
  }, [startPolling]);

  // ── Restore session on mount ──────────────────────────────────────────────
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // Step 1: Restore from localStorage for instant UX
        const saved = localStorage.getItem(AUTH_USER_KEY);
        if (saved) {
          try {
            const savedUser = JSON.parse(saved);
            setUser(savedUser);
            setRole(savedUser.role);

            // Step 2: Validate saved session token with backend
            const savedToken = localStorage.getItem(SESSION_TOKEN_KEY);
            if (savedToken && savedUser.email) {
              const result = await api.validateSession(savedUser.email, savedToken);
              if (!result.valid) {
                // Another device is active — don't restore, kick out
                forceLogout(result.reason || 'invalid');
                return;
              }
              // Resume polling with existing token
              startPolling(savedUser.email, savedToken);
            }
          } catch { /* corrupted data, ignore */ }
        }

        // Step 3: Silently refresh Cognito JWT in background
        try {
          const cognitoSession = await getCurrentSession();
          if (cognitoSession) {
            localStorage.setItem(JWT_TOKEN_KEY, cognitoSession.idToken);
          }
        } catch {
          console.warn('[Auth] Cognito session refresh failed, using cached session');
        }
      } catch (e) {
        console.warn('[Auth] Session restore failed:', e);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();

    return () => stopPolling();
  }, [forceLogout, startPolling, stopPolling]);

  // ── Persist user to localStorage whenever it changes ─────────────────────
  useEffect(() => {
    if (user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      setRole(user.role);
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
      localStorage.removeItem(JWT_TOKEN_KEY);
      // Session token removal is handled in forceLogout / logout
    }
  }, [user]);

  // ── Login (called by AuthPage after Cognito sign-in succeeds) ────────────
  const login = (email: string, userRole: UserRole, rollNumber?: string, name?: string, jwtToken?: string) => {
    setSessionKickedOut(false); // clear any previous kick-out banner

    const formattedReg = rollNumber ? rollNumber.toUpperCase() : '';
    let formattedName = name;
    if (!formattedName) {
      if (email.includes('@')) {
        const handle = email.split('@')[0];
        formattedName = handle
          .split(/[\._]/)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
      } else {
        formattedName = 'Student User';
      }
    }

    const newUser: User = {
      id: `usr_${formattedReg}`,
      email: email.toLowerCase(),
      name: formattedName,
      role: userRole,
      rollNumber: formattedReg,
      department: 'CSE(Data Science)',
    };
    setUser(newUser);

    // Store the JWT token
    if (jwtToken) {
      localStorage.setItem(JWT_TOKEN_KEY, jwtToken);
    } else {
      localStorage.setItem(JWT_TOKEN_KEY, `demo_token_${userRole}_${Date.now()}`);
    }

    // NOTE: registerSession() must be called AFTER login() by the caller (AuthPage)
    // so it can await it. login() stays synchronous for compatibility.
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = () => {
    stopPolling();
    try { cognitoSignOut(); } catch { /* ignore if not a Cognito user */ }
    localStorage.removeItem(SESSION_TOKEN_KEY);
    setUser(null);
    setSessionKickedOut(false);
  };

  return (
    <AuthContext.Provider
      value={{ user, role, isAuthenticated: Boolean(user), isLoading, sessionKickedOut, login, logout, registerSession }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
