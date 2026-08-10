import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { getCurrentSession, cognitoSignOut } from '../lib/cognitoAuth';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, role: UserRole, rollNumber?: string, name?: string, jwtToken?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [role, setRole] = useState<UserRole>('student');

  // Restore session on mount — localStorage first (instant), Cognito validation second
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // Step 1: Always try localStorage first for instant session restore
        const saved = localStorage.getItem('advitiyans_auth_user');
        if (saved) {
          try {
            const savedUser = JSON.parse(saved);
            setUser(savedUser);
            setRole(savedUser.role);
          } catch { /* corrupted data, ignore */ }
        }

        // Step 2: Try to refresh the Cognito JWT token in background
        try {
          const cognitoSession = await getCurrentSession();
          if (cognitoSession) {
            localStorage.setItem('advitiyans_jwt_token', cognitoSession.idToken);
          }
          // If no Cognito session but we have a non-student saved user, that's fine (demo auth)
          // If no Cognito session and saved user is student, the API calls will fail
          // but we keep them logged in to avoid jarring UX on mobile
        } catch {
          // Cognito check failed (network error, mobile offline, etc.)
          // Keep the localStorage session — the user stays logged in
          console.warn('[Auth] Cognito session check failed, using cached session');
        }
      } catch (e) {
        console.warn('[Auth] Session restore failed:', e);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem('advitiyans_auth_user', JSON.stringify(user));
      setRole(user.role);
    } else {
      localStorage.removeItem('advitiyans_auth_user');
      localStorage.removeItem('advitiyans_jwt_token');
    }
  }, [user]);

  const login = (email: string, userRole: UserRole, rollNumber?: string, name?: string, jwtToken?: string) => {
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

    // Store the JWT token — real Cognito token or fallback demo token
    if (jwtToken) {
      localStorage.setItem('advitiyans_jwt_token', jwtToken);
    } else {
      localStorage.setItem('advitiyans_jwt_token', `demo_token_${userRole}_${Date.now()}`);
    }
  };

  const logout = () => {
    // Sign out from Cognito (clears Cognito local storage)
    try {
      cognitoSignOut();
    } catch { /* ignore if not a Cognito user */ }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, isAuthenticated: Boolean(user), isLoading, login, logout }}>
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
