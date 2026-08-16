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
  const pct = Math.min(Math.max(completionPercentage, 0), 100);

  return (
    <div className="relative bg-surface border border-borderLine rounded-2xl overflow-hidden shadow-sm">
      {/* Gradient backdrop */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(120deg, var(--color-brand-soft) 0%, transparent 60%)',
        }}
      />
      {/* Decorative circle */}
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-brand-soft/40 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 px-6 py-7 md:px-8 md:py-8">
        <div className="flex-1 min-w-0">
          {/* Portal badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-soft border border-brand-primary/20 text-brand-primary text-xs font-semibold mb-4">
            <Sparkles className="w-3 h-3" />
            <span>Student Placement Readiness Portal</span>
          </div>

          {/* Heading */}
          <h1 className="text-2xl md:text-3xl font-extrabold text-textPrimary tracking-tight leading-snug">
            Welcome Back,{' '}
            <span className="text-brand-primary">{name}</span>! 👋
          </h1>

          {/* Subtext + completion */}
          <p className="text-sm text-textSecondary mt-2 mb-5 max-w-lg leading-relaxed">
            Your profile is{' '}
            <span className="font-bold text-textPrimary">{pct}% complete</span>.{' '}
            {pct < 100
              ? 'Keep going — a complete profile improves your placement readiness.'
              : 'Great job! Your profile is fully complete.'}
          </p>

          {/* Progress bar */}
          <div className="max-w-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                Profile Completion
              </span>
              <span className="text-[11px] font-bold text-brand-primary">{pct}%</span>
            </div>
            <div className="h-2 w-full bg-borderLine rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
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
    </div>
  );
};
