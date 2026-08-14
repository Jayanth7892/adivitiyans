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
  X,
  ShieldCheck,
  BarChart2,
  PieChart,
  Building2,
  LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  phase2?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isItemActive = (itemPath: string) => {
    const currentPathWithSearch = location.pathname + location.search;

    if (itemPath.includes('?')) {
      return currentPathWithSearch === itemPath;
    }
    if (itemPath === '/admin/dashboard') {
      return location.pathname === '/admin/dashboard' && (!location.search || location.search === '?tab=students');
    }
    return location.pathname === itemPath;
  };

  // Role-aware Navigation Configurations - Cleaned up & exact query param matching
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
      ],
    },
    {
      title: 'CAREER & PORTFOLIO',
      items: [
        { label: 'Certificates', path: '/profile?tab=certifications', icon: CheckCircle2 },
        { label: 'Resume Builder', path: '/resume-builder', icon: FileText, phase2: true },
      ],
    },
  ];

  const facultyNavGroups: NavGroup[] = [
    {
      title: 'FACULTY PORTAL',
      items: [
        { label: 'Faculty Dashboard', path: '/faculty/dashboard', icon: LayoutDashboard },
        { label: 'Mentee Directory', path: '/faculty/dashboard?tab=mentees', icon: Users },
        { label: 'Department CGPA Analytics', path: '/faculty/dashboard?tab=analytics', icon: FileBarChart },
      ],
    },
  ];

  const adminNavGroups: NavGroup[] = [
    {
      title: 'ADMINISTRATION',
      items: [
        { label: 'Admin Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
        { label: 'Student Directory (CRUD)', path: '/admin/dashboard?tab=students', icon: Users },
        { label: 'CGPA & Top Performers', path: '/admin/dashboard?tab=performance', icon: Award },
        { label: 'Faculty & Mentors', path: '/admin/dashboard?tab=faculty', icon: ShieldCheck },
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
    role === 'admin'
      ? adminNavGroups
      : role === 'faculty'
      ? facultyNavGroups
      : role === 'hod'
      ? hodNavGroups
      : studentNavGroups;

  const footerDisplayName = user?.name || (user?.email ? user.email.split('@')[0] : 'User');
  const footerInitials = footerDisplayName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm transition-opacity"
        />
      )}

      <aside
        className={`fixed top-0 left-0 bottom-0 w-[260px] bg-surface border-r border-borderLine z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo Top Bar */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-borderLine shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center text-white font-black text-lg shadow-sm">
              A
            </div>
            <span className="text-xl font-extrabold tracking-tight text-textPrimary">
              A<span className="text-brand-primary">D</span>VITIYAN<span className="text-brand-primary">S</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-textSecondary hover:bg-background"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-6">
          {activeNavGroups.map((group) => (
            <div key={group.title}>
              <p className="px-3 text-[11px] font-semibold text-textSecondary uppercase tracking-wider mb-2">
                {group.title}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(item.path);

                  return (
                    <NavLink
                      key={item.label + item.path}
                      to={item.path}
                      onClick={() => onClose()}
                      className={
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          active && !item.phase2
                            ? 'bg-brand-soft text-brand-primary font-semibold'
                            : 'text-textSecondary hover:bg-background hover:text-textPrimary'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {item.phase2 && (
                        <span className="ml-auto text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-normal">
                          Soon
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User Footer Profile & Logout */}
        <div className="p-4 border-t border-borderLine bg-surface shrink-0">
          <div className="flex items-center gap-3 mb-3 p-2 rounded-lg bg-background">
            <div className="w-9 h-9 rounded-full bg-brand-primary text-white font-bold flex items-center justify-center text-xs shrink-0">
              {footerInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-textPrimary truncate">{footerDisplayName}</p>
              <p className="text-[11px] text-brand-primary font-bold uppercase truncate">{role}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-alert hover:bg-alert-soft rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Log out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
