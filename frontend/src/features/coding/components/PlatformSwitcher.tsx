import React from 'react';
import { CheckCircle2, ExternalLink, PlusCircle } from 'lucide-react';
import { PlatformConfig, PlatformId, PlatformStatsSnapshot } from '../platformData';

interface PlatformSwitcherProps {
  platforms: PlatformConfig[];
  linkedSnapshots: Partial<Record<PlatformId, PlatformStatsSnapshot>>;
  activePlatform: PlatformId;
  studentName: string;
  studentInitials: string;
  onSelectPlatform: (id: PlatformId) => void;
  onLinkPlatform: (id: PlatformId) => void;
}

export const PlatformSwitcher: React.FC<PlatformSwitcherProps> = ({
  platforms,
  linkedSnapshots,
  activePlatform,
  studentName = 'Dasamneni Jayanth Kumar Naidu',
  studentInitials = 'DJ',
  onSelectPlatform,
  onLinkPlatform,
}) => {
  return (
    <aside className="w-[280px] shrink-0 bg-surface border border-borderLine rounded-2xl shadow-xs flex flex-col overflow-hidden p-6 space-y-6">
      {/* User Identity Block */}
      <div className="flex flex-col items-center text-center space-y-3">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-[#1E65FF] text-white font-black text-2xl flex items-center justify-center shadow-md">
            {studentInitials}
          </div>
          {/* Active status dot */}
          <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-[#22C55E] border-2 border-white shadow-xs" />
        </div>
        <h2 className="text-base font-extrabold text-textPrimary leading-snug max-w-[200px]">
          {studentName}
        </h2>
      </div>

      {/* Platform Section List */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-textSecondary uppercase tracking-wider px-1">
          Platforms
        </p>

        <nav className="space-y-1">
          {platforms.map((platform) => {
            const isLinked = !!linkedSnapshots[platform.id];
            const isActive = activePlatform === platform.id;
            const snapshot = linkedSnapshots[platform.id];

            const handleClick = () => {
              if (!isLinked && platform.id !== 'coding-stats') {
                onLinkPlatform(platform.id);
                return;
              }
              onSelectPlatform(platform.id);
            };

            return (
              <button
                key={platform.id}
                onClick={handleClick}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all group ${
                  isActive
                    ? 'bg-[#EEF2FF] text-[#1E65FF] font-bold shadow-2xs'
                    : isLinked
                    ? 'text-textPrimary hover:bg-background'
                    : 'text-textSecondary/60 hover:bg-background cursor-pointer'
                }`}
              >
                {/* Platform Icon */}
                <span className="text-base leading-none shrink-0">
                  {platform.emoji}
                </span>

                {/* Platform Name */}
                <span className="flex-1 text-xs font-semibold truncate">
                  {platform.name}
                </span>

                {/* Status Icons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isLinked && (
                    <div className="w-4 h-4 rounded-full bg-[#22C55E]/15 text-[#22C55E] flex items-center justify-center">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                  )}
                  {isActive && isLinked && snapshot?.profileUrl && (
                    <a
                      href={snapshot.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-textSecondary hover:text-[#1E65FF] transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {!isLinked && platform.id !== 'coding-stats' && (
                    <PlusCircle className="w-3.5 h-3.5 text-textSecondary/40 group-hover:text-textSecondary transition-colors" />
                  )}
                </div>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};
