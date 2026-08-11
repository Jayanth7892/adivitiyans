import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { User, UserRole } from '../types';
import { getCurrentSession, cognitoSignOut } from '../lib/cognitoAuth';
import { api } from '../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// WHY sessionStorage instead of localStorage?
//
// localStorage is SHARED across all browser tabs on the same origin.
// If Student logs in on Tab 1 and HOD logs in on Tab 2, the HOD's login
// overwrites localStorage — breaking Tab 1's session and switching its
// dashboard to HOD. Using sessionStorage fixes this: each tab is fully
// isolated, so multiple accounts can coexist in different tabs cleanly.
//
// sessionStorage survives page refreshes within the same tab (F5 is safe),
// but is cleared when the tab is closed. Users must log in again in a new tab.
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_POLL_INTERVAL_MS = 30_000; // 30 seconds

// All auth keys stored in sessionStorage (tab-isolated)
const AUTH_USER_KEY      = 'advitiyans_auth_user';
const JWT_TOKEN_KEY      = 'advitiyans_jwt_token';
const SESSION_TOKEN_KEY  = 'advitiyans_session_token';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionKickedOut: boolean;
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

  // ── Force-logout when session is superseded by another device ─────────────
  const forceLogout = useCallback((reason: string) => {
    stopPolling();
    try { cognitoSignOut(); } catch { /* ignore */ }
    sessionStorage.removeItem(AUTH_USER_KEY);
    sessionStorage.removeItem(JWT_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    setUser(null);
    if (reason === 'session_superseded') {
      setSessionKickedOut(true);
    }
  }, [stopPolling]);

  // ── Poll backend to check this session is still the active one ────────────
  const startPolling = useCallback((email: string, token: string) => {
    stopPolling();
    pollTimerRef.current = setInterval(async () => {
      const result = await api.validateSession(email, token);
      if (!result.valid) {
        forceLogout(result.reason || 'invalid');
      }
    }, SESSION_POLL_INTERVAL_MS);
  }, [stopPolling, forceLogout]);

  // ── Register this tab's login as the active session in the backend ─────────
  const registerSession = useCallback(async (email: string, userRole: UserRole) => {
    const token = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    await api.registerSession(email, token, userRole);
    startPolling(email, token);
  }, [startPolling]);

  // ── Restore session on mount (reads from this tab's sessionStorage) ────────
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const saved = sessionStorage.getItem(AUTH_USER_KEY);
        if (saved) {
          try {
            const savedUser = JSON.parse(saved);
            setUser(savedUser);
            setRole(savedUser.role);

            // Resume polling with the existing session token
            const savedToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
            if (savedToken && savedUser.email) {
              const result = await api.validateSession(savedUser.email, savedToken);
              if (!result.valid) {
                forceLogout(result.reason || 'invalid');
                return;
              }
              startPolling(savedUser.email, savedToken);
            }
          } catch { /* corrupted data — ignore */ }
        }

        // Silently refresh the Cognito JWT in background
        try {
          const cognitoSession = await getCurrentSession();
          if (cognitoSession) {
            sessionStorage.setItem(JWT_TOKEN_KEY, cognitoSession.idToken);
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

  // ── Persist user to this tab's sessionStorage whenever it changes ──────────
  useEffect(() => {
    if (user) {
      sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      setRole(user.role);
    } else {
      sessionStorage.removeItem(AUTH_USER_KEY);
      sessionStorage.removeItem(JWT_TOKEN_KEY);
    }
  }, [user]);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = (email: string, userRole: UserRole, rollNumber?: string, name?: string, jwtToken?: string) => {
    setSessionKickedOut(false);

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

    // Store JWT in this tab's sessionStorage (isolated from other tabs)
    if (jwtToken) {
      sessionStorage.setItem(JWT_TOKEN_KEY, jwtToken);
    } else {
      sessionStorage.setItem(JWT_TOKEN_KEY, `demo_token_${userRole}_${Date.now()}`);
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = () => {
    stopPolling();
    try { cognitoSignOut(); } catch { /* ignore if not a Cognito user */ }
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_USER_KEY);
    sessionStorage.removeItem(JWT_TOKEN_KEY);
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
