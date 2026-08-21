import React, { useState, useRef, useEffect } from 'react';
import { PanelLeft, Bell, Search, User, LogOut, ChevronDown, X, Code2, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { StudentProfile } from '../../types';

interface TopBarProps {
  onMenuToggle: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuToggle }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    students: StudentProfile[];
    pages: { name: string; path: string; category: string }[];
  }>({ students: [], pages: [] });
  const [searching, setSearching] = useState(false);

  // Day / Night Mode state (persisted in localStorage)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const rawDisplayName = user?.name || (user?.email ? user.email.split('@')[0] : 'User');
  const displayName = rawDisplayName.replace(/\s*\(HOD.*$/i, '').replace(/\s*\(.*$/, '').trim();

  const avatarText = user?.role === 'hod'
    ? 'HOD'
    : displayName
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .toUpperCase() || 'U';

  const roleLabel = user?.role === 'hod' ? 'HOD(CSEDS)' : (user?.role?.toUpperCase() || 'STUDENT');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const SYSTEM_PAGES = [
    { name: 'My Profile & Demographics', path: '/profile', category: 'Page' },
    { name: 'Student Directory', path: '/directory', category: 'Page' },
    { name: 'Coding Profiles & Live Stats', path: '/coding', category: 'Page' },
    { name: 'Placement Analytics', path: '/analytics', category: 'Page' },
    { name: 'System Admin Dashboard', path: '/admin', category: 'Page' },
  ];

  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      setSearchResults({ students: [], pages: [] });
      setIsSearchOpen(false);
      return;
    }

    setIsSearchOpen(true);
    setSearching(true);

    const guard = { cancelled: false };

    const debounceTimer = setTimeout(() => {
      const matchedPages = SYSTEM_PAGES.filter(p => p.name.toLowerCase().includes(query));

      api.getAllStudents({ search: query })
        .then((students) => {
          if (!guard.cancelled) {
            setSearchResults({
              students: students.slice(0, 5),
              pages: matchedPages,
            });
          }
        })
        .catch(() => {
          if (!guard.cancelled) {
            setSearchResults({ students: [], pages: matchedPages });
          }
        })
        .finally(() => {
          if (!guard.cancelled) setSearching(false);
        });
    }, 300);

    return () => {
      guard.cancelled = true;
      clearTimeout(debounceTimer);
    };
  }, [searchQuery]);

  const handleLogout = () => {
    logout();
    setIsProfileOpen(false);
    navigate('/auth');
  };

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global ⌘K or Ctrl+K shortcut listener to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="h-16 bg-surface border-b border-borderLine px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left — sidebar toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="p-2 rounded-xl text-textSecondary hover:bg-surface-2 hover:text-brand-primary transition-all focus:outline-none"
          aria-label="Toggle Navigation Menu"
          title="Toggle Navigation Menu"
        >
          <PanelLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 md:gap-3">

        {/* Search — hidden for students */}
        {user?.role !== 'student' && (
          <div ref={searchRef} className="relative hidden md:block">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-2 border border-borderLine text-xs text-textPrimary w-64 lg:w-80 focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/15 transition-all">
              <Search className="w-3.5 h-3.5 text-textMuted shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.trim() && setIsSearchOpen(true)}
                placeholder="Search students, pages..."
                className="bg-transparent border-none outline-none text-xs w-full text-textPrimary placeholder:text-textMuted"
              />
              {!searchQuery && (
                <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-textMuted bg-surface border border-borderLine shadow-2xs">
                  ⌘K
                </kbd>
              )}
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setIsSearchOpen(false); }}
                  className="text-textMuted hover:text-textPrimary p-0.5 rounded-md"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Search dropdown */}
            {isSearchOpen && (
              <div className="absolute left-0 mt-2 w-96 bg-surface border border-borderLine rounded-2xl shadow-xl z-50 overflow-hidden text-xs max-h-96 overflow-y-auto">
                {searching ? (
                  <div className="p-4 text-center text-textSecondary">Searching...</div>
                ) : searchResults.students.length === 0 && searchResults.pages.length === 0 ? (
                  <div className="p-4 text-center text-textSecondary">No results for "{searchQuery}"</div>
                ) : (
                  <div className="divide-y divide-borderLine">
                    {searchResults.pages.length > 0 && (
                      <div className="p-2">
                        <p className="text-[10px] font-bold text-textMuted uppercase tracking-widest px-2 py-1.5">Pages</p>
                        {searchResults.pages.map((p) => (
                          <button
                            key={p.path}
                            onClick={() => { navigate(p.path); setIsSearchOpen(false); setSearchQuery(''); }}
                            className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-surface-2 flex items-center justify-between transition-colors"
                          >
                            <span className="font-semibold text-textPrimary">{p.name}</span>
                            <span className="text-[10px] bg-brand-soft text-brand-primary font-bold px-2 py-0.5 rounded-lg">{p.category}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults.students.length > 0 && (
                      <div className="p-2">
                        <p className="text-[10px] font-bold text-textMuted uppercase tracking-widest px-2 py-1.5">Students</p>
                        {searchResults.students.map((s) => (
                          <button
                            key={s.roll_number}
                            onClick={() => { navigate(`/profile?id=${s.roll_number}`); setIsSearchOpen(false); setSearchQuery(''); }}
                            className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-surface-2 flex items-center justify-between transition-colors"
                          >
                            <div>
                              <p className="font-bold text-textPrimary">{s.name}</p>
                              <p className="text-[10px] text-textMuted mt-0.5">
                                {s.roll_number} • {s.department || 'N/A'}
                              </p>
                            </div>
                            <span className="text-[10px] font-semibold text-success bg-success-soft px-2 py-0.5 rounded-lg">
                              View 360°
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Day / Night toggle pill */}
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          title={isDarkMode ? 'Switch to Day Mode' : 'Switch to Night Mode'}
          aria-label={isDarkMode ? 'Switch to Day Mode' : 'Switch to Night Mode'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-borderLine bg-surface-2 text-xs font-semibold text-textSecondary hover:border-brand-primary hover:text-brand-primary transition-all"
        >
          {isDarkMode ? (
            <><Sun className="w-3.5 h-3.5 text-amber-400" /><span className="hidden sm:inline">Day</span></>
          ) : (
            <><Moon className="w-3.5 h-3.5 text-indigo-400" /><span className="hidden sm:inline">Night</span></>
          )}
        </button>

        {/* Notification bell */}
        <button className="relative p-2 rounded-xl text-textSecondary hover:bg-surface-2 hover:text-textPrimary transition-colors">
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-brand-primary ring-2 ring-surface" />
        </button>

        {/* Profile dropdown */}
        <div ref={profileRef} className="relative border-l border-borderLine pl-3 md:pl-4">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-surface-2 transition-all focus:outline-none"
          >
            <div className="w-8 h-8 rounded-full bg-brand-primary text-white font-bold flex items-center justify-center text-xs shadow-xs ring-2 ring-brand-soft">
              {avatarText}
            </div>
            <div className="hidden sm:block text-left">
              <div className="flex items-center gap-1">
                <p className="text-xs font-bold text-textPrimary leading-tight">{displayName}</p>
                <ChevronDown className={`w-3 h-3 text-textMuted transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
              </div>
              <p className="text-[10px] text-brand-primary font-bold tracking-wider">{roleLabel}</p>
            </div>
          </button>

          {/* Dropdown menu */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-surface border border-borderLine rounded-2xl shadow-xl z-50 overflow-hidden">
              {/* Profile header */}
              <div className="p-4 border-b border-borderLine" style={{ background: 'linear-gradient(135deg, var(--color-brand-subtle), var(--color-surface-2))' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-primary text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                    {avatarText}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-textPrimary truncate">{displayName}</p>
                    <p className="text-[10px] text-textMuted truncate mt-0.5">{user?.email}</p>
                    <span className="inline-block mt-1.5 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-lg bg-brand-soft text-brand-primary border border-brand-primary/20">
                      {roleLabel}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-2 space-y-0.5">
                <button
                  onClick={() => { setIsProfileOpen(false); navigate('/profile'); }}
                  className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-textPrimary hover:bg-surface-2 flex items-center gap-2.5 transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-brand-primary" />
                  <span>My Profile & Demographics</span>
                </button>
                <button
                  onClick={() => { setIsProfileOpen(false); navigate('/coding'); }}
                  className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-textPrimary hover:bg-surface-2 flex items-center gap-2.5 transition-colors"
                >
                  <Code2 className="w-3.5 h-3.5 text-brand-primary" />
                  <span>Coding Profiles & Stats</span>
                </button>
              </div>

              <div className="p-2 border-t border-borderLine">
                <button
                  onClick={handleLogout}
                  className="w-full px-3 py-2.5 rounded-xl text-xs font-bold text-alert hover:bg-alert-soft flex items-center gap-2.5 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5 text-alert" />
                  <span>Sign Out / Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
