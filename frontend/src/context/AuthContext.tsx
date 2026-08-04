import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAuthenticated: boolean;
  login: (email: string, role: UserRole, rollNumber?: string, name?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_MOCK_USER: User = {
  id: 'usr_23091A3251',
  email: 'jayanth@rgmcet.edu.in',
  name: 'Jayanth Kumar',
  role: 'student',
  rollNumber: '23091A3251',
  department: 'CSE',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('advitiyans_auth_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return DEFAULT_MOCK_USER; }
    }
    return DEFAULT_MOCK_USER; // Default logged in student for smooth preview
  });

  const [role, setRole] = useState<UserRole>(user?.role || 'student');

  useEffect(() => {
    if (user) {
      localStorage.setItem('advitiyans_auth_user', JSON.stringify(user));
      setRole(user.role);
    } else {
      localStorage.removeItem('advitiyans_auth_user');
      localStorage.removeItem('advitiyans_jwt_token');
    }
  }, [user]);

  const login = (email: string, userRole: UserRole, rollNumber?: string, name?: string) => {
    const formattedReg = rollNumber ? rollNumber.toUpperCase() : '23091A3251';
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
      department: 'CSE',
    };
    setUser(newUser);
    localStorage.setItem('advitiyans_jwt_token', `mock_token_${Date.now()}`);
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, isAuthenticated: Boolean(user), login, logout }}>
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
