import React from 'react';
import { Sparkles, Edit3 } from 'lucide-react';
import { PillButton } from './PillButton';

interface GreetingHeroProps {
  name: string;
  completionPercentage: number;
  onEditProfile: () => void;
}

export const GreetingHero: React.FC<GreetingHeroProps> = ({
  name,
  completionPercentage,
  onEditProfile,
}) => {
  return (
    <div className="bg-surface border border-borderLine rounded-2xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
      {/* Decorative subtle background gradient */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-brand-soft/60 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-soft text-brand-primary text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Student Placement Readiness Portal</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-textPrimary tracking-tight">
          Welcome Back, <span className="text-brand-primary">{name}</span>! ✨
        </h1>
        <p className="text-sm text-textSecondary mt-2 max-w-xl leading-relaxed">
          Ready to continue building your placement readiness profile? Your profile is currently{' '}
          <span className="font-semibold text-textPrimary">{completionPercentage}% complete</span>.
        </p>
      </div>

      <div className="relative z-10 shrink-0">
        <PillButton
          variant="primary"
          size="md"
          onClick={onEditProfile}
          icon={<Edit3 className="w-4 h-4" />}
        >
          Edit Profile
        </PillButton>
      </div>
    </div>
  );
};
