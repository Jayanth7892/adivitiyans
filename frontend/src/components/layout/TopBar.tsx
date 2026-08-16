import React, { useState, useRef, useEffect } from 'react';
import { Menu, Bell, Search, User, LogOut, ChevronDown, X, ExternalLink, Sparkles, GraduationCap, Code2, Users, PieChart } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
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

  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const rawDisplayName = user?.name || (user?.email ? user.email.split('@')[0] : 'User');
  // Strip trailing bracketed suffix like (HOD ...) or (HOD CSE(Data Science))
  const displayName = rawDisplayName.replace(/\s*\([^)]*\)\s*$/, '').trim();

  // For HOD role, avatar circle displays 'HOD' (clearly visible)
  const avatarText = user?.role === 'hod'
    ? 'HOD'
    : displayName
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .toUpperCase() || 'U';

  const roleLabel = user?.role === 'hod' ? 'HOD(CSEDS)' : (user?.role?.toUpperCase() || 'STUDENT');

  // Close dropdowns on click outside
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

  // System pages for search
  const SYSTEM_PAGES = [
    { name: 'My Profile & Demographics', path: '/profile', category: 'Page' },
    { name: 'Student Directory', path: '/directory', category: 'Page' },
    { name: 'Coding Profiles & Live Stats', path: '/coding', category: 'Page' },
    { name: 'Placement Analytics', path: '/analytics', category: 'Page' },
    { name: 'System Admin Dashboard', path: '/admin', category: 'Page' },
  ];

  // Perform search with debounce + cancellation to prevent race conditions
  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      setSearchResults({ students: [], pages: [] });
      setIsSearchOpen(false);
      return;
    }

    setIsSearchOpen(true);
    setSearching(true);

    // cancelled is a mutable object so the cleanup closure can reach it after
    // the setTimeout fires — fixes the stale-response race condition
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
            setSearchResults({
              students: [],
              pages: matchedPages,
            });
          }
        })
        .finally(() => {
          if (!guard.cancelled) setSearching(false);
        });
    }, 300);

    return () => {
      guard.cancelled = true;  // cancel any in-flight fetch from previous query
      clearTimeout(debounceTimer);
    };
  }, [searchQuery]);

  const handleLogout = () => {
    logout();
    setIsProfileOpen(false);
    navigate('/auth');
  };

  return (
    <header className="h-16 bg-surface border-b border-borderLine px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left side — hamburger + app name */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="p-2 rounded-lg text-textSecondary hover:bg-background transition-colors"
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 md:gap-5">
        {/* Search Bar — hidden for student role (students don't search the directory) */}
        {user?.role !== 'student' && (
        <div ref={searchRef} className="relative hidden md:block">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background border border-borderLine text-xs text-textPrimary w-64 md:w-80 focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/20 transition-all">
            <Search className="w-3.5 h-3.5 text-textSecondary shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.trim() && setIsSearchOpen(true)}
              placeholder="Search students, skills, certs, pages..."
              className="bg-transparent border-none outline-none text-xs w-full text-textPrimary placeholder:text-textSecondary"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setIsSearchOpen(false);
                }}
                className="text-textSecondary hover:text-textPrimary p-0.5 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Search Dropdown Modal */}
          {isSearchOpen && (
            <div className="absolute left-0 mt-2 w-96 bg-surface border border-borderLine rounded-xl shadow-xl z-50 overflow-hidden text-xs max-h-96 overflow-y-auto">
              {searching ? (
                <div className="p-4 text-center text-textSecondary">Searching...</div>
              ) : searchResults.students.length === 0 && searchResults.pages.length === 0 ? (
                <div className="p-4 text-center text-textSecondary">No matching results found for "{searchQuery}"</div>
              ) : (
                <div className="divide-y divide-borderLine">
                  {/* System Pages */}
                  {searchResults.pages.length > 0 && (
                    <div className="p-2">
                      <p className="text-[10px] font-bold text-textSecondary uppercase tracking-wider px-2 py-1">Pages</p>
                      {searchResults.pages.map((p) => (
                        <button
                          key={p.path}
                          onClick={() => {
                            navigate(p.path);
                            setIsSearchOpen(false);
                            setSearchQuery('');
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-background flex items-center justify-between transition-colors"
                        >
                          <span className="font-semibold text-textPrimary">{p.name}</span>
                          <span className="text-[10px] bg-brand-soft text-brand-primary font-bold px-2 py-0.5 rounded">
                            {p.category}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Matching Students */}
                  {searchResults.students.length > 0 && (
                    <div className="p-2">
                      <p className="text-[10px] font-bold text-textSecondary uppercase tracking-wider px-2 py-1">Students</p>
                      {searchResults.students.map((s) => (
                        <button
                          key={s.roll_number}
                          onClick={() => {
                            navigate(`/profile?id=${s.roll_number}`);
                            setIsSearchOpen(false);
                            setSearchQuery('');
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-background flex items-center justify-between transition-colors"
                        >
                          <div>
                            <p className="font-bold text-textPrimary">{s.name}</p>
                            <p className="text-[10px] text-textSecondary">
                              {s.roll_number} • {(!s.department || s.department === 'CSE' || s.department === 'Data Science' || s.department === 'CSE (Data Science)') ? 'CSE(Data Science)' : s.department}
                            </p>
                          </div>
                          <span className="text-[10px] font-semibold text-success bg-success-soft px-2 py-0.5 rounded">
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

        {/* Notifications Icon */}
        <button className="p-2 rounded-full text-textSecondary hover:bg-background transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-primary" />
        </button>

        {/* Profile Dropdown */}
        <div ref={profileRef} className="relative border-l border-borderLine pl-3 md:pl-4">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-background transition-all focus:outline-none"
          >
            <div className="w-9 h-9 rounded-full bg-brand-primary text-white font-bold flex items-center justify-center text-xs shadow-sm ring-2 ring-brand-soft">
              {avatarText}
            </div>
            <div className="hidden sm:block text-left">
              <div className="flex items-center gap-1">
                <p className="text-xs font-bold text-textPrimary leading-tight">{displayName}</p>
                <ChevronDown className={`w-3.5 h-3.5 text-textSecondary transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
              </div>
              <p className="text-[10px] text-brand-primary font-bold tracking-wider">{roleLabel}</p>
            </div>
          </button>

          {/* Profile Floating Dropdown Menu */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-surface border border-borderLine rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
              <div className="p-4 bg-background/50 border-b border-borderLine flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-primary text-white font-bold flex items-center justify-center text-sm shadow-sm">
                  {avatarText}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-textPrimary truncate">{displayName}</p>
                  <p className="text-[11px] text-textSecondary truncate">{user?.email}</p>
                  <span className="inline-block mt-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-brand-soft text-brand-primary border border-brand-primary/20">
                    {roleLabel}
                  </span>
                </div>
              </div>

              <div className="p-2 space-y-1">
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    navigate('/profile');
                  }}
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-textPrimary hover:bg-background flex items-center gap-2.5 transition-colors"
                >
                  <User className="w-4 h-4 text-brand-primary" />
                  <span>My Profile & Demographics</span>
                </button>

                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    navigate('/coding');
                  }}
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-textPrimary hover:bg-background flex items-center gap-2.5 transition-colors"
                >
                  <Code2 className="w-4 h-4 text-brand-primary" />
                  <span>Coding Profiles & Stats</span>
                </button>
              </div>

              <div className="p-2 border-t border-borderLine bg-background/30">
                <button
                  onClick={handleLogout}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-red-600" />
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
