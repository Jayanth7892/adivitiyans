import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileBarChart,
  Award,
  User,
  CheckCircle2,
  FileText,
  Users,
  LogOut,
  ShieldCheck,
  BarChart2,
  PieChart,
  Building2,
  UserCheck,
  LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  isOpen: boolean;      // mobile overlay open/close
  collapsed: boolean;   // desktop icon-only rail
  onClose: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  soon?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, collapsed, onClose }) => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isItemActive = (itemPath: string) => {
    const cur = location.pathname + location.search;
    if (itemPath.includes('?')) return cur === itemPath;
    if (itemPath === '/admin/dashboard') {
      return location.pathname === '/admin/dashboard' &&
        (!location.search || location.search === '?tab=students');
    }
    return location.pathname === itemPath;
  };

  const studentNavGroups: NavGroup[] = [
    {
      title: 'OVERVIEW',
      items: [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Overall Report', path: '/profile?tab=coding-profiles', icon: PieChart },
        { label: 'Program Leaderboard', path: '/coding-analytics', icon: BarChart2 },
      ],
    },
    {
      title: 'STUDENT PROFILE',
      items: [
        { label: 'My 360° Profile', path: '/profile?tab=personal-info', icon: User },
        { label: 'My Mentor', path: '/mentor', icon: UserCheck },
        { label: 'Certificates', path: '/profile?tab=certifications', icon: CheckCircle2 },
        { label: 'Resume Builder', path: '/resume-builder', icon: FileText, soon: true },
      ],
    },
  ];

  const facultyNavGroups: NavGroup[] = [
    {
      title: 'FACULTY PORTAL',
      items: [
        { label: 'Faculty Dashboard', path: '/faculty/dashboard', icon: LayoutDashboard },
        { label: 'Mentee Directory', path: '/faculty/dashboard?tab=mentees', icon: Users },
        { label: 'Dept CGPA Analytics', path: '/faculty/dashboard?tab=analytics', icon: FileBarChart },
      ],
    },
  ];

  const adminNavGroups: NavGroup[] = [
    {
      title: 'ADMINISTRATION',
      items: [
        { label: 'Admin Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
        { label: 'Student Directory', path: '/admin/dashboard?tab=students', icon: Users },
        { label: 'CGPA & Top Performers', path: '/admin/dashboard?tab=performance', icon: Award },
        { label: 'Faculty & Mentors', path: '/admin/dashboard?tab=faculty', icon: ShieldCheck },
        { label: 'Faculty Management', path: '/admin/faculty', icon: ShieldCheck },
        { label: 'Coding Leaderboard', path: '/coding-analytics', icon: BarChart2 },
      ],
    },
  ];

  const hodNavGroups: NavGroup[] = [
    {
      title: 'HOD PORTAL',
      items: [
        { label: 'Department Overview', path: '/hod/dashboard?tab=overview', icon: Building2 },
        { label: 'Student Directory', path: '/hod/dashboard?tab=students', icon: Users },
        { label: 'CGPA & Rankings', path: '/hod/dashboard?tab=rankings', icon: Award },
        { label: 'My Mentees', path: '/hod/dashboard?tab=mentees', icon: UserCheck },
        { label: 'Coding Leaderboard', path: '/coding-analytics', icon: BarChart2 },
      ],
    },
  ];

  const activeNavGroups =
    role === 'admin' ? adminNavGroups
    : role === 'faculty' ? facultyNavGroups
    : role === 'hod' ? hodNavGroups
    : studentNavGroups;

  const rawFooterName = user?.name || (user?.email ? user.email.split('@')[0] : 'User');
  const footerDisplayName = rawFooterName.replace(/\s*\(HOD.*$/i, '').replace(/\s*\(.*$/, '').trim();
  const footerInitials = footerDisplayName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U';

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-x-0 bottom-0 top-16 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
        />
      )}

      <aside
        className={[
          'fixed top-0 left-0 bottom-0 z-50 flex flex-col bg-surface border-r border-borderLine',
          'transition-all duration-300 ease-in-out overflow-hidden',
          collapsed ? 'lg:w-[60px]' : 'lg:w-[228px]',
          isOpen ? 'w-[228px] translate-x-0' : 'w-[228px] -translate-x-full',
          'lg:translate-x-0',
        ].join(' ')}
        style={{ boxShadow: '1px 0 0 0 var(--color-borderLine)' }}
      >
        {/* ── Logo Header ── */}
        <div className="h-16 flex items-center border-b border-borderLine shrink-0 px-3.5 gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-[#0F172A] dark:bg-brand-primary p-1 flex items-center justify-center shrink-0 select-none shadow-brand ring-1 ring-white/10">
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
              {/* Outer Hexagon Lines */}
              <line x1="50" y1="18" x2="78" y2="34" stroke="white" strokeWidth="5" strokeLinecap="round" />
              <line x1="78" y1="34" x2="78" y2="66" stroke="white" strokeWidth="5" strokeLinecap="round" />
              <line x1="78" y1="66" x2="50" y2="82" stroke="white" strokeWidth="5" strokeLinecap="round" />
              <line x1="50" y1="82" x2="22" y2="66" stroke="white" strokeWidth="5" strokeLinecap="round" />
              <line x1="22" y1="66" x2="22" y2="34" stroke="white" strokeWidth="5" strokeLinecap="round" />
              <line x1="22" y1="34" x2="50" y2="18" stroke="white" strokeWidth="5" strokeLinecap="round" />
              {/* Inner Ring */}
              <polygon points="50,30 67,40 67,60 50,70 33,60 33,40" stroke="white" strokeWidth="4" strokeLinejoin="round" fill="none" opacity="0.9" />
              {/* Internal Spokes */}
              <line x1="50" y1="18" x2="50" y2="30" stroke="white" strokeWidth="4" strokeLinecap="round" />
              <line x1="78" y1="34" x2="67" y2="40" stroke="white" strokeWidth="4" strokeLinecap="round" />
              <line x1="78" y1="66" x2="67" y2="60" stroke="white" strokeWidth="4" strokeLinecap="round" />
              <line x1="50" y1="82" x2="50" y2="70" stroke="white" strokeWidth="4" strokeLinecap="round" />
              <line x1="22" y1="66" x2="33" y2="60" stroke="white" strokeWidth="4" strokeLinecap="round" />
              <line x1="22" y1="34" x2="33" y2="40" stroke="white" strokeWidth="4" strokeLinecap="round" />
              {/* Red / Coral Nodes */}
              <circle cx="22" cy="34" r="8" fill="#EF4444" stroke="white" strokeWidth="2" />
              <circle cx="78" cy="34" r="8" fill="#EF4444" stroke="white" strokeWidth="2" />
              <circle cx="50" cy="82" r="8" fill="#EF4444" stroke="white" strokeWidth="2" />
              {/* Cyan / Blue Nodes */}
              <circle cx="50" cy="18" r="8" fill="#38BDF8" stroke="white" strokeWidth="2" />
              <circle cx="22" cy="66" r="8" fill="#38BDF8" stroke="white" strokeWidth="2" />
              <circle cx="78" cy="66" r="8" fill="#38BDF8" stroke="white" strokeWidth="2" />
            </svg>
          </div>
          <div
            className={[
              'overflow-hidden transition-all duration-300',
              collapsed ? 'lg:w-0 lg:opacity-0' : 'w-auto opacity-100',
            ].join(' ')}
          >
            <p className="text-sm font-extrabold tracking-tight text-textPrimary whitespace-nowrap">
              A<span className="text-brand-primary">D</span>VITIYAN<span className="text-brand-primary">S</span>
            </p>
            <p className="text-[9px] font-semibold text-textMuted uppercase tracking-widest whitespace-nowrap -mt-0.5">
              Student 360° Platform
            </p>
          </div>
        </div>

        {/* ── Scrollable Navigation ── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-1.5">
          {activeNavGroups.map((group) => (
            <div key={group.title} className="mb-3">
              {/* Group header */}
              <div
                className={[
                  'overflow-hidden transition-all duration-300',
                  collapsed ? 'lg:h-0 lg:opacity-0' : 'h-auto opacity-100',
                ].join(' ')}
              >
                <p className="px-3 pt-2 pb-1.5 text-[10px] font-bold text-textMuted uppercase tracking-widest whitespace-nowrap">
                  {group.title}
                </p>
              </div>

              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.path);
                return (
                  <NavLink
                    key={item.label + item.path}
                    to={item.path}
                    onClick={onClose}
                    title={item.label}
                    className={[
                      'relative flex items-center mb-0.5 rounded-xl text-sm font-medium transition-all duration-150 gap-3',
                      collapsed ? 'lg:justify-center lg:px-0 lg:py-3 px-3 py-2.5' : 'px-3 py-2.5',
                      active && !item.soon
                        ? 'bg-brand-soft text-brand-primary font-semibold'
                        : 'text-textSecondary hover:bg-surface-2 hover:text-textPrimary',
                    ].join(' ')}
                  >
                    {/* Active left bar */}
                    {active && !item.soon && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-brand-primary" />
                    )}

                    <Icon className={`shrink-0 ${active && !item.soon ? 'w-[18px] h-[18px]' : 'w-[17px] h-[17px]'}`} />

                    <span
                      className={[
                        'truncate transition-all duration-300',
                        collapsed ? 'lg:hidden' : 'block',
                      ].join(' ')}
                    >
                      {item.label}
                    </span>

                    {item.soon && (
                      <span
                        className={[
                          'ml-auto text-[9px] font-bold bg-surface-2 text-textMuted border border-borderLine px-1.5 py-0.5 rounded-md shrink-0',
                          collapsed ? 'lg:hidden' : '',
                        ].join(' ')}
                      >
                        Soon
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>

        {/* ── User Footer + Logout ── */}
        <div className="shrink-0 border-t border-borderLine p-2">
          {/* User card */}
          <div
            className={[
              'overflow-hidden transition-all duration-300 mb-1',
              collapsed ? 'lg:h-0 lg:opacity-0 lg:mb-0' : 'h-auto opacity-100',
            ].join(' ')}
          >
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-2 border border-borderLine">
              <div className="w-8 h-8 rounded-full bg-brand-primary text-white font-bold flex items-center justify-center text-[10px] shrink-0 shadow-xs">
                {footerInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-textPrimary truncate leading-snug">{footerDisplayName}</p>
                <p className="text-[10px] text-brand-primary font-bold uppercase tracking-wider truncate">{role}</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Log out"
            className={[
              'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-alert hover:bg-alert-soft transition-colors',
              collapsed ? 'lg:justify-center' : '',
            ].join(' ')}
          >
            <LogOut className="w-[17px] h-[17px] shrink-0" />
            <span className={collapsed ? 'lg:hidden' : ''}>Log out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
