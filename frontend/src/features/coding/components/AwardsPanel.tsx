import React from 'react';
import { Award as AwardIcon } from 'lucide-react';

export interface AwardItem {
  title: string;
  icon?: string;
  earnedAt?: string;
}

interface AwardsPanelProps {
  awards: AwardItem[];
  title?: string;
}

export const AwardsPanel: React.FC<AwardsPanelProps> = ({
  awards,
  title = 'Awards & Badges',
}) => {
  return (
    <div className="bg-surface border border-borderLine rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-textPrimary flex items-center gap-2">
          <AwardIcon className="w-4 h-4 text-amber-500" />
          {title}
        </h3>
        <span className="text-[11px] font-bold text-brand-primary bg-brand-soft px-2 py-0.5 rounded-full">
          {awards.length} Earned
        </span>
      </div>

      {awards.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 overflow-y-auto max-h-[190px] pr-1">
          {awards.map((award, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-background border border-borderLine flex items-center gap-3 hover:border-brand-primary/40 transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                {award.icon || '🏅'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-textPrimary truncate leading-tight">
                  {award.title}
                </p>
                {award.earnedAt && (
                  <p className="text-[10px] text-textSecondary mt-0.5">
                    {award.earnedAt}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6 border border-dashed border-borderLine rounded-xl bg-background/50">
          <AwardIcon className="w-8 h-8 text-textSecondary/40 mb-2" />
          <p className="text-xs font-semibold text-textSecondary">No awards yet</p>
          <p className="text-[11px] text-textSecondary/70 mt-0.5">
            Keep solving problems to earn badges & achievements!
          </p>
        </div>
      )}
    </div>
  );
};
