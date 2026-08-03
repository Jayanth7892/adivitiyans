import React from 'react';
import { Menu, Bell, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface TopBarProps {
  onMenuToggle: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuToggle }) => {
  const { user } = useAuth();
  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('')
    : 'JK';

  return (
    <header className="h-16 bg-surface border-b border-borderLine px-4 md:px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg text-textSecondary hover:bg-background transition-colors"
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h2 className="text-base font-bold text-textPrimary tracking-tight flex items-center gap-2">
          <span>Advitiyans</span>
          <span className="text-xs font-normal text-textSecondary bg-background px-2 py-0.5 rounded-full border border-borderLine">
            RGMCET Student 360
          </span>
        </h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Search bar widget */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-background border border-borderLine text-xs text-textSecondary w-64">
          <Search className="w-3.5 h-3.5" />
          <span>Search skills, certs, projects...</span>
        </div>

        <button className="p-2 rounded-full text-textSecondary hover:bg-background transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-primary" />
        </button>

        <div className="flex items-center gap-3 border-l border-borderLine pl-4">
          <div className="w-9 h-9 rounded-full bg-brand-primary text-white font-bold flex items-center justify-center text-xs shadow-sm ring-2 ring-brand-soft">
            {initials}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-textPrimary leading-tight">{user?.name || 'Jayanth'}</p>
            <p className="text-[10px] text-brand-primary font-medium">{user?.role?.toUpperCase() || 'STUDENT'}</p>
          </div>
        </div>
      </div>
    </header>
  );
};
