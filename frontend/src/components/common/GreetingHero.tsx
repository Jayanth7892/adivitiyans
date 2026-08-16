import React from 'react';
import { Sparkles, Edit3, TrendingUp } from 'lucide-react';
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

  // Colour the progress bar based on completion
  const barColor =
    pct >= 80 ? '#22C55E'
    : pct >= 50 ? '#6366F1'
    : '#F59E0B';

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="relative bg-surface border border-borderLine rounded-2xl overflow-hidden shadow-sm">

      {/* ── Rich gradient banner ── */}
      <div
        className="relative h-40 w-full overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #312E81 0%, #4338CA 30%, #6366F1 60%, #818CF8 100%)',
        }}
      >
        {/* Dot mesh */}
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        {/* Glow orbs */}
        <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-32 w-40 h-40 rounded-full bg-purple-300/20 blur-2xl" />

        {/* Overlay text inside banner */}
        <div className="absolute inset-0 flex flex-col justify-center px-8">
          <div className="inline-flex items-center gap-1.5 mb-3 w-fit">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span className="text-xs font-bold text-white/80 uppercase tracking-widest">Student Placement Portal</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight drop-shadow-sm">
            {greeting}, <span className="text-yellow-200">{name}</span>! 👋
          </h1>
          <p className="text-sm text-white/70 mt-1.5 max-w-md">
            {pct < 100
              ? 'Complete your profile to maximise your placement readiness.'
              : 'Your profile is fully complete. You\'re placement-ready! 🎉'}
          </p>
        </div>
      </div>

      {/* ── Bottom content strip ── */}
      <div className="px-6 py-4 md:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Progress */}
        <div className="flex-1 max-w-md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-textSecondary" />
              <span className="text-[11px] font-bold text-textSecondary uppercase tracking-widest">Profile Completion</span>
            </div>
            <span
              className="text-sm font-extrabold"
              style={{ color: barColor }}
            >
              {pct}%
            </span>
          </div>
          <div className="h-2 w-full bg-surface-2 border border-borderLine rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: barColor }}
            />
          </div>
          <p className="text-[10px] text-textMuted mt-1.5">
            {pct >= 80 ? '🟢 Strong profile' : pct >= 50 ? '🟡 Getting there' : '🔴 Needs attention'}
            {' · '}{100 - pct}% remaining
          </p>
        </div>

        {/* CTA */}
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
