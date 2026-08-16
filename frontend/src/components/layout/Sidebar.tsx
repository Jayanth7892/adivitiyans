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
      {/* Mobile backdrop — tapping outside closes the sidebar.
          top-16 ensures it starts BELOW the header so the hamburger button
          remains clickable even while the sidebar overlay is open. */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-x-0 bottom-0 top-16 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
        />
      )}

      <aside
        className={[
          'fixed top-0 left-0 bottom-0 z-50 flex flex-col bg-surface border-r border-borderLine',
          'transition-all duration-300 ease-in-out overflow-hidden',
          // Desktop: always visible, width transitions between collapsed icon-rail and full
          collapsed ? 'lg:w-14' : 'lg:w-[220px]',
          // Mobile: overlay slides in/out, always full width when open
          isOpen ? 'w-[220px] translate-x-0' : 'w-[220px] -translate-x-full',
          'lg:translate-x-0',
        ].join(' ')}
        style={{ boxShadow: '2px 0 16px 0 rgba(0,0,0,0.05)' }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center border-b border-borderLine shrink-0 px-4 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm select-none">
            A
          </div>
          <div
            className={[
              'ml-2.5 overflow-hidden transition-all duration-300',
              collapsed ? 'lg:w-0 lg:opacity-0' : 'w-auto opacity-100',
            ].join(' ')}
          >
            <p className="text-sm font-extrabold tracking-tight text-textPrimary whitespace-nowrap">
              A<span className="text-brand-primary">D</span>VITIYAN<span className="text-brand-primary">S</span>
            </p>
          </div>
        </div>

        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-3">
          {activeNavGroups.map((group) => (
            <div key={group.title} className="mb-2">
              {/* Group title — hidden when collapsed on desktop */}
              <div
                className={[
                  'overflow-hidden transition-all duration-300',
                  collapsed ? 'lg:h-0 lg:opacity-0' : 'h-auto opacity-100',
                ].join(' ')}
              >
                <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-textSecondary uppercase tracking-widest whitespace-nowrap">
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
                      'flex items-center mx-2 mb-0.5 rounded-lg text-sm font-medium transition-all duration-150 gap-3',
                      collapsed ? 'lg:justify-center lg:px-0 lg:py-3 px-3 py-2.5' : 'px-3 py-2.5',
                      active && !item.soon
                        ? 'bg-brand-soft text-brand-primary font-semibold'
                        : 'text-textSecondary hover:bg-background hover:text-textPrimary',
                    ].join(' ')}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
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
                          'ml-auto text-[10px] bg-background text-textSecondary border border-borderLine px-1.5 py-0.5 rounded shrink-0',
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

        {/* User footer + Logout */}
        <div className="shrink-0 border-t border-borderLine p-2">
          {/* User info — hidden when collapsed */}
          <div
            className={[
              'overflow-hidden transition-all duration-300 mb-1',
              collapsed ? 'lg:h-0 lg:opacity-0 lg:mb-0' : 'h-auto opacity-100',
            ].join(' ')}
          >
            <div className="flex items-center gap-2 p-2 rounded-lg bg-background">
              <div className="w-7 h-7 rounded-full bg-brand-primary text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                {footerInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-textPrimary truncate">{footerDisplayName}</p>
                <p className="text-[10px] text-brand-primary font-bold uppercase truncate">{role}</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Log out"
            className={[
              'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors',
              collapsed ? 'lg:justify-center' : '',
            ].join(' ')}
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            <span className={collapsed ? 'lg:hidden' : ''}>Log out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
